export const dynamic = 'force-dynamic'
export const maxDuration = 300 // fino a 5 min per processare tutti i tenant

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { fetchVariantsForCost, syncShopifyCosts } from '../../../../lib/cost/shopifySync'

// ============================================================================
//  Cron sync costi Shopify → storico (Costi prodotto), per TUTTI i tenant.
//  Gira in background (vercel.json): rileva i cambi di costo Shopify e li
//  registra nello storico anche per gli store che non aprono mai la tab.
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
  let totalChanged = 0
  for (const tnt of tenants) {
    try {
      const { products } = await fetchVariantsForCost(tnt.store, tnt.token)
      const changed = await syncShopifyCosts(admin, tnt.workspaceId, products)
      totalChanged += changed.size
      results.push({ workspace: tnt.workspaceId, store: tnt.store, variants: products.reduce((s, p) => s + p.variants.length, 0), changed: changed.size })
    } catch (e) {
      results.push({ workspace: tnt.workspaceId, store: tnt.store, error: String(e?.message || e) })
    }
  }

  return NextResponse.json({ ok: true, tenants: tenants.length, totalChanged, results, ranAt: new Date().toISOString() })
}
