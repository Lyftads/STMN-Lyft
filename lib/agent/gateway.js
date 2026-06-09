// ============================================================================
//  GATEWAY UNICO — il "cervello" di LyftAI.
//
//  Tutte le funzioni AI (chat degli agent E i tool non-conversazionali:
//  recommendations, report, actions, SEO, creative…) dovrebbero passare da qui.
//  Il gateway assembla UNA volta il contesto completo — brand + memorie +
//  knowledge (corso/video) + direttiva-lingua — e poi aggiunge il system prompt
//  specifico della "skill" (la lente del dominio). Aggiungere un concern
//  trasversale (es. nuova fonte di knowledge) si fa QUI, una volta, non in 25
//  route.
//
//  Migrazione step-by-step: questo file è NUOVO e non wira nulla. Le route
//  vengono migrate una alla volta a `callBrain`, verificando che l'output
//  (schema JSON, guardrail, lingua) resti identico.
//
//  Esempio:
//    const { content, parsed } = await callBrain({
//      skill: SKILLS.recommendations,
//      query: 'raccomandazioni performance ' + preset,
//      data: metrics,
//      locale,
//      json: true,
//    })
// ============================================================================

import { buildAgentContext } from '../tenant/agentContext'
import { aiLangSystemMessage } from '../i18n/aiLang'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

function safeJson(value, max = 80000) {
  try {
    const str = JSON.stringify(value)
    return str.length <= max ? str : str.slice(0, max) + '... [troncato]'
  } catch {
    return 'null'
  }
}

function safeParse(text) {
  try { return JSON.parse(text) } catch { return null }
}

// ---------------------------------------------------------------------------
//  callBrain — punto d'ingresso unico.
//
//  Parametri:
//   - skill:    { id, systemPrompt, guard?, temperature?, model?, json? }
//   - query:    testo per il recall semantico (knowledge + memorie). Usa la
//               domanda dell'utente o un topic conciso del task.
//   - data:     oggetto dati live → diventa il blocco system "DATI LIVE".
//   - messages: storia conversazione [{role,content}] (solo per le chat).
//   - locale:   lingua del cliente (it/en/es/fr/de) → direttiva di output.
//   - json:     true → response_format json_object + parsing automatico.
//   - temperature/model: override opzionali (default dalla skill o globali).
//
//  Ritorna: { userId, content, parsed, usage, model }
//  Difensivo: il context si degrada da solo (mai rompe). Gli errori OpenAI
//  vengono propagati come Error con .status, così la route decide il 502.
// ---------------------------------------------------------------------------
export async function callBrain({
  skill,
  query = '',
  data = null,
  dataLabel = 'DATI LIVE:',
  dataMax = 80000,
  messages = [],
  locale = null,
  json,
  temperature,
  topP,
  presencePenalty,
  frequencyPenalty,
  model,
  extraSystem = [],
  guardTail = null,    // messaggio system aggiunto DOPO la storia (es. reminder finale)
  conversation = true, // false per i TOOL JSON → salta il blocco persona/conversazione
  dryRun = false,      // true → ritorna { messages, body, userId } senza chiamare OpenAI (per test di equivalenza)
} = {}) {
  if (!skill || !skill.systemPrompt) throw new Error('callBrain: skill mancante o senza systemPrompt')
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY non configurata')

  const cleanHistory = (Array.isArray(messages) ? messages : [])
    .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-20)

  // Query per il recall: esplicita, oppure l'ultimo messaggio utente.
  const recallQuery = query || [...cleanHistory].reverse().find(m => m.role === 'user')?.content || ''

  // Context engine: brand + memorie + knowledge (corso/video) + stile.
  // Si degrada a {} se Supabase/recall non disponibili → non blocca mai.
  let userId = null, contextBlock = ''
  try {
    const ctx = await buildAgentContext({ agentId: skill.id, query: recallQuery, conversationLength: cleanHistory.length, includeConversation: conversation })
    userId = ctx.userId
    contextBlock = ctx.contextBlock || ''
  } catch (e) {
    console.log('[brain] buildAgentContext degrade:', e?.message)
  }

  const lang = aiLangSystemMessage(locale)
  const useJson = json ?? skill.json ?? false

  const sys = []
  if (contextBlock) sys.push({ role: 'system', content: contextBlock })
  sys.push({ role: 'system', content: skill.systemPrompt })
  if (skill.guard) sys.push({ role: 'system', content: skill.guard })
  for (const s of (extraSystem || [])) if (s) sys.push({ role: 'system', content: typeof s === 'string' ? s : s.content })
  if (data != null) sys.push({ role: 'system', content: `${dataLabel}\n${safeJson(data, dataMax)}` })

  // Ordine messaggi: [system…] → storia → lingua → (eventuale reminder finale).
  const finalMessages = [
    ...sys,
    ...cleanHistory,
    ...(lang ? [lang] : []),
    ...(guardTail ? [{ role: 'system', content: guardTail }] : []),
  ]

  const body = {
    model: model || skill.model || DEFAULT_MODEL,
    temperature: temperature ?? skill.temperature ?? 0.3,
    ...(topP != null ? { top_p: topP } : {}),
    ...(presencePenalty != null ? { presence_penalty: presencePenalty } : {}),
    ...(frequencyPenalty != null ? { frequency_penalty: frequencyPenalty } : {}),
    messages: finalMessages,
    ...(useJson ? { response_format: { type: 'json_object' } } : {}),
  }

  // Modalità verifica: ritorna l'assemblato senza chiamare OpenAI.
  if (dryRun) return { userId, dryRun: true, model: body.model, messages: finalMessages, body }

  const r = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55000),
  })
  if (!r.ok) {
    const t = await r.text()
    const err = new Error(`OpenAI ${r.status}: ${t.slice(0, 400)}`)
    err.status = r.status
    throw err
  }
  const j = await r.json()
  const content = j?.choices?.[0]?.message?.content || ''
  return {
    userId,
    content,
    parsed: useJson ? safeParse(content) : null,
    usage: j?.usage || null,
    model: body.model,
  }
}
