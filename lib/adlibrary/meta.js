// Meta Ad Library — fonte UFFICIALE e GRATUITA per le creatività dei competitor.
// Riusa il token Meta già configurato (getMeta().accessToken). Niente Foreplay,
// niente crediti. Endpoint: Graph API /ads_archive.
// Nota: l'API restituisce il TESTO degli annunci + un ad_snapshot_url (link al
// rendering su Facebook). Non fornisce direttamente media/thumbnail.
import { getMeta } from '../tenant/credentials'

const GRAPH = 'https://graph.facebook.com/v19.0'

function token() {
  try { return getMeta().accessToken || '' } catch { return '' }
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

function runningDays(startIso) {
  if (!startIso) return null
  const t = Date.parse(startIso)
  if (!Number.isFinite(t)) return null
  const d = Math.floor((Date.now() - t) / 86400000)
  return d >= 0 ? d : null
}

function funnelStage(text) {
  const s = (text || '').toLowerCase()
  if (/\b(shop|buy|order|acquista|compra|sconto|% off|spedizione gratis|codice|checkout|subscribe|abbonati|saldi|offerta)\b/.test(s)) return 'bofu'
  if (/\b(how it works|come funziona|recensione|review|guida|guide|perché|why|risultati|results|confronta|compare)\b/.test(s)) return 'mofu'
  return 'tofu'
}

// Normalizza un record /ads_archive nella forma usata dalla UI Creative Intel.
function normalize(a = {}) {
  const headline = (a.ad_creative_link_titles && a.ad_creative_link_titles[0]) || ''
  const body = (a.ad_creative_bodies && a.ad_creative_bodies[0]) || ''
  const caption = (a.ad_creative_link_captions && a.ad_creative_link_captions[0]) || ''
  const active = !a.ad_delivery_stop_time
  return {
    id: a.id,
    adId: a.id,
    brand: a.page_name || 'Pagina',
    brandId: a.page_id || '',
    headline,
    body,
    format: 'AD',
    thumbnail: null,
    video: null,
    image: null,
    videoDuration: 0,
    linkUrl: caption || '',
    snapshotUrl: a.ad_snapshot_url || '',
    cta: '',
    platforms: a.publisher_platforms || [],
    niches: [],
    languages: a.languages || [],
    live: active,
    runningDays: runningDays(a.ad_delivery_start_time),
    funnel: funnelStage(`${headline} ${body}`),
  }
}

// Cerca annunci nella Ad Library per keyword in uno o più Paesi.
// country: codice ISO (es. 'IT'); media: ALL|IMAGE|VIDEO|MEME|NONE
export async function searchAds({ query = '', country = 'IT', media = '', limit = 40, after = '' } = {}) {
  if (!token()) return { error: 'META_ACCESS_TOKEN non configurato.' }
  const url = new URL(`${GRAPH}/ads_archive`)
  const params = {
    search_terms: query,
    ad_reached_countries: JSON.stringify([country]),
    ad_active_status: 'ALL',
    ad_type: 'ALL',
    fields: 'id,page_id,page_name,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_captions,ad_snapshot_url,publisher_platforms,ad_delivery_start_time,ad_delivery_stop_time,languages',
    limit: String(Math.min(50, limit)),
    access_token: token(),
    ...(media ? { media_type: media } : {}),
    ...(after ? { after } : {}),
  }
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, v)
  try {
    const res = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(30000) })
    const j = await res.json().catch(() => ({}))
    if (!res.ok || j.error) return { error: j?.error?.message || `Meta Ad Library ${res.status}` }
    return { ads: (j.data || []).map(normalize), cursor: j.paging?.cursors?.after || null }
  } catch (e) { return { error: e.message } }
}
