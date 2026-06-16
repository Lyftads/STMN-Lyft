// ── Manifest dei video-guida per tab ───────────────────────────────────────
// Mappa articolo (id della guida) → asset video generati dalla pipeline
// (scripts/help-video/). Finché un id non è presente qui, la guida non mostra
// il player: nessun video "rotto", la guida resta solo testuale.
//
// Rigenerabile dalla pipeline: il job stampa nei log il blocco da incollare qui.
//
// Shape: { src: 'mp4 url', captions: 'vtt url (EN)', poster: 'jpg url', duration: '1:12' }

const B = 'https://zdntcuaupohdapunszoi.supabase.co/storage/v1/object/public/help-videos'

export const HELP_VIDEOS = {
  dashboard: { src: `${B}/dashboard.mp4`, captions: `${B}/dashboard.en.vtt`, poster: `${B}/dashboard.jpg`, duration: '0:42' },
  clienti: { src: `${B}/clienti.mp4`, captions: `${B}/clienti.en.vtt`, poster: `${B}/clienti.jpg`, duration: '0:43' },
  metaKpi: { src: `${B}/metaKpi.mp4`, captions: `${B}/metaKpi.en.vtt`, poster: `${B}/metaKpi.jpg`, duration: '0:38' },
}

export function getHelpVideo(id) {
  return HELP_VIDEOS[id] || null
}
