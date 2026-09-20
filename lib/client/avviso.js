// ============================================================================
//  Un avviso solo, uguale ovunque: discreto, in basso, sparisce da se'.
//  Sostituisce i 24 alert() del browser (una finestra grigia di sistema che
//  blocca tutto per dire "Salvato") e i messaggi scritti a mano nelle tab.
//
//    avvisa('Salvato')                       // neutro
//    avvisa('Caricamento non riuscito', 'errore')
//    avvisa('Copiato', 'ok')
//
//  Chi li disegna e' ui/Avvisi.jsx, montato una volta nella cornice.
// ============================================================================
export function avvisa(testo, tipo = 'neutro', { durataMs } = {}) {
  if (typeof window === 'undefined' || !testo) return
  window.dispatchEvent(new CustomEvent('lyft:avviso', { detail: { testo: String(testo), tipo, durataMs: durataMs || (tipo === 'errore' ? 6000 : 3200) } }))
}
