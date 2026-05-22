export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { subDays, format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

const SHOPIFY_STORE  = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN
const META_TOKEN     = process.env.META_ACCESS_TOKEN
const META_ACCOUNT   = process.env.META_AD_ACCOUNT_ID
const GROSS_MARGIN   = parseFloat(process.env.GROSS_MARGIN        || '0.30')
const FREQ_OVERRIDE  = parseFloat(process.env.PURCHASE_FREQUENCY  || '1.69')
const LIFE_OVERRIDE  = parseFloat(process.env.CUSTOMER_LIFESPAN   || '1.57')
const NC_OVERRIDE    = parseInt(process.env.NEW_CUSTOMERS_ANNUAL  || '0')

function shopifyHeaders() {
  const t = SHOPIFY_TOKEN || ''
  if (t.startsWith('atkn_') || t.startsWith('shpca_')) return { 'Authorization': `Bearer ${t}` }
  return { 'X-Shopify-Access-Token': t }
}

// ── AOV: ultimi 60 giorni (1-2 pagine, velocissimo) ───────────
async function fetchRecentAOV() {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) throw new Error('Shopify non configurato')
  const since = subDays(new Date(), 60).toISOString()
  let orders = [], url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250&fields=total_price,created_at`
  while (url && orders.length < 500) {
    const res = await fetch(url, { headers: shopifyHeaders() })
    if (!res.ok) throw new Error(`Shopify ${res.status}`)
    const data = await res.json()
    if (!data.orders?.length) break
    orders = orders.concat(data.orders)
    const link = res.headers.get('Link')
    url = link?.includes('rel="next"') ? link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null : null
  }
  const revenue = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0)
  return { orders: orders.length, aov: orders.length > 0 ? revenue / orders.length : 0, revenue }
}

// ── Nuovi clienti per mese (12 chiamate /count, veloce) ───────
async function fetchMonthlyNewCustomers() {
  const now = new Date(), results = []
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i)
    return { key: format(d, 'yyyy-MM'), start: startOfMonth(d).toISOString(), end: endOfMonth(d).toISOString() }
  })
  // 4 mesi alla volta
  for (let i = 0; i < months.length; i += 4) {
    const batch = await Promise.all(months.slice(i, i + 4).map(async ({ key, start, end }) => {
      try {
        const res  = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/customers/count.json?created_at_min=${start}&created_at_max=${end}`, { headers: shopifyHeaders() })
        const data = await res.json()
        return { key, count: data.count || 0 }
      } catch { return { key, count: 0 } }
    }))
    results.push(...batch)
  }
  return results
}

