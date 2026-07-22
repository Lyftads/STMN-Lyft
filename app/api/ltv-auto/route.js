export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'

// ============================================================================
//  LTV automatico per-tenant — proiezione a maturità dai dati Shopify reali.
//
//  Gli ordini-a-vita per cliente si stimano sui clienti "maturi" (acquisiti da
//  ≥ maturityMonths): i nuovi non hanno avuto tempo di riordinare (censoring)
//  e schiaccerebbero la media.
//
//  FIX store grandi (22 lug 2026): prima si scaricavano TUTTI i clienti della
//  finestra (nuovi per primi) con cap a 80 pagine → sugli store con decine di
//  migliaia di clienti il cap/i timeout TAGLIAVANO proprio le coorti mature
//  (le migliori) e la maturità degradava in silenzio a 6/3 mesi → media
//  sottostimata. Ora si interroga DIRETTAMENTE la coorte matura col filtro
//  created_at (una frazione delle pagine), con fallback progressivo 12→6→3
//  esplicito e flag `partial` se una lettura si interrompe. Cache per-istanza
//  6h (route chiamata da Dashboard, tab LTV e Simulatore).
// ============================================================================

const storeUrl = () => getShopify().storeUrl
const token = () => getShopify().adminToken
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(num(n) * 100) / 100
const mean = (arr, f) => arr.length ? arr.reduce((a, x) => a + f(x), 0) / arr.length : 0
const iso = (d) => d.toISOString().slice(0, 10)

// Clienti creati in [from, to) — filtro server-side, pagine solo per il range.
// GOTCHA Shopify: sulla connection customers il filtro data si chiama
// `customer_date` — `created_at` viene IGNORATO in silenzio (testato).
async function fetchCustomersRange(fromIso, toIso, maxPages = 100) {
  const out = []
  let partial = false
  const q = `customer_date:>=${fromIso} customer_date:<${toIso}`
  const gql = `query($cursor: String, $q: String) {
    customers(first: 250, after: $cursor, query: $q, sortKey: CREATED_AT, reverse: true) {
      edges { node { createdAt numberOfOrders amountSpent { amount } } }
      pageInfo { hasNextPage endCursor }
    }
  }`
  let cursor = null, pages = 0
  while (pages < maxPages) {
    pages++
    const res = await fetch(`https://${storeUrl()}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token() || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gql, variables: { cursor, q } }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) { if (pages === 1) throw new Error(`Shopify ${res.status}`); partial = true; break }
    const j = await res.json()
    const conn = j?.data?.customers
    if (!conn) { if (pages === 1 && j?.errors) throw new Error(j.errors[0]?.message || 'GraphQL error'); partial = true; break }
    for (const e of (conn.edges || [])) out.push(e.node)
    if (!conn.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
    if (pages === maxPages) partial = true
  }
  return { customers: out, partial }
}

const toBuyers = (customers, now) => customers.map(c => {
  const d = new Date(c.createdAt)
  const ageM = (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + (now.getUTCMonth() - d.getUTCMonth())
  return { ageM, orders: Math.round(num(c.numberOfOrders)), revenue: num(c.amountSpent?.amount) }
}).filter(c => c.orders > 0 && Number.isFinite(c.ageM) && c.ageM >= 0)

// Cache per-istanza (il calcolo pagina su Shopify): TTL 6h, keyed store+mesi.
const cache = new Map()
const TTL_MS = 6 * 3600e3

export async function GET(req) {
  return withTenantContext(req, async () => {
    if (!storeUrl() || !token()) return NextResponse.json({ configured: false, error: 'Shopify non configurato' }, { status: 200 })

    const { searchParams } = new URL(req.url)
    const months = Math.min(36, Math.max(6, Number(searchParams.get('months') || 24)))
    const key = `${storeUrl()}|${months}`
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.payload)

    const now = new Date()
    const startIso = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1)))
    // ageM >= m  ⇔  creato prima del primo giorno del mese (corrente − m + 1)
    const cutoffIso = (m) => iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m + 1, 1)))

    try {
      // Coorte matura direttamente dal filtro: 12 → 6 → 3 mesi, estendendo il
      // range solo se gli acquirenti non bastano (≥20).
      let buyers = []
      let partial = false
      let maturityMonths = 12
      let prevCut = startIso
      for (const m of [12, 6, 3]) {
        const to = cutoffIso(m)
        if (to > prevCut) {
          const r = await fetchCustomersRange(prevCut, to)
          buyers = buyers.concat(toBuyers(r.customers, now))
          partial = partial || r.partial
          prevCut = to
        }
        maturityMonths = m
        if (buyers.length >= 20) break
      }
      // Ultimo fallback (store piccolissimi): includi anche i recenti (<3 mesi).
      if (buyers.length < 20) {
        const r = await fetchCustomersRange(prevCut, iso(new Date(Date.now() + 86400e3)))
        buyers = buyers.concat(toBuyers(r.customers, now))
        partial = partial || r.partial
        maturityMonths = 0
      }

      if (buyers.length < 20) {
        const payload = { configured: true, enoughData: false, totalCustomers: buyers.length, months }
        cache.set(key, { at: Date.now(), payload })
        return NextResponse.json(payload)
      }

      const pool = buyers
      const projectedAvgOrders = r2(mean(pool, c => c.orders))
      const projectedLtvGross = r2(mean(pool, c => c.revenue))
      const aov = projectedAvgOrders > 0 ? r2(projectedLtvGross / projectedAvgOrders) : 0
      const repeatRate = Math.round(pool.filter(c => c.orders >= 2).length / pool.length * 1000) / 10

      // Curva di maturazione per età (trasparenza sul censoring)
      const byAge = new Map()
      for (const c of pool) { const k = c.ageM; if (!byAge.has(k)) byAge.set(k, []); byAge.get(k).push(c) }
      const curve = [...byAge.keys()].sort((a, b) => a - b).map(age => ({
        age, n: byAge.get(age).length,
        avgOrders: r2(mean(byAge.get(age), c => c.orders)),
        avgRevenue: r2(mean(byAge.get(age), c => c.revenue)),
      }))

      const payload = {
        configured: true, enoughData: true, months,
        projectedAvgOrders, projectedLtvGross, aov, repeatRate,
        // compat: i campi "blended" non sono più calcolati (nessuna UI li usa)
        blendedAvgOrders: null, blendedLtv: null,
        maturityMonths, maturedCustomers: pool.length, totalCustomers: pool.length,
        partial,
        curve,
        updatedAt: new Date().toISOString(),
      }
      cache.set(key, { at: Date.now(), payload })
      return NextResponse.json(payload)
    } catch (err) {
      return NextResponse.json({ configured: false, error: err?.message || 'Errore' }, { status: 200 })
    }
  })
}
