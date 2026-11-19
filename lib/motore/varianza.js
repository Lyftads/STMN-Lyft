// ============================================================================
//  Varianza — il motore che impedisce alle creatività di somigliarsi.
//
//  Ripetere lo stesso template cambiando la headline non produce N creatività:
//  ne produce UNA con N didascalie, e il riconoscimento visivo di Meta la legge
//  così. La diversità dev'essere reale su più assi insieme: scena, palette,
//  soggetto, luce, inquadratura.
//
//  Ma varianza NON vuol dire caso: le palette sono un insieme APPROVATO,
//  ognuna coerente al suo interno. Colori a sorte romperebbero il brand.
// ============================================================================

// Palette: ognuna è una combinazione già armonica di scrim, headline e CTA.
// Il verde non è più l'unica: resta la prima, non la sola.
export const PALETTE = [
  { id: 'verde-notte',  scrim: '#0b140e', headline: '#ffffff', ctaBg: '#c0a062', ctaTesto: '#1f3a26', bollini: '#f3ead2' },
  { id: 'oro-su-scuro', scrim: '#0b140e', headline: '#ecd08a', ctaBg: '#f3ead2', ctaTesto: '#1f3a26', bollini: '#e8dcc0' },
  { id: 'bruno-caldo',  scrim: '#1a1008', headline: '#ffffff', ctaBg: '#d9a441', ctaTesto: '#2a1a08', bollini: '#f0e2c8' },
  { id: 'blu-sera',     scrim: '#0a1018', headline: '#ffffff', ctaBg: '#c9bfa8', ctaTesto: '#0a1018', bollini: '#e6ecf2' },
  { id: 'terra',        scrim: '#170f0c', headline: '#f6e7cf', ctaBg: '#b8794a', ctaTesto: '#ffffff', bollini: '#e9d9c4' },
  { id: 'avorio-chiaro',scrim: '#efe6d6', headline: '#23301f', ctaBg: '#1f3a26', ctaTesto: '#f3ead2', bollini: '#3d4a38', chiaro: true },
  { id: 'grigio-pietra',scrim: '#141516', headline: '#ffffff', ctaBg: '#e3d9c6', ctaTesto: '#141516', bollini: '#d8d4cc' },
  { id: 'verde-oliva',  scrim: '#101a10', headline: '#eef3e6', ctaBg: '#8fa86a', ctaTesto: '#101a10', bollini: '#dfe8d2' },
]

// Soggetti: età e genere espliciti. Senza, ogni scena finisce per avere la
// stessa persona — ed è uno degli assi di diversità più forti perché cambia
// a chi il pubblico sente che l'annuncio stia parlando.
export const SOGGETTI = [
  { id: 'nessuno',        desc: 'nessuna persona, solo il prodotto e il contesto' },
  { id: 'donna-30',       desc: 'una donna sui 30 anni, mani e busto, gesto naturale' },
  { id: 'uomo-40',        desc: 'un uomo sui 40 anni, mani in primo piano mentre cucina' },
  { id: 'donna-60',       desc: 'una signora sui 60 anni, mani segnate dal lavoro, gesto sicuro' },
  { id: 'uomo-55',        desc: 'un uomo sui 55 anni, il produttore, gesto sicuro e sguardo diretto' },
  { id: 'coppia-35',      desc: 'una coppia sui 35 anni che apparecchia insieme' },
  { id: 'famiglia',       desc: 'una famiglia a tavola, adulti e bambini, scena non posata' },
  { id: 'mani-anonime',   desc: 'solo mani, senza volto, in azione sul prodotto' },
]

export const AMBIENTI = [
  { id: 'cucina-rustica',   desc: 'cucina di casa rustica, legno vissuto, piastrelle vecchie' },
  { id: 'cucina-moderna',   desc: 'cucina moderna e minimale, piano in pietra chiara' },
  { id: 'tavola-pranzo',    desc: 'tavola apparecchiata a pranzo, piatti pieni, convivialità' },
  { id: 'dispensa',         desc: 'dispensa domestica, scaffali con conserve e pasta' },
  { id: 'terrazza',         desc: 'terrazza esterna, tavolo con tovaglia di lino' },
  { id: 'uliveto',          desc: 'uliveto, luce naturale, terra e alberi' },
  { id: 'frantoio',         desc: 'frantoio di famiglia, acciaio e ambiente di lavoro' },
  { id: 'banco-mercato',    desc: 'banco di mercato con prodotti freschi intorno' },
  { id: 'cucina-professionale', desc: 'cucina professionale, acciaio, gesto tecnico' },
]