// ── AOV mensile: last 30 orders sample per mese (veloce) ──────
async function fetchMonthlyAOV() {
  const now = new Date(), results = []
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i)
    return { key: format(d, 'yyyy-MM'), start: startOfMonth(d).toISOString(), end: endOfMonth(d).toISOString() }
  })
  // 4 mesi alla volta — 1 sola pagina per mese (250 ordini = campione accurato)
  for (let i = 0; i < months.length; i += 4) {
    const batch = await Promise.all(months.slice(i, i + 4).map(async ({ key, start, end }) => {
      try {
        const url  = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${start}&created_at_max=${end}&limit=250&fields=total_price`
        const res  = await fetch(url, { headers: shopifyHeaders() })
        if (!res.ok) return { key, aov: 0, orders: 0, revenue: 0 }
        const data = await res.json()
        const orders = data.orders || []
        const revenue = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0)
        return { key, orders: orders.length, revenue: Math.round(revenue), aov: orders.length > 0 ? Math.round(revenue / orders.length * 100) / 100 : 0 }
      } catch { return { key, aov: 0, orders: 0, revenue: 0 } }
    }))
    results.push(...batch)
  }
  return results
}

// ── Meta spesa mensile ─────────────────────────────────────────
async function fetchMeta() {
  if (!META_TOKEN || !META_ACCOUNT) return null
  const accounts = META_ACCOUNT.split(',').map(s => s.trim()).filter(Boolean)
  const since = format(subDays(new Date(), 365), 'yyyy-MM-dd')
  const until = format(new Date(), 'yyyy-MM-dd')
  const results = await Promise.all(accounts.map(async id => {
    const url  = `https://graph.facebook.com/v19.0/${id}/insights?fields=spend&time_range={"since":"${since}","until":"${until}"}&time_increment=monthly&access_token=${META_TOKEN}`
    const res  = await fetch(url)
    const data = await res.json()
    if (data.error) throw new Error(`[${id}] ${data.error.message}`)
    return data.data || []
  }))
  const monthlyMap = {}
  for (const rows of results)
    for (const d of rows) {
      const m = d.date_start?.slice(0,7)
      if (m) monthlyMap[m] = (monthlyMap[m] || 0) + parseFloat(d.spend || 0)
    }
  const monthly    = Object.entries(monthlyMap).sort(([a],[b]) => a.localeCompare(b)).map(([month, spend]) => ({ month, spend: Math.round(spend*100)/100 }))
  const totalSpend = Math.round(monthly.reduce((s,m) => s+m.spend, 0)*100)/100
  return { totalSpend, monthly }
}

// ── Handler principale ────────────────────────────────────────
export async function GET() {
  try {
    // Tutte le chiamate in parallelo
    const [recentResult, monthlyNewCustResult, monthlyAOVResult, metaResult] = await Promise.allSettled([
      fetchRecentAOV(),
      fetchMonthlyNewCustomers(),
      fetchMonthlyAOV(),
      fetchMeta(),
    ])

    if (recentResult.status === 'rejected') return NextResponse.json({ error: recentResult.reason?.message }, { status: 500 })

    const recent     = recentResult.value
    const newCustByMonth = monthlyNewCustResult.status === 'fulfilled' ? monthlyNewCustResult.value : []
    const aovByMonth     = monthlyAOVResult.status    === 'fulfilled' ? monthlyAOVResult.value    : []
    const meta           = metaResult.status          === 'fulfilled' ? metaResult.value          : null
    if (metaResult.status === 'rejected') console.log('Meta:', metaResult.reason?.message)

    // Metriche aggregate
    const aov         = Math.round(recent.aov * 100) / 100
    const freq        = FREQ_OVERRIDE
    const lifespan    = LIFE_OVERRIDE
    const newCustYear = NC_OVERRIDE > 0 ? NC_OVERRIDE : newCustByMonth.reduce((s,m) => s+m.count, 0)

    const ltvGross = aov * freq * lifespan
    const ltvNet   = ltvGross * GROSS_MARGIN

    const totalAdSpend = meta?.totalSpend || 0
    const cac = totalAdSpend > 0 && newCustYear > 0 ? Math.round(totalAdSpend / newCustYear * 100) / 100 : null
    const ratio = cac && ltvNet > 0 ? Math.round(ltvNet / cac * 100) / 100 : null
    const ratioStatus = ratio == null ? 'no_data' : ratio < 1 ? 'critical' : ratio < 3 ? 'warning' : ratio <= 7 ? 'good' : 'excellent'

    // Dati mensili combinati
    const metaByMonth = {}
    for (const m of (meta?.monthly || [])) metaByMonth[m.month] = m.spend
    const ncByMonth = {}
    for (const m of newCustByMonth) ncByMonth[m.key] = m.count

    const monthly = aovByMonth.map(m => ({
      month:        m.key,
      orders:       m.orders,
      revenue:      m.revenue,
      aov:          m.aov,
      newCustomers: ncByMonth[m.key] || 0,
      metaSpend:    metaByMonth[m.key] || 0,
      totalSpend:   metaByMonth[m.key] || 0,
    }))

    return NextResponse.json({
      aov, purchaseFrequency: freq, customerLifespan: lifespan,
      grossMargin: GROSS_MARGIN, ltvGross: Math.round(ltvGross*100)/100, ltvNet: Math.round(ltvNet*100)/100,
      metaSpend: meta?.totalSpend || 0, googleSpend: 0, totalAdSpend,
      newCustomers: newCustYear, cac, ratio, ratioStatus,
      totalOrders: recent.orders, uniqueCustomers: 0,
      churnRate: Math.round((1 - 1/lifespan) * 1000)/10,
      retentionRate: Math.round((1/lifespan) * 1000)/10,
      returningRate: 0,
      sources: { shopify: true, meta: !!meta, google: false },
      monthly, updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Metrics error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
