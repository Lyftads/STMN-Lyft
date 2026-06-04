export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getMeta } from '../../../lib/tenant/credentials'
import { getRange } from '../../../lib/metaRange'

// ============================================================================
//  Total Impact (stile Triple Whale "Total Impact")
//
//  Aggrega revenue & spend per ogni canale e calcola contributo deduplicato
//  vs revenue platform-reported (per esporre il gap di attribuzione).
//
//  Sorgenti dati:
//    - Shopify orders → revenue attribuito per UTM source (verita' deduplicata)
//    - Meta Insights → revenue + spend dichiarati da Meta CAPI/Pixel
//    - Klaviyo Reports → revenue attribuito (24h click + 5d view default)
//
//  Output:
//    - total_revenue: somma Shopify per il periodo
//    - total_spend: somma marketing spend (Meta + Google + Klaviyo costs)
//    - mer_blended: total_revenue / total_spend
//    - channels: [{ source, spend, shopify_attributed_revenue,
//                   platform_reported_revenue, overlap_gap_pct, efficiency }]
//    - daily: [{ date, total_revenue, channel_breakdown }]
// ============================================================================

const GRAPH = 'https://graph.facebook.com/v19.0'

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('preset') || 'last_28d'
    const range = getRange(preset)

    try {
      const result = await buildTotalImpact({ range, preset })
      return NextResponse.json({
        preset, range, ...result,
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      return NextResponse.json({
        error: err?.message || 'Errore',
        total_revenue: 0, total_spend: 0, mer_blended: 0,
        channels: [], daily: [],
      }, { status: 200 })
    }
  })
}

async function buildTotalImpact({ range, preset }) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Fetch in parallelo: metrics aggregato (Shopify + marketing sources),
  // meta-kpi (Meta spend & revenue), klaviyo (revenue attribuito).
  const [metricsRes, metaKpiRes, klaviyoRes] = await Promise.allSettled([
    fetch(`${origin}/api/metrics?preset=${preset}`, { cache: 'no-store' }).then(r => r.json()),
    fetch(`${origin}/api/meta-kpi?preset=${preset}`, { cache: 'no-store' }).then(r => r.json()),
    fetch(`${origin}/api/klaviyo?preset=${preset}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null),
  ])

  const metrics = metricsRes.status === 'fulfilled' ? metricsRes.value : {}
  const metaKpi = metaKpiRes.status === 'fulfilled' ? metaKpiRes.value : {}
  const klaviyo = klaviyoRes.status === 'fulfilled' ? klaviyoRes.value : null

  const total_revenue = Number(metrics?.shopifyRange?.revenue || 0)
  const meta_spend = Number(metaKpi?.totals?.spend || 0)
  const meta_revenue_pixel = Number(metaKpi?.totals?.revenue || 0)
  const klaviyo_revenue = Number(klaviyo?.totals?.revenue_attributed || klaviyo?.revenue || 0)

  // Shopify marketing sources: revenue attribuito per UTM source (verita').
  const sources = Array.isArray(metrics?.shopifyMarketingSources) ? metrics.shopifyMarketingSources : []
  const bySource = {}
  for (const s of sources) {
    const label = (s.source || s.label || '').toLowerCase()
    const key = mapSourceToChannel(label)
    if (!bySource[key]) bySource[key] = { revenue: 0, orders: 0, raw_labels: [] }
    bySource[key].revenue += Number(s.revenue || s.value || 0)
    bySource[key].orders += Number(s.orders || 0)
    bySource[key].raw_labels.push(s.source || s.label)
  }

  // Costi tool Klaviyo: assumiamo ~3% del revenue email (proxy, configurabile).
  const klaviyo_cost = klaviyo_revenue > 0 ? Math.round(klaviyo_revenue * 0.03) : 0
  const total_spend = meta_spend + klaviyo_cost
  const mer_blended = total_spend > 0 ? +(total_revenue / total_spend).toFixed(2) : 0

  // Compila channels con spend + shopify_attributed + platform_reported.
  const channels = []

  // Meta
  channels.push({
    source: 'Meta Ads',
    icon: 'meta',
    spend: meta_spend,
    shopify_attributed_revenue: Math.round(bySource.meta?.revenue || 0),
    platform_reported_revenue: Math.round(meta_revenue_pixel),
    overlap_gap_pct: meta_revenue_pixel > 0
      ? Math.round((1 - (bySource.meta?.revenue || 0) / meta_revenue_pixel) * 100)
      : 0,
    efficiency: meta_spend > 0 ? +((bySource.meta?.revenue || 0) / meta_spend).toFixed(2) : 0,
    orders: bySource.meta?.orders || 0,
  })

  // Klaviyo
  channels.push({
    source: 'Klaviyo (Email/SMS)',
    icon: 'klaviyo',
    spend: klaviyo_cost,
    shopify_attributed_revenue: Math.round(bySource.klaviyo?.revenue || 0),
    platform_reported_revenue: Math.round(klaviyo_revenue),
    overlap_gap_pct: klaviyo_revenue > 0
      ? Math.round((1 - (bySource.klaviyo?.revenue || 0) / klaviyo_revenue) * 100)
      : 0,
    efficiency: klaviyo_cost > 0 ? +((bySource.klaviyo?.revenue || 0) / klaviyo_cost).toFixed(2) : 0,
    orders: bySource.klaviyo?.orders || 0,
  })

  // Organic / Direct
  channels.push({
    source: 'Organic / Direct',
    icon: 'shopify',
    spend: 0,
    shopify_attributed_revenue: Math.round((bySource.organic?.revenue || 0) + (bySource.direct?.revenue || 0)),
    platform_reported_revenue: 0,
    overlap_gap_pct: 0,
    efficiency: 'free',
    orders: (bySource.organic?.orders || 0) + (bySource.direct?.orders || 0),
  })

  // Other / Unattributed
  const known_revenue = channels.reduce((s, c) => s + (c.shopify_attributed_revenue || 0), 0)
  const unattributed = Math.max(0, total_revenue - known_revenue)
  if (unattributed > 0) {
    channels.push({
      source: 'Unattributed',
      icon: 'shopify',
      spend: 0,
      shopify_attributed_revenue: unattributed,
      platform_reported_revenue: 0,
      overlap_gap_pct: 0,
      efficiency: 'unknown',
      orders: 0,
    })
  }

  // Daily: prendiamo lo Shopify daily se disponibile (per stacked chart).
  const daily = Array.isArray(metricsRes?.value?.shopifyDailySeries)
    ? metricsRes.value.shopifyDailySeries.map(d => ({
        date: d.date,
        revenue: Number(d.revenue || 0),
        orders: Number(d.orders || 0),
      }))
    : []

  return {
    total_revenue: Math.round(total_revenue),
    total_spend: Math.round(total_spend),
    mer_blended,
    channels: channels.sort((a, b) => (b.shopify_attributed_revenue || 0) - (a.shopify_attributed_revenue || 0)),
    daily,
  }
}

function mapSourceToChannel(label) {
  const l = String(label || '').toLowerCase()
  if (/facebook|meta|instagram|fb|ig/.test(l)) return 'meta'
  if (/google|adwords/.test(l)) return 'google'
  if (/klaviyo|email/.test(l)) return 'klaviyo'
  if (/tiktok|tt/.test(l)) return 'tiktok'
  if (/organic|seo/.test(l)) return 'organic'
  if (/direct|none|\(direct\)|\(none\)/.test(l)) return 'direct'
  return 'other'
}
