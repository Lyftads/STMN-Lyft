// ============================================================================
//  L'interruttore delle sezioni «Studio» (Lyft, Motore Creativo, Squadra agent).
//
//  Dentro LyftAI queste sezioni non si accendono per tutti insieme: si accendono
//  PER AZIENDA. Finche' un workspace non e' nell'elenco non vede le voci di menu,
//  e le loro rotte gli rispondono 403 — le due cose insieme, perche' una voce
//  nascosta non protegge niente da chi conosce l'indirizzo.
//
//  LYFT_STUDIO_WORKSPACES = id dei workspace separati da virgola, oppure * per tutti.
//  Senza la variabile: spento per tutti. LyftAI resta esattamente com'era.
// ============================================================================
export function studioAttivo(ws) {
  const v = String(process.env.LYFT_STUDIO_WORKSPACES || '').trim()
  if (!v || !ws) return false
  if (v === '*') return true
  return v.split(',').map(x => x.trim()).filter(Boolean).includes(ws)
}
export const STUDIO_SPENTO = 'questa sezione non è attiva per questa azienda'
