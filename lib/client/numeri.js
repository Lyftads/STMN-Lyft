// ============================================================================
//  I NUMERI si scrivono in un modo solo, in tutto il prodotto. Gemello di
//  `soldi.js`, che fa la stessa cosa per le cifre in euro.
//
//  Misurato sul prodotto vivo (.audit-numeri.mjs, 15 tab): 411 numeri su 819
//  erano scritti ALL'INGLESE — `95.6%`, `-50.67`, `0.27` — perche' venivano da
//  `toFixed()`, che mette sempre il punto. Accanto, nella stessa schermata,
//  altri 408 all'italiana con la virgola. In italiano `-50.67` si legge come un
//  numero diverso: il punto e' il separatore delle migliaia.
//
//    perc(95.6)        → 95,6%
//    perc(2.9, 1)      → 2,9%
//    perc(-7.24, 1)    → −7,2%        (meno vero, non trattino)
//    perc(0.4, 1, {segno:true}) → +0,4%
//    perc(null)        → —
//
//    num(0.27, 2)      → 0,27
//    num(11.6, 1)      → 11,6
//    num(3570)         → 3.570
//    num(1234.5)       → 1.235        (sopra cento i decimali non dicono nulla)
//    num(1595982)      → 1.595.982
//    num(null)         → —
//
//  Il punto separa le migliaia, la virgola i decimali, il meno e' "−" (U+2212)
//  e non il trattino: nei numeri incolonnati il trattino e' troppo corto.
// ============================================================================

const VUOTO = '—'

// quanti decimali servono, se non li chiedi: nessuno per gli interi, uno o due
// per il resto, senza mai scrivere zeri che non dicono niente (2,50 → 2,5)
function quanti(n, chiesti) {
  if (chiesti != null && chiesti !== 'auto') return chiesti
  if (Number.isInteger(n)) return 0
  return Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2
}

function scrivi(n, d) {
  return Math.abs(n).toLocaleString('it-IT', {
    minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always',
  })
}

// il segno si decide DOPO l'arrotondamento: -0,04 con un decimale e' 0,0, e
// "−0,0%" non vuol dire niente
function negativo(n, d) {
  return n < 0 && Number(Math.abs(n).toFixed(d)) !== 0
}

export function num(v, decimali = 'auto', { vuoto = VUOTO, segno = false } = {}) {
  if (v == null || v === '' || !Number.isFinite(Number(v))) return vuoto
  const n = Number(v)
  const d = quanti(n, decimali)
  const meno = negativo(n, d)
  const piu = segno && !meno && Number(Math.abs(n).toFixed(d)) !== 0
  return `${meno ? '−' : piu ? '+' : ''}${scrivi(n, d)}`
}

export function perc(v, decimali = 'auto', { vuoto = VUOTO, segno = false } = {}) {
  if (v == null || v === '' || !Number.isFinite(Number(v))) return vuoto
  return `${num(v, decimali, { vuoto, segno })}%`
}

// un numero che moltiplica: MER, ROAS, LTV:CAC. Sempre due decimali, come le
// altre "volte" gia' scritte in giro (1,16×).
export function volte(v, { vuoto = VUOTO } = {}) {
  if (v == null || v === '' || !Number.isFinite(Number(v))) return vuoto
  return `${num(Number(v), 2, { vuoto })}×`
}
