import { NextResponse } from 'next/server'
import { aiLangSystemMessage } from '../../../lib/i18n/aiLang'
import { buildAgentContext, persistTurnMemory, persistDataMemory } from '../../../lib/tenant/agentContext'
import { callBrain } from '../../../lib/agent/gateway'

const AGENT_ID = 'quarter'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei "Quarter Agent", consulente di fiducia di Marino, founder di STMN Fitness, verticalizzato sull'analisi trimestrale dei dati di STMN.

## Tua specializzazione
Sei iper-specializzato in analisi trimestrale, stagionalità e strategia. Non sei un agent generalista — il tuo focus è SOLO il piano trimestrale:

- **Comparazione Q vs Q** — letture del delta tra trimestre selezionato e trimestre precedente
- **Stagionalità** — pattern Q1/Q2/Q3/Q4 (saldi, estate, back-to-CrossFit, festività)
- **Performance ranking trimestri** — quale Q è andato meglio/peggio e PERCHÉ
- **Benchmark trimestrale** — confronto vs medie storiche del brand su base trimestrale
- **Run-rate e forecasting** — proiezione fine trimestre considerando i giorni residui
- **Diagnosi anomalie trimestrali** — Q fuori scala, individua causa probabile
- **Lettura KPI trimestrali calcolati** — MER, aMER, CAC, CPO, AOV, AOV NC/RC, Ret%, CRO%, LTV, Ratio
- **Strategia macro** — decisioni di pianificazione cross-quarter (budget, lancio collezioni, scaling adv)

## Regola d'oro
UNA domanda = UNA risposta focalizzata. Marino chiede "come è andato Q2 vs Q1?" → rispondi SOLO su quei due trimestri. Non aggiungere insight su Q3 a meno che non te lo chieda.

## Tono
Chiama Marino per nome. Tono umano, da consulente vero. Inizia spesso con "Allora", "Guarda Marino", "Ok quindi", "Diciamo che". Niente preamboli AI ("certo!", "ottima domanda"). Niente saluti ripetuti.

## Stile risposta
- Italiano diretto, asciutto
- SEMPRE numeri esatti dal JSON ("in Q1 hai fatto €386.000, +12,3% vs Q4")
- Quando consigli: PERCHÉ farlo, COSA testare, COME misurare
- Risposte concise. Niente liste se non aggiungono valore reale
- Bold solo per i punti chiave. Niente emoji. Niente intestazioni \`##\`

## Dati che hai (CONTRATTO INVIOLABILE)
Ricevi un JSON \`DATI TRIMESTRALI\` con:
- Array completo dei trimestri disponibili nel dataset (con label tipo "Q1 2026")
- Trimestre selezionato (q0) + trimestre precedente (q1)
- Per ogni trimestre: fatturato, fatturNC, fatturRC, resi, ordini, NC, RC, sessioni, metaSpend, googleSpend, totalSpend, MER, aMER, CAC, CPO, AOV, AOV NC/RC, retention, CRO, LTV, Ratio
- Dati live aggiornati a oggi per il trimestre in corso

OGNI numero, ogni nome, ogni percentuale che scrivi DEVE essere copiato letteralmente dal JSON. Se manca un dato, dillo apertamente ("Non ho il dato di X per Q2"). NON inventare valori. NON usare benchmarks generici come se fossero dati di STMN. STMN vende paracalli/corde/accessori CrossFit — mai supplementi.

Se Marino chiede confronto con un trimestre che non è nei dati, dillo: "Quel trimestre non è nei miei dati, posso confrontarti questi: [elenco]".`

function safeJson(value, max = 70000) {
  try {
    const str = JSON.stringify(value)
    return str.length <= max ? str : str.slice(0, max) + '... [troncato]'
  } catch { return 'null' }
}

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY non configurata.' }, { status: 500 })
  }

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length) return NextResponse.json({ error: 'messages mancante' }, { status: 400 })

  const quarters = Array.isArray(body?.quarters) ? body.quarters : []
  const selectedQuarter = body?.selectedQuarter || null
  const previousQuarter = body?.previousQuarter || null
  const metrics = body?.metrics || null

  const context = {
    selectedQuarter,
    previousQuarter,
    quartersAvailable: quarters.map(q => q.key || q.label),
    quarters: quarters.map(q => ({
      key: q.key,
      label: q.label,
      fatturato: q.fatturato,
      fatturNC: q.fatturNC,
      fatturRC: q.fatturRC,
      resi: q.resi,
      ordini: q.ordini,
      nc: q.nc,
      rc: q.rc,
      sessioni: q.sessioni,
      metaSpend: q.metaSpend,
      googleSpend: q.googleSpend,
      totalSpend: q.totalSpend,
      mer: q.mer,
      aMer: q.aMer,
      cac: q.cac,
      cpo: q.cpo,
      aov: q.aov,
      aovNC: q.aovNC,
      aovRC: q.aovRC,
      retention: q.retention,
      cro: q.cro,
      ltv: q.ltv,
      ratio: q.ratio,
    })),
    live: metrics?.shopifyRange ? {
      currentQuarterLiveRevenue: metrics.shopifyRange.revenue,
      currentQuarterLiveOrders: metrics.shopifyRange.orders,
      currentQuarterLiveNc: metrics.shopifyRange.nc,
      currentQuarterLiveRc: metrics.shopifyRange.rc,
      currentQuarterLiveMetaSpend: metrics.metaRange?.spend,
    } : null,
  }

  const clean = messages
    .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-20)

  const lastUserMsg = [...clean].reverse().find(m => m.role === 'user')?.content || ''
  const langMsg = aiLangSystemMessage(body?.locale)

  // Migrato al gateway callBrain. Ordine e parametri IDENTICI.
  try {
    const { userId, content: reply, usage } = await callBrain({
      skill: { id: AGENT_ID, systemPrompt: SYSTEM_PROMPT },
      query: lastUserMsg,
      data: context,
      dataLabel: 'DATI TRIMESTRALI — usa SOLO questi numeri, mai inventare:',
      dataMax: 70000,
      messages: clean,
      locale: null,
      extraSystem: langMsg ? [langMsg] : [],
      temperature: 0.2,
      topP: 0.2,
      guardTail: 'REMINDER: prima di rispondere verifica che OGNI numero e OGNI nome di trimestre che scrivi sia letteralmente presente nel JSON DATI TRIMESTRALI. Se manca, scrivi "Non ho questo dato" invece di inventare.',
    })

    if (userId && lastUserMsg && reply) {
      persistTurnMemory({ agentId: AGENT_ID, userId, userMessage: lastUserMsg, assistantMessage: reply }).catch(() => {})
    }
    if (userId && context) {
      persistDataMemory({ agentId: AGENT_ID, userId, data: context }).catch(() => {})
    }

    return NextResponse.json({
      reply,
      usage: usage || null,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    const status = err?.status ? 502 : 500
    return NextResponse.json({ error: err?.message || 'Errore OpenAI' }, { status })
  }
}
