export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN

// Aggrega ordini per paese di fatturazione (billing_address.country) in
// un range di date. Ritorna [{country, country_code, revenue, orders}]
// ordinato per revenue desc.

function authHeader() {
  return { 'X-Shopify-Access-Token': SHOPIFY_TOKEN || '' }
}

async function fetchOrdersInRange(since, until) {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return null
  // Shopify accetta created_at_min/max in formato ISO. Aggiungo
  // l'estremo superiore +1 giorno per includere tutta la giornata until.
  const sinceIso = `${since}T00:00:00Z`
  const untilDate = new Date(`${until}T00:00:00Z`)
  untilDate.setUTCDate(untilDate.getUTCDate() + 1)
  const untilIso = untilDate.toISOString()

  let orders = []
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${sinceIso}&created_at_max=${untilIso}&limit=250&fields=id,created_at,total_price,billing_address,customer`

  let safety = 0
  while (url && safety < 200) {
    safety++
    const res = await fetch(url, { headers: authHeader(), cache: 'no-store' })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Shopify ${res.status}: ${text.slice(0, 200)}`)
    }
    const data = await res.json()
    orders = orders.concat(data.orders || [])
    const link = res.headers.get('Link')
    if (link && link.includes('rel="next"')) {
      const match = link.match(/<([^>]+)>;\s*rel="next"/)
      url = match ? match[1] : null
    } else {
      url = null
    }
  }
  return orders
}

export async function GET(request) {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) {
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
        const cnt = o.customer?.orders_count
        const isNC = cnt === 1
        const isRC = typeof cnt === 'number' && cnt > 1
        const prev = byDate.get(date) || { date, revenue: 0, orders: 0, ncOrders: 0, rcOrders: 0, ncRevenue: 0, rcRevenue: 0 }
        prev.revenue += revenue
        prev.orders += 1
        if (isNC) { prev.ncOrders += 1; prev.ncRevenue += revenue }
        if (isRC) { prev.rcOrders += 1; prev.rcRevenue += revenue }
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
      // Classifica NC/RC via customer.orders_count (lifetime, disponibile
      // subito, non dipende da job di segmentazione asincrono):
      //   1 → ordine di un cliente al primo acquisto (NC)
      //   >1 → cliente di ritorno (RC)
      //   null/0 → guest checkout, non classificabile
      const ordersCount = o.customer?.orders_count
      const isNC = ordersCount === 1
      const isRC = typeof ordersCount === 'number' && ordersCount > 1

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
      if (isNC) { prev.ncOrders += 1; prev.ncRevenue += revenue }
      if (isRC) { prev.rcOrders += 1; prev.rcRevenue += revenue }
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
}
