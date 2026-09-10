import { NextResponse } from 'next/server'
import { aiLangSystemMessage } from '../../../lib/i18n/aiLang'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'
import { callBrain } from '../../../lib/agent/gateway'
import { STATIC_CREATIVE_SYSTEM } from '../../../lib/agent/staticCreativeSystem'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const OPENAI_KEY = process.env.OPENAI_API_KEY
const GEMINI_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

function json(data, status = 200) {
  return NextResponse.json(data, { status })
}

async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, { cache: 'no-store', ...opts })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function fetchShopifyProducts() {
  const { storeUrl: SHOPIFY_STORE, adminToken: SHOPIFY_TOKEN } = getShopify()
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return []
  try {
    const res = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2024-10/products.json?limit=250&status=active`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_TOKEN,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(12000),
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.products || []).map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      description: (p.body_html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300),
      image: p.image?.src || p.images?.[0]?.src || '',
      price: parseFloat(p.variants?.[0]?.price) || 0,
      compareAtPrice: parseFloat(p.variants?.[0]?.compare_at_price) || 0,
      productType: p.product_type || '',
      vendor: p.vendor || '',
      tags:
        typeof p.tags === 'string'
          ? p.tags.split(',').map((t) => t.trim())
          : p.tags || [],
    }))
  } catch {
    return []
  }
}

function getSizeForModel(model, format) {
  if (model === 'gpt-image-1') {
    return format === 'story' ? '1024x1536' : '1024x1024'
  }
  return format === 'story' ? '1024x1792' : '1024x1024'
}

async function generateImageGpt(prompt, size) {
  if (!OPENAI_KEY) return { error: 'OPENAI_API_KEY non configurata' }
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size,
      }),
      signal: AbortSignal.timeout(90000),
    })
    if (!res.ok) {
      const err = await res.text()
      return { error: `GPT Image ${res.status}: ${err.slice(0, 200)}` }
    }
    const data = await res.json()
    const url = data.data?.[0]?.url || null
    const b64 = data.data?.[0]?.b64_json || null
    return { url: url || (b64 ? `data:image/png;base64,${b64}` : null) }
  } catch (e) {
    return { error: e.message }
  }
}

async function generateImageGemini(prompt) {
  if (!GEMINI_KEY) return { error: 'GOOGLE_AI_API_KEY non configurata. Aggiungila su Vercel.' }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate an image: ${prompt}` }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
        signal: AbortSignal.timeout(90000),
      }
    )
    if (!res.ok) {
      const err = await res.text()
      return { error: `Gemini ${res.status}: ${err.slice(0, 200)}` }
    }
    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts || []
    const imgPart = parts.find((p) => p.inlineData)
    if (imgPart) {
      const mime = imgPart.inlineData.mimeType || 'image/png'
      return { url: `data:${mime};base64,${imgPart.inlineData.data}` }
    }
    return { error: 'Gemini non ha generato un\'immagine' }
  } catch (e) {
    return { error: e.message }
  }
}

async function generateImage(prompt, model, format) {
  const size = getSizeForModel(model, format)
  switch (model) {
    case 'gpt-image-1':
      return generateImageGpt(prompt, size)
    case 'gemini':
      return generateImageGemini(prompt)
    default:
      return generateImageGpt(prompt, size)
  }
}

