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

// link di destinazione → /products/<handle> → product id Shopify.
// L'handle nel link è un FATTO (dove atterra chi clicca), non una deduzione come
// il nome campagna: per questo vince sul match-per-nome.
// Gestisce anche i wrapper di redirect (l.facebook.com/l.php?u=…) e le URL
// annidate in un parametro, dove l'handle vero sta nella query encodata.
export function matchLink(link, maps) {
  const raw = String(link || '')
  if (!raw) return null
  const candidati = [raw]
  try {
    const u = new URL(raw)
    for (const k of ['u', 'url', 'link', 'target', 'redirect']) {
      const v = u.searchParams.get(k)
      if (v && /^https?:\/\//i.test(v)) candidati.push(v)
    }
  } catch {}
  for (const c of candidati) {
    const m = c.match(/\/products\/([a-z0-9_-]+)/i)
    if (m) { const pid = maps.byHandle.get(m[1].toLowerCase()); if (pid) return pid }
  }
  return null
}

// Tutti i link di destinazione plausibili di un creative Meta.
// Due formati diversi: object_story_spec (inserzioni classiche, valore singolo) e
// asset_feed_spec (Advantage+/dinamiche, liste di varianti). Nelle liste di
// asset_feed_spec la chiave NON è `text` ma `website_url`: leggendo solo
// object_story_spec restano fuori le Advantage+, cioè la maggioranza degli account.
export function extractCreativeLinks(creative) {
  if (!creative) return []
  const oss = creative.object_story_spec || {}
  const afs = creative.asset_feed_spec || {}
  const link = oss.link_data || {}
  const video = oss.video_data || {}
  const tmpl = oss.template_data || {}
  const out = [
    link.link,
    link.call_to_action?.value?.link,
    video.call_to_action?.value?.link,
    tmpl.link,
  ]
  for (const v of (Array.isArray(afs.link_urls) ? afs.link_urls : [])) {
    if (!v) continue
    if (typeof v === 'string') out.push(v)
    else out.push(v.website_url || v.url || v.link || v.deeplink_url)
  }
  for (const c of (Array.isArray(link.child_attachments) ? link.child_attachments : [])) {
    if (c?.link) out.push(c.link)
  }
  return out.filter(v => typeof v === 'string' && v)
}

// ── Meta: prodotti dedotti dal LINK delle creatività, per le campagne indicate ──
// Query mirata (filtro su campaign.id) invece della scansione di tutto l'account:
// si paga solo per le campagne rimaste senza attribuzione, non per l'intero storico.
export async function fetchMetaLinkProducts(token, accounts, maps, campaignIds) {
  const out = new Map()
  const ids = [...new Set((campaignIds || []).map(String).filter(Boolean))]
  if (!token || !accounts?.length || !ids.length) return out
  for (const account of accounts) {
    // Meta limita la lunghezza del filtro: si va a blocchi.
    for (let i = 0; i < ids.length; i += 50) {
      const blocco = ids.slice(i, i + 50)
      try {
        const ads = await metaGraphAll(token, `${account}/ads`, {
          fields: 'campaign_id,creative{object_story_spec,asset_feed_spec}',
          filtering: JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: blocco }]),
          limit: '200',
        })
        for (const ad of ads) {
          const c = String(ad.campaign_id)
          for (const l of extractCreativeLinks(ad.creative)) {
            const pid = matchLink(l, maps)
            if (!pid) continue
            if (!out.has(c)) out.set(c, new Set())
            out.get(c).add(pid)
          }
        }
      } catch {}
    }
  }
  return out
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
// lite=true: solo catalogo (adset → product set), salta la query ads (link) che è
// pesante → usato in Performance prodotti per non rallentare il caricamento.
export async function fetchMetaCampaignProducts(token, accounts, maps, lite = false) {
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
      // (saltata in lite per velocità — è la query più pesante)
      if (lite) continue
      try {
        const ads = await metaGraphAll(token, `${account}/ads`, { fields: 'campaign_id,creative{object_story_spec,asset_feed_spec}', limit: '400' })
        for (const ad of ads) {
          const c = String(ad.campaign_id)
          if (result.get(c)?.kind === 'catalog') continue
          for (const l of extractCreativeLinks(ad.creative)) {
            const pid = matchLink(l, maps)
            if (!pid) continue
            if (!result.has(c)) result.set(c, { kind: 'direct', productIds: new Set() })
            result.get(c).productIds.add(pid)
          }
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

// Versione cache-ata della derivazione Meta (per usarla anche in Performance
// prodotti senza ri-colpire Meta a ogni caricamento). Map campaign_id -> {kind, productIds:Set}.
export async function deriveMetaProducts({ token, accounts, products, lite = true }) {
  if (!token || !accounts?.length) return new Map()
  const key = `metaprod|${lite ? 'lite' : 'full'}|${accounts.join(',')}|${products.length}`
  const hit = __cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.data
  const maps = buildShopifyMaps(products)
  const data = await fetchMetaCampaignProducts(token, accounts, maps, lite).catch(() => new Map())
  __cache.set(key, { exp: Date.now() + TTL, data })
  return data
}

// Versione cache-ata della derivazione dal link (stessa TTL della catalogo).
// Map campaign_id -> Set(shopifyProductId).
export async function deriveMetaLinkProducts({ token, accounts, products, campaignIds }) {
  const ids = [...new Set((campaignIds || []).map(String).filter(Boolean))].sort()
  if (!token || !accounts?.length || !ids.length) return new Map()
  const key = `metalink|${accounts.join(',')}|${products.length}|${ids.join(',')}`
  const hit = __cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.data
  const maps = buildShopifyMaps(products)
  const data = await fetchMetaLinkProducts(token, accounts, maps, ids).catch(() => new Map())
  __cache.set(key, { exp: Date.now() + TTL, data })
  return data
}

// ── Google: COSTO ESATTO per prodotto (Shopping / Performance Max) ──
// Ritorna { byProduct: Map(shopifyProductId -> costo), total }. total = somma del
// costo prodotto Shopping/PMax (NON include le campagne Search non-prodotto).
export async function fetchGoogleProductCost(since, until, maps) {
  const byProduct = new Map(); let total = 0
  const g = getGoogle()
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const customerId = (g.adsCustomerId || '').replace(/-/g, '')
  const mcc = (g.adsMccId || '').replace(/-/g, '')
  if (!devToken || !customerId || !g.refreshToken || !g.clientId || !g.clientSecret) return { byProduct, total }
  try {
    const tok = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: g.clientId, client_secret: g.clientSecret, refresh_token: g.refreshToken, grant_type: 'refresh_token' }),
    }).then(r => r.json())
    if (!tok.access_token) return { byProduct, total }
    const headers = { Authorization: `Bearer ${tok.access_token}`, 'developer-token': devToken, 'Content-Type': 'application/json' }
    if (mcc) headers['login-customer-id'] = mcc
    const res = await fetch(`https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ query: `SELECT segments.product_item_id, metrics.cost_micros FROM shopping_performance_view WHERE segments.date BETWEEN '${since}' AND '${until}'` }),
    })
    if (!res.ok) return { byProduct, total }
    const arr = await res.json()
    for (const chunk of (Array.isArray(arr) ? arr : [])) for (const row of (chunk.results || [])) {
      const cost = (Number(row.metrics?.costMicros ?? row.metrics?.cost_micros) || 0) / 1e6
      total += cost
      const item = row.segments?.productItemId ?? row.segments?.product_item_id
      const pid = matchExternalId(item, maps)
      if (pid) byProduct.set(pid, (byProduct.get(pid) || 0) + cost)
    }
  } catch {}
  return { byProduct, total }
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
