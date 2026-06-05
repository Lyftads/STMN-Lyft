export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

// Heartbeat presenza: aggiorna last_seen_at del membro corrente.
export async function POST() {
  const ws = await resolveWorkspace()
  if (!ws || !ws.memberId) return NextResponse.json({ ok: false })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  try {
    await admin.from('team_members').update({ last_seen_at: new Date().toISOString() }).eq('id', ws.memberId).eq('workspace_id', ws.workspaceId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
