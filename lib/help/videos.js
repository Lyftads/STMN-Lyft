// ── Manifest dei video-guida per tab ───────────────────────────────────────
// Mappa articolo (id della guida) → asset video generati dalla pipeline
// (scripts/help-video/). Finché un id non è presente qui, la guida non mostra
// il player: nessun video "rotto", la guida resta solo testuale.
//
// Rigenerabile dalla pipeline: il job stampa nei log il blocco da incollare qui.
// `?v=N` = cache-bust quando si rigenera un video allo stesso URL.
//
// Shape: { src: 'mp4 url', captions: 'vtt url (EN)', poster: 'jpg url', duration: '1:12' }

const B = 'https://zdntcuaupohdapunszoi.supabase.co/storage/v1/object/public/help-videos'
const V = 'v=2' // bump quando rigeneri i video (per bustare la cache CDN/browser)

export const HELP_VIDEOS = {
  dashboard: { src: `${B}/dashboard.mp4?${V}`, captions: `${B}/dashboard.en.vtt?${V}`, poster: `${B}/dashboard.jpg?${V}`, duration: '0:34' },
  clienti: { src: `${B}/clienti.mp4?${V}`, captions: `${B}/clienti.en.vtt?${V}`, poster: `${B}/clienti.jpg?${V}`, duration: '0:19' },
  metaKpi: { src: `${B}/metaKpi.mp4?${V}`, captions: `${B}/metaKpi.en.vtt?${V}`, poster: `${B}/metaKpi.jpg?${V}`, duration: '1:00' },
}

export function getHelpVideo(id) {
  return HELP_VIDEOS[id] || null
}
