import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getMeta, getTenantInfo } from '../../../lib/tenant/credentials'
import { getUserCompetitors } from '../../../lib/tenant/brand'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

// Creds risolte per-request dal contesto AsyncLocalStorage (withTenantContext).
// Per il tenant beta STMN i getter cadono su env var.
const accessToken   = () => getMeta().accessToken || ''
const graphVersion  = () => getMeta().graphVersion || 'v21.0'

// Store dell'azienda corrente per scrape competitor comparison.
// 'self' come id stabile (era 'stmn' hardcoded — solo label interna, non
// referenziata dal frontend).
function ownStore() {
  const { storeUrl } = getShopify()
  const { companyName } = getTenantInfo()
  return {
    id: 'self',
    name: companyName || 'STMN Fitness',
    origin: `https://${storeUrl || 'stamina-fitness3.myshopify.com'}`,
  }
}

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
    currency: 'AUD',
    homepage: 'https://froggrips.com.au',
    instagram: 'froggrips',
    facebook: 'froggrips',
  },
]

const CATEGORY_RULES = [
  {
    id: 'grips',
    label: 'Paracalli',
    match: (p) => {
      const title = p.title.toLowerCase()
      const s = `${title} ${p.type || ''} ${(p.tags||[]).join(' ')}`.toLowerCase()
      if (title.includes('borsa') || title.includes('bag') || title.includes('custodia')) return false
      return s.includes('grip') || s.includes('paracall') || s.includes('callera') ||
        s.includes('impugnatur') || s.includes('hand grip')
    },
  },
  {
    id: 'ropes',
    label: 'Corde',
    match: (p) => {
      const title = p.title.toLowerCase()
      const type = (p.type || '').toLowerCase()
      // Must contain a clear rope indicator in the TITLE
      const isRope = title.includes('corda da salto') || title.includes('corda veloce') ||
        title.includes('jump rope') || title.includes('corda rook') ||
        title.includes('corda abs') ||
        (type.includes('comba') && type.includes('veloci'))
      // Exclude accessories, bundles, cables
      const isExcluded = title.includes('cavo') || title.includes('cavi') || title.includes('cable') ||
        title.includes('anelli') || title.includes('kit cavo') ||
        title.includes('extension') || title.includes('pacchetto') || title.includes('pack') ||
        title.includes('handle') || title.includes('borsa')
      return isRope && !isExcluded
    },
  },
  {
    id: 'knee_sleeves',
    label: 'Ginocchiere',
    match: (p) => {
      const s = `${p.title} ${p.type} ${(p.tags||[]).join(' ')}`.toLowerCase()
      return s.includes('knee') || s.includes('ginocch') || s.includes('rodillera') || s.includes('neoboost')
    },
  },
  {
    id: 'men_apparel',
    label: 'Abbigliamento Uomo',
    match: (p) => {
      const title = p.title.toLowerCase()
      const type = (p.type || '').toLowerCase()
      const tagsArr = (p.tags || []).map(t => t.toLowerCase())
      const tags = tagsArr.join(' ')
      const s = `${title} ${type} ${tags}`

      const hasMen = tags.includes('uomo') || tags.includes('abbigliamento uomo') ||
        s.includes('hombre') || type.includes('hombre')
      const hasWomen = tags.includes('donna') || tags.includes('abbigliamento donna') ||
        s.includes('mujer') || type.includes('mujer')

      // Unisex (tagged both): only count as men if title says "unisex" or doesn't say "donna/woman"
      if (hasMen && hasWomen) {
        return title.includes('unisex') && !title.includes('donna') && !title.includes('woman')
      }

      // Exclusive men's
      if (hasMen && !hasWomen) {
        return s.includes('shirt') || s.includes('short') || s.includes('hoodie') ||
          s.includes('jogger') || s.includes('sweat') || s.includes('camiseta') ||
          s.includes('felpa') || s.includes('pantalone') || s.includes('cargo') ||
          s.includes('workout') || s.includes('maillot') || s.includes('textil') ||
          tags.includes('abbigliamento')
      }

      // Competitor: type contains men's indicator exclusively
      if (type.includes('hombre') && !type.includes('mujer')) return true
      if ((title.includes(' men') || title.includes("men's")) && !title.includes('women')) return true

      return false
    },
  },
  {
    id: 'women_apparel',
    label: 'Abbigliamento Donna',
    match: (p) => {
      const title = p.title.toLowerCase()
      const type = (p.type || '').toLowerCase()
      const tagsArr = (p.tags || []).map(t => t.toLowerCase())
      const tags = tagsArr.join(' ')
      const s = `${title} ${type} ${tags}`

      const hasMen = tags.includes('uomo') || tags.includes('abbigliamento uomo') ||
        s.includes('hombre') || type.includes('hombre')
      const hasWomen = tags.includes('donna') || tags.includes('abbigliamento donna') ||
        s.includes('mujer') || type.includes('mujer') ||
        tags.includes('bra') || tags.includes('leggings')

      // Unisex (tagged both): only count as women if title says "donna/woman"
      if (hasMen && hasWomen) {
        return title.includes('donna') || title.includes('woman')
      }

      // Exclusive women's
      if (hasWomen && !hasMen) {
        return s.includes('shirt') || s.includes('short') || s.includes('hoodie') ||
          s.includes('jogger') || s.includes('sweat') || s.includes('crop') ||
          s.includes('bra') || s.includes('legging') || s.includes('camiseta') ||
          s.includes('felpa') || s.includes('pantalone') || s.includes('tank') ||
          s.includes('sujetador') || s.includes('textil') ||
          tags.includes('abbigliamento') || tags.includes('abbigliamento donna')
      }

      // Competitor: type contains women's indicator exclusively
      if (type.includes('mujer') && !type.includes('hombre')) return true
      if ((title.includes('women') || title.includes("woman")) && !title.includes(' men')) return true
      if (title.includes('donna') && !title.includes('uomo')) return true

      return false
    },
  },
  {
    id: 'bags',
    label: 'Zaini / Borsoni',
    match: (p) => {
      const title = p.title.toLowerCase()
      const s = `${title} ${p.type || ''} ${(p.tags||[]).join(' ')}`.toLowerCase()
      // Exclude gloves, sandbags, and cheap tote/shopping bags
      if (title.includes('guant') || title.includes('glove')) return false
      if (s.includes('sandbag')) return false
      if (title.includes('tote bag') && p.price < 10) return false
      return s.includes('backpack') || s.includes('zaino') || s.includes('borsone') ||
        s.includes('mochila') || s.includes('duffel') ||
        (s.includes('borsa') && !s.includes('borsetta')) ||
        (title.includes('bag') && p.price > 15)
    },
  },
]

