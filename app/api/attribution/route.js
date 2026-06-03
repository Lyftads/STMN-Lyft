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

const mkDelta = (cur, prev) => ({ abs: r2(cur - prev), pct: prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null })

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { searchParams, origin } = new URL(req.url)
    const preset = searchParams.get('preset') || 'last_28d'

    // Dati Shopify dalla rotta metrics (finestre già calcolate e cache)
    let m = null
    try {
      m = await fetch(`${origin}/api/metrics?preset=${encodeURIComponent(preset)}`, { cache: 'no-store', signal: AbortSignal.timeout(40000) }).then(r => r.json())
    } catch {}

    const range = m?.kpiBrain?.range || null
    const prev = m?.kpiBrain?.previousRange || null
    const sr = m?.shopifyRange || {}
    const spr = m?.shopifyPrevRange || {}
    const sources = Array.isArray(m?.shopifyMarketingSources) ? m.shopifyMarketingSources : []
    const prevSources = Array.isArray(m?.kpiBrain?.previous?.shopifyMarketingSources) ? m.kpiBrain.previous.shopifyMarketingSources : []

    // Meta attribuito sulla stessa finestra
    const [metaCur, metaPrev] = await Promise.all([
      range ? metaPeriod(range.since, range.until) : Promise.resolve(null),
      prev ? metaPeriod(prev.since, prev.until) : Promise.resolve(null),
    ])

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

    // ── Canali (last-click Shopify da UTM/referrer) ──
    const channels = sources.map(x => {
      const revenue = num(x.revenue)
      const orders = num(x.orders)
      return {
        label: x.label || x.source || '—',
        revenue: r2(revenue),
        orders,
        aov: orders > 0 ? r2(revenue / orders) : 0,
        sharePct: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 1000) / 10 : 0,
      }
    }).sort((a, b) => b.revenue - a.revenue)

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

    const hasShopify = m?.sources?.shopify && totalRevenue > 0
    const hasMeta = !!(metaToken() && metaAccount()) && adSpend > 0

    return NextResponse.json({
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
      attribution: {
        metaRevenue: r2(metaRevenue),
        metaTrackedRevenue: r2(metaTrackedRevenue),
        gap: attributionGap,
        overAttributionPct,
      },
      updatedAt: new Date().toISOString(),
    })
  })
}
