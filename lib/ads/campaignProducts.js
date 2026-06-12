// Deriva in automatico i PRODOTTI di ogni campagna dai dati piattaforma:
//  - Meta: product set (DPA/Advantage+ catalogo) + link creatività (campagne dirette)
//  - Google: shopping_performance_view (Shopping / Performance Max)
// Poi abbina gli id esterni (retailer_id / product_item_id / handle) ai prodotti
// Shopify. Best-effort + cache + try/catch: se fallisce, il chiamante torna al
// match per nome. Va chiamata dentro withTenantContext (getGoogle legge il tenant).

import { getGoogle } from '../tenant/credentials'

const TTL = 10 * 60 * 1000
const __cache = new Map() // key -> { exp, data }

// ── Mappe di abbinamento Shopify ──
export function buildShopifyMaps(products) {
  const byVariant = new Map(), byProduct = new Set(), bySku = new Map(), byHandle = new Map()
  for (const p of products) {
    const pid = String(p.id)
    byProduct.add(pid)
    if (p.handle) byHandle.set(String(p.handle).toLowerCase(), pid)
    for (const v of (p.variants || [])) {
      if (v.variant_id) byVariant.set(String(v.variant_id), pid)
      if (v.sku) bySku.set(String(v.sku).toLowerCase(), pid)
    }
  }
  return { byVariant, byProduct, bySku, byHandle }
}

// id esterno (retailer_id Meta / product_item_id Google), spesso tipo
// "shopify_IT_<productId>_<variantId>" o lo SKU → product id Shopify.
export function matchExternalId(extId, maps) {
  if (extId == null) return null
  const s = String(extId).trim()
  if (!s) return null
  const sk = maps.bySku.get(s.toLowerCase()); if (sk) return sk
  const nums = s.match(/\d{6,}/g) || []
  for (let i = nums.length - 1; i >= 0; i--) { const pv = maps.byVariant.get(nums[i]); if (pv) return pv }
  for (const n of nums) { if (maps.byProduct.has(n)) return n }
  return null
}

// link di destinazione → /products/<handle> → product id Shopify
export function matchLink(link, maps) {
  const m = String(link || '').match(/\/products\/([a-z0-9_-]+)/i)
  if (m) { const pid = maps.byHandle.get(m[1].toLowerCase()); if (pid) return pid }
  return null
}

