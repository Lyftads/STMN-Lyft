export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

// Tutti i file/audio condivisi nei canali visibili al membro corrente.
export async function GET() {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ files: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ files: [] })
  try {
    const { data: all } = await admin.from('channels').select('id, is_private, name, is_dm').eq('workspace_id', ws.workspaceId)
    let memberOf = new Set()
    try {
      const { data: cms } = await admin.from('channel_members').select('channel_id').eq('member_id', ws.memberId)
      memberOf = new Set((cms || []).map(x => x.channel_id))
    } catch {}
    const visible = (all || []).filter(c => !c.is_private || ws.isAdmin || memberOf.has(c.id))
    const chName = {}; visible.forEach(c => { chName[c.id] = c.name })
    const ids = visible.map(c => c.id)
    if (!ids.length) return NextResponse.json({ files: [] })
    const { data } = await admin.from('channel_messages')
      .select('id, channel_id, author_id, author_name, file_url, file_name, file_type, audio_url, created_at')
      .in('channel_id', ids)
      .or('file_url.not.is.null,audio_url.not.is.null')
      .order('created_at', { ascending: false })
      .limit(200)
    return NextResponse.json({ files: (data || []).map(m => ({ ...m, channel_name: chName[m.channel_id] || '' })) })
  } catch (e) {
    return NextResponse.json({ files: [], error: e.message })
  }
}
