export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUserId, getEffectiveTenantId } from '../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../lib/supabase/server'

// Diagnostica risoluzione tenant (owner-only): mostra la catena reale →
// effective per capire perché lo switch agency risolve o no. Read-only.
export async function GET() {
  const realUid = await getCurrentUserId().catch(() => null)
  if (!realUid) return NextResponse.json({ error: 'not logged in' }, { status: 401 })
  const owner = process.env.LYFT_OWNER_USER_ID || null
  if (!owner || realUid !== owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let activeWorkspace = null
  try { activeWorkspace = cookies().get('active_workspace')?.value || null } catch {}
  const effectiveTenantId = await getEffectiveTenantId().catch(() => null)

  const admin = getAdminSupabase()
  let agencyClients = [], activeRow = null
  if (admin) {
    try {
      const { data } = await admin.from('agency_clients').select('client_user_id, label').eq('agency_user_id', realUid)
      agencyClients = (data || []).map(m => ({ id: m.client_user_id, label: m.label }))
    } catch (e) { agencyClients = [{ error: (e?.message || '').slice(0, 120) }] }
    if (activeWorkspace) {
      try {
        const { data } = await admin.from('companies').select('user_id, company_name, is_beta, is_client_workspace, plan, shopify_store_url').eq('user_id', activeWorkspace).maybeSingle()
        activeRow = data ? { ...data, shopify_store_url: data.shopify_store_url ? 'set' : null } : null
      } catch {}
    }
  }

  return NextResponse.json({
    realUid,
    isOwnerEnv: realUid === owner,
    multiTenant: process.env.LYFT_MULTI_TENANT === 'true',
    activeWorkspace,
    effectiveTenantId,
    resolvedToClient: !!effectiveTenantId && effectiveTenantId !== realUid,
    activeIsAuthorized: !!agencyClients.find(c => c.id === activeWorkspace),
    agencyClients,
    activeRow,
  })
}
