// ============================================================================
//  Riconoscimento del prodotto dal NOME dell'inserzione.
//
//  Molte creatività lo dichiarano già nel titolo (ANGELINOBagInBox, DoppiaBag,
//  TROAS_BagInBoxANGELINO). Leggerlo è deterministico, gratuito e più
//  affidabile che chiedere a un modello di riconoscere una confezione in foto.
//  La classificazione visiva resta, ma solo per ciò che il nome non dice.
//
//  Conoscenza di brand necessaria a interpretare i nomi:
//   · ANGELINO = scatola BIANCA  = linea "Italiano"
//   · FRUTTATO = scatola VERDE   = linea "fruttato"
//   · DoppiaBag / 2Bag / 10 litri = formato da due bag da 5L
//   · una bag sola / 5L           = formato singolo
// ============================================================================

const norm = (s) => (s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function segnaliDaNome(nome) {
  const n = norm(nome)
  const linea =
    /FRUTTAT/.test(n) ? 'fruttato' :
    /ANGELIN/.test(n) ? 'italiano' : null
  // "DOPPIA", "2BAG", "2 X 5" o "10 L" indicano il formato da due bag.
  const doppio = /DOPPIA|2\s*BAG|2X5|2\s*X\s*5|\b10\s*L/.test(n)
  const singolo = !doppio && /\b5\s*L|BAGINBOX|BAG\s*IN\s*BOX/.test(n)
  const tipo =
    /LATTIN/.test(n) ? 'lattina' :
    /BOTTIGL/.test(n) ? 'bottiglia' :
    /DOSATOR/.test(n) ? 'dosatore' :
    /\bKIT\b|ASSAGGIO/.test(n) ? 'kit' :
    (doppio || singolo) ? 'bagbox' : null
  return { linea, formato: doppio ? 'doppio' : singolo ? 'singolo' : null, tipo }
}

// Punteggio di somiglianza fra i segnali del nome e un prodotto del catalogo.
// Si accetta solo se il match è netto: nel dubbio si lascia decidere alla vista.
export function abbinaProdotto(nome, prodotti) {
  const s = segnaliDaNome(nome)
  if (!s.linea && !s.tipo) return null

  let migliore = null, punteggioMigliore = 0
  for (const p of prodotti) {
    const t = norm(p.name)
    let punti = 0
    if (s.linea === 'fruttato') punti += /FRUTTAT/.test(t) ? 3 : -3
    if (s.linea === 'italiano') punti += /FRUTTAT/.test(t) ? -3 : 2
    if (s.tipo === 'bagbox') punti += /BAG\s*IN\s*BOX/.test(t) ? 2 : -2
    if (s.tipo === 'lattina') punti += /LATTIN/.test(t) ? 3 : -2
    if (s.tipo === 'bottiglia') punti += /BOTTIGL/.test(t) ? 3 : -2
    if (s.tipo === 'dosatore') punti += /DOSATOR/.test(t) ? 4 : -2
    if (s.tipo === 'kit') punti += /KIT|ASSAGGIO|BOX/.test(t) ? 3 : -2
    if (s.formato === 'doppio') punti += /10\s*LITRI|2\s*X\s*5|2\s*BAG/.test(t) ? 3 : -2
    if (s.formato === 'singolo') punti += /10\s*LITRI|2\s*X\s*5/.test(t) ? -3 : 1
    if (punti > punteggioMigliore) { punteggioMigliore = punti; migliore = p }
  }
  // Soglia: sotto 4 punti il nome non è abbastanza esplicito. Meglio un vuoto
  // che un prodotto sbagliato, perché su questo si alloca il budget.
  return punteggioMigliore >= 4 ? { prodotto: migliore, punteggio: punteggioMigliore } : null
}
