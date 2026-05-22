export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { subDays, formatISO, format } from 'date-fns'

// ── Configurazione ─────────────────────────────────────────────
const SHOPIFY_STORE   = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN   = process.env.SHOPIFY_ADMIN_TOKEN
const META_TOKEN      = process.env.META_ACCESS_TOKEN
const META_ACCOUNT    = process.env.META_AD_ACCOUNT_ID
const GROSS_MARGIN         = parseFloat(process.env.GROSS_MARGIN || '0.30')
const CHURN_WINDOW         = 365
const LOOKBACK_DAYS        = 730
// Valori reali da analisi CSV (override quando Shopify non ha storico completo)
const FREQ_OVERRIDE        = parseFloat(process.env.PURCHASE_FREQUENCY  || '1.69')
const LIFESPAN_OVERRIDE    = parseFloat(process.env.CUSTOMER_LIFESPAN   || '1.57')
const NEW_CUSTOMERS_OVERRIDE = parseInt(process.env.NEW_CUSTOMERS_ANNUAL || '0')

// ── Auth Shopify (supporta atkn_ e shpat_) ────────────────────
function shopifyHeaders() {
  const token = SHOPIFY_TOKEN || ''
  if (token.startsWith('atkn_')) return { 'Authorization': `Bearer ${token}` }
  return { 'X-Shopify-Access-Token': token }
}

// ── Fetch tutti gli ordini Shopify ────────────────────────────
async function fetchShopifyOrders() {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) throw new Error('Shopify non configurato')
  const since = formatISO(subDays(new Date(), LOOKBACK_DAYS))
  let orders = []
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250&fields=id,email,created_at,total_price`

  while (url) {
    const res = await fetch(url, { headers: shopifyHeaders() })
    if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text().then(t => t.slice(0,100))}`)
    const data = await res.json()
    orders = orders.concat(data.orders || [])
    const link = res.headers.get('Link')
    url = link?.includes('rel="next"') ? link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null : null
  }
  return orders
}

// ── Elabora ordini Shopify ─────────────────────────────────────
function processShopifyOrders(orders) {
  const totalOrders  = orders.length
  const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0)
  const aov          = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // Mappa email → date ordini
  const emailMap = {}
  for (const o of orders) {
    const email = o.email?.toLowerCase()?.trim()
    if (!email) continue
    if (!emailMap[email]) emailMap[email] = []
    emailMap[email].push(new Date(o.created_at))
  }
  const uniqueCustomers   = Object.keys(emailMap).length
  const purchaseFrequency = uniqueCustomers > 0 ? totalOrders / uniqueCustomers : 0

  // Nuovi clienti (primo ordine ultimi 365gg)
  const oneYearAgo = subDays(new Date(), 365)
  let newCustomers = 0
  for (const dates of Object.values(emailMap)) {
    const firstOrder = new Date(Math.min(...dates.map(d => d.getTime())))
    if (firstOrder >= oneYearAgo) newCustomers++
  }

  // Churn (nessun ordine negli ultimi 365gg)
  const churnCutoff = subDays(new Date(), CHURN_WINDOW)
  let churned = 0
  for (const dates of Object.values(emailMap)) {
    const lastOrder = new Date(Math.max(...dates.map(d => d.getTime())))
    if (lastOrder < churnCutoff) churned++
  }
  const churnRate       = uniqueCustomers > 0 ? churned / uniqueCustomers : 0
  const retentionRate   = 1 - churnRate
  const customerLifespan = churnRate > 0 ? 1 / churnRate : 0

  // Trend mensile (ultimi 12 mesi)
  const monthlyData = {}
  for (const o of orders) {
    const d = new Date(o.created_at)
    if (d < oneYearAgo) continue
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

  // Returning rate
  const last12Orders = orders.filter(o => new Date(o.created_at) >= oneYearAgo)
  let returningCount = 0
  for (const o of last12Orders) {
    const email = o.email?.toLowerCase()?.trim()
    if (!email) continue
    const allDates = emailMap[email] || []
    const orderDate = new Date(o.created_at)
    if (allDates.some(d => d < orderDate)) returningCount++
  }
  const returningRate = last12Orders.length > 0 ? returningCount / last12Orders.length : 0

  return {
    totalOrders, totalRevenue: Math.round(totalRevenue * 100) / 100,
    aov: Math.round(aov * 100) / 100,
    uniqueCustomers, newCustomers,
    purchaseFrequency: Math.round(purchaseFrequency * 100) / 100,
    churnRate:         Math.round(churnRate * 1000) / 10,
    retentionRate:     Math.round(retentionRate * 1000) / 10,
    customerLifespan:  Math.round(customerLifespan * 100) / 100,
    returningRate:     Math.round(returningRate * 1000) / 10,
    monthly,
  }
}

