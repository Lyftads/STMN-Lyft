export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'
import { resolveWorkspace } from '../../../lib/team/workspace'
import { loadLatestLanded } from '../../../lib/cost/landed'
import { getSnapshot, setSnapshot } from '../../../lib/cache/snapshot'

const SNAP_TTL = 30 * 60 * 1000 // 30 min (cache L2 condivisa)

// ── Inventario intelligence (read-only) ──
// Unità operativa = variante (taglia/SKU): un prodotto può avere stock alto e
// una sola taglia critica. Stock + COGS da Shopify; velocità di vendita dagli
// ordini (pesata sul recente). Calcola giorni-a-stockout, broken sizes (OOS con
// vendite recenti) e vendite perse in €. Niente input manuali, niente riordino.

const PERIOD_DAYS = 30
const RECENT_DAYS = 7

// Cache leggera per non ri-colpire Shopify a ogni apertura tab (per store).
const CACHE_TTL = 5 * 60 * 1000
const __cache = new Map() // store -> { exp, data }

function gqlEscape(s) { return String(s).replace(/"/g, '\\"') }

async function shopifyGql(store, token, query) {
  const res = await fetch(`https://${store}/admin/api/2024-04/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Shopify GraphQL ${res.status}`)
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0]?.message || 'Shopify GraphQL error')
  return json
}

