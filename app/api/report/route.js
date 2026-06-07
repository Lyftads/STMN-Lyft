export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { aiLangSystemMessage } from '../../../lib/i18n/aiLang'
import { withTenantContext, getMeta } from '../../../lib/tenant/credentials'

const GRAPH_VERSION = 'v19.0'
const OPENAI_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const GENERIC_PLACEHOLDER = '75341531_494485104475166'

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const money = (n) => `€${num(n).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const money2 = (n) => (n == null ? '—' : `€${num(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const intf = (n) => num(n).toLocaleString('it-IT')
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function accountIds() {
  const META_ACCOUNT = getMeta().adAccountId
  return String(META_ACCOUNT || '').split(',').map(s => { const x = s.trim(); if (!x) return null; return x.startsWith('act_') ? x : `act_${x}` }).filter(Boolean)
}
function valFrom(arr, types) {
  if (!Array.isArray(arr)) return 0
  for (const t of types) { const v = num(arr.find(a => a.action_type === t)?.value); if (v) return v }
  return 0
}
function deltaPct(cur, prev) { return prev > 0 ? ((cur - prev) / prev) * 100 : null }
function deltaTag(cur, prev, { lowerBetter = false } = {}) {
  const d = deltaPct(cur, prev)
  if (d == null || Math.abs(d) < 0.1) return '<span class="delta neutral">—</span>'
  const up = d > 0
  const good = lowerBetter ? !up : up
  return `<span class="delta ${good ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}%</span>`
}

// ── Shopify periodo (revenue/ordini/NC/RC) via /api/shopify-countries ──
async function shopifyPeriod(origin, since, until) {
  try {
    const r = await fetch(`${origin}/api/shopify-countries?since=${since}&until=${until}`, { cache: 'no-store', signal: AbortSignal.timeout(40000) })
    const j = await r.json()
    if (j.error || !j.total) return null
    const c = j.countries || []
    return {
      revenue: num(j.total.revenue), orders: num(j.total.orders),
      ncOrders: c.reduce((s, x) => s + num(x.ncOrders), 0),
      rcOrders: c.reduce((s, x) => s + num(x.rcOrders), 0),
      countries: c.slice(0, 10),
    }
  } catch { return null }
}
async function shopifyDaily(origin, since, until) {
  try {
    const r = await fetch(`${origin}/api/shopify-countries?since=${since}&until=${until}&breakdown=daily`, { cache: 'no-store', signal: AbortSignal.timeout(40000) })
    const j = await r.json()
    return Array.isArray(j.daily) ? j.daily : []
  } catch { return [] }
}

// ── Meta insights per finestra (account-level) ──
async function metaPeriod(since, until, extraFields = '') {
  const META_TOKEN = getMeta().accessToken
  const acc = accountIds()
  if (!acc.length || !META_TOKEN) return null
  const agg = { spend: 0, impressions: 0, clicks: 0, reach: 0, purchases: 0, revenue: 0, freqW: 0 }
  const fields = `spend,impressions,inline_link_clicks,reach,frequency,actions,action_values${extraFields}`
  for (const id of acc) {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${id}/insights?time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(META_TOKEN)}`
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
      const j = await res.json()
      for (const r of (j.data || [])) {
        agg.spend += num(r.spend); agg.impressions += num(r.impressions); agg.clicks += num(r.inline_link_clicks)
        agg.reach += num(r.reach); agg.freqW += num(r.frequency) * num(r.reach)
        agg.purchases += valFrom(r.actions, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'])
        agg.revenue += valFrom(r.action_values, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'])
      }
    } catch {}
  }
  agg.ctr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0
  agg.cpa = agg.purchases > 0 ? agg.spend / agg.purchases : null
  agg.roas = agg.spend > 0 ? agg.revenue / agg.spend : 0
  agg.frequency = agg.reach > 0 ? agg.freqW / agg.reach : 0
  agg.cpm = agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0
  return agg
}

// ── Meta gerarchia di UNA campagna (campagna → adset → ad + immagini) ──
function rowFromInsight(r) {
  const spend = num(r.spend)
  const purchases = valFrom(r.actions, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'])
  const revenue = valFrom(r.action_values, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'])
  const impressions = num(r.impressions)
  return {
    spend, impressions, purchases,
    revenue,
    reach: num(r.reach),
    frequency: num(r.frequency),
    ctr: impressions > 0 ? (num(r.inline_link_clicks) / impressions) * 100 : 0,
    cpa: purchases > 0 ? spend / purchases : null,
    roas: spend > 0 ? revenue / spend : 0,
  }
}
async function metaGraph(path, params) {
  const META_TOKEN = getMeta().accessToken
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`)
  for (const [k, v] of Object.entries(params || {})) if (v != null && v !== '') url.searchParams.set(k, v)
  url.searchParams.set('access_token', META_TOKEN)
  try { const res = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(20000) }); const j = await res.json(); return (!res.ok || j.error) ? null : j } catch { return null }
}
async function creativeImages(adIds) {
  const out = {}
  for (let i = 0; i < adIds.length; i += 50) {
    const chunk = adIds.slice(i, i + 50)
    const d = await metaGraph('', { ids: chunk.join(','), fields: 'creative{thumbnail_url,image_url,product_set_id,object_story_spec,asset_feed_spec},adset_id' })
    if (!d) continue
    for (const id of chunk) {
      const c = d[id]?.creative || {}
      const ok = (u) => u && !u.includes(GENERIC_PLACEHOLDER)
      let img = ok(c.image_url) ? c.image_url : (ok(c.thumbnail_url) ? c.thumbnail_url : null)
      if (!img) {
        const psId = c.product_set_id || c.object_story_spec?.template_data?.product_set_id || c.asset_feed_spec?.product_set_id
        if (psId) { const p = await metaGraph(`${psId}/products`, { fields: 'image_url', limit: '1' }); img = p?.data?.[0]?.image_url || null }
      }
      out[id] = img
    }
  }
  return out
}
async function campaignHierarchy(campaignId, since, until) {
  const tr = JSON.stringify({ since, until })
  const fields = 'spend,impressions,inline_link_clicks,reach,frequency,actions,action_values'
  const campIns = await metaGraph(`${campaignId}/insights`, { time_range: tr, fields: `campaign_name,${fields}` })
  const campName = campIns?.data?.[0]?.campaign_name || 'Campagna'
  const campaign = { name: campName, ...rowFromInsight(campIns?.data?.[0] || {}) }

  const adsetIns = await metaGraph(`${campaignId}/insights`, { level: 'adset', time_range: tr, fields: `adset_id,adset_name,${fields}`, limit: '200' })
  const adsets = (adsetIns?.data || []).map(r => ({ id: r.adset_id, name: r.adset_name, ...rowFromInsight(r) }))

  const adIns = await metaGraph(`${campaignId}/insights`, { level: 'ad', time_range: tr, fields: `ad_id,ad_name,adset_id,${fields}`, limit: '400' })
  const ads = (adIns?.data || []).map(r => ({ id: r.ad_id, name: r.ad_name, adsetId: r.adset_id, ...rowFromInsight(r) }))

  const imgs = await creativeImages(ads.map(a => a.id))
  for (const a of ads) a.image = imgs[a.id] || null

  // raggruppa ads per adset
  for (const as of adsets) as.ads = ads.filter(a => a.adsetId === as.id).sort((a, b) => b.spend - a.spend)
  return { campaign, adsets: adsets.sort((a, b) => b.spend - a.spend) }
}

