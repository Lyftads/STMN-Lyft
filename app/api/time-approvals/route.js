export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

async function myMemberId(admin, ws) {
  if (ws.memberId) return ws.memberId
  try {
    const { data } = await admin.from('team_members').select('id').eq('user_id', ws.userId).maybeSingle()
    return data?.id || null
  } catch { return null }
}

export async function GET(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ approvals: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ approvals: [] })
  const { searchParams } = new URL(req.url)
  const week = searchParams.get('week')
  try {
    let q = admin.from('time_approvals').select('*').eq('workspace_id', ws.workspaceId)
    if (week) q = q.eq('week_start', week)
    if (!ws.isAdmin) q = q.eq('member_id', await myMemberId(admin, ws))
    const { data } = await q
    return NextResponse.json({ approvals: data || [], me: { isAdmin: ws.isAdmin, memberId: await myMemberId(admin, ws) } })
  } catch (e) {
    return NextResponse.json({ approvals: [], error: e.message })
  }
}

// Approva/rifiuta (upsert). Solo Admin.
export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!ws.isAdmin) return NextResponse.json({ ok: false, error: 'Solo Admin' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let b = {}
  try { b = await req.json() } catch {}
  if (!b.member_id || !b.week_start) return NextResponse.json({ ok: false, error: 'member_id/week_start mancanti' }, { status: 400 })
  const status = b.status === 'rejected' ? 'rejected' : 'approved'
  try {
    const { data, error } = await admin.from('time_approvals').upsert({
      workspace_id: ws.workspaceId,
      member_id: b.member_id,
      week_start: b.week_start,
      status,
      note: b.note ? String(b.note).slice(0, 500) : null,
      total_seconds: b.total_seconds != null ? Math.round(Number(b.total_seconds)) : null,
      approved_by: ws.memberId,
      approved_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,member_id,week_start' }).select('*').single()
    if (error) throw error
    return NextResponse.json({ ok: true, approval: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

// Reset a "in attesa". Solo Admin.
export async function DELETE(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!ws.isAdmin) return NextResponse.json({ ok: false, error: 'Solo Admin' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  const { searchParams } = new URL(req.url)
  const member_id = searchParams.get('member_id'), week = searchParams.get('week')
  if (!member_id || !week) return NextResponse.json({ ok: false, error: 'parametri mancanti' }, { status: 400 })
  try {
    await admin.from('time_approvals').delete().eq('workspace_id', ws.workspaceId).eq('member_id', member_id).eq('week_start', week)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
