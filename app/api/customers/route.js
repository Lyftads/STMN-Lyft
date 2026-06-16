export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getEffectiveTenantId } from '../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { swrSnapshot } from '../../../lib/cache/swr'
import { buildSnapshot, classify, isoWeekMonday, SEGMENTS, DAY } from '../../../lib/customers/rfm'

// ── Clienti (layer d'azione AI, additivo, isolato, tenant-aware) ────────────
// Segmentazione RFM/lifecycle dall'anagrafica Shopify (aggregati LIFETIME) +
// metriche per segmento + KPI + serie storica (snapshot settimanali) per i
// grafici nel tempo. Vale per QUALSIASI tenant. Read-only su Shopify.

const storeUrl = () => getShopify().storeUrl
const token = () => getShopify().adminToken

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(num(n) * 100) / 100

async function fetchCustomers() {
  if (!storeUrl() || !token()) return { customers: [], truncated: false }
  const out = []
  const gql = `query($cursor: String) {
    customers(first: 250, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      edges { node {
        displayName email numberOfOrders
        amountSpent { amount currencyCode }
        createdAt lastOrder { createdAt }
      } }
      pageInfo { hasNextPage endCursor }
    }
  }`
  let cursor = null, pages = 0, truncated = false
  const MAX_PAGES = 300 // ~75k clienti: copre l'intera base anche per store grandi
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

// Trasforma i nodi Shopify in "buyer" per buildSnapshot + tiene i campi per le
// liste campagna (name/email/lastDays).
function toBuyers(customers, now) {
  let currency = 'EUR'
  const buyers = []
  for (const c of customers) {
    const orders = Math.round(num(c.numberOfOrders))
    if (orders <= 0) continue
    const spent = num(c.amountSpent?.amount)
    if (c.amountSpent?.currencyCode) currency = c.amountSpent.currencyCode
    const firstTs = new Date(c.createdAt).getTime()
    const lastTs = new Date(c.lastOrder?.createdAt || c.createdAt).getTime()
    const lastDays = Number.isFinite(lastTs) ? Math.floor((now - lastTs) / DAY) : 9999
    const cadenceDays = orders >= 2 && Number.isFinite(firstTs) && Number.isFinite(lastTs) && lastTs > firstTs
      ? (lastTs - firstTs) / ((orders - 1) * DAY) : null
    buyers.push({
      orders, spent: r2(spent), recencyDays: lastDays, cadenceDays,
      name: c.displayName || (c.email ? c.email.split('@')[0] : 'Cliente'),
      email: c.email || null, lastDays,
    })
  }
  return { buyers, currency }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    if (!storeUrl() || !token()) {
      return NextResponse.json({ ok: false, error: 'Shopify non configurato', segments: {}, kpis: {}, series: [] }, { status: 200 })
    }
    return swrSnapshot(req, { tab: 'customers', compute: async () => {
      try {
        const now = Date.now()
        const { customers, truncated } = await fetchCustomers()
        const { buyers, currency } = toBuyers(customers, now)
        const snap = buildSnapshot(buyers)

        // Liste clienti per segmento (per le campagne) — top 200 per spesa.
        const lists = {}
        for (const k of SEGMENTS) lists[k] = []
        for (const b of buyers) {
          const key = classify(b.orders, b.recencyDays)
          lists[key].push({ name: b.name, email: b.email, orders: b.orders, spent: b.spent, lastDays: b.lastDays })
        }
        const segments = {}
        for (const k of SEGMENTS) {
          const customersList = lists[k].sort((a, b) => b.spent - a.spent).slice(0, 200)
          segments[k] = { ...snap.segments[k], customers: customersList }
        }

        // Serie storica + upsert settimana corrente (per-workspace, best effort).
        let series = []
        let deltaCustomers = null
        const wsId = await getEffectiveTenantId().catch(() => null)
        const admin = getAdminSupabase()
        const week = isoWeekMonday(now)
        if (admin && wsId) {
          const segCounts = {}
          for (const k of SEGMENTS) segCounts[k] = snap.segments[k].count
          try {
            await admin.from('customer_segment_snapshots').upsert({
              workspace_id: wsId, week,
              total_customers: snap.totalCustomers, first_time: snap.firstTime, returning: snap.returning,
              retention: snap.retention, clv: snap.clv, aov: snap.aov, orders_per_customer: snap.ordersPerCustomer,
              days_between: snap.daysBetween, segments: snap.segments, captured_at: new Date().toISOString(), source: 'live',
            }, { onConflict: 'workspace_id,week' })
          } catch {}
          try {
            const { data } = await admin.from('customer_segment_snapshots')
              .select('week,total_customers,first_time,returning,retention,clv,aov,segments')
              .eq('workspace_id', wsId).order('week', { ascending: true }).limit(70)
            series = (data || []).map(row => ({
              week: row.week,
              totalCustomers: row.total_customers,
              firstTime: row.first_time,
              returning: row.returning,
              retention: num(row.retention),
              clv: num(row.clv),
              aov: num(row.aov),
              segments: Object.fromEntries(SEGMENTS.map(k => [k, num(row.segments?.[k]?.count)])),
            }))
            if (series.length >= 2) deltaCustomers = series[series.length - 1].totalCustomers - series[series.length - 2].totalCustomers
          } catch {}
        }

        return {
          ok: true, generatedAt: new Date(now).toISOString(), truncated, currency,
          kpis: {
            totalCustomers: snap.totalCustomers, firstTime: snap.firstTime, returning: snap.returning,
            retention: snap.retention, clv: snap.clv, aov: snap.aov, ordersPerCustomer: snap.ordersPerCustomer,
            daysBetween: snap.daysBetween, ft: snap.ft, rt: snap.rt, deltaCustomers,
          },
          segments,
          series,
          hasHistory: series.length >= 2,
        }
      } catch (e) {
        return { __noCache: true, ok: false, error: e?.message || 'Errore Shopify', segments: {}, kpis: {}, series: [] }
      }
    } })
  })
}
