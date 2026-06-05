export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

// Accesso al canale: pubblici sempre; privati solo admin o membri.
async function canAccess(admin, ws, channelId) {
  const { data: ch } = await admin.from('channels').select('is_private').eq('id', channelId).eq('workspace_id', ws.workspaceId).maybeSingle()
  if (!ch) return false
  if (!ch.is_private || ws.isAdmin) return true
  const { data: m } = await admin.from('channel_members').select('id').eq('channel_id', channelId).eq('member_id', ws.memberId).maybeSingle()
  return !!m
}

export async function GET(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ messages: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ messages: [] })
  const { searchParams } = new URL(req.url)
  const channelId = searchParams.get('channel_id')
  const after = searchParams.get('after')
  if (!channelId) return NextResponse.json({ messages: [] })
  try {
    let q = admin.from('channel_messages').select('*')
      .eq('workspace_id', ws.workspaceId)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(300)
    if (after) q = q.gt('created_at', after)
    const { data } = await q
    return NextResponse.json({ messages: data || [] })
  } catch (e) {
    return NextResponse.json({ messages: [], error: e.message })
  }
}

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let b = {}
  try { b = await req.json() } catch {}
  const channelId = b.channel_id
  const body = String(b.body || '').trim()
  if (!channelId || !body) return NextResponse.json({ ok: false, error: 'Dati mancanti' }, { status: 400 })

  let authorName = 'Utente'
  try {
    const { data: m } = await admin.from('team_members').select('full_name, email').eq('workspace_id', ws.workspaceId).eq('user_id', ws.userId).maybeSingle()
    if (m) authorName = m.full_name || m.email
  } catch {}

  try {
    const { data, error } = await admin
      .from('channel_messages')
      .insert({ channel_id: channelId, workspace_id: ws.workspaceId, author_id: ws.memberId, author_name: authorName, body })
      .select('*').single()
    if (error) throw error
    return NextResponse.json({ ok: true, message: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
