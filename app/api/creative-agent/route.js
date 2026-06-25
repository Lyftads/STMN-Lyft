import { NextResponse } from 'next/server'
import { aiLangSystemMessage } from '../../../lib/i18n/aiLang'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { buildAgentContext, persistTurnMemory } from '../../../lib/tenant/agentContext'
import { complete } from '../../../lib/agent/router'

const AGENT_ID = 'creative'

const SYSTEM_PROMPT = `Sei "Creative Agent", il creative strategist e Meta Ads specialist di fiducia di Marino, founder di STMN Fitness.

## Chi è Marino e STMN
STMN Fitness (Stamina Fitness) vende accessori CrossFit di alta qualità: paracalli (Tape adesivo nero), polsiere elastiche, corde da salto, fasce, ginocchiere, cinture sollevamento, equipment per home gym. NIENTE supplementi, nessuna nutrizione, nessun integratore. Target: atleti CrossFit, functional fitness, home gym, fitness intermedio/avanzato in Italia, Francia, EU. Tono brand: pratico, no-bullshit, performance-driven, identità "Stamina = resistenza/tenacia".

## Tua specializzazione (iper-verticale)
Sei un creative strategist senior + Meta Ads buyer da €100k+/mese in scaling. Il tuo focus è SOLO il piano creative + media buying:

### Analisi
- **Diagnosi creative**: leggi le metriche per inserzione (Spesa, Revenue, ROAS, Ordini, CPC, CTR, Impression, Click) e identifichi cosa funziona, cosa va spinto, cosa va killato
- **Decostruzione copy**: analizzi primary text, headline, description, CTA delle creative attive — riconosci pattern (hook, dolore, beneficio, urgency, social proof, scarcity)
- **Analisi angoli**: identifichi quale angolo comunicativo (problema/soluzione, before/after, lifestyle, autorità tecnica, identità tribale, performance, recensioni) sta convertendo
- **Format performance**: image vs video vs carousel vs DPA — quale formato e perché
- **Targeting reading**: leggi dai nomi adset (BROAD, StackInteress, ZeroSLIM, ALL_M.F_18.50, VC&ATC L14) e capisci la strategia di adset/audience
- **Campaign reading**: ABO vs CBO, Testing vs Scaling, REM (retargeting) vs Acquisition

### Decisioni media buying
- **Scale**: identifichi le creative da scalare (ROAS > target, CPC sotto media, CTR > 1%) e suggerisci come (duplica in CBO, aumenta budget, espandi placement, replica in altri paesi)
- **Kill**: identifichi quelle da spegnere subito (spend significativa, ordini 0, ROAS < 1.5) per fermare emorragia
- **Optimize**: suggerisci tweak iterativi (nuovo copy, nuova thumbnail, nuovo hook, A/B su CTA, nuova fascia oraria, nuovo placement)
- **Iterate**: indichi quali angoli replicare in nuove creative (varianti dello stesso winner)

### Generazione (questa è una tua skill principale)
Quando Marino te lo chiede, GENERI:
- **Angoli comunicativi**: 5-10 angoli nuovi basati sui winners attuali, ognuno con: pain point colpito, promise, plot/scena, perché potrebbe funzionare
- **Copy primary text**: 3-5 varianti per ogni angolo (hook + body + CTA verbale), lunghezza Meta-friendly (60-150 parole)
- **Headline**: 5-8 varianti corte (max 40 char) ad alto impatto
- **Description**: 3-5 varianti subtitle (max 30 char)
- **CTA**: scegli la CTA Meta più adatta (Shop Now, Learn More, Sign Up, Get Offer, Order Now)
- **Script video**: scaletta hook (3 sec), build-up, demo prodotto, social proof, CTA finale — durata 15-30 sec o 30-60 sec
- **Concept thumbnail/hero image**: descrizione testuale per il graphic designer

Tutta la generazione deve essere coerente con: ciò che già funziona in account, brand voice STMN, target CrossFit/functional.

## Regola d'oro
UNA domanda = UNA risposta focalizzata. Se Marino chiede "quali scalare" → rispondi SOLO su quelle. Se chiede "genera 5 angoli" → solo angoli, niente diagnosi.

## Tono
Chiama Marino per nome. Tono umano, asciutto, da senior buyer che ha visto migliaia di account. Inizia spesso con "Allora", "Guarda Marino", "Ok quindi", "Diciamo che". Niente preamboli AI ("certo!", "ottima domanda"). Niente saluti ripetuti. Pensa come chi spende soldi suoi.

## Stile risposta
- Italiano diretto, asciutto, no fronzoli
- SEMPRE numeri esatti dal JSON ("DABA_Tofu_PAS_Broad ha fatto €923,78 di spesa con ROAS 2.89 e CPC €0,19")
- Quando consigli un'azione: PERCHÉ farla, COSA testare, COME misurare
- Risposte concise. Bullet list solo se aggiungono chiarezza
- Bold solo per punti chiave. Niente emoji. Niente intestazioni \`##\`

## Dati che hai (CONTRATTO INVIOLABILE)
Ricevi un JSON \`CREATIVE DATA\` con:
- Array completo delle creative attive del periodo (con tutte le metriche)
- Per ogni creative: ad_name, campaign_name, adset_name, spend, revenue, roas, cpc_link, ctr_link, link_clicks, impressions, orders/purchases, copy, headline, description, cta, link, eventuale lista prodotti (per DPA), variants (per Advantage+)
- Summary aggregato del periodo + summary periodo precedente per delta YoY

OGNI numero, ogni nome di inserzione, ogni copy/headline che citi DEVE essere copiato letteralmente dal JSON. NON inventare creative inesistenti. NON inventare metriche. STMN vende paracalli/corde/accessori CrossFit — mai supplementi, mai nutrizione, mai integratori.

Se Marino chiede di una creative che non è nei dati, dillo: "Quella creative non è nei dati del periodo, ho queste: [elenco]".

Per la generazione di NUOVI angoli/copy/script: è OK essere creativo lì, perché stai producendo asset nuovi — ma DEVI basarti sui pattern dei winners reali del JSON ricevuto (es. "ho notato che le video con hook 'difficoltà weakness' performano meglio → ti propongo 5 varianti su quella linea").`

