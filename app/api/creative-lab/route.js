import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_KEY = process.env.OPENAI_API_KEY
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
      tags: typeof p.tags === 'string' ? p.tags.split(',').map((t) => t.trim()) : p.tags || [],
    }))
  } catch {
    return []
  }
}

export async function GET(request) {
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
      cpc: r.cpc_link || r.cpc || 0,
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

  const rankedProducts = [...productsWithSales]
    .sort((a, b) => (b.sales?.revenue || 0) - (a.sales?.revenue || 0))
    .slice(0, 30)

  const competitorSummary = (competitors?.competitors || []).map((c) => {
    const ws = c.websiteData || {}
    const stats = ws.stats || {}
    return {
      name: c.name,
      avgPrice: stats.avgPrice || 0,
      onSalePct: stats.onSalePct || 0,
      avgDiscount: stats.avgDiscount || 0,
      promos: (ws.promos || []).slice(0, 5),
      topCategories: (stats.categories || []).slice(0, 5),
      adCount: c.adLibrary?.count || 0,
      adSamples: (c.adLibrary?.ads || []).slice(0, 3).map((a) => ({
        titles: a.titles,
        bodies: a.bodies,
      })),
    }
  })

  return json({
    products: rankedProducts,
    bestAds,
    competitorSummary,
    totalProducts: shopifyProducts.length,
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
    count = 3,
    format = 'square',
    generateImages = true,
  } = body

  if (!products.length) {
    return json({ error: 'Seleziona almeno un prodotto' }, 400)
  }

  const styleGuide = {
    performance: 'Direct response, benefit-focused, urgency. Focus su risultati concreti, social proof, e CTA forte.',
    ugc: 'Stile user-generated content: tono personale, come se un atleta stesse parlando della propria esperienza. Rawer, più autentico.',
    lifestyle: 'Aspirazionale, mood-driven. Evoca la sensazione di allenarsi con questi prodotti. Meno copy, più emozione.',
    comparison: 'Confronto diretto con i competitor o con la situazione senza il prodotto. Before/after, noi vs loro.',
  }

  const copyPrompt = `Sei un senior Meta Ads creative strategist per STMN Fitness, un brand italiano di attrezzatura per functional fitness e CrossFit.

## Dati Performance
Top ads per ROAS:
${JSON.stringify(bestAds.slice(0, 5), null, 2)}

## Competitor
${JSON.stringify(competitors, null, 2)}

## Stile richiesto: ${style}
${styleGuide[style] || styleGuide.performance}

## Prodotti da promuovere
${JSON.stringify(products, null, 2)}

## Task
Per OGNI prodotto, genera ${count} varianti creative per Meta Ads (Feed).
Scrivi TUTTO in italiano.

Per ogni variante restituisci un oggetto JSON con:
- "productTitle": nome del prodotto
- "headline": max 40 caratteri, gancio forte
- "primaryText": testo principale dell'ad, 2-3 frasi (max 200 chars)
- "description": descrizione sotto il link (max 80 chars)
- "cta": testo CTA (es. "Acquista ora", "Scopri di più", "Provale ora")
- "angle": l'angolo creativo in 1 frase (es. "Social proof + urgenza")
- "reasoning": perché questa creative dovrebbe funzionare (1-2 frasi)
- "imagePrompt": prompt DETTAGLIATO in inglese per generare un'immagine lifestyle/mood per questa ad con DALL-E. L'immagine deve evocare il mondo del CrossFit/functional fitness. NON descrivere il prodotto specifico, ma l'atmosfera e lo scenario in cui viene usato. Includi: lighting, color palette (dark/moody con accenti ${style === 'ugc' ? 'caldi naturali' : 'energetici'}), composizione, mood. Il formato è ${format === 'story' ? '9:16 verticale' : '1:1 quadrato'}.

Rispondi SOLO con un array JSON valido. Nessun testo prima o dopo.`

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
          { role: 'system', content: 'Sei un creative strategist per Meta Ads. Rispondi SOLO con JSON valido.' },
          { role: 'user', content: copyPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (!copyRes.ok) {
      const text = await copyRes.text()
      return json({ error: `OpenAI ${copyRes.status}: ${text.slice(0, 300)}` }, 502)
    }

    const copyData = await copyRes.json()
    const rawContent = copyData.choices?.[0]?.message?.content || '{}'

    let creatives
    try {
      const parsed = JSON.parse(rawContent)
      creatives = Array.isArray(parsed) ? parsed : parsed.creatives || parsed.variants || parsed.ads || Object.values(parsed)[0]
      if (!Array.isArray(creatives)) creatives = [parsed]
    } catch {
      return json({ error: 'Risposta AI non parsabile', raw: rawContent.slice(0, 500) }, 500)
    }

    if (generateImages && creatives.length > 0) {
      const dalleSize = format === 'story' ? '1024x1792' : '1024x1024'

      const imageResults = await Promise.all(
        creatives.slice(0, 6).map(async (creative) => {
          if (!creative.imagePrompt) return null
          try {
            const imgRes = await fetch('https://api.openai.com/v1/images/generations', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_KEY}`,
              },
              body: JSON.stringify({
                model: 'dall-e-3',
                prompt: creative.imagePrompt,
                n: 1,
                size: dalleSize,
                quality: 'standard',
              }),
            })
            if (!imgRes.ok) return null
            const imgData = await imgRes.json()
            return imgData.data?.[0]?.url || null
          } catch {
            return null
          }
        })
      )

      creatives = creatives.map((c, i) => ({
        ...c,
        generatedImage: imageResults[i] || null,
      }))
    }

    return json({
      creatives,
      style,
      format,
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
