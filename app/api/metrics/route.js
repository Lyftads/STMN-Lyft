export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel Pro

import { NextResponse } from 'next/server'
import { subDays, format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN
const META_TOKEN    = process.env.META_ACCESS_TOKEN
const META_ACCOUNT  = process.env.META_AD_ACCOUNT_ID

function shopifyAuth() {
  return { 'X-Shopify-Access-Token': SHOPIFY_TOKEN || '' }
}

// ── Paginazione completa ordini con date range ─────────────────
async function fetchAllOrders(startISO, endISO) {
  let orders = []
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?` +
    `status=any&financial_status=any` +
    `&created_at_min=${startISO}&created_at_max=${endISO}` +
    `&limit=250&fields=id,total_price,current_total_price,customer_id,email,created_at,financial_status`
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

// ── Dati ESATTI per periodo selezionato (paginazione completa) ─
async function fetchPeriodData(startISO, endISO) {
  const orders = await fetchAllOrders(startISO, endISO)
  const validOrders = orders.filter(o => o.financial_status !== 'voided')

  // Analisi cross-periodo per nuovi vs returning
  const customerFirstSeen = {}
  for (const o of validOrders.sort((a,b) => new Date(a.created_at) - new Date(b.created_at))) {
    const cid = o.customer_id || o.email?.toLowerCase()
    if (cid && !customerFirstSeen[cid]) customerFirstSeen[cid] = o.created_at
  }

  const totalOrders  = validOrders.length
  const grossRevenue = validOrders.reduce((s,o) => s + parseFloat(o.total_price || 0), 0)
  const netRevenue   = validOrders.reduce((s,o) => s + parseFloat(o.current_total_price || o.total_price || 0), 0)
  const returns      = grossRevenue - netRevenue
  const aov          = totalOrders > 0 ? netRevenue / totalOrders : 0

  // Nuovi clienti = clienti il cui primo ordine cade in questo periodo
  const newCustIds   = new Set(Object.keys(customerFirstSeen))
  const retCustIds   = new Set()
  let revenueNew = 0, revenueRet = 0, ordersNew = 0, ordersRet = 0

  for (const o of validOrders) {
    const cid   = o.customer_id || o.email?.toLowerCase()
    const price = parseFloat(o.current_total_price || o.total_price || 0)
    if (cid && newCustIds.has(cid)) { ordersNew++; revenueNew += price }
    else                             { ordersRet++; revenueRet += price; if(cid) retCustIds.add(cid) }
  }

  return {
    totalOrders,
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    netRevenue:   Math.round(netRevenue   * 100) / 100,
    returns:      Math.round(returns      * 100) / 100,
    aov:          Math.round(aov          * 100) / 100,
    newCustomers: newCustIds.size,
    returningCustomers: retCustIds.size,
    ordersNew, ordersRet,
    revenueNew:   Math.round(revenueNew * 100) / 100,
    revenueRet:   Math.round(revenueRet * 100) / 100,
    aovNew:       ordersNew > 0 ? Math.round(revenueNew / ordersNew * 100) / 100 : 0,
    aovRet:       ordersRet > 0 ? Math.round(revenueRet / ordersRet * 100) / 100 : 0,
  }
}

// ── Dati mensili: count per ogni mese (veloci, esatti per ordini+clienti) ─
async function fetchMonthlyCounts() {
  const now    = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i)
    return { key: format(d, 'yyyy-MM'), startISO: startOfMonth(d).toISOString(), endISO: endOfMonth(d).toISOString() }
  })
  // 24 chiamate leggere in parallelo
  const results = await Promise.all(months.map(async ({ key, startISO, endISO }) => {
    const [ordRes, custRes] = await Promise.all([
      fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/orders/count.json?status=any&financial_status=paid&created_at_min=${startISO}&created_at_max=${endISO}`, { headers: shopifyAuth() }).then(r=>r.json()).catch(()=>({count:0})),
      fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/customers/count.json?created_at_min=${startISO}&created_at_max=${endISO}`, { headers: shopifyAuth() }).then(r=>r.json()).catch(()=>({count:0})),
    ])
    return { key, orders: ordRes.count||0, newCustomersRegistered: custRes.count||0 }
  }))
  return results
}

// ── Meta spesa mensile ─────────────────────────────────────────
async function fetchMeta() {
  if (!META_TOKEN || !META_ACCOUNT) return null
  const accounts = META_ACCOUNT.split(',').map(s=>s.trim()).filter(Boolean)
  const since = format(subDays(new Date(), 380), 'yyyy-MM-dd')
  const until = format(new Date(), 'yyyy-MM-dd')
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
        if (m) map[m] = (map[m]||0) + parseFloat(d.spend||0)
      }
    const monthly    = Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).map(([month,spend])=>({month,spend:Math.round(spend*100)/100}))
    const totalSpend = Math.round(monthly.reduce((s,m)=>s+m.spend,0)*100)/100
    return { totalSpend, monthly }
  } catch(e) { return null }
}

// ── Handler principale ─────────────────────────────────────────
export async function GET(request) {
  try {
    // Leggi periodo CAC dalla query string (passato dal frontend)
    const url      = new URL(request.url)
    const cacStart = url.searchParams.get('cacStart') || '2026-01-01'
    const cacEnd   = url.searchParams.get('cacEnd')   || format(new Date(), 'yyyy-MM-dd')

    const cacStartISO = new Date(cacStart + 'T00:00:00Z').toISOString()
    const cacEndISO   = new Date(cacEnd   + 'T23:59:59Z').toISOString()

    console.log(`Fetching period: ${cacStart} → ${cacEnd}`)

    // Fetch tutto in parallelo
    const [periodResult, monthlyResult, metaResult] = await Promise.allSettled([
      fetchPeriodData(cacStartISO, cacEndISO),
      fetchMonthlyCounts(),
      fetchMeta(),
    ])

    const period  = periodResult.status  === 'fulfilled' ? periodResult.value  : null
    const monthly = monthlyResult.status === 'fulfilled' ? monthlyResult.value : []
    const meta    = metaResult.status    === 'fulfilled' ? metaResult.value    : null

    // Spesa Meta nel periodo CAC
    const cacStartMonth = cacStart.slice(0,7)
    const cacEndMonth   = cacEnd.slice(0,7)
    const metaByMonth   = {}
    for (const m of (meta?.monthly||[])) metaByMonth[m.month] = m.spend
    const metaSpendPeriod = Object.entries(metaByMonth)
      .filter(([m]) => m >= cacStartMonth && m <= cacEndMonth)
      .reduce((s,[,v]) => s + v, 0)

    // Dati mensili combinati
    const monthlyData = monthly.map(m => ({
      month:                 m.key,
      orders:                m.orders,
      revenue:               0,   // richiede paginazione full — mostra "—"
      grossRevenue:          0,
      returns:               0,
      aov:                   0,
      newCustomers:          m.newCustomersRegistered, // registrazioni (esatto)
      returningCustomers:    0,
      ordersNew:             0,
      ordersReturning:       0,
      revenueNew:            0,
      revenueReturning:      0,
      aovNew:                0,
      aovReturning:          0,
      metaSpend:             metaByMonth[m.key] || 0,
      totalSpend:            metaByMonth[m.key] || 0,
      isExact:               false, // dati dal periodo esatto sono separati
    }))

    return NextResponse.json({
      // ── Metriche globali dal periodo selezionato (ESATTE) ──
      aov:               period?.aov            || 0,
      grossRevenue:      period?.grossRevenue   || 0,
      netRevenue:        period?.netRevenue     || 0,
      returns:           period?.returns        || 0,
      newCustomers:      period?.newCustomers   || 0,
      returningCustomers: period?.returningCustomers || 0,
      ordersNew:         period?.ordersNew      || 0,
      ordersRet:         period?.ordersRet      || 0,
      revenueNew:        period?.revenueNew     || 0,
      revenueRet:        period?.revenueRet     || 0,
      aovNew:            period?.aovNew         || 0,
      aovRet:            period?.aovRet         || 0,
      totalOrders:       period?.totalOrders    || 0,
      // ── CAC con dati periodo ──
      purchaseFrequency: 1.69,
      customerLifespan:  1.57,
      grossMargin:       0.30,
      ltvGross:          0, ltvNet: 0,
      metaSpend:         meta?.totalSpend       || 0,
      metaSpendPeriod:   Math.round(metaSpendPeriod * 100) / 100,
      googleSpend:       0,
      totalAdSpend:      meta?.totalSpend       || 0,
      totalAdSpendPeriod: Math.round(metaSpendPeriod * 100) / 100,
      cac:               null, ratio: null, ratioStatus: 'no_data',
      totalRevenue:      period?.netRevenue     || 0,
      uniqueCustomers:   0,
      churnRate: 36.3, retentionRate: 63.7, returningRate: 0,
      cacPeriod: { start: cacStart, end: cacEnd },
      sources: { shopify: !!period, meta: !!meta, google: false },
      monthly: monthlyData,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Metrics error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
