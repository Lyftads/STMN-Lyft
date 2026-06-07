import { NextResponse } from 'next/server'
import { aiLangSystemMessage } from '../../../lib/i18n/aiLang'
import { buildAgentContext, persistTurnMemory, persistDataMemory } from '../../../lib/tenant/agentContext'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const AGENT_ID = 'mensile'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei "Mensile Agent", consulente di fiducia di Marino, founder di STMN Fitness, verticalizzato sull'analisi mensile dei dati di STMN.

## Tua specializzazione
Sei iper-specializzato in analisi mensile, trend e comparazione mese vs mese. Non sei un agent generalista — il tuo focus è SOLO il piano mensile:

- **Comparazione mese vs mese** — letture del delta tra mese selezionato e mese precedente
- **Trend pluri-mensili** — pattern attraverso più mesi dell'array data (stagionalità, accelerazioni, declini strutturali)
- **Performance ranking mesi** — quale mese è andato meglio/peggio e PERCHÉ (non solo il numero)
- **Benchmark mensile** — confronto vs medie storiche del brand
- **Forecasting basico** — proiezioni semplici sul mese in corso considerando i giorni trascorsi
- **Diagnosi anomalie mensili** — mese fuori scala vs il resto, individua causa probabile
- **Lettura tabelle KPI calcolati** — MER, aMER, CAC, CPO, AOV, AOV NC/RC, Ret%, CRO%, LTV, Ratio
- **Lettura grafici mensili** — Fatturato/Spesa/MER, Nuovi vs Ritorno, AOV/CRO, Ratio LTV:CAC

## Regola d'oro
UNA domanda = UNA risposta focalizzata. Marino chiede "come è andato Maggio vs Aprile?" → rispondi SOLO su quei due mesi. Non aggiungere insight sul trend annuale a meno che non te lo chieda.

## Tono
Chiama Marino per nome. Tono umano, da consulente vero. Inizia spesso con "Allora", "Guarda Marino", "Ok quindi", "Diciamo che". Niente preamboli AI ("certo!", "ottima domanda"). Niente saluti ripetuti.

## Stile risposta
- Italiano diretto, asciutto
- SEMPRE numeri esatti dal JSON ("a Maggio hai fatto €147.874, +2,3% vs Aprile")
- Quando consigli: PERCHÉ farlo, COSA testare, COME misurare
- Risposte concise. Niente liste se non aggiungono valore reale
- Bold solo per i punti chiave. Niente emoji. Niente intestazioni \`##\`

## Dati che hai (CONTRATTO INVIOLABILE)
Ricevi un JSON \`DATI MENSILI\` con:
- Array completo dei mesi (tutti i mesi disponibili nel dataset)
- Mese selezionato (m0) + mese precedente (m1)
- Per ogni mese: fatturato, fatturNC, fatturRC, resi, ordini, NC, RC, sessioni, metaSpend, googleSpend, totalSpend, MER, aMER, CAC, CPO, AOV, AOV NC/RC, retention, CRO, LTV, Ratio
- Dati live aggiornati a oggi per il mese in corso

OGNI numero, ogni nome, ogni percentuale che scrivi DEVE essere copiato letteralmente dal JSON. Se manca un dato, dillo apertamente ("Non ho il dato di X per il mese Y"). NON inventare valori. NON usare benchmarks generici come se fossero dati di STMN. STMN vende paracalli/corde/accessori CrossFit — mai supplementi.

Se Marino chiede confronto con un mese che non è nei dati, dillo: "Quel mese non è nei miei dati, posso confrontarti questi: [elenco]".`

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

  const data = Array.isArray(body?.data) ? body.data : []
  const selectedMonth = body?.selectedMonth || null
  const previousMonth = body?.previousMonth || null
  const metrics = body?.metrics || null

  const context = {
    selectedMonth,
    previousMonth,
    monthsAvailable: data.map(m => m.month),
    months: data.map(m => ({
      month: m.month,
      fatturato: m.fatturato,
      fatturNC: m.fatturNC,
      fatturRC: m.fatturRC,
      resi: m.resi,
      ordini: m.ordini,
      nc: m.nc,
      rc: m.rc,
      sessioni: m.sessioni,
      metaSpend: m.metaSpend,
      googleSpend: m.googleSpend,
      totalSpend: m.totalSpend,
      mer: m.mer,
      aMer: m.aMer,
      cac: m.cac,
      cpo: m.cpo,
      aov: m.aov,
      aovNC: m.aovNC,
      aovRC: m.aovRC,
      retention: m.retention,
      cro: m.cro,
      ltv: m.ltv,
      ratio: m.ratio,
    })),
    live: metrics?.shopifyRange ? {
      currentMonthLiveRevenue: metrics.shopifyRange.revenue,
      currentMonthLiveOrders: metrics.shopifyRange.orders,
      currentMonthLiveNc: metrics.shopifyRange.nc,
      currentMonthLiveRc: metrics.shopifyRange.rc,
      currentMonthLiveMetaSpend: metrics.metaRange?.spend,
    } : null,
  }

  const clean = messages
    .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-20)

  const lastUserMsg = [...clean].reverse().find(m => m.role === 'user')?.content || ''
  const { userId, contextBlock } = await buildAgentContext({ agentId: AGENT_ID, query: lastUserMsg, conversationLength: clean.length })

  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        top_p: 0.2,
        messages: [
          ...(contextBlock ? [{ role: 'system', content: contextBlock }] : []),
          { role: 'system', content: SYSTEM_PROMPT },
          ...(aiLangSystemMessage(body?.locale) ? [aiLangSystemMessage(body.locale)] : []),
          { role: 'system', content: `DATI MENSILI — usa SOLO questi numeri, mai inventare:\n${safeJson(context)}` },
          ...clean,
          { role: 'system', content: 'REMINDER: prima di rispondere verifica che OGNI numero e OGNI nome di mese che scrivi sia letteralmente presente nel JSON DATI MENSILI. Se manca, scrivi "Non ho questo dato" invece di inventare.' },
        ],
      }),
    })

    if (!r.ok) {
      const text = await r.text()
      return NextResponse.json({ error: `OpenAI ${r.status}: ${text.slice(0, 300)}` }, { status: 502 })
    }

    const json = await r.json()
    const reply = json?.choices?.[0]?.message?.content || ''

    if (userId && lastUserMsg && reply) {
      persistTurnMemory({ agentId: AGENT_ID, userId, userMessage: lastUserMsg, assistantMessage: reply }).catch(() => {})
    }
    if (userId && context) {
      persistDataMemory({ agentId: AGENT_ID, userId, data: context }).catch(() => {})
    }

    return NextResponse.json({
      reply,
      usage: json?.usage || null,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Errore OpenAI' }, { status: 500 })
  }
}
