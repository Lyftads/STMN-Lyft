// ============================================================================
//  LA VOCE — parlare e ascoltare con cio' che il browser ha gia' (nessuna chiave, nessun
//  costo, niente audio che esce dal dispositivo per la sintesi).
//   · parla(testo, lingua): legge ad alta voce; sceglie la voce migliore per quella lingua.
//   · ascolta(...): detta una domanda (dove il browser lo consente: Chrome, Edge, Safari).
//  Dove una delle due non esiste le funzioni `puo*` dicono di no e il pulsante non si mostra.
// ============================================================================
const LINGUE = { it: 'it-IT', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' }
export const linguaVoce = (loc) => LINGUE[String(loc || 'it').slice(0, 2)] || 'it-IT'
export const puoParlare = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'
export const puoAscoltare = () => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

function voceMigliore(lingua) {
  const voci = window.speechSynthesis.getVoices().filter(v => v.lang?.replace('_', '-').startsWith(lingua.slice(0, 2)))
  // le voci "naturali"/premium del sistema suonano molto meglio di quelle compatte
  const voto = (v) => (/(natural|premium|enhanced|neural|siri)/i.test(v.name) ? 4 : 0) + (v.lang === lingua ? 2 : 0) + (v.localService ? 1 : 0)
  return voci.sort((a, b) => voto(b) - voto(a))[0] || null
}

export function zitto() { if (puoParlare()) window.speechSynthesis.cancel() }

export function parla(testo, lingua = 'it-IT', { onFine } = {}) {
  if (!puoParlare() || !testo) return false
  zitto()
  // frasi separate: i motori di sintesi si fermano sui testi lunghi, e cosi' le pause sono naturali
  const frasi = String(testo).split(/(?<=[.!?])\s+/).filter(Boolean)
  frasi.forEach((f, k) => {
    const u = new window.SpeechSynthesisUtterance(f)
    const v = voceMigliore(lingua); if (v) u.voice = v
    u.lang = lingua; u.rate = 1.02; u.pitch = 1
    if (k === frasi.length - 1) { u.onend = () => onFine?.(); u.onerror = () => onFine?.() }
    window.speechSynthesis.speak(u)
  })
  return true
}

export function ascolta({ lingua = 'it-IT', onTesto, onFine, onErrore }) {
  const R = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  if (!R) return null
  const r = new R()
  r.lang = lingua; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1
  r.onresult = (e) => { let t = ''; for (const ris of e.results) t += ris[0].transcript; onTesto?.(t, e.results[e.results.length - 1].isFinal) }
  r.onerror = (e) => onErrore?.(e.error)
  r.onend = () => onFine?.()
  try { r.start() } catch { return null }
  return r
}

// I numeri letti bene: "€ 32.620" → "32620 euro"; "2,30x" → "2,30".
export const euroDetti = (n) => (n == null ? '' : `${Math.round(n)} euro`)
