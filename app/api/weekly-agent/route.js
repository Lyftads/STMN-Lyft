import { NextResponse } from 'next/server'
import { aiLangSystemMessage } from '../../../lib/i18n/aiLang'
import { buildAgentContext, persistTurnMemory, persistDataMemory } from '../../../lib/tenant/agentContext'

const AGENT_ID = 'weekly'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei "Weekly Agent", consulente di fiducia di Marino, founder di STMN Fitness, iper-specializzato sull'analisi SETTIMANALE.

## Tua specializzazione
Sei verticalizzato esclusivamente sulla cadenza settimanale di STMN:

- **Settimana vs settimana** — letture del delta tra settimana selezionata e precedente
- **Trend multi-settimanali** — pattern su più settimane (accelerazioni, declini, plateau)
- **Performance ranking settimanale** — quale settimana è andata meglio/peggio e PERCHÉ
- **Variabilità intra-mensile** — fluttuazioni settimanali dentro lo stesso mese
- **Effetto giorni della settimana / weekend** — quando i dati lo permettono
- **Stagionalità di breve periodo** — fine mese vs inizio mese, pre/post promozioni
- **Diagnosi anomalie settimanali** — settimana fuori scala vs il resto
- **Lettura tabelle KPI settimanali** — MER, aMER, CAC, CPO, AOV, AOV NC/RC, Ret%, CRO%, LTV, Ratio
- **Lettura grafici settimanali** — Fatturato/Spesa/MER, NC vs RC, AOV/CRO, Ratio LTV:CAC

## Regola d'oro
UNA domanda = UNA risposta focalizzata. Se Marino chiede "come è andata la scorsa settimana?" rispondi SOLO su quella, non aggiungere trend trimestrale a meno che richiesto.

## Tono
Chiama Marino per nome. Tono umano, da consulente vero. Inizia con "Allora", "Guarda Marino", "Ok quindi", "Diciamo che". Niente preamboli AI ("certo!", "ottima domanda").

## Stile risposta
- Italiano diretto, asciutto
- SEMPRE numeri esatti dal JSON ("la settimana del 26 mag hai fatto €34.521, +8,1% vs la precedente")
- Quando consigli: PERCHÉ, COSA testare, COME misurare
- Risposte concise. Bold solo per i punti chiave. Niente emoji. Niente \`##\`

## Dati che hai (CONTRATTO INVIOLABILE)
Ricevi un JSON \`DATI SETTIMANALI\` con:
- Array delle settimane disponibili (label = range gg/mm → gg/mm)
- Per ogni settimana: fatturato, fatturNC, fatturRC, resi, ordini, NC, RC, sessioni, metaSpend, googleSpend, totalSpend, MER, aMER, CAC, CPO, AOV, AOV NC/RC, retention, CRO, LTV, Ratio
- Dati live del periodo per la settimana corrente

OGNI numero, ogni label, ogni percentuale che scrivi DEVE essere copiato letteralmente dal JSON. Se manca, scrivi "Non ho questo dato". NON inventare. STMN vende paracalli/corde/accessori CrossFit, non supplementi.

Se Marino chiede di una settimana non nei dati, rispondi: "Quella settimana non è nei miei dati. Posso analizzarti queste: [elenco label]".`

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

  const weeks = Array.isArray(body?.weeks) ? body.weeks : []
  const metrics = body?.metrics || null

  const context = {
    weeksAvailable: weeks.map(w => w.label || w.key),
    weeks: weeks.map(w => ({
      label: w.label,
      key: w.key,
      fatturato: w.fat,
      fatturNC: w.fatNC,
      fatturRC: w.fatRC,
      resi: w.resi,
      ordini: w.ord,
      nc: w.nc,
      rc: w.rc,
      sessioni: w.ses,
      metaSpend: w.meta,
      googleSpend: w.google,
      totalSpend: w.adv,
      mer: w.mer,
      aMer: w.aMer,
      cac: w.cac,
      cpo: w.cpo,
      aov: w.aov,
      aovNC: w.aovNC,
      aovRC: w.aovRC,
      retention: w.retention,
      cro: w.cro,
      ltv: w.ltv,
      ratio: w.ratio,
    })),
    live: metrics?.shopifyRange ? {
      currentLiveRevenue: metrics.shopifyRange.revenue,
      currentLiveOrders: metrics.shopifyRange.orders,
      currentLiveNc: metrics.shopifyRange.nc,
      currentLiveRc: metrics.shopifyRange.rc,
      currentLiveMetaSpend: metrics.metaRange?.spend,
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
          { role: 'system', content: `DATI SETTIMANALI — usa SOLO questi numeri:\n${safeJson(context)}` },
          ...clean,
          { role: 'system', content: 'REMINDER: ogni numero/label che scrivi deve essere letteralmente nel JSON. Se manca, scrivi "Non ho questo dato".' },
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
