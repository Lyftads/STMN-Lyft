export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

export async function GET() {
  const ws = await resolveWorkspace()
  if (!ws || !ws.memberId) return NextResponse.json({ notifications: [], unread: 0 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ notifications: [], unread: 0 })
  try {
    const { data } = await admin
      .from('notifications')
      .select('*')
      .eq('workspace_id', ws.workspaceId)
      .eq('recipient_id', ws.memberId)
      .order('created_at', { ascending: false })
      .limit(50)
    const list = data || []
    return NextResponse.json({ notifications: list, unread: list.filter(n => !n.read).length })
  } catch (e) {
    return NextResponse.json({ notifications: [], unread: 0, error: e.message })
  }
}

// Segna come letta una notifica ({ id }) o tutte ({ all: true }).
export async function PATCH(req) {
  const ws = await resolveWorkspace()
  if (!ws || !ws.memberId) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let b = {}
  try { b = await req.json() } catch {}
  try {
    let q = admin.from('notifications').update({ read: true }).eq('workspace_id', ws.workspaceId).eq('recipient_id', ws.memberId)
    if (!b.all) {
      if (!b.id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })
      q = q.eq('id', b.id)
    }
    await q
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
