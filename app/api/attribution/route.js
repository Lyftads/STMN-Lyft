export const dynamic = 'force-dynamic'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { withTenantContext, getMeta } from '../../../lib/tenant/credentials'

// ── Attribuzione / Total Impact (additivo, isolato, tenant-aware) ───────────
// Vista "blended" sul business: fatturato totale Shopify vs spesa Ads, MER
// blended, split paid vs organico (last-click da UTM/referrer Shopify),
// contributo per canale, attribuzione nuovi vs ritorno, e gap tra il
// fatturato che Meta si auto-attribuisce e quello tracciato lato Shopify.
// Riusa /api/metrics (cache) per i dati Shopify; legge gli insights Meta
// attribuiti sulla stessa finestra temporale.

const metaToken = () => getMeta().accessToken
const metaAccount = () => getMeta().adAccountId
const GRAPH_VERSION = 'v19.0'

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(num(n) * 100) / 100

function normAcc(s) { const x = String(s || '').trim(); if (!x) return null; return x.startsWith('act_') ? x : `act_${x}` }
function allAccounts() { return String(metaAccount() || '').split(',').map(normAcc).filter(Boolean) }

function valFrom(arr, types) {
  if (!Array.isArray(arr)) return 0
  for (const t of types) { const v = num(arr.find(a => a.action_type === t)?.value); if (v) return v }
  return 0
}

