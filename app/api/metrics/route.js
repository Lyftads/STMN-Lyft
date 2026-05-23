export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel Pro: timeout 60 secondi

import { NextResponse } from 'next/server'
import { subDays, format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN
const META_TOKEN    = process.env.META_ACCESS_TOKEN
const META_ACCOUNT  = process.env.META_AD_ACCOUNT_ID

function shopifyAuth() {
  return { 'X-Shopify-Access-Token': SHOPIFY_TOKEN || '' }
}

// ── Paginazione completa ordini di UN mese ────────────────────
// Con Vercel Pro (60s) possiamo paginare tutti gli ordini
async function fetchAllOrdersForMonth(startISO, endISO) {
  let orders = []
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?` +
    `status=any&financial_status=paid` +
    `&created_at_min=${startISO}&created_at_max=${endISO}` +
    `&limit=250&fields=total_price,customer_id,email`

  while (url) {
    const res = await fetch(url, { headers: shopifyAuth() })
    if (!res.ok) { console.log('Orders error:', res.status); break }
    const data = await res.json()
    if (!data.orders?.length) break
    orders = orders.concat(data.orders)
    const link = res.headers.get('Link') || ''
    const next = link.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
  }
  return orders
}

// ── Fetch dati mensili completi ───────────────────────────────
async function fetchMonthlyData() {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) throw new Error('Shopify non configurato')

  const now    = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i)
    return {
      key:      format(d, 'yyyy-MM'),
      startISO: startOfMonth(d).toISOString(),
      endISO:   endOfMonth(d).toISOString(),
    }
  })

  // Processa 3 mesi alla volta in parallelo (bilanciamento velocità/rate-limit)
  const results = []
  for (let i = 0; i < months.length; i += 3) {
    const batch = await Promise.all(
      months.slice(i, i + 3).map(async ({ key, startISO, endISO }) => {
        try {
          // Ordini completi (paginati) + nuovi clienti in parallelo
          const [orders, custRes] = await Promise.all([
            fetchAllOrdersForMonth(startISO, endISO),
            fetch(
              `https://${SHOPIFY_STORE}/admin/api/2024-01/customers/count.json?created_at_min=${startISO}&created_at_max=${endISO}`,
              { headers: shopifyAuth() }
            ).then(r => r.ok ? r.json() : { count: 0 }).catch(() => ({ count: 0 }))
          ])

          const totalOrders    = orders.length
          const revenue        = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0)
          const aov            = totalOrders > 0 ? revenue / totalOrders : 0
          const newCustomers   = custRes.count || 0

          // Distingui nuovi vs returning clienti dagli ordini stessi
          // Un cliente è "nuovo" se è la sua prima apparizione nell'array
          const seenCustomers  = new Set()
          let ordersNew = 0, revenueNew = 0
          let ordersRet = 0, revenueRet = 0

          for (const o of orders) {
            const id = o.customer_id || o.email
            const price = parseFloat(o.total_price || 0)
            if (id && !seenCustomers.has(id)) {
              seenCustomers.add(id)
              ordersNew++
              revenueNew += price
            } else {
              ordersRet++
              revenueRet += price
            }
          }

          console.log(`${key}: ${totalOrders} ordini, €${Math.round(revenue)} fatturato, ${newCustomers} nuovi clienti`)

          return {
            key,
            orders:              totalOrders,
            revenue:             Math.round(revenue * 100) / 100,
            aov:                 Math.round(aov * 100) / 100,
            newCustomers,
            // Metriche avanzate
            ordersNew,
            ordersReturning:     ordersRet,
            revenueNew:          Math.round(revenueNew * 100) / 100,
            revenueReturning:    Math.round(revenueRet * 100) / 100,
            aovNew:              ordersNew > 0 ? Math.round(revenueNew / ordersNew * 100) / 100 : 0,
            aovReturning:        ordersRet > 0 ? Math.round(revenueRet / ordersRet * 100) / 100 : 0,
            ok: true,
          }
        } catch(e) {
          console.log(`Month ${key} error:`, e.message)
          return { key, orders: 0, revenue: 0, aov: 0, newCustomers: 0, ordersNew: 0, ordersReturning: 0, revenueNew: 0, revenueReturning: 0, aovNew: 0, aovReturning: 0, ok: false }
        }
      })
    )
    results.push(...batch)
  }

  const totalOrders   = results.reduce((s, m) => s + m.orders, 0)
  const totalRevenue  = results.reduce((s, m) => s + m.revenue, 0)
  const newCustYear   = results.reduce((s, m) => s + m.newCustomers, 0)
  const aovGlobal     = totalOrders > 0 ? Math.round(totalRevenue / totalOrders * 100) / 100 : 0

  return { months: results, shopifyOk: results.some(m => m.ok), aovGlobal, newCustYear, totalOrders, totalRevenue }
}

// ── Meta spesa mensile ─────────────────────────────────────────
async function fetchMeta() {
  if (!META_TOKEN || !META_ACCOUNT) return null
  const accounts = META_ACCOUNT.split(',').map(s => s.trim()).filter(Boolean)
  const since    = format(subDays(new Date(), 380), 'yyyy-MM-dd')
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
        const m = d.date_start?.slice(0, 7)
        if (m) map[m] = (map[m] || 0) + parseFloat(d.spend || 0)
      }
    const monthly    = Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, spend]) => ({ month, spend: Math.round(spend * 100) / 100 }))
    const totalSpend = Math.round(monthly.reduce((s, m) => s + m.spend, 0) * 100) / 100
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

    const shopify = shopifyResult.status === 'fulfilled' ? shopifyResult.value : null
    const meta    = metaResult.status    === 'fulfilled' ? metaResult.value    : null
    if (shopifyResult.status === 'rejected') console.log('Shopify:', shopifyResult.reason?.message)
    if (metaResult.status   === 'rejected') console.log('Meta:',    metaResult.reason?.message)

    const metaMap = {}
    for (const m of (meta?.monthly || [])) metaMap[m.month] = m.spend

    const monthly = (shopify?.months || []).map(m => ({
      month:              m.key,
      orders:             m.orders,
      revenue:            m.revenue,
      aov:                m.aov,
      newCustomers:       m.newCustomers,
      // Metriche avanzate nuovi vs returning
      ordersNew:          m.ordersNew || 0,
      ordersReturning:    m.ordersReturning || 0,
      revenueNew:         m.revenueNew || 0,
      revenueReturning:   m.revenueReturning || 0,
      aovNew:             m.aovNew || 0,
      aovReturning:       m.aovReturning || 0,
      // Ads
      metaSpend:          metaMap[m.key] || 0,
      totalSpend:         metaMap[m.key] || 0,
    }))

    return NextResponse.json({
      aov:               shopify?.aovGlobal || 0,
      purchaseFrequency: 1.69,
      customerLifespan:  1.57,
      grossMargin:       0.30,
      ltvGross:          0,
      ltvNet:            0,
      metaSpend:         meta?.totalSpend || 0,
      googleSpend:       0,
      totalAdSpend:      meta?.totalSpend || 0,
      newCustomers:      shopify?.newCustYear || 0,
      cac:               null,
      ratio:             null,
      ratioStatus:       'no_data',
      totalOrders:       shopify?.totalOrders || 0,
      totalRevenue:      shopify?.totalRevenue || 0,
      uniqueCustomers:   0,
      churnRate:         36.3,
      retentionRate:     63.7,
      returningRate:     0,
      sources: { shopify: shopify?.shopifyOk || false, meta: !!meta, google: false },
      monthly,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Metrics error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