// ── Fetch spesa Meta (più account separati da virgola) ───────
async function fetchMetaSpend() {
  if (!META_TOKEN || !META_ACCOUNT) return null
  const accounts = META_ACCOUNT.split(',').map(s => s.trim()).filter(Boolean)
  const since = format(subDays(new Date(), 365), 'yyyy-MM-dd')
  const until = format(new Date(), 'yyyy-MM-dd')

  async function fetchOne(accountId) {
    const url = `https://graph.facebook.com/v19.0/${accountId}/insights?fields=spend&time_range={"since":"${since}","until":"${until}"}&time_increment=monthly&access_token=${META_TOKEN}`
    const res  = await fetch(url)
    const data = await res.json()
    if (data.error) throw new Error(`[${accountId}] ${data.error.message}`)
    return data.data || []
  }

  const results = await Promise.all(accounts.map(fetchOne))
  const monthlyMap = {}
  for (const accountData of results) {
    for (const d of accountData) {
      const month = d.date_start?.slice(0,7)
      if (!month) continue
      if (!monthlyMap[month]) monthlyMap[month] = 0
      monthlyMap[month] += parseFloat(d.spend || 0)
    }
  }
  const monthly = Object.entries(monthlyMap)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([month, spend]) => ({ month, spend: Math.round(spend * 100) / 100 }))
  return { totalSpend: Math.round(monthly.reduce((s,m) => s+m.spend, 0)*100)/100, monthly }
}


// ── Nuovi clienti per mese da Shopify ────────────────────────
async function fetchMonthlyNewCustomers() {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return {}
  const now = new Date()
  const monthlyMap = {}

  // Fetch ultimi 12 mesi in parallelo
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const key   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    return { key, start: start.toISOString(), end: end.toISOString() }
  })

  const results = await Promise.all(months.map(async ({ key, start, end }) => {
    try {
      const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/customers/count.json?created_at_min=${start}&created_at_max=${end}`
      const res = await fetch(url, { headers: shopifyHeaders() })
      if (!res.ok) return { key, count: 0 }
      const data = await res.json()
      return { key, count: data.count || 0 }
    } catch { return { key, count: 0 } }
  }))

  for (const { key, count } of results) monthlyMap[key] = count
  return monthlyMap
}

// ── Handler principale ────────────────────────────────────────
export async function GET() {
  try {
    // Shopify obbligatorio
    const orders = await fetchShopifyOrders()
    const shopify = processShopifyOrders(orders)

    // Meta opzionale
    let meta = null
    try { meta = await fetchMetaSpend() } catch(e) { console.log('Meta non disponibile:', e.message) }

    // Nuovi clienti mensili da Shopify
    let monthlyNewCustomers = {}
    try { monthlyNewCustomers = await fetchMonthlyNewCustomers() } catch(e) { console.log('Nuovi clienti mensili:', e.message) }

    // ── Calcoli LTV (usa override se Shopify non ha storico completo) ──
    const freq     = shopify.purchaseFrequency > 0.5 ? shopify.purchaseFrequency : FREQ_OVERRIDE
    const lifespan = shopify.customerLifespan  > 0   ? shopify.customerLifespan  : LIFESPAN_OVERRIDE
    const ltvGross = shopify.aov * freq * lifespan
    const ltvNet   = ltvGross * GROSS_MARGIN

    // ── Calcoli CAC ───────────────────────────────────────────
    const metaSpend    = meta?.totalSpend || 0
    const totalAdSpend = metaSpend
    // Usa override se disponibile, altrimenti valore Shopify
    const newCustomersForCAC = NEW_CUSTOMERS_OVERRIDE > 0 ? NEW_CUSTOMERS_OVERRIDE : shopify.newCustomers
    const cac = totalAdSpend > 0 && newCustomersForCAC > 0
      ? Math.round(totalAdSpend / newCustomersForCAC * 100) / 100 : null

    // ── Ratio ─────────────────────────────────────────────────
    const ratio = cac && cac > 0 ? Math.round(ltvNet / cac * 100) / 100 : null
    const ratioStatus = ratio == null ? 'no_data'
      : ratio < 1 ? 'critical' : ratio < 3 ? 'warning' : ratio <= 7 ? 'good' : 'excellent'

    // ── Trend mensile combinato ───────────────────────────────
    const monthlyMap = {}
    for (const m of shopify.monthly) {
      monthlyMap[m.month] = { ...m, metaSpend: 0, totalSpend: 0 }
    }
    for (const m of (meta?.monthly || [])) {
      if (monthlyMap[m.month]) monthlyMap[m.month].metaSpend = m.spend
      else monthlyMap[m.month] = { month: m.month, metaSpend: m.spend, totalSpend: m.spend }
    }
    const monthly = Object.values(monthlyMap)
      .map(m => ({
        ...m,
        totalSpend:  m.metaSpend || 0,
        newCustomers: monthlyNewCustomers[m.month] || 0
      }))
      .sort((a,b) => a.month.localeCompare(b.month))

    return NextResponse.json({
      aov:              shopify.aov,
      purchaseFrequency: shopify.purchaseFrequency,
      customerLifespan:  shopify.customerLifespan,
      grossMargin:       GROSS_MARGIN,
      ltvGross:          Math.round(ltvGross * 100) / 100,
      ltvNet:            Math.round(ltvNet * 100) / 100,
      metaSpend,
      googleSpend:       0,
      totalAdSpend,
      newCustomers:      newCustomersForCAC,
      purchaseFrequencyUsed: freq,
      customerLifespanUsed:  lifespan,
      cac,
      ratio,
      ratioStatus,
      totalOrders:       shopify.totalOrders,
      uniqueCustomers:   shopify.uniqueCustomers,
      churnRate:         shopify.churnRate,
      retentionRate:     shopify.retentionRate,
      returningRate:     shopify.returningRate,
      sources: {
        shopify: true,
        meta:    !!meta,
        google:  false,
      },
      monthly,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Metrics error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
