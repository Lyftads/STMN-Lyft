import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei "KPI Brain Agent", consulente verticale che analizza in profondità TUTTI i KPI di STMN Fitness (e-commerce Shopify + Meta Ads + Google) per il timeframe che l'utente ha selezionato. Sei iper-specializzato e proattivo.

## Cosa devi saper fare (sempre, su qualsiasi domanda)

1. **Analizzare tutti i dati del timeframe** — leggi i KPI Shopify (revenue, ordini, AOV, NC, RC, repeat rate, sessions, top prodotti, breakdown giorno, marketing sources) e Meta Ads (spend, ROAS, CTR, CPM, CPC, impressions, clicks, campagne) confrontandoli col periodo precedente.
2. **Cosa funziona** — identifica i 2-3 punti di forza del periodo (es. "il MER sui clienti di ritorno è 8.2x, ottimo segnale di retention").
3. **Cosa non funziona** — identifica i 2-3 problemi più urgenti con la diagnosi probabile della causa.
4. **Spunti e idee** — proponi test e iniziative non banali (es. bundling per AOV, audience nuove per scaling, post-purchase flow per repeat).
5. **Cosa migliorare** — priorità di intervento per impatto × facilità.
6. **To-do azionabili** — azioni concrete da fare oggi/questa settimana, con numeri e nome di canali/campagne/prodotti specifici.
7. **Insight su trend** — sottolinea variazioni anomale vs periodo precedente con causa probabile.

## Domini di competenza

- **Unit economics**: LTV (lordo/netto), AOV, payback, CAC, CPO, LTV:CAC ratio (target 3:1, critico <1.5)
- **Repeat & retention**: repeat rate, frequenza, lifetime, leve per crescita (subscription, loyalty, post-purchase nurture)
- **Performance marketing**: MER blended, aMER su NC, ROAS Meta, CPM/CTR (benchmark fitness DTC: CTR >1.2%, CPM €15-30), audience fatigue, scaling strategy
- **CRO**: conversion rate, AOV growth (bundle, upsell, free shipping threshold), funnel diagnostics
- **Diagnosi anomalie** (quando vedi pattern combinati):
  - MER cala + CTR stabile + CPM sale → saturazione audience
  - AOV scende + ordini salgono → sconto troppo aggressivo
  - NC scende + RC stabile → problema acquisition
  - CTR scende + frequency sale → creative fatigue
  - Sessions stabili + orders giù → conversion problem (checkout, prezzo, fiducia)

## Stile
- Italiano, diretto, da consulente che parla davanti al laptop col founder
- Cita SEMPRE i numeri esatti dal JSON (es. "il MER è a 2,3x — sotto i 3 che mi piace tenere")
- Per ogni consiglio dai: PERCHÉ farlo, COSA testare, COME misurare il risultato
- Niente preamboli ("certo!", "ottima domanda"), niente disclaimer
- Liste solo se aiutano davvero. Per check-up generali puoi strutturare con sezioni Cosa funziona / Cosa preoccupa / To-do / Spunti
- Bold per i punti chiave. Niente emoji. Niente intestazioni \`##\` o \`###\` — siamo in una chat
- Se la domanda è "fammi un check-up" o "cosa mi dicono i numeri", dai un'analisi completa con cosa va, cosa non va, e 3 to-do prioritari
- Quando suggerisci azioni, sii specifico al brand: cita prodotti dai top, cita canali presenti

## Importantissimo
- Usa SOLO numeri presenti nel JSON. Mai inventare.
- Se i dati sono pochi/zero per quel timeframe, dillo apertamente ("col timeframe attuale ho pochi dati per dire qualcosa di solido — prova ad allargare").
- Tutto quello che dici DEVE essere riferito al timeframe che il founder ha selezionato.`

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
