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

  // Workspace della call: viaggia nel token FIRMATO (customLlmExtraBody) così
  // il webhook LLM risolve il tenant giusto. Finché il toggle "Custom LLM extra
  // body" non è abilitato sugli agenti ElevenLabs, VOICE_MULTITENANT resta
  // spento e la voce serve solo l'owner (i dati arriverebbero dall'owner).
  const { getEffectiveTenantId } = await import('../../../../../lib/tenant/credentials')
  const { mintCallToken } = await import('../../../../../lib/agent/callToken')
  const ws = await getEffectiveTenantId().catch(() => null)
  const multiTenantVoice = process.env.VOICE_MULTITENANT === 'true'
  if (!ws || (!multiTenantVoice && ws !== process.env.LYFT_OWNER_USER_ID)) {
    return NextResponse.json({ configured: false, error: 'Le chiamate vocali non sono ancora disponibili per questo workspace.' }, { status: 403 })
  }
  const callToken = mintCallToken(ws)

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
    return NextResponse.json({ configured: true, signedUrl: d.signed_url, agentId, callToken })
  } catch (e) {
    return NextResponse.json({ configured: true, error: e?.message || 'Errore signed-url' }, { status: 500 })
  }
}