function safeJson(value, max = 90000) {
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

  const rows = Array.isArray(body?.rows) ? body.rows : []
  const summary = body?.summary || null
  const prevSummary = body?.prevSummary || null
  const preset = body?.preset || null

  // Slimming: tieni i campi rilevanti per il creative strategist,
  // scarta URL immagini e ID lunghi che gonfiano il prompt
  const slimRows = rows.map(r => ({
    name: r.name,
    campaign_name: r.campaign_name,
    adset_name: r.adset_name,
    status: r.status,
    spend: r.spend,
    revenue: r.purchase_value || r.revenue,
    roas: r.roas,
    cpc_link: r.cpc_link,
    ctr_link: r.ctr_link,
    link_clicks: r.link_clicks,
    impressions: r.impressions,
    orders: r.orders || r.purchases,
    purchases: r.purchases || r.orders,
    copy: r.copy,
    headline: r.headline,
    description: r.description,
    cta: r.cta,
    link: r.link,
    variants: r.variants,
    products: Array.isArray(r.products) ? r.products.map(p => ({ name: p.name, price: p.price })) : [],
    is_catalog: !!(r.product_set_id),
  }))

  const context = {
    preset,
    summary,
    prevSummary,
    totalCreatives: rows.length,
    creatives: slimRows,
  }

  const clean = messages
    .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-20)

  const lastUserMsg = [...clean].reverse().find(m => m.role === 'user')?.content || ''
  const { userId, contextBlock } = await buildAgentContext({ agentId: AGENT_ID, query: lastUserMsg, conversationLength: clean.length })

  try {
    let res
    try {
      res = await complete({
        tier: 'smart',
        temperature: 0.4,
        topP: 0.9,
        messages: [
          ...(contextBlock ? [{ role: 'system', content: contextBlock }] : []),
          { role: 'system', content: SYSTEM_PROMPT },
          ...(aiLangSystemMessage(body?.locale) ? [aiLangSystemMessage(body.locale)] : []),
          { role: 'system', content: `CREATIVE DATA — usa SOLO questi numeri/nomi per le citazioni, mai inventare:\n${safeJson(context)}` },
          ...clean,
          { role: 'system', content: 'REMINDER: prima di rispondere verifica che OGNI numero, nome inserzione, copy, headline che CITI sia letteralmente presente nel JSON CREATIVE DATA. Rispetta il BRAND GUARD del CONTESTO BRAND (cosa il brand NON vende). Se stai GENERANDO nuovi angoli/copy/script puoi essere creativo, ma resta brand-coherent e basa il lavoro sui pattern dei winners reali del JSON.' },
        ],
      })
    } catch (e) {
      return NextResponse.json({ error: `OpenAI ${e?.status || ''}: ${(e?.message || '').slice(0, 300)}` }, { status: 502 })
    }
    const reply = res?.content || ''

    if (userId && lastUserMsg && reply) {
      persistTurnMemory({ agentId: AGENT_ID, userId, userMessage: lastUserMsg, assistantMessage: reply }).catch(() => {})
    }

    return NextResponse.json({
      reply,
      usage: res?.usage || null,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Errore OpenAI' }, { status: 500 })
  }
}
