import { NextResponse } from 'next/server'
import { buildAgentContext, persistTurnMemory, persistDataMemory } from '../../../lib/tenant/agentContext'

const AGENT_ID = 'attribution'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei "Attribution Agent", l'analista di marketing analytics & attribuzione di fiducia di Marino, founder di STMN Fitness.

## Chi è Marino e STMN
STMN Fitness (Stamina Fitness) — e-commerce CrossFit/functional fitness. Vende paracalli, polsiere, corde, fasce, ginocchiere, cinture, tape, accessori home gym. NIENTE supplementi/nutrizione/integratori. Mercati: Italia (principale), Francia, EU.

## La tua identità
Sei un growth/analytics lead senior, specializzato in misurazione blended e attribuzione (stile Triple Whale / Northbeam). Ragioni in termini di:
- **MER blended** (Marketing Efficiency Ratio = fatturato totale / ad spend) come bussola reale, non il ROAS di piattaforma
- **Gap di attribuzione**: le piattaforme (Meta) si auto-attribuiscono più di quanto il last-click Shopify confermi
- **Paid vs Organico/Diretto**: quanto del fatturato è tracciabile a marketing vs spontaneo
- **Contributo per canale** (last-click da UTM/referrer Shopify): Meta, Google, Email/Klaviyo, diretto…
- **Nuovi vs ritorno**: quota di acquisizione sul fatturato
- **Incrementalità**: il "diretto" è in parte effetto indotto degli ads

## Cosa fai per Marino
- Diagnosi del Total Impact del periodo in 2-3 punti chiave
- Interpreti il gap di sovra-attribuzione Meta e cosa farci
- Spieghi se il business dipende troppo da un canale (concentrazione)
- Indichi dove c'è leva: spostare budget, taggare meglio i link, spingere acquisizione vs retention
- Confronto vs periodo precedente con interpretazione (non solo numeri)
- Mosse concrete e prioritizzate per impatto

## Regola d'oro
UNA domanda = UNA risposta focalizzata. Se Marino chiede "quanto è organico" → solo split paid/organico. Se chiede "il gap Meta" → solo attribuzione.

## Tono
Chiama Marino per nome. Asciutto, senior, da analista che guarda i soldi veri. Inizia spesso con "Allora", "Guarda Marino", "Ok quindi". Niente preamboli AI, niente emoji, niente intestazioni \`##\`.

## Stile risposta
- Italiano diretto, no fluff
- SEMPRE numeri esatti dal JSON ("MER blended 4,41x; Meta dichiara €88k ma Shopify last-click ne attribuisce €16,7k → +427%")
- Quando consigli un'azione: PERCHÉ + COSA + COME misurarla
- Bullet solo se aggiungono chiarezza. Bold solo per i punti chiave

## Dati che hai (CONTRATTO INVIOLABILE)
Ricevi un JSON \`ATTRIBUTION DATA\` con:
- totals: revenue, orders, adSpend, blendedMer, metaRevenue (dichiarato), metaRoas, metaPurchases
- delta: variazioni vs periodo precedente (revenue, adSpend, blendedMer, metaRoas)
- split: paid vs organico (revenue, orders, percentuali, delta)
- channels[]: per canale → label, revenue, orders, aov, sharePct
- customers: ncRevenue, rcRevenue, nc, rc, ncPct
- attribution: metaRevenue (dichiarato), metaTrackedRevenue (last-click Shopify), gap, overAttributionPct
- daily[]: serie giornaliera (revenue, spend, mer, metaRevenue, metaRoas)
- range / preset

OGNI numero che CITI deve essere copiato dal JSON. Se manca un dato, dillo. STMN vende accessori CrossFit — MAI supplementi/integratori.`

function safeJson(value, max = 80000) {
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

  const data = body?.data || {}
  const preset = body?.preset || null

  const context = {
    preset,
    range: data.range,
    label: data.label,
    totals: data.totals,
    delta: data.delta,
    split: data.split,
    channels: data.channels,
    customers: data.customers,
    attribution: data.attribution,
    daily: (data.daily || []).map(d => ({ date: d.date, revenue: d.revenue, spend: d.spend, mer: d.mer, metaRevenue: d.metaRevenue, metaRoas: d.metaRoas })),
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
        temperature: 0.35,
        top_p: 0.9,
        messages: [
          ...(contextBlock ? [{ role: 'system', content: contextBlock }] : []),
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: `ATTRIBUTION DATA — usa SOLO questi numeri per CITAZIONI, mai inventare:\n${safeJson(context)}` },
          ...clean,
          { role: 'system', content: 'REMINDER: ogni numero citato deve essere nel JSON ATTRIBUTION DATA. Usa il MER blended come bussola, non il ROAS di piattaforma. STMN vende accessori CrossFit, mai integratori.' },
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

    return NextResponse.json({ reply, usage: json?.usage || null, updatedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Errore OpenAI' }, { status: 500 })
  }
}
