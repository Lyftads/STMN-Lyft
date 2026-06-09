// Client Foreplay (ad intelligence) — codice originale LyftAI.
// Interroga l'API pubblica di Foreplay per cercare creatività dei competitor.
// Auth: header Authorization con la API key grezza. Doc: app.foreplay.co/api-overview
const BASE = 'https://public.api.foreplay.co'

function key() {
  return process.env.FOREPLAY_API_KEY || ''
}

async function call(path, params = {}) {
  if (!key()) return { error: 'FOREPLAY_API_KEY non configurata.' }
  const url = new URL(BASE + path)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  }
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: key(), Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    const credits = Number(res.headers.get('X-Credits-Remaining'))
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data?.message || data?.error || `Foreplay ${res.status}`, credits }
    return { data, credits: Number.isFinite(credits) ? credits : null }
  } catch (e) {
    return { error: e.message }
  }
}

// Estrae l'array di risultati da qualunque forma di risposta Foreplay.
function listOf(d) {
  if (Array.isArray(d)) return d
  return d?.data || d?.ads || d?.results || d?.brands || []
}
function cursorOf(d) {
  return d?.metadata?.cursor || d?.cursor || d?.paging?.cursor || d?.next || null
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

// Giorni che l'annuncio è in circolazione, da uno started_running in ms o secondi.
function runningDays(started) {
  if (!started) return null
  let t = num(started)
  if (!t) return null
  if (t < 1e12) t *= 1000 // secondi → ms
  const d = Math.floor((Date.now() - t) / 86400000)
  return d >= 0 ? d : null
}

// Euristica funnel leggera (originale): tofu/mofu/bofu da copy + CTA.
function funnelStage(text, cta) {
  const s = (text || '').toLowerCase()
  const c = (cta || '').toUpperCase()
  const bofu = /\b(shop|buy|order|sale|discount|% off|free shipping|code|checkout|subscribe|get yours|limited)\b/.test(s) || ['SHOP_NOW', 'GET_OFFER', 'ORDER_NOW', 'BUY_NOW', 'GET_OFFER_VIEW'].includes(c)
  const mofu = /\b(how it works|compare|review|guide|why|learn how|case study|results)\b/.test(s)
  if (bofu) return 'bofu'
  if (mofu) return 'mofu'
  return 'tofu'
}

const lower = (v) => (v || '').toString().toLowerCase()

// Normalizza un ad Foreplay nel formato usato dalla UI LyftAI.
export function normalizeAd(a = {}) {
  const fmtRaw = lower(a.display_format || a.displayFormat || a.type)
  const format = fmtRaw.includes('video') ? 'VIDEO'
    : fmtRaw.includes('carousel') ? 'CAROUSEL'
    : fmtRaw.includes('dco') || fmtRaw.includes('dpa') ? 'DCO'
    : fmtRaw.includes('image') || fmtRaw.includes('img') ? 'IMAGE' : (fmtRaw ? fmtRaw.toUpperCase() : 'OTHER')
  const platforms = Array.isArray(a.publisher_platform) ? a.publisher_platform
    : Array.isArray(a.platforms) ? a.platforms
    : a.publisher_platform ? [a.publisher_platform] : []
  const body = a.description || a.body || a.preview_text || ''
  const headline = a.headline || a.title || ''
  const started = a.started_running || a.startedRunning || a.start_date
  return {
    id: a.id || a._id || a.ad_id || a.adId || Math.random().toString(36).slice(2),
    adId: a.ad_id || a.adId || a.id || '',
    brand: a.name || a.page_name || a.pageName || a.brand_name || 'Brand',
    brandId: a.brand_id || a.brandId || '',
    headline,
    body,
    format,
    thumbnail: a.thumbnail || a.image || a.image_url || null,
    video: a.video || a.video_url || null,
    image: a.image || a.image_url || null,
    videoDuration: num(a.video_duration || a.videoDuration),
    linkUrl: a.link_url || a.linkUrl || '',
    cta: a.cta_type || a.call_to_action || a.callToAction || a.ctaType || '',
    platforms,
    niches: a.niches || a.niche || [],
    languages: a.languages || [],
    live: a.live === undefined ? null : !!a.live,
    runningDays: runningDays(started),
    funnel: funnelStage(`${headline} ${body}`, a.cta_type || a.call_to_action),
  }
}

export function normalizeBrand(b = {}) {
  const info = b.brand_info || b
  const adv = b.advertising_data || {}
  return {
    id: info.id || info.brand_id || b.id || '',
    name: info.name || b.name || 'Brand',
    domain: info.domain || b.domain || '',
    logo: info.logo || b.logo || null,
    totalAds: num(adv.total_ads ?? b.total_ads),
    activeAds: num(adv.active_ads ?? b.active_ads),
  }
}

// ── API pubbliche del client ────────────────────────────────────────────────
// Ricerca creatività nel discovery (con filtri lato server quando supportati).
export async function searchAds({ query = '', platform = '', format = '', order = '', limit = 40, cursor = '' } = {}) {
  const r = await call('/api/discovery/ads', {
    query, limit, cursor,
    ...(platform ? { publisher_platform: platform } : {}),
    ...(format ? { display_format: format } : {}),
    ...(order ? { order } : {}),
  })
  if (r.error) return r
  const raw = listOf(r.data)
  return { ads: raw.map(normalizeAd), cursor: cursorOf(r.data), credits: r.credits }
}

// Scopre brand per keyword/niche.
export async function searchBrands({ query = '', limit = 20 } = {}) {
  const r = await call('/api/discovery/brands', { query, limit })
  if (r.error) return r
  return { brands: listOf(r.data).map(normalizeBrand), credits: r.credits }
}

// Tutte le creatività di un brand (per brand id).
export async function adsByBrand({ brandId, limit = 40, cursor = '' } = {}) {
  if (!brandId) return { error: 'brandId mancante' }
  const r = await call('/api/brands/ads', { brand_ids: brandId, limit, cursor })
  if (r.error) return r
  return { ads: listOf(r.data).map(normalizeAd), cursor: cursorOf(r.data), credits: r.credits }
}