function categorizeProduct(product) {
  for (const rule of CATEGORY_RULES) {
    if (rule.match(product)) return rule.id
  }
  return null
}

function buildPriceComparison(ownProducts, competitorProductsMap) {
  const categories = CATEGORY_RULES.map(rule => {
    const own = ownProducts.filter(p => categorizeProduct(p) === rule.id && p.price > 0)
    const ownAvg = own.length > 0 ? own.reduce((s, p) => s + p.price, 0) / own.length : null
    const ownMin = own.length > 0 ? Math.min(...own.map(p => p.price)) : null
    const ownMax = own.length > 0 ? Math.max(...own.map(p => p.price)) : null

    const competitors = {}
    for (const [compId, products] of Object.entries(competitorProductsMap)) {
      const matched = products.filter(p => categorizeProduct(p) === rule.id && p.price > 0)
      if (matched.length > 0) {
        const avg = matched.reduce((s, p) => s + p.price, 0) / matched.length
        const compCurrency = matched[0]?.currency || 'EUR'
        const sameUnit = compCurrency === 'EUR'
        competitors[compId] = {
          count: matched.length,
          avg: Math.round(avg * 100) / 100,
          min: Math.round(Math.min(...matched.map(p => p.price)) * 100) / 100,
          max: Math.round(Math.max(...matched.map(p => p.price)) * 100) / 100,
          currency: compCurrency,
          deltaEuro: sameUnit && ownAvg != null ? Math.round((ownAvg - avg) * 100) / 100 : null,
          deltaPct: sameUnit && ownAvg != null && avg > 0 ? Math.round(((ownAvg - avg) / avg) * 10000) / 100 : null,
          products: matched.sort((a,b)=>a.price-b.price).map(p => ({ title: p.title, price: p.price, compareAtPrice: p.compareAtPrice||0, onSale: p.onSale||false, image: p.image, currency: compCurrency })),
        }
      }
    }

    return {
      id: rule.id,
      label: rule.label,
      own: {
        count: own.length,
        avg: ownAvg != null ? Math.round(ownAvg * 100) / 100 : null,
        min: ownMin != null ? Math.round(ownMin * 100) / 100 : null,
        max: ownMax != null ? Math.round(ownMax * 100) / 100 : null,
        products: own.sort((a,b)=>a.price-b.price).map(p => ({ title: p.title, price: p.price, compareAtPrice: p.compareAtPrice||0, onSale: p.onSale||false, image: p.image })),
      },
      competitors,
    }
  })

  return categories.filter(c => c.own.count > 0 || Object.values(c.competitors).some(v => v.count > 0))
}

// In-memory cache — survives across requests within same serverless instance
let cachedData = null
let cachedAt = null
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

function sanitize(v) {
  if (typeof v !== 'string') return v
  return v.replace(/[\x00-\x1f\x7f]/g, ' ').trim()
}

