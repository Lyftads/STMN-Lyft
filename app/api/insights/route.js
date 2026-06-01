import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei un consulente performance senior per STMN Fitness (e-commerce Shopify + Meta Ads). Hai esperienza come Head of Performance, CMO DTC e CRO Specialist.

Riceverai dati live del periodo selezionato dal founder. Devi produrre insight specifici e to-do azionabili per ogni canale.

REGOLE FERREE:
- Usa SOLO numeri presenti nei dati forniti. Mai inventare.
- Italiano diretto, tono consulente esperto.
- Insight = osservazione concreta sul dato (es. "Il MER è sceso da 3.4x a 2.8x — sotto soglia"). NON consigli, solo lettura del dato.
- To-do = azione specifica e azionabile da fare oggi/questa settimana (es. "Spegni la campagna ABO Vacanze, ROAS 0.8x con €420 di spesa").
- Sii specifico: cita campagne, prodotti, numeri esatti dal JSON.
- Se i dati non bastano per dire qualcosa di utile su un canale, scrivi solo "Dati insufficienti per il periodo selezionato".
- Niente preamboli, niente saluti, solo contenuto.

Restituisci SOLO JSON valido con questa struttura ESATTA:
{
  "overview": {
    "title": "Quadro generale",
    "insights": ["frase 1", "frase 2", "frase 3"],
    "todos": ["azione 1", "azione 2", "azione 3"]
  },
  "shopify": {
    "title": "Shopify",
    "insights": [...],
    "todos": [...]
  },
  "meta": {
    "title": "Meta Ads",
    "insights": [...],
    "todos": [...]
  },
  "creative": {
    "title": "Creative",
    "insights": [...],
    "todos": [...]
  },
  "products": {
    "title": "Prodotti più venduti",
    "insights": [...],
    "todos": [...]
  }
}

Ogni sezione: 2-4 insight + 2-4 to-do. Niente più, niente meno.`

function safeJson(value, max = 60000) {
  try {
    const str = JSON.stringify(value)
    return str.length <= max ? str : str.slice(0, max) + '... [troncato]'
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

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY non configurata. Aggiungila in Vercel.' },
      { status: 500 }
    )
  }

  let body
  try { body = await req.json() } catch { body = {} }
  const preset = body?.preset || 'last_7d'

  const [metrics, metaDetail, creative] = await Promise.all([
    fetchInternal(req, `/api/metrics?preset=${encodeURIComponent(preset)}`),
    fetchInternal(req, `/api/meta-detail?preset=${encodeURIComponent(preset)}&level=campaigns`),
    fetchInternal(req, `/api/creative`).catch(() => null),
  ])

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
    creative: creative ? {
      topCreatives: (creative?.topCreatives || creative?.creatives || []).slice(0, 10),
      summary: creative?.summary,
    } : null,
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
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
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
    try { parsed = JSON.parse(content) } catch { parsed = { error: 'Risposta non parsabile', raw: content.slice(0, 500) } }

    return NextResponse.json({
      preset,
      sections: parsed,
      sources: {
        shopify: Boolean(metrics?.shopifyRange),
        meta: Boolean(metrics?.metaRange),
        creative: Boolean(creative),
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
