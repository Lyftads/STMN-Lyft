export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getAuthUser } from '../../../../lib/studio/credits'
import { getAgentVoice } from '../../../../lib/agent/team'

// POST {agentId, text} → audio/mpeg con la voce ElevenLabs dell'agente.
// Voce per genere (vedi VOICES in lib/agent/team.js), model multilingua → italiano.
// Normalizza il testo per una pronuncia italiana corretta dei numeri:
// € → "euro" (dopo il numero), % → "percento", punto decimale dei rapporti
// (es. "3.46") → virgola italiana ("3,46"), niente simboli.
function speakable(t) {
  return String(t || '')
    .replace(/€\s?([\d.,]+)/g, '$1 euro')          // €2.759 → 2.759 euro
    .replace(/([\d.,]+)\s?€/g, '$1 euro')          // 2.759€ → 2.759 euro
    .replace(/€/g, ' euro')
    .replace(/(\d+)[.,](\d+)\s?%/g, '$1 virgola $2 percento') // 49,1% → 49 virgola 1 percento
    .replace(/%/g, ' percento')
    .replace(/\b(\d{1,3})\.(\d{1,2})\b(?!\d)/g, '$1 virgola $2') // rapporti 3.46 → 3 virgola 46 (non i migliaia 2.759)
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export async function POST(req) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return NextResponse.json({ error: 'ELEVENLABS_API_KEY non configurata' }, { status: 500 })

  let b = {}
  try { b = await req.json() } catch {}
  const text = speakable(String(b.text || '').trim().slice(0, 2500))
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
