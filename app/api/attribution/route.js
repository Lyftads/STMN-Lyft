export const dynamic = 'force-dynamic'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { withTenantContext, getMeta, getGoogle } from '../../../lib/tenant/credentials'

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
  // Errori RACCOLTI, non ingoiati: un account Meta che non risponde lasciava la
  // sua spesa a zero, e con la spesa Google nel conto il MER blended sembrava
  // piu' alto del vero senza nessun avviso.
  const errors = []
  const fields = 'spend,impressions,inline_link_clicks,actions,action_values,purchase_roas'
  for (const id of acc) {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${id}/insights`
      + `?time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`
      + `&fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(metaToken())}`
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
      const j = await res.json()
      if (j.error) { errors.push(`${id}: ${j.error.message || 'errore Meta'}`); continue }
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
    } catch (e) { errors.push(`${id}: ${e?.message || 'errore Meta'}`) }
  }
  agg.roas = agg.spend > 0 ? agg.revenue / agg.spend : 0
  if (errors.length) agg.error = errors[0]
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

// ── Google Ads: spesa del periodo, totale e per giorno ─────────────────────
// Il MER blended e' fatturato / TUTTA la spesa pubblicitaria. Prima qui entrava
// solo Meta: con Google attivo il MER usciva gonfiato di tanto quanto Google
// spende. Tre stati, perche' non si possono confondere:
//   configured:false → Google non collegato, la spesa Google e' davvero zero;
//   ok               → spesa letta;
//   error            → collegato ma la lettura e' fallita: il MER NON e' completo,
//                      e lo si dice invece di mostrare un numero che sembra buono.
async function googleSpend(since, until) {
  const g = getGoogle()
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const customerId = (g.adsCustomerId || '').replace(/-/g, '')
  const mcc = (g.adsMccId || '').replace(/-/g, '')
  if (!customerId) return { configured: false, total: 0, byDate: {} }
  if (!devToken || !g.refreshToken || !g.clientId || !g.clientSecret) {
    return { configured: true, error: 'credenziali Google Ads incomplete', total: 0, byDate: {} }
  }
  try {
    const tok = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: g.clientId, client_secret: g.clientSecret, refresh_token: g.refreshToken, grant_type: 'refresh_token' }),
      cache: 'no-store',
    }).then(r => r.json())
    if (!tok.access_token) return { configured: true, error: tok.error_description || tok.error || 'token Google non valido', total: 0, byDate: {} }
    const headers = { Authorization: `Bearer ${tok.access_token}`, 'developer-token': devToken, 'Content-Type': 'application/json' }
    if (mcc) headers['login-customer-id'] = mcc
    const res = await fetch(`https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`, {
      method: 'POST', headers, cache: 'no-store', signal: AbortSignal.timeout(25000),
      body: JSON.stringify({ query: `SELECT segments.date, metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${since}' AND '${until}'` }),
    })
    const arr = await res.json().catch(() => null)
    if (!res.ok) {
      const msg = (Array.isArray(arr) ? arr[0] : arr)?.error?.message || `Google Ads HTTP ${res.status}`
      return { configured: true, error: msg, total: 0, byDate: {} }
    }
    const byDate = {}
    let total = 0
    for (const chunk of (Array.isArray(arr) ? arr : [])) for (const row of (chunk.results || [])) {
      const d = row.segments?.date
      const cost = num(row.metrics?.costMicros ?? row.metrics?.cost_micros) / 1e6
      if (!d) continue
      byDate[d] = (byDate[d] || 0) + cost
      total += cost
    }
    return { configured: true, total, byDate }
  } catch (e) {
    return { configured: true, error: e?.message || 'errore Google Ads', total: 0, byDate: {} }
  }
}

// Serie giornaliera unificata per gli sparkline delle card
function buildDaily(shopifyDaily, metaByDate, googleByDate = {}) {
  const srev = {}
  for (const d of (Array.isArray(shopifyDaily) ? shopifyDaily : [])) srev[d.date] = num(d.revenue)
  const dates = new Set([...Object.keys(srev), ...Object.keys(metaByDate || {}), ...Object.keys(googleByDate || {})])
  return [...dates].sort().map(date => {
    const revenue = srev[date] || 0
    const metaSpend = metaByDate?.[date]?.spend || 0
    const googleSpendDay = googleByDate?.[date] || 0
    const spend = metaSpend + googleSpendDay
    const metaRevenue = metaByDate?.[date]?.metaRevenue || 0
    return {
      date,
      revenue: r2(revenue),
      spend: r2(spend),
      metaSpend: r2(metaSpend),
      googleSpend: r2(googleSpendDay),
      mer: spend > 0 ? r2(revenue / spend) : 0,
      metaRevenue: r2(metaRevenue),
      // Il ROAS di Meta resta sulla SOLA spesa Meta: e' il suo numero dichiarato.
      metaRoas: metaSpend > 0 ? r2(metaRevenue / metaSpend) : 0,
    }
  })
}

const mkDelta = (cur, prev) => ({ abs: r2(cur - prev), pct: prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null })

