export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

async function safeFetch(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (data.configured === false) return null
    return data
  } catch {
    return null
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const preset = searchParams.get('preset') || 'last_28d'
  const days = searchParams.get('days') || '30'
  const base = new URL(request.url).origin

  const [metrics, metaDetail, klaviyo, googleAds, ga4, tiktok, pinterest, snapchat] =
    await Promise.all([
      safeFetch(`${base}/api/metrics?preset=${encodeURIComponent(preset)}`),
      safeFetch(`${base}/api/meta-detail?preset=${encodeURIComponent(preset)}&level=campaigns`),
      safeFetch(`${base}/api/klaviyo?days=${days}`),
      safeFetch(`${base}/api/google`),
      safeFetch(`${base}/api/ga4?days=${days}`),
      safeFetch(`${base}/api/tiktok?days=${days}`),
      safeFetch(`${base}/api/pinterest?days=${days}`),
      safeFetch(`${base}/api/snapchat?days=${days}`),
    ])

  const sources = {
    shopify: !!metrics?.sources?.shopify,
    meta: !!metrics?.sources?.meta || !!metaDetail,
    klaviyo: !!klaviyo?.kpis,
    googleAds: !!googleAds?.configured,
    ga4: !!ga4?.configured,
    tiktok: !!tiktok?.configured,
    pinterest: !!pinterest?.configured,
    snapchat: !!snapchat?.configured,
  }

  const activeCount = Object.values(sources).filter(Boolean).length

  const context = {
    sources,
    activeIntegrations: activeCount,
    preset,
    updatedAt: new Date().toISOString(),
  }

  if (metrics) {
    context.shopify = {
      monthly: metrics.shopifyMonthly,
      weekly: metrics.shopifyWeekly,
      topProducts: metrics.shopifyTopProducts,
      marketingSources: metrics.shopifyMarketingSources,
      dayBreakdown: metrics.shopifyDayBreakdown,
      aovLive: metrics.aovLive,
      ordersLive: metrics.ordersLive,
    }
    context.metaAds = {
      monthly: metrics.metaMonthly,
      weekly: metrics.metaWeekly,
      spend: metrics.metaSpend,
      kpiBrain: metrics.kpiBrain,
    }
  }

  if (metaDetail) {
    context.metaDetail = {
      summary: metaDetail.summary,
      previousSummary: metaDetail.previousSummary,
      comparison: metaDetail.comparison,
      insight: metaDetail.insight,
      todos: metaDetail.todos,
      campaigns: Array.isArray(metaDetail.rows) ? metaDetail.rows.slice(0, 30) : [],
    }
  }

  if (klaviyo?.kpis) {
    context.klaviyo = {
      kpis: {
        received: klaviyo.kpis.received?.total,
        opened: klaviyo.kpis.opened?.total,
        clicked: klaviyo.kpis.clicked?.total,
        bounced: klaviyo.kpis.bounced?.total,
        unsubscribed: klaviyo.kpis.unsubscribed?.total,
        revenue: klaviyo.kpis.revenue?.total,
        openRate: klaviyo.kpis.openRate,
        clickRate: klaviyo.kpis.clickRate,
        ctor: klaviyo.kpis.ctor,
      },
      revenueBreakdown: klaviyo.revenueBreakdown ? {
        campaignRevenue: klaviyo.revenueBreakdown.campaigns?.total,
        campaignConversions: klaviyo.revenueBreakdown.campaigns?.totalConversions,
        flowRevenue: klaviyo.revenueBreakdown.flows?.total,
        flowConversions: klaviyo.revenueBreakdown.flows?.totalConversions,
        topCampaigns: (klaviyo.revenueBreakdown.campaigns?.rows || []).slice(0, 5),
        topFlows: (klaviyo.revenueBreakdown.flows?.rows || []).slice(0, 5),
      } : null,
      flows: (klaviyo.flows || []).map(f => ({ name: f.name, status: f.status })),
      segments: (klaviyo.segments || []).map(s => ({ name: s.name, isActive: s.isActive })),
    }
  }

  if (googleAds?.configured) {
    context.googleAds = {
      totalSpend: googleAds.totalSpend,
      monthly: googleAds.monthly,
    }
  }

  if (ga4?.configured) {
    context.ga4 = {
      summary: ga4.summary,
      channels: ga4.channels,
      topPages: ga4.topPages,
      topCountries: ga4.topCountries,
    }
  }

  if (tiktok?.configured) {
    context.tiktok = {
      totals: tiktok.totals,
      campaigns: tiktok.campaigns,
    }
  }

  if (pinterest?.configured) {
    context.pinterest = { totals: pinterest.totals }
  }

  if (snapchat?.configured) {
    context.snapchat = { totals: snapchat.totals }
  }

  return NextResponse.json(context)
}
