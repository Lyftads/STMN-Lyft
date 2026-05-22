export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { subDays, format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

const SHOPIFY_STORE  = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN
const META_TOKEN     = process.env.META_ACCESS_TOKEN
const META_ACCOUNT   = process.env.META_AD_ACCOUNT_ID
const GROSS_MARGIN   = parseFloat(process.env.GROSS_MARGIN || '0.30')

function shopifyHeaders() {
  const t = SHOPIFY_TOKEN || ''
  if (t.startsWith('atkn_') || t.startsWith('shpca_')) return { 'Authorization': `Bearer ${t}` }
  return { 'X-Shopify-Access-Token': t }
}

// ── Fetch ordini di UN mese con tutti i campi necessari ────────
async function fetchMonthOrders(start, end) {
  let orders = []
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?` +
    `status=any&financial_status=paid` +
    `&created_at_min=${start}&created_at_max=${end}` +
    `&limit=250&fields=total_price,email,created_at`

  while (url && orders.length < 3000) {
    const res = await fetch(url, { headers: shopifyHeaders() })
    if (!res.ok) break
    const data = await res.json()
    if (!data.orders?.length) break
    orders = orders.concat(data.orders)
    const link = res.headers.get('Link')
    url = link?.includes('rel="next"') ? link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null : null
  }
  return orders
}

// ── Fetch nuovi clienti di UN mese ────────────────────────────
async function fetchMonthNewCustomers(start, end) {
  try {
    const res  = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2024-01/customers/count.json?created_at_min=${start}&created_at_max=${end}`,
      { headers: shopifyHeaders() }
    )
    const data = await res.json()
    return data.count || 0
  } catch { return 0 }
}

// ── Fetch tutti i dati Shopify (12 mesi, 4 alla volta) ─────────
async function fetchAllShopifyData() {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) throw new Error('Shopify non configurato')

  const now    = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i)
    return {
      key:   format(d, 'yyyy-MM'),
      start: startOfMonth(d).toISOString(),
      end:   endOfMonth(d).toISOString(),
    }
  })

  const monthlyResults = []

  // 3 batch da 4 mesi in parallelo
  for (let i = 0; i < months.length; i += 4) {
    const batch = months.slice(i, i + 4)
    const results = await Promise.all(
      batch.map(async ({ key, start, end }) => {
        const [orders, newCustomers] = await Promise.all([
          fetchMonthOrders(start, end),
          fetchMonthNewCustomers(start, end),
        ])
        const revenue = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0)
        const aov     = orders.length > 0 ? revenue / orders.length : 0
        // Raccoglie email e date per calcoli successivi
        const orderData = orders.map(o => ({
          email: o.email?.toLowerCase()?.trim(),
          date:  new Date(o.created_at),
          price: parseFloat(o.total_price || 0),
        })).filter(o => o.email)

        return { key, orders: orders.length, revenue: Math.round(revenue), aov: Math.round(aov * 100) / 100, newCustomers, orderData }
      })
    )
    monthlyResults.push(...results)
  }

  return monthlyResults
}

// ── Calcola tutte le metriche dai dati mensili ────────────────
function computeMetrics(monthlyResults) {
  // Mappa globale: email → array di date ordini (ultimi 12 mesi)
  const customerOrders = {}
  for (const month of monthlyResults) {
    for (const { email, date } of month.orderData) {
      if (!customerOrders[email]) customerOrders[email] = []
      customerOrders[email].push(date)
    }
  }

  const now            = new Date()
  const uniqueEmails   = Object.keys(customerOrders)
  const totalCustomers = uniqueEmails.length
  const totalOrders    = monthlyResults.reduce((s, m) => s + m.orders, 0)
  const totalRevenue   = monthlyResults.reduce((s, m) => s + m.revenue, 0)
  const totalNewCust   = monthlyResults.reduce((s, m) => s + m.newCustomers, 0)

  // AOV globale (media pesata sui mesi con dati)
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // Frequenza acquisti: ordini totali / clienti unici nei 12 mesi
  // (finestra = 1 anno → già annualizzata)
  const purchaseFrequency = totalCustomers > 0 ? totalOrders / totalCustomers : 0

  // Churn: clienti attivi in mesi 1-9 che NON appaiono in mesi 10-12
  const cutoffDate = subMonths(now, 3) // 3 mesi fa
  const activeEarly  = new Set()
  const activeLate   = new Set()

  for (const month of monthlyResults) {
    const monthDate = new Date(month.key + '-01')
    const isLate    = monthDate >= subMonths(now, 3)
    for (const { email } of month.orderData) {
      if (isLate) activeLate.add(email)
      else        activeEarly.add(email)
    }
  }

  // Clienti che erano attivi prima ma non negli ultimi 3 mesi
  const churned    = [...activeEarly].filter(e => !activeLate.has(e)).length
  const churnBase  = activeEarly.size
  const churnRate  = churnBase > 0 ? churned / churnBase : 0

  // Annualizzo il churn (era su 9 mesi, porto a 12 mesi)
  const churnRateAnnual = Math.min(churnRate * (12/9), 0.99)
  const customerLifespan = churnRateAnnual > 0 ? 1 / churnRateAnnual : 0
  const retentionRate    = 1 - churnRateAnnual

  return {
    totalOrders,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    aov:               Math.round(aov * 100) / 100,
    totalCustomers,
    newCustomersYear:  totalNewCust,
    purchaseFrequency: Math.round(purchaseFrequency * 100) / 100,
    churnRate:         Math.round(churnRateAnnual * 1000) / 10,
    retentionRate:     Math.round(retentionRate * 1000) / 10,
    customerLifespan:  Math.round(customerLifespan * 100) / 100,
  }
}

