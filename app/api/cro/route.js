export const dynamic = 'force-dynamic'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'

// ── CRO day-preciso dalle analitiche Shopify (ShopifyQL) ────────────────────
// STESSA FONTE della Dashboard / Conto Economico → i numeri combaciano sempre
// (ordini, fatturato, sessioni, funnel) per qualunque periodo, anche custom.
// Niente paginazione ordini (che con since_id sotto-contava ~la metà) né GA4.
// ShopifyQL lavora nel fuso del negozio (CEST) e UNTIL è inclusivo, come il
// resto dell'app.

const num = (v) => {
  if (v == null) return 0
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

// ShopifyQL con retry sul throttling (stesso pattern di /api/pnl e /api/metrics).
async function shopifyQL(query) {
  const { storeUrl: STORE, adminToken: TOKEN } = getShopify()
  if (!STORE || !TOKEN) return []
  const gql = `query($q: String!) { shopifyqlQuery(query: $q) { tableData { columns { name } rows } parseErrors } }`
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`https://${STORE}/admin/api/2026-04/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': TOKEN || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: gql, variables: { q: query } }),
      })
      const json = await res.json().catch(() => null)
      const errs = json?.errors || []
      const ts = json?.extensions?.cost?.throttleStatus
      const throttled = res.status === 429 || errs.some(e => /throttl/i.test(e?.message || '') || e?.extensions?.code === 'THROTTLED') || (ts && ts.currentlyAvailable === 0)
      if (throttled && attempt < 4) { await sleep(900 * attempt); continue }
      if (!res.ok || errs.length) return []
      const payload = json?.data?.shopifyqlQuery
      if (payload?.parseErrors?.length) return []
      const cols = payload?.tableData?.columns || []
      return (payload?.tableData?.rows || []).map(row => {
        if (!Array.isArray(row)) return row
        const o = {}
        cols.forEach((c, i) => { o[c.name || `c${i}`] = row[i] })
        return o
      })
    } catch { if (attempt < 4) { await sleep(900 * attempt); continue } return [] }
  }
  return []
}

const pad = (n) => String(n).padStart(2, '0')
const isoD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export async function GET(request) {
  return withTenantContext(request, async () => {
    const { storeUrl: STORE, adminToken: TOKEN } = getShopify()
    if (!STORE || !TOKEN) return NextResponse.json({ error: 'Shopify not configured' }, { status: 500 })

    const { searchParams } = new URL(request.url)

    // Range giorno-preciso (YYYY-MM-DD). Fallback ?days=N (ultimi N giorni a oggi).
    const sinceP = searchParams.get('since'), untilP = searchParams.get('until')
    let sinceDate, untilDate, days
    if (sinceP && untilP) {
      sinceDate = sinceP; untilDate = untilP
      days = Math.max(1, Math.round((new Date(untilP) - new Date(sinceP)) / 86400000) + 1)
    } else {
      days = parseInt(searchParams.get('days') || '30', 10)
      untilDate = isoD(new Date())
      sinceDate = isoD(new Date(Date.now() - (days - 1) * 86400000))
    }
    // Periodo precedente di pari lunghezza, subito prima.
    const prevUntilD = new Date(new Date(`${sinceDate}T00:00:00`).getTime() - 86400000)
    const prevSinceD = new Date(prevUntilD.getTime() - (days - 1) * 86400000)
    const prevSinceDate = isoD(prevSinceD), prevUntilDate = isoD(prevUntilD)

    // tab key versionata: 'cro3' invalida gli snapshot vecchi (calcolati quando
    // ShopifyQL era bloccato/vuoto) → l'auto-load mostra subito il dato corretto
    // senza dover premere Aggiorna.
    return swrSnapshot(request, { tab: 'cro3', compute: async () => {
      try {
        const salesQ = (s, u) => `FROM sales SHOW orders, total_sales SINCE ${s} UNTIL ${u}`
        const sessQ = (s, u) => `FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout SINCE ${s} UNTIL ${u}`
        // Su questo store le colonne new_customers/returning_customers di FROM
        // customers non esistono: uso FROM sales (customers totali + ritornanti)
        // e ricavo i nuovi per differenza. Stessa fonte della Dashboard.
        const custQ = (s, u) => `FROM sales SHOW customers, returning_customers SINCE ${s} UNTIL ${u}`

        const [sales, sess, cust, salesP, sessP, custP] = await Promise.all([
          shopifyQL(salesQ(sinceDate, untilDate)),
          shopifyQL(sessQ(sinceDate, untilDate)),
          shopifyQL(custQ(sinceDate, untilDate)),
          shopifyQL(salesQ(prevSinceDate, prevUntilDate)),
          shopifyQL(sessQ(prevSinceDate, prevUntilDate)),
          shopifyQL(custQ(prevSinceDate, prevUntilDate)),
        ])
        const s0 = sales[0] || {}, se0 = sess[0] || {}, c0 = cust[0] || {}
        const sp = salesP[0] || {}, sep = sessP[0] || {}, cp = custP[0] || {}

        const orders = Math.round(num(s0.orders))
        const totalSales = num(s0.total_sales)
        const sessions = Math.round(num(se0.sessions))
        const addToCart = Math.round(num(se0.sessions_with_cart_additions))
        const checkout = Math.round(num(se0.sessions_that_reached_checkout))

        const funnel = {
          sessions, visitors: sessions,
          addToCart, checkout, purchase: orders,
          source: 'Shopify',
        }

        return {
          funnel, topPages: [], flow: { nodes: [], links: [] },
          totalRevenue: Math.round(totalSales),
          totalOrders: orders,
          sessions,
          newCustomers: Math.max(0, Math.round(num(c0.customers)) - Math.round(num(c0.returning_customers))),
          returningCustomers: Math.round(num(c0.returning_customers)),
          prev: {
            revenue: Math.round(num(sp.total_sales)),
            orders: Math.round(num(sp.orders)),
            sessions: Math.round(num(sep.sessions)),
            newCustomers: Math.max(0, Math.round(num(cp.customers)) - Math.round(num(cp.returning_customers))),
            returningCustomers: Math.round(num(cp.returning_customers)),
          },
          range: { since: sinceDate, until: untilDate },
          prevRange: { since: prevSinceDate, until: prevUntilDate },
          days, source: 'shopifyql',
          updatedAt: new Date().toISOString(),
        }
      } catch (e) {
        return {
          __noCache: true,
          error: e.message,
          funnel: { sessions: 0, visitors: 0, addToCart: 0, checkout: 0, purchase: 0, source: 'Errore' },
          topPages: [], flow: { nodes: [], links: [] },
          totalRevenue: 0, totalOrders: 0, sessions: 0, newCustomers: 0, returningCustomers: 0,
          prev: { revenue: 0, orders: 0, sessions: 0, newCustomers: 0, returningCustomers: 0 },
          range: { since: sinceDate, until: untilDate }, days,
        }
      }
    } })
  })
}
