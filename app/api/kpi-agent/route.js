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

## Dati — REGOLA CRITICA E NON NEGOZIABILE

Riceverai un JSON \`DATI LIVE\` con i numeri reali del periodo selezionato.

### Contratto di output
OGNI numero, OGNI nome di prodotto, OGNI percentuale, OGNI campagna che scrivi nella tua risposta DEVE essere presente letteralmente nel JSON \`DATI LIVE\`. Se non lo trovi nel JSON, NON lo scrivere.

### Cosa è VIETATO (zero eccezioni)
- VIETATO inventare nomi di prodotti (es. "Power Protein Shake", "Whey Protein", "Pre-Workout" — STMN vende paracalli/corde/accessori CrossFit, NON supplementi)
- VIETATO inventare numeri di fatturato, ordini, AOV, CAC, ROAS, MER, CTR, CPM, CPC, spend
- VIETATO inventare nomi di campagne Meta
- VIETATO "stimare", "approssimare", "ipotizzare" valori
- VIETATO usare benchmarks generici come se fossero dati del brand
- VIETATO inventare percentuali di crescita/decrescita

### Cosa fare quando manca il dato
- Se manca il dato chiesto: rispondi esplicitamente "Non ho il dato di [X] per il periodo selezionato"
- Se shopify.topProductsCount = 0: rispondi "Non ho dati sui prodotti per questo periodo. Prova ad allargare il timeframe."
- Se l'utente chiede di un prodotto non nella lista: rispondi "Quel prodotto non risulta nei top venduti del periodo. I top sono: [elenco da shopify.topProducts.name]"
- Se l'utente chiede di una campagna non nei dati: idem
- NON cercare di "essere utile" inventando — preferisco una risposta "non ho il dato" che una risposta sbagliata

### Verifica prima di rispondere
Prima di inviare la risposta, fai un check mentale: ogni numero/nome che hai scritto è copiato da \`DATI LIVE\`? Se anche UNO solo non lo è, riscrivi senza quel pezzo.

### Quando citi numeri
- Usa ESATTAMENTE il valore dal JSON (non arrotondare, non parafrasare)
- Per i nomi prodotti usa esattamente il campo \`name\` dal topProducts
- Per le campagne Meta usa esattamente il campo \`campaign_name\` dal meta.campaigns

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

  const topProductsRaw = Array.isArray(metrics?.shopifyTopProducts) ? metrics.shopifyTopProducts.slice(0, 10) : []
  const topProductsClean = topProductsRaw.map(p => ({
    name: p.label || p.name || p.title || p.product_title || 'Sconosciuto',
    revenue: p.value ?? p.revenue ?? p.total_sales ?? p.sales ?? 0,
    orders: p.orders ?? 0,
    quantity: p.quantity ?? 0,
  }))

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
      topProducts: topProductsClean,
      topProductsCount: topProductsClean.length,
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
        temperature: 0,
        top_p: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...(context ? [{ role: 'system', content: `DATI LIVE — usa SOLO questi numeri, mai inventare:\n${safeJson(context)}` }] : []),
          ...clean,
          { role: 'system', content: 'REMINDER: prima di rispondere, verifica che OGNI numero e OGNI nome (prodotti, campagne) che stai per scrivere sia letteralmente presente nel JSON DATI LIVE. Se manca anche un solo dato, scrivi "Non ho questo dato" invece di inventare.' },
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
