// ============================================================================
//  Allocazione della produzione fra i prodotti.
//
//  Il criterio NON è il fatturato ma il MARGINE DI CONTRIBUZIONE: un prodotto
//  che vende molto con margine basso merita meno produzione di uno che vende
//  meno ma lascia di più. Il fatturato da solo porta a investire sul volume
//  invece che sul profitto.
//
//  Secondo criterio, correttivo: la COPERTURA CREATIVA già esistente. Un
//  prodotto che pesa molto ma ha già venti creatività attive ha bisogno di meno
//  produzione nuova di uno che pesa quanto lui e ne ha tre. Senza questo
//  correttivo si continuerebbe a ingrassare ciò che è già coperto.
// ============================================================================

// Quante creatività servono per presidiare decentemente una fase del funnel.
// Sotto le 3 per fase non c'è rotazione possibile: la prima che si stanca
// lascia un buco scoperto.
const MIN_PER_FASE = 3
const FASI = ['TOFU', 'MOFU', 'BOFU']

export function allocaProduzione({ prodotti, creativita, capacitaSettimanale = 12 }) {
  // I prodotti nascosti non ricevono produzione: nasconderli dalla board e
  // continuare a produrre creatività per loro sarebbe il peggio dei due mondi.
  prodotti = (prodotti || []).filter(p => !p.nascosto)
  // Copertura attuale: quante creatività vive ha ogni prodotto, per fase.
  const copertura = {}
  for (const c of creativita) {
    if (!c.product_id) continue
    const p = copertura[c.product_id] || (copertura[c.product_id] = { tot: 0, TOFU: 0, MOFU: 0, BOFU: 0 })
    p.tot++
    if (c.funnel && p[c.funnel] != null) p[c.funnel]++
  }

  const conMargine = prodotti
    .map(p => {
      const margine = (+p.revenue_30d || 0) * (p.margin_pct != null ? +p.margin_pct : 0.6)
      return { ...p, margine, copertura: copertura[p.id] || { tot: 0, TOFU: 0, MOFU: 0, BOFU: 0 } }
    })
    .filter(p => p.margine > 0)

  const margineTot = conMargine.reduce((s, p) => s + p.margine, 0)
  if (!margineTot) return { prodotti: [], capacitaSettimanale, nota: 'nessun dato di vendita' }

  // Bisogno = quanto manca per presidiare le tre fasi. È il correttivo che
  // impedisce di produrre altro per chi è già coperto.
  const out = conMargine.map(p => {
    const quotaMargine = p.margine / margineTot
    const mancanti = FASI.reduce((s, f) => s + Math.max(0, MIN_PER_FASE - p.copertura[f]), 0)
    const bisogno = mancanti / (MIN_PER_FASE * FASI.length)   // 0 = coperto, 1 = scoperto
    return { ...p, quotaMargine, mancanti, bisogno, peso: quotaMargine * (0.45 + 0.55 * bisogno) }
  })

  const pesoTot = out.reduce((s, p) => s + p.peso, 0)
  for (const p of out) {
    p.quotaProduzione = pesoTot ? p.peso / pesoTot : 0
    p.creativitaSettimana = Math.round(p.quotaProduzione * capacitaSettimanale)
    // Le fasi scoperte hanno la precedenza dentro la quota del prodotto.
    p.fasiPrioritarie = FASI
      .map(f => ({ fase: f, mancanti: Math.max(0, MIN_PER_FASE - p.copertura[f]) }))
      .filter(x => x.mancanti > 0)
      .sort((a, b) => b.mancanti - a.mancanti)
  }

  return {
    capacitaSettimanale,
    margineTot,
    prodotti: out.sort((a, b) => b.quotaProduzione - a.quotaProduzione),
  }
}

// La specifica fisica entra nei prompt di generazione: è la memoria dei
// dettagli che il modello sbaglia se lasciato libero.
// Quando un dettaglio della confezione non e' leggibile nella foto di riferimento,
// il modello lo INVENTA in modo verosimile: una maniglia di plastica sopra la
// scatola, un tappo sopra la latta, un blocco di testo legale su un fianco, un
// codice a barre, una finestra trasparente. Sono gli errori che il cliente
// riconosce al primo sguardo, perche' il prodotto e' suo: lo vede tutti i giorni.
// Vale per OGNI prodotto, anche quelli senza specifica scritta, quindi sta qui e
// non nelle specifiche a DB.
export function integritaProdotto() {
  return [
    `INTEGRITA' DEL PRODOTTO — regola non negoziabile, viene prima di tutto il resto:`,
    `il prodotto e' ESATTAMENTE quello della foto di riferimento. Non aggiungere NULLA`,
    `che in quella foto non ci sia, e non togliere niente che ci sia.`,
    `NON inventare: maniglie o manici sopra le scatole e le latte, tappi, coperchi,`,
    `beccucci, rubinetti, valvole, finestre trasparenti, griglie, etichette adesive,`,
    `sigilli, fascette, codici a barre, cordini, nastri, scritte o testo aggiuntivo`,
    `sul packaging.`,
    `Il testo stampato e' SOLO quello leggibile nella foto di riferimento, identico`,
    `parola per parola: mai testo verosimile, mai lettere inventate, mai blocchi di`,
    `testo legale o descrittivo sui fianchi. Se un lato della confezione non si vede`,
    `nella foto, tienilo fuori inquadratura o in ombra: non inventarne il contenuto.`,
    `Mostra esattamente le unita' di prodotto della foto di riferimento, ne' una in`,
    `piu' ne' una in meno.`,
    `Meglio un dettaglio ASSENTE che un dettaglio SBAGLIATO: se non sai com'e' fatta`,
    `una parte, nascondila o inquadra il prodotto da un lato dove non si vede.`,
    `Il prodotto deve risultare integro e identico all'originale.`,
  ].join('\n')
}

export function vincoliFisici(prodotto) {
  const s = (prodotto?.specifica_fisica || '').trim()
  return `\n\nFEDELTA' DEL PRODOTTO — vincoli non negoziabili:\n`
    + integritaProdotto()
    + (s ? `\n\n${s}\n` : `\n`)
    + `Forma, colori, grafica stampata e proporzioni devono corrispondere alla foto di `
    + `riferimento. Non ridisegnare la confezione.`
}
