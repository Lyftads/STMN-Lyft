export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'

const STORE = process.env.SHOPIFY_STORE_URL
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN

async function shopifyGql(query, variables = {}) {
  const res = await fetch(`https://${STORE}/admin/api/2024-04/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

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

export async function GET(request) {
  if (!STORE || !TOKEN) {
    return NextResponse.json({ error: 'Shopify not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30', 10)
  const since = daysAgo(days)

  try {
    const ordersRes = await shopifyRest(
      `orders.json?status=any&created_at_min=${since}&limit=250&fields=id,created_at,total_price,landing_site,referring_site,source_name`
    )
    const orders = ordersRes?.orders || []

    const checkoutsRes = await shopifyGql(`{
      abandonedCheckouts: abandonedCheckoutCount(since: "${since.slice(0, 10)}")
    }`)

    let totalCheckouts = orders.length
    const abandonedCount = checkoutsRes?.data?.abandonedCheckouts || 0
    totalCheckouts += abandonedCount

    const sessionsQuery = `
      FROM sessions
      SHOW count(), visitor_count()
      SINCE -${days}d UNTIL today
    `
    const sessionsRes = await shopifyGql(`{
      shopifyqlQuery(query: ${JSON.stringify(sessionsQuery)}) {
        __typename
        ... on TableResponse {
          tableData {
            rowData
            columns { name dataType }
          }
        }
      }
    }`)

    let totalSessions = 0
    let totalVisitors = 0
    const sessTable = sessionsRes?.data?.shopifyqlQuery?.tableData
    if (sessTable?.rowData?.[0]) {
      totalSessions = parseInt(sessTable.rowData[0][0] || '0', 10)
      totalVisitors = parseInt(sessTable.rowData[0][1] || '0', 10)
    }

    const topPagesQuery = `
      FROM sessions
      SHOW count(), visitor_count()
      GROUP BY landing_page
      SINCE -${days}d UNTIL today
      ORDER BY count() DESC
      LIMIT 20
    `
    const topPagesRes = await shopifyGql(`{
      shopifyqlQuery(query: ${JSON.stringify(topPagesQuery)}) {
        __typename
        ... on TableResponse {
          tableData {
            rowData
            columns { name dataType }
          }
        }
      }
    }`)

    const topPages = []
    const tpTable = topPagesRes?.data?.shopifyqlQuery?.tableData
    if (tpTable?.rowData) {
      for (const row of tpTable.rowData) {
        const page = row[0] || '/'
        const sessions = parseInt(row[1] || '0', 10)
        const visitors = parseInt(row[2] || '0', 10)
        const pageOrders = orders.filter(o => {
          const landing = o.landing_site || ''
          return landing.includes(page) || (page === '/' && (landing === '/' || landing === ''))
        }).length
        topPages.push({
          page,
          sessions,
          visitors,
          orders: pageOrders,
          conversionRate: sessions > 0 ? (pageOrders / sessions) * 100 : 0,
        })
      }
    }

    const pageFlowQuery = `
      FROM sessions
      SHOW count()
      GROUP BY landing_page
      SINCE -${days}d UNTIL today
      ORDER BY count() DESC
      LIMIT 30
    `
    const pageFlowRes = await shopifyGql(`{
      shopifyqlQuery(query: ${JSON.stringify(pageFlowQuery)}) {
        __typename
        ... on TableResponse {
          tableData {
            rowData
            columns { name dataType }
          }
        }
      }
    }`)

    const landingPages = []
    const pfTable = pageFlowRes?.data?.shopifyqlQuery?.tableData
    if (pfTable?.rowData) {
      for (const row of pfTable.rowData) {
        landingPages.push({ page: row[0] || '/', sessions: parseInt(row[1] || '0', 10) })
      }
    }

    const collectionsRes = await shopifyRest('custom_collections.json?limit=50&fields=id,title,handle')
    const smartCollRes = await shopifyRest('smart_collections.json?limit=50&fields=id,title,handle')
    const collections = [
      ...(collectionsRes?.custom_collections || []),
      ...(smartCollRes?.smart_collections || []),
    ]

    const productsRes = await shopifyRest('products.json?limit=100&fields=id,title,handle,product_type')
    const products = productsRes?.products || []

    const categorizePages = () => {
      const home = { name: 'Home', sessions: 0, children: [] }
      const collectionNodes = {}
      const productNodes = {}
      const otherPages = { name: 'Altre pagine', sessions: 0 }

      for (const lp of landingPages) {
        const p = lp.page
        if (p === '/' || p === '' || p === '/index') {
          home.sessions += lp.sessions
        } else if (p.startsWith('/collections/')) {
          const handle = p.replace('/collections/', '').split('/')[0].split('?')[0]
          const col = collections.find(c => c.handle === handle)
          const name = col?.title || handle
          if (!collectionNodes[handle]) {
            collectionNodes[handle] = { name, handle, sessions: 0, products: [] }
          }
          collectionNodes[handle].sessions += lp.sessions
        } else if (p.startsWith('/products/')) {
          const handle = p.replace('/products/', '').split('?')[0]
          const prod = products.find(pr => pr.handle === handle)
          const name = prod?.title || handle
          productNodes[handle] = { name, handle, sessions: lp.sessions }
        } else {
          otherPages.sessions += lp.sessions
        }
      }

      const total = landingPages.reduce((s, lp) => s + lp.sessions, 0)

      const flowNodes = [
        { id: 'total', name: 'Visitatori', value: total, level: 0 },
        { id: 'home', name: 'Home', value: home.sessions, level: 1 },
      ]
      const flowLinks = [
        { source: 'total', target: 'home', value: home.sessions },
      ]

      const colEntries = Object.entries(collectionNodes).sort((a, b) => b[1].sessions - a[1].sessions)
      for (const [handle, col] of colEntries.slice(0, 8)) {
        const id = `col_${handle}`
        flowNodes.push({ id, name: col.name, value: col.sessions, level: 1 })
        flowLinks.push({ source: 'total', target: id, value: col.sessions })
      }

      if (otherPages.sessions > 0) {
        flowNodes.push({ id: 'other', name: 'Altre pagine', value: otherPages.sessions, level: 1 })
        flowLinks.push({ source: 'total', target: 'other', value: otherPages.sessions })
      }

      const prodEntries = Object.entries(productNodes).sort((a, b) => b[1].sessions - a[1].sessions)
      for (const [handle, prod] of prodEntries.slice(0, 12)) {
        const id = `prod_${handle}`
        flowNodes.push({ id, name: prod.name, value: prod.sessions, level: 2 })

        let linked = false
        for (const [colHandle, col] of colEntries.slice(0, 8)) {
          const colProd = products.find(p => p.handle === handle)
          if (colProd) {
            flowLinks.push({ source: `col_${colHandle}`, target: id, value: prod.sessions })
            linked = true
            break
          }
        }
        if (!linked) {
          flowLinks.push({ source: 'home', target: id, value: prod.sessions })
        }
      }

      flowNodes.push({ id: 'cart', name: 'Carrello', value: Math.round(total * 0.08), level: 3 })
      flowNodes.push({ id: 'checkout', name: 'Checkout', value: totalCheckouts, level: 4 })
      flowNodes.push({ id: 'purchase', name: 'Acquisto', value: orders.length, level: 5 })

      return { nodes: flowNodes, links: flowLinks }
    }

    const flow = categorizePages()

    const atcEstimate = Math.round(totalCheckouts * 1.4)

    const funnel = {
      visitors: totalVisitors || totalSessions,
      sessions: totalSessions,
      addToCart: atcEstimate,
      checkout: totalCheckouts,
      purchase: orders.length,
      addToCartRate: totalSessions > 0 ? (atcEstimate / totalSessions) * 100 : 0,
      checkoutRate: totalSessions > 0 ? (totalCheckouts / totalSessions) * 100 : 0,
      purchaseRate: totalSessions > 0 ? (orders.length / totalSessions) * 100 : 0,
      cartToCheckout: atcEstimate > 0 ? (totalCheckouts / atcEstimate) * 100 : 0,
      checkoutToPurchase: totalCheckouts > 0 ? (orders.length / totalCheckouts) * 100 : 0,
    }

    const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total_price || '0'), 0)

    return NextResponse.json({
      funnel,
      topPages,
      flow,
      totalRevenue,
      totalOrders: orders.length,
      days,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
