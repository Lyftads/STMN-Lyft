export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'

// LTV automatico per-tenant: niente valori fissi. Stima gli ordini-a-vita per
// cliente e l'LTV dai dati Shopify reali, con proiezione per coorte: i clienti
// "maturi" (acquisiti da ≥ maturityMonths) rappresentano il valore a cui arriva
// davvero un cliente, correggendo la sottostima dei nuovi (censoring).
const storeUrl = () => getShopify().storeUrl
const token = () => getShopify().adminToken
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(num(n) * 100) / 100

async function fetchCustomers(startTs) {
  if (!storeUrl() || !token()) return []
  const out = []
  const gql = `query($cursor: String) {
    customers(first: 250, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      edges { node { createdAt numberOfOrders amountSpent { amount } } }
      pageInfo { hasNextPage endCursor }
    }
  }`
  let cursor = null, pages = 0, done = false
  const MAX_PAGES = 80
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
      if (Number.isFinite(ts) && ts < startTs) { done = true; break }
      out.push(e.node)
    }
    if (done || !conn.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
  }
  return out
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    if (!storeUrl() || !token()) return NextResponse.json({ configured: false, error: 'Shopify non configurato' }, { status: 200 })

    const { searchParams } = new URL(req.url)
    const months = Math.min(36, Math.max(6, Number(searchParams.get('months') || 24)))
    const now = new Date()
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))

    try {
      const customers = await fetchCustomers(start.getTime())
      // solo chi ha almeno 1 ordine (clienti reali, non account vuoti)
      const buyers = customers.map(c => {
        const d = new Date(c.createdAt)
        const ageM = (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + (now.getUTCMonth() - d.getUTCMonth())
        return { ageM, orders: Math.round(num(c.numberOfOrders)), revenue: num(c.amountSpent?.amount) }
      }).filter(c => c.orders > 0 && Number.isFinite(c.ageM) && c.ageM >= 0)

      if (buyers.length < 20) {
        return NextResponse.json({ configured: true, enoughData: false, totalCustomers: buyers.length, months })
      }

      const mean = (arr, f) => arr.length ? arr.reduce((a, x) => a + f(x), 0) / arr.length : 0

      // blended (naive, tutti i clienti della finestra)
      const blendedAvgOrders = r2(mean(buyers, c => c.orders))
      const blendedLtv = r2(mean(buyers, c => c.revenue))

      // soglia di maturità: il più alto tra 12/6/3 mesi che lasci abbastanza clienti
      let maturityMonths = 12
      for (const m of [12, 6, 3]) { if (buyers.filter(c => c.ageM >= m).length >= 30) { maturityMonths = m; break }; maturityMonths = m }
      const matured = buyers.filter(c => c.ageM >= maturityMonths)
      const pool = matured.length >= 20 ? matured : buyers

      const projectedAvgOrders = r2(mean(pool, c => c.orders))
      const projectedLtvGross = r2(mean(pool, c => c.revenue))
      const aov = projectedAvgOrders > 0 ? r2(projectedLtvGross / projectedAvgOrders) : 0
      const repeatRate = Math.round(pool.filter(c => c.orders >= 2).length / pool.length * 1000) / 10

      // curva di maturazione per età (per trasparenza)
      const byAge = new Map()
      for (const c of buyers) { const k = c.ageM; if (!byAge.has(k)) byAge.set(k, []); byAge.get(k).push(c) }
      const curve = [...byAge.keys()].sort((a, b) => a - b).map(age => ({
        age, n: byAge.get(age).length,
        avgOrders: r2(mean(byAge.get(age), c => c.orders)),
        avgRevenue: r2(mean(byAge.get(age), c => c.revenue)),
      }))

      return NextResponse.json({
        configured: true, enoughData: true, months,
        projectedAvgOrders, projectedLtvGross, aov, repeatRate,
        blendedAvgOrders, blendedLtv,
        maturityMonths, maturedCustomers: matured.length, totalCustomers: buyers.length,
        curve,
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      return NextResponse.json({ configured: false, error: err?.message || 'Errore' }, { status: 200 })
    }
  })
}
