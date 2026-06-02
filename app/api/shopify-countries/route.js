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
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${sinceIso}&created_at_max=${untilIso}&limit=250&fields=id,created_at,total_price,billing_address`

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
  if (!since || !until) {
    return NextResponse.json({ error: 'Parametri since e until obbligatori (YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    const orders = await fetchOrdersInRange(since, until)
    const byCountry = new Map()
    let unknownCount = 0
    let unknownRevenue = 0

    for (const o of orders || []) {
      const addr = o.billing_address || null
      const code = addr?.country_code || null
      const name = addr?.country || (code ? code : 'Sconosciuto')
      const revenue = parseFloat(o.total_price || 0)

      if (!code && !addr?.country) {
        unknownCount++
        unknownRevenue += revenue
        continue
      }

      const key = code || name
      const prev = byCountry.get(key) || { country: name, country_code: code, revenue: 0, orders: 0 }
      prev.revenue += revenue
      prev.orders += 1
      byCountry.set(key, prev)
    }

    const rows = [...byCountry.values()]
      .map(r => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 }))
      .sort((a, b) => b.revenue - a.revenue)

    if (unknownCount > 0) {
      rows.push({
        country: 'Sconosciuto',
        country_code: null,
        revenue: Math.round(unknownRevenue * 100) / 100,
        orders: unknownCount,
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
