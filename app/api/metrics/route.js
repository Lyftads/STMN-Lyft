export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { subDays, format, subMonths, startOfMonth } from 'date-fns'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN
const META_TOKEN    = process.env.META_ACCESS_TOKEN
const META_ACCOUNT  = process.env.META_AD_ACCOUNT_ID

function shopifyAuth() {
  return { 'X-Shopify-Access-Token': SHOPIFY_TOKEN || '' }
}

// ── ShopifyQL via GraphQL Admin API ───────────────────────────
// Stessa tecnologia usata da Looker Studio
// Restituisce dati aggregati mensili in una singola chiamata
async function fetchShopifyQL() {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return null

  const since = format(startOfMonth(subMonths(new Date(), 12)), 'yyyy-MM-dd')
  const until = format(new Date(), 'yyyy-MM-dd')

  // Query 1: Ordini, Fatturato, AOV mensili (dalla tabella sales)
  const salesQuery = `
    FROM sales
    SHOW
      orders,
      gross_sales,
      average_order_value
    TIMESERIES month
    SINCE ${since}
    UNTIL ${until}
  `

  // Query 2: Nuovi clienti mensili (dalla tabella customers)
  const customersQuery = `
    FROM customers
    SHOW
      new_customers
    TIMESERIES month
    SINCE ${since}
    UNTIL ${until}
  `

  const gql = (query) => `{
    shopifyqlQuery(query: "${query.replace(/\n/g, ' ').replace(/"/g, '\\"').replace(/\s+/g, ' ').trim()}") {
      __typename
      ... on TableResponse {
        tableData {
          headers
          rowData
          unformattedData
        }
      }
      ... on AnalyticsQueryErrorResponse {
        errors {
          code
          message
          range { start end }
        }
      }
    }
  }`

  try {
    const [salesRes, custRes] = await Promise.all([
      fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: { ...shopifyAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: gql(salesQuery) })
      }),
      fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: { ...shopifyAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: gql(customersQuery) })
      }),
    ])

    const salesJson = await salesRes.json()
    const custJson  = await custRes.json()

    console.log('ShopifyQL sales:', JSON.stringify(salesJson).slice(0, 300))
    console.log('ShopifyQL customers:', JSON.stringify(custJson).slice(0, 300))

    // Parsing risposta ShopifyQL
    const parseTable = (json) => {
      const data = json?.data?.shopifyqlQuery?.tableData
      if (!data) return []
      const headers = data.headers || []
      const rows    = data.unformattedData || data.rowData || []
      return rows.map(row => {
        const obj = {}
        headers.forEach((h, i) => { obj[h] = row[i] })
        return obj
      })
    }

    const salesRows = parseTable(salesJson)
    const custRows  = parseTable(custJson)

    // Indicizza clienti per mese
    const custByMonth = {}
    for (const row of custRows) {
      const month = (row.month || row.date || '').slice(0,7)
      if (month) custByMonth[month] = parseInt(row.new_customers || 0)
    }

    // Combina dati sales + customers
    const months = salesRows.map(row => {
      const month   = (row.month || row.date || '').slice(0,7)
      const orders  = parseInt(row.orders || 0)
      const revenue = parseFloat(row.gross_sales || 0)
      const aov     = parseFloat(row.average_order_value || (orders > 0 ? revenue / orders : 0))
      return {
        key:          month,
        orders,
        revenue:      Math.round(revenue),
        aov:          Math.round(aov * 100) / 100,
        newCustomers: custByMonth[month] || 0,
        ok:           true,
      }
    }).filter(m => m.key).sort((a,b) => a.key.localeCompare(b.key))

    const totalOrders  = months.reduce((s,m) => s + m.orders, 0)
    const totalRevenue = months.reduce((s,m) => s + m.revenue, 0)
    const newCustYear  = months.reduce((s,m) => s + m.newCustomers, 0)
    const aovGlobal    = totalOrders > 0 ? Math.round(totalRevenue / totalOrders * 100) / 100 : 0

    return { months, shopifyOk: months.length > 0, aovGlobal, newCustYear, totalOrders, totalRevenue }

  } catch(e) {
    console.log('ShopifyQL error:', e.message)
    return null
  }
}

