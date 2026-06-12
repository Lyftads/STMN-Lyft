export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getMeta } from '../../../lib/tenant/credentials'
import { resolveWorkspace } from '../../../lib/team/workspace'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { fetchAllCampaignSpend } from '../../../lib/ads/campaignSpend'
import { fetchGoogleProductCost, buildShopifyMaps, deriveMetaProducts } from '../../../lib/ads/campaignProducts'
import { loadLatestLanded } from '../../../lib/cost/landed'

// ── Performance prodotti (B2C) ──
// P&L per prodotto: ricavo netto, COGS, ADS (Meta+Google allocati in proporzione
// al ricavo), margine operativo, ROAS e Δ vs periodo precedente. Read-only.

const CACHE_TTL = 5 * 60 * 1000
const __cache = new Map()

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const isoDay = (d) => d.toISOString().slice(0, 10)

// ── Shopify: ordini con line items nel range ──
async function fetchOrders(store, token, sinceISO, untilISO) {
  const byProduct = new Map() // productId -> { units, revenue, cogsUnits:Map(variantId->qty) }
  let url = `https://${store}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${encodeURIComponent(sinceISO)}&created_at_max=${encodeURIComponent(untilISO)}&limit=250&fields=id,created_at,line_items`
  for (let page = 0; page < 120 && url; page++) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': token }, cache: 'no-store' })
    if (!res.ok) break
    const data = await res.json()
    for (const o of (data.orders || [])) {
      for (const li of (o.line_items || [])) {
        if (li.gift_card) continue // escludi gift card dal P&L prodotto
        const pid = li.product_id != null ? String(li.product_id) : null
        if (!pid) continue
        const qty = num(li.quantity)
        const rev = num(li.price) * qty - num(li.total_discount)
        if (!byProduct.has(pid)) byProduct.set(pid, { productId: pid, title: li.title || '', units: 0, revenue: 0, variantQty: new Map() })
        const p = byProduct.get(pid)
        p.units += qty
        p.revenue += rev
        if (li.variant_id != null) { const vid = String(li.variant_id); p.variantQty.set(vid, (p.variantQty.get(vid) || 0) + qty) }
      }
    }
    const link = res.headers.get('Link') || res.headers.get('link')
    const m = link && link.includes('rel="next"') ? link.match(/<([^>]+)>;\s*rel="next"/) : null
    url = m ? m[1] : null
  }
  return byProduct
}

