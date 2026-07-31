export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAuthUser } from '../../../../../lib/studio/credits'
import { getCallAgentId } from '../../../../../lib/agent/callAgents'

// GET ?agentId=<id squadra> → { configured, signedUrl?, agentId? }
//  - configured: la call è attivabile (key + agent ElevenLabs impostati).
//  - signedUrl: URL firmato per connettere il browser all'agent ElevenLabs
//    SPECIFICO dell'agente scelto (ognuno ha la sua voce + transfer ai colleghi).
export async function GET(req) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ configured: false, error: 'Non autenticato' }, { status: 401 })

  // INTERIM (audit 31 lug): la pipeline vocale legge i dati del workspace
  // OWNER (call_context/env) e ElevenLabs non veicola il tenant → per un
  // cliente la voce leggerebbe i numeri di un'altra azienda. Finché il
  // workspaceId non viaggia nella call, la voce è disponibile solo all'owner.
  const { getEffectiveTenantId } = await import('../../../../../lib/tenant/credentials')
  const ws = await getEffectiveTenantId().catch(() => null)
  if (!ws || ws !== process.env.LYFT_OWNER_USER_ID) {
    return NextResponse.json({ configured: false, error: 'Le chiamate vocali non sono ancora disponibili per questo workspace.' }, { status: 403 })
  }

  const key = process.env.ELEVENLABS_API_KEY
  const teamAgentId = new URL(req.url).searchParams.get('agentId') || 'ceo'
  const agentId = getCallAgentId(teamAgentId)
  if (!key || !agentId) {
    return NextResponse.json({ configured: false, reason: !key ? 'ELEVENLABS_API_KEY mancante' : 'ELEVENLABS_AGENT_ID mancante' })
  }

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, {
      headers: { 'xi-api-key': key }, cache: 'no-store', signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      return NextResponse.json({ configured: true, error: `ElevenLabs ${r.status}: ${t.slice(0, 160)}` }, { status: 502 })
    }
    const d = await r.json()
    return NextResponse.json({ configured: true, signedUrl: d.signed_url, agentId })
  } catch (e) {
    return NextResponse.json({ configured: true, error: e?.message || 'Errore signed-url' }, { status: 500 })
  }
}
