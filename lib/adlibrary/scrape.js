// Meta Ad Library via SCRAPING dell'endpoint pubblico async del sito.
// Funziona SENZA app approvata e SENZA token: il sito ads/library è pubblico.
// Bonus rispetto all'API ufficiale: restituisce anche i MEDIA (immagini/video).
// Fragile per natura (Meta può cambiare/limitare): in caso di blocco si ripiega
// sull'API ufficiale. Niente login richiesto.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

function runningDays(epochSec) {
  if (!epochSec) return null
  const ms = num(epochSec) * (num(epochSec) < 1e12 ? 1000 : 1)
  const d = Math.floor((Date.now() - ms) / 86400000)
  return d >= 0 ? d : null
}

function funnelStage(text) {
  const s = (text || '').toLowerCase()
  if (/\b(shop|buy|order|acquista|compra|sconto|% off|spedizione gratis|codice|checkout|abbonati|saldi|offerta|get yours)\b/.test(s)) return 'bofu'
  if (/\b(come funziona|how it works|recensione|review|guida|guide|perché|why|risultati|results|confronta|compare)\b/.test(s)) return 'mofu'
  return 'tofu'
}

function img(snap) {
  const i = (snap.images || [])[0] || {}
  return i.original_image_url || i.resized_image_url || null
}
function vid(snap) {
  const v = (snap.videos || [])[0] || {}
  return { url: v.video_hd_url || v.video_sd_url || null, poster: v.video_preview_image_url || null }
}

function normalize(item = {}) {
  const snap = item.snapshot || {}
  const v = vid(snap)
  const image = img(snap)
  const cards = snap.cards || []
  const format = v.url ? 'VIDEO' : cards.length > 1 ? 'CAROUSEL' : image ? 'IMAGE' : 'AD'
  const body = (snap.body && (snap.body.text || (typeof snap.body === 'string' ? snap.body : ''))) || (cards[0] && cards[0].body) || ''
  const headline = snap.title || (cards[0] && cards[0].title) || snap.link_description || ''
  const id = item.adArchiveID || item.ad_archive_id || item.adid || ''
  const plat = item.publisherPlatform || snap.publisher_platform || item.publisher_platform || []
  return {
    id: String(id) || Math.random().toString(36).slice(2),
    adId: String(id),
    brand: item.pageName || snap.page_name || 'Pagina',
    brandId: item.pageID || item.page_id || '',
    headline,
    body,
    format,
    thumbnail: v.poster || image || (cards[0] && (cards[0].resized_image_url || cards[0].original_image_url)) || null,
    video: v.url || null,
    image: image || null,
    videoDuration: 0,
    linkUrl: snap.link_url || (cards[0] && cards[0].link_url) || '',
    snapshotUrl: id ? `https://www.facebook.com/ads/library/?id=${id}` : '',
    cta: snap.cta_text || (cards[0] && cards[0].cta_text) || '',
    platforms: Array.isArray(plat) ? plat : [plat].filter(Boolean),
    niches: [],
    languages: [],
    live: item.isActive === undefined ? null : !!item.isActive,
    runningDays: runningDays(item.startDate || snap.start_date),
    funnel: funnelStage(`${headline} ${body}`),
  }
}

// Cerca annunci via scraping dell'endpoint async pubblico.
export async function searchAds({ query = '', country = 'IT', limit = 40, cursor = '' } = {}) {
  const url = new URL('https://www.facebook.com/ads/library/async/search_ads/')
  const p = url.searchParams
  p.set('q', query)
  p.set('count', String(Math.min(50, limit)))
  p.set('active_status', 'all')
  p.set('ad_type', 'all')
  p.set('countries[0]', country)
  p.set('media_type', 'all')
  p.set('search_type', 'keyword_unordered')
  p.set('session_id', (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`))
  if (cursor) p.set('forward_cursor', cursor)
  p.set('__a', '1')
  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8', 'sec-fetch-site': 'same-origin' },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    let text = await res.text()
    if (!res.ok) return { error: `Ad Library ${res.status}` }
    // FB prefissa il JSON con "for (;;);"
    text = text.replace(/^for \(;;\);/, '').trim()
    let j
    try { j = JSON.parse(text) } catch { return { error: 'Risposta Ad Library non interpretabile (Meta potrebbe aver bloccato lo scraping da server).' } }
    const payload = j.payload || j
    const raw = payload.results || payload.adCards || []
    // results è spesso un array di array → appiattisci
    const flat = raw.flat ? raw.flat() : raw
    const ads = (Array.isArray(flat) ? flat : []).filter(Boolean).map(normalize)
    const next = payload.forwardCursor || payload.cursor || payload.forward_cursor || null
    if (!ads.length) return { ads: [], cursor: null, note: 'scrape_empty' }
    return { ads, cursor: next }
  } catch (e) { return { error: e.message } }
}
