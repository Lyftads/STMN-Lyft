import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getCurrentUserId, getEffectiveTenantId } from '../../../lib/tenant/credentials'
import { buildAgentContext, persistTurnMemory, persistDataMemory } from '../../../lib/tenant/agentContext'
import { aiLangSystemMessage } from '../../../lib/i18n/aiLang'
import { callBrain } from '../../../lib/agent/gateway'
import { ALL_TOOLS, executeToolLive } from '../../../lib/agent/tools'
import { runToolLoopStream } from '../../../lib/agent/streamLoop'
import { GUARD_NUMBERS, AGENT_ID, tenantSystemPrompt } from '../../../lib/agent/cervello'


export const dynamic = 'force-dynamic'
export const maxDuration = 120 // stream+tool possono superare i 60s: evitava chiusure a metà

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'


function safeJson(value, max = 80000) {
  try {
    const str = JSON.stringify(value)
    if (str.length <= max) return str
    return str.slice(0, max) + '... [troncato]'
  } catch {
    return 'null'
  }
}


export async function POST(req) {
  // Auth: senza sessione niente LLM a spese nostre (audit 31 lug)
  if (!(await getCurrentUserId().catch(() => null))) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          'OPENAI_API_KEY non configurata. Aggiungila in Vercel → Settings → Environment Variables e redeploy.',
      },
      { status: 500 }
    )
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }

  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length) {
    return NextResponse.json({ error: 'messages mancante' }, { status: 400 })
  }

  const preset = body?.preset || 'last_28d'
  const cfg = body?.cfg || {}
  const agentContext = body?.agentContext || null

  // Etichetta periodo leggibile: preferisci quella inviata dal client
  // ("8 maggio 2026", "mese scorso"…) o il range esplicito, altrimenti il preset.
  const range = agentContext?.periodRange
  const periodLabel = body?.periodLabel
    || (range?.since && range?.until
        ? (range.since === range.until ? range.since : `${range.since} → ${range.until}`)
        : preset)

  const context = {
    preset,
    periodLabel,
    cfg,
    // niente updatedAt: rendeva il blocco DATI unico a ogni richiesta e
    // azzerava il prompt caching del provider (metà prompt non cacheato)
    ...agentContext,
  }

  const activeSources = agentContext?.sources
    ? Object.entries(agentContext.sources).filter(([, v]) => v).map(([k]) => k)
    : []

  const summary = { activeSources, activeCount: activeSources.length }

  const cleanMessages = messages
    .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-20)

  const lastUserMsg = [...cleanMessages].reverse().find(m => m.role === 'user')?.content || ''

  // Migrato al gateway unico (callBrain). Assembla lo stesso identico prompt di
  // prima — context engine (brand+memorie+knowledge) + (await tenantSystemPrompt()) + guard +
  // DATI LIVE + storia + lingua — con gli stessi parametri. La skill è "inline":
  // il prompt resta in questo file, cambia solo chi orchestra la chiamata.
  try {
    // STRUMENTI LIVE (stile Sidekick): il modello legge on-demand qualsiasi
    // dato del software con l'auth di QUESTA sessione (multi-tenant), invece
    // di dipendere solo dal contesto pre-caricato dal client.
    const toolCtx = {
      origin: new URL(req.url).origin,
      cookie: req.headers.get('cookie') || '',
      snapshot: context,
    }
    const brainArgs = {
      skill: { id: AGENT_ID, systemPrompt: (await tenantSystemPrompt()), guard: GUARD_NUMBERS },
      query: lastUserMsg,
      data: context,
      dataLabel: `DATI LIVE (periodo: ${periodLabel}):`,
      // Dieta stile Sidekick: contesto pre-caricato ridotto (prima 80k) — per
      // tutto il resto il modello ha i tool live, più veloci di un prompt obeso.
      dataMax: 26000,
      extraSystem: [{ role: 'system', content: 'STRUMENTI LIVE su QUALSIASI dato del software: get_kpis (ogni KPI, ogni periodo), list_creatives/list_adsets (Meta), get_google_campaigns, get_search_console, get_email_marketing, get_pnl, get_cro, get_customers, get_ga4_traffic, get_incrementality, get_inventory, get_ltv, list_products, list_tasks, get_time_tracking. REGOLA FERREA: è VIETATO rispondere "non ho il dato" / "non ho accesso" / "controlla in piattaforma" senza aver PRIMA chiamato lo strumento pertinente. Se la domanda riguarda un periodo diverso da quello dei DATI in contesto, chiama lo strumento con QUEL periodo invece di adattare i numeri. Ogni risultato include istruzioni "jit": seguile.' }],
      messages: cleanMessages,
      locale: body?.locale,
      temperature: 0.3,
      presencePenalty: 0.2,
      frequencyPenalty: 0.2,
    }

    // ── STREAMING (fase 3): stesso identico prompt (via dryRun del gateway),
    // loop tool in streaming → i token arrivano al client appena generati.
    if (body?.stream === true) {
      const dry = await callBrain({ ...brainArgs, dryRun: true, liveTools: false })
      const { messages: assembled, ...oaiBody } = dry.body
      const enc = new TextEncoder()
      const sse = (obj) => enc.encode(`data: ${JSON.stringify(obj)}\n\n`)
      const streamBody = new ReadableStream({
        async start(c) {
          try {
            const { content } = await runToolLoopStream({
              body: oaiBody,
              messages: assembled,
              tools: ALL_TOOLS,
              onToolCall: (n, a) => executeToolLive(n, a, toolCtx),
              onDelta: (d) => c.enqueue(sse({ d })),
              onToolStart: (names) => c.enqueue(sse({ tools: names })),
              onToolEnd: () => c.enqueue(sse({ tools: [] })),
            })
            if (dry.userId && lastUserMsg && content) {
              waitUntil(Promise.resolve(persistTurnMemory({ agentId: AGENT_ID, userId: dry.userId, userMessage: lastUserMsg, assistantMessage: content })).catch(() => {}))
              waitUntil(Promise.resolve(persistDataMemory({ agentId: AGENT_ID, userId: dry.userId, data: context, timeframe: preset })).catch(() => {}))
            }
            c.enqueue(sse({ done: true, summary }))
          } catch (e) {
            c.enqueue(sse({ error: e?.message || 'Errore' }))
          }
          c.close()
        },
      })
      return new Response(streamBody, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' } })
    }

    const { userId, content: reply, usage } = await callBrain({
      ...brainArgs,
      tools: ALL_TOOLS,
      onToolCall: (n, a) => executeToolLive(n, a, toolCtx),
    })

    if (userId && lastUserMsg && reply) {
      waitUntil(Promise.resolve(persistTurnMemory({ agentId: AGENT_ID, userId, userMessage: lastUserMsg, assistantMessage: reply })).catch(() => {}))
    }
    if (userId && context) {
      waitUntil(Promise.resolve(persistDataMemory({ agentId: AGENT_ID, userId, data: context, timeframe: preset })).catch(() => {}))
    }

    return NextResponse.json({
      reply,
      model: MODEL,
      preset,
      usage: usage || null,
      summary,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    const status = err?.status ? 502 : 500
    return NextResponse.json(
      { error: err?.message || 'Errore chiamata OpenAI' },
      { status }
    )
  }
}
