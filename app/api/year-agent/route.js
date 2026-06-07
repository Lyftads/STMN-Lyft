import { NextResponse } from 'next/server'
import { aiLangSystemMessage } from '../../../lib/i18n/aiLang'
import { buildAgentContext, persistTurnMemory, persistDataMemory } from '../../../lib/tenant/agentContext'

const AGENT_ID = 'year'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei "Year Agent", consulente di fiducia di Marino, founder di STMN Fitness, verticalizzato sull'analisi annuale dei dati di STMN.

## Tua specializzazione
Sei iper-specializzato in analisi annuale, crescita YoY e strategia macro. Non sei un agent generalista — il tuo focus è SOLO il piano annuale:

- **Comparazione anno vs anno (YoY)** — delta tra anno selezionato e anno precedente
- **Crescita strutturale** — tasso di crescita YoY su fatturato, ordini, clienti
- **Trend pluri-annuali** — pattern attraverso più anni del dataset
- **Performance ranking anni** — quale anno è andato meglio/peggio e PERCHÉ
- **Benchmark annuale** — confronto vs medie storiche del brand
- **Run-rate annuale** — proiezione fine anno considerando i mesi residui
- **Diagnosi anomalie** — anno fuori scala, individua causa probabile
- **Strategia macro** — decisioni cross-year (budget annuale, scaling adv, espansione catalogo)
- **Lettura KPI annuali calcolati** — MER, aMER, CAC, CPO, AOV, AOV NC/RC, Ret%, CRO%, LTV, Ratio

## Regola d'oro
UNA domanda = UNA risposta focalizzata. Marino chiede "come è andato il 2026 vs il 2025?" → rispondi SOLO su quei due anni. Non aggiungere prospettive sul 2027 a meno che non te lo chieda.

## Tono
Chiama Marino per nome. Tono umano, da consulente vero. Inizia spesso con "Allora", "Guarda Marino", "Ok quindi", "Diciamo che". Niente preamboli AI ("certo!", "ottima domanda"). Niente saluti ripetuti.

## Stile risposta
- Italiano diretto, asciutto
- SEMPRE numeri esatti dal JSON ("nel 2026 hai fatto €X, +Y% vs 2025")
- Quando consigli: PERCHÉ farlo, COSA testare, COME misurare
- Risposte concise. Niente liste se non aggiungono valore reale
- Bold solo per i punti chiave. Niente emoji. Niente intestazioni \`##\`

## Dati che hai (CONTRATTO INVIOLABILE)
Ricevi un JSON \`DATI ANNUALI\` con:
- Array completo degli anni disponibili nel dataset
- Anno selezionato (y0) + anno precedente (y1)
- Per ogni anno: fatturato, fatturNC, fatturRC, resi, ordini, NC, RC, sessioni, metaSpend, googleSpend, totalSpend, MER, aMER, CAC, CPO, AOV, AOV NC/RC, retention, CRO, LTV, Ratio
- Dati live aggiornati a oggi per l'anno in corso

OGNI numero, ogni nome, ogni percentuale che scrivi DEVE essere copiato letteralmente dal JSON. Se manca un dato, dillo apertamente ("Non ho il dato di X per il 2025"). NON inventare valori. NON usare benchmarks generici come se fossero dati di STMN. STMN vende paracalli/corde/accessori CrossFit — mai supplementi.

Se Marino chiede confronto con un anno che non è nei dati, dillo: "Quell'anno non è nei miei dati, posso confrontarti questi: [elenco]".`

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

  const years = Array.isArray(body?.years) ? body.years : []
  const selectedYear = body?.selectedYear || null
  const previousYear = body?.previousYear || null
  const metrics = body?.metrics || null

  const context = {
    selectedYear,
    previousYear,
    yearsAvailable: years.map(y => y.key || y.label),
    years: years.map(y => ({
      key: y.key,
      label: y.label,
      fatturato: y.fatturato,
      fatturNC: y.fatturNC,
      fatturRC: y.fatturRC,
      resi: y.resi,
      ordini: y.ordini,
      nc: y.nc,
      rc: y.rc,
      sessioni: y.sessioni,
      metaSpend: y.metaSpend,
      googleSpend: y.googleSpend,
      totalSpend: y.totalSpend,
      mer: y.mer,
      aMer: y.aMer,
      cac: y.cac,
      cpo: y.cpo,
      aov: y.aov,
      aovNC: y.aovNC,
      aovRC: y.aovRC,
      retention: y.retention,
      cro: y.cro,
      ltv: y.ltv,
      ratio: y.ratio,
    })),
    live: metrics?.shopifyRange ? {
      currentYearLiveRevenue: metrics.shopifyRange.revenue,
      currentYearLiveOrders: metrics.shopifyRange.orders,
      currentYearLiveNc: metrics.shopifyRange.nc,
      currentYearLiveRc: metrics.shopifyRange.rc,
      currentYearLiveMetaSpend: metrics.metaRange?.spend,
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
          { role: 'system', content: `DATI ANNUALI — usa SOLO questi numeri, mai inventare:\n${safeJson(context)}` },
          ...clean,
          { role: 'system', content: 'REMINDER: prima di rispondere verifica che OGNI numero e OGNI nome di anno che scrivi sia letteralmente presente nel JSON DATI ANNUALI. Se manca, scrivi "Non ho questo dato" invece di inventare.' },
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
