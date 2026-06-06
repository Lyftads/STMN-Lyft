export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

const TYPES = ['ferie', 'permesso', 'malattia']

async function resolveMember(admin, ws) {
  try {
    if (ws.memberId) {
      const { data } = await admin.from('team_members').select('id, full_name, email').eq('id', ws.memberId).maybeSingle()
      return { id: ws.memberId, name: data?.full_name || data?.email || 'Utente' }
    }
    const { data } = await admin.from('team_members').select('id, full_name, email').eq('user_id', ws.userId).maybeSingle()
    if (data) return { id: data.id, name: data.full_name || data.email || 'Owner' }
  } catch {}
  return { id: ws.memberId || null, name: 'Owner' }
}

export async function GET() {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ requests: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ requests: [] })
  const me = await resolveMember(admin, ws)
  try {
    let q = admin.from('time_off').select('*').eq('workspace_id', ws.workspaceId).order('start_date', { ascending: false })
    if (!ws.isAdmin) q = q.eq('member_id', me.id)
    const { data } = await q
    return NextResponse.json({ requests: data || [], me: { memberId: me.id, isAdmin: ws.isAdmin } })
  } catch (e) {
    return NextResponse.json({ requests: [], error: e.message })
  }
}

// Crea una richiesta (il membro per sé; l'Admin può crearla per chiunque).
export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let b = {}
  try { b = await req.json() } catch {}
  const me = await resolveMember(admin, ws)
  if (!b.start_date || !b.end_date) return NextResponse.json({ ok: false, error: 'Date mancanti' }, { status: 400 })
  const type = TYPES.includes(b.type) ? b.type : 'ferie'
  const member_id = (ws.isAdmin && b.member_id) ? b.member_id : me.id
  let member_name = me.name
  if (member_id !== me.id) {
    try { const { data } = await admin.from('team_members').select('full_name, email').eq('id', member_id).maybeSingle(); member_name = data?.full_name || data?.email || null } catch {}
  }
  try {
    const { data, error } = await admin.from('time_off').insert({
      workspace_id: ws.workspaceId, member_id, member_name, type,
      start_date: b.start_date, end_date: b.end_date,
      note: b.note ? String(b.note).slice(0, 500) : null,
      // l'Admin che crea la richiesta la approva direttamente
      status: ws.isAdmin ? 'approved' : 'pending',
      approved_by: ws.isAdmin ? me.id : null,
      approved_at: ws.isAdmin ? new Date().toISOString() : null,
    }).select('*').single()
    if (error) throw error
    return NextResponse.json({ ok: true, request: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

// Approva/rifiuta. Solo Admin.
export async function PATCH(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!ws.isAdmin) return NextResponse.json({ ok: false, error: 'Solo Admin' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let b = {}
  try { b = await req.json() } catch {}
  if (!b.id || !['approved', 'rejected', 'pending'].includes(b.status)) return NextResponse.json({ ok: false, error: 'parametri non validi' }, { status: 400 })
  const me = await resolveMember(admin, ws)
  try {
    await admin.from('time_off').update({
      status: b.status,
      approved_by: b.status === 'pending' ? null : me.id,
      approved_at: b.status === 'pending' ? null : new Date().toISOString(),
    }).eq('id', b.id).eq('workspace_id', ws.workspaceId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

// Elimina: il membro la propria richiesta, l'Admin qualsiasi.
export async function DELETE(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })
  const me = await resolveMember(admin, ws)
  try {
    let q = admin.from('time_off').delete().eq('id', id).eq('workspace_id', ws.workspaceId)
    if (!ws.isAdmin) q = q.eq('member_id', me.id)
    await q
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
