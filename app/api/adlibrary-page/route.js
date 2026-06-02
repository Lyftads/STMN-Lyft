export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

// ── Ads attive di UNA pagina (advertiser) dalla Meta Ad Library ──
// Endpoint AGGIUNTIVO e isolato: NON tocca /api/competitor-intel.
// Usato dal client per popolare le creative dei competitor quando l'API
// ufficiale non e' ancora approvata. Fonti: 1) Ad Library API (search_page_ids)
// → 2) Browserless headless (render + intercetta GraphQL) → 3) link.
// Quando l'app Meta sara' approvata, la fonte (1) prende il sopravvento da sola.

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
    .replace(/\\n/g, '\n').replace(/\\\//g, '/').replace(/&amp;/g, '&').replace(/\\"/g, '"')
    .trim()
}

function pageUrlFor(pageId, country) {
  return (
    `https://www.facebook.com/ads/library/?active_status=active&ad_type=all` +
    `&country=${encodeURIComponent(country)}&view_all_page_id=${encodeURIComponent(pageId)}` +
    `&search_type=page&media_type=all`
  )
}

// ── Parser delle risposte GraphQL (dato strutturato per-annuncio) ──
function collectSnapshotNodes(node, out, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 12) return
  if (Array.isArray(node)) { for (const x of node) collectSnapshotNodes(x, out, depth + 1); return }
  if (node.snapshot && typeof node.snapshot === 'object') out.push(node)
  for (const k in node) { const v = node[k]; if (v && typeof v === 'object') collectSnapshotNodes(v, out, depth + 1) }
}

function adFromSnapshotNode(node) {
  const s = node.snapshot || {}
  const bodyText = typeof s.body === 'string' ? s.body : (s.body?.text || '')
  const images = Array.isArray(s.images) ? s.images : []
  const videos = Array.isArray(s.videos) ? s.videos : []
  const cards = Array.isArray(s.cards) ? s.cards : []
  let imageUrl = images[0]?.resized_image_url || images[0]?.original_image_url || cards[0]?.resized_image_url || cards[0]?.original_image_url || null
  let videoUrl = videos[0]?.video_sd_url || videos[0]?.video_hd_url || null
  let isVideo = !!videoUrl
  if (!imageUrl) imageUrl = videos[0]?.video_preview_image_url || cards[0]?.video_preview_image_url || null
  const startEpoch = node.start_date || node.startDate || s.creation_time
  const startDate = startEpoch ? new Date(Number(startEpoch) * 1000).toISOString().slice(0, 10) : null
  const adId = node.ad_archive_id || node.adArchiveID || node.id || null
  const body = sanitize(bodyText || cards[0]?.body || '')
  const title = sanitize(s.title || cards[0]?.title || '')
  return {
    id: adId ? `pg_${adId}` : `pg_${Math.random().toString(36).slice(2)}`,
    bodies: body ? [body] : [],
    titles: title ? [title] : [],
    captions: s.caption ? [sanitize(s.caption)] : [],
    descriptions: s.link_description ? [sanitize(s.link_description)] : [],
    startDate,
    snapshotUrl: adId ? `https://www.facebook.com/ads/library/?id=${adId}` : null,
    pageName: sanitize(s.page_name || ''),
    platforms: Array.isArray(node.publisher_platform) ? node.publisher_platform.map(p => String(p).toLowerCase()) : ['facebook', 'instagram'],
    imageUrl, videoUrl, isVideo,
  }
}

function parseAdsFromGraphql(texts) {
  const nodes = []
  for (const raw of texts) {
    if (!raw) continue
    const cleaned = raw.replace(/^for\s*\(;;\);/, '').trim()
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)
    for (const line of (lines.length ? lines : [cleaned])) {
      try { collectSnapshotNodes(JSON.parse(line), nodes) } catch {}
    }
  }
  const seen = new Set(); const ads = []
  for (const n of nodes) {
    const ad = adFromSnapshotNode(n)
    const key = ad.snapshotUrl || ad.imageUrl || ad.bodies[0]
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (ad.imageUrl || ad.bodies.length || ad.snapshotUrl) ads.push(ad)
    if (ads.length >= 24) break
  }
  return ads
}

