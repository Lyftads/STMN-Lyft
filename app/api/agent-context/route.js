export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { getEffectiveTenantId } from '../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../lib/supabase/server'

async function safeFetch(url, auth) {
  try {
    // Inoltra l'autenticazione ai fetch interni server→server: senza, girerebbero
    // anonimi → dopo il fix multi-tenant ricevono creds vuote (niente dati).
    // `auth` può essere il cookie di sessione (stringa, utente loggato) oppure un
    // oggetto header (es. { 'x-internal-cron': SECRET } per lo standup via cron).
    const headers = typeof auth === 'string' ? (auth ? { cookie: auth } : {}) : (auth || {})
    const res = await fetch(url, { cache: 'no-store', headers })
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

  // Range custom (data precisa / mese / intervallo dalla domanda del Cervello).
  // metrics legge il preset "custom_<since>_<until>"; meta-detail e creative
  // vogliono invece preset=custom + since/until separati. Normalizziamo qui.
  let since = searchParams.get('since')
  let until = searchParams.get('until')
  if (preset.startsWith('custom_')) {
    const parts = preset.split('_')
    since = since || parts[1]
    until = until || parts[2]
  }
  // Query da passare alle API che usano since/until separati.
  const detailQs = (since && until)
    ? `preset=custom&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`
    : `preset=${encodeURIComponent(preset)}`
  // Auth da inoltrare ai fetch interni: cookie di sessione (utente loggato) o,
  // se assente, il segreto cron (standup automatico → creds STMN via isAuthorizedCron).
  const cron = request.headers.get('x-internal-cron') || ''
  const cronWs = request.headers.get('x-lyft-workspace') || ''
  const cookie = request.headers.get('cookie') || (cron ? { 'x-internal-cron': cron, ...(cronWs ? { 'x-lyft-workspace': cronWs } : {}) } : '')

  const [metrics, metaDetail, creative, klaviyo, googleAds, ga4, productCosts, realtime] =
    await Promise.all([
      safeFetch(`${base}/api/metrics?preset=${encodeURIComponent(preset)}`, cookie),
      safeFetch(`${base}/api/meta-detail?${detailQs}&level=campaigns`, cookie),
      safeFetch(`${base}/api/creative?${detailQs}`, cookie),
      safeFetch(`${base}/api/klaviyo?days=${days}`, cookie),
      safeFetch(`${base}/api/google`, cookie),
      safeFetch(`${base}/api/ga4?days=${days}`, cookie),
      safeFetch(`${base}/api/product-costs`, cookie),
      safeFetch(`${base}/api/realtime`, cookie),
    ])

  // Search Console (dati reali): risolvi la prima proprietà verificata e prendi i dati
  let gsc = null
  try {
    const gscSites = await safeFetch(`${base}/api/gsc?action=sites`, cookie)
    // sito scelto dal cliente (companies.gsc_site_url) → fallback al primo verificato
    const chosenSite = gscSites?.saved || gscSites?.sites?.[0]?.siteUrl
    if (chosenSite) gsc = await safeFetch(`${base}/api/gsc?site=${encodeURIComponent(chosenSite)}&days=${days}`, cookie)
  } catch {}

  // Nome dell'azienda: i consumatori (report settimanale, standup) lo leggono da
  // qui. Prima non c'era e il report intestava sempre "il tuo brand".
  // getTenantInfo() qui non serve: questa route non gira dentro withTenantContext.
  // L'header x-lyft-workspace si accetta SOLO col segreto cron valido, altrimenti
  // sarebbe un modo per farsi dire il nome di un'azienda qualsiasi.
  let brandName = null
  try {
    const cronOk = !!process.env.CRON_SECRET && cron === process.env.CRON_SECRET
    const wsId = (cronOk && request.headers.get('x-lyft-workspace')) || await getEffectiveTenantId()
    const admin = getAdminSupabase()
    if (wsId && admin) {
      const { data } = await admin.from('companies').select('company_name').eq('user_id', wsId).maybeSingle()
      brandName = data?.company_name || null
    }
  } catch {}

  const sources = {
    shopify: !!metrics?.sources?.shopify,
    meta: !!metrics?.sources?.meta || !!metaDetail,
    klaviyo: !!klaviyo?.kpis,
    googleAds: !!googleAds?.configured,
    ga4: !!ga4?.configured,
    tiktok: false, pinterest: false, snapchat: false, // route social legacy eliminate
    searchConsole: !!gsc?.totals,
    realtime: !!realtime?.configured,
  }

  const activeCount = Object.values(sources).filter(Boolean).length

  const context = {
    brand: { name: brandName },
    sources,
    activeIntegrations: activeCount,
    preset,
    periodRange: (since && until) ? { since, until } : null,
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

  // Creative a livello di singola creative/ad (NOMI reali + adset/campagna),
  // così gli agent possono citare le creative esatte senza inventarle.
  if (Array.isArray(creative?.rows) && creative.rows.length) {
    context.creatives = creative.rows.slice(0, 40).map(c => ({
      name: c.name || c.ad_name || null,
      adset: c.adset_name || null,
      campaign: c.campaign_name || null,
      spend: c.spend, roas: c.roas,
      ctr: c.ctr_link ?? c.ctr, cpc: c.cpc_link ?? c.cpc,
      impressions: c.impressions, purchases: c.purchases ?? c.orders,
      image: c.full_image_url || c.image_url || c.display_image_url || c.preview_image_url || c.thumbnail_url || null,
      copy: c.copy ? String(c.copy).slice(0, 400) : null,
      headline: (c.headline && !String(c.headline).includes('{{')) ? c.headline : null,
      description: c.description || null,
      cta: c.cta || null,
      // Prodotti del carosello/DPA: ognuno con la sua immagine (CDN Shopify, stabile)
      products: (Array.isArray(c.products) && c.products.length)
        ? c.products.slice(0, 10).map(p => ({ name: p.name, image: p.image_url, price: p.price }))
        : null,
    }))
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

  if (productCosts?.products?.length) {
    context.productCosts = productCosts.products
    context.productCostsSummary = productCosts.summary
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
