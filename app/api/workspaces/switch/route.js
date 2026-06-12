export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getCurrentUserId } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// Imposta il workspace attivo (cookie active_workspace) dopo aver verificato
// che l'utente abbia accesso (proprio account o cliente mappato). Anti-leak.
export async function POST(req) {
  const uid = await getCurrentUserId()
  if (!uid) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body = {}
  try { body = await req.json() } catch {}
  const workspaceId = String(body.workspaceId || '').trim()
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId mancante' }, { status: 400 })

  let ok = workspaceId === uid
  if (!ok) {
    const admin = getAdminSupabase()
    if (admin) {
      const { data } = await admin
        .from('agency_clients')
        .select('id')
        .eq('agency_user_id', uid)
        .eq('client_user_id', workspaceId)
        .maybeSingle()
      ok = !!data
    }
  }
  if (!ok) return NextResponse.json({ error: 'Accesso non autorizzato a questo workspace' }, { status: 403 })

  const res = NextResponse.json({ ok: true, activeId: workspaceId })
  res.cookies.set('active_workspace', workspaceId, {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
