export const dynamic = 'force-dynamic'
export const maxDuration = 45

import { NextResponse } from 'next/server'

const STORE = process.env.SHOPIFY_STORE_URL
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN

async function shopifyRest(path) {
  const res = await fetch(`https://${STORE}/admin/api/2024-04/${path}`, {
    headers: { 'X-Shopify-Access-Token': TOKEN },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString()
}

async function getGoogleToken() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) return null
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
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

async function getGA4Data(days) {
  const propertyId = process.env.GA4_PROPERTY_ID
  if (!propertyId) return null
  const token = await getGoogleToken()
  if (!token) return null
  const dateRange = { startDate: `${days}daysAgo`, endDate: 'today' }

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

async function getAllOrders(since) {
  let all = [], url = `orders.json?status=any&created_at_min=${since}&limit=250&fields=id,created_at,total_price,landing_site,line_items`
  while (url && all.length < 2000) {
    const data = await shopifyRest(url)
    if (!data?.orders) break
    all = all.concat(data.orders)
    if (data.orders.length === 250) {
      url = `orders.json?status=any&created_at_min=${since}&limit=250&since_id=${data.orders[data.orders.length - 1].id}&fields=id,created_at,total_price,landing_site,line_items`
    } else url = null
  }
  return all
}

export async function GET(request) {
  if (!STORE || !TOKEN) return NextResponse.json({ error: 'Shopify not configured' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30', 10)
  const since = daysAgo(days)

  try {
    const [orders, checkoutsRes, ga4, collectionsRes, smartCollRes, productsRes] = await Promise.all([
      getAllOrders(since),
      shopifyRest(`checkouts.json?created_at_min=${since}&limit=250`),
      getGA4Data(days),
      shopifyRest('custom_collections.json?limit=50&fields=id,title,handle'),
      shopifyRest('smart_collections.json?limit=50&fields=id,title,handle'),
      shopifyRest('products.json?limit=250&fields=id,title,handle,product_type'),
    ])

    const collections = [...(collectionsRes?.custom_collections || []), ...(smartCollRes?.smart_collections || [])]
    const products = productsRes?.products || []
    const abandonedCheckouts = checkoutsRes?.checkouts?.length || 0
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
      viewRate: totalSessions > 0 ? (totalPageViews / totalSessions) * 100 : 0,
      addToCartRate: totalSessions > 0 ? (totalATC / totalSessions) * 100 : 0,
      checkoutRate: totalSessions > 0 ? (totalCheckouts / totalSessions) * 100 : 0,
      purchaseRate: totalSessions > 0 ? (totalPurchases / totalSessions) * 100 : 0,
      cartToCheckout: totalATC > 0 ? (totalCheckouts / totalATC) * 100 : 0,
      checkoutToPurchase: totalCheckouts > 0 ? (totalPurchases / totalCheckouts) * 100 : 0,
      dropoffs: {
        sessionToView: totalSessions > 0 ? Math.round(totalSessions - (totalPageViews > totalSessions ? totalSessions : totalPageViews * 0.75)) : 0,
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

    // Flow — use GA4 page titles for better readability
    const buildFlow = () => {
      const nodes = [], links = []
      nodes.push({ id: 'start', name: 'Sessioni', value: totalSessions, level: 0 })

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
        // Fallback from Shopify
        pageMap['Home'] = { views: Math.round(totalSessions * 0.4), users: Math.round(totalVisitors * 0.4) }
        for (const [path, ord] of Object.entries(ordersByLanding)) {
          if (path === '/') continue
          const name = path.replace(/^\/(products|collections)\//, '').replace(/-/g, ' ')
          pageMap[name] = { views: Math.round(ord / 0.028), users: ord }
        }
      }

      const sorted = Object.entries(pageMap)
        .filter(([name]) => !name.includes('checkout') && !name.includes('cart'))
        .sort((a, b) => b[1].views - a[1].views)
        .slice(0, 12)

      for (const [name, data] of sorted) {
        const id = `page_${name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`
        const isHome = name.toLowerCase().includes('stmn') || name === 'Home' || name === '/'
        nodes.push({ id, name: name.length > 25 ? name.slice(0, 24) + '…' : name, value: data.views, users: data.users, level: 1, isHome })
        links.push({ source: 'start', target: id, value: data.views })
      }

      // Add ecom funnel nodes
      nodes.push({ id: 'atc', name: 'Aggiunte al carrello', value: totalATC, level: 2 })
      nodes.push({ id: 'checkout', name: 'Checkout', value: totalCheckouts, level: 3 })
      nodes.push({ id: 'purchase', name: 'Acquisto', value: totalPurchases, level: 4 })

      // Link top pages to ATC proportionally
      const pageNodes = nodes.filter(n => n.level === 1)
      const totalPageViews = pageNodes.reduce((s, n) => s + n.value, 0)
      for (const n of pageNodes) {
        const share = totalPageViews > 0 ? n.value / totalPageViews : 0
        const atcShare = Math.round(totalATC * share)
        if (atcShare > 0) links.push({ source: n.id, target: 'atc', value: atcShare })
      }

      links.push({ source: 'atc', target: 'checkout', value: totalCheckouts })
      links.push({ source: 'checkout', target: 'purchase', value: totalPurchases })

      return { nodes, links }
    }

    const flow = buildFlow()
    const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total_price || '0'), 0)

    return NextResponse.json({
      funnel, topPages, flow,
      totalRevenue: Math.round(totalRevenue),
      totalOrders: orders.length,
      shopifyOrders: orders.length,
      days, hasGA4,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
