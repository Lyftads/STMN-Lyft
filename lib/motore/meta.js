import { db } from './db'
import { getNangoToken, META_INTEGRATION } from './nango'

const GRAPH = process.env.META_GRAPH_VERSION || 'v20.0'

// Credenziali del workspace. Ordine di priorita' IDENTICO a LyftAI:
// token Nango (refresh gestito) → token salvato su companies → env.
// Leggere solo companies.meta_access_token porta a token stantii.
export async function getMetaCreds(workspaceId) {
  const { data } = await db()
    .from('companies')
    // NB: si seleziona '*' come fa LyftAI. Elencare 'nango_connection_id' fa
    // fallire l'INTERA select (colonna inesistente in questo schema) e il token
    // torna null con l'errore fuorviante "Meta non collegato".
    .select('*')
    .eq('user_id', workspaceId)
    .maybeSingle()

  // La mappa provider→connectionId sta su companies.nango_connections (jsonb),
  // con fallback legacy sul singolo companies.nango_connection_id.
  const conns = (data?.nango_connections && typeof data.nango_connections === 'object')
    ? data.nango_connections : {}
  const connId = conns[META_INTEGRATION] || data?.nango_connection_id || null

  const fresh = connId
    ? await getNangoToken({ integrationId: META_INTEGRATION, connectionId: connId })
    : null

  // Niente ripiego sulle variabili d'ambiente: sarebbero le stesse per ogni cliente, cioe' il
  // conto pubblicitario di uno letto dentro il workspace di un altro.
  const accessToken = fresh || data?.meta_access_token || null
  // meta_account_id puo' essere una lista separata da virgole (multi-account):
  // Saracino ne ha uno solo, ma il parsing resta tollerante.
  const adAccountId = (data?.meta_account_id || '')
    .split(',')[0].trim() || null

  return { accessToken, adAccountId, viaNango: !!fresh }
}

async function graph(path, params, token) {
  const qs = new URLSearchParams({ ...params, access_token: token })
  const res = await fetch(`https://graph.facebook.com/${GRAPH}/${path}?${qs}`, {
    cache: 'no-store',
    // 30s non bastavano piu' una volta aggiunti i campi video: le pagine di
    // insights sono piu' grosse e Meta impiega di piu' a comporle. Il timeout
    // scattava a meta' paginazione e l'ingest tornava 502 dopo due minuti di
    // lavoro gia' fatto.
    signal: AbortSignal.timeout(90000),
  })
  const j = await res.json().catch(() => ({}))
  // Gli errori Meta vanno PROPAGATI, non inghiottiti: un ingest che fallisce in
  // silenzio riempie la board di zeri che sembrano dati veri.
  if (!res.ok || j?.error) {
    const e = new Error(j?.error?.message || `Graph HTTP ${res.status}`)
    e.code = j?.error?.code
    throw e
  }
  return j
}

export async function graphAll(path, params, token, max = 50) {
  let out = [], after = null, pages = 0
  do {
    const j = await graph(path, after ? { ...params, after } : params, token)
    out = out.concat(j?.data || [])
    after = j?.paging?.cursors?.after && j?.paging?.next ? j.paging.cursors.after : null
  } while (after && ++pages < max)
  return out
}

const A = (actions, keys) => {
  if (!Array.isArray(actions)) return 0
  for (const k of keys) {
    const hit = actions.find(a => a?.action_type === k)
    if (hit) return Number(hit.value) || 0
  }
  return 0
}
const PURCHASE = ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase']

