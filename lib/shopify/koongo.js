// ============================================================================
//  Koongo — il fatturato dei marketplace sta fuori dalle metriche di efficienza
//
//  Koongo porta gli ordini dei marketplace (Amazon e simili) dentro Shopify.
//  Sono fatturato vero e vanno mostrati, ma NON li ha generati la pubblicita':
//  lasciarli dentro gonfia MER, ROAS e AOV e abbassa CAC e CPA, cioe' proprio
//  i numeri su cui si decide quanto spendere. Un ordine Amazon non ha nemmeno
//  una sessione sul sito, quindi falsa anche il tasso di conversione.
//
//  Percio': ogni conto di EFFICIENZA e ogni conteggio di clienti nuovi e di
//  ritorno esclude questo canale, e il fatturato Koongo si mostra a parte.
//  Il conto economico invece resta INTERO — togliere i marketplace dal P&L
//  farebbe sembrare l'azienda piu' piccola di com'e'.
//
//  Il discriminatore e' il canale di vendita, verificato sul negozio: gli
//  ordini arrivano con app "Koongo: Sell on Marketplaces" e ShopifyQL li
//  raggruppa sotto quel nome nella dimensione `sales_channel`.
// ============================================================================

export const KOONGO_CHANNEL = 'Koongo: Sell on Marketplaces'

// Clausola ShopifyQL da mettere in AND con le altre.
export const KOONGO_EXCLUDE = `sales_channel != '${KOONGO_CHANNEL}'`
export const KOONGO_ONLY = `sales_channel = '${KOONGO_CHANNEL}'`

// Compone la WHERE tenendo conto di quella che c'era gia'.
export function whereNoKoongo(existing = '') {
  const e = String(existing || '').trim().replace(/^where\s+/i, '')
  return e ? `WHERE ${e} AND ${KOONGO_EXCLUDE}` : `WHERE ${KOONGO_EXCLUDE}`
}

// Riconosce un ordine Koongo letto dall'Admin API (non da ShopifyQL), dove il
// canale non c'e': si guarda l'app che l'ha creato, con i tag come conferma.
export function isKoongoOrder(order) {
  if (!order) return false
  const app = order.app?.name || order.app_name || order.source_name || ''
  if (/koongo/i.test(app)) return true
  const tags = Array.isArray(order.tags) ? order.tags : String(order.tags || '').split(',')
  return tags.some(t => /^\s*koongo\s*$/i.test(t))
}
