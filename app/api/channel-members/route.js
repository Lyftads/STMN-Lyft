export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

// Verifica che il canale sia del workspace; ritorna la riga canale o null.
async function getChannel(admin, ws, channelId) {
  if (!channelId) return null
  const { data } = await admin.from('channels').select('id, is_private').eq('id', channelId).eq('workspace_id', ws.workspaceId).maybeSingle()
  return data || null
}
async function isMember(admin, channelId, memberId) {
  if (!memberId) return false
  const { data } = await admin.from('channel_members').select('id').eq('channel_id', channelId).eq('member_id', memberId).maybeSingle()
  return !!data
}

export async function GET(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ member_ids: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ member_ids: [] })
  const { searchParams } = new URL(req.url)
  const channelId = searchParams.get('channel_id')
  if (!channelId) return NextResponse.json({ member_ids: [] })
  try {
    const { data } = await admin.from('channel_members').select('member_id').eq('channel_id', channelId)
    return NextResponse.json({ member_ids: (data || []).map(x => x.member_id) })
  } catch (e) {
    return NextResponse.json({ member_ids: [], error: e.message })
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
  const memberId = b.member_id
  if (!channelId || !memberId) return NextResponse.json({ ok: false, error: 'Dati mancanti' }, { status: 400 })
  const ch = await getChannel(admin, ws, channelId)
  if (!ch) return NextResponse.json({ ok: false, error: 'Canale non trovato' }, { status: 404 })
  // solo admin o membri del canale possono aggiungere
  if (!ws.isAdmin && !(await isMember(admin, channelId, ws.memberId))) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  }
  try {
    await admin.from('channel_members').upsert({ channel_id: channelId, member_id: memberId }, { onConflict: 'channel_id,member_id' })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

export async function DELETE(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  const { searchParams } = new URL(req.url)
  const channelId = searchParams.get('channel_id')
  const memberId = searchParams.get('member_id')
  if (!channelId || !memberId) return NextResponse.json({ ok: false, error: 'Dati mancanti' }, { status: 400 })
  // admin o membro del canale (anche per uscire da soli)
  if (!ws.isAdmin && !(await isMember(admin, channelId, ws.memberId))) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  }
  try {
    await admin.from('channel_members').delete().eq('channel_id', channelId).eq('member_id', memberId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
