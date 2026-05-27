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
    instagram: 'velitessport',
    facebook: 'velitessport',
  },
  {
    id: 'picsil',
    name: 'Picsil',
    pageId: '842231462504799',
    origin: 'https://it.picsilsport.com',
    homepage: 'https://it.picsilsport.com',
    instagram: 'picsilsport',
    facebook: 'picsilsport',
  },
  {
    id: 'froggrips',
    name: 'Frog Grips',
    pageId: '114720846967132',
    origin: 'https://froggrips.com.au',
    homepage: 'https://froggrips.com.au',
    instagram: 'froggrips',
    facebook: 'froggrips',
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

async function fetchFacebookPage(pageId) {
  if (!ACCESS_TOKEN) return null
  try {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}?fields=name,fan_count,followers_count,about,category,link,posts.limit(5){message,created_time,shares,likes.summary(true),comments.summary(true)}&access_token=${ACCESS_TOKEN}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const data = await res.json()
    if (data.error) return null

    const posts = (data.posts?.data || []).map(p => ({
      message: sanitize((p.message || '').slice(0, 200)),
      date: p.created_time,
      likes: p.likes?.summary?.total_count || 0,
      comments: p.comments?.summary?.total_count || 0,
      shares: p.shares?.count || 0,
    }))

    const totalEng = posts.reduce((s, p) => s + p.likes + p.comments + p.shares, 0)

    return {
      name: data.name,
      fans: data.fan_count || data.followers_count || 0,
      category: data.category || '',
      about: sanitize((data.about || '').slice(0, 300)),
      recentPosts: posts,
      avgEngagement: posts.length > 0 ? Math.round(totalEng / posts.length) : 0,
      engagementRate: posts.length > 0 && (data.fan_count || 0) > 0 ? ((totalEng / posts.length) / data.fan_count * 100).toFixed(2) + '%' : null,
    }
  } catch { return null }
}

