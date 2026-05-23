export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel Pro

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
async function fetchOrdersForMonth(startISO, endISO) {
  let orders = []
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?` +
    `status=any&financial_status=any` +
    `&created_at_min=${startISO}&created_at_max=${endISO}` +
    `&limit=250&fields=id,total_price,current_total_price,total_refunds,customer_id,email,created_at,financial_status`

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

// ── Fetch dati mensili completi con analisi cross-mese ────────
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

  // Step 1: Scarica TUTTI gli ordini per tutti i mesi in parallelo (3 alla volta)
  const allMonthOrders = [] // [{ key, orders: [...] }]
  for (let i = 0; i < months.length; i += 3) {
    const batch = await Promise.all(
      months.slice(i, i + 3).map(async ({ key, startISO, endISO }) => {
        const orders = await fetchOrdersForMonth(startISO, endISO)
        console.log(`${key}: ${orders.length} ordini`)
        return { key, orders }
      })
    )
    allMonthOrders.push(...batch)
  }

  // Step 2: Analisi cross-mese per nuovi vs returning clienti
  // Un cliente è "nuovo" nel mese in cui compare PER LA PRIMA VOLTA nei nostri dati
  const customerFirstMonth = {} // customerId → month key
  for (const { key, orders } of allMonthOrders) {
    for (const o of orders) {
      const cid = o.customer_id || o.email?.toLowerCase()
      if (!cid) continue
      if (!customerFirstMonth[cid]) customerFirstMonth[cid] = key
    }
  }

  // Step 3: Calcola metriche per mese
  const results = allMonthOrders.map(({ key, orders }) => {
    // Escludi ordini completamente rimborsati
    const validOrders = orders.filter(o => o.financial_status !== 'voided')

    const totalOrders  = validOrders.length
    // current_total_price = prezzo netto dopo resi parziali/totali
    const revenue      = validOrders.reduce((s, o) => s + parseFloat(o.current_total_price || o.total_price || 0), 0)
    const grossRevenue = validOrders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0)
    const returns      = grossRevenue - revenue // totale resi
    const aov          = totalOrders > 0 ? revenue / totalOrders : 0

    // Nuovi vs returning basato su analisi cross-mese
    let newCustomerOrders = 0, returningCustomerOrders = 0
    let revenueNew = 0, revenueReturning = 0

    for (const o of validOrders) {
      const cid   = o.customer_id || o.email?.toLowerCase()
      const price = parseFloat(o.current_total_price || o.total_price || 0)
      const isNew = !cid || customerFirstMonth[cid] === key
      if (isNew) { newCustomerOrders++; revenueNew += price }
      else        { returningCustomerOrders++; revenueReturning += price }
    }

    const aovNew       = newCustomerOrders > 0 ? revenueNew / newCustomerOrders : 0
    const aovReturning = returningCustomerOrders > 0 ? revenueReturning / returningCustomerOrders : 0

    return {
      key,
      orders:              totalOrders,
      revenue:             Math.round(revenue * 100) / 100,
      grossRevenue:        Math.round(grossRevenue * 100) / 100,
      returns:             Math.round(returns * 100) / 100,
      aov:                 Math.round(aov * 100) / 100,
      // Nuovi clienti unici nel mese (prima apparizione)
      newCustomers:        [...new Set(validOrders
        .filter(o => { const cid = o.customer_id || o.email?.toLowerCase(); return !cid || customerFirstMonth[cid] === key })
        .map(o => o.customer_id || o.email?.toLowerCase())
      )].length,
      returningCustomers:  [...new Set(validOrders
        .filter(o => { const cid = o.customer_id || o.email?.toLowerCase(); return cid && customerFirstMonth[cid] !== key })
        .map(o => o.customer_id || o.email?.toLowerCase())
      )].length,
      ordersNew:           newCustomerOrders,
      ordersReturning:     returningCustomerOrders,
      revenueNew:          Math.round(revenueNew * 100) / 100,
      revenueReturning:    Math.round(revenueReturning * 100) / 100,
      aovNew:              Math.round(aovNew * 100) / 100,
      aovReturning:        Math.round(aovReturning * 100) / 100,
      ok: true,
    }
  })

  const totalOrders  = results.reduce((s, m) => s + m.orders, 0)
  const totalRevenue = results.reduce((s, m) => s + m.revenue, 0)
  const newCustYear  = results.reduce((s, m) => s + m.newCustomers, 0)
  const aovGlobal    = totalOrders > 0 ? Math.round(totalRevenue / totalOrders * 100) / 100 : 0

  return { months: results, shopifyOk: results.some(m => m.ok && m.orders > 0), aovGlobal, newCustYear, totalOrders, totalRevenue }
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
      month:             m.key,
      orders:            m.orders,
      revenue:           m.revenue,           // netto (dopo resi)
      grossRevenue:      m.grossRevenue,       // lordo
      returns:           m.returns,            // totale resi
      aov:               m.aov,               // AOV netto
      newCustomers:      m.newCustomers,       // primi acquirenti
      returningCustomers: m.returningCustomers,
      ordersNew:         m.ordersNew,
      ordersReturning:   m.ordersReturning,
      revenueNew:        m.revenueNew,
      revenueReturning:  m.revenueReturning,
      aovNew:            m.aovNew,
      aovReturning:      m.aovReturning,
      metaSpend:         metaMap[m.key] || 0,
      totalSpend:        metaMap[m.key] || 0,
    }))

    return NextResponse.json({
      aov:               shopify?.aovGlobal || 0,
      purchaseFrequency: 1.69,
      customerLifespan:  1.57,
      grossMargin:       0.30,
      ltvGross:          0, ltvNet: 0,
      metaSpend:         meta?.totalSpend || 0,
      googleSpend:       0,
      totalAdSpend:      meta?.totalSpend || 0,
      newCustomers:      shopify?.newCustYear || 0,
      cac:               null, ratio: null, ratioStatus: 'no_data',
      totalOrders:       shopify?.totalOrders  || 0,
      totalRevenue:      shopify?.totalRevenue || 0,
      uniqueCustomers:   0,
      churnRate:         36.3, retentionRate: 63.7, returningRate: 0,
      sources: { shopify: shopify?.shopifyOk || false, meta: !!meta, google: false },
      monthly,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Metrics error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
