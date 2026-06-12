export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getGoogle } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'
import { buildShopifyMaps, matchExternalId } from '../../../lib/ads/campaignProducts'

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const isoDay = (d) => d.toISOString().slice(0, 10)

// Cache in memoria per tenant (customerId) + range: alla riapertura della tab
// non si rifanno le chiamate API. TTL lungo; bypass con ?refresh=1.
const CACHE_TTL = 60 * 60 * 1000 // 1 ora
const __cache = new Map() // key -> { exp, data }

// Catalogo Shopify leggero (id, titolo, immagine, handle, varianti) per abbinare
// l'ID articolo Google (shopify_it_<id>) e mostrare immagine/titolo coerenti.
async function fetchShopifyCatalog(store, token) {
  if (!store || !token) return []
  const out = []
  let cursor = null
  for (let p = 0; p < 30; p++) {
    const after = cursor ? `, after: "${cursor}"` : ''
    const res = await fetch(`https://${store}/admin/api/2024-04/graphql.json`, {
      method: 'POST', headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ query: `{ products(first: 200${after}, query: "status:active") { pageInfo { hasNextPage endCursor } edges { node { legacyResourceId title handle featuredImage { url } variants(first: 100) { edges { node { legacyResourceId sku } } } } } } }` }),
    })
    if (!res.ok) break
    const json = await res.json()
    const conn = json?.data?.products
    for (const { node: n } of (conn?.edges || [])) {
      out.push({ id: String(n.legacyResourceId), title: n.title, image: n.featuredImage?.url || null, handle: n.handle, variants: (n.variants?.edges || []).map(({ node: v }) => ({ variant_id: String(v.legacyResourceId), sku: v.sku || '' })) })
    }
    if (!conn?.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
  }
  return out
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const g = getGoogle()
    const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    const customerId = (g.adsCustomerId || '').replace(/-/g, '')
    const mcc = (g.adsMccId || '').replace(/-/g, '')
    if (!devToken || !customerId || !g.refreshToken || !g.clientId || !g.clientSecret) {
      return NextResponse.json({ ok: false, error: 'Google Ads non configurato', configured: false }, { status: 400 })
    }
    const sp = new URL(req.url).searchParams
    const until = sp.get('until') || isoDay(new Date())
    const since = sp.get('since') || isoDay(new Date(Date.now() - 30 * 86400000))

    return swrSnapshot(req, { tab: 'googleProducts', compute: async () => {
    try {
      const tok = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: g.clientId, client_secret: g.clientSecret, refresh_token: g.refreshToken, grant_type: 'refresh_token' }),
      }).then(r => r.json())
      if (!tok.access_token) throw new Error('OAuth Google fallito')
      const headers = { Authorization: `Bearer ${tok.access_token}`, 'developer-token': devToken, 'Content-Type': 'application/json' }
      if (mcc) headers['login-customer-id'] = mcc

      const query = `SELECT segments.product_item_id, segments.product_title, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM shopping_performance_view WHERE segments.date BETWEEN '${since}' AND '${until}'`
      const res = await fetch(`https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`, {
        method: 'POST', headers, cache: 'no-store', body: JSON.stringify({ query }),
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Google Ads ${res.status}: ${txt.slice(0, 200)}`)
      }
      const arr = await res.json()

      // aggrega per item id
      const agg = new Map()
      for (const chunk of (Array.isArray(arr) ? arr : [])) for (const row of (chunk.results || [])) {
        const seg = row.segments || {}, m = row.metrics || {}
        const id = String(seg.productItemId ?? seg.product_item_id ?? '')
        if (!id) continue
        const prev = agg.get(id) || { itemId: id, title: seg.productTitle ?? seg.product_title ?? '', clicks: 0, impressions: 0, cost: 0, conversions: 0, convValue: 0 }
        prev.clicks += num(m.clicks)
        prev.impressions += num(m.impressions)
        prev.cost += num(m.costMicros ?? m.cost_micros) / 1e6
        prev.conversions += num(m.conversions)
        prev.convValue += num(m.conversionsValue ?? m.conversions_value)
        agg.set(id, prev)
      }

      // abbina a Shopify per immagine/titolo
      const { storeUrl: store, adminToken: stoken } = getShopify()
      const catalog = await fetchShopifyCatalog(store, stoken).catch(() => [])
      const maps = buildShopifyMaps(catalog)
      const imgById = new Map(catalog.map(p => [p.id, p.image]))
      const titleById = new Map(catalog.map(p => [p.id, p.title]))

      const rows = [...agg.values()].map(r => {
        const pid = matchExternalId(r.itemId, maps)
        return {
          itemId: r.itemId,
          productId: pid,
          title: (pid && titleById.get(pid)) || r.title || r.itemId,
          image: pid ? imgById.get(pid) || null : null,
          clicks: r.clicks,
          impressions: r.impressions,
          cost: Math.round(r.cost * 100) / 100,
          conversions: Math.round(r.conversions * 100) / 100,
          convValue: Math.round(r.convValue * 100) / 100,
          ctr: r.impressions > 0 ? Math.round((r.clicks / r.impressions) * 10000) / 100 : 0,
          cpc: r.clicks > 0 ? Math.round((r.cost / r.clicks) * 100) / 100 : 0,
          costPerConv: r.conversions > 0 ? Math.round((r.cost / r.conversions) * 100) / 100 : null,
          roas: r.cost > 0 ? Math.round((r.convValue / r.cost) * 100) / 100 : null,
        }
      }).sort((a, b) => b.cost - a.cost)

      const totals = rows.reduce((a, r) => { a.clicks += r.clicks; a.impressions += r.impressions; a.cost += r.cost; a.conversions += r.conversions; a.convValue += r.convValue; return a }, { clicks: 0, impressions: 0, cost: 0, conversions: 0, convValue: 0 })
      totals.roas = totals.cost > 0 ? Math.round((totals.convValue / totals.cost) * 100) / 100 : null
      totals.products = rows.length
      for (const k of ['cost', 'convValue', 'conversions']) totals[k] = Math.round(totals[k] * 100) / 100

      const payload = { ok: true, currency: 'EUR', range: { since, until }, rows, totals, updatedAt: new Date().toISOString() }
      return payload
    } catch (e) {
      return { __noCache: true, ok: false, error: e.message || 'Errore Google Products' }
    }
    } })
  })
}
