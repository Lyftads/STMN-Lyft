// ============================================================================
//  Google Ads: "conversioni" vuol dire ACQUISTI, e basta.
//
//  metrics.conversions somma tutte le azioni che in quel giorno erano segnate
//  come primarie. Su un account reale per un periodo lo e' stata anche
//  "Add to cart - SST": 44 aggiunte al carrello per 5.467 € contate come
//  vendite in trenta giorni, un quarto del valore totale. Toglierla dalle
//  primarie non ripulisce lo storico: Google non riscrive i giorni passati.
//  Risultato: prodotti "venduti" da Google che su Shopify non avevano un solo
//  ordine, e ROAS gonfiato ovunque.
//
//  La regola, per ogni lettura di conversioni: si chiede la categoria
//  dell'azione e si tiene solo PURCHASE. Spesa, clic e impression NON si
//  possono segmentare per azione (Google rifiuta la query): restano nella
//  lettura di sempre, e le conversioni arrivano da una seconda lettura gemella.
// ============================================================================

export const SOLO_ACQUISTI = "segments.conversion_action_category = 'PURCHASE'"
export const CAMPO_CATEGORIA = 'segments.conversion_action_category'

// Aggiunge il filtro a una query GAQL che ha gia' un WHERE.
export const conSoloAcquisti = (query) => `${query} AND ${SOLO_ACQUISTI}`

// Vale anche lato nostro, quando la categoria arriva come colonna.
export const isAcquisto = (categoria) => String(categoria || '').toUpperCase() === 'PURCHASE'

// ── Per le rotte che hanno gia' una funzione "cerca(query) → righe" ─────────
// Dalla query di sempre se ne ricava una gemella con le sole conversioni
// d'acquisto, e i suoi numeri PRENDONO IL POSTO di quelli della prima, riga
// per riga. Il resto della rotta non cambia: stesse righe, stessi campi.

export function queryAcquisti(query) {
  const taglio = query.indexOf(' FROM ')
  const campi = query.slice('SELECT '.length, taglio).split(',').map(x => x.trim()).filter(Boolean)
  const tenuti = campi.filter(c => !c.startsWith('metrics.'))
  return conSoloAcquisti(`SELECT ${[...tenuti, CAMPO_CATEGORIA, 'metrics.conversions', 'metrics.conversions_value'].join(', ')}${query.slice(taglio)}`)
}

// La "firma" di una riga: i soli campi chiesti nella SELECT che non sono
// metriche (campagna, data, segmento…). Le righe arrivano come oggetti con
// decine di campi di contorno a valore predefinito: confrontarle per intero
// non funziona, due righe della stessa campagna risultano diverse.
const cammello = (x) => x.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
function campiFirma(query) {
  return query.slice('SELECT '.length, query.indexOf(' FROM ')).split(',').map(x => x.trim())
    .filter(c => c && !c.startsWith('metrics.') && c !== CAMPO_CATEGORIA)
}
// Anche senza campi nella SELECT Google restituisce una riga PER RISORSA (una
// per campagna, per gruppo…): il nome della risorsa entra sempre nella firma,
// altrimenti dieci campagne prenderebbero tutte il totale dell'account.
function risorsaDi(query) {
  const m = / FROM ([a-z_]+)/.exec(query)
  return m ? m[1] : null
}
function firma(riga, campi, risorsa) {
  const r = risorsa ? (riga?.[risorsa] ?? riga?.[cammello(risorsa)]) : null
  const nome = r ? (r.resource_name ?? r.resourceName ?? '') : ''
  return `${nome}#` + campi.map(c => {
    let v = riga
    for (const pezzo of c.split('.')) v = v == null ? v : (v[pezzo] ?? v[cammello(pezzo)])
    return `${c}=${v ?? ''}`
  }).join('|')
}

const n = (v) => Number(v) || 0

export async function cercaSoloAcquisti(cerca, query) {
  if (!/metrics\.conversions/.test(query)) return cerca(query)
  const [righe, acquisti] = await Promise.all([cerca(query), cerca(queryAcquisti(query))])
  const campi = campiFirma(query), risorsa = risorsaDi(query)
  const perFirma = new Map()
  for (const r of (acquisti || [])) {
    const k = firma(r, campi, risorsa), m = r.metrics || {}
    const a = perFirma.get(k) || { conversions: 0, valore: 0, riga: r, usata: false }
    a.conversions += n(m.conversions)
    a.valore += n(m.conversions_value ?? m.conversionsValue)
    perFirma.set(k, a)
  }
  const out = (righe || []).map(r => {
    const a = perFirma.get(firma(r, campi, risorsa))
    if (a) a.usata = true
    return { ...r, metrics: { ...(r.metrics || {}), conversions: a ? a.conversions : 0, conversions_value: a ? a.valore : 0, conversionsValue: a ? a.valore : 0 } }
  })
  // Un acquisto su una riga che la prima lettura non aveva (non dovrebbe
  // succedere: la conversione sta nel giorno del clic) non si butta via.
  for (const a of perFirma.values()) {
    if (!a.usata) out.push({ ...a.riga, metrics: { conversions: a.conversions, conversions_value: a.valore, conversionsValue: a.valore } })
  }
  return out
}
