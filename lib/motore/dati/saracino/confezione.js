// Come sono fatte DAVVERO le confezioni di Saracino 1925 (bag in box, scatolone giallo, dosatore).
// Sono regole di UN cliente: stanno coi suoi dati, non nel motore che serve tutti.
import RIFERIMENTI from './riferimenti.json'

const PACCO = /\b(pacc[oh]i?|scatol[ae] di spedizione|corriere|unboxing|consegn\w+|spedizion\w+|cartone di spedizione)\b/i
export const mostraUnPacco = (testo) => PACCO.test(String(testo || ''))

export function regoleConfezione({ prodotto, scena }) {
  const out = []
  if (/bag/i.test(`${prodotto?.name || ''} ${prodotto?.nome_breve || ''}`)) {
    out.push(
      `VISTA DELLA BAG IN BOX — la confezione si mostra di tre quarti e INTERA: il fronte, quasi`,
      `quadrato, ben leggibile, e accanto il lato stretto. Mai vista solo dal lato stretto, dove`,
      `sembra un cartone alto qualunque. MISURE VERE: 22 cm di larghezza, 26 cm di altezza, 10 cm di`,
      `profondita' (misurate dal cliente il 7 nov 2026), rubinetto sul lato stretto con TAPPO NERO (mai rosso): poco piu' bassa di una bottiglia di vino,`,
      `alta il doppio di un barattolo da conserve. STAMPA VERA (replicare la foto, non ridisegnare):`,
      `fondo crema, logo SARACINO 1925 VERDE OLIVA SCURO (mai rosso: il rosso e' solo sullo scatolone`,
      `giallo), «Angelino» in corsivo verde oliva, rosoni a puntini verde chiaro/giallo/oro.`,
      `Nell'unboxing la bag e' coricata nello scatolone e si vede SOLO il fronte, senza il lato`,
      `col rubinetto. Se si versa dal rubinetto, la scatola sta sul bordo del piano con il rubinetto`,
      `che sporge e sotto c'e' il DOSATORE SARACINO vero della foto di riferimento: bottiglia di`,
      `vetro trasparente, testa nera con beccuccio a leva, manico nero, logo bianco, alto ~18 cm (piu'`,
      `basso e stretto della bag); quando lo si riempie il tappo nero e' TOLTO e sta accanto, l'olio`,
      `entra dal collo aperto. Mai oliere di ceramica o bottiglie generiche.`)
  }
  if (mostraUnPacco(scena)) {
    out.push(
      `PACCO DI SPEDIZIONE — e' quello delle foto di riferimento aggiunte: cartone ondulato GIALLO`,
      `limone, logo SARACINO 1925 rosso, grandi rosoni bianchi con trattini rossi. Mai un cartone`,
      `marrone anonimo, mai loghi di corrieri. MISURE VERE: 30 cm di lunghezza, 22 di larghezza,`,
      `20 di altezza (misurate dal cliente il 7 nov 2026): le due bag ci stanno coricate una sopra`,
      `l'altra, quindi lo scatolone e' solo un po' piu' lungo di una bag, mai il doppio.`)
  }
  return out.length ? `\n${out.join('\n')}\n` : ''
}
const RUBINETTO = /rubinett|vers(a|are|ato)|dosator|oliera|spillare/i
export function riferimentiPacco(scena) {
  const out = []
  if (mostraUnPacco(scena)) out.push(RIFERIMENTI['scatola-gialla-aperta'], RIFERIMENTI['scatola-gialla-in-mano'])
  if (RUBINETTO.test(String(scena || ''))) out.push(RIFERIMENTI['dosatore-saracino'])
  return out.filter(Boolean)
}
