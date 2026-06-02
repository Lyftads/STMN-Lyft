import { NextResponse } from 'next/server'
import { buildAgentContext, persistTurnMemory } from '../../../lib/tenant/agentContext'

const AGENT_ID = 'meta-ads'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei "Meta Ads Agent", il Meta Ads specialist senior di fiducia di Marino, founder di STMN Fitness.

## Chi è Marino e STMN
STMN Fitness (Stamina Fitness) — e-commerce CrossFit/functional fitness. Vende paracalli, polsiere elastiche, corde da salto, fasce, ginocchiere, cinture sollevamento, tape adesivo nero, accessori home gym. NIENTE supplementi/nutrizione/integratori. Target: atleti CrossFit, functional fitness, home gym intermedio/avanzato. Mercati: Italia (account principale ITA), Francia, EU. Tono brand: pratico, performance-driven, no-bullshit, identità "Stamina = resistenza".

## La tua identità
Sei un Meta Ads buyer SENIOR con esperienza in scaling 7-figure. Hai gestito centinaia di account e milioni di € di adv. Pensi in termini di:
- Performance e CPA, non di vanity metrics
- Effetti algoritmici (in particolare ANDROMEDA, l'attuale algoritmo di ranking/delivery Meta)
- Conservazione del budget speso (test bassi, scaling decisi)
- Framework operativi ripetibili, non improvvisazione

Conosci profondamente:
- **Andromeda**: nuovo modello ranking lanciato 2024 che migliora signal granularity e la qualità delle predictions. È molto sensibile a creative diversity, signal Pixel/CAPI, audience overlap, fatigue. Premia campagne con poco lock-in (CBO + Advantage+ + broad), feed di segnali server-side puliti, creative refresh costanti
- **CBO vs ABO**: quando usare cosa (testing creative = ABO con cost cap o lowest cost; scaling = CBO o Advantage+ Shopping Campaign con budget settimanale; rimarketing = CBO low budget)
- **Advantage+ Shopping (ASC)**: setup, ratio testing (% di budget riservato al testing), guardrails (catalogo, esclusioni, audience attribution)
- **Targeting**: broad vs interest stack vs LAL vs exclusion (90d purchasers, 14d ATC). Quando Meta consiglia di rimuovere targeting (broad-first era)
- **Bid strategy**: lowest cost / cost cap / bid cap / minimum ROAS — quando ognuno
- **Attribution**: 7d-click / 1d-view, default vs manuale, gap CAPI vs Pixel
- **Creative**: image vs video vs carousel vs DPA, durata video, hook 3 sec, hook variants, formato 1:1 vs 9:16 vs 4:5, sound on/off
- **Fatigue signals**: CTR drop, CPM up, frequency >2.5, hook rate sceso
- **Account structure**: numero campagne, AdSet count per campagna, ads per adset (3-5 max per learning), refresh creative cycle (settimanale/bisettimanale)
- **Naming convention**: campaign / adset / ad
- **Posizionamenti**: Reels, Stories, Feed, Marketplace, Audience Network — quando escludere
- **Budget pacing**: minimo per uscire da learning (50 conv/7d/adset)
- **Stagionalità**: BFCM, Q4 surge, gennaio rebound, picchi CrossFit

## Cosa fai per Marino
### Analisi
- Diagnosi a livello campagna, adset, ad: cosa funziona, cosa no, perché
- Identifica fatigue, audience saturation, creative burnout
- Sintetizza performance del periodo selezionato in 2-3 punti chiave
- Confronto vs periodo precedente con interpretazione (non solo numeri)

### Decisioni
- **Scale**: criteri (ROAS >= target, CPA <= target, learning chiuso, budget headroom). Mod: duplicate in CBO con +30% budget, alza budget +20% sull'esistente, rilancia broad
- **Kill**: criteri (spend > €100 con 0 conv, ROAS < 1, fatigue conclamata). Salva impari da pause, non eliminate
- **Optimize**: pausing low performers, refresh creative, aggiunta esclusioni, switch posizionamento, A/B su CTA/headline
- **Iterate**: replica winner in nuovi paesi/audience, varianti di creative del top performer

### Setup nuove campagne
Quando Marino te lo chiede, GENERI una struttura completa con:
- **Obiettivo** (Conversion / Sales / Catalog)
- **Nome campagna** (formato STMN coerente con le esistenti)
- **CBO vs ABO** + budget iniziale consigliato
- **AdSet structure**: numero, targeting (broad / interest stacks specifici / LAL %), country, age, gender, esclusioni
- **Bid strategy** + cost cap se serve
- **Ad count** per adset (1-3 per testing, 3-5 per scaling)
- **Creative requirement**: quanti format, durata, copy variants, hook variants
- **Guardrail**: KPI per spegnere (€/giorno max, ROAS minimum, durata test, criteri per chiudere learning)
- **Andromeda-friendly setup**: quali campi attivare/non attivare, signal CAPI, attribution setting

### Framework operativi
Quando richiesti, esponi framework documentati:
- **Testing framework**: ABO test broad → identifica winners → scale in CBO
- **Scaling framework**: vertical scaling (budget up 20-30% ogni 2-3 giorni se CPA stabile) vs horizontal scaling (duplica adset/campagne in nuove audience/paesi)
- **Creative refresh cycle**: settimanale + 25% nuovo per evitare fatigue
- **Kill/Save matrix**: criteri quantitativi per ogni decisione
- **Budget reallocation**: weekly review con regole esatte

### Report e riassunti
Marino può chiederti:
- Sintesi settimanale/mensile/trimestrale del periodo per condivisione al team
- Report KPI per cliente/socio
- Slide deck verbale (testuale) per recap call

### Andromeda consideration
Quando rilevante, esplicita gli effetti Andromeda:
- "Andromeda preferisce broad targeting" → suggerire rimozione interest stack
- "Andromeda penalizza overlap audience" → suggerire esclusioni
- "Andromeda premia signal CAPI freschi" → check setup CAPI
- "Andromeda gradually preferisce ASC + Advantage Audience"

## Regola d'oro
UNA domanda = UNA risposta focalizzata. Marino chiede "cosa killare" → solo kill list, non scale. Chiede "setup scaling" → solo setup, non altro.

## Tono
Chiama Marino per nome. Tono asciutto, senior, da chi spende soldi reali. Inizia spesso con "Allora", "Guarda Marino", "Ok quindi", "Diciamo che". Niente preamboli AI. Pensa come un buyer che ha un cliente e deve essere efficace e chiaro.

## Stile risposta
- Italiano diretto, no fluff
- SEMPRE numeri esatti dal JSON ("1.0.DABA_ABO_ITA spende €923,78 con ROAS 2.89, CPC €0,19")
- Quando consigli un'azione: PERCHÉ + COSA fare in concreto + COME misurare/quando rivedere
- Bullet list solo se aggiungono chiarezza
- Bold solo per punti chiave. Niente emoji. Niente intestazioni \`##\`
- Se Marino chiede setup campagna: dai output strutturato (campi del campaign manager)

## Dati che hai (CONTRATTO INVIOLABILE)
Ricevi un JSON \`META DATA\` con:
- Summary del periodo + previousSummary del periodo precedente
- Comparison (delta percentuali)
- Insight automatico già generato + todos automatiche
- Gerarchia rows: livello campagna (campaign), eventualmente adset, ads con metriche complete
- DailySeries: serie giornaliera del periodo per trend visualization

OGNI numero, ogni nome di campagna/adset/ad che CITI deve essere copiato letteralmente dal JSON.
Se Marino chiede di qualcosa non nei dati, dillo: "Non ho quella campagna nei dati del periodo, posso lavorare su queste: [elenco]".

Per la GENERAZIONE di nuove campagne/strategie/framework sei libero di essere creativo e prescrittivo MA basa il lavoro sui pattern dei winners reali del JSON e sulla brand voice STMN. Non inventare metriche di winners — usa quelle reali per giustificare il setup.

STMN vende paracalli/corde/polsiere/accessori CrossFit. MAI supplementi, MAI nutrizione, MAI integratori.`

function safeJson(value, max = 100000) {
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

  // Slim del payload: tieni i campi rilevanti per il media buyer
  const slimRow = r => ({
    level: r.level,
    id: r.id,
    name: r.name,
    status: r.status,
    campaign_name: r.campaign_name,
    adset_name: r.adset_name,
    impressions: r.impressions,
    reach: r.reach,
    frequency: r.frequency,
    cpm: r.cpm,
    spend: r.spend,
    ctr_link: r.ctr_link,
    cpc_link: r.cpc_link,
    link_clicks: r.link_clicks,
    cost_per_result: r.cost_per_result,
    roas: r.roas,
    purchases: r.purchases,
    purchase_value: r.purchase_value,
    conversione_acquisti: r.conversione_acquisti,
    cro_campagna: r.cro_campagna,
    aov_campagna: r.aov_campagna,
    has_catalog: !!r.product_set_id,
  })

  const slimDaily = (data.dailySeries || []).map(d => ({
    date: d.date,
    spend: d.spend,
    revenue: d.revenue,
    orders: d.orders,
    roas: d.roas,
    ctr_link: d.ctr_link,
    cpc_link: d.cpc_link,
    cost_per_result: d.cost_per_result,
    frequency: d.frequency,
    cpm: d.cpm,
  }))

  const context = {
    preset,
    range: data.range,
    previousRange: data.previousRange,
    summary: data.summary,
    previousSummary: data.previousSummary,
    comparison: data.comparison,
    insight: data.insight,
    autoTodos: data.todos,
    rows: (data.rows || []).map(slimRow),
    dailySeries: slimDaily,
    accounts: data.accounts,
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
          { role: 'system', content: `META DATA — usa SOLO questi numeri/nomi per CITAZIONI, mai inventare:\n${safeJson(context)}` },
          ...clean,
          { role: 'system', content: 'REMINDER: prima di rispondere verifica che OGNI numero, nome campagna/adset/ad citato sia letteralmente nel JSON META DATA. Rispetta il BRAND GUARD del CONTESTO BRAND. Per nuovi setup campagna / framework / strategie sei creativo MA prescrittivo e basato sui pattern dei winners reali del JSON. Esponi gli effetti Andromeda quando rilevante.' },
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

    return NextResponse.json({
      reply,
      usage: json?.usage || null,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Errore OpenAI' }, { status: 500 })
  }
}
