export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getMeta } from '../../../lib/tenant/credentials'

// ── Ricerca per keyword sulla Meta Ad Library (endpoint AGGIUNTIVO e isolato) ──
// Fonti, in ordine: 1) Ad Library API ufficiale (search_terms) se il token e'
// approvato → 2) Browserless headless (renderizza la pagina pubblica, bypassa
// il 403 dello scraping statico) → 3) scrape statico → 4) link esterno.
// Non tocca /api/competitor-intel.
// Token Meta risolto per-tenant via context (env fallback per STMN beta).

const accessToken  = () => getMeta().accessToken || ''
const graphVersion = () => getMeta().graphVersion || 'v21.0'

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

function libraryUrlFor(q, country) {
  return (
    `https://www.facebook.com/ads/library/?active_status=active&ad_type=all` +
    `&country=${encodeURIComponent(country)}&q=${encodeURIComponent(q)}` +
    `&search_type=keyword_unordered&media_type=all`
  )
}

// Parser HTML condiviso (usato sia da Browserless sia dallo scrape statico)
function parseAdsFromHtml(html) {
  const snap = [...html.matchAll(/ad_snapshot_url["\s:]+["']?(https:\/\/www\.facebook\.com\/ads\/archive\/render_ad\/\?[^"'\s<]+)/g)]
  const snapshotUrls = [...new Set(snap.map(m => m[1].replace(/\\u0025/g, '%').replace(/\\\//g, '/').replace(/&amp;/g, '&')))]
  const imgs = [...html.matchAll(/(?:src|xlink:href)="(https:\/\/scontent[^"]+)"/g)]
  const allImages = [...new Set(imgs.map(m => m[1].replace(/&amp;/g, '&')))]
    .filter(u => !u.includes('emoji') && !u.includes('profile') && !u.includes('safe_image') && !u.includes('static.xx'))
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
  return ads.filter(a => a.imageUrl || a.bodies.length > 0 || a.snapshotUrl)
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
  if (!accessToken()) return null
  try {
    const url = new URL(`https://graph.facebook.com/${graphVersion()}/ads_archive`)
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
    url.searchParams.set('access_token', accessToken())

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) })
    const json = await res.json()
    if (json.error) return { ads: [], apiError: `${json.error.code || ''} ${json.error.message || ''}`.trim(), source: 'api' }
    if (!json.data?.length) return null

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
  } catch {
    return null
  }
}

// Estrae ads strutturate dalle risposte GraphQL dell'Ad Library (dato pulito,
// allineato per-annuncio). Cammina ricorsivamente cercando nodi con `snapshot`.
function collectSnapshotNodes(node, out, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 12) return
  if (Array.isArray(node)) { for (const x of node) collectSnapshotNodes(x, out, depth + 1); return }
  if (node.snapshot && typeof node.snapshot === 'object') {
    out.push(node)
  }
  for (const k in node) {
    const v = node[k]
    if (v && typeof v === 'object') collectSnapshotNodes(v, out, depth + 1)
  }
}

function adFromSnapshotNode(node) {
  const s = node.snapshot || {}
  const bodyText = typeof s.body === 'string' ? s.body : (s.body?.text || '')
  const images = Array.isArray(s.images) ? s.images : []
  const videos = Array.isArray(s.videos) ? s.videos : []
  const cards = Array.isArray(s.cards) ? s.cards : []

  let imageUrl =
    images[0]?.resized_image_url || images[0]?.original_image_url ||
    cards[0]?.resized_image_url || cards[0]?.original_image_url || null
  let videoUrl = videos[0]?.video_sd_url || videos[0]?.video_hd_url || null
  let isVideo = !!videoUrl
  if (!imageUrl) imageUrl = videos[0]?.video_preview_image_url || cards[0]?.video_preview_image_url || null

  const startEpoch = node.start_date || node.startDate || s.creation_time
  const startDate = startEpoch ? new Date(Number(startEpoch) * 1000).toISOString().slice(0, 10) : null
  const adId = node.ad_archive_id || node.adArchiveID || node.id || null

  const body = sanitize(bodyText || cards[0]?.body || '')
  const title = sanitize(s.title || cards[0]?.title || '')
  return {
    id: adId ? `gql_${adId}` : `gql_${Math.random().toString(36).slice(2)}`,
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
    // Le risposte FB sono spesso JSON multipli newline-delimited
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)
    const candidates = lines.length ? lines : [cleaned]
    for (const line of candidates) {
      try {
        const json = JSON.parse(line)
        collectSnapshotNodes(json, nodes)
      } catch { /* riga non-JSON, ignora */ }
    }
  }
  const seen = new Set()
  const ads = []
  for (const n of nodes) {
    const ad = adFromSnapshotNode(n)
    const key = ad.snapshotUrl || ad.imageUrl || ad.bodies[0]
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (ad.imageUrl || ad.bodies.length || ad.snapshotUrl) ads.push(ad)
    if (ads.length >= 60) break
  }
  return ads
}

