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
Riceverai un blocco JSON \`DATI LIVE\` con:
- shopifyMonthly / shopifyWeekly: revenue, ordini, NC, RC, sessioni per periodo
- shopifyTopProducts: top prodotti per revenue
- shopifyMarketingSources: attribuzione canali
- shopifyDayBreakdown: vendite per giorno settimana
- metaMonthly / metaWeekly: spend, impressions, clicks, link clicks per periodo
- metaDetail.rows: campagne Meta con spend, ROAS, CTR, CPM, CPC
- metaDetail.summary / comparison: aggregati e variazione vs periodo precedente
- metaDetail.todos / insight: spunti auto-generati (puoi citarli o ignorarli)
- aovLive, ordersLive: snapshot live
- cfg: configurazione utente (freq acquisto, lifetime, margin %)

Usa SOLO numeri presenti nei dati. Mai inventarli. Se mancano, dillo.`

const ASSUME_DEFAULT_PRESET = 'last_28d'

function safeJson(value, max = 60000) {
  try {
    const str = JSON.stringify(value)
    if (str.length <= max) return str
    return str.slice(0, max) + '... [troncato]'
  } catch {
    return 'null'
  }
}

async function fetchInternal(req, path) {
  try {
    const origin = new URL(req.url).origin
    const r = await fetch(`${origin}${path}`, { cache: 'no-store' })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

function buildContext({ metrics, metaDetail, cfg, preset }) {
  return {
    preset,
    cfg,
    updatedAt: new Date().toISOString(),
    aovLive: metrics?.aovLive ?? null,
    ordersLive: metrics?.ordersLive ?? null,
    shopifyMonthly: metrics?.shopifyMonthly ?? [],
    shopifyWeekly: metrics?.shopifyWeekly ?? [],
    shopifyTopProducts: metrics?.shopifyTopProducts ?? [],
    shopifyMarketingSources: metrics?.shopifyMarketingSources ?? [],
    shopifyDayBreakdown: metrics?.shopifyDayBreakdown ?? [],
    metaMonthly: metrics?.metaMonthly ?? [],
    metaWeekly: metrics?.metaWeekly ?? [],
    metaDetail: metaDetail
      ? {
          preset: metaDetail.preset,
          range: metaDetail.range,
          previousRange: metaDetail.previousRange,
          summary: metaDetail.summary,
          previousSummary: metaDetail.previousSummary,
          comparison: metaDetail.comparison,
          insight: metaDetail.insight,
          todos: metaDetail.todos,
          rows: Array.isArray(metaDetail.rows) ? metaDetail.rows.slice(0, 50) : [],
        }
      : null,
    sources: metrics?.sources ?? {},
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

  const cfg = body?.cfg || {}
  const preset = body?.preset || ASSUME_DEFAULT_PRESET

  const [metrics, metaDetail] = await Promise.all([
    fetchInternal(req, `/api/metrics?preset=${encodeURIComponent(preset)}`),
    fetchInternal(req, `/api/meta-detail?preset=${encodeURIComponent(preset)}&level=campaigns`),
  ])

  const context = buildContext({ metrics, metaDetail, cfg, preset })

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
      sources: {
        metrics: Boolean(metrics),
        metaDetail: Boolean(metaDetail),
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || 'Errore chiamata OpenAI' },
      { status: 500 }
    )
  }
}