// ── Fetch Meta (più account) ───────────────────────────────────
async function fetchMeta() {
  if (!META_TOKEN || !META_ACCOUNT) return null
  const accounts = META_ACCOUNT.split(',').map(s => s.trim()).filter(Boolean)
  const since    = format(subDays(new Date(), 365), 'yyyy-MM-dd')
  const until    = format(new Date(), 'yyyy-MM-dd')

  const results = await Promise.all(accounts.map(async id => {
    const url  = `https://graph.facebook.com/v19.0/${id}/insights?fields=spend&time_range={"since":"${since}","until":"${until}"}&time_increment=monthly&access_token=${META_TOKEN}`
    const res  = await fetch(url)
    const data = await res.json()
    if (data.error) throw new Error(`[${id}] ${data.error.message}`)
    return data.data || []
  }))

  const monthlyMap = {}
  for (const rows of results) {
    for (const d of rows) {
      const m = d.date_start?.slice(0,7)
      if (!m) continue
      monthlyMap[m] = (monthlyMap[m] || 0) + parseFloat(d.spend || 0)
    }
  }
  const monthly    = Object.entries(monthlyMap).sort(([a],[b]) => a.localeCompare(b)).map(([month, spend]) => ({ month, spend: Math.round(spend*100)/100 }))
  const totalSpend = monthly.reduce((s, m) => s + m.spend, 0)
  return { totalSpend: Math.round(totalSpend*100)/100, monthly }
}

// ── Handler principale ────────────────────────────────────────
export async function GET() {
  try {
    const [shopifyResult, metaResult] = await Promise.allSettled([
      fetchAllShopifyData(),
      fetchMeta(),
    ])

    if (shopifyResult.status === 'rejected') {
      return NextResponse.json({ error: shopifyResult.reason?.message }, { status: 500 })
    }

    const monthlyRaw = shopifyResult.value
    const meta       = metaResult.status === 'fulfilled' ? metaResult.value : null
    if (metaResult.status === 'rejected') console.log('Meta:', metaResult.reason?.message)

    const metrics = computeMetrics(monthlyRaw)

    // LTV
    const ltvGross = metrics.aov * metrics.purchaseFrequency * metrics.customerLifespan
    const ltvNet   = ltvGross * GROSS_MARGIN

    // CAC
    const totalAdSpend = meta?.totalSpend || 0
    const newCust      = metrics.newCustomersYear
    const cac          = totalAdSpend > 0 && newCust > 0 ? Math.round(totalAdSpend / newCust * 100) / 100 : null

    // Ratio
    const ratio       = cac && ltvNet > 0 ? Math.round(ltvNet / cac * 100) / 100 : null
    const ratioStatus = ratio == null ? 'no_data' : ratio < 1 ? 'critical' : ratio < 3 ? 'warning' : ratio <= 7 ? 'good' : 'excellent'

    // Dati mensili combinati
    const metaByMonth = {}
    for (const m of (meta?.monthly || [])) metaByMonth[m.month] = m.spend

    const monthly = monthlyRaw.map(m => ({
      month:        m.key,
      orders:       m.orders,
      revenue:      m.revenue,
      aov:          m.aov,
      newCustomers: m.newCustomers,
      metaSpend:    metaByMonth[m.key] || 0,
      totalSpend:   metaByMonth[m.key] || 0,
    }))

    return NextResponse.json({
      // LTV components (calcolati automaticamente)
      aov:               metrics.aov,
      purchaseFrequency: metrics.purchaseFrequency,
      customerLifespan:  metrics.customerLifespan,
      grossMargin:       GROSS_MARGIN,
      ltvGross:          Math.round(ltvGross * 100) / 100,
      ltvNet:            Math.round(ltvNet * 100) / 100,
      // CAC
      metaSpend:         meta?.totalSpend || 0,
      googleSpend:       0,
      totalAdSpend,
      newCustomers:      newCust,
      cac,
      // Ratio
      ratio,
      ratioStatus,
      // Shopify stats
      totalOrders:       metrics.totalOrders,
      uniqueCustomers:   metrics.totalCustomers,
      churnRate:         metrics.churnRate,
      retentionRate:     metrics.retentionRate,
      returningRate:     metrics.retentionRate,
      // Sources
      sources: { shopify: true, meta: !!meta, google: false },
      monthly,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Metrics error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
