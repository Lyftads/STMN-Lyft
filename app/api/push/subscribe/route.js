export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { resolveWorkspace } from '../../../../lib/team/workspace'

// GET → chiave pubblica VAPID per il client (e se il push è abilitato).
export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || ''
  return NextResponse.json({ publicKey, enabled: !!publicKey })
}

// POST → salva la sottoscrizione push del device per il membro corrente.
export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let b = {}
  try { b = await req.json() } catch {}
  const sub = b.subscription
  if (!sub?.endpoint) return NextResponse.json({ ok: false, error: 'subscription mancante' }, { status: 400 })
  try {
    await admin.from('push_subscriptions').upsert(
      { workspace_id: ws.workspaceId, member_id: ws.memberId, endpoint: sub.endpoint, subscription: sub },
      { onConflict: 'endpoint' }
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

export async function DELETE(req) {
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  const { searchParams } = new URL(req.url)
  const endpoint = searchParams.get('endpoint')
  if (!endpoint) return NextResponse.json({ ok: false }, { status: 400 })
  try {
    await admin.from('push_subscriptions').delete().eq('endpoint', endpoint)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