// Insights a LIVELLO INSERZIONE per un intervallo di giorni.
// I KPI ricalcolati qui sono gli stessi di LyftAI /api/meta-detail.
export async function fetchAdInsights({ accessToken, adAccountId, since, until }) {
  const rows = await graphAll(`${adAccountId}/insights`, {
    level: 'ad',
    time_increment: 1,                 // una riga per giorno: serve la serie
    time_range: JSON.stringify({ since, until }),
    limit: '500',
    fields: [
      'date_start', 'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name',
      'spend', 'impressions', 'frequency', 'cpm', 'inline_link_clicks',
      'inline_link_click_ctr', 'cost_per_inline_link_click', 'actions', 'action_values',
      // Metriche video: senza, un video si giudica solo sul ROAS, cioè quando
      // ha già speso. Hook rate e hold rate dicono se il problema è l'attacco
      // o la tenuta MOLTO prima che il ROAS diventi leggibile.
      'video_play_actions',                 // riproduzioni avviate
      'video_p25_watched_actions',          // arrivati al 25%
      'video_p50_watched_actions',
      'video_p75_watched_actions',
      'video_p100_watched_actions',         // completati
      'video_thruplay_watched_actions',     // 15s o completo
      'video_avg_time_watched_actions',     // secondi medi visti
    ].join(','),
  }, accessToken)

  // I campi video arrivano come liste di {action_type, value}: si somma il
  // valore, che per le metriche video è unico.
  const V = (lista) => Array.isArray(lista)
    ? lista.reduce((t, x) => t + (Number(x.value) || 0), 0) : 0

  return rows.map(r => {
    const spend = Number(r.spend) || 0
    const impressions = Number(r.impressions) || 0
    const linkClicks = Number(r.inline_link_clicks) || 0
    const purchases = A(r.actions, PURCHASE)
    const purchaseValue = A(r.action_values, PURCHASE)
    // ATTENZIONE alla definizione di hook rate. `video_play_actions` conta le
    // riproduzioni AVVIATE, e con l'autoplay di Meta quasi ogni impression
    // avvia: misurato così l'hook rate usciva fra l'86% e il 98% su tutte le
    // creatività, cioè non distingueva niente. Un indicatore che non separa
    // è peggio di nessun indicatore, perché lo si guarda e ci si fida.
    // L'hook vero è la visualizzazione a 3 SECONDI: chi si è davvero fermato.
    const views3 = A(r.actions, ['video_view'])
    const plays = V(r.video_play_actions)
    const p25 = V(r.video_p25_watched_actions)
    const p50 = V(r.video_p50_watched_actions)
    const p75 = V(r.video_p75_watched_actions)
    const p100 = V(r.video_p100_watched_actions)
    const thru = V(r.video_thruplay_watched_actions)
    const secondi = V(r.video_avg_time_watched_actions)
    return {
      day: r.date_start,
      ad_id: r.ad_id,
      ad_name: r.ad_name || r.ad_id,
      adset_id: r.adset_id,
      adset_name: r.adset_name,
      campaign_name: r.campaign_name,
      spend,
      impressions,
      link_clicks: linkClicks,
      ctr: Number(r.inline_link_click_ctr) || (impressions ? (linkClicks / impressions) * 100 : 0),
      cpm: Number(r.cpm) || 0,
      cpc: Number(r.cost_per_inline_link_click) || (linkClicks ? spend / linkClicks : 0),
      frequency: Number(r.frequency) || 0,
      purchases,
      purchase_value: purchaseValue,
      roas: spend > 0 ? purchaseValue / spend : 0,
      // --- video ---------------------------------------------------------
      // HOOK RATE = riproduzioni / impression: quanti si fermano nei primi
      // secondi. Dice se l'ATTACCO funziona.
      // HOLD RATE = thruplay / riproduzioni: di quelli che si sono fermati,
      // quanti sono rimasti. Dice se il CONTENUTO regge.
      // Sono due problemi diversi e vanno separati: un hook alto con hold
      // basso è un video che promette e non mantiene, e rifarne l'attacco
      // peggiora le cose.
      video_plays: plays,
      video_p25: p25, video_p50: p50, video_p75: p75, video_p100: p100,
      video_thruplay: thru,
      video_secondi_medi: secondi,
      video_views_3s: views3,
      // HOOK = si è fermato nei primi 3 secondi, sul totale di chi l'ha visto.
      hook_rate: impressions ? (views3 / impressions) * 100 : 0,
      // HOLD = di chi si è fermato, quanti sono rimasti fino in fondo.
      hold_rate: views3 ? (thru / views3) * 100 : 0,
      completamento: views3 ? (p100 / views3) * 100 : 0,
    }
  })
}

