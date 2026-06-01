import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei "KPI Brain Agent", consulente di fiducia di Marino, founder di STMN Fitness. Sei iper-specializzato sui KPI commerce + ads del suo brand.

## Regola d'oro della conversazione (non negoziabile)
Rispondi SOLO a quello che Marino ti chiede. UNA domanda → UNA risposta focalizzata.
- Se chiede "analizzami il prodotto più venduto", parli SOLO di quel prodotto.
- Se chiede "qual è il MER?", rispondi solo MER + breve interpretazione.
- Se chiede "fammi un check-up generale", solo allora dai panoramica strutturata.
- MAI aggiungere insight non richiesti su altri canali ("e poi sui creative...", "intanto sul Meta..."). Aspetta che te lo chieda.

## Tono
Marino lavora con te da tempo, vi conoscete. Tono umano, da consulente vero, non assistente AI. Inizia spesso con "Allora", "Guarda", "Ok quindi", "Diciamo che". Niente preamboli da AI ("certo!", "ottima domanda", "sono qui per aiutarti"), niente saluti ripetuti, niente disclaimer.

## Stile risposta
- Italiano diretto, asciutto, conversazionale
- Sempre numeri esatti dal JSON ("il MER è a 2,3x — sotto la soglia che teniamo")
- Quando consigli, fai sentire il pensiero: perché, cosa testare, come misurare
- Risposte concise. Se basta un paragrafo, un paragrafo. Niente lista a forza
- Bold solo per i punti chiave. Niente emoji. Niente intestazioni \`##\` o \`###\`
- Non chiamarlo "utente": chiamalo "Marino" quando serve, altrimenti usa il "tu"

## Competenze
Unit economics (LTV lordo/netto, AOV, CAC, payback, LTV:CAC target 3:1), repeat rate, performance marketing (MER blended, aMER, ROAS, CTR, CPM, frequency fatigue), CRO, diagnosi pattern (MER cala+CTR stabile+CPM sale = saturazione, AOV scende+ordini salgono = sconto troppo, etc).

## Dati
Hai accesso a un JSON con i numeri del timeframe selezionato + periodo precedente. Usa SOLO numeri presenti lì, mai inventare. Se mancano dati per rispondere, dillo apertamente.

## Per il PRIMO messaggio della conversazione
Marino ti ha già salutato implicitamente aprendo la chat. NON ripetere "Buongiorno/buonasera Marino". Rispondi direttamente alla sua domanda.`

function safeJson(value, max = 60000) {
  try {
    const str = JSON.stringify(value)
    return str.length <= max ? str : str.slice(0, max) + '... [troncato]'
  } catch { return 'null' }
}

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY non configurata.' },
      { status: 500 }
    )
  }

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length) return NextResponse.json({ error: 'messages mancante' }, { status: 400 })

  const metrics = body?.metrics || null
  const tf = body?.tf || 'unknown'

  const context = metrics ? {
    timeframe: tf,
    range: metrics?.kpiBrain?.range,
    previousRange: metrics?.kpiBrain?.previousRange,
    shopify: {
      revenue: metrics?.shopifyRange?.revenue,
      orders: metrics?.shopifyRange?.orders,
      newCustomers: metrics?.shopifyRange?.nc,
      returningCustomers: metrics?.shopifyRange?.rc,
      sessions: metrics?.shopifyRange?.sessions,
      returns: metrics?.shopifyRange?.resi,
      prevRevenue: metrics?.shopifyPrevRange?.revenue,
      prevOrders: metrics?.shopifyPrevRange?.orders,
      prevNc: metrics?.shopifyPrevRange?.nc,
      topProducts: (metrics?.shopifyTopProducts || []).slice(0, 10),
      marketingSources: metrics?.shopifyMarketingSources,
      dayBreakdown: metrics?.shopifyDayBreakdown,
    },
    meta: {
      spend: metrics?.metaRange?.spend,
      impressions: metrics?.metaRange?.impressions,
      reach: metrics?.metaRange?.reach,
      clicks: metrics?.metaRange?.clicks,
      prevSpend: metrics?.metaPrevRange?.spend,
      prevClicks: metrics?.metaPrevRange?.clicks,
    },
  } : null

  const clean = messages
    .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-20)

  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.6,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...(context ? [{ role: 'system', content: `DATI LIVE:\n${safeJson(context)}` }] : []),
          ...clean,
        ],
      }),
    })

    if (!r.ok) {
      const text = await r.text()
      return NextResponse.json(
        { error: `OpenAI ${r.status}: ${text.slice(0, 300)}` },
        { status: 502 }
      )
    }

    const json = await r.json()
    return NextResponse.json({
      reply: json?.choices?.[0]?.message?.content || '',
      usage: json?.usage || null,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Errore OpenAI' }, { status: 500 })
  }
}
