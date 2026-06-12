export const dynamic = 'force-dynamic'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getGoogle } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'

async function shopifyRest(path) {
  const { storeUrl: STORE, adminToken: TOKEN } = getShopify()
  try {
    const res = await fetch(`https://${STORE}/admin/api/2026-04/${path}`, {
      headers: { 'X-Shopify-Access-Token': TOKEN },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString()
}

async function getGoogleToken() {
  const { clientId, clientSecret, refreshToken } = getGoogle()
  if (!clientId || !refreshToken) return null
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  return data.access_token || null
}

async function ga4Report(token, propertyId, body) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  if (!res.ok) return null
  return res.json()
}

function parseRows(report) {
  if (!report?.rows) return []
  return report.rows.map(row => {
    const obj = {}
    report.dimensionHeaders?.forEach((d, i) => { obj[d.name] = row.dimensionValues?.[i]?.value })
    report.metricHeaders?.forEach((m, i) => { obj[m.name] = parseFloat(row.metricValues?.[i]?.value || '0') })
    return obj
  })
}

function getMetricVal(report, metric) {
  const idx = report?.metricHeaders?.findIndex(h => h.name === metric)
  if (idx == null || idx < 0 || !report?.rows?.[0]) return 0
  return parseFloat(report.rows[0].metricValues[idx].value || '0')
}

async function getGA4Data(token, startDate, endDate) {
  const propertyId = getGoogle().ga4PropertyId
  if (!propertyId || !token) return null
  const dateRange = { startDate, endDate }

  try {
    const [overview, topPages, pageEcom, userFlow] = await Promise.all([
      ga4Report(token, propertyId, {
        dateRanges: [dateRange],
        metrics: [
          { name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' },
          { name: 'bounceRate' }, { name: 'averageSessionDuration' },
          { name: 'addToCarts' }, { name: 'checkouts' }, { name: 'ecommercePurchases' },
          { name: 'totalRevenue' },
        ],
      }),
      ga4Report(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'pageTitle' }, { name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' }, { name: 'sessions' }, { name: 'totalUsers' },
          { name: 'averageSessionDuration' }, { name: 'bounceRate' },
          { name: 'addToCarts' }, { name: 'ecommercePurchases' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 30,
      }),
      ga4Report(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' }, { name: 'addToCarts' }, { name: 'ecommercePurchases' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 50,
      }),
      ga4Report(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'pageTitle' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 30,
      }),
    ])

    return {
      sessions: getMetricVal(overview, 'sessions'),
      users: getMetricVal(overview, 'totalUsers'),
      pageViews: getMetricVal(overview, 'screenPageViews'),
      bounceRate: getMetricVal(overview, 'bounceRate'),
      avgDuration: getMetricVal(overview, 'averageSessionDuration'),
      addToCarts: getMetricVal(overview, 'addToCarts'),
      checkouts: getMetricVal(overview, 'checkouts'),
      purchases: getMetricVal(overview, 'ecommercePurchases'),
      revenue: getMetricVal(overview, 'totalRevenue'),
      topPages: parseRows(topPages),
      pageEcom: parseRows(pageEcom),
      userFlow: parseRows(userFlow),
    }
  } catch (e) {
    console.error('GA4 CRO error:', e.message)
    return null
  }
}

async function getAllOrders(since, until) {
  const FIELDS = 'id,created_at,total_price,landing_site,line_items,customer'
  const maxParam = until ? `&created_at_max=${encodeURIComponent(until)}` : ''
  let all = [], url = `orders.json?status=any&created_at_min=${encodeURIComponent(since)}${maxParam}&limit=250&fields=${FIELDS}`
  while (url && all.length < 2000) {
    const data = await shopifyRest(url)
    if (!data?.orders) break
    all = all.concat(data.orders)
    if (data.orders.length === 250) {
      url = `orders.json?status=any&created_at_min=${encodeURIComponent(since)}${maxParam}&limit=250&since_id=${data.orders[data.orders.length - 1].id}&fields=${FIELDS}`
    } else url = null
  }
  return all
}

// Classifica gli ordini in nuovi vs ritornanti rispetto alla finestra:
// "nuovo" = cliente il cui account è stato creato dentro la finestra selezionata.
function splitCustomers(orders, windowSinceISO) {
  const nc = new Set(), rc = new Set()
  const ws = new Date(windowSinceISO).getTime()
  for (const o of orders) {
    const c = o.customer
    if (!c?.id) continue
    if (c.created_at && new Date(c.created_at).getTime() >= ws) nc.add(c.id)
    else rc.add(c.id)
  }
  return { newCustomers: nc.size, returningCustomers: rc.size }
}

// Overview GA4 leggero (solo metriche totali) per il periodo di confronto.
async function getGA4Overview(token, startDate, endDate) {
  const propertyId = getGoogle().ga4PropertyId
  if (!propertyId || !token) return null
  const r = await ga4Report(token, propertyId, {
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: 'sessions' }, { name: 'ecommercePurchases' }, { name: 'totalRevenue' }],
  }).catch(() => null)
  if (!r) return null
  return {
    sessions: getMetricVal(r, 'sessions'),
    purchases: getMetricVal(r, 'ecommercePurchases'),
    revenue: getMetricVal(r, 'totalRevenue'),
  }
}

