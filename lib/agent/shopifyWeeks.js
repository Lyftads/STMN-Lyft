import { getShopify } from '../tenant/credentials'

// Conteggio ordini + fatturato in un intervallo di date via Shopify Admin GraphQL.
// È la fonte AFFIDABILE per i giorni recenti (ShopifyQL ha ~5-7 giorni di lag e
// restituisce 0 sulle settimane correnti). Va chiamato dentro withTenantContext.
export async function ordersInRange(start, end) {
  const sh = getShopify()
  const storeUrl = sh?.storeUrl, token = sh?.adminToken
  if (!storeUrl || !token) return null
  const gql = `query($q:String!,$cursor:String){orders(first:100,query:$q,after:$cursor,sortKey:CREATED_AT){edges{cursor node{currentTotalPriceSet{shopMoney{amount}}}}pageInfo{hasNextPage}}}`
  const q = `created_at:>=${start}T00:00:00Z created_at:<=${end}T23:59:59Z financial_status:paid`
  let cursor = null, pages = 0, orders = 0, fatturato = 0
  try {
    while (pages < 20) {
      const res = await fetch(`https://${storeUrl}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: gql, variables: { q, cursor } }),
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) break
      const j = await res.json()
      const conn = j.data?.orders
      const edges = conn?.edges || []
      for (const e of edges) { orders += 1; fatturato += parseFloat(e.node.currentTotalPriceSet?.shopMoney?.amount || 0) }
      pages++
      if (!conn?.pageInfo?.hasNextPage) break
      cursor = edges[edges.length - 1]?.cursor
      if (!cursor) break
    }
    return { orders, fatturato: Math.round(fatturato) }
  } catch { return null }
}

// Statistiche "questa settimana" (lun→oggi) e "scorsa settimana" (lun→dom).
export async function weekStats() {
  const mon = off => { const x = new Date(); const dd = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - dd - off * 7); return x.toISOString().slice(0, 10) }
  const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
  const thisMon = mon(0), lastMon = mon(1)
  const today = new Date().toISOString().slice(0, 10)
  const lastSun = addDays(lastMon, 6)
  const [thisWeek, lastWeek] = await Promise.all([ordersInRange(thisMon, today), ordersInRange(lastMon, lastSun)])
  return { thisWeek: thisWeek && { ...thisWeek, from: thisMon, to: today }, lastWeek: lastWeek && { ...lastWeek, from: lastMon, to: lastSun } }
}
