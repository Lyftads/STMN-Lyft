// ── Manifest dei video-guida per tab ───────────────────────────────────────
// Mappa articolo (id della guida) → asset video generati dalla pipeline
// (scripts/help-video/). Finché un id non è presente qui, la guida non mostra
// il player: nessun video "rotto", la guida resta solo testuale.
//
// Lo script di upload (scripts/help-video/generate.mjs) riscrive questo file
// aggiungendo le voci man mano che i video vengono prodotti e caricati.
//
// Shape: { src: 'mp4 url', captions: 'vtt url (EN)', poster: 'jpg url', duration: '1:12' }

export const HELP_VIDEOS = {
  // dashboard: { src: '…/dashboard.mp4', captions: '…/dashboard.en.vtt', poster: '…/dashboard.jpg', duration: '1:10' },
}

export function getHelpVideo(id) {
  return HELP_VIDEOS[id] || null
}
