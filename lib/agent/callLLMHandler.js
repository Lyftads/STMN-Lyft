import { NextResponse } from 'next/server'
import { callBrain } from './gateway'
import { getTeamAgent, teamSkillPrompt } from './team'
import { recall } from '../tenant/agentMemory'

// ============================================================================
//  Handler dell'LLM della CALL (ElevenLabs Conversational AI → "custom LLM").
//  Endpoint OpenAI-compatible /chat/completions: ElevenLabs gestisce voce,
//  ascolto e interruzioni; il ragionamento è il nostro cervello (callBrain →
//  persona + DATI LIVE reali) con modello economico → token bassi.
//  Esposto su /api/team/call/llm E /api/team/call/llm/chat/completions
//  (ElevenLabs appende sempre /chat/completions all'URL del server).
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
  if (!secret) return true // se nessun secret è impostato, non bloccare (dev)
  const h = req.headers
  return h.get('x-call-secret') === secret || h.get('authorization') === `Bearer ${secret}`
}

function sseStream(text) {
  const id = 'chatcmpl-' + Date.now()
  const enc = new TextEncoder()
  const chunk = (delta, finish = null) => `data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'lyft-brain', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
  return new ReadableStream({
    start(c) {
      c.enqueue(enc.encode(chunk({ role: 'assistant' })))
      const parts = String(text).match(/[^.!?]+[.!?]*\s*/g) || [text]
      for (const p of parts) if (p) c.enqueue(enc.encode(chunk({ content: p })))
      c.enqueue(enc.encode(chunk({}, 'stop')))
      c.enqueue(enc.encode('data: [DONE]\n\n'))
      c.close()
    },
  })
}

export async function handleCallLLM(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body = {}
  try { body = await req.json() } catch {}
  const agentId = String(body.lyft_agent || body.extra_body?.lyft_agent || '').trim() || String(body.model || '').replace(/^team-/, '') || 'ceo'
  const locale = String(body.lyft_locale || body.extra_body?.lyft_locale || '').trim() || null
  const agent = getTeamAgent(agentId) || getTeamAgent('ceo')
  const msgs = Array.isArray(body.messages) ? body.messages : []
  const history = msgs.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
  const lastUser = [...history].reverse().find(m => m.role === 'user')?.content || ''

  const origin = new URL(req.url).origin
  const liveData = await getLiveData(origin)

  // MEMORIA cross-call: recupera decisioni/sintesi delle call precedenti.
  let memoryBlock = ''
  try {
    const ownerUser = process.env.LYFT_OWNER_USER_ID
    if (ownerUser && lastUser) {
      const mems = await recall({ userId: ownerUser, agentId: 'team-call', query: lastUser, limit: 5 })
      if (Array.isArray(mems) && mems.length) {
        memoryBlock = 'MEMORIA DELLE CALL PRECEDENTI (decisioni e sintesi già prese — tienine conto e dai continuità):\n' + mems.map(m => `• ${m.content}`).join('\n')
      }
    }
  } catch {}

  let reply = ''
  try {
    const r = await callBrain({
      skill: {
        id: `team-${agent.id}`,
        systemPrompt: `${teamSkillPrompt(agent)}

SEI IN UNA CALL CON TUTTA LA SQUADRA. Se la domanda è di competenza di un collega (Ads→Sofia, CRO→Giulia, SEO→Davide, Dati→Alessandro, Finanza→Marco, Marketing→Luigi, Creatività→Valentina, Strategia→Chiara), NON rispondere a vuoto: PASSA LA PAROLA al collega giusto e riporta la SUA risposta. Formato naturale e parlato, es: "Buona domanda, la giro a Giulia che segue la conversione… — [Giulia]: Allora, il nostro tasso di conversione è del 2,1%…". Il collega risponde in prima persona con i DATI LIVE reali. Poi, se utile, chiudi tu con una battuta da capo.`,
        guard: 'Anti-invenzione: cita SOLO numeri e nomi presenti nei DATI LIVE; se non hai un dato, dillo. Mai inventare.',
      },
      query: lastUser,
      data: liveData,
      dataLabel: 'DATI LIVE (numeri e nomi REALI del brand):',
      dataMax: 38000,
      extraSystem: memoryBlock ? [{ role: 'system', content: memoryBlock }] : [],
      messages: history.slice(-16),
      temperature: 0.5,
      model: process.env.CALL_MODEL || 'gpt-4o-mini',
      locale,
      guardTail: 'Sei in una CALL VOCALE dal vivo: rispondi in 1-2 frasi BREVISSIME, come si parla al telefono. Niente elenchi, niente markdown, niente preamboli. Vai dritto al punto, tono umano e naturale. NOME: rivolgiti all\'utente SOLO con il nome di battesimo (es. "Marino"), MAI con nome e cognome. LINGUA: rispondi SEMPRE nella stessa lingua in cui ti sta parlando l\'utente (italiano, inglese, spagnolo, francese o tedesco); se cambia lingua, seguilo subito.',
    })
    reply = String(r.content || '').trim()
  } catch {
    reply = 'Scusa, ho avuto un problema un attimo, puoi ripetere?'
  }
  if (!reply) reply = 'Non ho afferrato, puoi ripetere?'

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
