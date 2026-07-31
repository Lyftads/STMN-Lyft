export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { AgentDispatchClient } from 'livekit-server-sdk'
import { resolveWorkspace } from '../../../../../lib/team/workspace'
import { getTeamAgent } from '../../../../../lib/agent/team'

// Dispatcha un AGENTE della Squadra AI in una stanza LiveKit. Richiede che il
// "worker bridge" (servizio always-on, fuori da Vercel) sia registrato come
// agent name 'lyft-agent'. Il worker legge la metadata (agentId) e entra in
// stanza con voce + persona + dati di quell'agente.
export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })

  // Gate INTERIM (come signed-url): la pipeline vocale legge i dati del
  // workspace OWNER → finché il workspaceId non viaggia nella call, la voce
  // è disponibile solo all'owner. Fix audit AI 31 lug.
  {
    const { getEffectiveTenantId } = await import('../../../../../lib/tenant/credentials')
    const eff = await getEffectiveTenantId().catch(() => null)
    if (!eff || eff !== process.env.LYFT_OWNER_USER_ID) {
      return NextResponse.json({ ok: false, configured: false, reason: 'Le call vocali non sono ancora disponibili per questo workspace.' }, { status: 403 })
    }
  }
  const apiKey = process.env.LIVEKIT_API_KEY, apiSecret = process.env.LIVEKIT_API_SECRET
  const host = (process.env.LIVEKIT_URL || '').replace(/^wss?:\/\//, 'https://')
  if (!apiKey || !apiSecret || !host) return NextResponse.json({ ok: false, configured: false, reason: 'LIVEKIT_* mancanti' })

  let b = {}
  try { b = await req.json() } catch {}
  // Stessa derivazione server-side della stanza usata da livekit-token.
  const slug = String(b.room || 'main').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'main'
  const room = `ws-${ws.workspaceId}-${slug}`.slice(0, 100)
  const agent = getTeamAgent(b.agentId)
  if (!room || !agent) return NextResponse.json({ ok: false, error: 'room o agentId mancante' }, { status: 400 })

  try {
    const client = new AgentDispatchClient(host, apiKey, apiSecret)
    const dispatch = await client.createDispatch(room, 'lyft-agent', { metadata: JSON.stringify({ agentId: agent.id }) })
    return NextResponse.json({ ok: true, dispatchId: dispatch?.id || null, agent: agent.name })
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Dispatch fallito (worker non attivo?): ${e?.message || e}` }, { status: 200 })
  }
}
