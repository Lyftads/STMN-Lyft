export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'

// ── Clienti (layer d'azione AI, additivo, isolato, tenant-aware) ────────────
// Anagrafica clienti da Admin GraphQL `customers` (aggregati LIFETIME) +
// segmenti automatici intelligenti per attivare campagne in 1 click.
//   - VIP            → alto valore, ancora attivi
//   - A rischio      → repeat che stanno rallentando (60–180gg dall'ultimo ordine)
//   - Win-back       → persi (>180gg dall'ultimo ordine)
//   - Da convertire  → one-time recenti da spingere al 2° ordine
// Nessun limite 60gg: gli aggregati `lastOrder/amountSpent/numberOfOrders` sono
// storici. Read-only, multi-tenant come il resto.

const storeUrl = () => getShopify().storeUrl
const token = () => getShopify().adminToken

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(num(n) * 100) / 100
const DAY = 86400000

// Soglie lifecycle (giorni dall'ultimo ordine)
const AT_RISK_MIN = 60
const AT_RISK_MAX = 180   // oltre → win-back (perso)
const CONVERT_MAX = 120   // one-time entro 120gg → ancora "caldo"

async function fetchCustomers() {
  if (!storeUrl() || !token()) return { customers: [], truncated: false }
  const out = []
  const gql = `query($cursor: String) {
    customers(first: 250, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      edges { node {
        id
        displayName
        email
        numberOfOrders
        amountSpent { amount currencyCode }
        createdAt
        lastOrder { createdAt }
      } }
      pageInfo { hasNextPage endCursor }
    }
  }`
  let cursor = null
  let pages = 0
  const MAX_PAGES = 40 // ~10k clienti: copre l'intera base per la maggior parte degli store
  let truncated = false
  while (pages < MAX_PAGES) {
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
    for (const e of (conn.edges || [])) out.push(e.node)
    if (!conn.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
    if (pages >= MAX_PAGES && conn.pageInfo?.hasNextPage) truncated = true
  }
  return { customers: out, truncated }
}

// p-esimo percentile su array di numeri
function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return 0
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1))
  return sortedAsc[idx]
}

function compute(customers) {
  const now = Date.now()
  let currency = 'EUR'
  const buyers = []
  for (const c of customers) {
    const orders = Math.round(num(c.numberOfOrders))
    if (orders <= 0) continue // solo account, niente acquisti
    const spent = num(c.amountSpent?.amount)
    if (c.amountSpent?.currencyCode) currency = c.amountSpent.currencyCode
    const lastIso = c.lastOrder?.createdAt || c.createdAt
    const lastTs = new Date(lastIso).getTime()
    const lastDays = Number.isFinite(lastTs) ? Math.floor((now - lastTs) / DAY) : 9999
    buyers.push({
      name: c.displayName || (c.email ? c.email.split('@')[0] : 'Cliente'),
      email: c.email || null,
      orders,
      spent: r2(spent),
      lastDays,
    })
  }

  // Soglia VIP = P90 della spesa fra i repeat buyer (fallback: P75 di tutti)
  const repeatSpends = buyers.filter(b => b.orders >= 2).map(b => b.spent).sort((a, b) => a - b)
  const allSpends = buyers.map(b => b.spent).sort((a, b) => a - b)
  const vipThreshold = repeatSpends.length >= 8 ? percentile(repeatSpends, 90) : percentile(allSpends, 90)
  const globalAov = buyers.length ? r2(allSpends.reduce((s, v) => s + v, 0) / buyers.reduce((s, b) => s + b.orders, 0)) : 0

  const segs = {
    vip:     { key: 'vip', count: 0, value: 0, customers: [] },
    atRisk:  { key: 'atRisk', count: 0, value: 0, customers: [] },
    winback: { key: 'winback', count: 0, value: 0, customers: [] },
    convert: { key: 'convert', count: 0, value: 0, potential: 0, customers: [] },
  }
  const push = (seg, b) => { seg.count++; seg.value = r2(seg.value + b.spent); if (seg.customers.length < 200) seg.customers.push(b) }

  for (const b of buyers) {
    // Lifecycle (mutuamente esclusivi per lo stato di vita)
    if (b.lastDays > AT_RISK_MAX) push(segs.winback, b)
    else if (b.orders >= 2 && b.lastDays >= AT_RISK_MIN) push(segs.atRisk, b)
    else if (b.orders === 1 && b.lastDays <= CONVERT_MAX) push(segs.convert, b)
    // VIP = tier di valore, overlay (può essere anche a rischio): solo se ancora vivo
    if (b.orders >= 2 && b.spent >= vipThreshold && b.lastDays <= AT_RISK_MAX) push(segs.vip, b)
  }
  // Ordina ogni lista per spesa desc (i più importanti in cima)
  for (const k of Object.keys(segs)) segs[k].customers.sort((a, b) => b.spent - a.spent)
  segs.convert.potential = r2(segs.convert.count * globalAov)

  return {
    currency,
    totalCustomers: customers.length,
    buyers: buyers.length,
    vipThreshold: r2(vipThreshold),
    globalAov,
    segments: segs,
  }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    if (!storeUrl() || !token()) {
      return NextResponse.json({ ok: false, error: 'Shopify non configurato', segments: {} }, { status: 200 })
    }
    return swrSnapshot(req, { tab: 'customers', compute: async () => {
      try {
        const { customers, truncated } = await fetchCustomers()
        return { ok: true, generatedAt: new Date().toISOString(), truncated, ...compute(customers) }
      } catch (e) {
        return { __noCache: true, ok: false, error: e?.message || 'Errore Shopify', segments: {} }
      }
    } })
  })
}