async function fetchInstagramProfile(username) {
  if (!username) return null
  try {
    const res = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'X-IG-App-ID': '936619743392459',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const htmlRes = await fetch(`https://www.instagram.com/${username}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000),
      })
      if (!htmlRes.ok) return { username, error: 'not_accessible' }
      const html = await htmlRes.text()

      const followersMatch = html.match(/"edge_followed_by":\{"count":(\d+)\}/) || html.match(/"follower_count":(\d+)/) || html.match(/(\d[\d,.]+)\s*(?:Follower|follower|seguaci)/i)
      const followingMatch = html.match(/"edge_follow":\{"count":(\d+)\}/) || html.match(/"following_count":(\d+)/)
      const postsMatch = html.match(/"edge_owner_to_timeline_media":\{"count":(\d+)\}/) || html.match(/"media_count":(\d+)/)
      const bioMatch = html.match(/"biography":"(.*?)"/)
      const nameMatch = html.match(/"full_name":"(.*?)"/)

      return {
        username,
        fullName: nameMatch ? sanitize(nameMatch[1]) : username,
        followers: followersMatch ? parseInt(followersMatch[1].replace(/[,.]/g, ''), 10) : null,
        following: followingMatch ? parseInt(followingMatch[1], 10) : null,
        posts: postsMatch ? parseInt(postsMatch[1], 10) : null,
        bio: bioMatch ? sanitize(bioMatch[1].replace(/\\n/g, ' ').slice(0, 300)) : null,
        source: 'html_scrape',
      }
    }

    const data = await res.json()
    const user = data?.data?.user
    if (!user) return { username, error: 'user_not_found' }

    const recentMedia = (user.edge_owner_to_timeline_media?.edges || []).slice(0, 6)
    const mediaData = recentMedia.map(e => ({
      likes: e.node?.edge_liked_by?.count || 0,
      comments: e.node?.edge_media_to_comment?.count || 0,
      caption: sanitize((e.node?.edge_media_to_caption?.edges?.[0]?.node?.text || '').slice(0, 150)),
      isVideo: e.node?.is_video || false,
      timestamp: e.node?.taken_at_timestamp,
    }))

    const totalEng = mediaData.reduce((s, m) => s + m.likes + m.comments, 0)
    const followers = user.edge_followed_by?.count || 0

    return {
      username,
      fullName: sanitize(user.full_name || ''),
      followers,
      following: user.edge_follow?.count || 0,
      posts: user.edge_owner_to_timeline_media?.count || 0,
      bio: sanitize((user.biography || '').slice(0, 300)),
      isVerified: user.is_verified || false,
      isBusinessAccount: user.is_business_account || false,
      profilePic: user.profile_pic_url_hd || user.profile_pic_url || '',
      recentMedia: mediaData,
      avgEngagement: mediaData.length > 0 ? Math.round(totalEng / mediaData.length) : 0,
      engagementRate: mediaData.length > 0 && followers > 0 ? ((totalEng / mediaData.length) / followers * 100).toFixed(2) + '%' : null,
      source: 'api',
    }
  } catch {
    return { username, error: 'fetch_failed' }
  }
}

async function extractCreativeMedia(snapshotUrl) {
  if (!snapshotUrl) return { imageUrl: null, videoUrl: null, isVideo: false }
  try {
    const res = await fetch(snapshotUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })
    if (!res.ok) return { imageUrl: null, videoUrl: null, isVideo: false }
    const html = await res.text()

    let videoUrl = null
    let isVideo = false
    const videoMatch = html.match(/<video[^>]*src="([^"]+)"/) ||
                       html.match(/"video_sd_url":"([^"]+)"/) ||
                       html.match(/"video_hd_url":"([^"]+)"/) ||
                       html.match(/"playable_url":"([^"]+)"/)
    if (videoMatch) {
      videoUrl = videoMatch[1].replace(/\\u0025/g, '%').replace(/\\\//g, '/')
      isVideo = true
    }

    let imageUrl = null
    const ogMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/)
    if (ogMatch) {
      imageUrl = ogMatch[1].replace(/&amp;/g, '&')
    } else {
      const imgMatch = html.match(/<img[^>]*class="[^"]*_9-jz[^"]*"[^>]*src="([^"]+)"/) ||
                       html.match(/<img[^>]*src="(https:\/\/scontent[^"]+)"/) ||
                       html.match(/<img[^>]*src="(https:\/\/external[^"]+)"/)
      if (imgMatch) imageUrl = imgMatch[1].replace(/&amp;/g, '&')
    }

    if (!imageUrl && !videoUrl) {
      const anyImg = html.match(/<img[^>]*src="(https?:\/\/[^"]+)"[^>]*style="[^"]*max-width/)
      if (anyImg) imageUrl = anyImg[1].replace(/&amp;/g, '&')
    }

    return { imageUrl, videoUrl, isVideo }
  } catch {
    return { imageUrl: null, videoUrl: null, isVideo: false }
  }
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

    const rawAds = (json.data || []).map((ad) => ({
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

    // Extract creative media for the first 12 ads (batched 4 at a time)
    const adsToEnrich = rawAds.slice(0, 12)
    const enriched = []
    for (let i = 0; i < adsToEnrich.length; i += 4) {
      const batch = adsToEnrich.slice(i, i + 4)
      const mediaResults = await Promise.all(
        batch.map(ad => extractCreativeMedia(ad.snapshotUrl))
      )
      batch.forEach((ad, j) => {
        enriched.push({ ...ad, ...mediaResults[j] })
      })
    }

    // Remaining ads (beyond 12) without media extraction
    const remaining = rawAds.slice(12).map(ad => ({
      ...ad, imageUrl: null, videoUrl: null, isVideo: false,
    }))

    const ads = [...enriched, ...remaining]
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
      const [adLibrary, websiteData, facebookData, instagramData] = await Promise.all([
        fetchAdLibrary(comp.pageId, countries),
        scrapeProducts(comp.origin, comp.homepage),
        fetchFacebookPage(comp.pageId),
        fetchInstagramProfile(comp.instagram),
      ])

      return {
        id: comp.id,
        name: comp.name,
        websiteUrl: comp.homepage,
        pageId: comp.pageId,
        instagram: comp.instagram,
        adLibrary,
        websiteData,
        social: {
          facebook: facebookData,
          instagram: instagramData,
        },
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
