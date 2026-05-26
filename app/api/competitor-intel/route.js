import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const ACCESS_TOKEN =
  process.env.META_ACCESS_TOKEN ||
  process.env.FACEBOOK_ACCESS_TOKEN ||
  process.env.FB_ACCESS_TOKEN ||
  ''

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0'

const COMPETITORS = [
  {
    id: 'velites',
    name: 'Velites',
    pageId: '234280280078173',
    origin: 'https://eu.velitessport.com',
    homepage: 'https://eu.velitessport.com/it',
  },
  {
    id: 'picsil',
    name: 'Picsil',
    pageId: '842231462504799',
    origin: 'https://it.picsilsport.com',
    homepage: 'https://it.picsilsport.com',
  },
  {
    id: 'froggrips',
    name: 'Frog Grips',
    pageId: '114720846967132',
    origin: 'https://froggrips.com.au',
    homepage: 'https://froggrips.com.au',
  },
]

// In-memory cache — survives across requests within same serverless instance
let cachedData = null
let cachedAt = null
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

function sanitize(v) {
  if (typeof v !== 'string') return v
  return v.replace(/[\x00-\x1f\x7f]/g, ' ').trim()
}

async function fetchAdLibrary(pageId, countries) {
  if (!ACCESS_TOKEN) {
    return { error: 'META_ACCESS_TOKEN non configurato', ads: [], count: 0 }
  }

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/ads_archive`)
  url.searchParams.set('search_page_ids', JSON.stringify([pageId]))
  url.searchParams.set('ad_reached_countries', JSON.stringify(countries))
  url.searchParams.set('ad_active_status', 'ACTIVE')
  url.searchParams.set('ad_type', 'ALL')
  url.searchParams.set(
    'fields',
    [
      'ad_creative_bodies',
      'ad_creative_link_captions',
      'ad_creative_link_descriptions',
      'ad_creative_link_titles',
      'ad_delivery_start_time',
      'ad_snapshot_url',
      'page_name',
      'publisher_platforms',
    ].join(',')
  )
  url.searchParams.set('limit', '50')
  url.searchParams.set('access_token', ACCESS_TOKEN)

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15000),
    })
    const json = await res.json()

    if (json.error) {
      return {
        error: `Meta API: ${json.error.message}`,
        code: json.error.code,
        ads: [],
        count: 0,
      }
    }

    const ads = (json.data || []).map((ad) => ({
      id: ad.id,
      bodies: (ad.ad_creative_bodies || []).map(sanitize),
      captions: (ad.ad_creative_link_captions || []).map(sanitize),
      descriptions: (ad.ad_creative_link_descriptions || []).map(sanitize),
      titles: (ad.ad_creative_link_titles || []).map(sanitize),
      startDate: ad.ad_delivery_start_time || null,
      snapshotUrl: ad.ad_snapshot_url || null,
      pageName: sanitize(ad.page_name || ''),
      platforms: ad.publisher_platforms || [],
    }))

    return { ads, count: ads.length, error: null }
  } catch (e) {
    return { error: e.message, ads: [], count: 0 }
  }
}

async function scrapeProducts(origin, homepage) {
  const result = {
    products: [],
    meta: {},
    promos: [],
    isShopify: false,
    error: null,
    stats: {},
  }

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/json,*/*',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
  }

  try {
    const shopifyRes = await fetch(`${origin}/products.json?limit=250`, {
      headers: { ...headers, Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    })

    if (shopifyRes.ok) {
      const ct = shopifyRes.headers.get('content-type') || ''
      if (ct.includes('json')) {
        const data = await shopifyRes.json()
        if (Array.isArray(data.products) && data.products.length > 0) {
          result.isShopify = true
          result.products = data.products.map((p) => {
            const price = parseFloat(p.variants?.[0]?.price) || 0
            const compareAt =
              parseFloat(p.variants?.[0]?.compare_at_price) || 0
            return {
              title: sanitize(p.title),
              handle: p.handle,
              url: `${origin}/products/${p.handle}`,
              image: p.images?.[0]?.src || '',
              price,
              compareAtPrice: compareAt > price ? compareAt : 0,
              onSale: compareAt > 0 && compareAt > price,
              discountPct:
                compareAt > price
                  ? Math.round((1 - price / compareAt) * 100)
                  : 0,
              available: p.variants?.some((v) => v.available) ?? true,
              vendor: sanitize(p.vendor || ''),
              type: sanitize(p.product_type || ''),
              tags: Array.isArray(p.tags)
                ? p.tags.map(sanitize)
                : typeof p.tags === 'string'
                  ? p.tags
                      .split(',')
                      .map((t) => sanitize(t.trim()))
                      .filter(Boolean)
                  : [],
              variantCount: p.variants?.length || 0,
              createdAt: p.created_at || null,
            }
          })

          const prices = result.products
            .filter((p) => p.price > 0)
            .map((p) => p.price)
          const onSale = result.products.filter((p) => p.onSale)
          const types = {}
          result.products.forEach((p) => {
            if (p.type) types[p.type] = (types[p.type] || 0) + 1
          })

          result.stats = {
            totalProducts: result.products.length,
            avgPrice:
              prices.length > 0
                ? prices.reduce((a, b) => a + b, 0) / prices.length
                : 0,
            minPrice: prices.length > 0 ? Math.min(...prices) : 0,
            maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
            onSaleCount: onSale.length,
            onSalePct:
              result.products.length > 0
                ? Math.round(
                    (onSale.length / result.products.length) * 100
                  )
                : 0,
            avgDiscount:
              onSale.length > 0
                ? Math.round(
                    onSale.reduce((a, p) => a + p.discountPct, 0) /
                      onSale.length
                  )
                : 0,
            categories: Object.entries(types)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10),
            availableCount: result.products.filter((p) => p.available).length,
            outOfStockCount: result.products.filter((p) => !p.available)
              .length,
          }
        }
      }
    }
  } catch (_) {
    // Not Shopify or endpoint blocked
  }

  try {
    const homeRes = await fetch(homepage, {
      headers,
      signal: AbortSignal.timeout(10000),
    })

    if (homeRes.ok) {
      const html = await homeRes.text()

      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is)
      const descMatch =
        html.match(
          /<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/is
        ) ||
        html.match(
          /<meta[^>]*content=["'](.*?)["'][^>]*name=["']description["']/is
        )
      const ogImageMatch =
        html.match(
          /<meta[^>]*property=["']og:image["'][^>]*content=["'](.*?)["']/is
        ) ||
        html.match(
          /<meta[^>]*content=["'](.*?)["'][^>]*property=["']og:image["']/is
        )

      result.meta = {
        title: sanitize(
          (titleMatch?.[1] || '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
        ),
        description: sanitize(
          (descMatch?.[1] || '')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
        ),
        ogImage: (ogImageMatch?.[1] || '').trim(),
      }

      const promoPatterns = [
        {
          re: /(\d+%\s*(?:off|sconto|di sconto|discount|descuento|rabatt))/gi,
          type: 'discount',
        },
        {
          re: /((?:free|gratis|gratuita?|envío gratis)\s*(?:shipping|spedizione|delivery|versand|envío)?)/gi,
          type: 'shipping',
        },
        {
          re: /((?:codice|code|coupon|cupón|voucher|promo(?:code)?)\s*[:=]?\s*[A-Z0-9]{3,20})/gi,
          type: 'code',
        },
        {
          re: /((?:saldi|sale|outlet|clearance|flash\s*sale|offert[ae]|rebajas|soldes))/gi,
          type: 'sale',
        },
        {
          re: /((?:compra|buy|acquista)\s*\d+\s*(?:get|ricevi|ottieni|paga)\s*\d+)/gi,
          type: 'bundle',
        },
      ]

      const promos = []
      for (const { re, type } of promoPatterns) {
        const matches = html.match(re) || []
        for (const m of matches) {
          promos.push({ text: sanitize(m), type })
        }
      }

      const seen = new Set()
      result.promos = promos
        .filter((p) => {
          const k = p.text.toLowerCase()
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
        .slice(0, 20)
    }
  } catch (e) {
    if (!result.error) result.error = e.message
  }

  return result
}

async function fetchAllCompetitors(countries) {
  return Promise.all(
    COMPETITORS.map(async (comp) => {
      const [adLibrary, websiteData] = await Promise.all([
        fetchAdLibrary(comp.pageId, countries),
        scrapeProducts(comp.origin, comp.homepage),
      ])

      return {
        id: comp.id,
        name: comp.name,
        websiteUrl: comp.homepage,
        pageId: comp.pageId,
        adLibrary,
        websiteData,
      }
    })
  )
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const competitorId = searchParams.get('competitor')
  const country = searchParams.get('country') || 'IT'
  const forceRefresh = searchParams.get('refresh') === '1'
  const isCron = request.headers.get('x-vercel-cron') === '1'

  const countries =
    country === 'ALL'
      ? ['IT', 'ES', 'US', 'AU', 'GB', 'FR', 'DE']
      : [country]

  const cacheKey = `${country}-all`
  const cacheValid =
    !forceRefresh &&
    !isCron &&
    cachedData &&
    cachedAt &&
    Date.now() - cachedAt < CACHE_TTL_MS

  let results

  if (cacheValid && !competitorId) {
    results = cachedData
  } else {
    results = await fetchAllCompetitors(countries)
    if (!competitorId) {
      cachedData = results
      cachedAt = Date.now()
    }
  }

  if (competitorId) {
    results = results.filter((c) => c.id === competitorId)
    if (!results.length) {
      return NextResponse.json(
        { error: 'Competitor non trovato' },
        { status: 404 }
      )
    }
  }

  return NextResponse.json(
    {
      competitors: results,
      countries,
      fetchedAt: cachedAt
        ? new Date(cachedAt).toISOString()
        : new Date().toISOString(),
      cached: cacheValid && !competitorId,
      nextRefresh: cachedAt
        ? new Date(cachedAt + CACHE_TTL_MS).toISOString()
        : null,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    }
  )
}
