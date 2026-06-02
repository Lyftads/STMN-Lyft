export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'

// ── Ricerca per keyword sulla Meta Ad Library pubblica (no API, no permessi) ──
// Endpoint AGGIUNTIVO e isolato: non tocca /api/competitor-intel.
// Cerca ads attive che contengono un termine, in un paese, su tutti gli
// advertiser (non solo i competitor noti). Riusa lo stesso approccio di
// scraping HTML del modulo competitor, ma in forma autonoma.

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

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const country = (searchParams.get('country') || 'IT').toUpperCase()

  if (!q) {
    return NextResponse.json({ error: 'Parametro q (keyword) obbligatorio', ads: [], count: 0 }, { status: 400 })
  }

  const libraryUrl =
    `https://www.facebook.com/ads/library/?active_status=active&ad_type=all` +
    `&country=${encodeURIComponent(country)}` +
    `&q=${encodeURIComponent(q)}` +
    `&search_type=keyword_unordered&media_type=all`

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
  }

  try {
    const res = await fetch(libraryUrl, { headers, signal: AbortSignal.timeout(15000), redirect: 'follow' })
    if (!res.ok) {
      return NextResponse.json({ query: q, country, ads: [], count: 0, error: `HTTP ${res.status}`, libraryUrl }, { status: 200 })
    }
    const html = await res.text()

    const ads = []

    // Pagine + advertiser associati ad ogni snapshot (best-effort)
    const snapshotMatches = [...html.matchAll(/ad_snapshot_url["\s:]+["']?(https:\/\/www\.facebook\.com\/ads\/archive\/render_ad\/\?[^"'\s<]+)/g)]
    const snapshotUrls = [...new Set(snapshotMatches.map(m => m[1].replace(/\\u0025/g, '%').replace(/\\\//g, '/').replace(/&amp;/g, '&')))]

    const imageMatches = [...html.matchAll(/src="(https:\/\/scontent[^"]+)"/g)]
    const allImages = [...new Set(imageMatches.map(m => m[1].replace(/&amp;/g, '&')))]
      .filter(url => !url.includes('emoji') && !url.includes('profile') && !url.includes('safe_image'))

    const bodyMatches = [...html.matchAll(/"ad_creative_bodies":\["([^"]+)"\]/g)]
    const titleMatches = [...html.matchAll(/"ad_creative_link_titles":\["([^"]+)"\]/g)]
    const startDateMatches = [...html.matchAll(/"ad_delivery_start_time":"(\d{4}-\d{2}-\d{2})"/g)]
    const pageNameMatches = [...html.matchAll(/"page_name":"([^"]+)"/g)]

    const maxAds = Math.max(snapshotUrls.length, allImages.length, bodyMatches.length)
    for (let i = 0; i < Math.min(maxAds, 24); i++) {
      ads.push({
        id: `kw_${i}`,
        bodies: bodyMatches[i] ? [sanitize(bodyMatches[i][1])] : [],
        titles: titleMatches[i] ? [sanitize(titleMatches[i][1])] : [],
        captions: [],
        descriptions: [],
        startDate: startDateMatches[i]?.[1] || null,
        snapshotUrl: snapshotUrls[i] || null,
        pageName: pageNameMatches[i] ? sanitize(pageNameMatches[i][1]) : '',
        platforms: ['facebook', 'instagram'],
        imageUrl: allImages[i] || null,
        videoUrl: null,
        isVideo: false,
      })
    }

    const filtered = ads.filter(a => a.imageUrl || a.bodies.length > 0 || a.snapshotUrl)

    return NextResponse.json({
      query: q,
      country,
      ads: filtered,
      count: filtered.length,
      error: null,
      libraryUrl,
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ query: q, country, ads: [], count: 0, error: e.message, libraryUrl }, { status: 200 })
  }
}
