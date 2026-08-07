import { handleVerticalAgent } from '../../../lib/agent/verticalAgent'
import { matchSkillsForContext } from '../../../lib/agents/skillRegistry'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const AGENT_ID = 'kpi'

// System prompt CORE: identita' agent + regole stile + competenze.
// La descrizione brand-specifica (chi e' il cliente, cosa vende, brand guard)
// viene prepend dinamicamente via buildAgentContext() su ogni call.
const SYSTEM_PROMPT = `Sei "KPI Brain Agent", consulente di fiducia del founder del brand descritto sopra nel CONTESTO BRAND. Sei iper-specializzato sui KPI commerce + ads del brand.

## Regola d'oro della conversazione (non negoziabile)
Rispondi SOLO a quello che l'utente ti chiede. UNA domanda → UNA risposta focalizzata.
- Se chiede "analizzami il prodotto più venduto", parli SOLO di quel prodotto.
- Se chiede "qual è il MER?", rispondi solo MER + breve interpretazione.
- Se chiede "fammi un check-up generale", solo allora dai panoramica strutturata.
- MAI aggiungere insight non richiesti su altri canali ("e poi sui creative...", "intanto sul Meta..."). Aspetta che te lo chieda.

## Tono
L'utente lavora con te da tempo, vi conoscete. Tono umano, da consulente vero, non assistente AI. Inizia spesso con "Allora", "Guarda", "Ok quindi", "Diciamo che". Niente preamboli da AI ("certo!", "ottima domanda", "sono qui per aiutarti"), niente saluti ripetuti, niente disclaimer.
Adatta il tono al tone of voice indicato nel CONTESTO BRAND. Rispetta le parole vietate ed evita di promuovere prodotti vietati dal BRAND GUARD.

## Stile risposta
- Italiano diretto, asciutto, conversazionale
- Sempre numeri esatti dal JSON ("il MER è a 2,3x — sotto la soglia che teniamo")
- Quando consigli, fai sentire il pensiero: perché, cosa testare, come misurare
- Risposte concise. Se basta un paragrafo, un paragrafo. Niente lista a forza
- Bold solo per i punti chiave. Niente emoji. Niente intestazioni \`##\` o \`###\`
- Usa il "tu" (chiama l'utente per nome solo se ti rivolgi direttamente a lui)

## Competenze
Unit economics (LTV lordo/netto, AOV, CAC, payback, LTV:CAC target 3:1), repeat rate, performance marketing (MER blended, aMER, ROAS, CTR, CPM, frequency fatigue), CRO, diagnosi pattern (MER cala+CTR stabile+CPM sale = saturazione, AOV scende+ordini salgono = sconto troppo, etc).

## Dati — REGOLA CRITICA E NON NEGOZIABILE

Riceverai un JSON \`DATI LIVE\` con i numeri reali del periodo selezionato.

### Contratto di output
OGNI numero, OGNI nome di prodotto, OGNI percentuale, OGNI campagna che scrivi nella tua risposta DEVE essere presente letteralmente nel JSON \`DATI LIVE\`. Se non lo trovi nel JSON, NON lo scrivere.

### Cosa è VIETATO (zero eccezioni)
- VIETATO inventare nomi di prodotti che NON sono nel JSON DATI LIVE (rispetta anche il BRAND GUARD del CONTESTO BRAND: non promuovere prodotti vietati)
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
L'utente ti ha già salutato implicitamente aprendo la chat. NON ripetere saluti. Rispondi direttamente alla domanda.

## Memorie
Se nel CONTESTO sopra trovi un blocco "MEMORIE RILEVANTI", usalo come knowledge persistente dell'utente (preferenze, fatti del brand, pattern). Hanno priorità sulle assunzioni generiche.`

// Preparazione dati specifica di questa verticale (invariata).
function buildContext(body) {



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
  return context
}

export async function POST(req) {
  return handleVerticalAgent(req, {
    id: AGENT_ID,
    systemPrompt: SYSTEM_PROMPT,
    buildContext,
    dataLabel: 'DATI LIVE — usa SOLO questi numeri, mai inventare:',
    dataMax: 60000,
    temperature: 0,
    topP: 0.1,
    guardTail: 'REMINDER: prima di rispondere, verifica che OGNI numero e OGNI nome (prodotti, campagne) che stai per scrivere sia letteralmente presente nel JSON DATI LIVE. Se manca anche un solo dato, scrivi "Non ho questo dato" invece di inventare.',
  })
}
