export const dynamic = 'force-dynamic'
export const maxDuration = 300 // fino a 5 min per processare tutti i tenant

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { isOrderGateExempt } from '../../../../lib/team/orderGateExempt'

// ============================================================================
//  Cron verifica volume ordini → aggiorna companies.verified_monthly_orders per
//  TUTTI i tenant. Ricalcola mensilmente la media reale (ordini ultimi 90gg / 3)
//  così il gate piano segue la crescita nel tempo, anche per gli store che non
//  rifanno onboarding. È la stessa logica di /api/plan-gate?action=verify, qui
//  applicata in batch. Il "verificato" resta autoritativo sul dichiarato.
//  Auth: header 'authorization: Bearer <CRON_SECRET>' (Vercel lo passa da solo).
// ============================================================================

function isAuthorized(req) {
  const auth = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  return !!secret && auth === `Bearer ${secret}`
}

function cleanStore(url) {
  return String(url || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || null
}

async function countOrders90d(store, token) {
  const since = new Date(); since.setDate(since.getDate() - 90)
  const min = since.toISOString()
  const version = process.env.SHOPIFY_API_VERSION || '2024-10'
  const url = `https://${store}/admin/api/${version}/orders/count.json?status=any&created_at_min=${encodeURIComponent(min)}`
  const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': token } })
  const j = await r.json().catch(() => ({}))
  if (r.ok && typeof j.count === 'number') return j.count
  return null
}

export async function GET(req) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  // ── Lista tenant: (workspaceId, store, token) ──
  const tenants = []
  const pushTenant = (workspaceId, store, token) => {
    store = cleanStore(store)
    if (!workspaceId || !store || !token) return
    if (tenants.some(t => t.workspaceId === workspaceId && t.store === store)) return
    tenants.push({ workspaceId, store, token })
  }

  // 1) Owner/env (STMN in env-only mode)
  pushTenant(process.env.LYFT_OWNER_USER_ID, process.env.SHOPIFY_STORE_URL, process.env.SHOPIFY_ADMIN_TOKEN)

  // 2) Clienti con creds Shopify salvate su DB (companies)
  try {
    const { data } = await admin.from('companies').select('user_id, shopify_store_url, shopify_admin_token')
    for (const c of (data || [])) pushTenant(c.user_id, c.shopify_store_url, c.shopify_admin_token)
  } catch {}

  const results = []
  let updated = 0
  for (const tnt of tenants) {
    // Clienti storici esenti (STMN owner, Saracino…): non ricalcolare.
    if (isOrderGateExempt(tnt.workspaceId)) { results.push({ workspace: tnt.workspaceId, store: tnt.store, skipped: 'exempt' }); continue }
    try {
      const count = await countOrders90d(tnt.store, tnt.token)
      if (count == null) { results.push({ workspace: tnt.workspaceId, store: tnt.store, skipped: 'no-count' }); continue }
      const verified = Math.round(count / 3)
      await admin.from('companies').update({ verified_monthly_orders: verified }).eq('user_id', tnt.workspaceId)
      updated++
      results.push({ workspace: tnt.workspaceId, store: tnt.store, verified })
    } catch (e) {
      results.push({ workspace: tnt.workspaceId, store: tnt.store, error: String(e?.message || e) })
    }
  }

  return NextResponse.json({ ok: true, tenants: tenants.length, updated, results, ranAt: new Date().toISOString() })
}
