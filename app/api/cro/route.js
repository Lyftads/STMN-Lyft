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
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
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
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) return null
  return res.json()
}

function parseGa4Rows(report) {
  if (!report?.rows) return []
  return report.rows.map(row => {
    const obj = {}
    report.dimensionHeaders?.forEach((d, i) => { obj[d.name] = row.dimensionValues?.[i]?.value })
    report.metricHeaders?.forEach((m, i) => { obj[m.name] = parseFloat(row.metricValues?.[i]?.value || '0') })
    return obj
  })
}

async function getGA4Data(days) {
  const propertyId = process.env.GA4_PROPERTY_ID
  if (!propertyId) return null

  const token = await getGoogleToken()
  if (!token) return null

  const dateRange = { startDate: `${days}daysAgo`, endDate: 'today' }

  try {
    const [overview, topPages, funnelATC, funnelCheckout, funnelPurchase, userFlow] = await Promise.all([
      ga4Report(token, propertyId, {
        dateRanges: [dateRange],
        metrics: [
          { name: 'sessions' }, { name: 'totalUsers' },
          { name: 'screenPageViews' }, { name: 'bounceRate' },
          { name: 'averageSessionDuration' }, { name: 'ecommercePurchases' },
          { name: 'totalRevenue' },
        ],
      }),
      ga4Report(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' }, { name: 'sessions' },
          { name: 'totalUsers' }, { name: 'averageSessionDuration' },
          { name: 'bounceRate' }, { name: 'ecommercePurchases' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20,
      }),
      ga4Report(token, propertyId, {
        dateRanges: [dateRange],
        metrics: [{ name: 'addToCarts' }],
      }),
      ga4Report(token, propertyId, {
        dateRanges: [dateRange],
        metrics: [{ name: 'checkouts' }],
      }),
      ga4Report(token, propertyId, {
        dateRanges: [dateRange],
        metrics: [{ name: 'ecommercePurchases' }],
      }),
      ga4Report(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }, { name: 'pagePathPlusQueryString' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 50,
      }),
    ])

    const ov = overview?.rows?.[0]
    const ovMetrics = {}
    overview?.metricHeaders?.forEach((m, i) => {
      ovMetrics[m.name] = parseFloat(ov?.metricValues?.[i]?.value || '0')
    })

    const atcVal = funnelATC?.rows?.[0]?.metricValues?.[0]?.value
    const checkoutVal = funnelCheckout?.rows?.[0]?.metricValues?.[0]?.value
    const purchaseVal = funnelPurchase?.rows?.[0]?.metricValues?.[0]?.value

    return {
      sessions: ovMetrics.sessions || 0,
      users: ovMetrics.totalUsers || 0,
      pageViews: ovMetrics.screenPageViews || 0,
      bounceRate: ovMetrics.bounceRate || 0,
      avgDuration: ovMetrics.averageSessionDuration || 0,
      revenue: ovMetrics.totalRevenue || 0,
      purchases: ovMetrics.ecommercePurchases || 0,
      addToCarts: parseInt(atcVal || '0', 10),
      checkouts: parseInt(checkoutVal || '0', 10),
      topPages: parseGa4Rows(topPages),
      userFlow: parseGa4Rows(userFlow),
    }
  } catch (e) {
    console.error('GA4 CRO error:', e.message)
    return null
  }
}

async function getAllOrders(since) {
  let all = []
  let url = `orders.json?status=any&created_at_min=${since}&limit=250&fields=id,created_at,total_price,landing_site`
  while (url && all.length < 2000) {
    const data = await shopifyRest(url)
    if (!data?.orders) break
    all = all.concat(data.orders)
    if (data.orders.length === 250) {
      const lastId = data.orders[data.orders.length - 1].id
      url = `orders.json?status=any&created_at_min=${since}&limit=250&since_id=${lastId}&fields=id,created_at,total_price,landing_site`
    } else { url = null }
  }
  return all
}

