export const dynamic = 'force-dynamic'
export const maxDuration = 55

import { NextResponse } from 'next/server'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

let cache = null
let cacheAt = null
const CACHE_TTL = 4 * 60 * 60 * 1000

async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8', ...opts.headers },
      signal: AbortSignal.timeout(opts.timeout || 10000),
      ...opts,
    })
    if (!res.ok) return null
    return res
  } catch { return null }
}

// ── Trustpilot ──
async function scrapeTrustpilot(domain) {
  const res = await safeFetch(`https://www.trustpilot.com/review/${domain}`)
  if (!res) return null
  const html = await res.text()

  const ratingMatch = html.match(/"ratingValue"\s*:\s*"?([\d.]+)"?/)
  const countMatch = html.match(/"reviewCount"\s*:\s*"?(\d+)"?/)
  const reviews = []

  const reviewBlocks = html.match(/"reviewBody"\s*:\s*"(.*?)"/g) || []
  for (const block of reviewBlocks.slice(0, 8)) {
    const text = block.match(/"reviewBody"\s*:\s*"(.*?)"/)?.[1] || ''
    if (text.length > 10) reviews.push(text.replace(/\\n/g, ' ').replace(/\\"/g, '"').slice(0, 300))
  }

  const ratingBlocks = html.match(/"ratingValue"\s*:\s*"?([\d.]+)"?/g) || []
  const ratings = ratingBlocks.slice(1, 9).map(b => parseFloat(b.match(/([\d.]+)/)?.[1] || '0'))

  return {
    domain,
    rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
    reviewCount: countMatch ? parseInt(countMatch[1], 10) : null,
    recentReviews: reviews.map((text, i) => ({ text, rating: ratings[i] || null })),
  }
}

// ── Amazon reviews ──
async function scrapeAmazonReviews(searchTerm) {
  const res = await safeFetch(`https://www.amazon.it/s?k=${encodeURIComponent(searchTerm)}&i=sporting`, { timeout: 12000 })
  if (!res) return null
  const html = await res.text()

  const products = []
  const cards = html.match(/data-asin="[A-Z0-9]{10}"/g) || []
  const titles = [...html.matchAll(/<span class="a-size-base-plus a-color-base a-text-normal">(.*?)<\/span>/g)]
  const ratings = [...html.matchAll(/(\d[.,]\d)\s*su\s*5\s*stelle/g)]
  const reviewCounts = [...html.matchAll(/(\d[\d.]*)\s*(?:recensioni|valutazioni)/g)]
  const prices = [...html.matchAll(/(\d+)[,.](\d{2})\s*€/g)]

  for (let i = 0; i < Math.min(titles.length, 5); i++) {
    products.push({
      title: titles[i]?.[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 100) || '',
      rating: ratings[i] ? parseFloat(ratings[i][1].replace(',', '.')) : null,
      reviewCount: reviewCounts[i] ? parseInt(reviewCounts[i][1].replace(/\./g, ''), 10) : null,
      price: prices[i] ? parseFloat(`${prices[i][1]}.${prices[i][2]}`) : null,
    })
  }

  return { searchTerm, products }
}

// ── YouTube RSS ──
async function fetchYouTubeChannel(channelName, channelId) {
  let feedUrl
  if (channelId) {
    feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  } else {
    const pageRes = await safeFetch(`https://www.youtube.com/@${channelName}`, { timeout: 8000 })
    if (!pageRes) return { name: channelName, error: 'not_found', videos: [] }
    const pageHtml = await pageRes.text()
    const cidMatch = pageHtml.match(/channel_id=([a-zA-Z0-9_-]{20,30})/) || pageHtml.match(/"channelId":"([a-zA-Z0-9_-]{20,30})"/)
    if (!cidMatch) return { name: channelName, error: 'no_channel_id', videos: [] }
    feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${cidMatch[1]}`
  }

  const feedRes = await safeFetch(feedUrl, { timeout: 8000 })
  if (!feedRes) return { name: channelName, error: 'feed_failed', videos: [] }
  const xml = await feedRes.text()

  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, 5)
  const videos = entries.map(e => {
    const content = e[1]
    const title = content.match(/<title>(.*?)<\/title>/)?.[1] || ''
    const published = content.match(/<published>(.*?)<\/published>/)?.[1] || ''
    const videoId = content.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || ''
    const views = content.match(/<media:statistics views="(\d+)"/)?.[1]
    return {
      title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'"),
      published: published.slice(0, 10),
      videoId,
      url: `https://youtube.com/watch?v=${videoId}`,
      views: views ? parseInt(views, 10) : null,
    }
  })

  const subsMatch = xml.match(/<media:statistics[^>]*subscribers="(\d+)"/)

  return { name: channelName, videos, subscribers: subsMatch ? parseInt(subsMatch[1], 10) : null }
}

