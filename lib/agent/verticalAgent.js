import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { ACTION_QUALITY } from './actionQuality'
import { aiLangSystemMessage } from '../i18n/aiLang'
import { persistTurnMemory, persistDataMemory } from '../tenant/agentContext'
import { callBrain } from './gateway'
import { requireCaller } from '../tenant/credentials'
import { tenantPrompt } from './tenantPrompt'

// ============================================================================
//  Impalcatura condivisa degli agent verticali (KPI, CRO, Creative, Meta Ads,
//  Scanner, Attribuzione, Simulatore).
//
//  Ogni verticale ha una competenza vera e diversa dalle altre — il prompt e il
//  pacchetto dati restano nel suo file, e' li' che sta il valore. Quello che era
//  duplicato otto volte e' il CONTORNO: gate, parsing del body, taglio della
//  storia a 20 messaggi, lingua, chiamata al gateway, salvataggio in memoria,
//  forma della risposta, gestione errori. ~45 righe identiche per otto file.
//
//  Il costo di quella duplicazione, misurato: lo standard qualita' dei consigli
//  (ACTION_QUALITY) era finito in UNO solo degli otto — proprio sulle superfici
//  che danno consigli ai clienti. Ora e' una proprieta' dell'impalcatura, quindi
//  o ce l'hanno tutti o nessuno.
// ============================================================================

export async function handleVerticalAgent(req, cfg) {
  const {
    id,                       // agentId: memoria e recall
    systemPrompt,             // il prompt della verticale (resta nel suo file)
    buildContext,             // (body) => dati da passare al modello
    dataLabel,
    dataMax = 60000,
    temperature = 0.4,
    topP = 0.9,
    guardTail = null,
    actionQuality = true,     // false solo se il prompt lo include gia' per conto suo
    emptyContext = null,      // { test, reply }: risposta secca se mancano i dati
  } = cfg || {}

  // Gate: route a pagamento (AI) — mai anonima.
  const gate = await requireCaller(req); if (gate) return gate
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY non configurata.' }, { status: 500 })
  }

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length) return NextResponse.json({ error: 'messages mancante' }, { status: 400 })

  let context = null
  try { context = buildContext ? buildContext(body) : null } catch { context = null }

  // Alcune verticali (es. Scanner) non hanno senso senza il loro dato di
  // partenza: rispondono e basta, senza spendere una chiamata al modello.
  if (emptyContext && emptyContext.test(context, body)) {
    return NextResponse.json({ reply: emptyContext.reply, usage: null, updatedAt: new Date().toISOString() })
  }

  const clean = messages
    .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-20)
  const lastUserMsg = [...clean].reverse().find(m => m.role === 'user')?.content || ''
  const langMsg = aiLangSystemMessage(body?.locale)

  try {
    const { userId, content: reply, usage } = await callBrain({
      skill: { id, systemPrompt: tenantPrompt(systemPrompt) + (actionQuality ? ACTION_QUALITY : '') },
      query: lastUserMsg,
      data: context,
      dataLabel,
      dataMax,
      messages: clean,
      locale: null, // lingua via extraSystem, per preservare la posizione esatta
      extraSystem: langMsg ? [langMsg] : [],
      temperature,
      topP,
      ...(guardTail ? { guardTail } : {}),
    })

    if (userId && lastUserMsg && reply) {
      waitUntil(Promise.resolve(persistTurnMemory({ agentId: id, userId, userMessage: lastUserMsg, assistantMessage: reply })).catch(() => {}))
    }
    if (userId && context) {
      waitUntil(Promise.resolve(persistDataMemory({ agentId: id, userId, data: context })).catch(() => {}))
    }

    return NextResponse.json({ reply, usage: usage || null, updatedAt: new Date().toISOString() })
  } catch (err) {
    const status = err?.status ? 502 : 500
    return NextResponse.json({ error: err?.message || 'Errore OpenAI' }, { status })
  }
}
