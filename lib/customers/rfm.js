// ── RFM / lifecycle dei clienti (condiviso, tenant-agnostico) ───────────────
// Logica UNICA usata da: /api/customers (live), /api/cron/customer-snapshots
// (snapshot settimanale) e /api/customers/backfill (ricostruzione storica).
// Vale per QUALSIASI tenant: nessun riferimento hardcoded a uno store.

export const DAY = 86400000

// Segmenti in ordine di "fedeltà/valore" crescente di lifecycle.
export const SEGMENTS = ['new', 'potentialLoyal', 'loyal', 'loyalAtRisk', 'aboutToSleep', 'sleepers']

// Colori coerenti con la UI (riusati nel client).
export const SEG_COLOR = {
  new: '#3b82f6',
  potentialLoyal: '#22c55e',
  loyal: '#0ea5e9',
  loyalAtRisk: '#ef4444',
  aboutToSleep: '#f5b301',
  sleepers: '#9ca3af',
}

// Soglie (giorni di recency, n° ordini). Default sensati e validi per tutti.
const ACTIVE_DAYS = 120   // entro = ancora "vivo"
const RECENT_DAYS = 90    // 2+ ordini recenti → potential loyal
const SLEEP_DAYS = 180    // oltre = dormiente
const NEW_DAYS = 30       // primo ordine entro = nuovo
const LOYAL_ORDERS = 5    // soglia "loyal"

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(num(n) * 100) / 100

// Classifica un cliente dal n° ordini (Frequency) e dai giorni dall'ultimo
// ordine (Recency). Mutuamente esclusivo, copre tutti i casi.
export function classify(orders, recencyDays) {
  const o = Math.round(num(orders))
  const r = num(recencyDays)
  if (o >= LOYAL_ORDERS) return r <= ACTIVE_DAYS ? 'loyal' : 'loyalAtRisk'
  if (o >= 2) {
    if (r <= RECENT_DAYS) return 'potentialLoyal'
    if (r <= SLEEP_DAYS) return 'aboutToSleep'
    return 'sleepers'
  }
  // o === 1
  if (r <= NEW_DAYS) return 'new'
  if (r <= SLEEP_DAYS) return 'aboutToSleep'
  return 'sleepers'
}

// Aggregato vuoto per segmento.
const emptySeg = () => ({ count: 0, sumSpent: 0, sumOrders: 0, sumCadence: 0, cadenceN: 0 })

// Costruisce uno snapshot completo a partire da una lista di "buyer":
//   { orders, spent, recencyDays, cadenceDays|null }
// Ritorna { totalCustomers, firstTime, returning, retention, clv, aov,
//           ordersPerCustomer, daysBetween, segments:{key:{...metriche}} }.
// Identico ovunque → live, cron e backfill restano coerenti.
export function buildSnapshot(buyers) {
  const segAgg = {}
  for (const k of SEGMENTS) segAgg[k] = emptySeg()

  let count = 0, firstTime = 0, returning = 0
  let sumSpent = 0, sumOrders = 0, sumCadence = 0, cadenceN = 0
  let ftSpent = 0, ftOrders = 0, rtSpent = 0, rtOrders = 0

  for (const b of buyers) {
    const orders = Math.round(num(b.orders))
    if (orders <= 0) continue
    const spent = num(b.spent)
    const cadence = b.cadenceDays == null ? null : num(b.cadenceDays)
    const key = classify(orders, b.recencyDays)
    const s = segAgg[key]
    s.count++; s.sumSpent += spent; s.sumOrders += orders
    if (cadence != null && orders >= 2) { s.sumCadence += cadence; s.cadenceN++ }

    count++; sumSpent += spent; sumOrders += orders
    if (cadence != null && orders >= 2) { sumCadence += cadence; cadenceN++ }
    if (orders >= 2) { returning++; rtSpent += spent; rtOrders += orders }
    else { firstTime++; ftSpent += spent; ftOrders += orders }
  }

  const segments = {}
  for (const k of SEGMENTS) {
    const s = segAgg[k]
    segments[k] = {
      key: k,
      count: s.count,
      customerValue: s.count ? r2(s.sumSpent / s.count) : 0,
      avgOrders: s.count ? r2(s.sumOrders / s.count) : 0,
      daysBetween: s.cadenceN ? Math.round(s.sumCadence / s.cadenceN) : null,
      aov: s.sumOrders ? r2(s.sumSpent / s.sumOrders) : 0,
      totalSales: r2(s.sumSpent),
    }
  }

  return {
    totalCustomers: count,
    firstTime,
    returning,
    retention: count ? r2((returning / count) * 100) : 0,         // % repeat
    clv: count ? r2(sumSpent / count) : 0,
    aov: sumOrders ? r2(sumSpent / sumOrders) : 0,
    ordersPerCustomer: count ? r2(sumOrders / count) : 0,
    daysBetween: cadenceN ? Math.round(sumCadence / cadenceN) : null,
    // split first-time vs returning (per i KPI in cima)
    ft: { customerValue: firstTime ? r2(ftSpent / firstTime) : 0, aov: ftOrders ? r2(ftSpent / ftOrders) : 0, ordersPerCustomer: firstTime ? r2(ftOrders / firstTime) : 0 },
    rt: { customerValue: returning ? r2(rtSpent / returning) : 0, aov: rtOrders ? r2(rtSpent / rtOrders) : 0, ordersPerCustomer: returning ? r2(rtOrders / returning) : 0 },
    segments,
  }
}

// ISO week monday (UTC) per una data → stringa 'YYYY-MM-DD'. Chiave settimanale
// stabile e uguale per tutti i tenant.
export function isoWeekMonday(ts) {
  const d = new Date(ts)
  const day = (d.getUTCDay() + 6) % 7 // 0 = lunedì
  const mon = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)
  return new Date(mon).toISOString().slice(0, 10)
}

export { r2 as round2, num as toNum }