async function listCampaigns() {
  const acc = accountIds(); const out = []
  for (const id of acc) {
    const d = await metaGraph(`${id}/campaigns`, { fields: 'id,name', effective_status: JSON.stringify(['ACTIVE']), limit: '200' })
    for (const c of (d?.data || [])) out.push({ id: c.id, name: c.name })
  }
  return out
}

// ── Narrativa AI (descrizione + insight + to-do) ──
async function aiNarrative(context, locale) {
  if (!OPENAI_KEY) return null
  try {
    const langMsg = aiLangSystemMessage(locale)
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL, temperature: 0.5, response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Sei un analista marketing di STMN Fitness (accessori CrossFit, no integratori). Scrivi in italiano, asciutto e concreto, citando SOLO i numeri del JSON. Rispondi con JSON: {"summary":"<3-5 frasi descrittive di cosa è successo nel periodo, con i numeri chiave e i confronti vs periodo precedente>","insights":["<insight 1>","<2>","<3>","<4>"],"todos":["<azione 1>","<2>","<3>"]}. Niente emoji, niente markdown.' },
          { role: 'user', content: `Dati del report (periodo corrente vs precedente):\n${JSON.stringify(context).slice(0, 8000)}` },
          ...(langMsg ? [langMsg] : []),
        ],
      }), signal: AbortSignal.timeout(40000),
    })
    const j = await res.json()
    return JSON.parse(j?.choices?.[0]?.message?.content || '{}')
  } catch { return null }
}

