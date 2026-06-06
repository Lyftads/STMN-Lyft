export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

export async function GET() {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ projects: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ projects: [] })
  try {
    const { data } = await admin
      .from('projects')
      .select('*')
      .eq('workspace_id', ws.workspaceId)
      .eq('archived', false)
      .order('created_at', { ascending: true })
    return NextResponse.json({ projects: data || [] })
  } catch (e) {
    return NextResponse.json({ projects: [], error: e.message })
  }
}

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let b = {}
  try { b = await req.json() } catch {}
  if (!b.name || !String(b.name).trim()) {
    return NextResponse.json({ ok: false, error: 'Nome mancante' }, { status: 400 })
  }
  try {
    const { data, error } = await admin
      .from('projects')
      .insert({
        workspace_id: ws.workspaceId,
        name: String(b.name).trim(),
        description: b.description || null,
        color: b.color || null,
        created_by: ws.memberId,
      })
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, project: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

export async function PATCH(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let b = {}
  try { b = await req.json() } catch {}
  if (!b.id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })
  const patch = {}
  if (b.name !== undefined) patch.name = String(b.name || '').trim()
  if (b.description !== undefined) patch.description = b.description || null
  if (b.color !== undefined) patch.color = b.color || null
  if (b.archived !== undefined) patch.archived = !!b.archived
  if (b.budget_hours !== undefined) patch.budget_hours = (b.budget_hours === '' || b.budget_hours === null) ? null : Number(b.budget_hours)
  if (b.budget_amount !== undefined) patch.budget_amount = (b.budget_amount === '' || b.budget_amount === null) ? null : Number(b.budget_amount)
  try {
    await admin.from('projects').update(patch).eq('id', b.id).eq('workspace_id', ws.workspaceId)
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
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })
  try {
    // i task collegati restano: project_id -> null (ON DELETE SET NULL)
    await admin.from('projects').delete().eq('id', id).eq('workspace_id', ws.workspaceId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
