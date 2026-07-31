export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getCurrentUserId } from '../../../../../lib/tenant/credentials'
import { verifyCallToken } from '../../../../../lib/agent/callToken'
import { getAdminSupabase } from '../../../../../lib/supabase/server'
import { buildBrief } from '../../../../../lib/agent/brandSnapshot'

// ============================================================================
//  Sonda di verifica della voce per-tenant (SOLO owner).
//  POST { token } → dice QUALE workspace risolve quel token e quali dati
//  vedrebbe l'agente in call (prime righe del brief), senza avviare una call.
//  Serve a provare che un cliente in call sente i PROPRI numeri.
// ============================================================================

export async function POST(req) {
  const me = await getCurrentUserId().catch(() => null)
  if (!me || me !== process.env.LYFT_OWNER_USER_ID) {
    return NextResponse.json({ error: 'solo owner' }, { status: 403 })
  }
  let body = {}
  try { body = await req.json() } catch {}
  const ws = verifyCallToken(body.token)
  if (!ws) return NextResponse.json({ ok: false, reason: 'token non valido o scaduto' })

  const admin = getAdminSupabase()
  const { data: co } = await admin.from('companies').select('company_name').eq('user_id', ws).maybeSingle()
  const { data: row } = await admin.from('call_context').select('data, updated_at').eq('workspace_id', ws).maybeSingle()
  const brief = row?.data ? buildBrief(row.data) : null

  return NextResponse.json({
    ok: true,
    workspace: ws,
    company: co?.company_name || null,
    snapshot: row ? { updatedAt: row.updated_at, briefPreview: String(brief || '').slice(0, 700) } : null,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
