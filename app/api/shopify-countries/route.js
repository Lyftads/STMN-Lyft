export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'

// Tenant-aware getter (env-only mode di default)
const shopifyStoreUrl = () => getShopify().storeUrl
const shopifyToken    = () => getShopify().adminToken

// Aggrega ordini per paese di fatturazione (billing_address.country) in
// un range di date. Ritorna [{country, country_code, revenue, orders}]
// ordinato per revenue desc.

function authHeader() {
  return { 'X-Shopify-Access-Token': shopifyToken() || '' }
}

// Classifica un ordine come NC / RC / null (guest).
//
// L'oggetto customer REST incorporato negli ordini NON espone orders_count
// (snapshot ridotto), quindi qui usiamo customer.numberOfOrders preso dalla
// GraphQL Admin API (conteggio lifetime): <= 1 ⇒ nuovo cliente, > 1 ⇒ cliente
// di ritorno. Stessa logica delle card KPI principali.
function classifyOrder(o) {
  const n = o?.customer?.numberOfOrders
  if (n == null) return null // guest checkout (nessun customer)
  return Number(n) <= 1 ? 'NC' : 'RC'
}

// Recupera gli ordini del range via GraphQL Admin API, normalizzandoli nella
// stessa forma che il resto del route si aspetta dal vecchio REST:
//   { created_at, total_price, billing_address:{country,country_code}, customer:{numberOfOrders} }
async function fetchOrdersInRange(since, until) {
  if (!shopifyStoreUrl() || !shopifyToken()) return null

  const gql = `
    query($q: String!, $cursor: String) {
      orders(first: 250, query: $q, after: $cursor, sortKey: CREATED_AT) {
        edges {
          cursor
          node {
            createdAt
            currentTotalPriceSet { shopMoney { amount } }
            customer { numberOfOrders }
            billingAddress { country countryCodeV2 }
          }
        }
        pageInfo { hasNextPage }
      }
    }
  `
  const q = `created_at:>=${since}T00:00:00Z created_at:<=${until}T23:59:59Z financial_status:paid`

  const headers = { ...authHeader(), 'Content-Type': 'application/json' }
  let orders = []
  let cursor = null
  let safety = 0

  while (safety < 200) {
    safety++
    const res = await fetch(
      `https://${shopifyStoreUrl()}/admin/api/2024-01/graphql.json`,
      { method: 'POST', headers, cache: 'no-store', body: JSON.stringify({ query: gql, variables: { q, cursor } }) }
    )
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Shopify ${res.status}: ${text.slice(0, 200)}`)
    }
    const json = await res.json()

    // Backoff su throttling GraphQL: aspetta e ritenta lo stesso cursore.
    const throttled = json.errors?.some(e => e?.extensions?.code === 'THROTTLED')
    if (throttled) {
      await new Promise(r => setTimeout(r, 1200))
      continue
    }
    if (json.errors?.length) {
      throw new Error(`Shopify GQL: ${JSON.stringify(json.errors).slice(0, 200)}`)
    }

    const conn = json.data?.orders
    const edges = conn?.edges || []
    for (const e of edges) {
      const n = e.node
      orders.push({
        created_at: n.createdAt,
        total_price: n.currentTotalPriceSet?.shopMoney?.amount || 0,
        billing_address: {
          country: n.billingAddress?.country || n.billingAddress?.countryCodeV2 || null,
          country_code: n.billingAddress?.countryCodeV2 || null,
        },
        customer: n.customer ? { numberOfOrders: Number(n.customer.numberOfOrders || 0) } : null,
      })
    }
    if (!conn?.pageInfo?.hasNextPage) break
    cursor = edges[edges.length - 1]?.cursor
    if (!cursor) break
  }
  return orders
}

export async function GET(request) {
  return withTenantContext(request, async () => {
  if (!shopifyStoreUrl() || !shopifyToken()) {
    return NextResponse.json({ error: 'Shopify non configurato (SHOPIFY_STORE_URL, SHOPIFY_ADMIN_TOKEN)' }, { status: 200 })
  }

  const { searchParams } = new URL(request.url)
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const countryFilter = (searchParams.get('country') || '').toUpperCase() || null
  const breakdown = searchParams.get('breakdown') || null // 'daily' o null
  if (!since || !until) {
    return NextResponse.json({ error: 'Parametri since e until obbligatori (YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    const orders = await fetchOrdersInRange(since, until)

    // Modalita' breakdown daily: filtra per country e aggrega per data
    if (breakdown === 'daily') {
      const filtered = countryFilter
        ? (orders || []).filter(o => (o.billing_address?.country_code || '').toUpperCase() === countryFilter)
        : (orders || [])
      const byDate = new Map()
      for (const o of filtered) {
        const date = (o.created_at || '').slice(0, 10) // YYYY-MM-DD
        if (!date) continue
        const revenue = parseFloat(o.total_price || 0)
        const cls = classifyOrder(o)
        const prev = byDate.get(date) || { date, revenue: 0, orders: 0, ncOrders: 0, rcOrders: 0, ncRevenue: 0, rcRevenue: 0 }
        prev.revenue += revenue
        prev.orders += 1
        if (cls === 'NC') { prev.ncOrders += 1; prev.ncRevenue += revenue }
        if (cls === 'RC') { prev.rcOrders += 1; prev.rcRevenue += revenue }
        byDate.set(date, prev)
      }
      // Genera tutte le date del range (anche giorni a 0) per linea continua
      const daily = []
      const cursor = new Date(`${since}T00:00:00Z`)
      const last = new Date(`${until}T00:00:00Z`)
      while (cursor <= last) {
        const ymd = cursor.toISOString().slice(0, 10)
        const r = byDate.get(ymd) || { date: ymd, revenue: 0, orders: 0, ncOrders: 0, rcOrders: 0, ncRevenue: 0, rcRevenue: 0 }
        daily.push({
          ...r,
          revenue: Math.round(r.revenue * 100) / 100,
          ncRevenue: Math.round(r.ncRevenue * 100) / 100,
          rcRevenue: Math.round(r.rcRevenue * 100) / 100,
        })
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
      return NextResponse.json({ since, until, country: countryFilter, daily, updatedAt: new Date().toISOString() })
    }
    const byCountry = new Map()
    let unknownCount = 0
    let unknownRevenue = 0

    for (const o of orders || []) {
      const addr = o.billing_address || null
      const code = addr?.country_code || null
      const name = addr?.country || (code ? code : 'Sconosciuto')
      const revenue = parseFloat(o.total_price || 0)
      const cls = classifyOrder(o)

      if (!code && !addr?.country) {
        unknownCount++
        unknownRevenue += revenue
        continue
      }

      const key = code || name
      const prev = byCountry.get(key) || {
        country: name, country_code: code,
        revenue: 0, orders: 0,
        ncOrders: 0, rcOrders: 0,
        ncRevenue: 0, rcRevenue: 0,
      }
      prev.revenue += revenue
      prev.orders += 1
      if (cls === 'NC') { prev.ncOrders += 1; prev.ncRevenue += revenue }
      if (cls === 'RC') { prev.rcOrders += 1; prev.rcRevenue += revenue }
      byCountry.set(key, prev)
    }

    const rows = [...byCountry.values()]
      .map(r => ({
        ...r,
        revenue: Math.round(r.revenue * 100) / 100,
        ncRevenue: Math.round(r.ncRevenue * 100) / 100,
        rcRevenue: Math.round(r.rcRevenue * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    if (unknownCount > 0) {
      rows.push({
        country: 'Sconosciuto',
        country_code: null,
        revenue: Math.round(unknownRevenue * 100) / 100,
        orders: unknownCount,
        ncOrders: 0, rcOrders: 0, ncRevenue: 0, rcRevenue: 0,
      })
    }

    const total = rows.reduce(
      (acc, r) => ({ revenue: acc.revenue + r.revenue, orders: acc.orders + r.orders }),
      { revenue: 0, orders: 0 }
    )

    return NextResponse.json({
      since,
      until,
      total: {
        revenue: Math.round(total.revenue * 100) / 100,
        orders: total.orders,
      },
      countries: rows,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message?.slice(0, 300) || 'Errore Shopify' }, { status: 500 })
  }
  })
}
