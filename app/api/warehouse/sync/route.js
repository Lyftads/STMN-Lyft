export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getTenantInfo } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { syncShopifyOrders } from '../../../../lib/warehouse/syncShopify'

// ============================================================================
//  Sync job warehouse (Shopify, incrementale). INERTE finché LYFT_WAREHOUSE
//  !== 'true' → nessun effetto sul comportamento attuale. Autorizzato col
//  CRON_SECRET. Sincronizza il tenant del contesto corrente (STMN via env →
//  tenant_id = LYFT_OWNER_USER_ID; multi-tenant → company user_id).
//  Trigger: cron (Vercel/interno) POST con header x-internal-cron: <CRON_SECRET>.
// ============================================================================

function authorized(req) {
  const s = process.env.CRON_SECRET
  if (!s) return false
  const h = req.headers
  return h.get('authorization') === `Bearer ${s}` || h.get('x-internal-cron') === s
}

export async function POST(req) {
  if (process.env.LYFT_WAREHOUSE !== 'true') {
    return NextResponse.json({ ok: false, disabled: true, reason: 'LYFT_WAREHOUSE non attivo' })
  }
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  return withTenantContext(req, async () => {
    const admin = getAdminSupabase()
    const shopify = getShopify()
    const tenantId = getTenantInfo().userId || process.env.LYFT_OWNER_USER_ID || null
    if (!admin || !tenantId || !shopify?.storeUrl || !shopify?.adminToken) {
      return NextResponse.json({ ok: false, error: 'tenant o credenziali Shopify mancanti' }, { status: 400 })
    }

    // Cursore (watermark updated_at) del run precedente.
    const { data: st } = await admin.from('wh_sync_state')
      .select('cursor').eq('tenant_id', tenantId).eq('source', 'shopify').maybeSingle()

    let r
    try {
      r = await syncShopifyOrders({ admin, tenantId, shopify, since: st?.cursor || null })
    } catch (e) {
      return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
    }

    if (r.ok) {
      await admin.from('wh_sync_state').upsert({
        tenant_id: tenantId, source: 'shopify',
        cursor: r.cursor, last_synced_at: new Date().toISOString(), last_rows: r.rows,
      }, { onConflict: 'tenant_id,source' })
    }
    return NextResponse.json(r)
  })
}
