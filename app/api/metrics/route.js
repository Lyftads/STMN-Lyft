export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN
const META_TOKEN    = process.env.META_ACCESS_TOKEN
const META_ACCOUNT  = process.env.META_AD_ACCOUNT_ID
const GROSS_MARGIN  = parseFloat(process.env.GROSS_MARGIN       || '0.30')
const FREQ          = parseFloat(process.env.PURCHASE_FREQUENCY || '1.69')
const LIFESPAN      = parseFloat(process.env.CUSTOMER_LIFESPAN  || '1.57')
const NEW_CUST      = parseInt(process.env.NEW_CUSTOMERS_ANNUAL || '10718')
const AOV_FALLBACK  = parseFloat(process.env.AOV_OVERRIDE       || '85.18')

function shopifyAuth() {
  const t = SHOPIFY_TOKEN || ''
  if (t.startsWith('atkn_') || t.startsWith('shpca_')) return { 'Authorization': `Bearer ${t}` }
  return { 'X-Shopify-Access-Token': t }
}

export async function GET() {
  // ── 1. AOV da Shopify (ultimi 30gg) ───────────────────────────
  let aov = AOV_FALLBACK
  let totalOrders = 0
  let shopifyOk = false
  try {
    if (SHOPIFY_STORE && SHOPIFY_TOKEN) {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const res   = await fetch(
        `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250&fields=total_price`,
        { headers: shopifyAuth() }
      )
      if (res.ok) {
        const data = await res.json()
        const orders = data.orders || []
        if (orders.length > 0) {
          const rev = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0)
          aov = Math.round(rev / orders.length * 100) / 100
          totalOrders = orders.length
          shopifyOk = true
        }
      } else {
        console.log('Shopify AOV status:', res.status)
      }
    }
  } catch (e) { console.log('Shopify AOV error:', e.message) }

  // ── 2. Nuovi clienti per mese (12 chiamate /count) ────────────
  const monthlyNewCust = []
  let totalNewCustFromShopify = 0
  try {
    if (SHOPIFY_STORE && SHOPIFY_TOKEN) {
      const now = new Date()
      const months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
        const start = new Date(d.getFullYear(), d.getMonth(), 1)
        const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
        const key   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        return { key, start: start.toISOString(), end: end.toISOString() }
      })
      const results = await Promise.all(months.map(async ({ key, start, end }) => {
        try {
          const res  = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/customers/count.json?created_at_min=${start}&created_at_max=${end}`, { headers: shopifyAuth() })
          if (!res.ok) return { key, count: 0 }
          const d = await res.json()
          return { key, count: d.count || 0 }
        } catch { return { key, count: 0 } }
      }))
      monthlyNewCust.push(...results)
      totalNewCustFromShopify = results.reduce((s, m) => s + m.count, 0)
    }
  } catch (e) { console.log('Monthly customers error:', e.message) }

  // ── 3. Meta spesa mensile ──────────────────────────────────────
  let metaTotalSpend = 0
  const metaMonthly = []
  let metaOk = false
  try {
    if (META_TOKEN && META_ACCOUNT) {
      const accounts = META_ACCOUNT.split(',').map(s => s.trim()).filter(Boolean)
      const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0,10)
      const until = new Date().toISOString().slice(0,10)
      const map   = {}
      for (const id of accounts) {
        const url  = `https://graph.facebook.com/v19.0/${id}/insights?fields=spend&time_range={"since":"${since}","until":"${until}"}&time_increment=monthly&access_token=${META_TOKEN}`
        const res  = await fetch(url)
        const data = await res.json()
        if (!data.error) {
          for (const d of (data.data || [])) {
            const m = d.date_start?.slice(0,7)
            if (m) map[m] = (map[m] || 0) + parseFloat(d.spend || 0)
          }
          metaOk = true
        } else { console.log('Meta error:', data.error.message) }
      }
      for (const [month, spend] of Object.entries(map).sort()) {
        metaMonthly.push({ month, spend: Math.round(spend*100)/100 })
      }
      metaTotalSpend = Math.round(metaMonthly.reduce((s,m) => s+m.spend, 0)*100)/100
    }
  } catch (e) { console.log('Meta error:', e.message) }

  // ── 4. Calcola LTV, CAC, Ratio ────────────────────────────────
  const newCustYear = NEW_CUST > 0 ? NEW_CUST : (totalNewCustFromShopify > 0 ? totalNewCustFromShopify : 10718)
  const ltvGross    = aov * FREQ * LIFESPAN
  const ltvNet      = Math.round(ltvGross * GROSS_MARGIN * 100) / 100
  const cac         = metaTotalSpend > 0 && newCustYear > 0 ? Math.round(metaTotalSpend / newCustYear * 100) / 100 : null
  const ratio       = cac && ltvNet > 0 ? Math.round(ltvNet / cac * 100) / 100 : null
  const ratioStatus = ratio == null ? 'no_data' : ratio < 1 ? 'critical' : ratio < 3 ? 'warning' : ratio <= 7 ? 'good' : 'excellent'

  // ── 5. Dati mensili combinati ──────────────────────────────────
  const metaMap = {}
  for (const m of metaMonthly) metaMap[m.month] = m.spend
  const ncMap = {}
  for (const m of monthlyNewCust) ncMap[m.key] = m.count

  // Usa i mesi da Meta oppure dai nuovi clienti
  const allMonths = [...new Set([...metaMonthly.map(m => m.month), ...monthlyNewCust.map(m => m.key)])].sort()
  const monthly = allMonths.map(month => ({
    month,
    orders:       0,
    revenue:      0,
    aov,
    newCustomers: ncMap[month] || 0,
    metaSpend:    metaMap[month] || 0,
    totalSpend:   metaMap[month] || 0,
  }))

  return NextResponse.json({
    aov,
    purchaseFrequency: FREQ,
    customerLifespan:  LIFESPAN,
    grossMargin:       GROSS_MARGIN,
    ltvGross:          Math.round(ltvGross * 100) / 100,
    ltvNet,
    metaSpend:         metaTotalSpend,
    googleSpend:       0,
    totalAdSpend:      metaTotalSpend,
    newCustomers:      newCustYear,
    cac, ratio, ratioStatus,
    totalOrders, uniqueCustomers: 0,
    churnRate:     Math.round((1 - 1/LIFESPAN) * 1000) / 10,
    retentionRate: Math.round((1/LIFESPAN) * 1000) / 10,
    returningRate: 0,
    sources: { shopify: shopifyOk, meta: metaOk, google: false },
    monthly,
    updatedAt: new Date().toISOString(),
  })
}
