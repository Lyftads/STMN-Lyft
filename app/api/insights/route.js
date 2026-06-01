import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei un consulente performance senior per STMN Fitness. Italiano diretto, tono consulente DTC esperto.

OUTPUT: SOLO JSON valido. ZERO testo prima/dopo. La struttura DEVE essere esattamente questa, con TUTTE e 5 le chiavi top-level:

{
  "overview": { "title": "Quadro generale", "insights": [], "todos": [] },
  "shopify": { "title": "Shopify", "insights": [], "todos": [] },
  "meta": { "title": "Meta Ads", "insights": [], "todos": [] },
  "creative": { "title": "Creative", "insights": [], "todos": [] },
  "products": { "title": "Prodotti più venduti", "insights": [], "todos": [] }
}

REGOLE:
- Ogni "insights" e "todos" è SEMPRE un array di stringhe (mai oggetti).
- 2-4 elementi per array. Se i dati non bastano per quel canale, metti UN solo elemento: "Dati insufficienti per il periodo selezionato".
- Insight = lettura concreta del dato con numeri reali (es. "Revenue 12.4K, -18% vs periodo precedente — calo guidato dai NC (-32%)").
- To-do = azione specifica e azionabile (es. "Spegni la campagna XYZ, ROAS 0.8x con €420 di spesa").
- Usa SOLO numeri presenti nei dati forniti. Mai inventare.
- Niente saluti, niente preamboli, niente conclusioni.`

function safeJson(value, max = 60000) {
  try {
    const str = JSON.stringify(value)
    return str.length <= max ? str : str.slice(0, max) + '... [troncato]'
  } catch {
    return 'null'
  }
}

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY non configurata su Vercel.' },
      { status: 500 }
    )
  }

  let body
  try { body = await req.json() } catch { body = {} }

  const preset = body?.preset || 'last_7d'
  const metrics = body?.metrics || null
  const metaDetail = body?.metaDetail || null

  if (!metrics) {
    return NextResponse.json(
      { error: 'Dati metrics mancanti nel body.' },
      { status: 400 }
    )
  }

  const context = {
    preset,
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
      campaigns: (metaDetail?.rows || []).slice(0, 20),
      summary: metaDetail?.summary,
      comparison: metaDetail?.comparison,
    },
  }

  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        top_p: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: 'OGNI numero e OGNI nome (prodotti, campagne) nella tua risposta DEVE essere copiato letteralmente dal JSON dati. Vietato inventare. Se manca, scrivi "Dati insufficienti".' },
          { role: 'user', content: `Periodo: ${preset}\n\nDATI:\n${safeJson(context)}` },
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
    const content = json?.choices?.[0]?.message?.content || '{}'

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      return NextResponse.json(
        { error: 'AI ha risposto con JSON malformato', raw: content.slice(0, 300) },
        { status: 502 }
      )
    }

    return NextResponse.json({
      preset,
      sections: parsed,
      sources: {
        shopify: Boolean(metrics?.shopifyRange),
        meta: Boolean(metrics?.metaRange),
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
