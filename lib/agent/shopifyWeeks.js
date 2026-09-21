import { getShopify } from '../tenant/credentials'

import { shopifyql } from '../shopify/shopifyql'
import { clausolaSenzaCanali } from '../shopify/koongo'
import { canaliEsclusiDelCliente } from '../team/canaliCliente'
import { oggiNegozio, piuGiorni } from '../periodi'

// ============================================================================
//  I numeri di Shopify per i periodi che l'agente vocale conosce (oggi, ieri,
//  settimana, mese, ultimi 7/14/30 giorni). Va chiamato dentro withTenantContext.
//
//  Dal 21 set 2026 dai TOTALI di Shopify (ShopifyQL, una sola interrogazione
//  giorno per giorno sommata per periodo), con le stesse misure delle tab:
//  total_sales (resi gia' tolti), nuovi/di ritorno di Shopify, senza i canali
//  esclusi del cliente. Prima si sfogliavano gli ordini (100 per pagina, al
//  massimo 40 pagine = 4.000 ordini, solo "paid", nove periodi in parallelo):
//  su un negozio da 3.000+ ordini al mese il mese e i 30 giorni si fermavano a
//  meta', e al primo rifiuto di Shopify il numero detto a voce era piu' basso
//  del vero senza che nessuno lo sapesse.
// ============================================================================

const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0 }

// Tutti i time frame con UNA interrogazione: i giorni dal piu' vecchio inizio a oggi.
export async function periodStats() {
  const sh = getShopify()
  if (!sh?.storeUrl || !sh?.adminToken) return {}
  const today = oggiNegozio()
  const yest = piuGiorni(today, -1)
  const dd = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7
  const thisMon = piuGiorni(today, -dd)
  const lastMon = piuGiorni(thisMon, -7)
  const lastSun = piuGiorni(lastMon, 6)
  const thisMonth1 = today.slice(0, 8) + '01'
  const lastMonthEnd = piuGiorni(thisMonth1, -1)
  const lastMonth1 = lastMonthEnd.slice(0, 8) + '01'
  const ranges = {
    today: [today, today], yesterday: [yest, yest],
    this_week: [thisMon, today], last_week: [lastMon, lastSun],
    this_month: [thisMonth1, today], last_month: [lastMonth1, lastMonthEnd],
    last_7d: [piuGiorni(today, -6), today], last_14d: [piuGiorni(today, -13), today],
    last_30d: [piuGiorni(today, -29), today],
  }
  const da = Object.values(ranges).map(r => r[0]).sort()[0]
  let righe
  try {
    const canali = clausolaSenzaCanali(await canaliEsclusiDelCliente())
    righe = await shopifyql(`FROM sales SHOW orders, total_sales, returns, orders_first_time, orders_returning ${canali ? `WHERE ${canali}` : ''} GROUP BY day SINCE ${da} UNTIL ${today} ORDER BY day ASC LIMIT 400`)
  } catch { return {} }
  const perGiorno = righe.map(r => ({ day: String(r.day || '').slice(0, 10), orders: num(r.orders), fatturato: num(r.total_sales), resi: Math.abs(num(r.returns)), nc: num(r.orders_first_time), rc: num(r.orders_returning) }))
  const out = {}
  for (const [k, [from, to]] of Object.entries(ranges)) {
    const g = perGiorno.filter(x => x.day >= from && x.day <= to)
    const s = (c) => g.reduce((a, x) => a + x[c], 0)
    out[k] = { orders: Math.round(s('orders')), fatturato: Math.round(s('fatturato')), resi: Math.round(s('resi')), nc: Math.round(s('nc')), rc: Math.round(s('rc')), from, to }
  }
  return out
}

// Retro-compat: weekStats usato altrove → ricavato da periodStats.
export async function weekStats() {
  const p = await periodStats()
  return { thisWeek: p.this_week, lastWeek: p.last_week }
}
