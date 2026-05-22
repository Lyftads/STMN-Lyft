// app/api/shopify/route.js
// Pulls orders, customers, AOV from Shopify Admin API
import { NextResponse } from 'next/server'
import { subDays, formatISO, subMonths } from 'date-fns'

const SHOPIFY_STORE   = process.env.SHOPIFY_STORE_URL   // es: stmn-fitness.myshopify.com
const SHOPIFY_TOKEN   = process.env.SHOPIFY_ADMIN_TOKEN // Admin API access token
const LOOKBACK_DAYS   = 730  // ultimi 2 anni
const CHURN_WINDOW    = 365  // giorni per definire cliente perso
const REPEAT_WINDOW_D = 365  // stesso del churn window

async function shopifyFetch(endpoint) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/${endpoint}`
  const res = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 3600 } // cache 1 ora
  })
  if (!res.ok) throw new Error(`Shopify API error: ${res.status} ${await res.text()}`)
  return res.json()
}

// Pagina tutti gli ordini con cursore
async function fetchAllOrders(sinceDate) {
  let orders = []
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${sinceDate}&limit=250&fields=id,email,created_at,total_price,customer`

  while (url) {
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN },
      next: { revalidate: 3600 }
    })
    if (!res.ok) break
    const data = await res.json()
    orders = orders.concat(data.orders || [])

    // Paginazione con Link header
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

export async function GET() {
  try {
    const sinceDate = formatISO(subDays(new Date(), LOOKBACK_DAYS))
    const orders = await fetchAllOrders(sinceDate)

    if (!orders.length) {
      return NextResponse.json({ error: 'Nessun ordine trovato' }, { status: 404 })
    }

    // ── Metriche base ──────────────────────────────────────────
    const totalOrders  = orders.length
    const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0)
    const aov          = totalRevenue / totalOrders

    // ── Clienti unici ──────────────────────────────────────────
    const emailMap = {}
    for (const o of orders) {
      const email = o.email?.toLowerCase()?.trim()
      if (!email) continue
      if (!emailMap[email]) emailMap[email] = []
      emailMap[email].push(new Date(o.created_at))
    }
    const uniqueCustomers = Object.keys(emailMap).length

    // ── Frequenza acquisti ─────────────────────────────────────
    const purchaseFrequency = totalOrders / uniqueCustomers

    // ── Nuovi clienti (primo ordine negli ultimi 365gg) ────────
    const oneYearAgo = subDays(new Date(), 365)
    let newCustomers = 0
    for (const [, dates] of Object.entries(emailMap)) {
      const firstOrder = new Date(Math.min(...dates.map(d => d.getTime())))
      if (firstOrder >= oneYearAgo) newCustomers++
    }

    // ── Churn & vita media ─────────────────────────────────────
    const churnCutoff = subDays(new Date(), CHURN_WINDOW)
    let churned = 0
    for (const [, dates] of Object.entries(emailMap)) {
      const lastOrder = new Date(Math.max(...dates.map(d => d.getTime())))
      if (lastOrder < churnCutoff) churned++
    }
    const churnRate     = churned / uniqueCustomers
    const retentionRate = 1 - churnRate
    const customerLifespan = churnRate > 0 ? 1 / churnRate : 0

    // ── Trend mensile ultimi 12 mesi ──────────────────────────
    const monthlyData = {}
    for (const o of orders) {
      const d = new Date(o.created_at)
      if (d < subDays(new Date(), 365)) continue
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      if (!monthlyData[key]) monthlyData[key] = { orders: 0, revenue: 0, customers: new Set() }
      monthlyData[key].orders++
      monthlyData[key].revenue += parseFloat(o.total_price || 0)
      const email = o.email?.toLowerCase()?.trim()
      if (email) monthlyData[key].customers.add(email)
    }
    const monthly = Object.entries(monthlyData)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month,
        orders:    d.orders,
        revenue:   Math.round(d.revenue),
        customers: d.customers.size,
        aov:       Math.round(d.revenue / d.orders)
      }))

    // ── Clienti returning vs nuovi (ultimi 12 mesi) ───────────
    const last12Orders = orders.filter(o => new Date(o.created_at) >= oneYearAgo)
    let returningCount = 0
    for (const o of last12Orders) {
      const email = o.email?.toLowerCase()?.trim()
      if (!email) continue
      const allDates = emailMap[email] || []
      const orderDate = new Date(o.created_at)
      const hadOrderBefore = allDates.some(d => d < orderDate)
      if (hadOrderBefore) returningCount++
    }
    const returningRate = last12Orders.length > 0 ? returningCount / last12Orders.length : 0

    return NextResponse.json({
      // Metriche principali
      totalOrders,
      totalRevenue:     Math.round(totalRevenue * 100) / 100,
      aov:              Math.round(aov * 100) / 100,
      uniqueCustomers,
      newCustomers,
      purchaseFrequency:  Math.round(purchaseFrequency * 100) / 100,
      churnRate:          Math.round(churnRate * 1000) / 10,   // percentuale
      retentionRate:      Math.round(retentionRate * 1000) / 10,
      customerLifespan:   Math.round(customerLifespan * 100) / 100,
      // Trend
      monthly,
      returningRate:    Math.round(returningRate * 1000) / 10,
      // Meta
      lookbackDays:     LOOKBACK_DAYS,
      churnWindowDays:  CHURN_WINDOW,
      updatedAt:        new Date().toISOString(),
    })
  } catch (err) {
    console.error('Shopify error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