// ── Shopify: mappa prodotto/variante → costo (COGS), immagine, titolo ──
async function fetchProductMeta(store, token) {
  const costByVariant = new Map()
  const meta = new Map() // productId -> { title, image }
  const catalog = []     // [{id, handle, variants:[{variant_id, sku}]}] per il matching ADS
  let cursor = null
  for (let page = 0; page < 30; page++) {
    const after = cursor ? `, after: "${cursor}"` : ''
    const res = await fetch(`https://${store}/admin/api/2024-04/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ query: `{
        products(first: 100${after}, query: "status:active") {
          pageInfo { hasNextPage endCursor }
          edges { node {
            legacyResourceId title handle isGiftCard featuredImage { url }
            variants(first: 100) { edges { node { legacyResourceId sku inventoryItem { unitCost { amount } requiresShipping } } } }
          }}
        }
      }` }),
    })
    if (!res.ok) break
    const json = await res.json()
    const conn = json?.data?.products
    for (const { node: p } of (conn?.edges || [])) {
      if (p.isGiftCard) continue
      const pid = String(p.legacyResourceId)
      meta.set(pid, { title: p.title, image: p.featuredImage?.url || null })
      const variants = []
      for (const { node: v } of (p.variants?.edges || [])) {
        if (v.inventoryItem?.requiresShipping === false) continue
        variants.push({ variant_id: String(v.legacyResourceId), sku: v.sku || '' })
        const c = v.inventoryItem?.unitCost?.amount
        if (c != null) costByVariant.set(String(v.legacyResourceId), parseFloat(c))
      }
      catalog.push({ id: pid, handle: p.handle, variants })
    }
    if (!conn?.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
  }
  return { costByVariant, meta, catalog }
}

// ── Mappatura campagna → prodotto (Supabase) ──
async function loadMapping(workspaceId) {
  const admin = getAdminSupabase()
  if (!admin || !workspaceId) return new Map()
  try {
    const { data } = await admin.from('campaign_product_map').select('platform,campaign_id,product_id,products').eq('workspace_id', workspaceId)
    const m = new Map()
    for (const r of (data || [])) {
      const ids = Array.isArray(r.products) && r.products.length
        ? r.products.map(p => String(p.id)).filter(Boolean)
        : (r.product_id ? [String(r.product_id)] : [])
      m.set(`${r.platform}:${r.campaign_id}`, ids)
    }
    return m
  } catch { return new Map() }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { storeUrl: store, adminToken: token } = getShopify()
    if (!store || !token) return NextResponse.json({ ok: false, error: 'Shopify non configurato' }, { status: 400 })

    const sp = new URL(req.url).searchParams
    const until = sp.get('until') || isoDay(new Date())
    const since = sp.get('since') || isoDay(new Date(Date.now() - 90 * 86400000))
    const force = sp.get('refresh') === '1'
    const cacheKey = `${store}:${since}:${until}`
    const hit = __cache.get(cacheKey)
    if (!force && hit && hit.exp > Date.now()) return NextResponse.json({ ...hit.data, cached: true })

    // periodo precedente di pari durata
    const days = Math.max(1, Math.round((new Date(until) - new Date(since)) / 86400000) + 1)
    const prevUntil = isoDay(new Date(new Date(since).getTime() - 86400000))
    const prevSince = isoDay(new Date(new Date(since).getTime() - days * 86400000))

    try {
      const ws = await resolveWorkspace()
      const [cur, prev, pmeta, campaigns, mapping, landed] = await Promise.all([
        fetchOrders(store, token, since + 'T00:00:00Z', until + 'T23:59:59Z'),
        fetchOrders(store, token, prevSince + 'T00:00:00Z', prevUntil + 'T23:59:59Z'),
        fetchProductMeta(store, token),
        fetchAllCampaignSpend(since, until),
        loadMapping(ws?.workspaceId),
        loadLatestLanded(ws?.workspaceId),
      ])
      // COGS: override col costo landed manuale dove presente (modulo Costi prodotto)
      if (landed.size) for (const [vid, c] of landed) pmeta.costByVariant.set(vid, c)

      // ── Attribuzione ADS ──
      // META: spesa per campagna mappata → prodotto (preciso); non mappate → proporzionale.
      // GOOGLE: costo ESATTO per prodotto da shopping_performance_view (Shopping/PMax);
      //         la spesa Google non-prodotto (Search) resta proporzionale.
      const shopMaps = buildShopifyMaps(pmeta.catalog)
      const meta = getMeta()
      const metaAccounts = String(meta.adAccountId || '').split(',').map(s => s.trim()).filter(Boolean).map(a => a.startsWith('act_') ? a : `act_${a}`)
      const [googleProduct, metaDerived] = await Promise.all([
        fetchGoogleProductCost(since, until, shopMaps).catch(() => ({ byProduct: new Map(), total: 0 })),
        meta.accessToken ? deriveMetaProducts({ token: meta.accessToken, accounts: metaAccounts, products: pmeta.catalog }).catch(() => new Map()) : Promise.resolve(new Map()),
      ])

      let metaSpend = 0, googleSpend = 0, unmappedSpend = 0
      const mappedByProduct = new Map()
      for (const c of campaigns) {
        if (c.platform === 'google') { googleSpend += c.spend; continue } // Google gestito per prodotto sotto
        metaSpend += c.spend
        // Priorità: mappatura salvata; poi auto-derivata (catalogo/diretta); poi proporzionale
        let ids = mapping.get(`meta:${c.campaign_id}`) || []
        if (!ids.length) { const der = metaDerived.get(String(c.campaign_id)); if (der?.productIds?.size) ids = [...der.productIds] }
        if (!ids.length) { unmappedSpend += c.spend; continue }
        let sumRev = 0
        for (const id of ids) sumRev += (cur.get(id)?.revenue || 0)
        for (const id of ids) {
          const share = sumRev > 0 ? c.spend * ((cur.get(id)?.revenue || 0) / sumRev) : c.spend / ids.length
          mappedByProduct.set(id, (mappedByProduct.get(id) || 0) + share)
        }
      }
      // Google: costo ESATTO per prodotto abbinato; tutto il resto Google (Search +
      // shopping non abbinato) → pool proporzionale (così nessuna spesa si perde).
      let googleMatched = 0
      for (const [pid, cost] of googleProduct.byProduct) { mappedByProduct.set(pid, (mappedByProduct.get(pid) || 0) + cost); googleMatched += cost }
      unmappedSpend += Math.max(0, googleSpend - googleMatched)

      const adsTotal = metaSpend + googleSpend
      const mappedSpend = adsTotal - unmappedSpend
      const totalRevenue = [...cur.values()].reduce((s, p) => s + p.revenue, 0)

      let costCovered = 0, costTotal = 0
      const products = [...cur.values()].map(p => {
        const m = pmeta.meta.get(p.productId) || {}
        let cogs = 0, hasCost = false
        for (const [vid, qty] of p.variantQty) {
          const c = pmeta.costByVariant.get(vid)
          if (c != null) { cogs += c * qty; hasCost = true }
        }
        costTotal++; if (hasCost) costCovered++
        const mapped = mappedByProduct.get(p.productId) || 0
        const allocAds = mapped + (totalRevenue > 0 ? unmappedSpend * (p.revenue / totalRevenue) : 0)
        const marginOp = p.revenue - cogs - allocAds
        const prevRev = prev.get(p.productId)?.revenue || 0
        const deltaNet = prevRev > 0 ? ((p.revenue - prevRev) / prevRev) * 100 : null
        return {
          productId: p.productId,
          title: m.title || p.title || '—',
          image: m.image || null,
          units: p.units,
          netRevenue: Math.round(p.revenue * 100) / 100,
          cogs: Math.round(cogs * 100) / 100,
          ads: Math.round(allocAds * 100) / 100,
          marginOp: Math.round(marginOp * 100) / 100,
          marginPct: p.revenue > 0 ? Math.round((marginOp / p.revenue) * 1000) / 10 : 0,
          roas: allocAds > 0 ? Math.round((p.revenue / allocAds) * 100) / 100 : null,
          deltaNet: deltaNet != null ? Math.round(deltaNet * 10) / 10 : null,
          hasCost,
          adsExact: mapped > 0,
        }
      })

      const data = {
        ok: true,
        range: { since, until }, prevRange: { since: prevSince, until: prevUntil },
        currency: 'EUR',
        updatedAt: new Date().toISOString(),
        totals: {
          netRevenue: Math.round(totalRevenue * 100) / 100,
          ads: Math.round(adsTotal * 100) / 100,
          metaSpend: Math.round(metaSpend * 100) / 100,
          googleSpend: Math.round(googleSpend * 100) / 100,
          marginOp: Math.round(products.reduce((s, p) => s + p.marginOp, 0) * 100) / 100,
          units: products.reduce((s, p) => s + p.units, 0),
          roas: adsTotal > 0 ? Math.round((totalRevenue / adsTotal) * 100) / 100 : null,
          costCoverage: costTotal ? Math.round((costCovered / costTotal) * 100) : 0,
          adsMappedPct: adsTotal > 0 ? Math.round((mappedSpend / adsTotal) * 100) : 0,
        },
        products,
      }
      __cache.set(cacheKey, { exp: Date.now() + CACHE_TTL, data })
      return NextResponse.json(data)
    } catch (e) {
      return NextResponse.json({ ok: false, error: e.message || 'Errore performance prodotti' }, { status: 500 })
    }
  })
}
