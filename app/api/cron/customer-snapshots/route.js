export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { buildSnapshot, isoWeekMonday, DAY } from '../../../../lib/customers/rfm'
import { fetchAllCustomersBulk } from '../../../../lib/customers/bulk'

// ============================================================================
//  Cron snapshot settimanale dei segmenti clienti, per TUTTI i tenant.
//  Salva una riga (workspace, settimana corrente) anche per gli store che non
//  aprono mai la tab → i grafici "nel tempo" si popolano per ogni cliente.
//  Auth: 'authorization: Bearer <CRON_SECRET>' (Vercel lo passa da solo).
// ============================================================================

function isAuthorized(req) {
  const auth = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  return !!secret && auth === `Bearer ${secret}`
}
const cleanStore = (url) => String(url || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || null
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(num(n) * 100) / 100

function nodeToBuyer(n, now) {
  const orders = Math.round(num(n.numberOfOrders))
  if (orders <= 0) return null
  const firstTs = new Date(n.createdAt).getTime()
  const lastTs = new Date(n.lastOrder?.createdAt || n.createdAt).getTime()
  const recencyDays = Number.isFinite(lastTs) ? Math.floor((now - lastTs) / DAY) : 9999
  const cadenceDays = orders >= 2 && lastTs > firstTs ? (lastTs - firstTs) / ((orders - 1) * DAY) : null
  return { orders, spent: r2(num(n.amountSpent?.amount)), recencyDays, cadenceDays }
}

// Paginazione resiliente (fallback se il bulk non è disponibile).
async function fetchBuyersPaged(store, tk) {
  const out = []
  const q = `query($cursor: String) {
    customers(first: 250, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      edges { node { numberOfOrders amountSpent { amount } createdAt lastOrder { createdAt } } }
      pageInfo { hasNextPage endCursor }
    }
  }`
  let cursor = null, pages = 0
  const MAX = 320, now = Date.now(), deadline = now + 130000
  while (pages < MAX && Date.now() < deadline) {
    pages++
    const res = await fetch(`https://${store}/admin/api/2024-01/graphql.json`, {
      method: 'POST', headers: { 'X-Shopify-Access-Token': tk, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, variables: { cursor } }), signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) { if (pages === 1) throw new Error(`Shopify ${res.status}`); break }
    const j = await res.json()
    const conn = j?.data?.customers
    if (!conn) break
    for (const e of (conn.edges || [])) { const b = nodeToBuyer(e.node, now); if (b) out.push(b) }
    if (!conn.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
  }
  return out
}

async function fetchBuyers(store, tk) {
  const now = Date.now()
  try {
    const nodes = await fetchAllCustomersBulk(store, tk, now + 120000)
    const buyers = []
    for (const n of nodes) { const b = nodeToBuyer(n, now); if (b) buyers.push(b) }
    return buyers
  } catch {
    return fetchBuyersPaged(store, tk)
  }
}

export async function GET(req) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  const tenants = []
  const pushTenant = (workspaceId, store, tk) => {
    store = cleanStore(store)
    if (!workspaceId || !store || !tk) return
    if (tenants.some(t => t.workspaceId === workspaceId && t.store === store)) return
    tenants.push({ workspaceId, store, token: tk })
  }
  pushTenant(process.env.LYFT_OWNER_USER_ID, process.env.SHOPIFY_STORE_URL, process.env.SHOPIFY_ADMIN_TOKEN)
  try {
    const { data } = await admin.from('companies').select('user_id, shopify_store_url, shopify_admin_token')
    for (const c of (data || [])) pushTenant(c.user_id, c.shopify_store_url, c.shopify_admin_token)
  } catch {}

  const week = isoWeekMonday(Date.now())
  const results = []
  for (const t of tenants) {
    try {
      const buyers = await fetchBuyers(t.store, t.token)
      const snap = buildSnapshot(buyers)
      await admin.from('customer_segment_snapshots').upsert({
        workspace_id: t.workspaceId, week,
        total_customers: snap.totalCustomers, first_time: snap.firstTime, returning_count: snap.returning,
        retention: snap.retention, clv: snap.clv, aov: snap.aov, orders_per_customer: snap.ordersPerCustomer,
        days_between: snap.daysBetween, segments: snap.segments, captured_at: new Date().toISOString(), source: 'cron',
      }, { onConflict: 'workspace_id,week' })
      results.push({ workspace: t.workspaceId, store: t.store, customers: snap.totalCustomers })
    } catch (e) {
      results.push({ workspace: t.workspaceId, store: t.store, error: String(e?.message || e) })
    }
  }
  return NextResponse.json({ ok: true, week, tenants: tenants.length, results })
}
