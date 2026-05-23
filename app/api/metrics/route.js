export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { subDays, format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN
const META_TOKEN    = process.env.META_ACCESS_TOKEN
const META_ACCOUNT  = process.env.META_AD_ACCOUNT_ID

function shopifyAuth() {
  return { 'X-Shopify-Access-Token': SHOPIFY_TOKEN || '' }
}

// ── Genera ultimi N mesi ───────────────────────────────────────
function getMonths(n = 12) {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = subMonths(now, n - 1 - i)
    return {
      key:   format(d, 'yyyy-MM'),
      start: startOfMonth(d).toISOString(),
      end:   endOfMonth(d).toISOString(),
    }
  })
}

// ── AOV mensile: 1 pagina ordini per mese (≤250, veloce) ──────
async function fetchMonthlyData() {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return { months: [], shopifyOk: false }
  const months = getMonths(12)
  const results = []

  // 4 mesi alla volta in parallelo
  for (let i = 0; i < months.length; i += 4) {
    const batch = await Promise.all(
      months.slice(i, i + 4).map(async ({ key, start, end }) => {
        try {
          // Ordini del mese (max 250 = campione accurato per AOV)
          const [ordersRes, countRes] = await Promise.all([
            fetch(
              `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${start}&created_at_max=${end}&limit=250&fields=total_price`,
              { headers: shopifyAuth() }
            ),
            fetch(
              `https://${SHOPIFY_STORE}/admin/api/2024-01/customers/count.json?created_at_min=${start}&created_at_max=${end}`,
              { headers: shopifyAuth() }
            )
          ])

          const ordersData  = ordersRes.ok  ? await ordersRes.json()  : { orders: [] }
          const countData   = countRes.ok   ? await countRes.json()   : { count: 0 }
          const orders      = ordersData.orders || []
          const revenue     = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0)
          const aov         = orders.length > 0 ? Math.round(revenue / orders.length * 100) / 100 : 0

          return {
            key,
            orders:       orders.length,
            revenue:      Math.round(revenue),
            aov,
            newCustomers: countData.count || 0,
            ok: ordersRes.ok
          }
        } catch (e) {
          console.log(`Month ${key} error:`, e.message)
          return { key, orders: 0, revenue: 0, aov: 0, newCustomers: 0, ok: false }
        }
      })
    )
    results.push(...batch)
  }

  const shopifyOk    = results.some(m => m.ok && m.orders > 0)
  const totalOrders  = results.reduce((s, m) => s + m.orders, 0)
  const totalRevenue = results.reduce((s, m) => s + m.revenue, 0)
  const aovGlobal    = totalOrders > 0 ? Math.round(totalRevenue / totalOrders * 100) / 100 : 0
  const newCustYear  = results.reduce((s, m) => s + m.newCustomers, 0)

  return { months: results, shopifyOk, aovGlobal, newCustYear, totalOrders }
}

// ── Meta spesa mensile ─────────────────────────────────────────
async function fetchMeta() {
  if (!META_TOKEN || !META_ACCOUNT) return null
  const accounts = META_ACCOUNT.split(',').map(s => s.trim()).filter(Boolean)
  const since    = format(subDays(new Date(), 365), 'yyyy-MM-dd')
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
      fetchMonthlyData(),
      fetchMeta(),
    ])

    const shopify  = shopifyResult.status === 'fulfilled' ? shopifyResult.value : { months: [], shopifyOk: false, aovGlobal: 0, newCustYear: 0, totalOrders: 0 }
    const meta     = metaResult.status    === 'fulfilled' ? metaResult.value    : null

    // Dati mensili combinati
    const metaMap = {}
    for (const m of (meta?.monthly || [])) metaMap[m.month] = m.spend

    const monthly = shopify.months.map(m => ({
      month:        m.key,
      orders:       m.orders,
      revenue:      m.revenue,
      aov:          m.aov,
      newCustomers: m.newCustomers,
      metaSpend:    metaMap[m.key] || 0,
      totalSpend:   metaMap[m.key] || 0,
    }))

    return NextResponse.json({
      // Questi vengono dalle impostazioni lato client — l'API restituisce solo raw data
      aov:               shopify.aovGlobal,
      purchaseFrequency: 1.69,
      customerLifespan:  1.57,
      grossMargin:       0.30,
      ltvGross:          0,
      ltvNet:            0,
      metaSpend:         meta?.totalSpend || 0,
      googleSpend:       0,
      totalAdSpend:      meta?.totalSpend || 0,
      newCustomers:      shopify.newCustYear,
      cac:               null,
      ratio:             null,
      ratioStatus:       'no_data',
      totalOrders:       shopify.totalOrders,
      uniqueCustomers:   0,
      churnRate:         36.3,
      retentionRate:     63.7,
      returningRate:     0,
      sources: { shopify: shopify.shopifyOk, meta: !!meta, google: false },
      monthly,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Metrics error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
