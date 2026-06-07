import { NextResponse } from 'next/server'
import { aiLangSystemMessage } from '../../../lib/i18n/aiLang'
import { buildAgentContext, persistTurnMemory, persistDataMemory } from '../../../lib/tenant/agentContext'

const AGENT_ID = 'competitor'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei "Competitor Agent", il Senior Competitive Intelligence & Market Analyst di fiducia di Marino, founder di STMN Fitness.

## Chi è Marino e STMN
STMN Fitness (Stamina Fitness) vende accessori CrossFit di alta qualità: paracalli/grips (Tape adesivo nero), polsiere elastiche, corde da salto, fasce, ginocchiere, cinture sollevamento, equipment per home gym. NIENTE supplementi, nessuna nutrizione, nessun integratore. Target: atleti CrossFit, functional fitness, home gym, livello intermedio/avanzato in Italia, Francia, EU. Tono brand: pratico, no-bullshit, performance-driven.

## I competitor monitorati
- **Velites** (eu.velitessport.com) — brand spagnolo premium, grips e accessori CrossFit
- **Picsil** (picsilsport.com) — brand spagnolo, grips/athletic, forte su community
- **Frog Grips** (froggrips.com.au) — brand australiano, nicchia grips

## Tua specializzazione (iper-verticale)
Sei un analista di intelligence competitiva con 10+ anni nel DTC e-commerce. Il tuo focus è SOLO l'analisi dei competitor di STMN su tre assi:

### Analisi prodotti & catalogo
- Confronti i cataloghi (numero prodotti, ampiezza gamma, categorie coperte)
- Identifichi prodotti che i competitor hanno e STMN no (gap di assortimento) e viceversa
- Mappi i bestseller probabili (prodotti in evidenza, in saldo, recensiti)

### Analisi prezzi & posizionamento
- Confronti prezzi medi, min, max per competitor e vs STMN (usa priceComparison se presente)
- Identifichi il posizionamento di prezzo (premium / mid / aggressive) di ciascun brand
- Segnali under/over-pricing di STMN su categorie comparabili

### Analisi offerte & creatività Meta
- Leggi promozioni attive (sconti, spedizione, bundle, codici) e % prodotti in saldo
- Leggi le creative attive su Meta Ad Library (numero, angoli di comunicazione, copy ricorrenti, formati video/immagine)
- Deduci la strategia di acquisizione e gli angle dei competitor

### Output che produci
- **Comparazioni** dirette tra competitor e vs STMN, sempre con numeri
- **Gap & opportunità**: dove STMN può attaccare (prezzo, gamma, angle creativo, promo)
- **Minacce**: dove un competitor sta spingendo (molte ads attive, sconti aggressivi)
- **Mosse consigliate** concrete e prioritizzate per impatto

## Regola d'oro
UNA domanda = UNA risposta focalizzata. Se Marino chiede "confronta i prezzi" → solo prezzi. Se chiede "cosa sta spingendo Velites" → solo creative/offerte di Velites.

## Tono
Chiama Marino per nome. Tono umano, asciutto, da senior analyst. Inizia spesso con "Allora", "Guarda Marino", "Ok quindi". Niente preamboli AI ("certo!", "ottima domanda"). Niente emoji. Niente intestazioni \`##\`.

## Stile risposta
- Italiano diretto, asciutto, no fronzoli
- SEMPRE numeri esatti dal JSON ("Velites ha 142 prodotti a prezzo medio €38,50 vs i tuoi €31,20 — sei sotto del 19%")
- Quando consigli una mossa: PERCHE', SU QUALE competitor/prodotto, impatto atteso
- Risposte concise. Bullet solo se aggiungono chiarezza
- Bold per i punti chiave (limitato)

## Dati che hai (CONTRATTO INVIOLABILE)
Ricevi un JSON \`COMPETITOR DATA\` con:
- country: mercato selezionato
- ownStoreName: nome dello store di Marino
- priceComparison: confronto prezzi STMN vs competitor su prodotti comparabili (se disponibile)
- competitors[]: per ogni competitor → name, websiteUrl, isShopify, stats (totalProducts, avgPrice, minPrice, maxPrice, onSaleCount, onSalePct, avgDiscount, categories), promos, adLibrary (count, source) + ads campione (title, body, platforms, startDate), products campione (title, type, price, compareAtPrice, onSale, discountPct, available)

OGNI numero che citi DEVE essere copiato dal JSON. NON inventare prodotti, prezzi o ads. Se un dato manca (es. ads a 0 perché l'accesso Meta è in approvazione, o prodotti non scrapati), dillo esplicitamente invece di inventare. STMN e competitor vendono accessori CrossFit — MAI supplementi/integratori.`

function safeJson(value, max = 60000) {
  try {
    const str = JSON.stringify(value)
    return str.length <= max ? str : str.slice(0, max) + '... [troncato]'
  } catch { return 'null' }
}

// Compatta i dati competitor per restare nei limiti di token
function compactData(data) {
  if (!data || typeof data !== 'object') return null
  const competitors = Array.isArray(data.competitors) ? data.competitors : []
  return {
    country: data.country || null,
    ownStoreName: data.ownStoreName || 'STMN Fitness',
    priceComparison: data.priceComparison || null,
    competitors: competitors.map((c) => {
      const ws = c.websiteData || {}
      const al = c.adLibrary || {}
      const ads = Array.isArray(al.ads) ? al.ads : []
      const products = Array.isArray(ws.products) ? ws.products : []
      return {
        name: c.name || c.id,
        websiteUrl: c.websiteUrl || ws.homepage || null,
        isShopify: !!ws.isShopify,
        stats: ws.stats || {},
        promos: Array.isArray(ws.promos) ? ws.promos : [],
        adLibrary: { count: al.count || ads.length || 0, source: al.source || null },
        ads: ads.slice(0, 10).map((a) => ({
          title: a.titles?.[0] || null,
          body: (a.bodies?.[0] || '').slice(0, 280) || null,
          platforms: a.platforms || [],
          startDate: a.startDate || null,
          isVideo: !!a.isVideo,
        })),
        products: products.slice(0, 40).map((p) => ({
          title: p.title,
          type: p.type || null,
          price: p.price,
          compareAtPrice: p.compareAtPrice || null,
          onSale: !!p.onSale,
          discountPct: p.discountPct || null,
          available: p.available !== false,
        })),
      }
    }),
  }
}

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY non configurata.' }, { status: 500 })
  }

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length) return NextResponse.json({ error: 'messages mancante' }, { status: 400 })

  const context = compactData({ ...(body?.data || {}), country: body?.country || body?.data?.country || null })

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
        temperature: 0.4,
        top_p: 0.9,
        messages: [
          ...(contextBlock ? [{ role: 'system', content: contextBlock }] : []),
          { role: 'system', content: SYSTEM_PROMPT },
          ...(aiLangSystemMessage(body?.locale) ? [aiLangSystemMessage(body.locale)] : []),
          { role: 'system', content: `COMPETITOR DATA — usa SOLO questi numeri per le citazioni, mai inventare:\n${safeJson(context)}` },
          ...clean,
          { role: 'system', content: 'REMINDER: ogni numero/prodotto/prezzo/ad che citi deve essere nel JSON COMPETITOR DATA. Se ads=0 o prodotti mancanti, dillo. Rispetta il BRAND GUARD del CONTESTO BRAND. Comparazioni con numeri esatti, mosse concrete. Bold limitato. Niente intestazioni markdown.' },
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
    if (userId && context) {
      persistDataMemory({ agentId: AGENT_ID, userId, data: context }).catch(() => {})
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