export async function GET(request) {
  return withTenantContext(request, async () => {
  const { storeUrl: STORE, adminToken: TOKEN } = getShopify()
  if (!STORE || !TOKEN) return NextResponse.json({ error: 'Shopify not configured' }, { status: 500 })

  const { searchParams } = new URL(request.url)

  // Range giorno-preciso: since/until espliciti (ISO YYYY-MM-DD) oppure fallback
  // ?days=N (ultimi N giorni fino a oggi).
  const sinceP = searchParams.get('since'), untilP = searchParams.get('until')
  let since, until, gaStart, gaEnd, days
  if (sinceP && untilP) {
    since = new Date(`${sinceP}T00:00:00Z`).toISOString()
    until = new Date(`${untilP}T23:59:59Z`).toISOString()
    gaStart = sinceP; gaEnd = untilP
    days = Math.max(1, Math.round((new Date(`${untilP}T00:00:00Z`) - new Date(`${sinceP}T00:00:00Z`)) / 86400000) + 1)
  } else {
    days = parseInt(searchParams.get('days') || '30', 10)
    since = daysAgo(days); until = new Date().toISOString()
    gaStart = `${days}daysAgo`; gaEnd = 'today'
  }
  // Periodo precedente di pari lunghezza, subito prima.
  const prevUntilD = new Date(new Date(since).getTime() - 1)
  const prevSinceD = new Date(prevUntilD.getTime() - (days - 1) * 86400000)
  const prevSince = prevSinceD.toISOString(), prevUntil = prevUntilD.toISOString()
  const prevGaStart = prevSinceD.toISOString().slice(0, 10), prevGaEnd = prevUntilD.toISOString().slice(0, 10)

  return swrSnapshot(request, { tab: 'cro', compute: async () => {
  try {
    const token = await getGoogleToken()
    const [orders, prevOrders, abandonedRes, ga4, ga4Prev, collectionsRes, smartCollRes, productsRes] = await Promise.all([
      getAllOrders(since, until),
      getAllOrders(prevSince, prevUntil),
      shopifyRest(`abandoned_checkouts.json?created_at_min=${since}&limit=250&status=open`).catch(() => null),
      getGA4Data(token, gaStart, gaEnd),
      getGA4Overview(token, prevGaStart, prevGaEnd),
      shopifyRest('custom_collections.json?limit=50&fields=id,title,handle'),
      shopifyRest('smart_collections.json?limit=50&fields=id,title,handle'),
      shopifyRest('products.json?limit=250&fields=id,title,handle,product_type'),
    ])

    const collections = [...(collectionsRes?.custom_collections || []), ...(smartCollRes?.smart_collections || [])]
    const products = productsRes?.products || []
    const abandonedCheckouts = abandonedRes?.checkouts?.length || 0
    const hasGA4 = !!ga4

    const totalSessions = hasGA4 ? ga4.sessions : Math.round(orders.length / 0.028)
    const totalVisitors = hasGA4 ? ga4.users : totalSessions
    const totalATC = hasGA4 ? ga4.addToCarts : Math.round((orders.length + abandonedCheckouts) * 1.4)
    const totalCheckouts = hasGA4 ? ga4.checkouts : (orders.length + abandonedCheckouts)
    const totalPurchases = hasGA4 ? ga4.purchases : orders.length
    const totalPageViews = hasGA4 ? ga4.pageViews : 0

    const funnel = {
      sessions: totalSessions,
      visitors: totalVisitors,
      pageViews: totalPageViews,
      addToCart: totalATC,
      checkout: totalCheckouts,
      purchase: totalPurchases,
      viewRate: totalVisitors > 0 ? (totalPageViews / totalVisitors) * 100 : 0,
      addToCartRate: totalVisitors > 0 ? (totalATC / totalVisitors) * 100 : 0,
      checkoutRate: totalVisitors > 0 ? (totalCheckouts / totalVisitors) * 100 : 0,
      purchaseRate: totalVisitors > 0 ? (totalPurchases / totalVisitors) * 100 : 0,
      cartToCheckout: totalATC > 0 ? (totalCheckouts / totalATC) * 100 : 0,
      checkoutToPurchase: totalCheckouts > 0 ? (totalPurchases / totalCheckouts) * 100 : 0,
      dropoffs: {
        visitorToView: totalVisitors > 0 ? Math.round(totalVisitors - (totalPageViews > totalVisitors ? totalVisitors : totalPageViews * 0.75)) : 0,
        viewToCart: totalPageViews > 0 ? Math.round(totalPageViews * 0.75 - totalATC) : 0,
        cartToCheckout: Math.round(totalATC - totalCheckouts),
        checkoutToPurchase: Math.round(totalCheckouts - totalPurchases),
      },
      bounceRate: hasGA4 ? ga4.bounceRate : null,
      avgDuration: hasGA4 ? ga4.avgDuration : null,
      source: hasGA4 ? 'GA4 + Shopify' : 'Shopify (stimato)',
    }

    // Top Pages — merge GA4 + Shopify orders
    const ordersByLanding = {}
    const revenueByLanding = {}
    for (const o of orders) {
      const p = (o.landing_site || '/').split('?')[0]
      ordersByLanding[p] = (ordersByLanding[p] || 0) + 1
      revenueByLanding[p] = (revenueByLanding[p] || 0) + parseFloat(o.total_price || '0')
    }

    let topPages = []
    if (hasGA4 && ga4.topPages?.length) {
      topPages = ga4.topPages.map(p => {
        const path = p.pagePath || '/'
        return {
          page: path,
          title: p.pageTitle || path,
          sessions: p.sessions || 0,
          visitors: p.totalUsers || 0,
          pageViews: p.screenPageViews || 0,
          bounceRate: p.bounceRate || 0,
          avgDuration: p.averageSessionDuration || 0,
          addToCarts: p.addToCarts || 0,
          orders: ordersByLanding[path] || Math.round(p.ecommercePurchases || 0),
          revenue: Math.round(revenueByLanding[path] || 0),
          conversionRate: p.sessions > 0 ? ((ordersByLanding[path] || p.ecommercePurchases || 0) / p.sessions) * 100 : 0,
        }
      })
    } else {
      topPages = Object.entries(ordersByLanding)
        .map(([page, ord]) => {
          const sessions = Math.round(ord / 0.028)
          return { page, title: page, sessions, visitors: sessions, orders: ord, revenue: Math.round(revenueByLanding[page] || 0), conversionRate: sessions > 0 ? (ord / sessions) * 100 : 0, addToCarts: 0 }
        })
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 20)
    }

    // Flow — use unique visitors, support intermediate page expansion
    const buildFlow = () => {
      const nodes = [], links = []
      nodes.push({ id: 'start', name: 'Visitatori unici', value: totalVisitors, level: 0 })

      const flowData = hasGA4 ? ga4.userFlow : []
      const pageMap = {}
      for (const row of flowData) {
        const title = row.pageTitle || 'Unknown'
        const views = row.screenPageViews || 0
        const users = row.totalUsers || 0
        if (!pageMap[title]) pageMap[title] = { views: 0, users: 0 }
        pageMap[title].views += views
        pageMap[title].users += users
      }

      if (Object.keys(pageMap).length === 0) {
        pageMap['Home'] = { views: Math.round(totalVisitors * 0.4), users: Math.round(totalVisitors * 0.4) }
        for (const [path, ord] of Object.entries(ordersByLanding)) {
          if (path === '/') continue
          const name = path.replace(/^\/(products|collections)\//, '').replace(/-/g, ' ')
          pageMap[name] = { views: Math.round(ord / 0.028), users: Math.round(ord / 0.025) }
        }
      }

      const sorted = Object.entries(pageMap)
        .filter(([name]) => !name.includes('checkout') && !name.includes('cart'))
        .sort((a, b) => b[1].users - a[1].users)
        .slice(0, 12)

      for (const [name, data] of sorted) {
        const id = `page_${name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`
        const isHome = name.toLowerCase().includes('stmn') || name === 'Home' || name === '/'
        nodes.push({ id, name: name.length > 25 ? name.slice(0, 24) + '…' : name, value: data.users, level: 1, isHome })
        links.push({ source: 'start', target: id, value: data.users })
      }

      nodes.push({ id: 'atc', name: 'Aggiunte al carrello', value: totalATC, level: 2 })
      nodes.push({ id: 'checkout', name: 'Checkout', value: totalCheckouts, level: 3 })
      nodes.push({ id: 'purchase', name: 'Acquisto', value: totalPurchases, level: 4 })

      // Page-to-page links for expansion (each page links to other pages proportionally)
      const pageNodes = nodes.filter(n => n.level === 1)
      const totalPageUsers = pageNodes.reduce((s, n) => s + n.value, 0)
      for (const src of pageNodes) {
        for (const tgt of pageNodes) {
          if (src.id === tgt.id) continue
          const crossUsers = Math.round(Math.min(src.value, tgt.value) * 0.3)
          if (crossUsers > 0) {
            links.push({ source: src.id, target: tgt.id, value: crossUsers, type: 'page-to-page' })
          }
        }
        const share = totalPageUsers > 0 ? src.value / totalPageUsers : 0
        const atcShare = Math.round(totalATC * share)
        if (atcShare > 0) links.push({ source: src.id, target: 'atc', value: atcShare })
      }

      links.push({ source: 'atc', target: 'checkout', value: totalCheckouts })
      links.push({ source: 'checkout', target: 'purchase', value: totalPurchases })

      return { nodes, links }
    }

    const flow = buildFlow()
    const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total_price || '0'), 0)

    // Nuovi vs ritornanti (per la finestra corrente e quella di confronto)
    const { newCustomers, returningCustomers } = splitCustomers(orders, since)
    const prevSplit = splitCustomers(prevOrders, prevSince)
    const prevRevenue = prevOrders.reduce((s, o) => s + parseFloat(o.total_price || '0'), 0)
    const prevSessions = ga4Prev?.sessions ?? Math.round(prevOrders.length / 0.028)

    return {
      funnel, topPages, flow,
      totalRevenue: Math.round(totalRevenue),
      totalOrders: orders.length,
      shopifyOrders: orders.length,
      sessions: totalSessions,
      newCustomers, returningCustomers,
      prev: {
        revenue: Math.round(prevRevenue),
        orders: prevOrders.length,
        sessions: prevSessions,
        newCustomers: prevSplit.newCustomers,
        returningCustomers: prevSplit.returningCustomers,
      },
      range: { since: since.slice(0, 10), until: until.slice(0, 10) },
      prevRange: { since: prevGaStart, until: prevGaEnd },
      days, hasGA4,
      updatedAt: new Date().toISOString(),
    }
  } catch (e) {
    console.error('CRO route error:', e.message)
    return {
      __noCache: true,
      error: e.message,
      funnel: { sessions:0, visitors:0, pageViews:0, addToCart:0, checkout:0, purchase:0,
        addToCartRate:0, checkoutRate:0, purchaseRate:0, cartToCheckout:0, checkoutToPurchase:0,
        dropoffs:{}, source:'Errore' },
      topPages: [], flow: { nodes:[], links:[] },
      totalRevenue:0, totalOrders:0, sessions:0, newCustomers:0, returningCustomers:0,
      prev: { revenue:0, orders:0, sessions:0, newCustomers:0, returningCustomers:0 },
      days, hasGA4: false,
    }
  }
  } })
  })
}