// ── Fallback: orders/count per mese se ShopifyQL non disponibile ──
async function fetchMonthlyFallback() {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return null
  const now = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i)
    const start = startOfMonth(d)
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    return { key: format(d, 'yyyy-MM'), startISO: start.toISOString(), endISO: end.toISOString() }
  })

  const results = []
  for (let i = 0; i < months.length; i += 4) {
    const batch = await Promise.all(months.slice(i, i + 4).map(async ({ key, startISO, endISO }) => {
      try {
        const [ordCountRes, custCountRes] = await Promise.all([
          fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/orders/count.json?status=any&financial_status=paid&created_at_min=${startISO}&created_at_max=${endISO}`, { headers: shopifyAuth() }),
          fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/customers/count.json?created_at_min=${startISO}&created_at_max=${endISO}`, { headers: shopifyAuth() }),
        ])
        const oData = ordCountRes.ok  ? await ordCountRes.json()  : { count: 0 }
        const cData = custCountRes.ok ? await custCountRes.json() : { count: 0 }
        return { key, orders: oData.count || 0, revenue: 0, aov: 0, newCustomers: cData.count || 0, ok: ordCountRes.ok }
      } catch { return { key, orders: 0, revenue: 0, aov: 0, newCustomers: 0, ok: false } }
    }))
    results.push(...batch)
  }
  const totalOrders = results.reduce((s,m) => s+m.orders, 0)
  const newCustYear = results.reduce((s,m) => s+m.newCustomers, 0)
  return { months: results, shopifyOk: results.some(m=>m.ok), aovGlobal: 0, newCustYear, totalOrders, totalRevenue: 0 }
}

// ── Meta spesa mensile ─────────────────────────────────────────
async function fetchMeta() {
  if (!META_TOKEN || !META_ACCOUNT) return null
  const accounts = META_ACCOUNT.split(',').map(s => s.trim()).filter(Boolean)
  const since    = format(subDays(new Date(), 395), 'yyyy-MM-dd')
  const until    = format(new Date(), 'yyyy-MM-dd')
  try {
    const results = await Promise.all(accounts.map(async id => {
      const res  = await fetch(`https://graph.facebook.com/v19.0/${id}/insights?fields=spend&time_range={"since":"${since}","until":"${until}"}&time_increment=monthly&access_token=${META_TOKEN}`)
      const data = await res.json()
      if (data.error) { console.log('Meta:', data.error.message); return [] }
      return data.data || []
    }))
    const map = {}
    for (const rows of results)
      for (const d of rows) {
        const m = d.date_start?.slice(0,7)
        if (m) map[m] = (map[m] || 0) + parseFloat(d.spend || 0)
      }
    const monthly    = Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([month, spend]) => ({ month, spend: Math.round(spend*100)/100 }))
    const totalSpend = Math.round(monthly.reduce((s,m) => s+m.spend, 0)*100)/100
    return { totalSpend, monthly }
  } catch(e) { console.log('Meta error:', e.message); return null }
}

// ── Handler principale ────────────────────────────────────────
export async function GET() {
  try {
    const [shopifyResult, metaResult] = await Promise.allSettled([
      fetchShopifyQL(),
      fetchMeta(),
    ])

    let shopify = shopifyResult.status === 'fulfilled' ? shopifyResult.value : null

    // Fallback se ShopifyQL non funziona
    if (!shopify || !shopify.shopifyOk || shopify.months.length === 0) {
      console.log('ShopifyQL failed, using fallback...')
      try { shopify = await fetchMonthlyFallback() } catch(e) { console.log('Fallback error:', e.message) }
    }

    const meta = metaResult.status === 'fulfilled' ? metaResult.value : null
    if (metaResult.status === 'rejected') console.log('Meta:', metaResult.reason?.message)

    const metaMap = {}
    for (const m of (meta?.monthly || [])) metaMap[m.month] = m.spend

    const monthly = (shopify?.months || []).map(m => ({
      month:        m.key,
      orders:       m.orders,
      revenue:      m.revenue,
      aov:          m.aov,
      newCustomers: m.newCustomers,
      metaSpend:    metaMap[m.key] || 0,
      totalSpend:   metaMap[m.key] || 0,
    }))

    return NextResponse.json({
      aov:           shopify?.aovGlobal || 0,
      purchaseFrequency: 1.69,
      customerLifespan:  1.57,
      grossMargin:       0.30,
      ltvGross:    0, ltvNet: 0,
      metaSpend:         meta?.totalSpend || 0,
      googleSpend:       0,
      totalAdSpend:      meta?.totalSpend || 0,
      newCustomers:      shopify?.newCustYear || 0,
      cac: null, ratio: null, ratioStatus: 'no_data',
      totalOrders:   shopify?.totalOrders  || 0,
      totalRevenue:  shopify?.totalRevenue || 0,
      uniqueCustomers: 0,
      churnRate: 36.3, retentionRate: 63.7, returningRate: 0,
      sources: { shopify: shopify?.shopifyOk || false, meta: !!meta, google: false },
      monthly,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Metrics error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