async function fetchFacebookPage(pageId) {
  if (!accessToken()) return null
  try {
    const url = `https://graph.facebook.com/${graphVersion()}/${pageId}?fields=name,fan_count,followers_count,about,category,link,posts.limit(5){message,created_time,shares,likes.summary(true),comments.summary(true)}&access_token=${accessToken()}`
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

// ── Scrape della pagina pubblica Ad Library (no API, no permessi) ──
async function scrapeAdLibraryPage(pageId, pageName) {
  const libraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=${pageId}&search_type=page&media_type=all`
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
  }

  try {
    const res = await fetch(libraryUrl, { headers, signal: AbortSignal.timeout(12000), redirect: 'follow' })
    if (!res.ok) return { ads: [], count: 0, error: `HTTP ${res.status}`, source: 'scrape' }
    const html = await res.text()

    const ads = []

    // Extract ad snapshot URLs from the HTML
    const snapshotMatches = [...html.matchAll(/ad_snapshot_url["\s:]+["']?(https:\/\/www\.facebook\.com\/ads\/archive\/render_ad\/\?[^"'\s<]+)/g)]
    const snapshotUrls = [...new Set(snapshotMatches.map(m => m[1].replace(/\\u0025/g, '%').replace(/\\\//g, '/').replace(/&amp;/g, '&')))]

    // Extract images from the page (ad creative thumbnails)
    const imageMatches = [...html.matchAll(/src="(https:\/\/scontent[^"]+)"/g)]
    const allImages = [...new Set(imageMatches.map(m => m[1].replace(/&amp;/g, '&')))]
      .filter(url => !url.includes('emoji') && !url.includes('profile') && !url.includes('safe_image'))

    // Extract ad copy/bodies from the page
    const bodyMatches = [...html.matchAll(/"ad_creative_bodies":\["([^"]+)"\]/g)]
    const titleMatches = [...html.matchAll(/"ad_creative_link_titles":\["([^"]+)"\]/g)]
    const startDateMatches = [...html.matchAll(/"ad_delivery_start_time":"(\d{4}-\d{2}-\d{2})"/g)]

    // Try to extract structured ad data from JSON embedded in HTML
    const jsonChunks = [...html.matchAll(/\{"ad_creative_bodies":\[([^\]]*)\][^}]*"ad_snapshot_url":"([^"]+)"[^}]*\}/g)]

    if (jsonChunks.length > 0) {
      for (const chunk of jsonChunks.slice(0, 15)) {
        const bodiesRaw = chunk[1]
        const snapshotRaw = chunk[2].replace(/\\\//g, '/').replace(/\\u0025/g, '%')
        const bodies = bodiesRaw ? [sanitize(bodiesRaw.replace(/^"|"$/g, '').replace(/\\n/g, '\n'))] : []

        ads.push({
          id: `scrape_${ads.length}`,
          bodies,
          titles: [],
          captions: [],
          descriptions: [],
          startDate: null,
          snapshotUrl: snapshotRaw,
          pageName: pageName || '',
          platforms: ['facebook', 'instagram'],
          imageUrl: null,
          videoUrl: null,
          isVideo: false,
        })
      }
    }

    // If no structured data found, build ads from individual matches
    if (ads.length === 0) {
      const maxAds = Math.max(snapshotUrls.length, allImages.length, bodyMatches.length)
      for (let i = 0; i < Math.min(maxAds, 15); i++) {
        ads.push({
          id: `scrape_${i}`,
          bodies: bodyMatches[i] ? [sanitize(bodyMatches[i][1].replace(/\\n/g, '\n'))] : [],
          titles: titleMatches[i] ? [sanitize(titleMatches[i][1])] : [],
          captions: [],
          descriptions: [],
          startDate: startDateMatches[i]?.[1] || null,
          snapshotUrl: snapshotUrls[i] || null,
          pageName: pageName || '',
          platforms: ['facebook', 'instagram'],
          imageUrl: allImages[i] || null,
          videoUrl: null,
          isVideo: false,
        })
      }
    }

    // Enrich ads that have snapshot URLs but no images (batch 4 at a time)
    const toEnrich = ads.filter(a => a.snapshotUrl && !a.imageUrl).slice(0, 8)
    for (let i = 0; i < toEnrich.length; i += 4) {
      const batch = toEnrich.slice(i, i + 4)
      const mediaResults = await Promise.all(
        batch.map(a => extractCreativeMedia(a.snapshotUrl))
      )
      batch.forEach((ad, j) => {
        ad.imageUrl = mediaResults[j].imageUrl
        ad.videoUrl = mediaResults[j].videoUrl
        ad.isVideo = mediaResults[j].isVideo
      })
    }

    // Assign remaining images to ads without one
    let imgIdx = 0
    for (const ad of ads) {
      if (!ad.imageUrl && allImages[imgIdx]) {
        ad.imageUrl = allImages[imgIdx]
        imgIdx++
      }
    }

    return {
      ads: ads.filter(a => a.imageUrl || a.bodies.length > 0 || a.snapshotUrl),
      count: ads.length,
      error: null,
      source: 'scrape',
    }
  } catch (e) {
    return { ads: [], count: 0, error: `Scrape failed: ${e.message}`, source: 'scrape' }
  }
}

async function fetchAdLibrary(pageId, countries, pageName) {
  // Try API first
  if (accessToken()) {
    const url = new URL(`https://graph.facebook.com/${graphVersion()}/ads_archive`)
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
    url.searchParams.set('access_token', accessToken())

    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) })
      const json = await res.json()

      if (!json.error && json.data?.length > 0) {
        const rawAds = json.data.map((ad) => ({
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

        const remaining = rawAds.slice(12).map(ad => ({
          ...ad, imageUrl: null, videoUrl: null, isVideo: false,
        }))

        return { ads: [...enriched, ...remaining], count: rawAds.length, error: null, source: 'api' }
      }
    } catch {}
  }

  // Fallback: scrape public Ad Library page
  return scrapeAdLibraryPage(pageId, pageName)
}

