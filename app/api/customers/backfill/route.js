export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getEffectiveTenantId } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { buildSnapshot, isoWeekMonday, SEGMENTS, DAY } from '../../../../lib/customers/rfm'

// ── Backfill storico segmenti clienti (ricostruzione dagli ordini) ──────────
// Replay a passaggio singolo degli ordini per ricostruire gli snapshot
// settimanali PASSATI → i grafici "nel tempo" hanno subito lo storico, senza
// aspettare che il cron li accumuli. Per-tenant (workspace della sessione),
// quindi vale per QUALSIASI cliente che apre la propria tab.
//
// Tecnica: gli aggregati cliente danno il totale LIFETIME (ordini/spesa/primo
// ordine/ultimo ordine); gli ordini nella finestra danno il "quando". Per ogni
// settimana ricostruiamo n° ordini e recency di ciascun cliente a quella data.

const storeUrl = () => getShopify().storeUrl
const token = () => getShopify().adminToken
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const api = () => `https://${storeUrl()}/admin/api/2024-01/graphql.json`
const headers = () => ({ 'X-Shopify-Access-Token': token() || '', 'Content-Type': 'application/json' })

async function gql(query, variables) {
  const res = await fetch(api(), { method: 'POST', headers: headers(), body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`Shopify ${res.status}`)
  const j = await res.json()
  if (j?.errors) throw new Error(j.errors[0]?.message || 'GraphQL error')
  return j.data
}

// Aggregati lifetime per cliente (id → stato finale).
async function fetchAggregates() {
  const map = new Map()
  const q = `query($cursor: String) {
    customers(first: 250, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      edges { node { id numberOfOrders amountSpent { amount } createdAt lastOrder { createdAt } } }
      pageInfo { hasNextPage endCursor }
    }
  }`
  let cursor = null, pages = 0
  const MAX = 300
  while (pages < MAX) {
    pages++
    const d = await gql(q, { cursor })
    const conn = d?.customers
    if (!conn) break
    for (const e of (conn.edges || [])) {
      const n = e.node
      map.set(n.id, {
        firstTs: new Date(n.createdAt).getTime(),
        lifetimeLastTs: new Date(n.lastOrder?.createdAt || n.createdAt).getTime(),
        lifetimeOrders: Math.round(num(n.numberOfOrders)),
        lifetimeSpent: num(n.amountSpent?.amount),
        win: [], // ordini nella finestra: [{ts, total}]
      })
    }
    if (!conn.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
  }
  return map
}

// Ordini più recenti (DESC) fino a un cap → definiscono la finestra ricostruita.
async function fetchOrders(maxPages) {
  const orders = []
  const q = `query($cursor: String) {
    orders(first: 250, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      edges { node { createdAt customer { id } currentTotalPriceSet { shopMoney { amount } } } }
      pageInfo { hasNextPage endCursor }
    }
  }`
  let cursor = null, pages = 0, truncated = false
  while (pages < maxPages) {
    pages++
    const d = await gql(q, { cursor })
    const conn = d?.orders
    if (!conn) break
    for (const e of (conn.edges || [])) {
      const cid = e.node.customer?.id
      if (!cid) continue
      orders.push({ cid, ts: new Date(e.node.createdAt).getTime(), total: num(e.node.currentTotalPriceSet?.shopMoney?.amount) })
    }
    if (!conn.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
    if (pages >= maxPages && conn.pageInfo?.hasNextPage) truncated = true
  }
  return { orders, truncated }
}

async function runBackfill(maxOrderPages) {
  const now = Date.now()
  const base = await fetchAggregates()
  if (!base.size) return { ok: false, error: 'Nessun cliente' }
  const { orders, truncated } = await fetchOrders(maxOrderPages)

  // Assegna ordini della finestra ai clienti noti.
  let earliest = now
  for (const o of orders) {
    const c = base.get(o.cid)
    if (!c) continue
    c.win.push(o)
    if (o.ts < earliest) earliest = o.ts
  }
  // Finestra = dalla settimana del più vecchio ordine raccolto a oggi.
  const startMon = new Date(isoWeekMonday(earliest) + 'T00:00:00Z').getTime()
  const weeks = []
  for (let w = startMon; w <= now; w += 7 * DAY) weeks.push(w)
  if (weeks.length > 70) weeks.splice(0, weeks.length - 70) // cap a 70 settimane

  // Stato iniziale per cliente: ordini/spesa PRE-finestra.
  for (const c of base.values()) {
    c.win.sort((a, b) => a.ts - b.ts)
    const winSpent = c.win.reduce((s, o) => s + o.total, 0)
    c.preOrders = Math.max(0, c.lifetimeOrders - c.win.length)
    c.preSpent = Math.max(0, c.lifetimeSpent - winSpent)
    // recency iniziale: se ha ordini pre-finestra usa l'ultimo lifetime noto,
    // altrimenti il primo ordine (verrà aggiornato dagli ordini in finestra)
    c.rOrders = c.preOrders
    c.rSpent = c.preSpent
    c.rLastTs = c.preOrders > 0 ? Math.min(c.lifetimeLastTs, startMon) : c.firstTs
    c.wi = 0
  }

  const admin = getAdminSupabase()
  const wsId = await getEffectiveTenantId()
  if (!admin || !wsId) return { ok: false, error: 'Workspace/Supabase non disponibile' }

  const rows = []
  for (const wMon of weeks) {
    const wEnd = wMon + 7 * DAY - 1
    // Applica gli ordini della finestra fino a fine settimana.
    for (const c of base.values()) {
      while (c.wi < c.win.length && c.win[c.wi].ts <= wEnd) {
        c.rOrders++; c.rSpent += c.win[c.wi].total; c.rLastTs = c.win[c.wi].ts; c.wi++
      }
    }
    // Costruisci i buyer "as of" fine settimana e lo snapshot.
    const buyers = []
    for (const c of base.values()) {
      if (c.firstTs > wEnd || c.rOrders <= 0) continue
      const recencyDays = Math.floor((wEnd - c.rLastTs) / DAY)
      const cadenceDays = c.rOrders >= 2 && c.rLastTs > c.firstTs ? (c.rLastTs - c.firstTs) / ((c.rOrders - 1) * DAY) : null
      buyers.push({ orders: c.rOrders, spent: c.rSpent, recencyDays, cadenceDays })
    }
    const snap = buildSnapshot(buyers)
    rows.push({
      workspace_id: wsId, week: isoWeekMonday(wMon),
      total_customers: snap.totalCustomers, first_time: snap.firstTime, returning_count: snap.returning,
      retention: snap.retention, clv: snap.clv, aov: snap.aov, orders_per_customer: snap.ordersPerCustomer,
      days_between: snap.daysBetween, segments: snap.segments, captured_at: new Date().toISOString(), source: 'backfill',
    })
  }

  // Upsert a blocchi (la settimana corrente 'live' verrà sovrascritta: ok).
  for (let i = 0; i < rows.length; i += 50) {
    await admin.from('customer_segment_snapshots').upsert(rows.slice(i, i + 50), { onConflict: 'workspace_id,week' })
  }

  return { ok: true, weeks: rows.length, customers: base.size, orders: orders.length, truncatedOrders: truncated, from: rows[0]?.week, to: rows[rows.length - 1]?.week }
}

async function handler(req) {
  return withTenantContext(req, async () => {
    if (!storeUrl() || !token()) return NextResponse.json({ ok: false, error: 'Shopify non configurato' }, { status: 200 })
    const { searchParams } = new URL(req.url)
    const maxOrderPages = Math.min(400, Math.max(20, Number(searchParams.get('pages') || 200)))
    try {
      const out = await runBackfill(maxOrderPages)
      return NextResponse.json(out, { status: 200 })
    } catch (e) {
      return NextResponse.json({ ok: false, error: e?.message || 'Errore backfill' }, { status: 200 })
    }
  })
}

export const POST = handler
export const GET = handler