// Miniatura e immagine di ogni creativita', in batch da 50.
// Lo stato che conta e' `effective_status`, non `status`: un'inserzione ATTIVA
// dentro un adset in pausa e' spenta a tutti gli effetti, e `status` da solo
// direbbe che sta girando. Chi spegne su Meta si aspetta che il software se ne
// accorga, e la differenza fra i due campi e' esattamente il caso in cui non
// se ne accorgeva.
export async function fetchAdStatuses(adIds, token) {
  const out = {}
  for (let i = 0; i < adIds.length; i += 50) {
    const chunk = adIds.slice(i, i + 50)
    const j = await graph('', { ids: chunk.join(','), fields: 'effective_status' }, token)
    for (const id of chunk) if (j[id]?.effective_status) out[id] = j[id].effective_status
  }
  return out
}

// Solo ACTIVE e' acceso. Tutto il resto — in pausa a qualunque livello,
// archiviata, cancellata, in revisione, bocciata — non sta girando, e per il
// motore la differenza fra "in pausa" e "archiviata" non cambia nessuna
// decisione.
export const accesa = (stato) => String(stato || '').toUpperCase() === 'ACTIVE'

export async function fetchAdCreatives(adIds, token) {
  const out = {}
  for (let i = 0; i < adIds.length; i += 50) {
    const chunk = adIds.slice(i, i + 50)
    const j = await graph('', { ids: chunk.join(','), fields: 'created_time,creative{id},adset{id,name}' }, token)
    for (const id of chunk) if (j[id]) out[id] = j[id]
  }
  return out
}

// Il creative ANNIDATO nell'inserzione è parziale: object_story_spec e
// asset_feed_spec arrivano vuoti o monchi, ed è per questo che copy, CTA e link
// risultavano mancanti. Va rifetchato per intero, uno per uno.
// thumbnail_width/height sono ciò che evita le immagini sgranate: senza, Meta
// restituisce miniature minuscole che ingrandite si sfaldano.
const IMG = Number(process.env.META_CREATIVE_IMAGE_SIZE || 1080)

const pausa = (ms) => new Promise(r => setTimeout(r, ms))

export async function fetchFullCreatives(creativeIds, token) {
  const out = {}
  // Meta applica un limite per applicazione (errore code 4): chiedere 134
  // creative di fila lo fa scattare a metà lavoro, lasciando dati parziali.
  // Lotti piccoli, una pausa fra l'uno e l'altro, e allo scatto del limite ci
  // si ferma restituendo quello che si è già ottenuto — il resto lo prende il
  // giro successivo, invece di far fallire tutto l'ingest.
  for (let i = 0; i < creativeIds.length; i += 20) {
    const chunk = creativeIds.slice(i, i + 20)
    try {
      const j = await graph('', {
        ids: chunk.join(','),
        fields: 'id,name,thumbnail_url,image_url,video_id,object_story_spec,asset_feed_spec,effective_object_story_id',
        thumbnail_width: String(IMG), thumbnail_height: String(IMG),
      }, token)
      for (const id of chunk) if (j[id]) out[id] = j[id]
    } catch (e) {
      if (e?.code === 4 || e?.code === 17 || /request limit/i.test(e?.message || '')) {
        out.__limite = true
        return out
      }
    }
    if (i + 20 < creativeIds.length) await pausa(1200)
  }
  return out
}

