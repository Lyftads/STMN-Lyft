import { getShopify } from '../tenant/credentials'

// ============================================================================
//  Dati Shopify ESATTI per intervallo, via Admin GraphQL (no lag ShopifyQL, al
//  NETTO dei resi). Boundary nel fuso del negozio (Europe/Rome) per combaciare
//  con le tab. Va chiamato dentro withTenantContext.
// ============================================================================

// Offset Europe/Rome (+02:00 estate / +01:00 inverno) per una data.
function romeOffset(dateStr) {
  try {
    const s = new Date(dateStr + 'T12:00:00Z').toLocaleString('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'shortOffset' })
    const m = s.match(/GMT([+-]\d+)/)
    const h = m ? Number(m[1]) : 2
    return (h >= 0 ? '+' : '-') + String(Math.abs(h)).padStart(2, '0') + ':00'
  } catch { return '+02:00' }
}

export async function ordersInRange(start, end, maxPages = 40) {
  const sh = getShopify()
  const storeUrl = sh?.storeUrl, token = sh?.adminToken
  if (!storeUrl || !token) return null
  const offS = romeOffset(start), offE = romeOffset(end)
  const gql = `query($q:String!,$cursor:String){orders(first:100,query:$q,after:$cursor,sortKey:CREATED_AT){edges{cursor node{currentTotalPriceSet{shopMoney{amount}} totalRefundedSet{shopMoney{amount}}}}pageInfo{hasNextPage}}}`
  const q = `created_at:>=${start}T00:00:00${offS} created_at:<=${end}T23:59:59${offE} financial_status:paid`
  let cursor = null, pages = 0, orders = 0, fatturato = 0, resi = 0
  try {
    while (pages < maxPages) {
      const res = await fetch(`https://${storeUrl}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: gql, variables: { q, cursor } }),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) break
      const j = await res.json()
      const conn = j.data?.orders
      const edges = conn?.edges || []
      for (const e of edges) {
        const total = parseFloat(e.node.currentTotalPriceSet?.shopMoney?.amount || 0)
        const refund = Math.abs(parseFloat(e.node.totalRefundedSet?.shopMoney?.amount || 0))
        const net = total - refund
        resi += refund; fatturato += net
        if (net > 0.01) orders += 1
      }
      pages++
      if (!conn?.pageInfo?.hasNextPage) break
      cursor = edges[edges.length - 1]?.cursor
      if (!cursor) break
    }
    return { orders, fatturato: Math.round(fatturato), resi: Math.round(resi) }
  } catch { return null }
}

const ymd = d => d.toISOString().slice(0, 10)
const addDays = (s, n) => { const x = new Date(s + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return ymd(x) }

// Tutti i time frame Shopify ESATTI (per combaciare con le tab e rispondere a
// qualsiasi domanda: oggi, ieri, settimana, mese…). Net resi, fuso negozio.
export async function periodStats() {
  const now = new Date()
  const today = ymd(now)
  const yest = addDays(today, -1)
  const dd = (now.getUTCDay() + 6) % 7
  const thisMon = addDays(today, -dd)
  const lastMon = addDays(thisMon, -7)
  const lastSun = addDays(lastMon, 6)
  const thisMonth1 = today.slice(0, 8) + '01'
  const lastMonthEnd = addDays(thisMonth1, -1)
  const lastMonth1 = lastMonthEnd.slice(0, 8) + '01'
  const last30 = addDays(today, -29)
  const ranges = {
    today: [today, today], yesterday: [yest, yest],
    this_week: [thisMon, today], last_week: [lastMon, lastSun],
    this_month: [thisMonth1, today], last_month: [lastMonth1, lastMonthEnd],
    last_30d: [last30, today],
  }
  const keys = Object.keys(ranges)
  const results = await Promise.all(keys.map(k => ordersInRange(ranges[k][0], ranges[k][1]).catch(() => null)))
  const out = {}
  keys.forEach((k, i) => { out[k] = results[i] && { ...results[i], from: ranges[k][0], to: ranges[k][1] } })
  return out
}

// Retro-compat: weekStats usato altrove → ricavato da periodStats.
export async function weekStats() {
  const p = await periodStats()
  return { thisWeek: p.this_week, lastWeek: p.last_week }
}