// Normalizza/raggruppa i canali grezzi (UTM/referrer) in bucket canonici.
// La long-tail non riconosciuta resta com'è (capitalizzata).
function canonChannel(raw) {
  const l = String(raw || '').toLowerCase()
  if (/facebook|instagram|(^|[_\s-])meta|fbclid|igshid|(^|[_\s-])(fb|ig)([_\s-]|$)|abo|caba|daba/.test(l)) return 'Meta Ads'
  if (/google|gclid|youtube|gads|pmax|performance.?max|(^|[_\s-])g(ads)?([_\s-]|$)/.test(l)) return 'Google'
  if (/klaviyo|email|newsletter|mailchimp|sendgrid/.test(l)) return 'Email / Klaviyo'
  if (/tiktok|ttclid/.test(l)) return 'TikTok'
  if (/bing|microsoft/.test(l)) return 'Bing'
  const s = String(raw || '—').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Insights account-level aggregati su tutti gli account, per la finestra data
async function metaPeriod(since, until) {
  const acc = allAccounts()
  if (!acc.length || !metaToken()) return null
  const agg = { spend: 0, revenue: 0, purchases: 0, impressions: 0, clicks: 0 }
  const fields = 'spend,impressions,inline_link_clicks,actions,action_values,purchase_roas'
  for (const id of acc) {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${id}/insights`
      + `?time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`
      + `&fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(metaToken())}`
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
      const j = await res.json()
      if (j.error) continue
      for (const row of (j.data || [])) {
        const spend = num(row.spend)
        agg.spend += spend
        agg.impressions += num(row.impressions)
        agg.clicks += num(row.inline_link_clicks)
        agg.purchases += valFrom(row.actions, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'])
        let rev = valFrom(row.action_values, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'])
        if (!rev) { const pr = valFrom(row.purchase_roas, ['omni_purchase', 'purchase']); if (pr) rev = pr * spend }
        agg.revenue += rev
      }
    } catch {}
  }
  agg.roas = agg.spend > 0 ? agg.revenue / agg.spend : 0
  return agg
}

// Insights Meta giornalieri (time_increment=1) → { 'YYYY-MM-DD': {spend, metaRevenue} }
async function metaDaily(since, until) {
  const acc = allAccounts()
  const byDate = {}
  if (!acc.length || !metaToken()) return byDate
  const fields = 'spend,action_values,purchase_roas'
  for (const id of acc) {
    let url = `https://graph.facebook.com/${GRAPH_VERSION}/${id}/insights`
      + `?time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`
      + `&time_increment=1&fields=${encodeURIComponent(fields)}&limit=500&access_token=${encodeURIComponent(metaToken())}`
    let guard = 0
    while (url && guard < 8) {
      guard++
      try {
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
        const j = await res.json()
        if (j.error) break
        for (const row of (j.data || [])) {
          const d = row.date_start
          if (!d) continue
          const spend = num(row.spend)
          let rev = valFrom(row.action_values, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'])
          if (!rev) { const pr = valFrom(row.purchase_roas, ['omni_purchase', 'purchase']); if (pr) rev = pr * spend }
          if (!byDate[d]) byDate[d] = { spend: 0, metaRevenue: 0 }
          byDate[d].spend += spend
          byDate[d].metaRevenue += rev
        }
        url = j.paging?.next || null
      } catch { break }
    }
  }
  return byDate
}

// Serie giornaliera unificata per gli sparkline delle card
function buildDaily(shopifyDaily, metaByDate) {
  const srev = {}
  for (const d of (Array.isArray(shopifyDaily) ? shopifyDaily : [])) srev[d.date] = num(d.revenue)
  const dates = new Set([...Object.keys(srev), ...Object.keys(metaByDate || {})])
  return [...dates].sort().map(date => {
    const revenue = srev[date] || 0
    const spend = metaByDate?.[date]?.spend || 0
    const metaRevenue = metaByDate?.[date]?.metaRevenue || 0
    return {
      date,
      revenue: r2(revenue),
      spend: r2(spend),
      mer: spend > 0 ? r2(revenue / spend) : 0,
      metaRevenue: r2(metaRevenue),
      metaRoas: spend > 0 ? r2(metaRevenue / spend) : 0,
    }
  })
}

const mkDelta = (cur, prev) => ({ abs: r2(cur - prev), pct: prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null })

// Calcolo puro (riusato da GET e POST). Riceve i dati Shopify già pronti
// (slice di /api/metrics) + gli aggregati Meta attribuiti per finestra.
function computeAttribution({ preset, range, prev, sr = {}, spr = {}, sources = [], prevSources = [], metaCur, metaPrev, daily = [] }) {
    // ── Totali business ──
    const totalRevenue = num(sr.revenue)
    const totalOrders = num(sr.orders)
    const adSpend = num(metaCur?.spend)
    const metaRevenue = num(metaCur?.revenue)
    const metaPurchases = num(metaCur?.purchases)
    const blendedMer = adSpend > 0 ? totalRevenue / adSpend : 0
    const metaRoas = adSpend > 0 ? metaRevenue / adSpend : 0

    const prevTotalRevenue = num(spr.revenue)
    const prevAdSpend = num(metaPrev?.spend)
    const prevMetaRevenue = num(metaPrev?.revenue)
    const prevBlendedMer = prevAdSpend > 0 ? prevTotalRevenue / prevAdSpend : 0
    const prevMetaRoas = prevAdSpend > 0 ? prevMetaRevenue / prevAdSpend : 0

    // ── Canali (last-click Shopify da UTM/referrer), normalizzati e raggruppati ──
    const grouped = {}
    for (const x of sources) {
      const label = canonChannel(x.label || x.source || '—')
      if (!grouped[label]) grouped[label] = { label, revenue: 0, orders: 0 }
      grouped[label].revenue += num(x.revenue)
      grouped[label].orders += num(x.orders)
    }
    const channels = Object.values(grouped).map(g => ({
      label: g.label,
      revenue: r2(g.revenue),
      orders: g.orders,
      aov: g.orders > 0 ? r2(g.revenue / g.orders) : 0,
      sharePct: totalRevenue > 0 ? Math.round((g.revenue / totalRevenue) * 1000) / 10 : 0,
    })).sort((a, b) => b.revenue - a.revenue)

    const trackedRevenue = channels.reduce((s, c) => s + c.revenue, 0)
    const trackedOrders = channels.reduce((s, c) => s + c.orders, 0)
    const organicRevenue = r2(Math.max(0, totalRevenue - trackedRevenue))
    const organicOrders = Math.max(0, totalOrders - trackedOrders)

    const prevTracked = prevSources.reduce((s, x) => s + num(x.revenue), 0)
    const prevOrganic = Math.max(0, prevTotalRevenue - prevTracked)

    // ── Nuovi vs ritorno ──
    const ncRevenue = num(sr.fatturNC), rcRevenue = num(sr.fatturRC)
    const nc = num(sr.nc), rc = num(sr.rc)

    // ── Gap di attribuzione: quanto Meta si auto-attribuisce vs canali Meta/IG lato Shopify ──
    const metaTrackedRevenue = channels
      .filter(c => /facebook|instagram|meta/i.test(c.label))
      .reduce((s, c) => s + c.revenue, 0)
    const attributionGap = r2(metaRevenue - metaTrackedRevenue)
    const overAttributionPct = metaTrackedRevenue > 0 ? Math.round(((metaRevenue - metaTrackedRevenue) / metaTrackedRevenue) * 100) : null

    const hasShopify = totalRevenue > 0
    const hasMeta = !!(metaToken() && metaAccount()) && adSpend > 0

    return {
      preset,
      range,
      label: range?.label || preset,
      hasShopify,
      hasMeta,
      totals: {
        revenue: r2(totalRevenue),
        orders: totalOrders,
        adSpend: r2(adSpend),
        blendedMer: r2(blendedMer),
        metaRevenue: r2(metaRevenue),
        metaRoas: r2(metaRoas),
        metaPurchases,
      },
      delta: {
        revenue: mkDelta(totalRevenue, prevTotalRevenue),
        adSpend: mkDelta(adSpend, prevAdSpend),
        blendedMer: mkDelta(blendedMer, prevBlendedMer),
        metaRoas: mkDelta(metaRoas, prevMetaRoas),
      },
      split: {
        paidRevenue: trackedRevenue,
        paidOrders: trackedOrders,
        paidPct: totalRevenue > 0 ? Math.round((trackedRevenue / totalRevenue) * 1000) / 10 : 0,
        organicRevenue,
        organicOrders,
        organicPct: totalRevenue > 0 ? Math.round((organicRevenue / totalRevenue) * 1000) / 10 : 0,
        deltaPaid: mkDelta(trackedRevenue, prevTracked),
        deltaOrganic: mkDelta(organicRevenue, prevOrganic),
      },
      customers: {
        ncRevenue: r2(ncRevenue),
        rcRevenue: r2(rcRevenue),
        nc, rc,
        ncPct: (ncRevenue + rcRevenue) > 0 ? Math.round((ncRevenue / (ncRevenue + rcRevenue)) * 1000) / 10 : 0,
      },
      channels,
      daily: Array.isArray(daily) ? daily : [],
      attribution: {
        metaRevenue: r2(metaRevenue),
        metaTrackedRevenue: r2(metaTrackedRevenue),
        gap: attributionGap,
        overAttributionPct,
      },
      updatedAt: new Date().toISOString(),
    }
}

// POST: il client (autenticato) invia i dati Shopify già caricati da /api/metrics.
// Robusto anche sui preview deploy protetti da Vercel (niente self-fetch server→server).
export async function POST(req) {
  return withTenantContext(req, async () => {
    const body = await req.json().catch(() => ({}))
    const range = body.range || null
    const prev = body.prevRange || null
    const [metaCur, metaPrev, metaByDate] = await Promise.all([
      range?.since ? metaPeriod(range.since, range.until) : Promise.resolve(null),
      prev?.since ? metaPeriod(prev.since, prev.until) : Promise.resolve(null),
      range?.since ? metaDaily(range.since, range.until) : Promise.resolve({}),
    ])
    const daily = buildDaily(body.shopifyDaily, metaByDate)
    const out = computeAttribution({
      preset: body.preset, range, prev,
      sr: body.shopifyRange || {}, spr: body.shopifyPrevRange || {},
      sources: Array.isArray(body.sources) ? body.sources : [],
      prevSources: Array.isArray(body.prevSources) ? body.prevSources : [],
      metaCur, metaPrev, daily,
    })
    return NextResponse.json(out)
  })
}

// GET: comodo per curl/produzione (self-fetch a /api/metrics via origin).
export async function GET(req) {
  return withTenantContext(req, async () => {
    const { searchParams, origin } = new URL(req.url)
    const preset = searchParams.get('preset') || 'last_28d'
    const cookie = req.headers.get('cookie') || '' // sessione utente → fetch interni autenticati (post-fix multi-tenant)
    let m = null
    try {
      m = await fetch(`${origin}/api/metrics?preset=${encodeURIComponent(preset)}`, { cache: 'no-store', headers: cookie ? { cookie } : {}, signal: AbortSignal.timeout(40000) }).then(r => r.json())
    } catch {}
    const range = m?.kpiBrain?.range || null
    const prev = m?.kpiBrain?.previousRange || null
    let shopifyDaily = []
    if (range?.since) {
      try { shopifyDaily = await fetch(`${origin}/api/shopify-countries?since=${range.since}&until=${range.until}&breakdown=daily`, { cache: 'no-store', headers: cookie ? { cookie } : {}, signal: AbortSignal.timeout(40000) }).then(r => r.json()).then(j => j.daily || []) } catch {}
    }
    const [metaCur, metaPrev, metaByDate] = await Promise.all([
      range ? metaPeriod(range.since, range.until) : Promise.resolve(null),
      prev ? metaPeriod(prev.since, prev.until) : Promise.resolve(null),
      range ? metaDaily(range.since, range.until) : Promise.resolve({}),
    ])
    const daily = buildDaily(shopifyDaily, metaByDate)
    const out = computeAttribution({
      preset, range, prev,
      sr: m?.shopifyRange || {}, spr: m?.shopifyPrevRange || {},
      sources: Array.isArray(m?.shopifyMarketingSources) ? m.shopifyMarketingSources : [],
      prevSources: Array.isArray(m?.kpiBrain?.previous?.shopifyMarketingSources) ? m.kpiBrain.previous.shopifyMarketingSources : [],
      metaCur, metaPrev, daily,
    })
    return NextResponse.json(out)
  })
}
