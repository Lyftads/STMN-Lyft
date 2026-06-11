// ============================================================================
//  Sync incrementale Shopify → wh_orders. Riusa il pattern Admin GraphQL già
//  validato (net-resi, customer.numberOfOrders per NC/RC). Watermark su
//  updated_at: ad ogni run prende solo gli ordini modificati dopo il cursore.
//  Idempotente (upsert su tenant_id+order_id). Va chiamato dentro
//  withTenantContext (per getShopify) — vedi app/api/warehouse/sync/route.js.
// ============================================================================

const gidNum = (g) => { const n = Number(String(g || '').split('/').pop()); return Number.isFinite(n) ? n : null }

// since = ISO string watermark (updated_at). Se assente → backfill 90 giorni.
export async function syncShopifyOrders({ admin, tenantId, shopify, since, maxPages = 60 }) {
  const storeUrl = shopify?.storeUrl, token = shopify?.adminToken
  if (!admin || !tenantId || !storeUrl || !token) return { ok: false, reason: 'missing_creds' }

  const watermark = since || new Date(Date.now() - 90 * 86400000).toISOString()
  const gql = `query($q:String!,$cursor:String){orders(first:100,query:$q,after:$cursor,sortKey:UPDATED_AT){edges{cursor node{id createdAt processedAt updatedAt displayFinancialStatus currencyCode currentTotalPriceSet{shopMoney{amount}} totalRefundedSet{shopMoney{amount}} customer{id numberOfOrders}}}pageInfo{hasNextPage}}}`
  const q = `updated_at:>=${watermark}`

  let cursor = null, pages = 0, total = 0, maxUpdated = watermark
  const batch = []
  const flush = async () => {
    if (!batch.length) return
    const rows = batch.splice(0, batch.length)
    const { error } = await admin.from('wh_orders').upsert(rows, { onConflict: 'tenant_id,order_id' })
    if (error) throw new Error('upsert wh_orders: ' + error.message)
  }

  while (pages < maxPages) {
    const res = await fetch(`https://${storeUrl}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gql, variables: { q, cursor } }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error('shopify ' + res.status)
    const j = await res.json()
    const conn = j.data?.orders
    const edges = conn?.edges || []
    for (const e of edges) {
      const node = e.node || {}
      const orderId = gidNum(node.id)
      if (!orderId) continue
      const totalPrice = parseFloat(node.currentTotalPriceSet?.shopMoney?.amount || 0)
      const refunded = Math.abs(parseFloat(node.totalRefundedSet?.shopMoney?.amount || 0))
      const ordersCount = Number(node.customer?.numberOfOrders || 0)
      const status = node.displayFinancialStatus || null
      if (node.updatedAt && node.updatedAt > maxUpdated) maxUpdated = node.updatedAt
      batch.push({
        tenant_id: tenantId,
        order_id: orderId,
        created_at: node.createdAt,
        processed_at: node.processedAt || null,
        updated_at_src: node.updatedAt || null,
        currency: node.currencyCode || null,
        total_price: totalPrice,
        total_refunded: refunded,
        financial_status: status,
        fully_refunded: status === 'REFUNDED',
        customer_id: gidNum(node.customer?.id),
        customer_orders_count: ordersCount || null,
        is_new_customer: ordersCount > 0 ? ordersCount <= 1 : null,
      })
      total++
    }
    if (batch.length >= 500) await flush()
    pages++
    if (!conn?.pageInfo?.hasNextPage) break
    cursor = edges[edges.length - 1]?.cursor
    if (!cursor) break
  }
  await flush()
  return { ok: true, rows: total, cursor: maxUpdated }
}