// Segmenti di pubblico REALI, dal breakdown nativo di Meta.
// Niente deduzioni dai nomi di campagna: 'prospecting' = pubblico nuovo,
// 'existing' = clienti esistenti, 'engaged' = ha gia' interagito.
export const SEG_MAP = { prospecting: 'new', existing: 'returning', engaged: 'engaged', unknown: 'unknown' }

export async function fetchAdSegmentInsights({ accessToken, adAccountId, since, until }) {
  const rows = await graphAll(`${adAccountId}/insights`, {
    level: 'ad',
    breakdowns: 'user_segment_key',
    time_increment: 1,
    time_range: JSON.stringify({ since, until }),
    limit: '500',
    fields: 'date_start,ad_id,spend,impressions,inline_link_clicks,actions,action_values',
  }, accessToken)

  return rows.map(r => {
    const spend = Number(r.spend) || 0
    const purchaseValue = A(r.action_values, PURCHASE)
    return {
      day: r.date_start,
      ad_id: r.ad_id,
      segment: SEG_MAP[r.user_segment_key] || 'unknown',
      spend,
      impressions: Number(r.impressions) || 0,
      link_clicks: Number(r.inline_link_clicks) || 0,
      purchases: A(r.actions, PURCHASE),
      purchase_value: purchaseValue,
      roas: spend > 0 ? purchaseValue / spend : 0,
    }
  })
}

// Estrae copy, headline, descrizione, CTA e link dal creative Meta.
// Due formati diversi: object_story_spec (inserzioni classiche, valore singolo)
// e asset_feed_spec (Advantage+/dinamiche, liste di varianti — si prende la prima).
export function extractCopy(creative) {
  const vuoto = { body:'', headline:'', description:'', cta:'', link_url:'', media_type:null, video_id:null }
  if (!creative) return vuoto
  const oss = creative.object_story_spec || {}
  const afs = creative.asset_feed_spec || {}
  const link = oss.link_data || {}
  const video = oss.video_data || {}
  const tmpl = oss.template_data || {}   // cataloghi / DPA: qui vive il copy dei dinamici
  // Le voci di asset_feed_spec sono oggetti con chiavi DIVERSE a seconda del
  // campo: bodies/titles/descriptions usano `text`, ma link_urls usa
  // `website_url`. Cercare solo text/value/url faceva tornare vuoti TUTTI i
  // link delle Advantage+ — cioè la maggioranza dell'account.
  const first = (a) => {
    if (!Array.isArray(a) || !a.length) return ''
    const v = a[0]
    if (typeof v !== 'object' || v === null) return v
    return v.website_url || v.text || v.value || v.url || v.link || v.deeplink_url || ''
  }
  // null invece di stringa vuota: '' passa i filtri "is not null" e produce
  // conteggi falsi (104 link "analizzati" che non esistevano).
  const pick = (...v) => v.find(x => x != null && x !== '') || null

  const ctaRaw = pick(link.call_to_action?.type, video.call_to_action?.type,
                      tmpl.call_to_action?.type, first(afs.call_to_action_types))
  return {
    body: pick(link.message, video.message, tmpl.message, first(afs.bodies)),
    headline: pick(link.name, link.title, video.title, tmpl.name, tmpl.title, first(afs.titles)),
    description: pick(link.description, video.link_description, tmpl.description, first(afs.descriptions)),
    cta: typeof ctaRaw === 'string' ? ctaRaw.replace(/_/g, ' ') : '',
    link_url: pick(link.link, link.call_to_action?.value?.link, video.call_to_action?.value?.link,
                   tmpl.link, first(afs.link_urls)),
    // video_id sta al PRIMO livello del creative, non dentro object_story_spec:
    // molte inserzioni video hanno oss vuoto e solo asset_feed_spec.bodies.
    media_type: (creative.video_id || video.video_id) ? 'video'
      : (oss.template_data ? 'catalog' : 'image'),
    video_id: creative.video_id || video.video_id || null,
  }
}
