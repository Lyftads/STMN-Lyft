// ============================================================================
//  Le cifre di Shopify che servono all'utile netto di un periodo di GIORNI.
//  (La tab Conto economico ha le sue, per mese, in app/api/pnl/route.js.)
//
//  Vendite e costo dei prodotti passano dalla porta unica ShopifyQL (cache per
//  interrogazione, passo al minuto). Gli errori si propagano: un'interrogazione
//  fallita NON diventa «zero vendite», che darebbe un utile finto.
// ============================================================================
import { getShopify, getEffectiveTenantId } from '../tenant/credentials'
import { shopifyql } from '../shopify/shopifyql'
import { getSnapshotStale, setSnapshot } from '../cache/snapshot'

const num = (v) => {
  if (v == null) return 0
  if (typeof v === 'object') v = v.amount ?? v.value ?? 0
  const x = parseFloat(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(x) ? x : 0
}
const r2 = (v) => Math.round(num(v) * 100) / 100
const attendi = (ms) => new Promise(r => setTimeout(r, ms))

// Vendite del periodo, tutti i canali (il conto economico e' l'azienda intera).
// `stale` = Shopify rifiutava e la porta ha servito l'ultimo dato buono.
export async function venditePeriodo({ since, until }) {
  const righe = await shopifyql(`FROM sales SHOW total_sales, net_sales, taxes, shipping_charges, orders SINCE ${since} UNTIL ${until}`)
  const r = righe[0] || {}
  const netSales = r2(r.net_sales), taxes = r2(r.taxes), shipping = r2(r.shipping_charges)
  const ts = r2(r.total_sales)
  return {
    netSales, taxes, shipping,
    // total_sales a volte torna 0 in ShopifyQL: si ricostruisce, come nel Conto economico
    totalSales: ts > 0 ? ts : r2(netSales + taxes + shipping),
    orders: Math.round(num(r.orders)),
    stale: righe.stale === true,
  }
}

// Costo dei prodotti del periodo. I nomi della metrica cambiano fra le versioni
// di ShopifyQL: si provano in ordine, e un nome che non esiste (errore di
// sintassi) fa solo passare al successivo. null = nessuna forma ha funzionato.
export async function cogsPeriodo({ since, until }) {
  const coda = `SINCE ${since} UNTIL ${until}`
  const prove = [
    { q: `FROM sales SHOW cost_of_goods_sold WHERE cost_is_recorded = true ${coda}`, leggi: r => Math.abs(r2(r.cost_of_goods_sold)) },
    { q: `FROM sales SHOW cost_of_goods_sold ${coda}`, leggi: r => Math.abs(r2(r.cost_of_goods_sold)) },
    { q: `FROM sales SHOW total_cost ${coda}`, leggi: r => Math.abs(r2(r.total_cost)) },
    { q: `FROM sales SHOW net_sales, gross_profit ${coda}`, leggi: r => r2(num(r.net_sales) - num(r.gross_profit)) },
  ]
  for (const p of prove) {
    try {
      const righe = await shopifyql(p.q)
      return { cogs: righe[0] ? p.leggi(righe[0]) : 0, stale: righe.stale === true }
    } catch (e) {
      if (e?.sintassi) continue
      throw e
    }
  }
  return { cogs: null, stale: false }
}

// Commissioni VERE di Shopify Payments nel periodo. Le transazioni arrivano
// dalla piu' recente: si scorre all'indietro fino all'inizio del periodo.
// null = niente Shopify Payments (o permesso mancante), oppure il periodo e'
// troppo lungo per leggerlo tutto: in quel caso vale la stima, mai una somma a meta'.
export async function feeRealiPeriodo({ since, until }) {
  const { storeUrl, adminToken } = getShopify()
  if (!storeUrl || !adminToken) return null
  let url = `https://${storeUrl}/admin/api/2024-01/shopify_payments/balance/transactions.json?limit=250`
  let pagine = 0, somma = 0, arrivato = false
  try {
    while (url && pagine < 40) {
      pagine++
      let res = null
      for (let a = 0; a < 4; a++) {
        res = await fetch(url, { cache: 'no-store', headers: { 'X-Shopify-Access-Token': adminToken } })
        if (res.status === 429) { await attendi((Number(res.headers.get('Retry-After')) || 2) * 1000); continue }
        break
      }
      if (!res || !res.ok) return null
      const j = await res.json().catch(() => null)
      let piuVecchia = null
      for (const t of (j?.transactions || [])) {
        const d = String(t.processed_at || t.payout_date || t.created_at || '').slice(0, 10)   // giorno del negozio
        if (!d) continue
        piuVecchia = d
        if (d >= since && d <= until) somma += Math.abs(num(t.fee))
      }
      if (piuVecchia && piuVecchia < since) { arrivato = true; break }
      const prossima = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') || '')
      url = prossima ? prossima[1] : null
    }
    if (url && !arrivato) return null   // fermati dal tetto di pagine: lettura parziale
    return r2(somma)
  } catch { return null }
}

// Riparto del fatturato per metodo di pagamento (ultimi 60 giorni di ordini).
// E' lo stesso per ogni periodo e costa molte pagine: si calcola al massimo una
// volta al giorno per negozio e si tiene nella cache condivisa.
const VITA_MIX = 24 * 3_600_000
export async function mixPagamenti() {
  const ws = await getEffectiveTenantId().catch(() => null)
  const chiave = 'utile:mix-pagamenti'
  const vecchio = ws ? await getSnapshotStale(ws, chiave) : null
  if (vecchio?.payload?.mix && vecchio.ageMs < VITA_MIX) return vecchio.payload
  const fresco = await leggiMix()
  if (fresco && ws) setSnapshot(ws, chiave, fresco)   // senza attendere
  return fresco || vecchio?.payload || null
}

async function leggiMix() {
  const { storeUrl, adminToken } = getShopify()
  if (!storeUrl || !adminToken) return null
  const da = new Date(Date.now() - 60 * 86_400_000).toISOString()
  const mix = {}
  let totale = 0, pagine = 0
  let url = `https://${storeUrl}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${encodeURIComponent(da)}&limit=250&fields=id,current_total_price,total_price,payment_gateway_names,gateway`
  try {
    while (url && pagine < 60) {
      pagine++
      let res = null
      for (let a = 0; a < 5; a++) {
        res = await fetch(url, { cache: 'no-store', headers: { 'X-Shopify-Access-Token': adminToken } })
        if (res.status === 429 || res.status === 430) { await attendi((Number(res.headers.get('Retry-After')) || 2) * 1000); continue }
        break
      }
      if (!res || !res.ok) break
      const j = await res.json().catch(() => null)
      for (const o of (j?.orders || [])) {
        const importo = num(o.current_total_price ?? o.total_price)
        if (!importo) continue
        const metodi = (Array.isArray(o.payment_gateway_names) && o.payment_gateway_names.length) ? o.payment_gateway_names : [o.gateway || 'unknown']
        const quota = importo / metodi.length
        for (const g of metodi) { const k = String(g || 'unknown'); mix[k] = (mix[k] || 0) + quota; totale += quota }
      }
      const prossima = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') || '')
      url = prossima ? prossima[1] : null
    }
    for (const k in mix) mix[k] = r2(mix[k])
    return totale > 0 ? { mix, total: r2(totale) } : null
  } catch { return null }
}
