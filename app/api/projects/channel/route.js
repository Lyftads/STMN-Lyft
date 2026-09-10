export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { resolveWorkspace, isCollaborator } from '../../../../lib/team/workspace'

// ============================================================================
//  Canale LyftTalk di un progetto.
//
//  La chat del progetto NON è una chat separata: è un canale di LyftTalk
//  legato al progetto. Stessa conversazione vista da due punti — chi scrive
//  dal progetto lo trova in LyftTalk e viceversa. Così allegati, menzioni e
//  reazioni funzionano senza riscriverli, e nessuno si perde metà dei
//  messaggi perché li ha letti "nel posto sbagliato".
//
//  GET  ?projectId=… → { channelId } (lo crea alla prima apertura)
// ============================================================================

function isMissing(error) {
  const s = `${error?.code || ''} ${error?.message || ''}`.toLowerCase()
  return s.includes('42p01') || s.includes('does not exist') || s.includes('could not find')
}

export async function GET(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

  const projectId = new URL(req.url).searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ ok: false, error: 'projectId mancante' }, { status: 400 })

  const { data: proj } = await admin.from('projects').select('id, name')
    .eq('id', projectId).eq('workspace_id', ws.workspaceId).maybeSingle()
  if (!proj) return NextResponse.json({ ok: false, error: 'Progetto non trovato' }, { status: 404 })

  try {
    const { data: existing, error } = await admin.from('channels').select('id, name')
      .eq('workspace_id', ws.workspaceId).eq('project_id', projectId).maybeSingle()
    if (error && isMissing(error)) return NextResponse.json({ ok: false, needsSetup: true })
    if (existing) return NextResponse.json({ ok: true, channelId: existing.id, name: existing.name })
  } catch (e) {
    if (isMissing(e)) return NextResponse.json({ ok: false, needsSetup: true })
  }

  // Nessun canale ancora: lo crea chi può scrivere. Un membro in sola lettura
  // che apre la tab non deve creare canali per sbaglio.
  if (!(ws.isAdmin || isCollaborator(ws))) return NextResponse.json({ ok: true, channelId: null })

  // Il nome del canale deve essere unico nel workspace (vincolo esistente):
  // se "back-to-box" è già preso si aggiunge un suffisso invece di fallire.
  const base = String(proj.name || 'progetto').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'progetto'

  for (const name of [base, `${base}-2`, `${base}-${Date.now().toString().slice(-4)}`]) {
    const { data, error } = await admin.from('channels')
      .insert({ workspace_id: ws.workspaceId, name, created_by: ws.memberId, project_id: projectId })
      .select('id, name').single()
    if (!error && data) return NextResponse.json({ ok: true, channelId: data.id, name: data.name, created: true })
    if (error && isMissing(error)) return NextResponse.json({ ok: false, needsSetup: true })
  }
  return NextResponse.json({ ok: false, error: 'Canale non creato' }, { status: 200 })
}