export async function GET(request) {
  return withTenantContext(request, async () => {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('perPage') || '20')))
  const searchQuery = (searchParams.get('search') || '').trim().toLowerCase()
  const base = new URL(request.url).origin

  const [creative, metrics, competitors, shopifyProducts] = await Promise.all([
    safeFetch(`${base}/api/creative?preset=last_28d`),
    safeFetch(`${base}/api/metrics`),
    fetchShopifyProducts(),
  ])

  const topSellingTitles = (metrics?.shopifyTopProducts || []).map((p) => ({
    product: p.product,
    revenue: p.revenue,
    orders: p.orders,
    quantity: p.quantity,
  }))

  const bestAds = (creative?.rows || [])
    .filter((r) => (r.roas || r.purchase_value) > 0)
    .sort((a, b) => (b.roas || 0) - (a.roas || 0))
    .slice(0, 15)
    .map((r) => ({
      name: r.name || r.ad_name || r.creative_name || '',
      campaignName: r.campaign_name || '',
      spend: r.spend || 0,
      revenue: r.purchase_value || r.revenue || 0,
      roas: r.roas || 0,
      ctr: r.ctr_link || r.ctr || 0,
      impressions: r.impressions || 0,
      purchases: r.purchases || r.orders || 0,
      thumbnail: r.thumbnail_url || r.display_image_url || r.image_url || '',
    }))

  const productsWithSales = shopifyProducts.map((p) => {
    const sales = topSellingTitles.find(
      (t) =>
        t.product.toLowerCase().includes(p.title.toLowerCase()) ||
        p.title.toLowerCase().includes(t.product.toLowerCase())
    )
    return { ...p, sales: sales || null }
  })

  let allRanked = [...productsWithSales].sort(
    (a, b) => (b.sales?.revenue || 0) - (a.sales?.revenue || 0)
  )

  if (searchQuery) {
    allRanked = allRanked.filter(
      (p) =>
        p.title.toLowerCase().includes(searchQuery) ||
        (p.productType || '').toLowerCase().includes(searchQuery) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(searchQuery))
    )
  }

  const totalProducts = allRanked.length
  const totalPages = Math.ceil(totalProducts / perPage)
  const offset = (page - 1) * perPage
  const paginatedProducts = allRanked.slice(offset, offset + perPage)

  const competitorSummary = (competitors?.competitors || []).map((c) => {
    const ws = c.websiteData || {}
    const stats = ws.stats || {}
    return {
      name: c.name,
      avgPrice: stats.avgPrice || 0,
      onSalePct: stats.onSalePct || 0,
      avgDiscount: stats.avgDiscount || 0,
      promos: (ws.promos || []).slice(0, 5),
      adCount: c.adLibrary?.count || 0,
      adSamples: (c.adLibrary?.ads || []).slice(0, 3).map((a) => ({
        titles: a.titles,
        bodies: a.bodies,
      })),
    }
  })

  const availableModels = [
    { id: 'gpt-image-1', name: 'GPT Image', ready: Boolean(OPENAI_KEY) },
    { id: 'gemini', name: 'Gemini Imagen', ready: Boolean(GEMINI_KEY) },
  ]

  return json({
    products: paginatedProducts,
    bestAds,
    competitorSummary,
    totalProducts,
    totalPages,
    page,
    perPage,
    availableModels,
  })
  })
}

