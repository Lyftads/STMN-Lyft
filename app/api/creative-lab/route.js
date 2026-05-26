import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const OPENAI_KEY = process.env.OPENAI_API_KEY
const GEMINI_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN

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

async function generateImageDalle3(prompt, size) {
  if (!OPENAI_KEY) return { error: 'OPENAI_API_KEY non configurata' }
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
        quality: 'standard',
      }),
      signal: AbortSignal.timeout(90000),
    })
    if (!res.ok) {
      const err = await res.text()
      return { error: `DALL-E 3 ${res.status}: ${err.slice(0, 200)}` }
    }
    const data = await res.json()
    return { url: data.data?.[0]?.url || null }
  } catch (e) {
    return { error: e.message }
  }
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
    case 'dall-e-3':
      return generateImageDalle3(prompt, size)
    case 'gpt-image-1':
      return generateImageGpt(prompt, size)
    case 'gemini':
      return generateImageGemini(prompt)
    default:
      return generateImageGpt(prompt, size)
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('perPage') || '20')))
  const searchQuery = (searchParams.get('search') || '').trim().toLowerCase()
  const base = new URL(request.url).origin

  const [creative, metrics, competitors, shopifyProducts] = await Promise.all([
    safeFetch(`${base}/api/creative?preset=last_28d`),
    safeFetch(`${base}/api/metrics`),
    safeFetch(`${base}/api/competitor-intel`),
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
    { id: 'dall-e-3', name: 'DALL-E 3', ready: Boolean(OPENAI_KEY) },
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
}

export async function POST(request) {
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

  const styleGuide = {
    performance:
      'Direct response, benefit-focused, urgency. Focus su risultati concreti, social proof, e CTA forte.',
    ugc: 'Stile user-generated content: tono personale, come se un atleta stesse parlando della propria esperienza. Raw, più autentico.',
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

  const andromedaVariants = [
    { avatar: 'male CrossFit athlete, 25-35, muscular, sweaty, intense expression', location: 'inside a CrossFit box/gym with rigs and barbells', mood: 'intense, dramatic side lighting, gritty', palette: 'dark background with warm orange/red accent lighting' },
    { avatar: 'female fitness enthusiast, 28-38, athletic build, confident smile', location: 'outdoor training area, park or seaside at golden hour', mood: 'energetic, natural golden sunlight, fresh air feel', palette: 'bright natural tones, blues and warm gold' },
    { avatar: 'everyday person/beginner, 30-45, relatable build, determined look', location: 'home garage gym with minimal equipment', mood: 'warm, inviting, approachable, soft window light', palette: 'warm earth tones, cozy atmosphere' },
    { avatar: 'competition athlete, any gender, chalk on hands, focused', location: 'competition venue with crowd blur in background', mood: 'adrenaline, high contrast, flash photography feel', palette: 'black background with neon/gold highlights' },
    { avatar: 'female coach/trainer, 35-45, professional, motivating expression', location: 'modern urban rooftop gym with city skyline', mood: 'professional, clean, aspirational, early morning light', palette: 'minimalist cool tones with one warm accent' },
    { avatar: 'young male athlete, 20-28, lean/wiry build, action pose', location: 'grungy industrial gym, exposed brick and steel', mood: 'raw, editorial, street-style photography', palette: 'desaturated with one pop color matching the product' },
  ]

  const isSingle = singleIndex !== null
  const count = isSingle ? 1 : 3

  const copyPrompt = `Sei un senior Meta Ads creative strategist per STMN Fitness, un brand italiano di attrezzatura per functional fitness e CrossFit (paracalli, corde, polsiere, accessori, abbigliamento).

## Buyer Personas STMN Fitness
1. "L'Atleta Serio" — 25-40, fa CrossFit/functional fitness 4-5 volte a settimana, cerca prodotti performanti, segue atleti su IG, sensibile al rapporto qualità-prezzo
2. "Il Principiante Motivato" — 20-35, ha iniziato da poco, cerca i primi accessori giusti, vuole sentirsi parte della community
3. "Il Coach" — 30-50, gestisce un box/palestra, compra per sé e consiglia ai clienti, vuole affidabilità

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
${JSON.stringify(products, null, 2)}

## REGOLE ANDROMEDA (Meta Algorithm) — OBBLIGATORIE
Ogni creative DEVE essere VISIVAMENTE UNICA per massimizzare la varianza che Andromeda premia.
Per ogni creative usa un DIVERSO template visivo dalla lista sotto.

Template visivi disponibili (usa uno diverso per ogni creative):
${andromedaVariants.slice(0, count + 2).map((v, i) => `${i + 1}. Avatar: ${v.avatar} | Location: ${v.location} | Mood: ${v.mood} | Palette: ${v.palette}`).join('\n')}

## Task
Per OGNI prodotto, genera ${count} varianti creative per Meta Ads (Feed).
Scrivi TUTTO in italiano. Ogni variante deve avere un angolo DIVERSO, un avatar DIVERSO, un contesto DIVERSO.

Per ogni variante restituisci un oggetto JSON con:
- "productTitle": nome esatto del prodotto
- "funnelStage": "${funnelStage}"
- "headline": max 40 caratteri, gancio forte ADATTO alla fase del funnel
- "primaryText": testo principale dell'ad, 2-3 frasi (max 200 chars) che riflette la strategia ${stage.name}
- "description": descrizione sotto il link (max 80 chars)
- "cta": testo CTA adatto a ${stage.name}
- "angle": l'angolo creativo in 1 frase
- "persona": quale buyer persona target (Atleta Serio / Principiante Motivato / Coach)
- "reasoning": perché questa creative funziona per la fase ${funnelStage} (1-2 frasi, in italiano)
- "imagePrompt": prompt DETTAGLIATO in inglese per generare l'immagine. DEVI usare il template visivo assegnato (avatar, location, mood, palette specifici). Il formato è ${format === 'story' ? '9:16 portrait' : '1:1 square'}. Stile: fotografia realistico, advertising quality, 4K. INCLUDI nell'immagine un overlay testuale con l'headline in italiano (grande, leggibile) e il CTA in un bottone. Il testo deve essere parte dell'immagine, come un ad reale su Meta.

IMPORTANTE: ogni imagePrompt DEVE descrivere una scena COMPLETAMENTE diversa dalle altre. Diverso avatar, diversa location, diversa palette. Meta Andromeda penalizza creative simili.

Rispondi con un JSON valido: { "creatives": [...] }`

  try {
    const copyRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.9,
        messages: [
          {
            role: 'system',
            content:
              'Sei un creative strategist per Meta Ads. Rispondi SOLO con JSON valido.',
          },
          { role: 'user', content: copyPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (!copyRes.ok) {
      const text = await copyRes.text()
      return json(
        { error: `OpenAI ${copyRes.status}: ${text.slice(0, 300)}` },
        502
      )
    }

    const copyData = await copyRes.json()
    const rawContent = copyData.choices?.[0]?.message?.content || '{}'

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
}