// ── SVG chart: barre revenue per giorno ──
function barChart(daily, key = 'revenue', color = '#2997ff') {
  const pts = (daily || []).filter(d => d).map(d => ({ label: d.date?.slice(5), v: num(d[key]) }))
  if (!pts.length) return ''
  const W = 720, H = 160, pad = 24
  const max = Math.max(...pts.map(p => p.v), 1)
  const bw = (W - pad * 2) / pts.length
  const bars = pts.map((p, i) => {
    const h = (p.v / max) * (H - pad * 2)
    const x = pad + i * bw, y = H - pad - h
    return `<rect x="${x + bw * 0.15}" y="${y}" width="${bw * 0.7}" height="${Math.max(h, 1)}" rx="2" fill="${color}" opacity="0.85"/>`
  }).join('')
  const labels = pts.map((p, i) => (i % Math.ceil(pts.length / 10) === 0 ? `<text x="${pad + i * bw + bw / 2}" y="${H - 6}" font-size="8" fill="#888" text-anchor="middle">${p.label || ''}</text>` : '')).join('')
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${bars}${labels}</svg>`
}

function kpiCard(label, value, prev, opts = {}) {
  return `<div class="kpi"><div class="kpi-l">${esc(label)}</div><div class="kpi-v">${value}</div><div class="kpi-d">${prev !== undefined ? deltaTag(opts.cur, opts.prev, opts) : ''}<span class="kpi-prev">${prev !== undefined ? `prec. ${prev}` : ''}</span></div></div>`
}

function buildHtml({ tab, label, range, narrative, kpis, daily, hierarchy, topCampaigns, shop, topProducts }) {
  const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
  const kpiHtml = kpis.map(k => kpiCard(k.label, k.value, k.prevValue, { cur: k.cur, prev: k.prev, lowerBetter: k.lowerBetter })).join('')

  let hierarchyHtml = ''
  if (hierarchy) {
    const c = hierarchy.campaign
    const adsetBlocks = hierarchy.adsets.map(as => {
      const adsHtml = (as.ads || []).map(a => `
        <div class="ad">
          <div class="ad-img">${a.image ? `<img src="${esc(a.image)}"/>` : '<div class="noimg">▧</div>'}</div>
          <div class="ad-body">
            <div class="ad-name">${esc(a.name)}</div>
            <div class="ad-kpis">
              <span>Spesa <b>${money2(a.spend)}</b></span>
              <span>ROAS <b>${a.roas.toFixed(2)}x</b></span>
              <span>CTR <b>${a.ctr.toFixed(2)}%</b></span>
              <span>CPA <b>${money2(a.cpa)}</b></span>
              <span>Freq <b>${a.frequency.toFixed(2)}</b></span>
              <span>Acquisti <b>${intf(a.purchases)}</b></span>
            </div>
          </div>
        </div>`).join('')
      return `
        <div class="adset">
          <div class="adset-h"><b>${esc(as.name)}</b><span>${money2(as.spend)} · ROAS ${as.roas.toFixed(2)}x · CTR ${as.ctr.toFixed(2)}% · ${intf(as.purchases)} acquisti</span></div>
          ${adsHtml || '<div class="muted">Nessuna creativa attiva.</div>'}
        </div>`
    }).join('')
    hierarchyHtml = `
      <h2>Gerarchia campagna: ${esc(c.name)}</h2>
      <div class="camp-kpis">
        <span>Spesa <b>${money2(c.spend)}</b></span>
        <span>Revenue <b>${money2(c.revenue)}</b></span>
        <span>ROAS <b>${c.roas.toFixed(2)}x</b></span>
        <span>CTR <b>${c.ctr.toFixed(2)}%</b></span>
        <span>CPA <b>${money2(c.cpa)}</b></span>
        <span>Freq <b>${c.frequency.toFixed(2)}</b></span>
        <span>Acquisti <b>${intf(c.purchases)}</b></span>
      </div>
      ${adsetBlocks}`
  }

  const campTable = topCampaigns ? `
    <h2>Campagne attive</h2>
    <table><thead><tr><th>Campagna</th><th>Spesa</th><th>ROAS</th><th>CTR</th><th>CPA</th><th>Acquisti</th></tr></thead><tbody>
    ${topCampaigns.map(c => `<tr><td>${esc(c.name)}</td><td>${money2(c.spend)}</td><td>${c.roas.toFixed(2)}x</td><td>${c.ctr.toFixed(2)}%</td><td>${money2(c.cpa)}</td><td>${intf(c.purchases)}</td></tr>`).join('')}
    </tbody></table>` : ''

  const productsHtml = (Array.isArray(topProducts) && topProducts.length) ? `
    <h2>Prodotti più venduti</h2>
    <table><thead><tr><th>Prodotto</th><th>Fatturato</th><th>Ordini</th><th>Quantità</th></tr></thead><tbody>
    ${topProducts.slice(0, 10).map(p => `<tr><td>${esc(p.label || p.title || p.product || '—')}</td><td>${money2(p.revenue ?? p.value)}</td><td>${intf(p.orders)}</td><td>${intf(p.quantity)}</td></tr>`).join('')}
    </tbody></table>` : ''

  const countriesHtml = shop?.countries?.length ? `
    <h2>Paesi · ordini e fatturato</h2>
    <table><thead><tr><th>Paese</th><th>Fatturato</th><th>Ordini</th><th>Nuovi</th><th>Ritorno</th></tr></thead><tbody>
    ${shop.countries.map(c => `<tr><td>${esc(c.country)}</td><td>${money2(c.revenue)}</td><td>${intf(c.orders)}</td><td>${intf(c.ncOrders)}</td><td>${intf(c.rcOrders)}</td></tr>`).join('')}
    </tbody></table>` : ''

  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 0; }
    .page { padding: 36px 40px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 22px; }
    .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
    .brand span { color: #2997ff; }
    .head .sub { font-size: 12px; color: #666; margin-top: 4px; }
    .period { text-align: right; font-size: 12px; color: #444; }
    .period b { display:block; font-size: 15px; color: #111; }
    h2 { font-size: 15px; margin: 26px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #ddd; }
    .summary { font-size: 13px; line-height: 1.6; color: #222; background: #f6f8fc; border-left: 3px solid #2997ff; padding: 12px 16px; border-radius: 6px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 6px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 11px 13px; }
    .kpi-l { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #888; font-weight: 700; }
    .kpi-v { font-size: 21px; font-weight: 800; margin: 3px 0; letter-spacing: -0.02em; }
    .kpi-d { font-size: 10px; color: #888; display: flex; gap: 6px; align-items: center; }
    .delta { font-weight: 800; }
    .delta.up { color: #16a34a; } .delta.down { color: #dc2626; } .delta.neutral { color: #999; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    ul { margin: 6px 0; padding-left: 18px; } li { font-size: 12px; line-height: 1.6; margin-bottom: 4px; }
    .chart { border: 1px solid #eee; border-radius: 8px; padding: 10px; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; background: #f3f4f6; padding: 7px 9px; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: #555; }
    td { padding: 7px 9px; border-bottom: 1px solid #eee; }
    .camp-kpis, .ad-kpis { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; color: #555; }
    .camp-kpis { margin: 8px 0 12px; } .camp-kpis b, .ad-kpis b { color: #111; }
    .adset { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 12px; break-inside: avoid; }
    .adset-h { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 10px; } .adset-h span { color: #777; font-size: 11px; }
    .ad { display: flex; gap: 12px; padding: 8px 0; border-top: 1px dashed #eee; break-inside: avoid; }
    .ad-img, .ad-img img { width: 64px; height: 64px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
    .ad-img .noimg { width: 64px; height: 64px; border-radius: 6px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; color: #bbb; }
    .ad-name { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
    .muted { color: #999; font-size: 11px; }
    .foot { margin-top: 28px; padding-top: 10px; border-top: 1px solid #eee; font-size: 9px; color: #aaa; text-align: center; }
  </style></head><body><div class="page">
    <div class="head">
      <div><div class="brand">Lyft<span>AI</span></div><div class="sub">STMN Fitness · Report ${esc(tab)}</div></div>
      <div class="period"><span>Periodo</span><b>${esc(label)}</b><span>${range.since} → ${range.until} · vs ${range.prevSince} → ${range.prevUntil}</span><br><span>Generato il ${today}</span></div>
    </div>

    ${narrative?.summary ? `<div class="summary">${esc(narrative.summary)}</div>` : ''}

    <h2>KPI del periodo</h2>
    <div class="kpis">${kpiHtml}</div>

    ${daily?.length ? `<h2>Andamento revenue (giornaliero)</h2><div class="chart">${barChart(daily, 'revenue')}</div>` : ''}

    ${(narrative?.insights?.length || narrative?.todos?.length) ? `<div class="cols">
      <div><h2>Insight</h2><ul>${(narrative?.insights || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>
      <div><h2>To-do</h2><ul>${(narrative?.todos || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
    </div>` : ''}

    ${hierarchyHtml}
    ${campTable}
    ${productsHtml}
    ${countriesHtml}

    <div class="foot">LyftAI · report generato automaticamente · i dati riflettono il periodo selezionato</div>
  </div></body></html>`
}

async function renderPdf(html) {
  const token = process.env.BROWSERLESS_TOKEN
  if (!token) return { error: 'BROWSERLESS_TOKEN mancante' }
  let browser
  try {
    const { default: puppeteer } = await import('puppeteer-core')
    const endpoint = process.env.BROWSERLESS_ENDPOINT || 'production-lon.browserless.io'
    browser = await puppeteer.connect({ browserWSEndpoint: `wss://${endpoint}/?token=${encodeURIComponent(token)}` })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 })
    await page.emulateMediaType('screen')
    const buf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: false, margin: { top: '14px', bottom: '14px', left: '0', right: '0' } })
    return { buf }
  } catch (e) { return { error: e?.message || 'render error' } } finally { if (browser) await browser.disconnect().catch(() => {}) }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
  const { searchParams, origin } = new URL(req.url)
  const tab = searchParams.get('tab') || 'Report'
  const label = searchParams.get('label') || 'Periodo'
  const since = searchParams.get('since'), until = searchParams.get('until')
  const prevSince = searchParams.get('prevSince'), prevUntil = searchParams.get('prevUntil')
  const campaignId = searchParams.get('campaignId') || null
  if (!since || !until) return NextResponse.json({ error: 'since/until obbligatori' }, { status: 400 })
  const range = { since, until, prevSince, prevUntil }

  const isMeta = /meta/i.test(tab)
  const preset = searchParams.get('preset') || null
  const metricsOk = preset && !['this_week', 'last_week', 'custom'].includes(preset)
  let kpis = [], daily = [], hierarchy = null, topCampaigns = null, shop = null, topProducts = null

  if (isMeta) {
    // Meta-attributed KPI (1 chiamata insights account per finestra) + gerarchia/top campagne
    const [mc, mp] = await Promise.all([metaPeriod(since, until), prevSince ? metaPeriod(prevSince, prevUntil) : null])
    if (campaignId) hierarchy = await campaignHierarchy(campaignId, since, until)
    else {
      const rows = []
      for (const id of accountIds()) {
        const d = await metaGraph(`${id}/insights`, { level: 'campaign', time_range: JSON.stringify({ since, until }), fields: 'campaign_name,spend,impressions,inline_link_clicks,actions,action_values', filtering: JSON.stringify([{ field: 'spend', operator: 'GREATER_THAN', value: 1 }]), limit: '100' })
        for (const r of (d?.data || [])) rows.push({ name: r.campaign_name, ...rowFromInsight(r) })
      }
      topCampaigns = rows.sort((a, b) => b.spend - a.spend).slice(0, 15)
    }
    const a = mc || {}, b = mp || {}
    kpis = [
      { label: 'Spesa', value: money2(a.spend), prevValue: money2(b.spend), cur: a.spend, prev: b.spend },
      { label: 'Revenue (Meta)', value: money2(a.revenue), prevValue: money2(b.revenue), cur: a.revenue, prev: b.revenue },
      { label: 'ROAS', value: `${(a.roas || 0).toFixed(2)}x`, prevValue: `${(b.roas || 0).toFixed(2)}x`, cur: a.roas, prev: b.roas },
      { label: 'Acquisti', value: intf(a.purchases), prevValue: intf(b.purchases), cur: a.purchases, prev: b.purchases },
      { label: 'CTR link', value: `${(a.ctr || 0).toFixed(2)}%`, prevValue: `${(b.ctr || 0).toFixed(2)}%`, cur: a.ctr, prev: b.ctr },
      { label: 'CPA', value: money2(a.cpa), prevValue: money2(b.cpa), cur: a.cpa, prev: b.cpa, lowerBetter: true },
      { label: 'CPM', value: money2(a.cpm), prevValue: money2(b.cpm), cur: a.cpm, prev: b.cpm, lowerBetter: true },
      { label: 'Frequenza', value: (a.frequency || 0).toFixed(2), prevValue: (b.frequency || 0).toFixed(2), cur: a.frequency, prev: b.frequency, lowerBetter: true },
    ]
  } else if (metricsOk) {
    // Veloce: 1 chiamata a /api/metrics (ShopifyQL, cache) + paesi (in parallelo)
    let m = null, countriesData = null
    try {
      const [mr0, cd] = await Promise.all([
        fetch(`${origin}/api/metrics?preset=${encodeURIComponent(preset)}`, { cache: 'no-store', signal: AbortSignal.timeout(35000) }).then(r => r.json()).catch(() => null),
        shopifyPeriod(origin, since, until).catch(() => null),
      ])
      m = mr0; countriesData = cd
    } catch {}
    topProducts = Array.isArray(m?.shopifyTopProducts) ? m.shopifyTopProducts : null
    if (countriesData?.countries?.length) shop = { countries: countriesData.countries }
    const sr = m?.shopifyRange || {}, spr = m?.shopifyPrevRange || {}, mr = m?.metaRange || {}, mpr = m?.metaPrevRange || {}
    const sc = { revenue: num(sr.revenue), orders: num(sr.orders), ncOrders: num(sr.nc), rcOrders: num(sr.rc), fatturNC: num(sr.fatturNC), fatturRC: num(sr.fatturRC), resi: num(sr.resi), sessions: num(sr.sessions) }
    const sp = { revenue: num(spr.revenue), orders: num(spr.orders), ncOrders: num(spr.nc), rcOrders: num(spr.rc), fatturNC: num(spr.fatturNC), fatturRC: num(spr.fatturRC), resi: num(spr.resi), sessions: num(spr.sessions) }

    // Fallback: se /api/metrics non ha dati Shopify (lento/vuoto), usa shopify-countries
    if (!sc.revenue && !sc.orders) {
      const f = await shopifyPeriod(origin, since, until)
      if (f) { sc.revenue = f.revenue; sc.orders = f.orders; sc.ncOrders = f.ncOrders; sc.rcOrders = f.rcOrders }
      if (prevSince) { const fp = await shopifyPeriod(origin, prevSince, prevUntil); if (fp) { sp.revenue = fp.revenue; sp.orders = fp.orders; sp.ncOrders = fp.ncOrders; sp.rcOrders = fp.rcOrders } }
    }

    const mSpend = num(mr.spend), mSpendP = num(mpr.spend)
    daily = (m?.shopifyWeekly || []).filter(w => w.date >= since && w.date <= until).map(w => ({ date: w.date, revenue: num(w.fatturato) }))
    const aov = sc.orders > 0 ? sc.revenue / sc.orders : 0, aovP = sp.orders > 0 ? sp.revenue / sp.orders : 0
    const mer = mSpend > 0 ? sc.revenue / mSpend : 0, merP = mSpendP > 0 ? sp.revenue / mSpendP : 0
    const cvr = sc.sessions > 0 ? (sc.orders / sc.sessions) * 100 : 0, cvrP = sp.sessions > 0 ? (sp.orders / sp.sessions) * 100 : 0
    const rep = (sc.ncOrders + sc.rcOrders) > 0 ? (sc.rcOrders / (sc.ncOrders + sc.rcOrders)) * 100 : 0
    const repP = (sp.ncOrders + sp.rcOrders) > 0 ? (sp.rcOrders / (sp.ncOrders + sp.rcOrders)) * 100 : 0
    kpis = [
      { label: 'Fatturato', value: money(sc.revenue), prevValue: money(sp.revenue), cur: sc.revenue, prev: sp.revenue },
      { label: 'Ordini', value: intf(sc.orders), prevValue: intf(sp.orders), cur: sc.orders, prev: sp.orders },
      { label: 'AOV', value: money2(aov), prevValue: money2(aovP), cur: aov, prev: aovP },
      { label: 'Sessioni', value: intf(sc.sessions), prevValue: intf(sp.sessions), cur: sc.sessions, prev: sp.sessions },
      { label: 'Conversion rate', value: `${cvr.toFixed(2)}%`, prevValue: `${cvrP.toFixed(2)}%`, cur: cvr, prev: cvrP },
      { label: 'Nuovi clienti', value: intf(sc.ncOrders), prevValue: intf(sp.ncOrders), cur: sc.ncOrders, prev: sp.ncOrders },
      { label: 'Clienti ritorno', value: intf(sc.rcOrders), prevValue: intf(sp.rcOrders), cur: sc.rcOrders, prev: sp.rcOrders },
      { label: 'Repeat rate', value: `${rep.toFixed(1)}%`, prevValue: `${repP.toFixed(1)}%`, cur: rep, prev: repP },
      { label: 'Fatturato nuovi', value: money(sc.fatturNC), prevValue: money(sp.fatturNC), cur: sc.fatturNC, prev: sp.fatturNC },
      { label: 'Fatturato ritorno', value: money(sc.fatturRC), prevValue: money(sp.fatturRC), cur: sc.fatturRC, prev: sp.fatturRC },
      { label: 'Resi', value: money(sc.resi), prevValue: money(sp.resi), cur: sc.resi, prev: sp.resi, lowerBetter: true },
      { label: 'Spesa Meta', value: money(mSpend), prevValue: money(mSpendP), cur: mSpend, prev: mSpendP },
      { label: 'MER (blended)', value: `${mer.toFixed(2)}x`, prevValue: `${merP.toFixed(2)}x`, cur: mer, prev: merP },
      { label: 'CTR Meta', value: `${(num(mr.impressions) > 0 ? (num(mr.clicks) / num(mr.impressions)) * 100 : 0).toFixed(2)}%`, prevValue: `${(num(mpr.impressions) > 0 ? (num(mpr.clicks) / num(mpr.impressions)) * 100 : 0).toFixed(2)}%`, cur: num(mr.impressions) > 0 ? num(mr.clicks) / num(mr.impressions) : 0, prev: num(mpr.impressions) > 0 ? num(mpr.clicks) / num(mpr.impressions) : 0 },
    ]
  } else {
    // Finestra arbitraria (Weekly custom): shopify-countries (finestra breve) + Meta
    const [sCur, sPrev, sDaily, mc, mp] = await Promise.all([
      shopifyPeriod(origin, since, until),
      prevSince ? shopifyPeriod(origin, prevSince, prevUntil) : null,
      shopifyDaily(origin, since, until),
      metaPeriod(since, until),
      prevSince ? metaPeriod(prevSince, prevUntil) : null,
    ])
    daily = sDaily; shop = sCur
    const sc = sCur || {}, sp = sPrev || {}, a = mc || {}, b = mp || {}
    const aov = sc.orders > 0 ? sc.revenue / sc.orders : 0, aovP = sp.orders > 0 ? sp.revenue / sp.orders : 0
    const mer = a.spend > 0 ? sc.revenue / a.spend : 0, merP = b.spend > 0 ? sp.revenue / b.spend : 0
    kpis = [
      { label: 'Fatturato', value: money(sc.revenue), prevValue: money(sp.revenue), cur: sc.revenue, prev: sp.revenue },
      { label: 'Ordini', value: intf(sc.orders), prevValue: intf(sp.orders), cur: sc.orders, prev: sp.orders },
      { label: 'AOV', value: money2(aov), prevValue: money2(aovP), cur: aov, prev: aovP },
      { label: 'Nuovi clienti', value: intf(sc.ncOrders), prevValue: intf(sp.ncOrders), cur: sc.ncOrders, prev: sp.ncOrders },
      { label: 'Clienti ritorno', value: intf(sc.rcOrders), prevValue: intf(sp.rcOrders), cur: sc.rcOrders, prev: sp.rcOrders },
      { label: 'Spesa Meta', value: money(a.spend), prevValue: money(b.spend), cur: a.spend, prev: b.spend },
      { label: 'ROAS Meta', value: `${(a.roas || 0).toFixed(2)}x`, prevValue: `${(b.roas || 0).toFixed(2)}x`, cur: a.roas, prev: b.roas },
      { label: 'MER', value: `${mer.toFixed(2)}x`, prevValue: `${merP.toFixed(2)}x`, cur: mer, prev: merP },
    ]
  }

  if (searchParams.get('debug') === '1') {
    return NextResponse.json({ tab, preset, metricsOk, isMeta, range, kpis: kpis.map(k => ({ label: k.label, value: k.value, prev: k.prevValue })), dailyPoints: daily.length })
  }

  const narrative = await aiNarrative({ tab, label, range, kpis: kpis.map(k => ({ label: k.label, valore: k.value, precedente: k.prevValue })), hierarchy: hierarchy ? { campagna: hierarchy.campaign.name, adset: hierarchy.adsets.length } : null }, searchParams.get('locale'))

  const html = buildHtml({ tab, label, range, narrative, kpis, daily, hierarchy, topCampaigns, shop, topProducts })
  if (searchParams.get('format') === 'html') {
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  const { buf: pdf, error: pdfErr } = await renderPdf(html)
  if (!pdf) {
    // Fallback: restituisce l'HTML (apribile/stampabile) se il PDF fallisce
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-PDF-Error': (pdfErr || 'unknown').slice(0, 120) } })
  }
  const fname = `LyftAI_${String(tab).replace(/\s+/g, '_')}_${since}_${until}.pdf`
  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'no-store',
    },
  })
  })
}