export async function GET(request) {
  if (!STORE || !TOKEN) {
    return NextResponse.json({ error: 'Shopify not configured' }, { status: 500 })
  }

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

    const totalVisitors = hasGA4 ? ga4.users : (orders.length > 0 ? Math.round(orders.length / 0.018) : 0)
    const totalSessions = hasGA4 ? ga4.sessions : totalVisitors
    const totalATC = hasGA4 ? ga4.addToCarts : Math.round((orders.length + abandonedCheckouts) * 1.4)
    const totalCheckouts = hasGA4 ? ga4.checkouts : (orders.length + abandonedCheckouts)
    const totalPurchases = orders.length

    const funnel = {
      visitors: totalVisitors,
      sessions: totalSessions,
      addToCart: totalATC,
      checkout: totalCheckouts,
      purchase: totalPurchases,
      addToCartRate: totalVisitors > 0 ? (totalATC / totalVisitors) * 100 : 0,
      checkoutRate: totalVisitors > 0 ? (totalCheckouts / totalVisitors) * 100 : 0,
      purchaseRate: totalVisitors > 0 ? (totalPurchases / totalVisitors) * 100 : 0,
      cartToCheckout: totalATC > 0 ? (totalCheckouts / totalATC) * 100 : 0,
      checkoutToPurchase: totalCheckouts > 0 ? (totalPurchases / totalCheckouts) * 100 : 0,
      bounceRate: hasGA4 ? ga4.bounceRate : null,
      avgDuration: hasGA4 ? ga4.avgDuration : null,
      source: hasGA4 ? 'GA4 + Shopify' : 'Shopify (stimato)',
    }

    let topPages = []
    if (hasGA4 && ga4.topPages?.length) {
      const ordersByPage = {}
      for (const o of orders) {
        const p = (o.landing_site || '/').split('?')[0]
        ordersByPage[p] = (ordersByPage[p] || 0) + 1
      }
      topPages = ga4.topPages.map(p => ({
        page: p.pagePath,
        sessions: p.sessions || 0,
        visitors: p.totalUsers || 0,
        pageViews: p.screenPageViews || 0,
        bounceRate: p.bounceRate || 0,
        avgDuration: p.averageSessionDuration || 0,
        orders: ordersByPage[p.pagePath] || p.ecommercePurchases || 0,
        conversionRate: p.sessions > 0 ? ((ordersByPage[p.pagePath] || p.ecommercePurchases || 0) / p.sessions) * 100 : 0,
      }))
    } else {
      const landingMap = {}
      for (const o of orders) {
        const ls = (o.landing_site || '/').split('?')[0]
        if (!landingMap[ls]) landingMap[ls] = { orders: 0, revenue: 0 }
        landingMap[ls].orders++
        landingMap[ls].revenue += parseFloat(o.total_price || '0')
      }
      const avgConversion = totalVisitors > 0 ? orders.length / totalVisitors : 0.02
      topPages = Object.entries(landingMap)
        .map(([page, d]) => {
          const sessions = avgConversion > 0 ? Math.round(d.orders / avgConversion) : d.orders * 50
          return { page, sessions, visitors: sessions, orders: d.orders, conversionRate: sessions > 0 ? (d.orders / sessions) * 100 : 0 }
        })
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 20)
    }

    const buildFlow = () => {
      const nodes = []
      const links = []
      nodes.push({ id: 'visitors', name: 'Visitatori', value: totalVisitors, level: 0 })

      const pageData = hasGA4 ? ga4.userFlow || [] : []
      const categorized = { home: 0, collections: {}, products: {}, other: 0 }

      if (pageData.length) {
        for (const row of pageData) {
          const p = row.pagePath || '/'
          const views = row.screenPageViews || 0
          if (p === '/' || p === '/index') categorized.home += views
          else if (p.startsWith('/collections/')) {
            const h = p.replace('/collections/', '').split('/')[0].split('?')[0]
            categorized.collections[h] = (categorized.collections[h] || 0) + views
          } else if (p.startsWith('/products/')) {
            const h = p.replace('/products/', '').split('?')[0]
            categorized.products[h] = (categorized.products[h] || 0) + views
          } else categorized.other += views
        }
      } else {
        categorized.home = Math.round(totalVisitors * 0.35)
        for (const o of orders) {
          const ls = (o.landing_site || '/').split('?')[0]
          if (ls.startsWith('/collections/')) {
            const h = ls.replace('/collections/', '').split('/')[0]
            categorized.collections[h] = (categorized.collections[h] || 0) + 1
          } else if (ls.startsWith('/products/')) {
            const h = ls.replace('/products/', '').split('?')[0]
            categorized.products[h] = (categorized.products[h] || 0) + 1
          }
        }
      }

      nodes.push({ id: 'home', name: 'Home', value: categorized.home, level: 1 })
      links.push({ source: 'visitors', target: 'home', value: categorized.home })

      const topCol = Object.entries(categorized.collections).sort((a, b) => b[1] - a[1]).slice(0, 6)
      for (const [handle, views] of topCol) {
        const col = collections.find(c => c.handle === handle)
        const id = `col_${handle}`
        nodes.push({ id, name: col?.title || handle.replace(/-/g, ' '), value: views, level: 1 })
        links.push({ source: 'visitors', target: id, value: views })
      }

      if (categorized.other > 0) {
        nodes.push({ id: 'other', name: 'Altre pagine', value: categorized.other, level: 1 })
        links.push({ source: 'visitors', target: 'other', value: categorized.other })
      }

      const topProd = Object.entries(categorized.products).sort((a, b) => b[1] - a[1]).slice(0, 10)
      for (const [handle, views] of topProd) {
        const prod = products.find(p => p.handle === handle)
        const id = `prod_${handle}`
        nodes.push({ id, name: prod?.title || handle.replace(/-/g, ' '), value: views, level: 2 })
        if (topCol.length) {
          links.push({ source: `col_${topCol[0][0]}`, target: id, value: Math.round(views * 0.6) })
        } else {
          links.push({ source: 'home', target: id, value: views })
        }
      }

      nodes.push({ id: 'cart', name: 'Carrello', value: totalATC, level: 3 })
      nodes.push({ id: 'checkout', name: 'Checkout', value: totalCheckouts, level: 4 })
      nodes.push({ id: 'purchase', name: 'Acquisto', value: totalPurchases, level: 5 })

      for (const n of nodes.filter(n => n.level === 2)) {
        links.push({ source: n.id, target: 'cart', value: Math.round(n.value * 0.06) })
      }
      if (categorized.home > 0) {
        links.push({ source: 'home', target: 'cart', value: Math.round(categorized.home * 0.03) })
      }
      links.push({ source: 'cart', target: 'checkout', value: totalCheckouts })
      links.push({ source: 'checkout', target: 'purchase', value: totalPurchases })

      return { nodes, links }
    }

    const flow = buildFlow()
    const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total_price || '0'), 0)

    return NextResponse.json({
      funnel,
      topPages,
      flow,
      totalRevenue: Math.round(totalRevenue),
      totalOrders: orders.length,
      days,
      hasGA4,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