async function scrapeProducts(origin, homepage, forceCountry = null) {
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
    const cookieHeader = forceCountry
      ? `localization=${forceCountry}; cart_currency=${forceCountry === 'AU' ? 'AUD' : 'EUR'}`
      : 'localization=IT; cart_currency=EUR'
    const shopifyRes = await fetch(`${origin}/products.json?limit=250`, {
      headers: {
        ...headers,
        Accept: 'application/json',
        Cookie: cookieHeader,
      },
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

// Risolve la lista competitor: prima prova brand_identity.competitors
// dell'utente, fallback su COMPETITORS hardcoded (defaults STMN per tenant
// beta). Normalizza la shape per essere consumabile dal resto del codice.
async function resolveCompetitors() {
  const userList = await getUserCompetitors()
  if (userList.length === 0) return COMPETITORS

  return userList.map(c => {
    // Estrae username Instagram da URL completo se necessario
    let igHandle = c.instagram || ''
    const igMatch = igHandle.match(/instagram\.com\/([^/?#]+)/i)
    if (igMatch) igHandle = igMatch[1]
    igHandle = igHandle.replace(/^@/, '').replace(/\/$/, '')

    // Origin dal website (https://example.com)
    let origin = c.website || ''
    if (origin && !/^https?:\/\//i.test(origin)) origin = `https://${origin}`
    const homepage = origin

    return {
      id: c.id,
      name: c.name || c.id,
      pageId: c.pageId || null,
      origin,
      homepage,
      instagram: igHandle,
      facebook: c.facebook || '',
    }
  })
}

async function fetchAllCompetitors(countries) {
  const list = await resolveCompetitors()
  return Promise.all(
    list.map(async (comp) => {
      const [adLibrary, websiteDataRaw, facebookData, instagramData] = await Promise.all([
        // Senza pageId non possiamo fare il fetch ads — ritorna struttura vuota
        comp.pageId
          ? fetchAdLibrary(comp.pageId, countries, comp.name)
          : Promise.resolve({ ads: [], pageName: null, error: 'pageId mancante' }),
        scrapeProducts(comp.origin, comp.homepage, comp.currency === 'AUD' ? 'AU' : 'IT'),
        comp.pageId
          ? fetchFacebookPage(comp.pageId)
          : Promise.resolve(null),
        fetchInstagramProfile(comp.instagram),
      ])

      const websiteData = { ...websiteDataRaw }
      if (comp.currency) {
        websiteData.currency = comp.currency
        websiteData.products = (websiteDataRaw.products || []).map(p => ({
          ...p,
          currency: comp.currency,
        }))
      }

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
  return withTenantContext(request, async () => {
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

  // Scrape own products for price comparison
  let priceComparison = null
  try {
    const ownData = await scrapeProducts(ownStore().origin, ownStore().origin, 'IT')
    const ownProducts = ownData.products || []
    const competitorProductsMap = {}
    for (const comp of results) {
      const name = COMPETITORS.find(c => c.id === comp.id)?.name || comp.id
      if (comp.websiteData?.products?.length > 0) {
        competitorProductsMap[name] = comp.websiteData.products
      }
    }
    if (ownProducts.length > 0) {
      priceComparison = buildPriceComparison(ownProducts, competitorProductsMap)
    }
  } catch (e) {
    console.log('Price comparison error:', e.message)
  }

  return NextResponse.json(
    {
      competitors: results,
      priceComparison,
      ownStoreName: ownStore().name,
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
  })
}
