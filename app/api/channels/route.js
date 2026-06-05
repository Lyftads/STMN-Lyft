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
    const { data } = await admin.from('channels').select('*').eq('workspace_id', ws.workspaceId).order('created_at', { ascending: true })
    return NextResponse.json({ channels: data || [], me: { memberId: ws.memberId, isAdmin: ws.isAdmin } })
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
  try {
    const { data, error } = await admin
      .from('channels')
      .upsert({ workspace_id: ws.workspaceId, name, created_by: ws.memberId }, { onConflict: 'workspace_id,name' })
      .select('*').single()
    if (error) throw error
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