// Calcolo puro (riusato da GET e POST). Riceve i dati Shopify già pronti
// (slice di /api/metrics) + gli aggregati Meta attribuiti per finestra.
function computeAttribution({ preset, range, prev, sr = {}, spr = {}, sources = [], prevSources = [], metaCur, metaPrev, googleCur = null, googlePrev = null, daily = [] }) {
    // ── Totali business ──
    const totalRevenue = num(sr.revenue)
    const totalOrders = num(sr.orders)
    // Spesa pubblicitaria = Meta + Google. Il MER blended divide il fatturato
    // per tutta la spesa; il ROAS Meta resta sulla sola spesa Meta.
    const metaSpend = num(metaCur?.spend)
    const googleSpendTot = num(googleCur?.total)
    const adSpend = metaSpend + googleSpendTot
    const metaRevenue = num(metaCur?.revenue)
    const metaPurchases = num(metaCur?.purchases)
    const blendedMer = adSpend > 0 ? totalRevenue / adSpend : 0
    const metaRoas = metaSpend > 0 ? metaRevenue / metaSpend : 0

    const prevTotalRevenue = num(spr.revenue)
    const prevMetaSpend = num(metaPrev?.spend)
    const prevGoogleSpend = num(googlePrev?.total)
    const prevAdSpend = prevMetaSpend + prevGoogleSpend
    const prevMetaRevenue = num(metaPrev?.revenue)
    const prevBlendedMer = prevAdSpend > 0 ? prevTotalRevenue / prevAdSpend : 0
    const prevMetaRoas = prevMetaSpend > 0 ? prevMetaRevenue / prevMetaSpend : 0

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
    const hasMeta = !!(metaToken() && metaAccount()) && metaSpend > 0
    const hasGoogle = !!googleCur?.configured && !googleCur?.error
    const googleError = googleCur?.error || googlePrev?.error || null
    const metaError = metaCur?.error || metaPrev?.error || null

    return {
      preset,
      range,
      label: range?.label || preset,
      hasShopify,
      hasMeta,
      hasGoogle,
      // Google collegato ma non letto: il MER sopra conta solo Meta e va detto.
      googleError,
      metaError,
      totals: {
        revenue: r2(totalRevenue),
        orders: totalOrders,
        adSpend: r2(adSpend),
        metaSpend: r2(metaSpend),
        googleSpend: r2(googleSpendTot),
        blendedMer: r2(blendedMer),
        metaRevenue: r2(metaRevenue),
        metaRoas: r2(metaRoas),
        metaPurchases,
      },
      delta: {
        revenue: mkDelta(totalRevenue, prevTotalRevenue),
        adSpend: mkDelta(adSpend, prevAdSpend),
        metaSpend: mkDelta(metaSpend, prevMetaSpend),
        googleSpend: mkDelta(googleSpendTot, prevGoogleSpend),
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
    const [metaCur, metaPrev, metaByDate, googleCur, googlePrev] = await Promise.all([
      range?.since ? metaPeriod(range.since, range.until) : Promise.resolve(null),
      prev?.since ? metaPeriod(prev.since, prev.until) : Promise.resolve(null),
      range?.since ? metaDaily(range.since, range.until) : Promise.resolve({}),
      range?.since ? googleSpend(range.since, range.until) : Promise.resolve(null),
      prev?.since ? googleSpend(prev.since, prev.until) : Promise.resolve(null),
    ])
    const daily = buildDaily(body.shopifyDaily, metaByDate, googleCur?.byDate)
    const out = computeAttribution({
      preset: body.preset, range, prev,
      sr: body.shopifyRange || {}, spr: body.shopifyPrevRange || {},
      sources: Array.isArray(body.sources) ? body.sources : [],
      prevSources: Array.isArray(body.prevSources) ? body.prevSources : [],
      metaCur, metaPrev, googleCur, googlePrev, daily,
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
    const [metaCur, metaPrev, metaByDate, googleCur, googlePrev] = await Promise.all([
      range ? metaPeriod(range.since, range.until) : Promise.resolve(null),
      prev ? metaPeriod(prev.since, prev.until) : Promise.resolve(null),
      range ? metaDaily(range.since, range.until) : Promise.resolve({}),
      range ? googleSpend(range.since, range.until) : Promise.resolve(null),
      prev ? googleSpend(prev.since, prev.until) : Promise.resolve(null),
    ])
    const daily = buildDaily(shopifyDaily, metaByDate, googleCur?.byDate)
    const out = computeAttribution({
      preset, range, prev,
      sr: m?.shopifyRange || {}, spr: m?.shopifyPrevRange || {},
      sources: Array.isArray(m?.shopifyMarketingSources) ? m.shopifyMarketingSources : [],
      prevSources: Array.isArray(m?.kpiBrain?.previous?.shopifyMarketingSources) ? m.kpiBrain.previous.shopifyMarketingSources : [],
      metaCur, metaPrev, googleCur, googlePrev, daily,
    })
    return NextResponse.json(out)
  })
}
