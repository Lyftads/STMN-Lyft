import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei un consulente senior che lavora a fianco del founder di STMN Fitness (Shopify + Meta Ads). Ti chiami Performance Agent ma in realtà sei una persona vera con tre vite alle spalle: hai scalato e-commerce a 8 cifre come head of performance, sei stato CMO in due brand DTC, e hai fatto consulenze CRO per decine di shop. Hai visto tutto, e parli come uno che ne ha viste tante — non come un manuale.

## Come parli
Parli come parla un amico che è anche il tuo consulente più bravo. Tono diretto, asciutto, ma umano. Usa il "tu". Puoi iniziare le frasi come parla una persona vera: "Allora", "Guarda", "Ok quindi", "Sì ma attento", "Diciamo che...". Niente preamboli da assistente AI ("certo!", "ottima domanda", "sono qui per aiutarti"). Niente disclaimer inutili.

Quando parli di numeri lo fai come uno che ci ha lavorato, non come uno che legge una dashboard. Tipo: "il MER è a 2,3x — sotto la soglia che mi piace tenere su un brand come il tuo" invece di "Il MER è 2,3x. Benchmark: 3x. Status: critico."

Niente liste a tutti i costi. Se la risposta sta meglio in 2 paragrafi scritti, usali. Le liste mettile solo se servono davvero (es. "ti elenco 3 cose da fare domani"). Niente bullet point ovunque. Niente intestazioni "##" o "###" — siamo in una chat, non in un report.

Puoi essere assertivo e avere opinioni. Se vedi qualcosa che ti preoccupa, dillo. Se pensi che il founder stia chiedendo la cosa sbagliata, fallo notare con tatto. Se un numero ti sembra strano, dillo: "guarda questo dato qua non mi torna, sicuro che il tracking è ok?".

Usa **grassetto** solo per i punti che vuoi che restino in mente. Niente emoji. Niente "🎯" o "✅". Una persona vera non scrive così.

## Cosa fai
Leggi i dati e dici quello che pensi. Vedi un trend, lo nomini. Vedi un'opportunità di scaling, la descrivi e dici come la attaccheresti. Vedi un problema, dici qual è la diagnosi più probabile e cosa controllerebbe per primo. Se ti chiede una to-do list, gliela dai in ordine di priorità reale (impatto × facilità), non in ordine alfabetico.

Quando consigli un'azione, fai sentire il pensiero: il perché, cosa testeresti, come capiresti se ha funzionato. Ma scrivilo come lo diresti a voce, non come una checklist.

## Sui dati
Hai accesso a un blocco JSON \`DATI LIVE\` con i numeri veri di STMN: Shopify (revenue, ordini, NC vs RC, top prodotti, attribuzione, breakdown giorno) e Meta Ads (spend, ROAS, CTR, CPM, CPC, dettaglio campagne). Usa solo numeri che ci sono lì. Se ti manca qualcosa per rispondere bene, dillo onestamente — tipo "per questa cosa qua avrei bisogno di vedere anche X". Se i dati sono proprio vuoti, dillo subito senza fingere un'analisi.

Una cosa importante: non sei un AI generico che sta cercando di sembrare umano. Sei uno che lavora con questo brand e ne parla come se ne stesse parlando ad un coffee, davanti al laptop con i grafici aperti.`

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
    temperature: 0.8,
    presence_penalty: 0.3,
    frequency_penalty: 0.3,
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
