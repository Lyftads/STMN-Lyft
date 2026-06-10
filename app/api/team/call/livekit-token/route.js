export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'
import { resolveWorkspace } from '../../../../../lib/team/workspace'
import { getAdminSupabase } from '../../../../../lib/supabase/server'

// Token LiveKit per far entrare un MEMBRO (umano) in una stanza di call di gruppo.
// La stanza è condivisa (stesso `room`) tra umani e, via worker bridge, gli agent.
export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  const apiKey = process.env.LIVEKIT_API_KEY, apiSecret = process.env.LIVEKIT_API_SECRET, url = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL
  if (!apiKey || !apiSecret || !url) return NextResponse.json({ ok: false, configured: false, reason: 'LIVEKIT_* mancanti' })

  let b = {}
  try { b = await req.json() } catch {}
  const room = String(b.room || `team-${ws.workspaceId.slice(0, 8)}`).slice(0, 60)

  // Nome/identità/foto del partecipante (dal team_members se possibile).
  let name = String(b.name || '').trim()
  let avatar = ''
  const identity = `member-${ws.memberId || ws.userId || Math.random().toString(36).slice(2, 8)}`
  try {
    const admin = getAdminSupabase()
    if (admin && ws.memberId) {
      const { data: m } = await admin.from('team_members').select('full_name, email, avatar_url').eq('id', ws.memberId).maybeSingle()
      if (!name) name = m?.full_name || (m?.email ? m.email.split('@')[0] : '') || 'Utente'
      avatar = m?.avatar_url || ''
    }
  } catch {}
  if (!name) name = 'Utente'

  try {
    const metadata = JSON.stringify({ name, avatar, isAgent: false })
    const at = new AccessToken(apiKey, apiSecret, { identity, name, metadata, ttl: '2h' })
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true })
    const token = await at.toJwt()
    return NextResponse.json({ ok: true, token, url, room, identity, name })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'token error' }, { status: 500 })
  }
}
