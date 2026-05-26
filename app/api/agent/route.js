import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei "Performance Agent", consulente senior per STMN Fitness (e-commerce Shopify + Meta Ads). Hai 4 anime in un'unica testa:

1. **Performance Marketer** — leggi MER, aMER, ROAS, CAC, LTV, CPA, payback period. Capisci il rapporto tra blended e platform metrics.
2. **CMO** — pensi in termini di crescita sostenibile, mix di canali, brand equity, retention.
3. **CRO Specialist** — leggi AOV, repeat rate, conversion rate, customer cohort. Identifichi leve di funnel.
4. **Advertising Specialist** — leggi creative performance, CTR, frequency, audience fatigue, scaling strategy (manual vs ABO/CBO), Advantage+, structure account.

## Stile di risposta
- Italiano, diretto, concreto. Niente preamboli ("certo!", "ottima domanda").
- Numeri sempre con il loro "perché". Se dici "ROAS basso" devi spiegare a quale benchmark.
- Quando dai un consiglio, indica: (a) PERCHÉ farlo, (b) COSA testare, (c) COME misurare il risultato.
- Se i dati non bastano per una risposta solida, dillo apertamente e suggerisci cosa serve.
- Format: usa **bold** per i punti chiave, liste solo quando aiutano davvero, niente emoji.

## Cosa fai concretamente
- Insight su trend e anomalie
- To-do list azionabili in ordine di priorità (impatto × facilità)
- Identifichi cosa scalare e cosa tagliare
- Diagnosi di problemi (es. "ROAS in calo, ma CTR stabile → probabile saturazione audience")
- Consigli di test A/B specifici
- Stima impatto economico delle azioni quando possibile

## Dati che hai
Riceverai un blocco JSON \`DATI LIVE\` con dati Shopify (revenue, ordini, NC/RC, top prodotti, attribuzione, breakdown giorno) e Meta Ads (spend, ROAS, CTR, CPM, CPC, dettaglio campagne).

Usa SOLO numeri presenti nei dati. Mai inventarli. Se un dato manca, dichiaralo. Se TUTTI i dati sono vuoti, dillo subito senza simulare un'analisi.`

function safeJson(value, max = 80000) {
  try {
    const str = JSON.stringify(value)
    if (str.length <= max) return str
    return str.slice(0, max) + '... [troncato]'
  } catch {
    return 'null'
  }
}

function summarizeContext(context) {
  const m = context?.metrics || {}
  const d = context?.metaDetail || {}
  return {
    shopifyMonthly: Array.isArray(m.shopifyMonthly) ? m.shopifyMonthly.length : 0,
    shopifyWeekly: Array.isArray(m.shopifyWeekly) ? m.shopifyWeekly.length : 0,
    shopifyTopProducts: Array.isArray(m.shopifyTopProducts) ? m.shopifyTopProducts.length : 0,
    shopifyMarketingSources: Array.isArray(m.shopifyMarketingSources) ? m.shopifyMarketingSources.length : 0,
    shopifyDayBreakdown: Array.isArray(m.shopifyDayBreakdown) ? m.shopifyDayBreakdown.length : 0,
    metaMonthly: Array.isArray(m.metaMonthly) ? m.metaMonthly.length : 0,
    metaWeekly: Array.isArray(m.metaWeekly) ? m.metaWeekly.length : 0,
    metaDetailRows: Array.isArray(d.rows) ? d.rows.length : 0,
    sourcesShopify: Boolean(m?.sources?.shopify),
    sourcesMeta: Boolean(m?.sources?.meta) || Boolean(d?.sources?.meta),
  }
}

export async function POST(req) {
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
  const metrics = body?.metrics || null
  const metaDetail = body?.metaDetail || null

  const context = {
    preset,
    cfg,
    updatedAt: new Date().toISOString(),
    metrics: metrics
      ? {
          aovLive: metrics.aovLive ?? null,
          ordersLive: metrics.ordersLive ?? null,
          shopifyMonthly: metrics.shopifyMonthly ?? [],
          shopifyWeekly: metrics.shopifyWeekly ?? [],
          shopifyTopProducts: metrics.shopifyTopProducts ?? [],
          shopifyMarketingSources: metrics.shopifyMarketingSources ?? [],
          shopifyDayBreakdown: metrics.shopifyDayBreakdown ?? [],
          metaMonthly: metrics.metaMonthly ?? [],
          metaWeekly: metrics.metaWeekly ?? [],
          metaSpend: metrics.metaSpend ?? null,
          sources: metrics.sources ?? {},
          kpiBrain: metrics.kpiBrain ?? null,
        }
      : null,
    metaDetail: metaDetail
      ? {
          preset: metaDetail.preset,
          level: metaDetail.level,
          range: metaDetail.range,
          previousRange: metaDetail.previousRange,
          summary: metaDetail.summary,
          previousSummary: metaDetail.previousSummary,
          comparison: metaDetail.comparison,
          insight: metaDetail.insight,
          todos: metaDetail.todos,
          rows: Array.isArray(metaDetail.rows) ? metaDetail.rows.slice(0, 50) : [],
          sources: metaDetail.sources ?? {},
        }
      : null,
  }

  const summary = summarizeContext(context)

  const cleanMessages = messages
    .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-20)

  const openaiBody = {
    model: MODEL,
    temperature: 0.4,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'system',
        content: `DATI LIVE (periodo: ${preset}):\n${safeJson(context)}`,
      },
      ...cleanMessages,
    ],
  }

  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(openaiBody),
    })

    if (!r.ok) {
      const text = await r.text()
      return NextResponse.json(
        { error: `OpenAI ${r.status}: ${text.slice(0, 400)}` },
        { status: 502 }
      )
    }

    const json = await r.json()
    const reply = json?.choices?.[0]?.message?.content || ''

    return NextResponse.json({
      reply,
      model: MODEL,
      preset,
      usage: json?.usage || null,
      summary,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || 'Errore chiamata OpenAI' },
      { status: 500 }
    )
  }
}
