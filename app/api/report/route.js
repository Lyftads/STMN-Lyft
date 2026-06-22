export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { aiLangSystemMessage } from '../../../lib/i18n/aiLang'
import { withTenantContext, getMeta } from '../../../lib/tenant/credentials'
import { callBrain } from '../../../lib/agent/gateway'
import { reportT, localeTag, normLocale } from '../../../lib/reportI18n'
import { reportLogoBar } from '../../../lib/reports/logo'

const GRAPH_VERSION = 'v19.0'
const OPENAI_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const GENERIC_PLACEHOLDER = '75341531_494485104475166'

// Lingua del report (impostata a inizio richiesta da setReportLocale). Le
// funzioni di formattazione numero/data e tr() la leggono, così l'intero PDF
// esce nella lingua del cliente e non solo in italiano.
let _loc = 'it-IT'   // tag Intl per numeri/date
let _lang = 'it'     // codice 2-lettere
let _tr = (k) => k   // traduttore stringhe canoniche IT
function setReportLocale(locale) {
  _lang = normLocale(locale)
  _loc = localeTag(locale)
  _tr = reportT(locale)
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const money = (n) => `€${num(n).toLocaleString(_loc, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const money2 = (n) => (n == null ? '—' : `€${num(n).toLocaleString(_loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const intf = (n) => num(n).toLocaleString(_loc)
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
async function shopifyPeriod(origin, since, until, cookie = '') {
  try {
    const r = await fetch(`${origin}/api/shopify-countries?since=${since}&until=${until}`, { cache: 'no-store', headers: { cookie }, signal: AbortSignal.timeout(40000) })
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
async function shopifyDaily(origin, since, until, cookie = '') {
  try {
    const r = await fetch(`${origin}/api/shopify-countries?since=${since}&until=${until}&breakdown=daily`, { cache: 'no-store', headers: { cookie }, signal: AbortSignal.timeout(40000) })
    const j = await r.json()
    return Array.isArray(j.daily) ? j.daily : []
  } catch { return [] }
}
// Shopify per finestra derivato da shopifyWeekly di /api/metrics: affidabile sui
// giorni recenti (Admin GraphQL), a differenza di ShopifyQL (shopify-countries
// lagga sull'ultima settimana). Usato per il report Weekly.
async function shopifyFromWeekly(origin, since, until, cookie = '') {
  try {
    const r = await fetch(`${origin}/api/metrics?preset=last_90d`, { cache: 'no-store', headers: { cookie }, signal: AbortSignal.timeout(40000) })
    const m = await r.json()
    const wk = (m?.shopifyWeekly || []).filter(w => w.date >= since && w.date <= until)
    if (!wk.length) return null
    const sum = (k) => wk.reduce((s, w) => s + num(w[k]), 0)
    return { revenue: sum('fatturato'), orders: sum('ordini'), ncOrders: sum('nc'), rcOrders: sum('rc'), fatturNC: sum('fatturNC'), fatturRC: sum('fatturRC'), resi: sum('resi'), countries: [] }
  } catch { return null }
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

// ── Top creatività Meta del periodo (immagine + copy + titolo + descrizione + CTA + dati) ──
function metaCreativeFields(c) {
  const oss = c.object_story_spec || {}
  const ld = oss.link_data || oss.video_data || {}
  const afs = c.asset_feed_spec || {}
  const ok = (u) => u && !u.includes(GENERIC_PLACEHOLDER)
  const img = ok(c.image_url) ? c.image_url : (ok(c.thumbnail_url) ? c.thumbnail_url : null)
  const body = c.body || ld.message || afs.bodies?.[0]?.text || ''
  const title = c.title || ld.name || afs.titles?.[0]?.text || ''
  const desc = ld.description || afs.descriptions?.[0]?.text || ''
  const cta = c.call_to_action_type || ld.call_to_action?.type || afs.call_to_action_types?.[0] || ''
  const psId = c.product_set_id || oss.template_data?.product_set_id || afs.product_set_id
  return { img, body, title, desc, cta, psId }
}
async function topMetaCreatives(since, until, limit = 10) {
  const META_TOKEN = getMeta().accessToken
  const acc = accountIds()
  if (!acc.length || !META_TOKEN) return null
  const ads = []
  const fields = 'ad_id,ad_name,spend,impressions,inline_link_clicks,reach,frequency,actions,action_values'
  for (const id of acc) {
    const j = await metaGraph(`${id}/insights`, { level: 'ad', time_range: JSON.stringify({ since, until }), fields, limit: '300' })
    for (const r of (j?.data || [])) ads.push({ id: r.ad_id, name: r.ad_name, ...rowFromInsight(r) })
  }
  // "Migliori" = per ricavo generato, poi per spesa
  const top = ads.filter(a => a.spend > 0).sort((a, b) => (b.revenue - a.revenue) || (b.spend - a.spend)).slice(0, limit)
  if (!top.length) return null
  const det = {}
  const ids = top.map(a => a.id)
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const d = await metaGraph('', { ids: chunk.join(','), fields: 'creative{thumbnail_url,image_url,body,title,call_to_action_type,object_story_spec,asset_feed_spec,product_set_id}' })
    if (!d) continue
    for (const aid of chunk) {
      const f = metaCreativeFields(d[aid]?.creative || {})
      if (!f.img && f.psId) { const p = await metaGraph(`${f.psId}/products`, { fields: 'image_url', limit: '1' }); f.img = p?.data?.[0]?.image_url || null }
      det[aid] = f
    }
  }
  return top.map(a => ({ ...a, ...(det[a.id] || {}) }))
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
    // Tool mode (conversation:false): brand + memorie + knowledge entrano nel
    // contesto SENZA il blocco persona/chat. Lo schema di output {summary,
    // insights, todos} resta governato dal systemPrompt → invariato.
    const { parsed } = await callBrain({
      skill: {
        id: 'report',
        json: true,
        systemPrompt: 'Sei un analista marketing di STMN Fitness (accessori CrossFit, no integratori). Scrivi in italiano, asciutto e concreto, citando SOLO i numeri del JSON. Rispondi con JSON: {"summary":"<3-5 frasi descrittive di cosa è successo nel periodo, con i numeri chiave e i confronti vs periodo precedente>","insights":["<insight 1>","<2>","<3>","<4>"],"todos":["<azione 1>","<2>","<3>"]}. Niente emoji, niente markdown.',
      },
      query: 'analisi report performance marketing e-commerce insight e azioni',
      messages: [{ role: 'user', content: `Dati del report (periodo corrente vs precedente):\n${JSON.stringify(context).slice(0, 8000)}` }],
      locale,
      conversation: false,
      temperature: 0.5,
    })
    return parsed || null
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
  return `<div class="kpi"><div class="kpi-l">${esc(_tr(label))}</div><div class="kpi-v">${value}</div><div class="kpi-d">${prev !== undefined ? deltaTag(opts.cur, opts.prev, opts) : ''}<span class="kpi-prev">${prev !== undefined ? `${_tr('prec.')} ${prev}` : ''}</span></div></div>`
}

function buildHtml({ tab, label, range, narrative, kpis, daily, hierarchy, topCampaigns, shop, topProducts, inventoryRows, productRows }) {
  const isGoogle = /google/i.test(tab)
  const today = new Date().toLocaleDateString(_loc, { day: '2-digit', month: 'long', year: 'numeric' })
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
          ${adsHtml || `<div class="muted">${_tr('Nessuna creativa attiva.')}</div>`}
        </div>`
    }).join('')
    hierarchyHtml = `
      <h2>${_tr('Gerarchia campagna')}: ${esc(c.name)}</h2>
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

  const campTable = topCampaigns ? (isGoogle ? `
    <h2>${_tr('Campagne attive')}</h2>
    <table><thead><tr><th>${_tr('Campagna')}</th><th>${_tr('Stato')}</th><th>${_tr('Spesa')}</th><th>ROAS</th><th>CTR</th><th>CPC</th><th>${_tr('Conversioni')}</th><th>${_tr('Valore conv.')}</th></tr></thead><tbody>
    ${topCampaigns.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.status || '')}</td><td>${money2(c.spend)}</td><td>${num(c.roas).toFixed(2)}x</td><td>${num(c.ctr).toFixed(2)}%</td><td>${money2(c.cpc)}</td><td>${intf(c.conversions)}</td><td>${money2(c.convValue)}</td></tr>`).join('')}
    </tbody></table>` : `
    <h2>${_tr('Campagne attive')}</h2>
    <table><thead><tr><th>${_tr('Campagna')}</th><th>${_tr('Spesa')}</th><th>ROAS</th><th>CTR</th><th>CPA</th><th>${_tr('Acquisti')}</th></tr></thead><tbody>
    ${topCampaigns.map(c => `<tr><td>${esc(c.name)}</td><td>${money2(c.spend)}</td><td>${c.roas.toFixed(2)}x</td><td>${c.ctr.toFixed(2)}%</td><td>${money2(c.cpa)}</td><td>${intf(c.purchases)}</td></tr>`).join('')}
    </tbody></table>`) : ''

  const RISK_LABEL = { le7: _tr('Stockout < 7gg'), le30: _tr('A rischio < 30gg'), oos_sales: _tr('Broken size'), oos: _tr('Esaurito') }
  const inventoryHtml = (Array.isArray(inventoryRows) && inventoryRows.length) ? `
    <h2>${_tr('Prodotti a rischio stockout')}</h2>
    <table><thead><tr><th>${_tr('Prodotto')}</th><th>${_tr('Taglia/SKU')}</th><th>${_tr('Stock')}</th><th>${_tr('Vendite/g')}</th><th>${_tr('Giorni a stockout')}</th><th>${_tr('Rischio')}</th><th>${_tr('Perse/sett.')}</th></tr></thead><tbody>
    ${inventoryRows.map(i => `<tr><td>${esc(i.productTitle || i.title || '—')}</td><td>${esc(i.size || i.sku || '—')}</td><td>${intf(i.stock)}</td><td>${num(i.velocity).toFixed(2)}</td><td>${i.daysToStockout != null ? intf(i.daysToStockout) : '—'}</td><td>${esc(RISK_LABEL[i.risk] || i.risk || '')}</td><td>${money2(num(i.lostRevPerDay) * 7)}</td></tr>`).join('')}
    </tbody></table>` : ''

  const productPerfHtml = (Array.isArray(productRows) && productRows.length) ? `
    <h2>${_tr('Performance per prodotto')}</h2>
    <table><thead><tr><th>${_tr('Prodotto')}</th><th>${_tr('Unità')}</th><th>${_tr('Fatturato netto')}</th><th>COGS</th><th>ADS</th><th>${_tr('Margine op.')}</th><th>${_tr('Margine op.')} %</th><th>ROAS</th><th>Δ</th></tr></thead><tbody>
    ${productRows.map(p => `<tr><td>${esc(p.title)}</td><td>${intf(p.units)}</td><td>${money2(p.netRevenue)}</td><td>${money2(p.cogs)}</td><td>${money2(p.ads)}</td><td>${money2(p.marginOp)}</td><td>${num(p.marginPct).toFixed(1)}%</td><td>${p.roas != null ? `${num(p.roas).toFixed(2)}x` : '—'}</td><td>${p.deltaNet != null ? `${p.deltaNet > 0 ? '+' : ''}${num(p.deltaNet).toFixed(1)}%` : '—'}</td></tr>`).join('')}
    </tbody></table>` : ''

  const productsHtml = (Array.isArray(topProducts) && topProducts.length) ? `
    <h2>${_tr('Prodotti più venduti')}</h2>
    <table><thead><tr><th>${_tr('Prodotto')}</th><th>${_tr('Fatturato')}</th><th>${_tr('Ordini')}</th><th>${_tr('Quantità')}</th></tr></thead><tbody>
    ${topProducts.slice(0, 10).map(p => `<tr><td>${esc(p.label || p.title || p.product || '—')}</td><td>${money2(p.revenue ?? p.value)}</td><td>${intf(p.orders)}</td><td>${intf(p.quantity)}</td></tr>`).join('')}
    </tbody></table>` : ''

  const countriesHtml = shop?.countries?.length ? `
    <h2>${_tr('Paesi · ordini e fatturato')}</h2>
    <table><thead><tr><th>${_tr('Paese')}</th><th>${_tr('Fatturato')}</th><th>${_tr('Ordini')}</th><th>${_tr('Nuovi')}</th><th>${_tr('Ritorno')}</th></tr></thead><tbody>
    ${shop.countries.map(c => `<tr><td>${esc(c.country)}</td><td>${money2(c.revenue)}</td><td>${intf(c.orders)}</td><td>${intf(c.ncOrders)}</td><td>${intf(c.rcOrders)}</td></tr>`).join('')}
    </tbody></table>` : ''

  return `<!doctype html><html lang="${_lang}"><head><meta charset="utf-8"><style>
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
  </style></head><body><div class="page">${reportLogoBar()}
    <div class="head">
      <div><div class="brand">Lyft<span>AI</span></div><div class="sub">STMN Fitness · Report ${esc(tab)}</div></div>
      <div class="period"><span>${_tr('Periodo')}</span><b>${esc(label)}</b><span>${range.since} → ${range.until} · vs ${range.prevSince} → ${range.prevUntil}</span><br><span>${_tr('Generato il')} ${today}</span></div>
    </div>

    ${narrative?.summary ? `<div class="summary">${esc(narrative.summary)}</div>` : ''}

    <h2>${_tr('KPI del periodo')}</h2>
    <div class="kpis">${kpiHtml}</div>

    ${daily?.length ? `<h2>${isGoogle ? _tr('Andamento valore conversioni (giornaliero)') : _tr('Andamento revenue (giornaliero)')}</h2><div class="chart">${barChart(daily, 'revenue')}</div>` : ''}

    ${(narrative?.insights?.length || narrative?.todos?.length) ? `<div class="cols">
      <div><h2>${_tr('Insight')}</h2><ul>${(narrative?.insights || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>
      <div><h2>${_tr('To-do')}</h2><ul>${(narrative?.todos || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
    </div>` : ''}

    ${hierarchyHtml}
    ${campTable}
    ${inventoryHtml}
    ${productPerfHtml}
    ${productsHtml}
    ${countriesHtml}

    <div class="foot">LyftAI · ${_tr('report generato automaticamente · i dati riflettono il periodo selezionato')}</div>
  </div></body></html>`
}

// ── Report COMPLETO: una pagina con tutte le sezioni del periodo ──
function buildFullHtml({ label, range, narrative, S }) {
  const today = new Date().toLocaleDateString(_loc, { day: '2-digit', month: 'long', year: 'numeric' })
  const grid = (arr) => `<div class="kpis">${arr.map(k => kpiCard(k.label, k.value, k.prevValue, { cur: k.cur, prev: k.prev, lowerBetter: k.lowerBetter })).join('')}</div>`
  const RISK_LABEL = { le7: _tr('Stockout < 7gg'), le30: _tr('A rischio < 30gg'), oos_sales: _tr('Broken size'), oos: _tr('Esaurito') }

  // KPI Brain (Shopify + Meta + Google)
  const kb = S.kpiBrain
  const kbSection = kb ? `
    <h2>${_tr('📊 KPI Brain — panoramica')}</h2>
    ${grid(kb.kpis)}
    ${kb.daily?.length ? `<div class="chart">${barChart(kb.daily, 'revenue')}</div>` : ''}` : ''

  // Meta KPI
  const mk = S.metaKpi
  const metaKpiSection = mk ? `<h2>${_tr('🔵 Meta KPI')}</h2>${grid(mk.kpis)}` : ''

  // Meta Detail (campagne + insight + todo)
  const md = S.metaDetail
  const metaDetailSection = md ? `
    <h2>${_tr('🔵 Meta Detail — campagne')}</h2>
    ${md.topCampaigns?.length ? `<table><thead><tr><th>${_tr('Campagna')}</th><th>${_tr('Spesa')}</th><th>ROAS</th><th>CTR</th><th>CPA</th><th>${_tr('Acquisti')}</th></tr></thead><tbody>
      ${md.topCampaigns.map(c => `<tr><td>${esc(c.name)}</td><td>${money2(c.spend)}</td><td>${num(c.roas).toFixed(2)}x</td><td>${num(c.ctr).toFixed(2)}%</td><td>${money2(c.cpa)}</td><td>${intf(c.purchases)}</td></tr>`).join('')}
      </tbody></table>` : ''}
    ${(md.insight || md.todos?.length) ? `<div class="cols">
      ${md.insight ? `<div><h3>${_tr('Insight')}</h3><p class="muted">${esc(md.insight)}</p></div>` : ''}
      ${md.todos?.length ? `<div><h3>${_tr('To-do proattivi')}</h3><ul>${md.todos.map(x => `<li>${esc(typeof x === 'string' ? x : (x.text || x.label || ''))}</li>`).join('')}</ul></div>` : ''}
    </div>` : ''}` : ''

  // Google KPI
  const gk = S.googleKpi
  const googleKpiSection = gk ? `<h2>${_tr('🟡 Google KPI')}</h2>${grid(gk.kpis)}` : ''

  // Google Detail (campagne + andamento)
  const gd = S.googleDetail
  const googleDetailSection = gd ? `
    <h2>${_tr('🟡 Google Detail — campagne')}</h2>
    ${gd.daily?.length ? `<div class="chart">${barChart(gd.daily, 'revenue', '#eab308')}</div>` : ''}
    ${gd.topCampaigns?.length ? `<table><thead><tr><th>${_tr('Campagna')}</th><th>${_tr('Spesa')}</th><th>ROAS</th><th>CTR</th><th>CPC</th><th>${_tr('Conversioni')}</th><th>${_tr('Valore conv.')}</th></tr></thead><tbody>
      ${gd.topCampaigns.map(c => `<tr><td>${esc(c.name)}</td><td>${money2(c.spend)}</td><td>${num(c.roas).toFixed(2)}x</td><td>${num(c.ctr).toFixed(2)}%</td><td>${money2(c.cpc)}</td><td>${intf(c.conversions)}</td><td>${money2(c.convValue)}</td></tr>`).join('')}
      </tbody></table>` : ''}` : ''

  // Performance Prodotti (con foto)
  const pp = S.productPerf
  const ppSection = pp ? `
    <h2>${_tr('📦 Performance prodotti')}</h2>
    ${grid(pp.kpis)}
    ${pp.rows?.length ? `<table><thead><tr><th>${_tr('Prodotto')}</th><th>${_tr('Unità')}</th><th>${_tr('Netto')}</th><th>COGS</th><th>ADS</th><th>${_tr('Margine op.')}</th><th>%</th><th>ROAS</th></tr></thead><tbody>
      ${pp.rows.map(p => `<tr><td>${p.image ? `<img class="prodimg" src="${esc(p.image)}"/>` : ''}${esc(p.title)}</td><td>${intf(p.units)}</td><td>${money2(p.netRevenue)}</td><td>${money2(p.cogs)}</td><td>${money2(p.ads)}</td><td>${money2(p.marginOp)}</td><td>${num(p.marginPct).toFixed(1)}%</td><td>${p.roas != null ? `${num(p.roas).toFixed(2)}x` : '—'}</td></tr>`).join('')}
      </tbody></table>` : ''}` : ''

  // Inventario
  const inv = S.inventory
  const invSection = inv ? `
    <h2>${_tr('🏷️ Inventario')}</h2>
    ${grid(inv.kpis)}
    ${inv.rows?.length ? `<h3>${_tr('Prodotti a rischio stockout')}</h3><table><thead><tr><th>${_tr('Prodotto')}</th><th>${_tr('Taglia/SKU')}</th><th>${_tr('Stock')}</th><th>${_tr('Vendite/g')}</th><th>${_tr('Giorni a stockout')}</th><th>${_tr('Rischio')}</th></tr></thead><tbody>
      ${inv.rows.map(i => `<tr><td>${esc(i.productTitle || i.title || '—')}</td><td>${esc(i.size || i.sku || '—')}</td><td>${intf(i.stock)}</td><td>${num(i.velocity).toFixed(2)}</td><td>${i.daysToStockout != null ? intf(i.daysToStockout) : '—'}</td><td>${esc(RISK_LABEL[i.risk] || i.risk || '')}</td></tr>`).join('')}
      </tbody></table>` : ''}` : ''

  // Klaviyo (KPI + email inviate nel periodo + flow)
  const kl = S.klaviyo
  const klEmails = S.klaviyoEmails
  const klSection = kl ? `
    <h2>${_tr('✉️ Klaviyo — email marketing')}</h2>
    ${grid(kl.kpis)}
    ${klEmails?.length ? `<h3>${_tr('Email inviate nel periodo')}</h3><table><thead><tr><th>${_tr('Email')}</th><th>${_tr('Destinatari')}</th><th>Open rate</th><th>Click rate</th><th>${_tr('Conversioni')}</th><th>${_tr('Fatturato')}</th></tr></thead><tbody>
      ${klEmails.map(e => `<tr><td>${esc(e.name || '—')}</td><td>${intf(e.recipients)}</td><td>${num(e.openRate).toFixed(1)}%</td><td>${num(e.clickRate).toFixed(1)}%</td><td>${intf(e.conversions)}</td><td>${money2(e.revenue)}</td></tr>`).join('')}
      </tbody></table>` : ''}
    ${kl.flows?.length ? `<h3>${_tr('Flow attivi')}</h3><table><thead><tr><th>${_tr('Flow')}</th><th>${_tr('Stato')}</th></tr></thead><tbody>${kl.flows.slice(0, 12).map(f => `<tr><td>${esc(f.name)}</td><td>${esc(f.status || '')}</td></tr>`).join('')}</tbody></table>` : ''}` : ''

  // Top 10 prodotti per fatturato (da KPI Brain)
  const tp = S.topProducts
  const topProductsSection = tp?.length ? `
    <h2>${_tr('🏆 Top 10 prodotti per fatturato')}</h2>
    <table><thead><tr><th>#</th><th>${_tr('Prodotto')}</th><th>${_tr('Fatturato')}</th><th>${_tr('Ordini')}</th><th>${_tr('Quantità')}</th></tr></thead><tbody>
      ${tp.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.label || p.product || p.title || '—')}</td><td>${money2(p.revenue ?? p.value)}</td><td>${intf(p.orders)}</td><td>${intf(p.quantity)}</td></tr>`).join('')}
    </tbody></table>` : ''

  // Vendite per giorno della settimana (da KPI Brain)
  const wd = S.weekday
  const wdMax = wd?.length ? Math.max(...wd.map(d => num(d.revenue ?? d.value)), 1) : 1
  const weekdaySection = wd?.length ? `
    <h2>${_tr('📅 Vendite per giorno della settimana')}</h2>
    <table><thead><tr><th>${_tr('Giorno')}</th><th>${_tr('Fatturato')}</th><th>${_tr('Ordini')}</th><th></th></tr></thead><tbody>
      ${wd.map(d => { const v = num(d.revenue ?? d.value); const w = Math.max(3, (v / wdMax) * 100); return `<tr><td>${esc(_tr(d.label || d.day))}</td><td>${money2(v)}</td><td>${intf(d.orders)}</td><td style="width:42%"><div class="wbar"><div style="width:${w}%"></div></div></td></tr>` }).join('')}
    </tbody></table>` : ''

  // Vendite e ordini per paese
  const ctr = S.countries
  const countriesSection = ctr?.length ? `
    <h2>${_tr('🌍 Vendite e ordini per paese')}</h2>
    <table><thead><tr><th>${_tr('Paese')}</th><th>${_tr('Fatturato')}</th><th>${_tr('Ordini')}</th><th>${_tr('Nuovi')}</th><th>${_tr('Ritorno')}</th></tr></thead><tbody>
      ${ctr.map(c => `<tr><td>${esc(c.country || c.country_code || '—')}</td><td>${money2(c.revenue)}</td><td>${intf(c.orders)}</td><td>${intf(c.ncOrders)}</td><td>${intf(c.rcOrders)}</td></tr>`).join('')}
    </tbody></table>` : ''

  // Top 10 creatività Meta (immagine + copy + titolo + descrizione + CTA + dati)
  const mc = S.metaCreatives
  const metaCreativesSection = mc?.length ? `
    <h2>${_tr('🎨 Top 10 creatività Meta')}</h2>
    <div class="creatives">
      ${mc.map((c, i) => `<div class="creative">
        <div class="cr-rank">#${i + 1}</div>
        ${c.img ? `<img class="cr-img" src="${esc(c.img)}"/>` : `<div class="cr-img cr-noimg">—</div>`}
        <div class="cr-info">
          <div class="cr-name">${esc(c.name || '—')}</div>
          ${c.title ? `<div class="cr-title">${esc(c.title)}</div>` : ''}
          ${c.body ? `<div class="cr-copy">${esc(String(c.body).slice(0, 240))}${String(c.body).length > 240 ? '…' : ''}</div>` : ''}
          ${c.desc ? `<div class="cr-desc">${esc(String(c.desc).slice(0, 150))}</div>` : ''}
          ${c.cta ? `<div><span class="cr-cta">${esc(String(c.cta).replace(/_/g, ' '))}</span></div>` : ''}
          <div class="cr-metrics"><span><b>${money2(c.spend)}</b> ${_tr('spesa')}</span><span><b>${num(c.roas).toFixed(2)}x</b> ROAS</span><span><b>${money2(c.revenue)}</b> ${_tr('ricavo')}</span><span><b>${intf(c.purchases)}</b> ${_tr('acquisti')}</span><span><b>${num(c.ctr).toFixed(2)}%</b> CTR</span></div>
        </div>
      </div>`).join('')}
    </div>` : ''

  return `<!doctype html><html lang="${_lang}"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 0; }
    .page { padding: 36px 40px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 22px; }
    .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
    .brand span { color: #2997ff; }
    .head .sub { font-size: 12px; color: #666; margin-top: 4px; }
    .period { text-align: right; font-size: 12px; color: #444; }
    .period b { display:block; font-size: 15px; color: #111; }
    h2 { font-size: 16px; margin: 30px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #ddd; break-after: avoid; }
    h3 { font-size: 12.5px; margin: 14px 0 6px; color: #333; }
    .summary { font-size: 13px; line-height: 1.6; color: #222; background: #f6f8fc; border-left: 3px solid #2997ff; padding: 12px 16px; border-radius: 6px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 6px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 11px 13px; break-inside: avoid; }
    .kpi-l { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #888; font-weight: 700; }
    .kpi-v { font-size: 20px; font-weight: 800; margin: 3px 0; letter-spacing: -0.02em; }
    .kpi-d { font-size: 10px; color: #888; display: flex; gap: 6px; align-items: center; }
    .delta { font-weight: 800; } .delta.up { color: #16a34a; } .delta.down { color: #dc2626; } .delta.neutral { color: #999; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 8px; }
    ul { margin: 6px 0; padding-left: 18px; } li { font-size: 12px; line-height: 1.6; margin-bottom: 4px; }
    p.muted { font-size: 12px; line-height: 1.6; color: #555; }
    .chart { border: 1px solid #eee; border-radius: 8px; padding: 10px; margin-top: 8px; break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
    th { text-align: left; background: #f3f4f6; padding: 7px 9px; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: #555; }
    td { padding: 7px 9px; border-bottom: 1px solid #eee; }
    .prodimg { width: 26px; height: 26px; border-radius: 5px; object-fit: cover; vertical-align: middle; margin-right: 7px; }
    .alert { border: 1px solid #fde68a; background: #fffbeb; border-radius: 8px; padding: 10px 13px; margin-bottom: 8px; break-inside: avoid; }
    .alert-h { font-size: 12.5px; margin-bottom: 4px; }
    .alert-r { font-size: 11.5px; color: #444; margin-top: 3px; } .alert-r span { font-weight: 800; color: #888; text-transform: uppercase; font-size: 9px; letter-spacing: .06em; margin-right: 6px; }
    .sev { font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 999px; }
    .sev.high, .sev.alta { background: #fee2e2; color: #b91c1c; } .sev.medium, .sev.media { background: #fef3c7; color: #b45309; } .sev.low, .sev.bassa { background: #e5e7eb; color: #555; }
    .muted { color: #999; font-size: 11px; }
    .wbar { height: 8px; background: #eef2f7; border-radius: 999px; overflow: hidden; }
    .wbar > div { height: 100%; background: #14b8a6; border-radius: 999px; }
    .creatives { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
    .creative { position: relative; display: flex; gap: 11px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 11px; break-inside: avoid; }
    .cr-rank { position: absolute; top: 8px; right: 10px; font-size: 10px; font-weight: 800; color: #c2c8d0; }
    .cr-img { width: 86px; height: 86px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: #f3f4f6; }
    .cr-noimg { display: flex; align-items: center; justify-content: center; color: #c2c8d0; font-size: 20px; }
    .cr-info { flex: 1; min-width: 0; }
    .cr-name { font-size: 11px; font-weight: 800; color: #111; margin-bottom: 2px; padding-right: 26px; }
    .cr-title { font-size: 11px; font-weight: 700; color: #2997ff; margin-bottom: 3px; }
    .cr-copy { font-size: 10px; color: #444; line-height: 1.45; margin-bottom: 3px; }
    .cr-desc { font-size: 9.5px; color: #777; line-height: 1.4; margin-bottom: 4px; }
    .cr-cta { display: inline-block; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; background: #eef5ff; color: #1d6fd6; padding: 2px 8px; border-radius: 999px; margin-bottom: 5px; }
    .cr-metrics { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 4px; font-size: 9.5px; color: #666; }
    .cr-metrics b { color: #111; font-size: 10.5px; }
    .foot { margin-top: 28px; padding-top: 10px; border-top: 1px solid #eee; font-size: 9px; color: #aaa; text-align: center; }
  </style></head><body><div class="page">${reportLogoBar()}
    <div class="head">
      <div><div class="sub">STMN Fitness · ${_tr('Report completo')}</div></div>
      <div class="period"><span>${_tr('Periodo')}</span><b>${esc(label)}</b><span>${range.since} → ${range.until}${range.prevSince ? ` · vs ${range.prevSince} → ${range.prevUntil}` : ''}</span><br><span>${_tr('Generato il')} ${today}</span></div>
    </div>
    ${narrative?.summary ? `<div class="summary">${esc(narrative.summary)}</div>` : ''}
    ${(narrative?.insights?.length || narrative?.todos?.length) ? `<div class="cols">
      <div><h2>${_tr('Insight')}</h2><ul>${(narrative?.insights || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>
      <div><h2>${_tr('Azioni consigliate')}</h2><ul>${(narrative?.todos || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
    </div>` : ''}
    ${kbSection}
    ${topProductsSection}
    ${weekdaySection}
    ${countriesSection}
    ${metaKpiSection}
    ${metaDetailSection}
    ${metaCreativesSection}
    ${googleKpiSection}
    ${googleDetailSection}
    ${ppSection}
    ${invSection}
    ${klSection}
    <div class="foot">LyftAI · ${_tr('report completo generato automaticamente · dati del periodo selezionato')}</div>
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
    await page.setContent(html, { waitUntil: 'load', timeout: 20000 }).catch(() => {}) // immagini lente → genera comunque il PDF
    await page.emulateMediaType('screen')
    const buf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: false, margin: { top: '14px', bottom: '14px', left: '0', right: '0' } })
    return { buf }
  } catch (e) { return { error: e?.message || 'render error' } } finally { if (browser) await browser.disconnect().catch(() => {}) }
}

// Google Ads per finestra: riusa /api/google-detail (stessa fonte della tab),
// così il report Google ha KPI, campagne e andamento giornaliero reali.
async function googleDetail(origin, since, until, cookie) {
  try {
    const url = `${origin}/api/google-detail?level=campaigns&preset=custom&since=${since}&until=${until}`
    const r = await fetch(url, { cache: 'no-store', headers: { cookie }, signal: AbortSignal.timeout(50000) })
    const j = await r.json()
    return { summary: j?.summary || {}, rows: Array.isArray(j?.rows) ? j.rows : [], dailySeries: Array.isArray(j?.dailySeries) ? j.dailySeries : [] }
  } catch { return { summary: {}, rows: [], dailySeries: [] } }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
  const { searchParams, origin } = new URL(req.url)
  setReportLocale(searchParams.get('locale')) // lingua del cliente per TUTTO il PDF
  const cookie = req.headers.get('cookie') || '' // inoltra la sessione alle fetch interne (cache hit + tenant corretto)
  const tab = searchParams.get('tab') || 'Report'
  const label = searchParams.get('label') || 'Periodo'
  const since = searchParams.get('since'), until = searchParams.get('until')
  const prevSince = searchParams.get('prevSince'), prevUntil = searchParams.get('prevUntil')
  const campaignId = searchParams.get('campaignId') || null
  if (!since || !until) return NextResponse.json({ error: 'since/until obbligatori' }, { status: 400 })
  const range = { since, until, prevSince, prevUntil }
  const presetParam = searchParams.get('preset') || null

  // ── REPORT COMPLETO: aggrega KPI Brain, Inventario, Performance, Klaviyo,
  //    Meta KPI/Detail, Google KPI/Detail, Problemi (Lighthouse) in un solo PDF.
  if (/completo|full|tutto|dashboard generale/i.test(tab)) {
    // Timeout BREVE per ogni fetch (16s): il PDF aggrega 10 fonti; se una è lenta/
    // fredda la si salta (sezione vuota) invece di far scadere l'intera funzione
    // (FUNCTION_INVOCATION_TIMEOUT). Con le cache calde rispondono tutte in ms.
    const J = (path, ms = 16000) => fetch(`${origin}${path}`, { cache: 'no-store', headers: { cookie }, signal: AbortSignal.timeout(ms) }).then(r => r.json()).catch(() => null)
    const customQ = `preset=custom&since=${since}&until=${until}`
    const days = Math.max(1, Math.round((new Date(until) - new Date(since)) / 86400000) + 1)
    const [metricsR, invR, ppR, klavR, metaKpiR, googleKpiR, metaDetR, googleDetR, lhMetaR, lhGoogleR, countriesR, klavBdR, metaCreatR] = await Promise.all([
      presetParam ? J(`/api/metrics?preset=${encodeURIComponent(presetParam)}`) : null,
      J('/api/inventory'),
      J(`/api/product-performance?since=${since}&until=${until}`),
      J(`/api/klaviyo?days=${days}`),
      J(`/api/meta-kpi?${customQ}`),
      J(`/api/google-kpi?${customQ}`),
      J(`/api/meta-detail?level=campaigns&${customQ}`),
      J(`/api/google-detail?level=campaigns&${customQ}`),
      J(`/api/lighthouse?${customQ}`),
      J(`/api/google-lighthouse?${customQ}`),
      J(`/api/shopify-countries?since=${since}&until=${until}`),
      J(`/api/klaviyo?days=${days}&part=breakdown`, 24000),
      // Creatività Meta: chiamate Graph dirette (non fetch interna), cap a 26s così il PDF esce comunque
      Promise.race([topMetaCreatives(since, until, 10).catch(() => null), new Promise(res => setTimeout(() => res(null), 26000))]),
    ])

    // KPI Brain (Shopify da metrics + Meta/Google dai rispettivi KPI)
    const sr = metricsR?.shopifyRange || {}, spr = metricsR?.shopifyPrevRange || {}
    const mt = metaKpiR?.totals || {}, mtp = metaKpiR?.prevTotals || {}
    const gt = googleKpiR?.totals || {}, gtp = googleKpiR?.prevTotals || {}
    const fat = num(sr.revenue), fatP = num(spr.revenue), ord = num(sr.orders), ordP = num(spr.orders)
    const adsSpend = num(mt.spend) + num(gt.spend), adsSpendP = num(mtp.spend) + num(gtp.spend)
    const aov = ord > 0 ? fat / ord : 0, aovP = ordP > 0 ? fatP / ordP : 0
    const mer = adsSpend > 0 ? fat / adsSpend : 0, merP = adsSpendP > 0 ? fatP / adsSpendP : 0
    const kbDaily = (metricsR?.shopifyWeekly || []).filter(w => w.date >= since && w.date <= until).map(w => ({ date: w.date, revenue: num(w.fatturato) }))
    const kpiBrain = (metricsR || metaKpiR || googleKpiR) ? {
      daily: kbDaily,
      kpis: [
        { label: 'Fatturato', value: money(fat), prevValue: money(fatP), cur: fat, prev: fatP },
        { label: 'Ordini', value: intf(ord), prevValue: intf(ordP), cur: ord, prev: ordP },
        { label: 'AOV', value: money2(aov), prevValue: money2(aovP), cur: aov, prev: aovP },
        { label: 'Nuovi clienti', value: intf(num(sr.nc)), prevValue: intf(num(spr.nc)), cur: num(sr.nc), prev: num(spr.nc) },
        { label: 'MER (blended)', value: `${mer.toFixed(2)}x`, prevValue: `${merP.toFixed(2)}x`, cur: mer, prev: merP },
        { label: 'Spesa Meta', value: money(num(mt.spend)), prevValue: money(num(mtp.spend)), cur: num(mt.spend), prev: num(mtp.spend) },
        { label: 'ROAS Meta', value: `${num(mt.roas).toFixed(2)}x`, prevValue: `${num(mtp.roas).toFixed(2)}x`, cur: num(mt.roas), prev: num(mtp.roas) },
        { label: 'Acquisti Meta', value: intf(num(mt.purchases)), prevValue: intf(num(mtp.purchases)), cur: num(mt.purchases), prev: num(mtp.purchases) },
        { label: 'Spesa Google', value: money(num(gt.spend)), prevValue: money(num(gtp.spend)), cur: num(gt.spend), prev: num(gtp.spend) },
        { label: 'ROAS Google', value: `${num(gt.roas).toFixed(2)}x`, prevValue: `${num(gtp.roas).toFixed(2)}x`, cur: num(gt.roas), prev: num(gtp.roas) },
        { label: 'Conversioni Google', value: intf(num(gt.conversions)), prevValue: intf(num(gtp.conversions)), cur: num(gt.conversions), prev: num(gtp.conversions) },
        { label: 'Sessioni', value: intf(num(sr.sessions)), prevValue: intf(num(spr.sessions)), cur: num(sr.sessions), prev: num(spr.sessions) },
      ],
    } : null

    const metaKpi = metaKpiR?.totals ? { kpis: [
      { label: 'Spesa', value: money2(mt.spend), prevValue: money2(mtp.spend), cur: num(mt.spend), prev: num(mtp.spend) },
      { label: 'Revenue (Meta)', value: money2(mt.revenue), prevValue: money2(mtp.revenue), cur: num(mt.revenue), prev: num(mtp.revenue) },
      { label: 'ROAS', value: `${num(mt.roas).toFixed(2)}x`, prevValue: `${num(mtp.roas).toFixed(2)}x`, cur: num(mt.roas), prev: num(mtp.roas) },
      { label: 'Acquisti', value: intf(mt.purchases), prevValue: intf(mtp.purchases), cur: num(mt.purchases), prev: num(mtp.purchases) },
      { label: 'CTR link', value: `${num(mt.ctr_link).toFixed(2)}%`, prevValue: `${num(mtp.ctr_link).toFixed(2)}%`, cur: num(mt.ctr_link), prev: num(mtp.ctr_link) },
      { label: 'CPC link', value: money2(mt.cpc_link), prevValue: money2(mtp.cpc_link), cur: num(mt.cpc_link), prev: num(mtp.cpc_link), lowerBetter: true },
      { label: 'CPM', value: money2(mt.cpm), prevValue: money2(mtp.cpm), cur: num(mt.cpm), prev: num(mtp.cpm), lowerBetter: true },
      { label: 'Frequenza', value: num(mt.frequency).toFixed(2), prevValue: num(mtp.frequency).toFixed(2), cur: num(mt.frequency), prev: num(mtp.frequency), lowerBetter: true },
    ] } : null

    const mdRows = Array.isArray(metaDetR?.rows) ? metaDetR.rows : []
    const metaDetail = mdRows.length || metaDetR?.insight ? {
      insight: metaDetR?.insight || '',
      todos: Array.isArray(metaDetR?.todos) ? metaDetR.todos : [],
      topCampaigns: mdRows.slice().sort((a, b) => num(b.spend) - num(a.spend)).slice(0, 12).map(c => ({
        name: c.name || c.campaign_name || '—', spend: num(c.spend), roas: num(c.roas),
        ctr: num(c.ctr_link ?? c.ctr), cpa: num(c.cost_per_result ?? c.cpa), purchases: num(c.results ?? c.purchases ?? c.conversions),
      })),
    } : null

    const googleKpi = googleKpiR?.totals ? { kpis: [
      { label: 'Spesa', value: money2(gt.spend), prevValue: money2(gtp.spend), cur: num(gt.spend), prev: num(gtp.spend) },
      { label: 'Valore conv.', value: money2(gt.convValue), prevValue: money2(gtp.convValue), cur: num(gt.convValue), prev: num(gtp.convValue) },
      { label: 'ROAS', value: `${num(gt.roas).toFixed(2)}x`, prevValue: `${num(gtp.roas).toFixed(2)}x`, cur: num(gt.roas), prev: num(gtp.roas) },
      { label: 'Conversioni', value: intf(gt.conversions), prevValue: intf(gtp.conversions), cur: num(gt.conversions), prev: num(gtp.conversions) },
      { label: 'CPA', value: money2(gt.cpa), prevValue: money2(gtp.cpa), cur: num(gt.cpa), prev: num(gtp.cpa), lowerBetter: true },
      { label: 'CTR', value: `${num(gt.ctr).toFixed(2)}%`, prevValue: `${num(gtp.ctr).toFixed(2)}%`, cur: num(gt.ctr), prev: num(gtp.ctr) },
      { label: 'CPC', value: money2(gt.cpc), prevValue: money2(gtp.cpc), cur: num(gt.cpc), prev: num(gtp.cpc), lowerBetter: true },
      { label: 'Impression', value: intf(gt.impressions), prevValue: intf(gtp.impressions), cur: num(gt.impressions), prev: num(gtp.impressions) },
    ] } : null

    const gdRows = Array.isArray(googleDetR?.rows) ? googleDetR.rows : []
    const googleDetail = gdRows.length ? {
      daily: (googleDetR?.dailySeries || []).map(d => ({ date: d.date, revenue: num(d.convValue) })),
      topCampaigns: gdRows.filter(r => num(r.spend) > 0).sort((a, b) => num(b.spend) - num(a.spend)).slice(0, 12).map(c => ({
        name: c.name || '—', spend: num(c.spend), roas: num(c.roas), ctr: num(c.ctr), cpc: num(c.cpc), conversions: num(c.conversions), convValue: num(c.convValue),
      })),
    } : null

    const ik = invR?.kpis || {}
    const inventory = invR ? { kpis: [
      { label: 'Valore magazzino', value: money(ik.inventoryValueCogs) },
      { label: 'Pezzi a stock', value: intf(ik.qtyOnHand) },
      { label: 'Stockout < 7gg', value: intf(ik.countLe7) },
      { label: 'A rischio < 30gg', value: intf(ik.countLe30) },
      { label: 'Broken sizes', value: intf(ik.brokenCount) },
      { label: 'Vendite perse/sett.', value: money(ik.lostRevenueWeek) },
    ], rows: (invR?.items || []).filter(i => ['le7', 'le30', 'oos_sales'].includes(i.risk)).sort((a, b) => num(b.priorityScore) - num(a.priorityScore)).slice(0, 20) } : null

    const pt = ppR?.totals || {}
    const productPerf = ppR ? { kpis: [
      { label: 'Fatturato netto', value: money(pt.netRevenue) },
      { label: 'Margine op.', value: money(pt.marginOp) },
      { label: 'ADS totali', value: money(pt.ads) },
      { label: 'ROAS', value: pt.roas != null ? `${num(pt.roas).toFixed(2)}x` : '—' },
      { label: 'Unità', value: intf(pt.units) },
      { label: 'Copertura costi', value: `${num(pt.costCoverage)}%` },
    ], rows: (ppR?.products || []).slice(0, 12) } : null

    const kk = klavR?.kpis || {}
    const klaviyo = klavR?.kpis ? { kpis: [
      { label: 'Email inviate', value: intf(kk.received?.total) },
      { label: 'Aperture', value: intf(kk.opened?.total) },
      { label: 'Click', value: intf(kk.clicked?.total) },
      { label: 'Open rate', value: `${num(kk.openRate).toFixed(1)}%` },
      { label: 'Click rate', value: `${num(kk.clickRate).toFixed(1)}%` },
      { label: 'Revenue email', value: money(kk.revenue?.total) },
    ], flows: klavR?.flows || [] } : null

    const lighthouse = { meta: Array.isArray(lhMetaR?.alerts) ? lhMetaR.alerts : [], google: Array.isArray(lhGoogleR?.alerts) ? lhGoogleR.alerts : [] }

    // Top prodotti per fatturato + vendite per giorno settimana (da KPI Brain / metrics)
    const topProducts = Array.isArray(metricsR?.shopifyTopProducts) && metricsR.shopifyTopProducts.length
      ? metricsR.shopifyTopProducts.slice().sort((a, b) => num(b.revenue ?? b.value) - num(a.revenue ?? a.value)).slice(0, 10) : null
    const weekday = Array.isArray(metricsR?.shopifyDayBreakdown) && metricsR.shopifyDayBreakdown.some(d => num(d.revenue ?? d.value) > 0)
      ? metricsR.shopifyDayBreakdown : null
    // Vendite e ordini per paese
    const countries = Array.isArray(countriesR?.countries) && countriesR.countries.length ? countriesR.countries.slice(0, 15) : null
    // Email Klaviyo inviate nel periodo (dal revenue breakdown per campagna)
    const klEmailRows = klavBdR?.revenueBreakdown?.campaigns?.rows
    const klaviyoEmails = Array.isArray(klEmailRows) && klEmailRows.length ? klEmailRows.slice(0, 15) : null
    // Top 10 creatività Meta
    const metaCreatives = Array.isArray(metaCreatR) && metaCreatR.length ? metaCreatR : null

    const S = { kpiBrain, metaKpi, metaDetail, metaCreatives, googleKpi, googleDetail, inventory, productPerf, klaviyo, klaviyoEmails, topProducts, weekday, countries, lighthouse }
    // AI con cap a 12s: se è lenta, il PDF esce comunque (senza executive summary).
    const narrative = await Promise.race([
      aiNarrative({
        tab: 'Completo', label, range,
        kpiBrain: kpiBrain?.kpis?.map(k => ({ label: k.label, valore: k.value, precedente: k.prevValue })),
        meta: metaKpi?.kpis?.slice(0, 4).map(k => ({ label: k.label, valore: k.value })),
        google: googleKpi?.kpis?.slice(0, 4).map(k => ({ label: k.label, valore: k.value })),
        problemi: lighthouse.meta.concat(lighthouse.google).slice(0, 6).map(a => a.title || a.metric),
      }, searchParams.get('locale')).catch(() => null),
      new Promise(res => setTimeout(() => res(null), 12000)),
    ])

    const html = buildFullHtml({ label, range, narrative, S })
    if (searchParams.get('format') === 'html') return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    const { buf: pdf, error: pdfErr } = await renderPdf(html)
    if (!pdf) return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-PDF-Error': (pdfErr || 'unknown').slice(0, 120) } })
    return new NextResponse(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="LyftAI_Completo_${since}_${until}.pdf"`, 'Cache-Control': 'no-store' } })
  }

  const isMeta = /meta/i.test(tab)
  const isGoogle = /google/i.test(tab)
  const isInventory = /inventar/i.test(tab)
  const isProductPerf = /performance prodott|prodott.*performance/i.test(tab)
  const preset = searchParams.get('preset') || null
  const metricsOk = preset && !['this_week', 'last_week', 'custom'].includes(preset)
  let kpis = [], daily = [], hierarchy = null, topCampaigns = null, shop = null, topProducts = null
  let inventoryRows = null, productRows = null

  if (isInventory) {
    // Report Inventario: stato magazzino (snapshot) + prodotti a rischio stockout
    let inv = null
    try { inv = await fetch(`${origin}/api/inventory`, { cache: 'no-store', headers: { cookie }, signal: AbortSignal.timeout(50000) }).then(r => r.json()) } catch {}
    const k = inv?.kpis || {}
    kpis = [
      { label: 'Valore magazzino', value: money(k.inventoryValueCogs) },
      { label: 'Pezzi a stock', value: intf(k.qtyOnHand) },
      { label: 'Prodotti', value: intf(k.productCount) },
      { label: 'Varianti', value: intf(k.variantCount) },
      { label: 'Stockout < 7gg', value: intf(k.countLe7) },
      { label: 'A rischio < 30gg', value: intf(k.countLe30) },
      { label: 'Broken sizes', value: intf(k.brokenCount) },
      { label: 'Vendite perse/sett.', value: money(k.lostRevenueWeek) },
    ]
    inventoryRows = (inv?.items || [])
      .filter(i => ['le7', 'le30', 'oos_sales'].includes(i.risk))
      .sort((a, b) => num(b.priorityScore) - num(a.priorityScore))
      .slice(0, 25)
  } else if (isProductPerf) {
    // Report Performance Prodotti: P&L per prodotto nel periodo selezionato
    let pp = null
    try { pp = await fetch(`${origin}/api/product-performance?since=${since}&until=${until}`, { cache: 'no-store', headers: { cookie }, signal: AbortSignal.timeout(55000) }).then(r => r.json()) } catch {}
    const tot = pp?.totals || {}
    kpis = [
      { label: 'Fatturato netto', value: money(tot.netRevenue) },
      { label: 'Margine op.', value: money(tot.marginOp) },
      { label: 'ADS totali', value: money(tot.ads) },
      { label: 'ROAS', value: tot.roas != null ? `${tot.roas}x` : '—' },
      { label: 'Unità', value: intf(tot.units) },
      { label: 'Spesa Meta', value: money(tot.metaSpend) },
      { label: 'Spesa Google', value: money(tot.googleSpend) },
      { label: 'Copertura costi', value: `${num(tot.costCoverage)}%` },
    ]
    productRows = (pp?.products || []).slice(0, 25)
  } else if (isGoogle) {
    // Report Google Ads: KPI del periodo, campagne attive, andamento giornaliero
    const [gc, gp] = await Promise.all([
      googleDetail(origin, since, until, cookie),
      prevSince ? googleDetail(origin, prevSince, prevUntil, cookie) : null,
    ])
    const a = gc?.summary || {}, b = gp?.summary || {}
    const rows = Array.isArray(gc?.rows) ? gc.rows : []
    topCampaigns = rows.filter(r => num(r.spend) > 0).sort((x, y) => num(y.spend) - num(x.spend)).slice(0, 15)
    daily = (gc?.dailySeries || []).map(d => ({ date: d.date, revenue: num(d.convValue), spend: num(d.spend) }))
    kpis = [
      { label: 'Spesa', value: money2(a.spend), prevValue: money2(b.spend), cur: num(a.spend), prev: num(b.spend) },
      { label: 'Valore conv.', value: money2(a.convValue), prevValue: money2(b.convValue), cur: num(a.convValue), prev: num(b.convValue) },
      { label: 'ROAS', value: `${num(a.roas).toFixed(2)}x`, prevValue: `${num(b.roas).toFixed(2)}x`, cur: num(a.roas), prev: num(b.roas) },
      { label: 'Conversioni', value: intf(a.conversions), prevValue: intf(b.conversions), cur: num(a.conversions), prev: num(b.conversions) },
      { label: 'CPA', value: money2(a.cpa), prevValue: money2(b.cpa), cur: num(a.cpa), prev: num(b.cpa), lowerBetter: true },
      { label: 'CTR', value: `${num(a.ctr).toFixed(2)}%`, prevValue: `${num(b.ctr).toFixed(2)}%`, cur: num(a.ctr), prev: num(b.ctr) },
      { label: 'CPC', value: money2(a.cpc), prevValue: money2(b.cpc), cur: num(a.cpc), prev: num(b.cpc), lowerBetter: true },
      { label: 'Impression', value: intf(a.impressions), prevValue: intf(b.impressions), cur: num(a.impressions), prev: num(b.impressions) },
    ]
  } else if (isMeta) {
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
        fetch(`${origin}/api/metrics?preset=${encodeURIComponent(preset)}`, { cache: 'no-store', headers: { cookie }, signal: AbortSignal.timeout(50000) }).then(r => r.json()).catch(() => null),
        shopifyPeriod(origin, since, until, cookie).catch(() => null),
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
      const f = await shopifyPeriod(origin, since, until, cookie)
      if (f) { sc.revenue = f.revenue; sc.orders = f.orders; sc.ncOrders = f.ncOrders; sc.rcOrders = f.rcOrders }
      if (prevSince) { const fp = await shopifyPeriod(origin, prevSince, prevUntil, cookie); if (fp) { sp.revenue = fp.revenue; sp.orders = fp.orders; sp.ncOrders = fp.ncOrders; sp.rcOrders = fp.rcOrders } }
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
    // Weekly: Shopify da shopifyWeekly (/api/metrics, affidabile sui giorni
    // recenti) con fallback a shopify-countries; + Meta.
    const [wCur, wPrev, sCur, sPrev, sDaily, mc, mp] = await Promise.all([
      shopifyFromWeekly(origin, since, until, cookie),
      prevSince ? shopifyFromWeekly(origin, prevSince, prevUntil, cookie) : null,
      shopifyPeriod(origin, since, until, cookie),
      prevSince ? shopifyPeriod(origin, prevSince, prevUntil, cookie) : null,
      shopifyDaily(origin, since, until, cookie),
      metaPeriod(since, until),
      prevSince ? metaPeriod(prevSince, prevUntil) : null,
    ])
    daily = sDaily; shop = sCur || wCur
    const sc = wCur || sCur || {}, sp = wPrev || sPrev || {}, a = mc || {}, b = mp || {}
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

  const html = buildHtml({ tab, label, range, narrative, kpis, daily, hierarchy, topCampaigns, shop, topProducts, inventoryRows, productRows })
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
