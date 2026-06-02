export const dynamic = 'force-dynamic'
export const maxDuration = 45

import { NextResponse } from 'next/server'

// ── Ricerca per keyword sulla Meta Ad Library (endpoint AGGIUNTIVO e isolato) ──
// Cerca ads attive che contengono un termine, in un paese, su TUTTI gli
// advertiser (non solo i competitor noti). Prima prova la Ad Library API
// ufficiale (search_terms); se non disponibile, fa fallback su scraping HTML.
// Non tocca /api/competitor-intel.

const ACCESS_TOKEN =
  process.env.META_ACCESS_TOKEN ||
  process.env.FACEBOOK_ACCESS_TOKEN ||
  process.env.FB_ACCESS_TOKEN ||
  ''
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0'

function sanitize(v) {
  if (!v) return ''
  return String(v)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/\\"/g, '"')
    .trim()
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

    let videoUrl = null, isVideo = false
    const v = html.match(/<video[^>]*src="([^"]+)"/) || html.match(/"video_(?:sd|hd)_url":"([^"]+)"/) || html.match(/"playable_url":"([^"]+)"/)
    if (v) { videoUrl = v[1].replace(/\\u0025/g, '%').replace(/\\\//g, '/'); isVideo = true }

    let imageUrl = null
    const og = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/)
    if (og) imageUrl = og[1].replace(/&amp;/g, '&')
    else {
      const im = html.match(/<img[^>]*src="(https:\/\/scontent[^"]+)"/) || html.match(/<img[^>]*src="(https:\/\/external[^"]+)"/)
      if (im) imageUrl = im[1].replace(/&amp;/g, '&')
    }
    return { imageUrl, videoUrl, isVideo }
  } catch {
    return { imageUrl: null, videoUrl: null, isVideo: false }
  }
}

// ── 1) Ad Library API ufficiale (richiede token approvato) ──
async function searchViaApi(q, country) {
  if (!ACCESS_TOKEN) return null
  try {
    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/ads_archive`)
    url.searchParams.set('search_terms', q)
    url.searchParams.set('ad_reached_countries', JSON.stringify([country]))
    url.searchParams.set('ad_active_status', 'ACTIVE')
    url.searchParams.set('ad_type', 'ALL')
    url.searchParams.set('fields', [
      'ad_creative_bodies', 'ad_creative_link_captions', 'ad_creative_link_descriptions',
      'ad_creative_link_titles', 'ad_delivery_start_time', 'ad_snapshot_url',
      'page_name', 'publisher_platforms',
    ].join(','))
    url.searchParams.set('limit', '30')
    url.searchParams.set('access_token', ACCESS_TOKEN)

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) })
    const json = await res.json()
    if (json.error || !json.data?.length) return null

    const raw = json.data.map((ad) => ({
      id: ad.id,
      bodies: (ad.ad_creative_bodies || []).map(sanitize),
      captions: (ad.ad_creative_link_captions || []).map(sanitize),
      descriptions: (ad.ad_creative_link_descriptions || []).map(sanitize),
      titles: (ad.ad_creative_link_titles || []).map(sanitize),
      startDate: ad.ad_delivery_start_time || null,
      snapshotUrl: ad.ad_snapshot_url || null,
      pageName: sanitize(ad.page_name || ''),
      platforms: ad.publisher_platforms || ['facebook', 'instagram'],
      imageUrl: null, videoUrl: null, isVideo: false,
    }))

    const toEnrich = raw.slice(0, 9)
    for (let i = 0; i < toEnrich.length; i += 3) {
      const batch = toEnrich.slice(i, i + 3)
      const media = await Promise.all(batch.map(a => extractCreativeMedia(a.snapshotUrl)))
      batch.forEach((a, j) => { a.imageUrl = media[j].imageUrl; a.videoUrl = media[j].videoUrl; a.isVideo = media[j].isVideo })
    }
    return { ads: raw, count: raw.length, source: 'api' }
  } catch {
    return null
  }
}

// ── 2) Fallback: scraping della pagina pubblica di ricerca keyword ──
async function searchViaScrape(q, country) {
  const libraryUrl =
    `https://www.facebook.com/ads/library/?active_status=active&ad_type=all` +
    `&country=${encodeURIComponent(country)}&q=${encodeURIComponent(q)}` +
    `&search_type=keyword_unordered&media_type=all`
  try {
    const res = await fetch(libraryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    })
    if (!res.ok) return { ads: [], count: 0, source: 'scrape', httpError: `HTTP ${res.status}` }
    const html = await res.text()

    const snap = [...html.matchAll(/ad_snapshot_url["\s:]+["']?(https:\/\/www\.facebook\.com\/ads\/archive\/render_ad\/\?[^"'\s<]+)/g)]
    const snapshotUrls = [...new Set(snap.map(m => m[1].replace(/\\u0025/g, '%').replace(/\\\//g, '/').replace(/&amp;/g, '&')))]
    const imgs = [...html.matchAll(/src="(https:\/\/scontent[^"]+)"/g)]
    const allImages = [...new Set(imgs.map(m => m[1].replace(/&amp;/g, '&')))].filter(u => !u.includes('emoji') && !u.includes('profile') && !u.includes('safe_image'))
    const bodies = [...html.matchAll(/"ad_creative_bodies":\["([^"]+)"\]/g)]
    const titles = [...html.matchAll(/"ad_creative_link_titles":\["([^"]+)"\]/g)]
    const dates = [...html.matchAll(/"ad_delivery_start_time":"(\d{4}-\d{2}-\d{2})"/g)]
    const pages = [...html.matchAll(/"page_name":"([^"]+)"/g)]

    const ads = []
    const maxAds = Math.max(snapshotUrls.length, allImages.length, bodies.length)
    for (let i = 0; i < Math.min(maxAds, 24); i++) {
      ads.push({
        id: `kw_${i}`,
        bodies: bodies[i] ? [sanitize(bodies[i][1])] : [],
        titles: titles[i] ? [sanitize(titles[i][1])] : [],
        captions: [], descriptions: [],
        startDate: dates[i]?.[1] || null,
        snapshotUrl: snapshotUrls[i] || null,
        pageName: pages[i] ? sanitize(pages[i][1]) : '',
        platforms: ['facebook', 'instagram'],
        imageUrl: allImages[i] || null, videoUrl: null, isVideo: false,
      })
    }
    const filtered = ads.filter(a => a.imageUrl || a.bodies.length > 0 || a.snapshotUrl)
    return { ads: filtered, count: filtered.length, source: 'scrape' }
  } catch (e) {
    return { ads: [], count: 0, source: 'scrape', httpError: e.message }
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const country = (searchParams.get('country') || 'IT').toUpperCase()

  if (!q) {
    return NextResponse.json({ error: 'Parametro q (keyword) obbligatorio', ads: [], count: 0 }, { status: 400 })
  }

  const libraryUrl =
    `https://www.facebook.com/ads/library/?active_status=active&ad_type=all` +
    `&country=${encodeURIComponent(country)}&q=${encodeURIComponent(q)}` +
    `&search_type=keyword_unordered&media_type=all`

  // 1) API ufficiale → 2) scrape fallback
  let result = await searchViaApi(q, country)
  let source = 'api'
  if (!result || !result.ads?.length) {
    const scraped = await searchViaScrape(q, country)
    result = scraped
    source = scraped.source
  }

  const ads = result?.ads || []
  return NextResponse.json({
    query: q,
    country,
    ads,
    count: ads.length,
    source,
    error: ads.length === 0 ? (result?.httpError || 'no_results') : null,
    libraryUrl,
    fetchedAt: new Date().toISOString(),
  })
}
