export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { resolveWorkspace, isCollaborator } from '../../../../lib/team/workspace'
import { ensureProjectChannel } from '../../../../lib/team/projectChannel'

// ============================================================================
//  Canale LyftTalk di un progetto.
//
//  La chat del progetto NON è una chat separata: è un canale di LyftTalk
//  legato al progetto. Stessa conversazione vista da due punti — chi scrive
//  dal progetto lo trova in LyftTalk e viceversa.
//
//  GET ?projectId=… → { channelId }. Il canale nasce col progetto; qui si
//  recupera, e se manca (progetti creati prima) lo si crea o si adotta quello
//  omonimo già esistente. La logica sta tutta in lib/team/projectChannel.
// ============================================================================

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

  // Chi è in sola lettura non deve creare canali aprendo una tab: se non
  // esiste ancora, per lui la chat semplicemente non c'è.
  const canWrite = ws.isAdmin || isCollaborator(ws)
  const { data: existing } = await admin.from('channels').select('id, name')
    .eq('workspace_id', ws.workspaceId).eq('project_id', projectId).maybeSingle()
  if (existing) return NextResponse.json({ ok: true, channelId: existing.id, name: existing.name })
  if (!canWrite) return NextResponse.json({ ok: true, channelId: null })

  let memberIds = []
  try {
    const { data } = await admin.from('project_members').select('member_id')
      .eq('workspace_id', ws.workspaceId).eq('project_id', projectId)
    memberIds = (data || []).map(r => r.member_id)
  } catch {}

  const res = await ensureProjectChannel(admin, {
    workspaceId: ws.workspaceId, projectId, projectName: proj.name,
    createdBy: ws.memberId, memberIds,
  })
  if (res.needsSetup) return NextResponse.json({ ok: false, needsSetup: true })
  return NextResponse.json({ ok: !!res.channelId, channelId: res.channelId || null, adopted: !!res.adopted })
}
