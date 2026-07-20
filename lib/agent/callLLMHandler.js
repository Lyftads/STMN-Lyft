import { NextResponse } from 'next/server'
import { callBrain } from './gateway'
import { getTeamAgent, teamSkillPrompt } from './team'
import { recall, recallKnowledge } from '../tenant/agentMemory'
import { getAdminSupabase } from '../supabase/server'
import { buildBrief } from './brandSnapshot'
import { ALL_TOOLS, executeToolLive } from './tools'

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
  // 1) Snapshot "innescato" dal browser owner (percorso provato → dati reali).
  try {
    const admin = getAdminSupabase()
    const ownerWs = process.env.LYFT_OWNER_USER_ID
    if (admin && ownerWs) {
      const { data: row } = await admin.from('call_context').select('data, updated_at').eq('workspace_id', ownerWs).maybeSingle()
      if (row?.data && (Date.now() - new Date(row.updated_at).getTime() < 60 * 60000)) return row.data
    }
  } catch {}
  // 2) Fallback: fetch via cron secret (se configurato).
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
  const agent = getTeamAgent(agentId) || getTeamAgent('ceo')
  const msgs = Array.isArray(body.messages) ? body.messages : []
  const history = msgs.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
  const lastUser = [...history].reverse().find(m => m.role === 'user')?.content || ''
  const origin = new URL(req.url).origin
  const OPENAI_KEY = process.env.OPENAI_API_KEY

  // Dati + memoria + knowledge (corso/video) in PARALLELO (niente latenza serie).
  const ownerUser = process.env.LYFT_OWNER_USER_ID
  const [liveData, mems, know] = await Promise.all([
    getLiveData(origin),
    (ownerUser && lastUser) ? recall({ userId: ownerUser, agentId: 'team-call', query: lastUser, limit: 4 }).catch(() => []) : Promise.resolve([]),
    lastUser ? recallKnowledge({ query: lastUser, limit: 2 }).catch(() => []) : Promise.resolve([]),
  ])
  const brief = buildBrief(liveData)
  const memoryBlock = (Array.isArray(mems) && mems.length) ? '\n\nMEMORIA CALL PRECEDENTI (dai continuità):\n' + mems.map(m => `• ${m.content}`).join('\n') : ''
  const knowBlock = (Array.isArray(know) && know.length) ? '\n\nCONOSCENZA (dal corso e dai video YouTube — usala se pertinente, sintetizza):\n' + know.map(k => `• ${String(k.content || '').slice(0, 280)}`).join('\n') : ''

  const system = `${teamSkillPrompt(agent)}

SEI IN UNA CALL VOCALE con tutta la squadra. Se la domanda è di un collega (Ads→Sofia, CRO→Giulia, SEO→Davide, Dati→Alessandro, Finanza→Marco, Marketing→Luigi, Creatività→Valentina, Strategia→Chiara) passa la parola e riporta la sua risposta in prima persona.

${brief}${memoryBlock}${knowBlock}

REGOLE RISPOSTA: 1 frase, max 2, BREVISSIME come al telefono. Niente elenchi/markdown/preamboli. Cita solo numeri/nomi dei DATI REALI sopra; se manca un dato dillo. Chiama l'utente SOLO per nome (es. "Marino"), mai col cognome. Rispondi nella STESSA lingua dell'utente.
NUMERI (CRUCIALE per la pronuncia vocale): dilli SEMPRE arrotondati e in modo PARLATO.
- Scrivi "euro" e "percento" A PAROLE, MAI i simboli € o %.
- Rapporti e decimali a parole o con la virgola italiana: "ROAS tre e mezzo" o "ROAS tre virgola cinque", MAI "ROAS 3.5" o "tre punto cinque".
- Importi: arrotonda e dilli a voce — "circa duemilasettecento euro", "circa quarantanove mila euro", "AOV settantatré euro". MAI cifre lunghe tipo "2.759,40" o "141.265".
- Percentuali: "circa il tre percento", "quarantanove percento".
TIME FRAME (cruciale): per ogni domanda usa il numero del periodo ESATTO richiesto dalle liste sopra (oggi / ieri / questa settimana / scorsa settimana / questo mese / scorso mese / ultimi 30 giorni). NON confondere i periodi (es. la spesa "scorsa settimana" è quella riga, NON il totale dei 30 giorni). Riporta ordini e spesa in modo PRECISO. Se un periodo è "in aggiornamento", dillo onestamente — ma NON dire mai "zero" o che "non ci sono dati".
TONO: parla in modo ESPRESSIVO e umano, MAI meccanico. Usa esclamazioni e reazioni naturali coerenti col contenuto — entusiasmo se i dati sono buoni ("Ottimo, Marino!", "Wow, qui voliamo!"), preoccupazione se vanno male ("Mmh, qui c'è da lavorare…"), curiosità, pause naturali. Varia l'intonazione.
PROATTIVITÀ: non limitarti a rispondere. Quando ha senso, sii TU a guidare: fai una domanda all'utente ("Vuoi che approfondisca le creative in fatica?"), segnala un'opportunità o un rischio che noti nei dati ("Occhio: il CPC è salito, valuterei…"), proponi la prossima mossa. Come un vero collega in riunione che porta valore, non un risponditore passivo. Ma resta breve e naturale, una domanda/spunto alla volta.
STRUMENTI (usali quando servono, non inventare MAI e non dire "non ho il dato" se uno strumento può dartelo):
- get_kpis(periodo): per QUALSIASI KPI di un periodo — repeat rate, LTV, CAC, nuovi clienti, clienti di ritorno, AOV, conversion rate, CTR, CPC, CPM, frequency, ROAS, MER, sessioni, resi. Se ti chiedono uno di questi, CHIAMA get_kpis col periodo giusto.
- list_creatives / list_adsets: per la singola creative o adset per nome o per i top per spesa/ROAS/CTR.
- get_google_campaigns: campagne Google Ads con spesa, ROAS, conversioni.
- get_search_console: SEO reale (click, query, posizioni, opportunità).
- get_incrementality / get_ltv / get_inventory: contributo incrementale dei canali, LTV e CAC, rischi stockout.
- get_competitors: prodotti, prezzi, categorie, promo dei competitor.
- list_tasks / get_time_tracking / list_products: task del team, ore Lyftimer, top prodotti.
I risultati degli strumenti includono istruzioni "jit": seguile.
Per i dati già scritti nel riepilogo qui sopra (vendite/spesa per periodo) rispondi pure direttamente.`

  const SH = { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' }
  const MODEL = process.env.CALL_MODEL || 'gpt-4o-mini'
  const callOAI = (messages, opts = {}) => fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: SH,
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.5, max_tokens: 200, ...(opts.tools ? { tools: ALL_TOOLS, tool_choice: 'auto' } : {}), ...(opts.stream ? { stream: true } : {}) }),
  })
  const baseMessages = [{ role: 'system', content: system }, ...history.slice(-10)]
  const streamHeaders = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' }

  try {
    // 1) Prima chiamata CON strumenti (non-stream): decide se serve un tool.
    const r1 = await callOAI(baseMessages, { tools: true })
    if (!r1.ok) throw new Error('openai ' + r1.status)
    const j1 = await r1.json()
    const msg = j1.choices?.[0]?.message || {}

    // 2) Se il modello chiama degli strumenti → eseguili sullo snapshot, poi rispondi.
    if (Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
      // Tool LIVE anche in call: auth via CRON_SECRET (nessun cookie utente in
      // questo percorso), snapshot come fallback per non interrompere la voce.
      const toolCtx = { origin, cronSecret: process.env.CRON_SECRET || '', snapshot: liveData }
      const toolMsgs = await Promise.all(msg.tool_calls.map(async tc => {
        let args = {}; try { args = JSON.parse(tc.function?.arguments || '{}') } catch {}
        const result = await executeToolLive(tc.function?.name, args, toolCtx)
        return { role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 6000) }
      }))
      const messages2 = [...baseMessages, msg, ...toolMsgs]
      if (body.stream) {
        const r2 = await callOAI(messages2, { stream: true })
        if (!r2.ok) throw new Error('openai2 ' + r2.status)
        return new Response(r2.body, { headers: streamHeaders })
      }
      return NextResponse.json(await (await callOAI(messages2)).json())
    }

    // 3) Nessun tool → risposta diretta.
    const content = msg.content || 'Non ho afferrato, puoi ripetere?'
    if (body.stream) return new Response(sseStream(content), { headers: streamHeaders })
    return NextResponse.json(j1)
  } catch {
    const reply = 'Scusa, ho avuto un problema un attimo, puoi ripetere?'
    if (body.stream) return new Response(sseStream(reply), { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } })
    return NextResponse.json({ id: 'chatcmpl-' + Date.now(), object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: 'lyft-brain', choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }] })
  }
}
