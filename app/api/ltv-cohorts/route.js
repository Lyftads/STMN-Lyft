export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'

// ── LTV & Coorti (additivo, isolato, tenant-aware) ──────────────────────────
// Usa la Admin GraphQL `customers` (aggregati LIFETIME: createdAt, numberOfOrders,
// amountSpent) → storico completo, NON soggetta al limite 60gg della Orders API.
// Coorti per mese di ACQUISIZIONE: dimensione, repeat rate, ordini/cliente, LTV.

const storeUrl = () => getShopify().storeUrl
const token = () => getShopify().adminToken

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(num(n) * 100) / 100

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

async function fetchCustomers(startTs) {
  if (!storeUrl() || !token()) return { customers: [], truncated: false }
  const out = []
  // Più recenti prima: così raccolgo solo la finestra e mi fermo appena
  // arrivo a clienti più vecchi dell'inizio periodo.
  const gql = `query($cursor: String) {
    customers(first: 250, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      edges { node { createdAt numberOfOrders amountSpent { amount } } }
      pageInfo { hasNextPage endCursor }
    }
  }`
  let cursor = null
  let pages = 0
  const MAX_PAGES = 80
  let truncated = false
  let done = false
  while (pages < MAX_PAGES && !done) {
    pages++
    const res = await fetch(`https://${storeUrl()}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token() || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gql, variables: { cursor } }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) { if (pages === 1) throw new Error(`Shopify ${res.status}`); break }
    const j = await res.json()
    const conn = j?.data?.customers
    if (!conn) { if (pages === 1 && j?.errors) throw new Error(j.errors[0]?.message || 'GraphQL error'); break }
    for (const e of (conn.edges || [])) {
      const ts = new Date(e.node.createdAt).getTime()
      if (Number.isFinite(ts) && ts < startTs) { done = true; break } // più vecchio della finestra → stop
      out.push(e.node)
    }
    if (done || !conn.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
    if (pages >= MAX_PAGES && conn.pageInfo?.hasNextPage) truncated = true
  }
  return { customers: out, truncated }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    if (!storeUrl() || !token()) return NextResponse.json({ error: 'Shopify non configurato', cohorts: [] }, { status: 200 })

    const { searchParams } = new URL(req.url)
    const months = Math.min(36, Math.max(3, Number(searchParams.get('months') || 12)))
    const now = new Date()
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))
    const sinceStr = start.toISOString().slice(0, 10)

    try {
      const { customers, truncated } = await fetchCustomers(start.getTime())

      const cohortMap = new Map() // 'YYYY-MM' → agg
      let totCustomers = 0, totOrders = 0, totRevenue = 0, repeatTot = 0
      const dist = { one: 0, two: 0, three: 0, fourPlus: 0 }

      for (const c of customers) {
        const d = new Date(c.createdAt)
        if (Number.isNaN(d.getTime())) continue
        const orders = Math.round(num(c.numberOfOrders))
        const spent = num(c.amountSpent?.amount)
        // I clienti con 0 ordini (solo account) non rientrano nelle coorti d'acquisto
        if (orders <= 0) continue
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
        if (!cohortMap.has(key)) cohortMap.set(key, { size: 0, orders: 0, revenue: 0, repeat: 0 })
        const co = cohortMap.get(key)
        co.size++; co.orders += orders; co.revenue += spent
        if (orders >= 2) co.repeat++
        totCustomers++; totOrders += orders; totRevenue += spent
        if (orders >= 2) repeatTot++
        if (orders === 1) dist.one++
        else if (orders === 2) dist.two++
        else if (orders === 3) dist.three++
        else dist.fourPlus++
      }

      const cohortKeys = [...cohortMap.keys()].sort().slice(-months)
      const cohorts = cohortKeys.map(key => {
        const co = cohortMap.get(key)
        const [y, m] = key.split('-').map(Number)
        return {
          cohort: key,
          label: `${MONTH_LABELS[m - 1]} ${String(y).slice(2)}`,
          size: co.size,
          repeatRate: co.size > 0 ? Math.round((co.repeat / co.size) * 1000) / 10 : 0,
          avgOrders: co.size > 0 ? Math.round((co.orders / co.size) * 100) / 100 : 0,
          ltv: co.size > 0 ? r2(co.revenue / co.size) : 0,
        }
      }).reverse() // più recente in alto

      const summary = {
        customers: totCustomers,
        repeatCustomers: repeatTot,
        repeatRate: totCustomers > 0 ? Math.round((repeatTot / totCustomers) * 1000) / 10 : 0,
        oneTimeRate: totCustomers > 0 ? Math.round((dist.one / totCustomers) * 1000) / 10 : 0,
        avgOrders: totCustomers > 0 ? Math.round((totOrders / totCustomers) * 100) / 100 : 0,
        avgLtv: totCustomers > 0 ? r2(totRevenue / totCustomers) : 0,
        ordersTotal: totOrders,
        revenueTotal: r2(totRevenue),
      }

      const distribution = [
        { label: '1 ordine', count: dist.one },
        { label: '2 ordini', count: dist.two },
        { label: '3 ordini', count: dist.three },
        { label: '4+ ordini', count: dist.fourPlus },
      ]

      return NextResponse.json({
        months, since: sinceStr, truncated,
        summary, cohorts, distribution,
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      return NextResponse.json({ error: err?.message || 'Errore', cohorts: [] }, { status: 200 })
    }
  })
}
