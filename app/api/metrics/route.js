export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval, parseISO } from 'date-fns'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN
const META_TOKEN    = process.env.META_ACCESS_TOKEN
const META_ACCOUNT  = process.env.META_AD_ACCOUNT_ID
const START_DATE    = '2026-04-01'

function shopifyAuth() {
  return { 'X-Shopify-Access-Token': SHOPIFY_TOKEN || '' }
}

// ── Fetch tutti gli ordini dal 1 aprile (dentro finestra 60gg) ─
async function fetchAllOrders() {
  let orders = []
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?` +
    `status=any&financial_status=any` +
    `&created_at_min=${START_DATE}T00:00:00Z` +
    `&limit=250` +
    `&fields=id,total_price,current_total_price,customer_id,email,created_at,financial_status,line_items`
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
  console.log(`Fetched ${orders.length} orders from ${START_DATE}`)
  return orders
}

// ── Meta spesa mensile da aprile ───────────────────────────────
async function fetchMeta() {
  if (!META_TOKEN || !META_ACCOUNT) return null
  const accounts = META_ACCOUNT.split(',').map(s => s.trim()).filter(Boolean)
  try {
    const results = await Promise.all(accounts.map(async id => {
      const res  = await fetch(`https://graph.facebook.com/v19.0/${id}/insights?fields=spend&time_range={"since":"${START_DATE}","until":"${format(new Date(),'yyyy-MM-dd')}"}&time_increment=monthly&access_token=${META_TOKEN}`)
      const data = await res.json()
      if (data.error) { console.log('Meta:', data.error.message); return [] }
      return data.data || []
    }))
    const map = {}
    for (const rows of results)
      for (const d of rows) {
        const m = d.date_start?.slice(0,7)
        if (m) map[m] = (map[m]||0) + parseFloat(d.spend||0)
      }
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([month,spend]) => ({ month, spend: Math.round(spend*100)/100 }))
  } catch(e) { return [] }
}

// ── Processa ordini → metriche mensili ─────────────────────────
function processOrders(orders) {
  const validOrders = orders.filter(o => o.financial_status !== 'voided' && o.financial_status !== 'refunded' || parseFloat(o.current_total_price||0) > 0)

  // Mappa customer → primo mese di acquisto (nel nostro dataset)
  const customerFirstMonth = {}
  const ordersByDate = [...validOrders].sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
  for (const o of ordersByDate) {
    const cid   = String(o.customer_id || o.email || o.id)
    const month = o.created_at.slice(0,7)
    if (!customerFirstMonth[cid]) customerFirstMonth[cid] = month
  }

  // Raggruppa per mese
  const byMonth = {}
  for (const o of validOrders) {
    const month = o.created_at.slice(0,7)
    if (!byMonth[month]) byMonth[month] = []
    byMonth[month].push(o)
  }

  // Analisi prodotti (tutti i mesi)
  const productMap = {}
  for (const o of validOrders) {
    for (const li of (o.line_items||[])) {
      const pid   = li.product_id || li.title
      const price = parseFloat(li.price||0) * parseInt(li.quantity||1)
      if (!productMap[pid]) productMap[pid] = { id: pid, title: li.title, vendor: li.vendor||'', qty: 0, revenue: 0 }
      productMap[pid].qty     += parseInt(li.quantity||1)
      productMap[pid].revenue += price
    }
  }
  const products = Object.values(productMap)
    .map(p => ({ ...p, revenue: Math.round(p.revenue*100)/100, aov: Math.round(p.revenue/p.qty*100)/100 }))
    .sort((a,b) => b.revenue - a.revenue)
    .slice(0, 20)

  // Calcola metriche per mese
  const months = Object.entries(byMonth).sort(([a],[b]) => a.localeCompare(b)).map(([month, ords]) => {
    const gross  = ords.reduce((s,o) => s + parseFloat(o.total_price||0), 0)
    const net    = ords.reduce((s,o) => s + parseFloat(o.current_total_price||o.total_price||0), 0)
    const resi   = gross - net
    const total  = ords.length
    const aov    = total > 0 ? net/total : 0

    const newCustSet = new Set()
    const retCustSet = new Set()
    let revenueNew = 0, revenueRet = 0, ordersNew = 0, ordersRet = 0

    for (const o of ords) {
      const cid   = String(o.customer_id || o.email || o.id)
      const price = parseFloat(o.current_total_price||o.total_price||0)
      if (customerFirstMonth[cid] === month) {
        newCustSet.add(cid); revenueNew += price; ordersNew++
      } else {
        retCustSet.add(cid); revenueRet += price; ordersRet++
      }
    }

    return {
      month,
      orders:           total,
      grossRevenue:     Math.round(gross*100)/100,
      netRevenue:       Math.round(net*100)/100,
      returns:          Math.round(resi*100)/100,
      aov:              Math.round(aov*100)/100,
      newCustomers:     newCustSet.size,
      returningCustomers: retCustSet.size,
      ordersNew, ordersRet,
      revenueNew:       Math.round(revenueNew*100)/100,
      revenueRet:       Math.round(revenueRet*100)/100,
      aovNew:           ordersNew > 0 ? Math.round(revenueNew/ordersNew*100)/100 : 0,
      aovRet:           ordersRet > 0 ? Math.round(revenueRet/ordersRet*100)/100 : 0,
    }
  })

  // Totali periodo
  const totalOrders  = months.reduce((s,m) => s+m.orders, 0)
  const totalRevenue = months.reduce((s,m) => s+m.netRevenue, 0)
  const totalGross   = months.reduce((s,m) => s+m.grossRevenue, 0)
  const totalReturns = months.reduce((s,m) => s+m.returns, 0)
  const totalNewCust = months.reduce((s,m) => s+m.newCustomers, 0)
  const totalRetCust = months.reduce((s,m) => s+m.returningCustomers, 0)
  const aovGlobal    = totalOrders > 0 ? Math.round(totalRevenue/totalOrders*100)/100 : 0

  return { months, products, totalOrders, totalRevenue, totalGross, totalReturns, totalNewCust, totalRetCust, aovGlobal }
}

// ── Handler ────────────────────────────────────────────────────
export async function GET() {
  try {
    const [orders, metaMonthly] = await Promise.all([
      fetchAllOrders(),
      fetchMeta(),
    ])

    const shopify  = processOrders(orders)
    const metaMap  = {}
    for (const m of (metaMonthly||[])) metaMap[m.month] = m.spend
    const metaTotal = (metaMonthly||[]).reduce((s,m) => s+m.spend, 0)

    const monthly = shopify.months.map(m => ({
      ...m,
      metaSpend: metaMap[m.month] || 0,
    }))

    return NextResponse.json({
      // Globali periodo
      aov:               shopify.aovGlobal,
      totalOrders:       shopify.totalOrders,
      totalRevenue:      shopify.totalRevenue,
      totalGross:        shopify.totalGross,
      totalReturns:      shopify.totalReturns,
      newCustomers:      shopify.totalNewCust,
      returningCustomers: shopify.totalRetCust,
      metaSpend:         Math.round(metaTotal*100)/100,
      // Mensili
      monthly,
      // Prodotti
      products:          shopify.products,
      // Meta
      sources: { shopify: orders.length > 0, meta: (metaMonthly||[]).length > 0, google: false },
      startDate: START_DATE,
      updatedAt: new Date().toISOString(),
    })
  } catch(err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
