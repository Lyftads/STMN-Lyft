// ============================================================================
//  TRAIETTORIA DEL MESE — dove si arriva a fine mese se non si tocca niente.
//
//  Matematica pura (nessuna chiamata), cosi' si collauda con numeri finti.
//  Metodo, volutamente semplice e spiegabile:
//   · ogni giorno che manca vale la MEDIA DEL SUO GIORNO DELLA SETTIMANA nelle ultime
//     8 settimane (un sabato si confronta coi sabati);
//   · corretta per la tendenza: ultimi 28 giorni contro i 28 prima, smorzata a meta' e
//     chiusa fra 0,8 e 1,25 — una settimana storta non deve piegare il mese;
//   · la fascia e' l'80%: gli scarti di ogni giorno della settimana dalla sua media,
//     sommati in varianza sui giorni che mancano (±1,28 σ);
//   · OGGI e' parziale: vale il maggiore fra l'incassato finora e la media del suo giorno.
//  Niente regressione sul calendario: con 3 mesi di dati una retta promette crescite o
//  crolli che non esistono.
// ============================================================================
import { piuGiorni, giorniFra, inizioMese } from '../periodi.js'

const giornoSettimana = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay()
const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const r0 = (n) => Math.round(n)

export function fineMese(iso) {
  const [a, m] = iso.split('-').map(Number)
  return `${iso.slice(0, 7)}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`
}

// giorni: [{ data:'AAAA-MM-GG', valore }] · oggi: 'AAAA-MM-GG' (il giorno in corso, parziale)
export function profiloSettimanale(giorni, oggi, settimane = 8) {
  const chiusi = giorni.filter(g => g.data < oggi && g.data >= piuGiorni(oggi, -7 * settimane))
  const perGiorno = Array.from({ length: 7 }, () => [])
  for (const g of chiusi) perGiorno[giornoSettimana(g.data)].push(Number(g.valore) || 0)
  const tutte = media(chiusi.map(g => Number(g.valore) || 0))
  const medie = perGiorno.map(a => (a.length >= 2 ? media(a) : tutte))
  const varianze = perGiorno.map((a, k) => (a.length >= 2 ? media(a.map(x => (x - medie[k]) ** 2)) : 0))
  const somma = (da, a) => chiusi.filter(g => g.data >= da && g.data <= a).reduce((s, g) => s + (Number(g.valore) || 0), 0)
  const ultimi = somma(piuGiorni(oggi, -28), piuGiorni(oggi, -1)), prima = somma(piuGiorni(oggi, -56), piuGiorni(oggi, -29))
  const grezza = prima > 0 ? ultimi / prima : 1
  const tendenza = Math.min(1.25, Math.max(0.8, 1 + (grezza - 1) / 2))
  return { medie, varianze, tendenza, tendenzaGrezza: grezza, giorniUsati: chiusi.length }
}

export function traiettoria({ fatturato, spesa = [], oggi }) {
  const inizio = inizioMese(oggi), fine = fineMese(oggi)
  const p = profiloSettimanale(fatturato, oggi)
  const delMese = new Map(fatturato.filter(g => g.data >= inizio && g.data <= oggi).map(g => [g.data, Number(g.valore) || 0]))
  const punti = []
  let cumulo = 0, varianza = 0
  for (let d = inizio; d <= fine; d = piuGiorni(d, 1)) {
    const k = giornoSettimana(d), atteso = p.medie[k] * p.tendenza
    if (d < oggi) { cumulo += delMese.get(d) || 0; punti.push({ data: d, vero: r0(cumulo) }) }
    else if (d === oggi) {
      const finora = delMese.get(d) || 0
      punti.push({ data: d, vero: r0(cumulo + finora), previsto: r0(cumulo + Math.max(finora, atteso)), basso: r0(cumulo + finora), alto: r0(cumulo + Math.max(finora, atteso)) })
      cumulo += Math.max(finora, atteso)
    } else {
      cumulo += atteso; varianza += p.varianze[k] * p.tendenza ** 2
      const banda = 1.28 * Math.sqrt(varianza)
      punti.push({ data: d, previsto: r0(cumulo), basso: r0(Math.max(0, cumulo - banda)), alto: r0(cumulo + banda) })
    }
  }
  const ultimo = punti[punti.length - 1]
  const finora = punti.filter(x => x.vero != null).pop()?.vero || 0
  // spesa: quella vera del mese + la media degli ultimi 14 giorni chiusi per i giorni che mancano
  const spesaMese = spesa.filter(g => g.data >= inizio && g.data <= oggi).reduce((s, g) => s + (Number(g.valore) || 0), 0)
  const recenti = spesa.filter(g => g.data < oggi && g.data >= piuGiorni(oggi, -14)).map(g => Number(g.valore) || 0)
  const spesaGiorno = media(recenti), mancano = giorniFra(oggi, fine)
  const spesaRestante = spesaGiorno * mancano
  const spesaPrevista = spesaMese + spesaRestante
  const previsto = ultimo.previsto ?? ultimo.vero
  return {
    inizio, fine, oggi, giorniMancanti: mancano, punti,
    finora, previsto, basso: ultimo.basso ?? previsto, alto: ultimo.alto ?? previsto,
    spesaFinora: r0(spesaMese), spesaPrevista: r0(spesaPrevista), spesaRestante: r0(spesaRestante),
    merPrevisto: spesaPrevista > 0 ? +(previsto / spesaPrevista).toFixed(2) : null,
    tendenza: +p.tendenza.toFixed(3), giorniUsati: p.giorniUsati,
  }
}

// Quanto rende UN EURO IN PIU' di pubblicita': la pendenza fra spesa e fatturato settimanali
// (ultime 12 settimane chiuse). E' una stima grezza, quindi si tiene fra il 30% e il 100% del
// MER medio: mai una resa marginale migliore della media (i rendimenti calano), mai zero.
export function resaMarginale(fatturato, spesa, oggi) {
  const sett = []
  for (let k = 1; k <= 12; k++) {
    const a = piuGiorni(oggi, -7 * k), b = piuGiorni(oggi, -7 * k + 6)
    const tra = (s) => s.filter(g => g.data >= a && g.data <= b && g.data < oggi).reduce((t, g) => t + (Number(g.valore) || 0), 0)
    const f = tra(fatturato), s = tra(spesa)
    if (s > 0) sett.push({ f, s })
  }
  const totF = sett.reduce((t, x) => t + x.f, 0), totS = sett.reduce((t, x) => t + x.s, 0)
  const mer = totS > 0 ? totF / totS : null
  if (!mer || sett.length < 6) return { valore: mer ? +(mer * 0.5).toFixed(2) : null, mer: mer ? +mer.toFixed(2) : null, metodo: 'meta-del-mer', settimane: sett.length }
  const ms = totS / sett.length, mf = totF / sett.length
  const num = sett.reduce((t, x) => t + (x.s - ms) * (x.f - mf), 0), den = sett.reduce((t, x) => t + (x.s - ms) ** 2, 0)
  const pendenza = den > 0 ? num / den : mer * 0.5
  const valore = Math.min(mer, Math.max(mer * 0.3, pendenza))
  return { valore: +valore.toFixed(2), mer: +mer.toFixed(2), pendenza: +pendenza.toFixed(2), metodo: 'pendenza-settimanale', settimane: sett.length }
}
