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
// ── Per un SaaS con tanti clienti ────────────────────────────────────────────────────────────
//  Qui sopra il canale e' una COSTANTE, perche' sul fork il negozio era uno solo. In un prodotto
//  multi-cliente non puo' esserlo: ogni negozio ha i suoi canali, e un negozio che non vende su
//  nessun marketplace non deve subire nessun filtro. Le funzioni sotto prendono l'elenco dal
//  cliente (companies.canali_esclusi, vedi lib/team/tipoNegozio.js).
//  REGOLA: elenco vuoto = NESSUN filtro, cioe' esattamente il comportamento di chi non ha
//  marketplace. Non si eredita mai il canale di un altro negozio.

const apice = (s) => String(s).replace(/'/g, "''")

// Clausola ShopifyQL per escludere i canali del cliente. '' se non ce ne sono.
export function clausolaSenzaCanali(canali = []) {
  const lista = (canali || []).filter(c => typeof c === 'string' && c.trim())
  if (!lista.length) return ''
  return lista.map(c => `sales_channel != '${apice(c.trim())}'`).join(' AND ')
}

// Compone la WHERE tenendo conto di quella che c'era gia' e dei canali del cliente.
export function whereSenzaCanali(existing = '', canali = []) {
  const e = String(existing || '').trim().replace(/^where\s+/i, '')
  const c = clausolaSenzaCanali(canali)
  if (!e && !c) return ''
  if (!c) return `WHERE ${e}`
  return e ? `WHERE ${e} AND ${c}` : `WHERE ${c}`
}

// Riconosce un ordine letto dall'Admin API (dove il canale non c'e'): si guarda l'app che l'ha
// creato e i tag. Senza canali configurati NON esclude niente.
export function ordineDaCanaleEscluso(order, canali = []) {
  const lista = (canali || []).filter(c => typeof c === 'string' && c.trim())
  if (!order || !lista.length) return false
  const app = String(order.app?.name || order.app_name || order.source_name || '')
  const tags = Array.isArray(order.tags) ? order.tags : String(order.tags || '').split(',')
  return lista.some(canale => {
    // "Koongo: Sell on Marketplaces" -> la parola che identifica l'app e' la prima
    const chiave = canale.split(':')[0].trim()
    if (!chiave) return false
    const re = new RegExp(chiave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    return re.test(app) || tags.some(t => re.test(String(t).trim()))
  })
}

export function isKoongoOrder(order) {
  if (!order) return false
  const app = order.app?.name || order.app_name || order.source_name || ''
  if (/koongo/i.test(app)) return true
  const tags = Array.isArray(order.tags) ? order.tags : String(order.tags || '').split(',')
  return tags.some(t => /^\s*koongo\s*$/i.test(t))
}
