// ============================================================================
//  LE PROPOSTE — nascono dai dati che il software ha gia' giudicato, mai da un'opinione.
//
//  Fonte 1, i verdetti dei prodotti su Google (google-product-verdicts): li' ogni riga e' una
//  sottrazione che si rifa' a mano e ha gia' passato le sue regole. Qui si raccolgono in DUE
//  mosse, perche' 200 mosse da un prodotto l'una non le approva nessuno:
//    · FERMA i prodotti in perdita  → effetto = la perdita che smette (euro al mese);
//    · SPINGI i prodotti che rendono → effetto prudente: +20% di spesa alla resa di oggi.
// ============================================================================
const r0 = (n) => Math.round(Number(n) || 0)
const MASSIMO_IN_ELENCO = 40
export const SPINTA = 0.2   // di quanto si propone di alzare la spesa sui prodotti che rendono

export function proposteDaGoogle(gpv) {
  const righe = Array.isArray(gpv?.righe) ? gpv.righe : []
  if (!righe.length || !gpv?.range?.since) return []
  const giorni = Math.max(1, Math.round((Date.parse(gpv.range.until) - Date.parse(gpv.range.since)) / 86_400_000) + 1)
  const alMese = 30 / giorni
  const voce = (r, euro) => ({ productId: r.productId || null, itemIds: r.itemIds || [r.itemId], titolo: r.title, immagine: r.image || null, spesa: r0(r.cost), margine: r.margineNetto != null ? r0(r.margineNetto) : null, poas: r.poas ?? null, motivo: r.motivo || null, euroMese: r0(euro * alMese) })
  const out = []

  // perdita di una riga = quanto ci si rimette tenendola accesa: il margine netto se e' negativo,
  // altrimenti (nessuna vendita, margine non calcolabile) la spesa stessa.
  const daFermare = righe.filter(r => r.verdetto === 'uccidi').map(r => voce(r, r.margineNetto != null && r.margineNetto < 0 ? -r.margineNetto : r.cost)).filter(v => v.euroMese > 0).sort((a, b) => b.euroMese - a.euroMese)
  if (daFermare.length) {
    const elenco = daFermare.slice(0, MASSIMO_IN_ELENCO)
    out.push({
      chiave: 'google-prodotti:ferma', tipo: 'ferma-prodotti-google', canale: 'google', esecuzione: 'a-mano',
      prodotti: elenco, quanti: elenco.length, quantiInTutto: daFermare.length,
      previsto: { euroMese: elenco.reduce((s, v) => s + v.euroMese, 0), metrica: 'perdita-evitata', periodo: gpv.range },
      base: { spesa: elenco.reduce((s, v) => s + v.spesa, 0), giorni },
    })
  }
  const daSpingere = righe.filter(r => r.verdetto === 'scala' && r.margineNetto > 0).map(r => voce(r, r.margineNetto * SPINTA)).filter(v => v.euroMese > 0).sort((a, b) => b.euroMese - a.euroMese)
  if (daSpingere.length) {
    const elenco = daSpingere.slice(0, MASSIMO_IN_ELENCO)
    out.push({
      chiave: 'google-prodotti:spingi', tipo: 'spingi-prodotti-google', canale: 'google', esecuzione: 'a-mano',
      prodotti: elenco, quanti: elenco.length, quantiInTutto: daSpingere.length,
      previsto: { euroMese: elenco.reduce((s, v) => s + v.euroMese, 0), metrica: 'margine-in-piu', periodo: gpv.range, spinta: SPINTA },
      base: { spesa: elenco.reduce((s, v) => s + v.spesa, 0), margine: elenco.reduce((s, v) => s + (v.margine || 0), 0), giorni },
    })
  }
  return out
}

// LA MISURA — stessi prodotti, stessa fonte, finestra lunga quanto quella di partenza ma DOPO
// l'esecuzione. `dopo` e' la risposta di google-product-verdicts sul periodo successivo.
export function misuraGoogle(mossa, dopo) {
  const righe = Array.isArray(dopo?.righe) ? dopo.righe : []
  const mie = new Set((mossa.prodotti || []).flatMap(p => p.itemIds || []))
  const trovate = righe.filter(r => (r.itemIds || [r.itemId]).some(i => mie.has(i)))
  const giorni = Math.max(1, Math.round((Date.parse(dopo.range.until) - Date.parse(dopo.range.since)) / 86_400_000) + 1)
  const alMese = 30 / giorni
  const spesaDopo = trovate.reduce((s, r) => s + (Number(r.cost) || 0), 0) * alMese
  const margineDopo = trovate.reduce((s, r) => s + (Number(r.margineNetto) || 0), 0) * alMese
  const spesaPrima = (mossa.base?.spesa || 0) * (30 / (mossa.base?.giorni || 30))
  let euroMese, nota
  if (mossa.tipo === 'ferma-prodotti-google') {
    // la perdita evitata VERA: di quanto e' scesa la perdita su quei prodotti (la spesa che non
    // c'e' piu', al netto del poco margine che portavano)
    const perditaPrima = mossa.previsto.euroMese
    const perditaDopo = Math.max(0, -margineDopo)
    euroMese = r0(perditaPrima - perditaDopo); nota = 'perdita-prima-meno-dopo'
  } else {
    const marginePrima = (mossa.base?.margine || 0) * (30 / (mossa.base?.giorni || 30))
    euroMese = r0(margineDopo - marginePrima); nota = 'margine-dopo-meno-prima'
  }
  const previsto = mossa.previsto?.euroMese || 0
  return {
    quando: new Date().toISOString(), periodo: dopo.range, euroMese, previsto,
    spesaPrimaMese: r0(spesaPrima), spesaDopoMese: r0(spesaDopo), nota,
    // "aveva ragione" = l'effetto vero e' dalla parte giusta e vale almeno meta' del previsto
    avevaRagione: euroMese > 0 && euroMese >= previsto * 0.5,
  }
}