// Tutti i prodotti attivi con TUTTE le varianti (stock, sku, costo, prezzo).
async function fetchAllVariants(store, token) {
  const out = []
  let cursor = null
  let currency = 'EUR'
  for (let page = 0; page < 30; page++) {
    const after = cursor ? `, after: "${gqlEscape(cursor)}"` : ''
    const json = await shopifyGql(store, token, `{
      products(first: 100${after}, query: "status:active") {
        pageInfo { hasNextPage endCursor }
        edges { node {
          id title productType status isGiftCard
          featuredImage { url }
          variants(first: 100) { edges { node {
            legacyResourceId title sku inventoryQuantity price
            inventoryItem { unitCost { amount currencyCode } requiresShipping }
          }}}
        }}
      }
    }`)
    const conn = json?.data?.products
    const edges = conn?.edges || []
    for (const { node: p } of edges) {
      // Solo prodotti ATTIVI: escludi bozze e archiviati (oltre al filtro query).
      if (p.status && p.status !== 'ACTIVE') continue
      // Escludi gift card e prodotti digitali/servizi (niente inventario fisico).
      if (p.isGiftCard) continue
      const image = p.featuredImage?.url || null
      for (const { node: v } of (p.variants?.edges || [])) {
        // Variante digitale/servizio (non richiede spedizione) → fuori inventario.
        if (v.inventoryItem?.requiresShipping === false) continue
        const cost = v.inventoryItem?.unitCost?.amount != null ? parseFloat(v.inventoryItem.unitCost.amount) : null
        if (v.inventoryItem?.unitCost?.currencyCode) currency = v.inventoryItem.unitCost.currencyCode
        out.push({
          productId: p.id,
          productTitle: p.title,
          productType: p.productType || '',
          image,
          variantId: String(v.legacyResourceId),
          size: v.title && v.title !== 'Default Title' ? v.title : 'Taglia unica',
          sku: v.sku || '',
          stock: Number.isFinite(v.inventoryQuantity) ? v.inventoryQuantity : 0,
          price: parseFloat(v.price || '0') || 0,
          cost,
        })
      }
    }
    if (!conn?.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
  }
  return { variants: out, currency }
}

// Pagina UNA finestra temporale di ordini (Link header) con retry sul rate
// limit; chiama onOrder per ogni ordine. Usata in parallelo su più finestre.
async function fetchOrdersWindow(store, token, sinceISO, untilISO, onOrder) {
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  let url = `https://${store}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${encodeURIComponent(sinceISO)}&created_at_max=${encodeURIComponent(untilISO)}&limit=250&fields=id,created_at,line_items`
  for (let page = 0; page < 40 && url; page++) {
    let res = null
    for (let a = 0; a < 5; a++) {
      res = await fetch(url, { headers: { 'X-Shopify-Access-Token': token }, cache: 'no-store' })
      if (res.status === 429 || res.status === 430 || res.status >= 500) { await sleep((Number(res.headers.get('Retry-After')) || 1.5) * 1000); continue }
      break
    }
    if (!res || !res.ok) break
    const data = await res.json().catch(() => null)
    for (const o of (data?.orders || [])) onOrder(o)
    const link = res.headers.get('Link') || res.headers.get('link') || ''
    const m = /<([^>]+)>;\s*rel="next"/.exec(link)
    url = m ? m[1] : null
  }
}

// Quantità vendute per variante negli ultimi PERIOD_DAYS giorni (+ finestra recente).
// La finestra è divisa in blocchi scaricati IN PARALLELO (le pagine di un singolo
// blocco restano sequenziali, ma i blocchi no) → caricamento a freddo ~3× più veloce.
async function fetchSales(store, token) {
  const now = Date.now()
  const recentCutoff = now - RECENT_DAYS * 86400000

  const sold30 = new Map() // variantId -> qty
  const sold7 = new Map()
  const sold30Sku = new Map() // fallback per sku quando manca variant_id

  const onOrder = (o) => {
    const recent = new Date(o.created_at).getTime() >= recentCutoff
    for (const li of (o.line_items || [])) {
      const qty = Number(li.quantity) || 0
      if (!qty) continue
      const vid = li.variant_id != null ? String(li.variant_id) : null
      if (vid) {
        sold30.set(vid, (sold30.get(vid) || 0) + qty)
        if (recent) sold7.set(vid, (sold7.get(vid) || 0) + qty)
      }
      if (li.sku) sold30Sku.set(li.sku, (sold30Sku.get(li.sku) || 0) + qty)
    }
  }

  // Blocchi contigui non sovrapposti che coprono [now-PERIOD_DAYS, now].
  const CHUNKS = 3
  const spanMs = (PERIOD_DAYS / CHUNKS) * 86400000
  const bounds = []
  for (let i = 0; i <= CHUNKS; i++) bounds.push(now - i * spanMs)
  const windows = []
  for (let i = 0; i < CHUNKS; i++) {
    const maxMs = bounds[i]
    const minMs = (i === CHUNKS - 1) ? bounds[CHUNKS] : bounds[i + 1] + 1 // +1ms = niente doppio conteggio al bordo
    windows.push([new Date(minMs).toISOString(), new Date(maxMs).toISOString()])
  }
  await Promise.all(windows.map(([s, u]) => fetchOrdersWindow(store, token, s, u, onOrder)))
  return { sold30, sold7, sold30Sku }
}

function addDaysISO(days) {
  const d = new Date()
  d.setDate(d.getDate() + Math.round(days))
  return d.toISOString().slice(0, 10)
}

async function buildInventory(store, token, landedMap) {
  const [{ variants, currency }, sales] = await Promise.all([
    fetchAllVariants(store, token),
    fetchSales(store, token),
  ])
  // COGS: override col costo landed manuale dove presente (vedi modulo Costi prodotto)
  if (landedMap && landedMap.size) for (const v of variants) if (landedMap.has(v.variantId)) v.cost = landedMap.get(v.variantId)

  let costCovered = 0
  const items = variants.map(v => {
    const sold30 = sales.sold30.get(v.variantId) || sales.sold30Sku.get(v.sku) || 0
    const sold7 = sales.sold7.get(v.variantId) || 0
    const rate30 = sold30 / PERIOD_DAYS
    const rate7 = sold7 / RECENT_DAYS
    // Velocità pesata sul recente: cattura accelerazioni/decelerazioni senza
    // bisogno dello storico di stock (limite noto: niente correzione per i
    // giorni in cui la taglia era già esaurita).
    const velocity = sold7 > 0 ? 0.6 * rate7 + 0.4 * rate30 : rate30

    const stock = v.stock
    const oos = stock <= 0
    if (v.cost != null) costCovered++

    const daysToStockout = oos ? 0 : (velocity > 0 ? stock / velocity : null)
    const stockoutDate = !oos && daysToStockout != null ? addDaysISO(daysToStockout) : null

    const value = v.cost != null ? Math.max(stock, 0) * v.cost : null
    const brokenSize = oos && sold30 > 0
    const lostRevPerDay = brokenSize ? rate30 * v.price : 0

    let risk = 'ok'
    if (brokenSize) risk = 'oos_sales'
    else if (oos) risk = 'oos'
    else if (daysToStockout != null && daysToStockout <= 7) risk = 'le7'
    else if (daysToStockout != null && daysToStockout <= 30) risk = 'le30'

    // Priorità commerciale: € a rischio, non solo giorni.
    let priorityScore = 0
    if (brokenSize) priorityScore = lostRevPerDay * 7
    else if (risk === 'le7' || risk === 'le30') priorityScore = velocity * v.price * (30 / Math.max(daysToStockout, 0.5))

    return {
      ...v,
      sold30, velocity: Math.round(velocity * 100) / 100,
      daysToStockout: daysToStockout != null ? Math.round(daysToStockout) : null,
      stockoutDate, value, oos, brokenSize, lostRevPerDay, risk, priorityScore,
    }
  })

  const inStockAtRisk = items.filter(i => i.risk === 'le7' || i.risk === 'le30')
  const kpis = {
    inventoryValueCogs: items.reduce((s, i) => s + (i.value || 0), 0),
    qtyOnHand: items.reduce((s, i) => s + Math.max(i.stock, 0), 0),
    countLe7: items.filter(i => i.risk === 'le7').length,
    countLe30: items.filter(i => i.risk === 'le7' || i.risk === 'le30').length,
    brokenCount: items.filter(i => i.brokenSize).length,
    lostRevenueWeek: items.reduce((s, i) => s + i.lostRevPerDay, 0) * 7,
    variantCount: items.length,
    productCount: new Set(items.map(i => i.productId)).size,
    costCoverage: items.length ? Math.round((costCovered / items.length) * 100) : 0,
  }

  return {
    ok: true,
    currency,
    periodDays: PERIOD_DAYS,
    updatedAt: new Date().toISOString(),
    kpis,
    items,
  }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { storeUrl: store, adminToken: token } = getShopify()
    if (!store || !token) {
      return NextResponse.json({ ok: false, error: 'Shopify non configurato' }, { status: 400 })
    }
    const url = new URL(req.url)
    const force = url.searchParams.get('refresh') === '1'
    const ws = await resolveWorkspace()
    const cached = __cache.get(store)
    if (!force && cached && cached.exp > Date.now()) {
      return NextResponse.json({ ...cached.data, cached: true })
    }
    // L2 (Supabase, cross-lambda): prima apertura veloce se già calcolato altrove
    if (!force) {
      const snap = await getSnapshot(ws?.workspaceId, 'inventory', SNAP_TTL)
      if (snap) { __cache.set(store, { exp: Date.now() + CACHE_TTL, data: snap }); return NextResponse.json({ ...snap, cached: true }) }
    }
    try {
      const landedMap = await loadLatestLanded(ws?.workspaceId)
      const data = await buildInventory(store, token, landedMap)
      __cache.set(store, { exp: Date.now() + CACHE_TTL, data })
      await setSnapshot(ws?.workspaceId, 'inventory', data)
      return NextResponse.json(data)
    } catch (e) {
      return NextResponse.json({ ok: false, error: e.message || 'Errore inventario' }, { status: 500 })
    }
  })
}
