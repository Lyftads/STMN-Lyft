export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { callBrain } from '../../../../../lib/agent/gateway'
import { getTeamAgent } from '../../../../../lib/agent/team'

// ============================================================================
//  LLM della CALL (ElevenLabs Conversational AI → "custom LLM").
//
//  Endpoint OpenAI-compatible /v1/chat/completions: ElevenLabs gestisce voce,
//  ascolto e interruzioni; il RAGIONAMENTO è il nostro cervello (callBrain →
//  persona dell'agente + DATI LIVE reali + knowledge), con modello economico
//  (gpt-4o-mini) → costo token basso. L'agente è scelto dal campo `model`
//  configurato sull'agent ElevenLabs (es. "team-ads").
//
//  Auth: header `x-call-secret` o `Authorization: Bearer <CALL_SECRET|CRON_SECRET>`
//  (configurato sull'agent ElevenLabs) → solo le nostre call possono usarlo.
// ============================================================================

const ctxCache = new Map() // origin → { data, ts }
async function getLiveData(origin) {
  const hit = ctxCache.get(origin)
  if (hit && Date.now() - hit.ts < 4 * 60000) return hit.data
  try {
    const r = await fetch(`${origin}/api/agent-context?preset=last_30d&days=30`, {
      headers: { 'x-internal-cron': process.env.CRON_SECRET || '' }, cache: 'no-store',
    })
    const data = r.ok ? await r.json() : (hit?.data || null)
    ctxCache.set(origin, { data, ts: Date.now() })
    return data
  } catch { return hit?.data || null }
}

function authorized(req) {
  const secret = process.env.CALL_SECRET || process.env.CRON_SECRET
  if (!secret) return false
  const h = req.headers
  return h.get('x-call-secret') === secret || h.get('authorization') === `Bearer ${secret}`
}

// SSE in formato OpenAI chat.completions.chunk
function sseStream(text) {
  const id = 'chatcmpl-' + Date.now()
  const enc = new TextEncoder()
  const chunk = (delta, finish = null) => `data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'lyft-brain', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
  return new ReadableStream({
    start(c) {
      c.enqueue(enc.encode(chunk({ role: 'assistant' })))
      // spezzo per frasi → la voce parte prima
      const parts = String(text).match(/[^.!?]+[.!?]*\s*/g) || [text]
      for (const p of parts) if (p) c.enqueue(enc.encode(chunk({ content: p })))
      c.enqueue(enc.encode(chunk({}, 'stop')))
      c.enqueue(enc.encode('data: [DONE]\n\n'))
      c.close()
    },
  })
}

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body = {}
  try { body = await req.json() } catch {}
  // L'agente arriva via extra-body inoltrato dall'SDK (`lyft_agent`) o dal `model`
  // (es. "team-ads"). Così UN solo agent ElevenLabs serve tutte le 8 personas.
  const agentId = String(body.lyft_agent || body.extra_body?.lyft_agent || '').trim() || String(body.model || '').replace(/^team-/, '') || 'ceo'
  const agent = getTeamAgent(agentId) || getTeamAgent('ceo')
  const msgs = Array.isArray(body.messages) ? body.messages : []
  const history = msgs.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
  const lastUser = [...history].reverse().find(m => m.role === 'user')?.content || ''

  const origin = new URL(req.url).origin
  const liveData = await getLiveData(origin)

  let reply = ''
  try {
    const { teamSkillPrompt } = await import('../../../../../lib/agent/team')
    const r = await callBrain({
      skill: {
        id: `team-${agent.id}`,
        systemPrompt: teamSkillPrompt(agent),
        guard: 'Anti-invenzione: cita SOLO numeri e nomi presenti nei DATI LIVE; se non hai un dato, dillo. Mai inventare.',
      },
      query: lastUser,
      data: liveData,
      dataLabel: 'DATI LIVE (numeri e nomi REALI del brand):',
      dataMax: 38000,
      messages: history.slice(-16),
      temperature: 0.5,
      model: process.env.CALL_MODEL || 'gpt-4o-mini',
      guardTail: 'Sei in una CALL VOCALE dal vivo: rispondi in 1-2 frasi BREVISSIME, come si parla al telefono. Niente elenchi, niente markdown, niente preamboli. Vai dritto al punto, tono umano e naturale.',
    })
    reply = String(r.content || '').trim()
  } catch (e) {
    reply = 'Scusa, ho avuto un problema un attimo, puoi ripetere?'
  }
  if (!reply) reply = 'Non ho afferrato, puoi ripetere?'

  // Streaming richiesto → SSE OpenAI-compatible (default per ElevenLabs).
  if (body.stream) {
    return new Response(sseStream(reply), {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' },
    })
  }
  return NextResponse.json({
    id: 'chatcmpl-' + Date.now(), object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: 'lyft-brain',
    choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  })
}
