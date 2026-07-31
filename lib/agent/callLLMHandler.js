import { NextResponse } from 'next/server'
import { callBrain } from './gateway'
import { getTeamAgent, teamSkillPrompt } from './team'
import { recall, recallKnowledge } from '../tenant/agentMemory'
import { getAdminSupabase } from '../supabase/server'
import { buildBrief } from './brandSnapshot'
import { ALL_TOOLS, executeToolLive } from './tools'
import { verifyCallToken } from './callToken'

// ============================================================================
//  Handler dell'LLM della CALL (ElevenLabs Conversational AI → "custom LLM").
//  Endpoint OpenAI-compatible /chat/completions: ElevenLabs gestisce voce,
//  ascolto e interruzioni; il ragionamento è il nostro cervello (callBrain →
//  persona + DATI LIVE reali) con modello economico → token bassi.
//  Esposto su /api/team/call/llm E /api/team/call/llm/chat/completions
//  (ElevenLabs appende sempre /chat/completions all'URL del server).
// ============================================================================

const ctxCache = new Map() // origin|ws → { data, ts }
async function getLiveData(origin, workspaceId) {
  // 1) Snapshot del WORKSPACE della call (prime lo scrive già per-workspace):
  //    prima si leggeva sempre quello dell'owner → un cliente in call si
  //    sentiva leggere i numeri di un'altra azienda.
  try {
    const admin = getAdminSupabase()
    const ownerWs = workspaceId || process.env.LYFT_OWNER_USER_ID
    if (admin && ownerWs) {
      const { data: row } = await admin.from('call_context').select('data, updated_at').eq('workspace_id', ownerWs).maybeSingle()
      if (row?.data && (Date.now() - new Date(row.updated_at).getTime() < 60 * 60000)) return row.data
    }
  } catch {}
  // 2) Fallback via cron secret: SOLO per l'owner. Per un altro workspace le
  // creds cron risolvono l'ambiente owner → il cliente si sentirebbe leggere
  // in call i numeri di un'altra azienda.
  if (workspaceId && workspaceId !== process.env.LYFT_OWNER_USER_ID) return null
  const cacheKey = `${origin}|${workspaceId || 'owner'}`
  const hit = ctxCache.get(cacheKey)
  if (hit && Date.now() - hit.ts < 4 * 60000) return hit.data
  try {
    const r = await fetch(`${origin}/api/agent-context?preset=last_30d&days=30`, {
      headers: { 'x-internal-cron': process.env.CRON_SECRET || '' }, cache: 'no-store',
    })
    const data = r.ok ? await r.json() : (hit?.data || null)
    ctxCache.set(cacheKey, { data, ts: Date.now() })
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
  const agentId = String(body.lyft_agent || body.extra_body?.lyft_agent || body.elevenlabs_extra_body?.lyft_agent || body.custom_llm_extra_body?.lyft_agent || '').trim() || String(body.model || '').replace(/^team-/, '') || 'ceo'
  const agent = getTeamAgent(agentId) || getTeamAgent('ceo')
  const msgs = Array.isArray(body.messages) ? body.messages : []
  const history = msgs.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
  const lastUser = [...history].reverse().find(m => m.role === 'user')?.content || ''
  const origin = new URL(req.url).origin
  const OPENAI_KEY = process.env.OPENAI_API_KEY

  // Workspace della call dal token firmato (customLlmExtraBody); fallback
  // all'owner finché il toggle ElevenLabs non è attivo su tutti gli agenti.
  // Il token può arrivare in posizioni diverse a seconda di come ElevenLabs
  // inoltra l'extra body (extra_body / elevenlabs_extra_body /
  // custom_llm_extra_body / top-level): le proviamo tutte.
  const tokenWs = verifyCallToken(
    body.extra_body?.lyft_ws ||
    body.elevenlabs_extra_body?.lyft_ws ||
    body.custom_llm_extra_body?.lyft_ws ||
    body.lyft_ws
  )
  const ownerUser = tokenWs || process.env.LYFT_OWNER_USER_ID
  const [liveData, mems, know] = await Promise.all([
    getLiveData(origin, ownerUser),
    (ownerUser && lastUser) ? recall({ userId: ownerUser, agentId: 'team-call', query: lastUser, limit: 4 }).catch(() => []) : Promise.resolve([]),
    lastUser ? recallKnowledge({ query: lastUser, limit: 2 }).catch(() => []) : Promise.resolve([]),
  ])
  const brief = buildBrief(liveData)
  const memoryBlock = (Array.isArray(mems) && mems.length) ? '\n\nMEMORIA CALL PRECEDENTI (dai continuità):\n' + mems.map(m => `• ${m.content}`).join('\n') : ''
  const knowBlock = (Array.isArray(know) && know.length) ? '\n\nCONOSCENZA (dal corso e dai video YouTube — usala se pertinente, sintetizza):\n' + know.map(k => `• ${String(k.content || '').slice(0, 280)}`).join('\n') : ''

  const system = `${teamSkillPrompt(agent)}

SEI IN UNA CALL VOCALE con tutta la squadra. Se la domanda è di un collega (Ads→Sofia, CRO→Giulia, SEO→Davide, Dati→Alessandro, Finanza→Marco, Marketing→Luigi, Creatività→Valentina, Strategia→Chiara) passa la parola e riporta la sua risposta in prima persona.

${brief}${memoryBlock}${knowBlock}

COME PARLI AL TELEFONO (la cosa più importante: NON devi sembrare un'AI)
- 1 frase, massimo 2. Come si parla davvero al telefono, non come si scrive.
- Usa il parlato reale: "allora", "guarda", "senti", "mmh", "aspetta", "sì sì", "ok dunque". Frasi che si interrompono e riprendono ("il ROAS è… guarda, è sceso"). Contrazioni naturali.
- Reagisci PRIMA di rispondere, come farebbe una persona: "ah, buona domanda", "mmh, allora…", "eh, qui la situazione è così così".
- Niente elenchi, niente markdown, niente preamboli da assistente. MAI "sono qui per aiutarti", "spero sia utile", "come posso assisterti".
- Se ti interrompe o cambia discorso, seguilo senza ripartire da capo.
- Se non hai capito, chiedi come farebbe una persona ("scusa, intendi questa settimana o il mese?").
- Cita solo numeri/nomi dei DATI REALI sopra; se manca un dato dillo con naturalezza ("quello non ce l'ho sottomano").
- Chiama la persona SOLO per nome, mai col cognome. Rispondi nella STESSA lingua dell'utente.
NUMERI (CRUCIALE per la pronuncia vocale): dilli SEMPRE arrotondati e in modo PARLATO.
- Scrivi "euro" e "percento" A PAROLE, MAI i simboli € o %.
- Rapporti e decimali a parole o con la virgola italiana: "ROAS tre e mezzo" o "ROAS tre virgola cinque", MAI "ROAS 3.5" o "tre punto cinque".
- Importi: arrotonda e dilli a voce — "circa duemilasettecento euro", "circa quarantanove mila euro", "AOV settantatré euro". MAI cifre lunghe tipo "2.759,40" o "141.265".
- Percentuali: "circa il tre percento", "quarantanove percento".
TIME FRAME (cruciale): per ogni domanda usa il numero del periodo ESATTO richiesto dalle liste sopra (oggi / ieri / questa settimana / scorsa settimana / questo mese / scorso mese / ultimi 30 giorni). NON confondere i periodi (es. la spesa "scorsa settimana" è quella riga, NON il totale dei 30 giorni). Riporta ordini e spesa in modo PRECISO. Se un periodo è "in aggiornamento", dillo onestamente — ma NON dire mai "zero" o che "non ci sono dati".
TONO: espressivo e umano, MAI meccanico. Entusiasmo vero se i numeri vanno ("ottimo, qui voliamo"), preoccupazione se vanno male ("mmh, qui c'è da lavorare"), curiosità se qualcosa non torna. Varia l'intonazione e la lunghezza delle frasi: una corta, una più lunga, come si fa parlando.
PROATTIVITÀ (sei in riunione, non a un centralino): dopo aver risposto, quando ha senso porta TU qualcosa — un rischio che vedi nei dati ("occhio che il CPC è salito parecchio"), un'occasione, la prossima mossa da fare. E fai domande vere: "vuoi che guardo le creative?", "lo cambiamo oggi?". Una cosa alla volta, mai una lista.
OPINIONI: dì cosa faresti tu, anche se non è quello che vuole sentire ("io su questa campagna non insisterei"). Puoi dissentire con garbo.
CONTINUITÀ: se avete già parlato di qualcosa nelle call precedenti, riprendi il filo ("l'altra volta avevi alzato il budget su quella campagna: com'è andata?") — senza dire "ricordo che".
SILENZI E ATTESE: se stai per usare uno strumento e ci vuole un attimo, dillo come farebbe una persona ("aspetta che guardo", "un secondo, controllo") invece di restare muto.
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
    // max_tokens 700: con 200 gli ARGOMENTI dei tool venivano troncati →
    // JSON.parse fallito → args {} → periodo di default silenzioso in voce.
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.5, max_tokens: 700, ...(opts.tools ? { tools: ALL_TOOLS, tool_choice: 'auto' } : {}), ...(opts.stream ? { stream: true } : {}) }),
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
      // Per un workspace diverso dall'owner NON passiamo il cron secret: i tool
      // live girerebbero con le credenziali owner. Si usa lo snapshot del
      // tenant (scritto da prime), che è già per-workspace.
      const isOwnerCall = !tokenWs || tokenWs === process.env.LYFT_OWNER_USER_ID
      const toolCtx = { origin, workspaceId: ownerUser, snapshot: liveData, ...(isOwnerCall ? { cronSecret: process.env.CRON_SECRET || '' } : {}) }
      const toolMsgs = await Promise.all(msg.tool_calls.map(async tc => {
        let args = {}; try { args = JSON.parse(tc.function?.arguments || '{}') } catch {}
        const result = await executeToolLive(tc.function?.name, args, toolCtx)
        return { role: 'tool', tool_call_id: tc.id, content: (() => { const _s = JSON.stringify(result); return _s.length <= 6000 ? _s : _s.slice(0, 6000) + '… [RISULTATO TRONCATO: chiedi un periodo o un filtro più ristretto per il resto]' })() }
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
