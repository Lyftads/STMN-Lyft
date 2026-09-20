// ============================================================================
//  ABBINARE lo stesso articolo fra Anna Virgili e un concorrente — senza indovinare.
//
//  Gli SKU del negozio sono il CODICE DEL PRODUTTORE + colore + taglia:
//    GUESS  HWZG9919060-NAV-UNI · PIQUADRO BD4574W92T-N-UNI · MICHAEL KORS 30T6A9IT0S-251-UNI ·
//    COCCINELLE E1-UAA-58-01-01-R02-UNI · THE BRIDGE 01711101-14-UNI
//  Lo stesso codice lo usano tutti i rivenditori (nello SKU, nel titolo, nell'indirizzo della
//  pagina). Quindi: si toglie la taglia, l'ultimo pezzo e' il COLORE, il resto e' il MODELLO.
//   · "esatto"  = modello+colore ritrovati nel prodotto del concorrente, stesso marchio;
//   · "modello" = ritrovato solo il modello: stesso articolo, colore da verificare.
//  Un modello corto o senza cifre non si usa (troppo facile ritrovarlo per caso).
//  Matematica pura: si collauda con `.audit-abbina.mjs`.
// ============================================================================
const norma = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '')
const TAGLIE = new Set(['UNI', 'U', 'TU', 'OS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'])

export function chiaviSku(sku) {
  const pezzi = String(sku || '').trim().split(/[-_/\s]+/).filter(Boolean)
  while (pezzi.length > 1 && (TAGLIE.has(pezzi[pezzi.length - 1].toUpperCase()) || /^\d{2}$/.test(pezzi[pezzi.length - 1]) && pezzi.length > 3)) pezzi.pop()
  if (pezzi.length < 2) { const m = norma(pezzi[0]); return m.length >= 6 && /\d/.test(m) ? { modello: m, colore: null, intero: m } : null }
  const colore = norma(pezzi[pezzi.length - 1]), modello = norma(pezzi.slice(0, -1).join(''))
  if (modello.length < 6 || !/\d/.test(modello)) return null
  return { modello, colore, intero: modello + colore }
}

export const stessoMarchio = (a, b) => { const x = norma(a), y = norma(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)) }

// prodotti del concorrente (forma di /products.json) → testo in cui cercare i codici
export function preparaConcorrente(prodotti) {
  return (prodotti || []).map(p => {
    const varianti = (p.variants || []).map(v => ({ sku: norma(v.sku), prezzo: Number(v.price) || null, pieno: Number(v.compare_at_price) || null, disponibile: v.available !== false, titolo: v.title }))
    return { titolo: p.title, marchio: p.vendor, handle: p.handle, varianti, pagliaio: norma(`${p.title} ${p.handle} ${(p.tags || []).join(' ')}`) }
  })
}

// miei: [{ sku, titolo, marchio, prezzo, productId }] → per ognuno la migliore offerta del concorrente
export function abbina(miei, concorrente) {
  const out = []
  for (const mio of miei) {
    const k = chiaviSku(mio.sku); if (!k) continue
    let migliore = null
    for (const p of concorrente) {
      if (p.marchio && mio.marchio && !stessoMarchio(p.marchio, mio.marchio) && !p.pagliaio.includes(norma(mio.marchio))) continue
      const vEsatta = k.colore ? p.varianti.find(v => v.sku && v.sku.includes(k.intero)) : null
      const vModello = p.varianti.find(v => v.sku && v.sku.includes(k.modello))
      const nelTesto = p.pagliaio.includes(k.modello)
      let livello = null, v = null
      if (vEsatta) { livello = 'esatto'; v = vEsatta }
      else if (k.colore && nelTesto && p.pagliaio.includes(k.intero)) { livello = 'esatto'; v = p.varianti.find(x => x.disponibile) || p.varianti[0] }
      else if (vModello || nelTesto) { livello = 'modello'; v = vModello || p.varianti.find(x => x.disponibile) || p.varianti[0] }
      if (!livello || !v?.prezzo) continue
      const cand = { livello, prezzo: v.prezzo, pieno: v.pieno, disponibile: v.disponibile, titolo: p.titolo, handle: p.handle }
      if (!migliore || (livello === 'esatto' && migliore.livello !== 'esatto') || (livello === migliore.livello && cand.prezzo < migliore.prezzo)) migliore = cand
    }
    if (migliore) out.push({ sku: mio.sku, ...migliore })
  }
  return out
}
