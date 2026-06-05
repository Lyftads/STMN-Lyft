export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

export async function GET(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ comments: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ comments: [] })
  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('task_id')
  if (!taskId) return NextResponse.json({ comments: [] })
  try {
    const { data } = await admin
      .from('task_comments')
      .select('*')
      .eq('workspace_id', ws.workspaceId)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
    return NextResponse.json({ comments: data || [] })
  } catch (e) {
    return NextResponse.json({ comments: [], error: e.message })
  }
}

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let b = {}
  try { b = await req.json() } catch {}
  const taskId = b.task_id
  const body = String(b.body || '').trim()
  if (!taskId || !body) return NextResponse.json({ ok: false, error: 'task_id o testo mancante' }, { status: 400 })

  // verifica che il task sia del workspace
  const { data: task } = await admin.from('tasks').select('id').eq('id', taskId).eq('workspace_id', ws.workspaceId).maybeSingle()
  if (!task) return NextResponse.json({ ok: false, error: 'Task non trovato' }, { status: 404 })

  // nome autore dal team_member corrente
  let authorName = 'Utente'
  try {
    const { data: mem } = await admin.from('team_members').select('full_name, email').eq('workspace_id', ws.workspaceId).eq('user_id', ws.userId).maybeSingle()
    if (mem) authorName = mem.full_name || mem.email
  } catch {}

  try {
    const { data, error } = await admin
      .from('task_comments')
      .insert({ task_id: taskId, workspace_id: ws.workspaceId, author_id: ws.memberId, author_name: authorName, body })
      .select('*').single()
    if (error) throw error
    return NextResponse.json({ ok: true, comment: data })
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
    await admin.from('task_comments').delete().eq('id', id).eq('workspace_id', ws.workspaceId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