async function extractCreativeMedia(snapshotUrl) {
  if (!snapshotUrl) return { imageUrl: null, videoUrl: null, isVideo: false }
  try {
    const res = await fetch(snapshotUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(8000), redirect: 'follow',
    })
    if (!res.ok) return { imageUrl: null, videoUrl: null, isVideo: false }
    const html = await res.text()
    let videoUrl = null, isVideo = false
    const v = html.match(/<video[^>]*src="([^"]+)"/) || html.match(/"video_(?:sd|hd)_url":"([^"]+)"/) || html.match(/"playable_url":"([^"]+)"/)
    if (v) { videoUrl = v[1].replace(/\\u0025/g, '%').replace(/\\\//g, '/'); isVideo = true }
    let imageUrl = null
    const og = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/)
    if (og) imageUrl = og[1].replace(/&amp;/g, '&')
    else { const im = html.match(/<img[^>]*src="(https:\/\/scontent[^"]+)"/); if (im) imageUrl = im[1].replace(/&amp;/g, '&') }
    return { imageUrl, videoUrl, isVideo }
  } catch { return { imageUrl: null, videoUrl: null, isVideo: false } }
}

async function viaApi(pageId, country) {
  if (!ACCESS_TOKEN) return null
  try {
    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/ads_archive`)
    url.searchParams.set('search_page_ids', JSON.stringify([pageId]))
    url.searchParams.set('ad_reached_countries', JSON.stringify([country]))
    url.searchParams.set('ad_active_status', 'ACTIVE')
    url.searchParams.set('ad_type', 'ALL')
    url.searchParams.set('fields', ['ad_creative_bodies','ad_creative_link_captions','ad_creative_link_descriptions','ad_creative_link_titles','ad_delivery_start_time','ad_snapshot_url','page_name','publisher_platforms'].join(','))
    url.searchParams.set('limit', '24')
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
    return { ads: raw, source: 'api' }
  } catch { return null }
}

async function viaBrowserless(pageId, country) {
  const token = process.env.BROWSERLESS_TOKEN
  if (!token) return null
  let browser
  try {
    const { default: puppeteer } = await import('puppeteer-core')
    const endpoint = process.env.BROWSERLESS_ENDPOINT || 'production-lon.browserless.io'
    browser = await puppeteer.connect({ browserWSEndpoint: `wss://${endpoint}/?token=${encodeURIComponent(token)}` })
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({ 'Accept-Language': `${country.toLowerCase()},en;q=0.8` })
    const gqlTexts = []
    page.on('response', async (resp) => {
      try {
        if (!resp.url().includes('/api/graphql')) return
        const txt = await resp.text()
        if (txt.includes('"snapshot"') || txt.includes('ad_archive_id')) gqlTexts.push(txt)
      } catch {}
    })
    await page.goto(pageUrlFor(pageId, country), { waitUntil: 'networkidle2', timeout: 38000 })
    await new Promise(r => setTimeout(r, 2500))
    await page.evaluate(() => window.scrollBy(0, 1800)).catch(() => {})
    await new Promise(r => setTimeout(r, 2500))
    const ads = parseAdsFromGraphql(gqlTexts)
    return { ads, source: 'browserless' }
  } catch (e) {
    return { ads: [], source: 'browserless', httpError: e.message }
  } finally {
    if (browser) await browser.disconnect().catch(() => {})
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const pageId = (searchParams.get('pageId') || '').trim()
  const country = (searchParams.get('country') || 'IT').toUpperCase()
  if (!pageId) return NextResponse.json({ error: 'pageId obbligatorio', ads: [], count: 0 }, { status: 400 })

  let result = await viaApi(pageId, country)
  let source = 'api'
  if (!result || !result.ads?.length) {
    const bl = await viaBrowserless(pageId, country)
    result = bl
    source = 'browserless'
  }
  const ads = result?.ads || []
  return NextResponse.json({
    pageId, country, ads, count: ads.length,
    source: ads.length ? source : null,
    error: ads.length === 0 ? (result?.httpError || 'no_results') : null,
    libraryUrl: pageUrlFor(pageId, country),
    fetchedAt: new Date().toISOString(),
  })
}