// ── Instagram public profile ──
async function fetchInstagramBasic(username) {
  const res = await safeFetch(`https://www.instagram.com/${username}/`, { timeout: 8000 })
  if (!res) return { username, error: 'not_accessible' }
  const html = await res.text()

  const followersMatch = html.match(/"edge_followed_by":\{"count":(\d+)\}/) || html.match(/"follower_count":(\d+)/)
  const bioMatch = html.match(/"biography":"(.*?)"/)
  const nameMatch = html.match(/"full_name":"(.*?)"/)

  return {
    username,
    fullName: nameMatch?.[1]?.replace(/\\u[\dA-Fa-f]{4}/g, '') || username,
    followers: followersMatch ? parseInt(followersMatch[1], 10) : null,
    bio: bioMatch?.[1]?.replace(/\\n/g, ' ').slice(0, 200) || null,
  }
}

const TRUSTPILOT_DOMAINS = [
  { name: 'STMN Fitness', domain: 'stmnfitness.com' },
  { name: 'Velites', domain: 'velitessport.com' },
  { name: 'Picsil', domain: 'picsilsport.com' },
]

const AMAZON_SEARCHES = [
  'paracalli crossfit',
  'hand grips crossfit',
  'zaino crossfit palestra',
]

const INFLUENCERS = [
  { name: 'Francesco Agostinis', youtube: 'FrancescoAgostinis', instagram: 'francescoagostinis' },
  { name: 'Tommaso Pieretti', youtube: 'TommasoPieretti', instagram: 'tommasopieretti' },
  { name: 'Alessandro Gargiulo', youtube: 'AlessandroGargiulo', instagram: 'gargiuloalessandro' },
  { name: 'Manel Gomez', youtube: 'ManelGomez', instagram: 'manelgomez' },
  { name: 'Alessio Cordeddu', youtube: 'AlessioCordeddu', instagram: 'alessiocordeddu' },
  { name: 'Alex Fedotoff', youtube: 'AlexFedotoff', instagram: 'alexfedotoff' },
  { name: 'Matt Orlić', youtube: 'MattOrlic', instagram: 'mattorlic' },
]

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const forceRefresh = searchParams.get('refresh') === '1'

  if (!forceRefresh && cache && cacheAt && Date.now() - cacheAt < CACHE_TTL) {
    return NextResponse.json(cache)
  }

  try {
    const [trustpilotResults, amazonResults, youtubeResults, instagramResults] = await Promise.all([
      Promise.all(TRUSTPILOT_DOMAINS.map(d => scrapeTrustpilot(d.domain).catch(() => null))),
      Promise.all(AMAZON_SEARCHES.map(s => scrapeAmazonReviews(s).catch(() => null))),
      Promise.all(INFLUENCERS.map(i => fetchYouTubeChannel(i.youtube).catch(() => ({ name: i.youtube, error: 'failed', videos: [] })))),
      Promise.all(INFLUENCERS.map(i => fetchInstagramBasic(i.instagram).catch(() => ({ username: i.instagram, error: 'failed' })))),
    ])

    const trustpilot = {}
    TRUSTPILOT_DOMAINS.forEach((d, i) => { trustpilot[d.name] = trustpilotResults[i] })

    const amazon = {}
    AMAZON_SEARCHES.forEach((s, i) => { amazon[s] = amazonResults[i] })

    const influencers = INFLUENCERS.map((inf, i) => ({
      name: inf.name,
      youtube: youtubeResults[i],
      instagram: instagramResults[i],
    }))

    const result = {
      trustpilot,
      amazon,
      influencers,
      fetchedAt: new Date().toISOString(),
    }

    cache = result
    cacheAt = Date.now()

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