// Lo stile della casa. Regola del cliente del 6 novembre 2026, dopo una tornata
// uscita tutta in cucine rustiche del Sud: ambienti sempre diversi. "Cucina",
// "dispensa" e "tavola" dicono DOVE; questo dice COM'E' fatta la casa, ed e'
// cio' che cambia di piu' chi si riconosce nell'immagine — un loft e una
// masseria non parlano alla stessa persona.
export const STILI_CASA = [
  { id: 'rustica',      desc: 'casa rustica di campagna, legno vissuto, pietra, oggetti di una volta' },
  { id: 'moderna',      desc: 'casa moderna, linee pulite, superfici opache, elettrodomestici a incasso' },
  { id: 'minimale',     desc: 'casa minimale e molto chiara, pochi oggetti, tanto spazio vuoto, bianco e legno chiaro' },
  { id: 'mediterranea', desc: 'casa mediterranea, muri a calce bianchi, maioliche bianche e blu, luce di mare' },
  { id: 'chiara',       desc: 'appartamento luminoso di citta, pareti chiare, parquet, piante, tessuti di lino' },
  { id: 'scura',        desc: 'casa elegante dai toni scuri, pareti verde bosco o antracite, legno noce, luci calde' },
  { id: 'industrial',   desc: 'loft industriale, mattoni a vista, ferro nero, grandi finestre da fabbrica, legno grezzo' },
]

export const LUCI = [
  { id: 'mattino',   desc: 'luce del mattino da una finestra laterale, morbida' },
  { id: 'tramonto',  desc: 'luce calda di tramonto, ombre lunghe' },
  { id: 'mezzogiorno', desc: 'luce piena di mezzogiorno, contrasto netto' },
  { id: 'sera-interno', desc: 'luce artificiale serale, calda e raccolta' },
  { id: 'nuvoloso',  desc: 'luce diffusa di giornata nuvolosa, senza ombre dure' },
]

export const INQUADRATURE = [
  { id: 'frontale',    desc: 'inquadratura frontale, prodotto al centro' },
  { id: 'tre-quarti',  desc: 'tre quarti, leggermente dall alto' },
  { id: 'dettaglio',   desc: 'dettaglio ravvicinato, poca profondità di campo' },
  { id: 'ambientata',  desc: 'campo largo che mostra tutto l ambiente' },
  { id: 'dall-alto',   desc: 'ripresa dall alto, piano del tavolo' },
]

// Sceglie N combinazioni il più DIVERSE possibile fra loro. Non a caso: si
// scorrono gli assi sfasati, così due creatività dello stesso lotto non
// condividono mai più di un asse.
// `pesi` arriva da lib/apprendimento: dice quanto vale ogni ingrediente in
// base ai giudizi di qualità ricevuti. Non si ESCLUDE mai niente — scartare
// ciò che non si è ancora misurato è il modo di non misurarlo mai — ma le
// combinazioni fatte di ingredienti bocciati vengono scartate più spesso.
export function combinazioni(n, semePrecedenti = [], pesi = null) {
  const usate = new Set(semePrecedenti)
  const out = []
  const assi = [AMBIENTI, SOGGETTI, LUCI, INQUADRATURE, PALETTE]
  const peso = (asse, id) => (pesi?.[asse]?.[id] ?? 1)
  let i = 0, giri = 0
  while (out.length < n && giri < n * 40) {
    giri++
    const c = {
      ambiente: assi[0][(i * 3 + 0) % assi[0].length],
      soggetto: assi[1][(i * 5 + 1) % assi[1].length],
      luce:     assi[2][(i * 2 + 2) % assi[2].length],
      quadro:   assi[3][(i * 4 + 3) % assi[3].length],
      palette:  assi[4][(i * 3 + 5) % assi[4].length],
      // Sette stili contro nove ambienti e cinque luci: i passi sono primi fra
      // loro, quindi in un lotto da sette nessuno stile si ripete.
      stile:    STILI_CASA[(i * 3 + 2) % STILI_CASA.length],
    }
    i++
    const firma = [c.ambiente.id, c.soggetto.id, c.luce.id, c.quadro.id, c.palette.id].join('|')
    if (usate.has(firma)) continue
    // Il punteggio della combinazione è il prodotto dei pesi dei suoi
    // ingredienti. Sotto la soglia si salta — ma solo finché ci sono ancora
    // giri disponibili, così una tornata non resta mai vuota per colpa dei
    // pesi: meglio una combinazione mediocre che nessuna creatività.
    const q = peso('ambiente', c.ambiente.id) * peso('soggetto', c.soggetto.id)
            * peso('luce', c.luce.id) * peso('quadro', c.quadro.id) * peso('palette', c.palette.id)
    if (pesi && q < 0.55 && giri < n * 25) continue
    usate.add(firma)
    out.push({ ...c, firma, pesoCombinazione: +q.toFixed(3) })
  }
  return out
}
