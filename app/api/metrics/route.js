export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN
const META_TOKEN    = process.env.META_ACCESS_TOKEN
const META_ACCOUNT  = process.env.META_AD_ACCOUNT_ID
const START_DATE    = '2026-04-01'

function shopifyAuth() {
  return { 'X-Shopify-Access-Token': SHOPIFY_TOKEN || '' }
}

// ── Fetch ordini (senza line_items — più veloce) ───────────────
async function fetchOrders() {
  let orders = []
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?` +
    `status=any&financial_status=any` +
    `&created_at_min=${START_DATE}T00:00:00Z` +
    `&limit=250` +
    `&fields=id,total_price,current_total_price,customer_id,email,created_at,financial_status`
  while (url) {
    const res = await fetch(url, { headers: shopifyAuth() })
    if (!res.ok) { console.log('Orders:', res.status); break }
    const data = await res.json()
    if (!data.orders?.length) break
    orders = orders.concat(data.orders)
    const link = res.headers.get('Link') || ''
    const next = link.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
  }
  console.log(`Ordini: ${orders.length} dal ${START_DATE}`)
  return orders
}

// ── Fetch ordini con line_items (solo per tab Prodotti) ────────
async function fetchOrdersWithProducts() {
  let orders = []
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?` +
    `status=any&financial_status=any` +
    `&created_at_min=${START_DATE}T00:00:00Z` +
    `&limit=250` +
    `&fields=id,created_at,financial_status,line_items`
  while (url) {
    const res = await fetch(url, { headers: shopifyAuth() })
    if (!res.ok) break
    const data = await res.json()
    if (!data.orders?.length) break
    orders = orders.concat(data.orders)
    const link = res.headers.get('Link') || ''
    const next = link.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
  }
  return orders
}

// ── Meta spesa mensile ─────────────────────────────────────────
async function fetchMeta() {
  if (!META_TOKEN || !META_ACCOUNT) return []
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
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).map(([month,spend])=>({month,spend:Math.round(spend*100)/100}))
  } catch(e) { return [] }
}

// ── Processa ordini → metriche ─────────────────────────────────
function processOrders(orders) {
  const valid = orders.filter(o => o.financial_status !== 'voided')

  // Prima apparizione per ogni cliente nel dataset
  const firstMonth = {}
  for (const o of [...valid].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))) {
    const cid = String(o.customer_id||o.email||o.id)
    if (!firstMonth[cid]) firstMonth[cid] = o.created_at.slice(0,7)
  }

  const byMonth = {}
  for (const o of valid) {
    const m = o.created_at.slice(0,7)
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(o)
  }

  const months = Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b)).map(([month, ords]) => {
    const gross = ords.reduce((s,o)=>s+parseFloat(o.total_price||0),0)
    const net   = ords.reduce((s,o)=>s+parseFloat(o.current_total_price||o.total_price||0),0)
    const total = ords.length
    const aov   = total>0 ? net/total : 0
    const newCust = new Set()
    for (const o of ords) {
      const cid = String(o.customer_id||o.email||o.id)
      if (firstMonth[cid]===month) newCust.add(cid)
    }
    return {
      month,
      orders:       total,
      grossRevenue: Math.round(gross*100)/100,
      netRevenue:   Math.round(net*100)/100,
      returns:      Math.round((gross-net)*100)/100,
      aov:          Math.round(aov*100)/100,
      newCustomers: newCust.size,
    }
  })

  return {
    months,
    totalOrders:  valid.length,
    totalRevenue: Math.round(months.reduce((s,m)=>s+m.netRevenue,0)*100)/100,
    totalGross:   Math.round(months.reduce((s,m)=>s+m.grossRevenue,0)*100)/100,
    totalReturns: Math.round(months.reduce((s,m)=>s+m.returns,0)*100)/100,
    newCustomers: months.reduce((s,m)=>s+m.newCustomers,0),
    aovGlobal:    valid.length>0 ? Math.round(months.reduce((s,m)=>s+m.netRevenue,0)/valid.length*100)/100 : 0,
  }
}

function processProducts(orders) {
  const map = {}
  for (const o of orders.filter(o=>o.financial_status!=='voided')) {
    for (const li of (o.line_items||[])) {
      const pid = String(li.product_id||li.title)
      const rev = parseFloat(li.price||0) * parseInt(li.quantity||1)
      if (!map[pid]) map[pid] = { title: li.title, qty: 0, revenue: 0 }
      map[pid].qty     += parseInt(li.quantity||1)
      map[pid].revenue += rev
    }
  }
  return Object.values(map)
    .map(p=>({...p, revenue:Math.round(p.revenue*100)/100, aov:Math.round(p.revenue/p.qty*100)/100}))
    .sort((a,b)=>b.revenue-a.revenue).slice(0,20)
}

// ── Handler ────────────────────────────────────────────────────
export async function GET(request) {
  try {
    const withProducts = new URL(request.url).searchParams.get('products') === '1'

    const [orders, metaMonthly] = await Promise.all([
      withProducts ? fetchOrdersWithProducts() : fetchOrders(),
      fetchMeta(),
    ])

    const shopify  = processOrders(orders)
    const products = withProducts ? processProducts(orders) : []
    const metaMap  = {}
    for (const m of metaMonthly) metaMap[m.month] = m.spend
    const metaTotal = metaMonthly.reduce((s,m)=>s+m.spend,0)

    const monthly = shopify.months.map(m => ({ ...m, metaSpend: metaMap[m.month]||0 }))

    return NextResponse.json({
      aov:               shopify.aovGlobal,
      totalOrders:       shopify.totalOrders,
      totalRevenue:      shopify.totalRevenue,
      totalGross:        shopify.totalGross,
      totalReturns:      shopify.totalReturns,
      newCustomers:      shopify.newCustomers,

      metaSpend:         Math.round(metaTotal*100)/100,
      monthly,
      products,
      sources: { shopify: orders.length>0, meta: metaMonthly.length>0, google: false },
      startDate: START_DATE,
      updatedAt: new Date().toISOString(),
    })
  } catch(err) {
    console.error(err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
