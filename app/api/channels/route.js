export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

async function ensureDefault(admin, ws) {
  try {
    const { data } = await admin.from('channels').select('id').eq('workspace_id', ws.workspaceId).limit(1)
    if (!data || data.length === 0) {
      await admin.from('channels').insert({ workspace_id: ws.workspaceId, name: 'generale', created_by: ws.memberId })
    }
  } catch {}
}

export async function GET() {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ channels: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ channels: [] })
  await ensureDefault(admin, ws)
  try {
    const { data: all } = await admin.from('channels').select('*').eq('workspace_id', ws.workspaceId).order('created_at', { ascending: true })
    // membership dei canali privati per il membro corrente
    let memberOf = new Set()
    try {
      const { data: cms } = await admin.from('channel_members').select('channel_id').eq('member_id', ws.memberId)
      memberOf = new Set((cms || []).map(x => x.channel_id))
    } catch {}
    // visibili: pubblici + privati di cui sei membro (l'admin vede tutto)
    const channels = (all || []).filter(c => !c.is_private || ws.isAdmin || memberOf.has(c.id))
    return NextResponse.json({ channels, me: { memberId: ws.memberId, isAdmin: ws.isAdmin } })
  } catch (e) {
    return NextResponse.json({ channels: [], error: e.message })
  }
}

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let b = {}
  try { b = await req.json() } catch {}
  const name = String(b.name || '').trim().toLowerCase().replace(/[^a-z0-9\-_]+/g, '-').replace(/^-+|-+$/g, '')
  if (!name) return NextResponse.json({ ok: false, error: 'Nome non valido' }, { status: 400 })
  const isPrivate = !!b.is_private
  const memberIds = Array.isArray(b.member_ids) ? b.member_ids.filter(Boolean) : []
  try {
    const { data, error } = await admin
      .from('channels')
      .upsert({ workspace_id: ws.workspaceId, name, is_private: isPrivate, created_by: ws.memberId }, { onConflict: 'workspace_id,name' })
      .select('*').single()
    if (error) throw error
    if (isPrivate) {
      const ids = [...new Set([ws.memberId, ...memberIds].filter(Boolean))]
      const rows = ids.map(id => ({ channel_id: data.id, member_id: id }))
      if (rows.length) await admin.from('channel_members').upsert(rows, { onConflict: 'channel_id,member_id' })
    }
    return NextResponse.json({ ok: true, channel: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

export async function DELETE(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!ws.isAdmin) return NextResponse.json({ ok: false, error: 'Solo Admin' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })
  try {
    await admin.from('channels').delete().eq('id', id).eq('workspace_id', ws.workspaceId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