export async function POST(request) {
  return withTenantContext(request, async () => {
  if (!OPENAI_KEY) {
    return json({ error: 'OPENAI_API_KEY non configurata' }, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Body non valido' }, 400)
  }

  const {
    products = [],
    bestAds = [],
    competitors = [],
    productReferences = {},
    manualBrief = {},
    style = 'performance',
    funnelStage = 'tofu',
    format = 'square',
    imageModel = 'gpt-image-1',
    generateImages = true,
    singleIndex = null,
  } = body

  if (!products.length) {
    return json({ error: 'Seleziona almeno un prodotto' }, 400)
  }

  // Analyze reference images with GPT-4o Vision for accurate product descriptions
  const productDescriptions = {}
  for (const product of products) {
    const refs = productReferences[product.title] || []
    if (refs.length === 0) continue
    try {
      const imageContent = refs.slice(0, 3).map((b64) => ({
        type: 'image_url',
        image_url: { url: b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}` },
      }))
      const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Describe this product in extreme detail for AI image generation. Include: exact colors (hex if possible), materials (leather, synthetic, neoprene, etc.), textures (smooth, textured grip, matte, glossy), shape and proportions, any visible logos/branding/text, stitching details, hardware (buckles, velcro, snaps), distinctive design features. Be specific enough that an image AI can recreate this product with 95% accuracy. Output ONLY the description, no preamble.`,
              },
              ...imageContent,
            ],
          }],
        }),
        signal: AbortSignal.timeout(20000),
      })
      if (visionRes.ok) {
        const vData = await visionRes.json()
        productDescriptions[product.title] = vData.choices?.[0]?.message?.content || ''
      }
    } catch (_) {
      // Vision analysis failed, will use basic product info
    }
  }

  const styleGuide = {
    performance:
      'Direct response, benefit-focused, urgency. Focus su risultati concreti, social proof, e CTA forte.',
    ugc: 'Stile user-generated content: tono personale, come se un cliente reale stesse parlando della propria esperienza. Raw, più autentico.',
    lifestyle:
      'Aspirazionale, mood-driven. Evoca la sensazione di allenarsi con questi prodotti. Meno copy, più emozione.',
    comparison:
      'Confronto diretto con i competitor o con la situazione senza il prodotto. Before/after, noi vs loro.',
  }

  const funnelStrategy = {
    tofu: {
      name: 'Top of Funnel (Fredda)',
      goal: 'Awareness. Catturare attenzione di persone che NON conoscono il brand.',
      messaging: 'Problem-aware: evidenzia il problema che il prodotto risolve. Curiosità, "lo sapevi che?", hook emotivi. NON parlare del prodotto direttamente — parla del PROBLEMA o del DESIDERIO.',
      cta: 'Scopri di più, Guarda come, Leggi la storia',
      tone: 'Educativo, curioso, empatico. Come un amico che ti apre gli occhi su qualcosa.',
    },
    mofu: {
      name: 'Middle of Funnel (Tiepida)',
      goal: 'Considerazione. Pubblico che conosce il problema e sta valutando soluzioni.',
      messaging: 'Solution-aware: mostra COME il prodotto risolve il problema. Social proof, benefici specifici, confronti, testimonianze. Il prodotto è protagonista ma nel contesto di una storia.',
      cta: 'Scopri la soluzione, Vedi come funziona, Leggi le recensioni',
      tone: 'Autorevole, specifico, dimostrativo. Mostra risultati concreti.',
    },
    bofu: {
      name: 'Bottom of Funnel (Calda)',
      goal: 'Conversione. Pubblico pronto ad acquistare, serve la spinta finale.',
      messaging: 'Product-aware: offerta diretta, prezzo, scarsità, garanzia, risk reversal. Il prodotto è al centro con tutti i dettagli che servono per decidere ORA.',
      cta: 'Acquista ora, Approfitta dell\'offerta, Ordina oggi',
      tone: 'Urgente, diretto, specifico. Zero fronzoli, massima chiarezza.',
    },
    retargeting: {
      name: 'Retargeting',
      goal: 'Recupero. Persone che hanno già visitato il sito, visto prodotti, o abbandonato il carrello.',
      messaging: 'Most-aware: "Hai dimenticato qualcosa?", recensioni di chi ha già comprato, offerta esclusiva per chi torna, garanzia soddisfatti o rimborsati. Supera le obiezioni residue.',
      cta: 'Completa l\'ordine, Torna a vedere, Ultima occasione',
      tone: 'Personale, rassicurante, urgente. Come un commesso che ti dice "fidati, è la scelta giusta".',
    },
  }

  const stage = funnelStrategy[funnelStage] || funnelStrategy.tofu

  // Sistema di varianti = i 12 formati statici (lib/agent/staticCreativeSystem).
  // Prima qui c'erano 6 ambientazioni fitness hardcoded (atleta in box, chalk,
  // rig e bilancieri): erano i template di un'azienda sola e finivano addosso a
  // ogni cliente. I formati sono brand-agnostici per costruzione; ambientazione,
  // soggetto e palette li deriva il modello dal CONTESTO BRAND.
  const formatVariants = [
    { name: 'Product Hero', stage: 'BOF', brief: 'prodotto pulito su fondo neutro o brandizzato, zero distrazioni; luce e angolo che creano desiderio' },
    { name: 'Social Proof', stage: 'MOF/BOF', brief: 'prodotto + prova quantificabile (stelle, numero recensioni, citazione cliente breve e specifica)' },
    { name: 'Feature Callout', stage: 'MOF', brief: 'prodotto con 3-5 annotazioni che indicano benefici concreti, non specifiche tecniche' },
    { name: 'Noi vs Loro', stage: 'TOF/MOF', brief: 'confronto visivo con la categoria o col "vecchio modo"; mai un concorrente nominato' },
    { name: 'Griglia / Collage', stage: 'TOF/MOF', brief: '4-9 celle miste (prodotto, contesto d\'uso, dettaglio materico) con trattamento colore coerente' },
    { name: 'Listicle', stage: 'MOF', brief: '3-5 motivi o benefici in gerarchia visiva chiara, ognuno autonomo' },
    { name: 'Data Callout', stage: 'MOF', brief: 'UN solo numero protagonista, preso dai dati reali del brand, con il minimo contesto che lo rende leggibile' },
    { name: 'UGC-Native', stage: 'TOF', brief: 'sembra contenuto organico: scatto casuale, imperfetto, elementi nativi della piattaforma' },
  ]

  const isSingle = singleIndex !== null
  const count = isSingle ? 1 : 3

  const copyPrompt = `Sei un senior Meta Ads creative strategist. Il brand — categoria, catalogo, target, tono di voce, buyer personas — e' descritto nel CONTESTO BRAND che ricevi: usa SOLO quello. Non dare per scontato il settore, non inventare prodotti o personas che non compaiono nel contesto, e non trasferire su questo brand ambientazioni o linguaggi tipici di un altro settore.

## Fase del Funnel: ${stage.name}
- Obiettivo: ${stage.goal}
- Strategia messaging: ${stage.messaging}
- CTA suggerite: ${stage.cta}
- Tono: ${stage.tone}

## Stile creativo: ${style}
${styleGuide[style] || styleGuide.performance}

## Dati Performance (Top ads per ROAS)
${JSON.stringify(bestAds.slice(0, 5), null, 2)}

## Competitor
${JSON.stringify(competitors, null, 2)}

## Prodotti da promuovere
${JSON.stringify(products.map(p => ({
  ...p,
  visualDescription: productDescriptions[p.title] || null,
})), null, 2)}

${Object.keys(productDescriptions).length > 0 ? `## DESCRIZIONI VISIVE DETTAGLIATE (da foto reali caricate)
Le seguenti descrizioni sono state estratte da foto reali del prodotto. USALE OBBLIGATORIAMENTE nell'imagePrompt per descrivere il prodotto con precisione:
${Object.entries(productDescriptions).map(([title, desc]) => `### ${title}\n${desc}`).join('\n\n')}` : ''}

${manualBrief.context || manualBrief.persona || manualBrief.productFeatures ? `## BRIEF MANUALE DEL CLIENTE (priorità alta — segui queste indicazioni)
${manualBrief.context ? `**Contesto/Ambientazione richiesta:** ${manualBrief.context}\nUsa questa ambientazione come base per TUTTE le immagini generate. Adattala ai diversi template Andromeda ma rispetta il mood indicato.` : ''}
${manualBrief.persona ? `**Buyer Persona specifica:** ${manualBrief.persona}\nIl copy e il tono devono parlare DIRETTAMENTE a questa persona. Adatta headline, primaryText e CTA al suo linguaggio e ai suoi pain point.` : ''}
${manualBrief.productFeatures ? `**Caratteristiche prodotto da evidenziare:** ${manualBrief.productFeatures}\nQueste feature DEVONO essere menzionate nel copy (primaryText) e descritte nell'imagePrompt per renderle visibili nell'immagine.` : ''}` : ''}

## REGOLE ANDROMEDA (Meta Algorithm) — OBBLIGATORIE
Ogni creative DEVE essere VISIVAMENTE UNICA per massimizzare la varianza che Andromeda premia.
Per ogni creative usa un DIVERSO template visivo dalla lista sotto.

Formati disponibili (usane uno DIVERSO per ogni creative):
${formatVariants.slice(0, count + 2).map((v, i) => `${i + 1}. ${v.name} (${v.stage}) — ${v.brief}`).join('\n')}

Per ogni formato scegli TU soggetto, ambientazione, mood e palette, derivandoli dal CONTESTO BRAND: devono essere plausibili per questo brand e per il suo cliente reale. Due creative non devono mai condividere ne' il formato ne' l'ambientazione.

## Task
Per OGNI prodotto, genera ${count} varianti creative per Meta Ads (Feed).
Ogni variante deve avere un formato DIVERSO, un angolo DIVERSO e un contesto DIVERSO.

Per ogni variante restituisci un oggetto JSON con:
- "productTitle": nome esatto del prodotto
- "funnelStage": "${funnelStage}"
- "headline": max 40 caratteri, gancio forte ADATTO alla fase del funnel
- "primaryText": testo principale dell'ad, 2-3 frasi (max 200 chars) che riflette la strategia ${stage.name}
- "description": descrizione sotto il link (max 80 chars)
- "cta": testo CTA adatto a ${stage.name}
- "angle": l'angolo creativo in 1 frase
- "format": il nome del formato usato, preso dalla lista sopra
- "persona": a quale buyer persona del CONTESTO BRAND parla questa creative
- "reasoning": perché questa creative funziona per la fase ${funnelStage} (1-2 frasi)
- "imagePrompt": prompt DETTAGLIATO in inglese per generare l'immagine. REGOLE OBBLIGATORIE per l'imagePrompt:
  1. Il PRODOTTO deve essere SEMPRE visibile e centrale nell'immagine. Descrivi il prodotto specifico con materiale, colore e dettagli presi dal catalogo nel contesto. Il prodotto deve occupare almeno il 30% dell'immagine.
  2. DEVI rispettare il formato assegnato: la composizione dell'immagine deve rendere riconoscibile quel formato.
  3. Il formato è ${format === 'story' ? '9:16 portrait' : '1:1 square'}. Stile: fotografia realistica, advertising quality, 4K.
  4. INCLUDI nell'immagine un overlay testuale con l'headline in italiano (grande, leggibile) e il CTA in un bottone.
  5. VARIA il tipo di composizione tra le creative: alcune con il prodotto indossato/usato dalla persona target, altre con il prodotto da solo in primo piano (flat lay, studio shot, still life in un contesto d'uso coerente col brand). Non tutte le immagini devono avere persone — alterna product-only e lifestyle.

IMPORTANTE: ogni imagePrompt DEVE descrivere una scena COMPLETAMENTE diversa dalle altre. Diverso avatar, diversa location, diversa palette. Il PRODOTTO è sempre presente e visibile. Meta Andromeda penalizza creative simili.

Rispondi con un JSON valido: { "creatives": [...] }`

  try {
    // Tool mode: brand+memorie+knowledge nel contesto, schema output invariato.
    const { content } = await callBrain({
      skill: { id: 'creative', json: true, systemPrompt: STATIC_CREATIVE_SYSTEM + '\n\nSei un creative strategist per Meta Ads. Rispondi SOLO con JSON valido.' },
      query: 'creative strategy Meta Ads hook angoli copy UGC advertising',
      messages: [{ role: 'user', content: copyPrompt }],
      locale: body?.locale,
      conversation: false,
      temperature: 0.9,
    })
    const rawContent = content || '{}'

    let creatives
    try {
      const parsed = JSON.parse(rawContent)
      creatives = Array.isArray(parsed)
        ? parsed
        : parsed.creatives ||
          parsed.variants ||
          parsed.ads ||
          Object.values(parsed)[0]
      if (!Array.isArray(creatives)) creatives = [parsed]
    } catch {
      return json(
        { error: 'Risposta AI non parsabile', raw: rawContent.slice(0, 500) },
        500
      )
    }

    if (generateImages && creatives.length > 0) {
      for (let i = 0; i < Math.min(creatives.length, 6); i++) {
        const c = creatives[i]
        if (!c.imagePrompt) {
          creatives[i] = { ...c, generatedImage: null, imageError: 'Nessun image prompt generato', imageModel }
          continue
        }
        const result = await generateImage(c.imagePrompt, imageModel, format)
        creatives[i] = {
          ...c,
          generatedImage: result.url || null,
          imageError: result.error || null,
          imageModel,
        }
      }
    }

    return json({
      creatives,
      style,
      format,
      imageModel,
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
  })
}
