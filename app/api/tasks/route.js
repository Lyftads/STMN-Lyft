export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'
import { notifyAssignment, notifyStatusChange, notifyCalendarUpdate } from '../../../lib/team/notify'

const STATUSES = ['todo', 'in_progress', 'in_review', 'approved', 'done']
const PRIORITIES = ['low', 'medium', 'high', 'urgent']

function originOf(req) {
  // Questo valore finisce dentro un'EMAIL, quindi deve essere il dominio
  // PUBBLICO. origin/host sono quelli della richiesta: se chi invita sta
  // navigando un URL di deployment (…-lyftads-projects.vercel.app, protetto
  // da Vercel), l'invitato riceveva un link che lo portava al login di Vercel
  // invece che a quello dell'app. Percio' la variabile canonica viene PRIMA.
  const canonico = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || '').trim()
  if (canonico) return canonico.replace(/\/+$/, '')
  // Niente dominio fisso come ultima risorsa: questo file vive anche nel fork
  // di Anna Virgili, e un lyftai.io scritto a mano manderebbe le persone
  // nell'altro prodotto. Meglio il dominio della richiesta.
  return req.headers.get('origin') ||
    (req.headers.get('host') ? `https://${req.headers.get('host')}` : '')
}

export async function GET(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ tasks: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ tasks: [] })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  try {
    let q = admin
      .from('tasks')
      .select('*')
      .eq('workspace_id', ws.workspaceId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
    if (projectId) q = q.eq('project_id', projectId)
    const { data, error } = await q
    if (error) throw error
    return NextResponse.json({
      tasks: data || [],
      me: { memberId: ws.memberId, roles: ws.roles, isAdmin: ws.isAdmin },
    })
  } catch (e) {
    return NextResponse.json({ tasks: [], error: e.message })
  }
}

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'DB non disponibile' })

  let b = {}
  try { b = await req.json() } catch {}
  if (!b.title || !String(b.title).trim()) {
    return NextResponse.json({ ok: false, error: 'Titolo mancante' }, { status: 400 })
  }

  const row = {
    workspace_id: ws.workspaceId,
    project_id: b.project_id || null,
    title: String(b.title).trim(),
    description: b.description || null,
    status: STATUSES.includes(b.status) ? b.status : 'todo',
    priority: PRIORITIES.includes(b.priority) ? b.priority : 'medium',
    // Più persone sulla stessa task: `assignee_id` resta il responsabile
    // principale (board, filtri, promemoria), `assignees` li elenca tutti.
    assignee_id: b.assignee_id || (Array.isArray(b.assignees) && b.assignees[0]) || null,
    assignees: Array.isArray(b.assignees) ? b.assignees.filter(Boolean).slice(0, 20) : (b.assignee_id ? [b.assignee_id] : []),
    due_date: b.due_date || null,
    links: Array.isArray(b.links) ? b.links : [],
    created_by: ws.memberId,
  }
  try {
    const { data, error } = await admin.from('tasks').insert(row).select('*').single()
    if (error) throw error
    if (data?.assignee_id) await notifyAssignment({ workspaceId: ws.workspaceId, task: data, origin: originOf(req) })
    return NextResponse.json({ ok: true, task: data })
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

  const patch = { updated_at: new Date().toISOString() }
  if (b.title !== undefined) patch.title = String(b.title || '').trim()
  if (b.description !== undefined) patch.description = b.description || null
  if (b.priority !== undefined && PRIORITIES.includes(b.priority)) patch.priority = b.priority
  if (b.assignee_id !== undefined) patch.assignee_id = b.assignee_id || null
  if (b.assignees !== undefined) {
    const list = Array.isArray(b.assignees) ? b.assignees.filter(Boolean).slice(0, 20) : []
    patch.assignees = list
    // Se il principale non è più fra gli assegnatari la task resterebbe
    // attribuita a chi non ci lavora più: si riallinea al primo dell'elenco.
    if (patch.assignee_id === undefined && list.length && !list.includes(b.assignee_id)) patch.assignee_id = list[0]
    if (!list.length && patch.assignee_id === undefined) patch.assignee_id = null
  }
  if (b.due_date !== undefined) patch.due_date = b.due_date || null
  if (b.project_id !== undefined) patch.project_id = b.project_id || null
  if (b.links !== undefined) patch.links = Array.isArray(b.links) ? b.links : []
  if (b.position !== undefined) patch.position = b.position
  if (b.status !== undefined && STATUSES.includes(b.status)) {
    patch.status = b.status
    // Approvazione aperta a tutti: chiunque può portare un task ad "approved".
    if (b.status === 'approved') {
      patch.approved_by = ws.memberId
      patch.approved_at = new Date().toISOString()
    }
  }

  try {
    const { data, error } = await admin
      .from('tasks')
      .update(patch)
      .eq('id', b.id)
      .eq('workspace_id', ws.workspaceId)
      .select('*')
      .single()
    if (error) throw error
    const origin = originOf(req)
    if (b.assignee_id) await notifyAssignment({ workspaceId: ws.workspaceId, task: data, origin })
    else if (b.due_date) await notifyCalendarUpdate({ workspaceId: ws.workspaceId, task: data, origin })
    if (b.status !== undefined) await notifyStatusChange({ workspaceId: ws.workspaceId, task: data, origin })
    return NextResponse.json({ ok: true, task: data })
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
    await admin.from('tasks').delete().eq('id', id).eq('workspace_id', ws.workspaceId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
