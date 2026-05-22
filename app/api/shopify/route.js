export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { subDays, formatISO } from 'date-fns'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN
const LOOKBACK_DAYS  = 730
const CHURN_WINDOW   = 365

// Supporta sia token Admin classici (shpat_) che token di automazione (atkn_)
function getAuthHeader() {
  const token = SHOPIFY_TOKEN || ''
  if (token.startsWith('atkn_')) {
    return { 'Authorization': `Bearer ${token}` }
  }
  return { 'X-Shopify-Access-Token': token }
}

async function shopifyFetch(path) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    next: { revalidate: 3600 }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Shopify ${res.status}: ${text.slice(0,200)}`)
  }
  return res.json()
}

async function fetchAllOrders(sinceDate) {
  let orders = []
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${sinceDate}&limit=250&fields=id,email,created_at,total_price`
  
  while (url) {
    const res = await fetch(url, {
      headers: { ...getAuthHeader() },
      next: { revalidate: 3600 }
    })
    if (!res.ok) break
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

export async function GET() {
  try {
    const sinceDate = formatISO(subDays(new Date(), LOOKBACK_DAYS))
    const orders = await fetchAllOrders(sinceDate)

    if (!orders.length) {
      return NextResponse.json({ error: 'Nessun ordine trovato. Verifica il token Shopify.' }, { status: 404 })
    }

    const totalOrders  = orders.length
    const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0)
    const aov          = totalRevenue / totalOrders

    const emailMap = {}
    for (const o of orders) {
      const email = o.email?.toLowerCase()?.trim()
      if (!email) continue
      if (!emailMap[email]) emailMap[email] = []
      emailMap[email].push(new Date(o.created_at))
    }
    const uniqueCustomers = Object.keys(emailMap).length
    const purchaseFrequency = totalOrders / uniqueCustomers

    const oneYearAgo = subDays(new Date(), 365)
    let newCustomers = 0
    for (const [, dates] of Object.entries(emailMap)) {
      const firstOrder = new Date(Math.min(...dates.map(d => d.getTime())))
      if (firstOrder >= oneYearAgo) newCustomers++
    }

    const churnCutoff = subDays(new Date(), CHURN_WINDOW)
    let churned = 0
    for (const [, dates] of Object.entries(emailMap)) {
      const lastOrder = new Date(Math.max(...dates.map(d => d.getTime())))
      if (lastOrder < churnCutoff) churned++
    }
    const churnRate      = churned / uniqueCustomers
    const retentionRate  = 1 - churnRate
    const customerLifespan = churnRate > 0 ? 1 / churnRate : 0

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
      totalOrders,
      totalRevenue:       Math.round(totalRevenue * 100) / 100,
      aov:                Math.round(aov * 100) / 100,
      uniqueCustomers,
      newCustomers,
      purchaseFrequency:  Math.round(purchaseFrequency * 100) / 100,
      churnRate:          Math.round(churnRate * 1000) / 10,
      retentionRate:      Math.round(retentionRate * 1000) / 10,
      customerLifespan:   Math.round(customerLifespan * 100) / 100,
      monthly,
      returningRate:      Math.round(returningRate * 1000) / 10,
      lookbackDays:       LOOKBACK_DAYS,
      churnWindowDays:    CHURN_WINDOW,
      updatedAt:          new Date().toISOString(),
    })
  } catch (err) {
    console.error('Shopify error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
