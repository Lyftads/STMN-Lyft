export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { subDays, format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

const SHOPIFY_STORE  = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN
const META_TOKEN     = process.env.META_ACCESS_TOKEN
const META_ACCOUNT   = process.env.META_AD_ACCOUNT_ID
const GROSS_MARGIN   = parseFloat(process.env.GROSS_MARGIN       || '0.30')
const FREQ_OVERRIDE  = parseFloat(process.env.PURCHASE_FREQUENCY || '1.69')
const LIFE_OVERRIDE  = parseFloat(process.env.CUSTOMER_LIFESPAN  || '1.57')
const NC_OVERRIDE    = parseInt(process.env.NEW_CUSTOMERS_ANNUAL || '0')

function shopifyHeaders() {
  const t = SHOPIFY_TOKEN || ''
  if (t.startsWith('atkn_') || t.startsWith('shpca_')) return { 'Authorization': `Bearer ${t}` }
  return { 'X-Shopify-Access-Token': t }
}

// ── AOV: ultimi 30 giorni, max 1 pagina ────────────────────────
async function fetchAOV() {
  try {
    const since = subDays(new Date(), 30).toISOString()
    const url   = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250&fields=total_price`
    const res   = await fetch(url, { headers: shopifyHeaders() })
    if (!res.ok) { console.log('Shopify AOV:', res.status); return { orders: 0, aov: 0 } }
    const data    = await res.json()
    const orders  = data.orders || []
    const revenue = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0)
    return { orders: orders.length, aov: orders.length > 0 ? revenue / orders.length : 0 }
  } catch(e) { console.log('Shopify AOV error:', e.message); return { orders: 0, aov: 0 } }
}

// ── Nuovi clienti per mese (12 chiamate /count) ────────────────
async function fetchMonthlyNewCustomers() {
  const now    = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i)
    return { key: format(d, 'yyyy-MM'), start: startOfMonth(d).toISOString(), end: endOfMonth(d).toISOString() }
  })
  // Tutte e 12 in parallelo — sono solo chiamate /count, leggerissime
  const results = await Promise.all(months.map(async ({ key, start, end }) => {
    try {
      const res  = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/customers/count.json?created_at_min=${start}&created_at_max=${end}`, { headers: shopifyHeaders() })
      const data = await res.json()
      return { key, count: data.count || 0 }
    } catch { return { key, count: 0 } }
  }))
  return results
}

// ── Meta spesa mensile ─────────────────────────────────────────
async function fetchMeta() {
  if (!META_TOKEN || !META_ACCOUNT) return null
  const accounts = META_ACCOUNT.split(',').map(s => s.trim()).filter(Boolean)
  const since    = format(subDays(new Date(), 365), 'yyyy-MM-dd')
  const until    = format(new Date(), 'yyyy-MM-dd')
  const results  = await Promise.all(accounts.map(async id => {
    const url  = `https://graph.facebook.com/v19.0/${id}/insights?fields=spend&time_range={"since":"${since}","until":"${until}"}&time_increment=monthly&access_token=${META_TOKEN}`
    const res  = await fetch(url)
    const data = await res.json()
    if (data.error) throw new Error(`[${id}] ${data.error.message}`)
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
}

// ── Handler principale ────────────────────────────────────────
export async function GET() {
  try {
    // Tutte le chiamate in parallelo
    const [aovResult, newCustResult, metaResult] = await Promise.allSettled([
      fetchAOV(),
      fetchMonthlyNewCustomers(),
      fetchMeta(),
    ])

    const shopifyOk = aovResult.status === 'fulfilled'
    const { orders: totalOrders = 0, aov: rawAov = 0 } = shopifyOk ? aovResult.value : {}
    if (!shopifyOk) console.log('Shopify:', aovResult.reason?.message)
    const aov          = rawAov > 0 ? Math.round(rawAov * 100) / 100 : AOV_OVERRIDE
    const newCustMonth = newCustResult.status === 'fulfilled' ? newCustResult.value : []
    const meta         = metaResult.status    === 'fulfilled' ? metaResult.value    : null
    if (metaResult.status === 'rejected') console.log('Meta:', metaResult.reason?.message)

    // Metriche
    const freq        = FREQ_OVERRIDE
    const lifespan    = LIFE_OVERRIDE
    const newCustYear = NC_OVERRIDE > 0 ? NC_OVERRIDE : newCustMonth.reduce((s, m) => s + m.count, 0)
    const ltvGross    = aov * freq * lifespan
    const ltvNet      = ltvGross * GROSS_MARGIN

    const totalAdSpend = meta?.totalSpend || 0
    const cac          = totalAdSpend > 0 && newCustYear > 0 ? Math.round(totalAdSpend / newCustYear * 100) / 100 : null
    const ratio        = cac && ltvNet > 0 ? Math.round(ltvNet / cac * 100) / 100 : null
    const ratioStatus  = ratio == null ? 'no_data' : ratio < 1 ? 'critical' : ratio < 3 ? 'warning' : ratio <= 7 ? 'good' : 'excellent'

    // Dati mensili: combina nuovi clienti + spesa Meta + AOV globale per mese
    const metaMap = {}
    for (const m of (meta?.monthly || [])) metaMap[m.month] = m.spend
    const monthly = newCustMonth.map(m => ({
      month:        m.key,
      orders:       0,
      revenue:      0,
      aov,           // AOV globale come stima per ogni mese
      newCustomers: m.count,
      metaSpend:    metaMap[m.key] || 0,
      totalSpend:   metaMap[m.key] || 0,
    }))

    return NextResponse.json({
      aov, purchaseFrequency: freq, customerLifespan: lifespan,
      grossMargin: GROSS_MARGIN,
      ltvGross: Math.round(ltvGross*100)/100,
      ltvNet:   Math.round(ltvNet*100)/100,
      metaSpend: meta?.totalSpend || 0, googleSpend: 0, totalAdSpend,
      newCustomers: newCustYear, cac, ratio, ratioStatus,
      totalOrders, uniqueCustomers: 0,
      churnRate:     Math.round((1 - 1/lifespan)*1000)/10,
      retentionRate: Math.round((1/lifespan)*1000)/10,
      returningRate: 0,
      sources: { shopify: shopifyOk && totalOrders > 0, meta: !!meta, google: false },
      monthly,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Metrics error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
