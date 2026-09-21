export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'
import { fetchAllCustomersBulk } from '../../../lib/customers/bulk'

// ── LTV & Coorti (additivo, isolato, tenant-aware) ──────────────────────────
// Usa la Admin GraphQL `customers` (aggregati LIFETIME: createdAt, numberOfOrders,
// amountSpent) → storico completo, NON soggetta al limite 60gg della Orders API.
// Coorti per mese di ACQUISIZIONE: dimensione, repeat rate, ordini/cliente, LTV.

const storeUrl = () => getShopify().storeUrl
const token = () => getShopify().adminToken

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(num(n) * 100) / 100

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

// I clienti acquisiti nella finestra, TUTTI.
//
// Prima: 80 pagine da 250 dai piu' recenti = 20.000 account (compresi quelli senza ordini), poi
// stop. Su Saracino (21 set 2026) con 12 e con 24 mesi uscivano gli stessi ~14.500 clienti: le
// coorti piu' vecchie mancavano e il CAC della tab (spesa di TUTTA la finestra ÷ clienti letti)
// usciva gonfiato. E se Shopify rifiutava una pagina ("throttled") ci si fermava senza dirlo.
// Ora: l'operazione bulk di Shopify (la stessa della tab Clienti: tutti i clienti in un file, senza
// pagine ne' limiti). Solo se non riesce si ripiega sulle pagine, e ogni interruzione e' dichiarata.
async function fetchCustomers(startTs) {
  if (!storeUrl() || !token()) return { customers: [], truncated: false }
  try {
    const tutti = await fetchAllCustomersBulk(storeUrl(), token(), Date.now() + 200000)
    const customers = tutti.filter(c => { const ts = new Date(c.createdAt).getTime(); return Number.isFinite(ts) && ts >= startTs })
    return { customers, truncated: false }
  } catch (e) { console.log('[ltv-cohorts] bulk non riuscita, ripiego sulle pagine:', e?.message) }

  const out = []
  // Più recenti prima: così raccolgo solo la finestra e mi fermo appena
  // arrivo a clienti più vecchi dell'inizio periodo.
  const gql = `query($cursor: String) {
    customers(first: 250, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      edges { node { createdAt numberOfOrders amountSpent { amount } } }
      pageInfo { hasNextPage endCursor }
    }
  }`
  const attendi = (ms) => new Promise(r => setTimeout(r, ms))
  let cursor = null
  let pages = 0
  const MAX_PAGES = 400
  const scadenza = Date.now() + 200000
  let truncated = false
  let done = false
  while (!done) {
    if (pages >= MAX_PAGES || Date.now() > scadenza) { truncated = true; break }
    pages++
    let conn = null
    for (let tentativo = 1; tentativo <= 4 && !conn; tentativo++) {
      const res = await fetch(`https://${storeUrl()}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token() || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: gql, variables: { cursor } }),
        signal: AbortSignal.timeout(20000),
      }).catch(() => null)
      const j = res?.ok ? await res.json().catch(() => null) : null
      conn = j?.data?.customers || null
      if (conn) break
      if (pages === 1 && tentativo === 4) throw new Error(j?.errors?.[0]?.message || `Shopify ${res?.status || 'rete'}`)
      await attendi(1500 * tentativo)   // "throttled" arriva come 200 con errors: si aspetta e si riprova
    }
    if (!conn) { truncated = true; break }
    for (const e of (conn.edges || [])) {
      const ts = new Date(e.node.createdAt).getTime()
      if (Number.isFinite(ts) && ts < startTs) { done = true; break } // più vecchio della finestra → stop
      out.push(e.node)
    }
    if (done || !conn.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
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

    // tab key versionata 'ltvCohorts2': invalida snapshot vecchi (es. calcolati
    // sotto la chiave owner prima del fix cache per-tenant).
    return swrSnapshot(req, { tab: 'ltvCohortsTutti@1', ttlMs: 2 * 60 * 60 * 1000, compute: async () => {
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

      return {
        months, since: sinceStr, truncated,
        summary, cohorts, distribution,
        updatedAt: new Date().toISOString(),
      }
    } catch (err) {
      return { __noCache: true, error: err?.message || 'Errore', cohorts: [] }
    }
    } })
  })
}
