export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getAuthUser } from '../../../../lib/studio/credits'
import { getAgentVoice } from '../../../../lib/agent/team'

// POST {agentId, text} → audio/mpeg con la voce ElevenLabs dell'agente.
// Voce per genere (vedi VOICES in lib/agent/team.js), model multilingua → italiano.
export async function POST(req) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return NextResponse.json({ error: 'ELEVENLABS_API_KEY non configurata' }, { status: 500 })

  let b = {}
  try { b = await req.json() } catch {}
  const text = String(b.text || '').trim().slice(0, 2500)
  if (!text) return NextResponse.json({ error: 'Testo mancante' }, { status: 400 })
  const voiceId = getAgentVoice(b.agentId)

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
      }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return NextResponse.json({ error: `ElevenLabs ${res.status}: ${t.slice(0, 200)}` }, { status: 502 })
    }
    const buf = await res.arrayBuffer()
    return new Response(buf, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Errore TTS' }, { status: 500 })
  }
}