// ── 2) Browserless headless: renderizza la pagina pubblica (bypassa 403) ──
async function searchViaBrowserless(q, country) {
  const token = process.env.BROWSERLESS_TOKEN
  if (!token) return null

  let browser
  try {
    const { default: puppeteer } = await import('puppeteer-core')
    const endpoint = process.env.BROWSERLESS_ENDPOINT || 'production-lon.browserless.io'
    const wsUrl = `wss://${endpoint}/?token=${encodeURIComponent(token)}`
    browser = await puppeteer.connect({ browserWSEndpoint: wsUrl })

    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({ 'Accept-Language': `${country.toLowerCase()},en;q=0.8` })

    // Cattura le risposte GraphQL dell'Ad Library (dato strutturato pulito)
    const gqlTexts = []
    page.on('response', async (resp) => {
      try {
        const url = resp.url()
        if (!url.includes('/api/graphql')) return
        const txt = await resp.text()
        if (txt.includes('"snapshot"') || txt.includes('ad_archive_id')) gqlTexts.push(txt)
      } catch { /* response gia' consumata o binaria */ }
    })

    await page.goto(libraryUrlFor(q, country), { waitUntil: 'networkidle2', timeout: 35000 })
    await new Promise(r => setTimeout(r, 2000))

    // Totale ads attive dichiarato dalla pagina ("~1.234 risultati / results")
    let total = null
    try {
      total = await page.evaluate(() => {
        const m = document.body.innerText.match(/~?\s*([\d., \s]+?)\s*(?:results|risultati|resultados|résultats|annunci|ads|Ergebnisse)/i)
        if (!m) return null
        const n = parseInt(m[1].replace(/[^\d]/g, ''), 10)
        return Number.isFinite(n) ? n : null
      })
    } catch {}

    // Carica più "pagine" di risultati (lazy-load), in modo LIMITATO: max 5
    // passaggi e stop appena non arriva una nuova risposta GraphQL.
    let prevResp = gqlTexts.length
    for (let p = 0; p < 5; p++) {
      await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight)
        window.dispatchEvent(new Event('scroll'))
      }).catch(() => {})
      await new Promise(r => setTimeout(r, 2200))
      if (gqlTexts.length <= prevResp) break
      prevResp = gqlTexts.length
    }

    // total_count dal GraphQL (numero reale di risultati)
    let gqlTotal = null
    for (const t of gqlTexts) {
      const m = t.match(/"total_count":\s*(\d+)/)
      if (m) { const n = parseInt(m[1], 10); if (Number.isFinite(n) && (gqlTotal == null || n > gqlTotal)) gqlTotal = n }
    }

    // 1° scelta: dato strutturato dalle risposte GraphQL intercettate
    let ads = parseAdsFromGraphql(gqlTexts)
    // 2° scelta: parsing dell'HTML renderizzato
    if (!ads.length) ads = parseAdsFromHtml(await page.content())

    const finalTotal = Math.max(gqlTotal || 0, total || 0) || null
    return { ads, total: finalTotal, source: 'browserless' }
  } catch (e) {
    return { ads: [], source: 'browserless', httpError: e.message }
  } finally {
    if (browser) await browser.disconnect().catch(() => {})
  }
}

// ── 3) Fallback: scrape statico (spesso 403 lato server) ──
async function searchViaScrape(q, country) {
  try {
    const res = await fetch(libraryUrlFor(q, country), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.7',
      },
      signal: AbortSignal.timeout(15000), redirect: 'follow',
    })
    if (!res.ok) return { ads: [], source: 'scrape', httpError: `HTTP ${res.status}` }
    const html = await res.text()
    return { ads: parseAdsFromHtml(html), source: 'scrape' }
  } catch (e) {
    return { ads: [], source: 'scrape', httpError: e.message }
  }
}

// Cache in-memory (per-istanza): TTL 3h sulle ricerche keyword.
const SEARCH_CACHE = new Map()
const SEARCH_TTL_MS = 3 * 60 * 60 * 1000

export async function GET(request) {
  return withTenantContext(request, async () => {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const country = (searchParams.get('country') || 'IT').toUpperCase()
  const force = searchParams.get('refresh') === '1'

  if (!q) {
    return NextResponse.json({ error: 'Parametro q (keyword) obbligatorio', ads: [], count: 0 }, { status: 400 })
  }

  const cacheKey = `${q.toLowerCase()}-${country}`
  const cached = SEARCH_CACHE.get(cacheKey)
  if (!force && cached && Date.now() - cached.ts < SEARCH_TTL_MS && cached.payload?.ads?.length) {
    return NextResponse.json({ ...cached.payload, cached: true })
  }

  let result = await searchViaApi(q, country)
  let source = 'api'
  let lastErr = result?.apiError || null

  if (!result || !result.ads?.length) {
    const bl = await searchViaBrowserless(q, country)
    if (bl?.ads?.length) { result = bl; source = 'browserless' }
    else { lastErr = bl?.httpError || lastErr; result = bl || result }
  }

  if (!result || !result.ads?.length) {
    const sc = await searchViaScrape(q, country)
    if (sc?.ads?.length) { result = sc; source = 'scrape' }
    else { lastErr = sc?.httpError || lastErr }
  }

  const ads = result?.ads || []
  const total = (result?.total != null && result.total > ads.length) ? result.total : null
  const capped = ads.length >= 60
  const payload = {
    query: q,
    country,
    ads,
    count: ads.length,
    total,
    capped,
    source: ads.length ? source : null,
    error: ads.length === 0 ? (lastErr || 'no_results') : null,
    libraryUrl: libraryUrlFor(q, country),
    fetchedAt: new Date().toISOString(),
  }
  if (ads.length) SEARCH_CACHE.set(cacheKey, { ts: Date.now(), payload })
  return NextResponse.json({ ...payload, cached: false })
  })
}
