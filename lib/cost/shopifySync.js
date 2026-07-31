// Funzioni condivise per il modulo Costi prodotto: lettura varianti+costo Shopify
// e sync automatico dei cambi di costo Shopify nello storico (product_landed_cost).
// Usate dalla route /api/product-costs-landed (sync on-load) e dal cron
// /api/cron/sync-costs (sync in background per tutti i tenant).

// Tutte le varianti attive (no gift card/digitali) con costo Shopify (unitCost).
export async function fetchVariantsForCost(store, token) {
  const products = []
  let cursor = null, currency = 'EUR'
  for (let p = 0; p < 30; p++) {
    const after = cursor ? `, after: "${cursor}"` : ''
    const res = await fetch(`https://${store}/admin/api/2024-04/graphql.json`, {
      method: 'POST', headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ query: `{
        products(first: 100${after}, query: "status:active") {
          pageInfo { hasNextPage endCursor }
          edges { node {
            legacyResourceId title isGiftCard featuredImage { url }
            variants(first: 100) { edges { node {
              legacyResourceId title sku
              inventoryItem { unitCost { amount currencyCode } requiresShipping }
            }}}
          }}
        }
      }` }),
    })
    if (!res.ok) break
    const json = await res.json()
    const conn = json?.data?.products
    for (const { node: pr } of (conn?.edges || [])) {
      if (pr.isGiftCard) continue
      const variants = []
      for (const { node: v } of (pr.variants?.edges || [])) {
        if (v.inventoryItem?.requiresShipping === false) continue
        if (v.inventoryItem?.unitCost?.currencyCode) currency = v.inventoryItem.unitCost.currencyCode
        variants.push({
          variant_id: String(v.legacyResourceId),
          sku: v.sku || '',
          size: v.title && v.title !== 'Default Title' ? v.title : 'Taglia unica',
          shopifyCost: v.inventoryItem?.unitCost?.amount != null ? parseFloat(v.inventoryItem.unitCost.amount) : null,
        })
      }
      if (variants.length) products.push({ productId: String(pr.legacyResourceId), title: pr.title, image: pr.featuredImage?.url || null, variants })
    }
    if (!conn?.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
  }
  return { products, currency }
}

// Rileva i cambi di costo Shopify e li registra nello storico (note='shopify').
// Prima volta = baseline silenziosa. Ritorna Map variant_id -> nuovo costo per
// le variazioni rilevate.
export async function syncShopifyCosts(admin, workspaceId, products) {
  const changed = new Map()
  if (!admin || !workspaceId) return changed
  try {
    const current = new Map()
    for (const p of products) for (const v of p.variants) if (v.shopifyCost != null) current.set(v.variant_id, { cost: v.shopifyCost, product_id: p.productId, sku: v.sku })
    if (!current.size) return changed

    const { data: seenRows } = await admin.from('variant_cost_seen').select('variant_id, shopify_cost').eq('workspace_id', workspaceId)
    const seen = new Map((seenRows || []).map(r => [String(r.variant_id), r.shopify_cost == null ? null : Number(r.shopify_cost)]))

    const today = new Date().toISOString().slice(0, 10)
    const histInserts = []
    const seenUpserts = []
    for (const [vid, info] of current) {
      const prev = seen.get(vid)
      if (prev === undefined) {
        seenUpserts.push({ workspace_id: workspaceId, variant_id: vid, shopify_cost: info.cost, synced_at: new Date().toISOString() })
      } else if (prev == null || Math.abs(prev - info.cost) > 0.005) {
        histInserts.push({ workspace_id: workspaceId, variant_id: vid, product_id: info.product_id, sku: info.sku, landed_cost: info.cost, effective_from: today, note: 'shopify' })
        seenUpserts.push({ workspace_id: workspaceId, variant_id: vid, shopify_cost: info.cost, synced_at: new Date().toISOString() })
        changed.set(vid, info.cost)
      }
    }
    if (histInserts.length) await admin.from('product_landed_cost').insert(histInserts)
    if (seenUpserts.length) await admin.from('variant_cost_seen').upsert(seenUpserts, { onConflict: 'workspace_id,variant_id' })
  } catch {}
  return changed
}
