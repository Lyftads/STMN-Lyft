export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { resolveWorkspace, isCollaborator } from '../../../../lib/team/workspace'
import { addToProjectChannel, removeFromProjectChannel } from '../../../../lib/team/projectChannel'

// ============================================================================
//  Membri di un progetto, con un lead.
//
//  Prima "le persone di un progetto" erano i responsabili distinti delle sue
//  task: un numero derivato, non una scelta. Qui diventano una squadra vera.
//
//  Chi è in ferie viene segnalato: assegnare una task a chi non c'è è l'errore
//  che questa vista serve a evitare.
// ============================================================================

function isMissingTable(error) {
  const s = `${error?.code || ''} ${error?.message || ''}`.toLowerCase()
  return s.includes('42p01') || s.includes('does not exist') || s.includes('could not find the table')
}

// Membri assenti OGGI (ferie/permesso/malattia approvati).
async function onLeaveToday(admin, workspaceId) {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const { data } = await admin.from('time_off')
      .select('member_id, type, end_date')
      .eq('workspace_id', workspaceId).eq('status', 'approved')
      .lte('start_date', today).gte('end_date', today)
    return Object.fromEntries((data || []).map(r => [r.member_id, { type: r.type, until: r.end_date }]))
  } catch { return {} }
}

export async function GET(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ members: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ members: [] })

  const projectId = new URL(req.url).searchParams.get('projectId')
  const [{ data: team }, leave] = await Promise.all([
    admin.from('team_members').select('id, full_name, email, roles, status')
      .eq('workspace_id', ws.workspaceId).in('status', ['active', 'invited']),
    onLeaveToday(admin, ws.workspaceId),
  ])

  const byId = Object.fromEntries((team || []).map(m => [m.id, m]))
  const all = (team || []).map(m => ({
    id: m.id, name: m.full_name || m.email, email: m.email, roles: m.roles || [],
    leave: leave[m.id] || null,
  }))

  if (!projectId) return NextResponse.json({ members: [], team: all, needsSetup: false })

  let rows = [], needsSetup = false
  try {
    const { data, error } = await admin.from('project_members')
      .select('*').eq('workspace_id', ws.workspaceId).eq('project_id', projectId)
      .order('created_at', { ascending: true })
    if (error && isMissingTable(error)) needsSetup = true
    rows = data || []
  } catch (e) { if (isMissingTable(e)) needsSetup = true }

  const members = rows.map(r => {
    const m = byId[r.member_id]
    return {
      id: r.id, memberId: r.member_id,
      name: m ? (m.full_name || m.email) : '—',
      roles: m?.roles || [],
      isLead: !!r.is_lead,
      leave: leave[r.member_id] || null,
    }
  })

  return NextResponse.json({
    members, team: all, needsSetup,
    can: { write: ws.isAdmin || isCollaborator(ws) },
  })
}

// Aggiunge un membro al progetto, oppure sposta il lead.
// Body: { projectId, memberId, lead?: true }
export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!(ws.isAdmin || isCollaborator(ws))) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

  let b = {}
  try { b = await req.json() } catch {}
  if (!b.projectId || !b.memberId) return NextResponse.json({ ok: false, error: 'Dati mancanti' }, { status: 400 })

  // Il progetto deve essere di questo workspace: senza il controllo si
  // potrebbero aggiungere persone al progetto di un altro tenant.
  const { data: proj } = await admin.from('projects').select('id')
    .eq('id', b.projectId).eq('workspace_id', ws.workspaceId).maybeSingle()
  if (!proj) return NextResponse.json({ ok: false, error: 'Progetto non trovato' }, { status: 404 })

  const { data: mem } = await admin.from('team_members').select('id')
    .eq('id', b.memberId).eq('workspace_id', ws.workspaceId).maybeSingle()
  if (!mem) return NextResponse.json({ ok: false, error: 'Persona non trovata' }, { status: 404 })

  try {
    if (b.lead) {
      // Un lead alla volta: prima si azzera, poi si assegna. Chi era lead resta
      // membro — perdere la persona dal progetto per un cambio di ruolo sarebbe
      // una sorpresa sgradevole.
      await admin.from('project_members').update({ is_lead: false })
        .eq('project_id', b.projectId).eq('workspace_id', ws.workspaceId)
    }
    const { error } = await admin.from('project_members').upsert({
      workspace_id: ws.workspaceId, project_id: b.projectId, member_id: b.memberId,
      is_lead: !!b.lead, added_by: ws.memberId,
    }, { onConflict: 'project_id,member_id' })
    if (error) {
      if (isMissingTable(error)) return NextResponse.json({ ok: false, needsSetup: true, error: 'Tabella project_members assente' }, { status: 200 })
      throw error
    }
    if (b.lead) {
      await admin.from('project_members').update({ is_lead: true })
        .eq('project_id', b.projectId).eq('member_id', b.memberId)
    }
    // Chi entra nel progetto entra nel gruppo LyftTalk del progetto.
    await addToProjectChannel(admin, { workspaceId: ws.workspaceId, projectId: b.projectId, memberId: b.memberId })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

export async function DELETE(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!(ws.isAdmin || isCollaborator(ws))) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

  const url = new URL(req.url)
  const projectId = url.searchParams.get('projectId')
  const memberId = url.searchParams.get('memberId')
  if (!projectId || !memberId) return NextResponse.json({ ok: false, error: 'Dati mancanti' }, { status: 400 })

  await admin.from('project_members').delete()
    .eq('workspace_id', ws.workspaceId).eq('project_id', projectId).eq('member_id', memberId)
  await removeFromProjectChannel(admin, { workspaceId: ws.workspaceId, projectId, memberId })
  return NextResponse.json({ ok: true })
}
