// ============================================================================
//  I SOLDI si scrivono in un modo solo, in tutto il prodotto.
//
//  C'erano trentatre' formattatori sparsi, e la stessa cifra usciva `685 €` in
//  una tab e `€685` in un'altra, `€1082` accanto a `€32.076` (l'italiano non
//  mette il punto sotto le diecimila), `€1380,1` con un decimale solo, `€-12`.
//
//    soldi(1082)          → €1.082          (mai decimali, se non li chiedi)
//    soldi(47.06, 2)      → €47,06          (sempre due)
//    soldi(1380.1, 'auto')→ €1.380          (intero o sopra mille: niente decimali;
//    soldi(0.27, 'auto')  → €0,27            sotto mille con centesimi: due)
//    soldi(-12)           → −€12
//    soldi(null)          → —
//
//  Il simbolo sta davanti, il punto delle migliaia c'e' sempre, il meno e' un
//  vero segno meno. Una valuta diversa dall'euro passa da Intl col suo simbolo.
// ============================================================================

import { localeNumeri } from './numeri'

export function soldi(v, decimali = 0, { vuoto = '—', valuta = 'EUR', zeroVuoto = false } = {}) {
  if (v == null || v === '' || !Number.isFinite(Number(v))) return vuoto
  const n = Number(v)
  if (zeroVuoto && !(n > 0)) return vuoto
  let d = decimali
  if (d === 'auto') d = (Number.isInteger(Math.round(n * 100) / 100) || Math.abs(n) >= 1000) ? 0 : 2
  const cifra = Math.abs(n).toLocaleString(localeNumeri(), { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' })
  // Arrotondato a zero non e' negativo: "−€0" non esiste.
  const negativo = n < 0 && Number(Math.abs(n).toFixed(d)) !== 0
  if (valuta && valuta !== 'EUR') {
    const simbolo = new Intl.NumberFormat('it-IT', { style: 'currency', currency: valuta, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).formatToParts(0).find(p => p.type === 'currency')?.value || valuta
    return `${negativo ? '−' : ''}${simbolo}${cifra}`
  }
  return `${negativo ? '−' : ''}€${cifra}`
}