// ── Meta Graph minimale (fetch + paginazione), self-contained ──
async function metaGraphAll(token, path, params) {
  const url = new URL(`https://graph.facebook.com/v19.0/${path}`)
  for (const [k, v] of Object.entries(params || {})) if (v != null && v !== '') url.searchParams.set(k, v)
  url.searchParams.set('access_token', token)
  let next = url.toString()
  const rows = []
  for (let p = 0; p < 15 && next; p++) {
    const j = await fetch(next, { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
    if (j.error) break
    if (Array.isArray(j.data)) rows.push(...j.data)
    next = j.paging?.next || null
  }
  return rows
}

// ── Meta: per campagna { kind, productIds:Set<shopifyId> } ──
export async function fetchMetaCampaignProducts(token, accounts, maps) {
  const result = new Map()
  if (!token || !accounts?.length) return result
  for (const account of accounts) {
    try {
      // 1) catalogo: product_set_id per campagna (dagli adset)
      const setByCampaign = new Map()
      const adsets = await metaGraphAll(token, `${account}/adsets`, { fields: 'campaign_id,promoted_object{product_set_id}', limit: '500' })
      for (const a of adsets) {
        const psid = a.promoted_object?.product_set_id
        if (psid) { const c = String(a.campaign_id); if (!setByCampaign.has(c)) setByCampaign.set(c, new Set()); setByCampaign.get(c).add(String(psid)) }
      }
      // risolvi i product set → prodotti Shopify (dedup per set)
      const setCache = new Map()
      const resolveSet = async (psid) => {
        if (setCache.has(psid)) return setCache.get(psid)
        const prods = await metaGraphAll(token, `${psid}/products`, { fields: 'retailer_id', limit: '300' })
        const ids = new Set()
        for (const pr of prods) { const pid = matchExternalId(pr.retailer_id, maps); if (pid) ids.add(pid) }
        setCache.set(psid, ids); return ids
      }
      for (const [c, sets] of setByCampaign) {
        const ids = new Set()
        for (const psid of sets) for (const pid of await resolveSet(psid)) ids.add(pid)
        result.set(c, { kind: 'catalog', productIds: ids })
      }
      // 2) dirette: link delle creatività per le campagne SENZA product set
      try {
        const ads = await metaGraphAll(token, `${account}/ads`, { fields: 'campaign_id,creative{object_story_spec}', limit: '400' })
        for (const ad of ads) {
          const c = String(ad.campaign_id)
          if (result.get(c)?.kind === 'catalog') continue
          const oss = ad.creative?.object_story_spec || {}
          const link = oss.link_data?.link || oss.template_data?.link
          const pid = matchLink(link, maps)
          if (pid) { if (!result.has(c)) result.set(c, { kind: 'direct', productIds: new Set() }); result.get(c).productIds.add(pid) }
        }
      } catch {}
    } catch {}
  }
  return result
}

// ── Google: per campagna Set<shopifyId> (Shopping / Performance Max) ──
export async function fetchGoogleCampaignProducts(since, until, maps) {
  const out = new Map()
  const g = getGoogle()
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const customerId = (g.adsCustomerId || '').replace(/-/g, '')
  const mcc = (g.adsMccId || '').replace(/-/g, '')
  if (!devToken || !customerId || !g.refreshToken || !g.clientId || !g.clientSecret) return out
  try {
    const tok = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: g.clientId, client_secret: g.clientSecret, refresh_token: g.refreshToken, grant_type: 'refresh_token' }),
    }).then(r => r.json())
    if (!tok.access_token) return out
    const headers = { Authorization: `Bearer ${tok.access_token}`, 'developer-token': devToken, 'Content-Type': 'application/json' }
    if (mcc) headers['login-customer-id'] = mcc
    const res = await fetch(`https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ query: `SELECT campaign.id, segments.product_item_id FROM shopping_performance_view WHERE segments.date BETWEEN '${since}' AND '${until}'` }),
    })
    if (!res.ok) return out
    const arr = await res.json()
    for (const chunk of (Array.isArray(arr) ? arr : [])) for (const row of (chunk.results || [])) {
      const c = String(row.campaign?.id ?? '')
      const item = row.segments?.productItemId ?? row.segments?.product_item_id
      if (!c || item == null) continue
      const pid = matchExternalId(item, maps)
      if (pid) { if (!out.has(c)) out.set(c, new Set()); out.get(c).add(pid) }
    }
  } catch {}
  return out
}

// ── Orchestratore con cache: ritorna Map "platform:campaign_id" -> {kind, productIds:[]} ──
export async function deriveCampaignProducts({ token, accounts, since, until, products }) {
  const key = `${(accounts || []).join(',')}|${since}|${until}|${products.length}`
  const hit = __cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.data

  const maps = buildShopifyMaps(products)
  const [meta, google] = await Promise.all([
    fetchMetaCampaignProducts(token, accounts, maps).catch(() => new Map()),
    fetchGoogleCampaignProducts(since, until, maps).catch(() => new Map()),
  ])
  const titleById = new Map(products.map(p => [String(p.id), p.title]))
  const out = new Map()
  for (const [c, info] of meta) out.set(`meta:${c}`, { kind: info.kind, products: [...info.productIds].map(id => ({ id, title: titleById.get(id) || '' })) })
  for (const [c, ids] of google) out.set(`google:${c}`, { kind: 'shopping', products: [...ids].map(id => ({ id, title: titleById.get(id) || '' })) })

  __cache.set(key, { exp: Date.now() + TTL, data: out })
  return out
}
