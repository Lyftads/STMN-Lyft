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

  const [metrics, metaDetail, klaviyo, googleAds, ga4, tiktok, pinterest, snapchat, competitorIntel, productCosts, marketIntel, realtime] =
    await Promise.all([
      safeFetch(`${base}/api/metrics?preset=${encodeURIComponent(preset)}`),
      safeFetch(`${base}/api/meta-detail?preset=${encodeURIComponent(preset)}&level=campaigns`),
      safeFetch(`${base}/api/klaviyo?days=${days}`),
      safeFetch(`${base}/api/google`),
      safeFetch(`${base}/api/ga4?days=${days}`),
      safeFetch(`${base}/api/tiktok?days=${days}`),
      safeFetch(`${base}/api/pinterest?days=${days}`),
      safeFetch(`${base}/api/snapchat?days=${days}`),
      safeFetch(`${base}/api/competitor-intel`),
      safeFetch(`${base}/api/product-costs`),
      safeFetch(`${base}/api/market-intel`),
      safeFetch(`${base}/api/realtime`),
    ])

  // Search Console (dati reali): risolvi la prima proprietà verificata e prendi i dati
  let gsc = null
  try {
    const gscSites = await safeFetch(`${base}/api/gsc?action=sites`)
    const firstSite = gscSites?.sites?.[0]?.siteUrl
    if (firstSite) gsc = await safeFetch(`${base}/api/gsc?site=${encodeURIComponent(firstSite)}&days=${days}`)
  } catch {}

  const sources = {
    shopify: !!metrics?.sources?.shopify,
    meta: !!metrics?.sources?.meta || !!metaDetail,
    klaviyo: !!klaviyo?.kpis,
    googleAds: !!googleAds?.configured,
    ga4: !!ga4?.configured,
    tiktok: !!tiktok?.configured,
    pinterest: !!pinterest?.configured,
    snapchat: !!snapchat?.configured,
    searchConsole: !!gsc?.totals,
    realtime: !!realtime?.configured,
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

  if (productCosts?.products?.length) {
    context.productCosts = productCosts.products
    context.productCostsSummary = productCosts.summary
  }

  if (marketIntel) {
    context.marketIntel = {
      trustpilot: marketIntel.trustpilot || {},
      amazon: marketIntel.amazon || {},
      influencers: (marketIntel.influencers || []).map(inf => ({
        name: inf.name,
        youtube: inf.youtube ? {
          subscribers: inf.youtube.subscribers,
          recentVideos: (inf.youtube.videos || []).slice(0, 3).map(v => ({ title: v.title, date: v.published, views: v.views })),
        } : null,
        instagram: inf.instagram && !inf.instagram.error ? {
          followers: inf.instagram.followers,
          bio: inf.instagram.bio,
        } : null,
      })),
      fetchedAt: marketIntel.fetchedAt,
    }
  }

  if (competitorIntel?.competitors?.length) {
    context.competitors = competitorIntel.competitors.map((c) => {
      const ws = c.websiteData || {}
      const al = c.adLibrary || {}
      const stats = ws.stats || {}

      const onSaleProducts = (ws.products || [])
        .filter((p) => p.onSale)
        .slice(0, 5)
        .map((p) => ({
          title: p.title,
          price: p.price,
          was: p.compareAtPrice,
          discount: p.discountPct + '%',
        }))

      const topByPrice = [...(ws.products || [])]
        .filter((p) => p.price > 0)
        .sort((a, b) => b.price - a.price)
        .slice(0, 5)
        .map((p) => ({
          title: p.title,
          price: p.price,
          type: p.type,
        }))

      const social = c.social || {}
      const fb = social.facebook || {}
      const ig = social.instagram || {}

      return {
        name: c.name,
        website: c.websiteUrl,
        isShopify: ws.isShopify || false,
        activeAds: al.count || 0,
        adLibraryError: al.error || null,
        ads: (al.ads || []).slice(0, 10).map((a) => ({
          titles: a.titles,
          bodies: a.bodies,
          platforms: a.platforms,
          startDate: a.startDate,
        })),
        catalog: {
          totalProducts: stats.totalProducts || 0,
          avgPrice: stats.avgPrice ? Math.round(stats.avgPrice * 100) / 100 : 0,
          minPrice: stats.minPrice || 0,
          maxPrice: stats.maxPrice || 0,
          onSaleCount: stats.onSaleCount || 0,
          onSalePct: stats.onSalePct || 0,
          avgDiscount: stats.avgDiscount || 0,
          categories: stats.categories || [],
          outOfStock: stats.outOfStockCount || 0,
        },
        promos: ws.promos || [],
        topByPrice,
        onSaleProducts,
        facebook: fb ? {
          fans: fb.fans || 0,
          avgEngagement: fb.avgEngagement || 0,
          engagementRate: fb.engagementRate || null,
          recentPosts: (fb.recentPosts || []).slice(0, 3),
        } : null,
        instagram: ig && !ig.error ? {
          username: ig.username,
          followers: ig.followers || 0,
          following: ig.following || 0,
          posts: ig.posts || 0,
          bio: ig.bio || '',
          isVerified: ig.isVerified || false,
          avgEngagement: ig.avgEngagement || 0,
          engagementRate: ig.engagementRate || null,
          recentMedia: (ig.recentMedia || []).slice(0, 3),
        } : null,
      }
    })
    context.competitorsFetchedAt = competitorIntel.fetchedAt
  }

  if (gsc?.totals) {
    context.searchConsole = {
      site: gsc.site,
      totals: gsc.totals,
      deltas: gsc.deltas,
      branded: gsc.branded,
      opportunities: gsc.opportunities,
      topQueries: (gsc.queries || []).slice(0, 30),
      topPages: (gsc.pages || []).slice(0, 15),
      pageMovers: gsc.pageMovers,
    }
  }

  if (realtime?.configured) {
    context.realtime = { activeUsers: realtime.activeUsers, byLocation: realtime.byLocation }
  }

  return NextResponse.json(context)
}
