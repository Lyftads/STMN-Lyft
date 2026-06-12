import { NextResponse } from 'next/server'
import { withTenantContext, getMeta } from '../../../lib/tenant/credentials'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v20.0'

const CREATIVE_IMAGE_SIZE = Number(process.env.META_CREATIVE_IMAGE_SIZE || 1080)

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}

function cleanAccountId(id) {
  if (!id) return null

  const s = String(id)
    .trim()
    .replace(/["']/g, '')

  if (!s) return null

  return s.startsWith('act_') ? s : `act_${s}`
}

function getAccountIds() {
  const envChain =
    process.env.META_AD_ACCOUNT_IDS ||
    process.env.META_AD_ACCOUNT_ID ||
    process.env.META_ACCOUNT_IDS ||
    process.env.META_ACCOUNTS ||
    process.env.META_ACCOUNT_ID ||
    ''
  // Isolamento multi-tenant: la catena env Meta (multi-account STMN) è usabile
  // SOLO per owner/cron (allowEnv=true). Ma se la env è VUOTA (account in DB),
  // si usa comunque l'account risolto dal resolver (m.adAccountId = DB o env
  // singola). Un tenant non-owner usa SOLO il proprio account (mai STMN).
  const m = getMeta()
  const raw = (m.allowEnv && envChain) ? envChain : (m.adAccountId || '')

  return raw
    .split(',')
    .map(cleanAccountId)
    .filter(Boolean)
}

function getSafeEnvDebug() {
  return {
    vercel_env: process.env.VERCEL_ENV || null,
    node_env: process.env.NODE_ENV || null,

    has_META_AD_ACCOUNT_IDS: Boolean(process.env.META_AD_ACCOUNT_IDS),
    has_META_AD_ACCOUNT_ID: Boolean(process.env.META_AD_ACCOUNT_ID),
    has_META_ACCOUNT_IDS: Boolean(process.env.META_ACCOUNT_IDS),
    has_META_ACCOUNTS: Boolean(process.env.META_ACCOUNTS),
    has_META_ACCOUNT_ID: Boolean(process.env.META_ACCOUNT_ID),

    has_META_ACCESS_TOKEN: Boolean(process.env.META_ACCESS_TOKEN),
    has_FACEBOOK_ACCESS_TOKEN: Boolean(process.env.FACEBOOK_ACCESS_TOKEN),
    has_FB_ACCESS_TOKEN: Boolean(process.env.FB_ACCESS_TOKEN),

    graph_version: GRAPH_VERSION,
    creative_image_size: CREATIVE_IMAGE_SIZE,
  }
}

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function div(a, b) {
  a = toNum(a)
  b = toNum(b)
  return b ? a / b : 0
}

function round(n, d = 2) {
  const p = Math.pow(10, d)
  return Math.round(toNum(n) * p) / p
}

function todayYMD() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function ymd(date) {
  return date.toISOString().slice(0, 10)
}

function getRange(preset, sp = null) {
  const today = new Date(todayYMD())

  if (preset === 'custom' && sp && typeof sp.get === 'function') {
    const since = sp.get('since'), until = sp.get('until')
    if (since && until) return { since, until }
  }

  if (preset === 'today') {
    return {
      since: ymd(today),
      until: ymd(today),
    }
  }

  if (preset === 'yesterday') {
    const d = addDays(today, -1)

    return {
      since: ymd(d),
      until: ymd(d),
    }
  }

  if (preset === 'last_7d') {
    return {
      since: ymd(addDays(today, -6)),
      until: ymd(today),
    }
  }

  if (preset === 'last_14d') {
    return {
      since: ymd(addDays(today, -13)),
      until: ymd(today),
    }
  }

  if (preset === 'current_month') {
    const d = new Date(today)
    d.setDate(1)

    return {
      since: ymd(d),
      until: ymd(today),
    }
  }

  if (preset === 'last_month') {
    const firstThisMonth = new Date(today)
    firstThisMonth.setDate(1)

    const lastMonthEnd = addDays(firstThisMonth, -1)
    const lastMonthStart = new Date(lastMonthEnd)
    lastMonthStart.setDate(1)

    return {
      since: ymd(lastMonthStart),
      until: ymd(lastMonthEnd),
    }
  }

  return {
    since: ymd(addDays(today, -27)),
    until: ymd(today),
  }
}

async function metaGet(path, params = {}) {
  const ACCESS_TOKEN = getMeta().accessToken
  if (!ACCESS_TOKEN) {
    throw new Error('META_ACCESS_TOKEN mancante nelle Environment Variables di Vercel.')
  }

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(
        key,
        typeof value === 'string' ? value : JSON.stringify(value)
      )
    }
  })

  url.searchParams.set('access_token', ACCESS_TOKEN)

  const res = await fetch(url.toString(), {
    cache: 'no-store',
  })

  const text = await res.text()

  let data

  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(text.slice(0, 300))
  }

  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || 'Errore Meta API')
  }

  return data
}

async function metaGetAll(path, params = {}, limit = 500) {
  const first = await metaGet(path, {
    ...params,
    limit: Math.min(limit, 500),
  })

  let rows = Array.isArray(first.data) ? [...first.data] : []
  let next = first?.paging?.next

  while (next && rows.length < limit) {
    const res = await fetch(next, {
      cache: 'no-store',
    })

    const data = await res.json()

    if (data.error) {
      throw new Error(data.error.message || 'Errore Meta API paging')
    }

    rows = rows.concat(Array.isArray(data.data) ? data.data : [])
    next = data?.paging?.next
  }

  return rows.slice(0, limit)
}

function getActionValue(actions = [], names = []) {
  if (!Array.isArray(actions)) return 0

  for (const name of names) {
    const found = actions.find(a => a.action_type === name)
    if (found) return toNum(found.value)
  }

  return 0
}

function normalizeInsight(row, account) {
  const spend = toNum(row.spend)
  const impressions = toNum(row.impressions)
  const reach = toNum(row.reach)

  // Catena di fallback per link clicks
  const linkClicks =
    toNum(row.inline_link_clicks) ||
    toNum(row.unique_inline_link_clicks) ||
    getActionValue(row.actions, [
      'link_click',
      'onsite_conversion.post_save',
    ]) ||
    toNum(row.clicks) ||
    toNum(row.unique_clicks)

  const purchases = getActionValue(row.actions, [
    'purchase',
    'offsite_conversion.fb_pixel_purchase',
    'onsite_conversion.purchase',
    'omni_purchase',
  ])

  const purchaseValue = getActionValue(row.action_values, [
    'purchase',
    'offsite_conversion.fb_pixel_purchase',
    'onsite_conversion.purchase',
    'omni_purchase',
  ])

  // CPC: Meta espone valori pre-calcolati piu affidabili del nostro
  // spend/click, usali in priorita prima del calcolo manuale.
  // cost_per_action_type include anche link_click come dimensione.
  const cpcLink =
    toNum(row.cost_per_inline_link_click) ||
    getActionValue(row.cost_per_action_type, ['link_click']) ||
    toNum(row.cpc) ||
    (linkClicks ? spend / linkClicks : 0)

  const ctrLink =
    toNum(row.inline_link_click_ctr) ||
    toNum(row.ctr) ||
    (impressions ? (linkClicks / impressions) * 100 : 0)

  const roas = spend ? purchaseValue / spend : 0

  return {
    id: row.ad_id || row.id,
    ad_id: row.ad_id || row.id,
    name: row.ad_name || row.name || 'Creative senza nome',

    campaign_id: row.campaign_id || null,
    campaign_name: row.campaign_name || '',

    adset_id: row.adset_id || null,
    adset_name: row.adset_name || '',

    account_id: account,
    status: row.ad_effective_status || row.effective_status || row.status || null,

    impressions,
    reach,
    spend,
    link_clicks: linkClicks,
    purchases,
    orders: purchases,
    purchase_value: purchaseValue,

    ctr_link: ctrLink,
    cpc_link: cpcLink,
    roas,

    creative_id: null,

    thumbnail_url: null,
    image_url: null,
    full_image_url: null,
    preview_image_url: null,
    display_image_url: null,
  }
}

function mergeByAd(rows) {
  const map = new Map()

  for (const r of rows) {
    const key = r.ad_id || r.id
    if (!key) continue

    if (!map.has(key)) {
      map.set(key, { ...r })
      continue
    }

    const old = map.get(key)

    old.impressions += r.impressions
    old.reach += r.reach
    old.spend += r.spend
    old.link_clicks += r.link_clicks
    old.purchases += r.purchases
    old.orders += r.orders
    old.purchase_value += r.purchase_value

    old.ctr_link = old.impressions ? (old.link_clicks / old.impressions) * 100 : 0
    old.cpc_link = old.link_clicks ? old.spend / old.link_clicks : 0
    old.roas = old.spend ? old.purchase_value / old.spend : 0

    map.set(key, old)
  }

  return Array.from(map.values())
}

// Meta restituisce questo hash come placeholder generico per le creative
// DPA/Catalog quando non c'è un'immagine statica selezionata
const META_GENERIC_PLACEHOLDER = '75341531_494485104475166'

function isGenericPlaceholder(url) {
  return typeof url === 'string' && url.includes(META_GENERIC_PLACEHOLDER)
}

function getAssetFeedImage(spec) {
  if (!spec) return null
  const images = Array.isArray(spec.images) ? spec.images : []
  for (const im of images) {
    if (im?.url) return im.url
    if (im?.permalink_url) return im.permalink_url
  }
  return null
}

function pickBestImageUrl({ creative = {}, fullCreative = {}, row = {} }) {
  const fromAssetFeed =
    getAssetFeedImage(fullCreative.asset_feed_spec) ||
    getAssetFeedImage(creative.asset_feed_spec)

  const candidates = [
    fullCreative.image_url,
    creative.image_url,
    fromAssetFeed,
    fullCreative.thumbnail_url,
    creative.thumbnail_url,
    row.image_url,
    row.thumbnail_url,
  ]
  // Scarta il placeholder generico Meta in priorità — torna null così la
  // card può mostrare un fallback dedicato (badge catalog) o l'iframe
  for (const c of candidates) {
    if (c && !isGenericPlaceholder(c)) return c
  }
  return null
}

function pickPreviewImageUrl({ creative = {}, fullCreative = {}, row = {} }) {
  const fromAssetFeed =
    getAssetFeedImage(fullCreative.asset_feed_spec) ||
    getAssetFeedImage(creative.asset_feed_spec)

  const candidates = [
    fullCreative.thumbnail_url,
    creative.thumbnail_url,
    fromAssetFeed,
    fullCreative.image_url,
    creative.image_url,
    row.thumbnail_url,
    row.image_url,
  ]
  for (const c of candidates) {
    if (c && !isGenericPlaceholder(c)) return c
  }
  return null
}

// Estrae copy/headline/description/CTA/link dal creative.
// Coperti tre formati Meta:
// 1) link_data (inserzione image/video singola con link)
// 2) template_data (catalog DPA / template-based)
// 3) asset_feed_spec (Advantage+ / dynamic creative — più valori)
function extractAdContent(creative, fullCreative) {
  const oss = fullCreative?.object_story_spec || creative?.object_story_spec || {}
  const afs = fullCreative?.asset_feed_spec || creative?.asset_feed_spec || {}

  const linkData = oss.link_data || oss.template_data || {}
  const videoData = oss.video_data || {}

  // Copy / primary text
  const copyCandidates = [
    linkData.message,
    videoData.message,
    afs.bodies?.[0]?.text,
  ].filter(Boolean)

  // Headline
  const headlineCandidates = [
    linkData.name,
    videoData.title,
    afs.titles?.[0]?.text,
  ].filter(Boolean)

  // Description
  const descriptionCandidates = [
    linkData.description,
    videoData.link_description,
    afs.descriptions?.[0]?.text,
  ].filter(Boolean)

  // CTA type
  const ctaCandidates = [
    linkData.call_to_action?.type,
    videoData.call_to_action?.type,
    afs.call_to_action_types?.[0],
  ].filter(Boolean)

  // Destination link
  const linkCandidates = [
    linkData.link,
    linkData.call_to_action?.value?.link,
    videoData.call_to_action?.value?.link,
    afs.link_urls?.[0]?.website_url,
    afs.link_urls?.[0]?.display_url,
  ].filter(Boolean)

  // Altre varianti se asset_feed_spec ha più bodies/titles
  const allCopies = (afs.bodies || []).map(b => b?.text).filter(Boolean)
  const allHeadlines = (afs.titles || []).map(t => t?.text).filter(Boolean)
  const allDescriptions = (afs.descriptions || []).map(d => d?.text).filter(Boolean)
  const allCtas = (afs.call_to_action_types || [])
  const allLinks = (afs.link_urls || []).map(l => l?.website_url || l?.display_url).filter(Boolean)

  return {
    copy: copyCandidates[0] || '',
    headline: headlineCandidates[0] || '',
    description: descriptionCandidates[0] || '',
    cta: ctaCandidates[0] || '',
    link: linkCandidates[0] || '',
    // Per DCO/Advantage+: tutte le varianti, così la modal può mostrarle
    variants: {
      copies: allCopies,
      headlines: allHeadlines,
      descriptions: allDescriptions,
      ctas: allCtas,
      links: allLinks,
    },
  }
}

function getProductSetId(creative, fullCreative) {
  return (
    fullCreative?.product_set_id ||
    creative?.product_set_id ||
    fullCreative?.object_story_spec?.template_data?.product_set_id ||
    creative?.object_story_spec?.template_data?.product_set_id ||
    fullCreative?.asset_feed_spec?.product_set_id ||
    creative?.asset_feed_spec?.product_set_id ||
    null
  )
}

async function getAdsetProductSetId(adsetId) {
  if (!adsetId) return null
  try {
    const data = await metaGet(adsetId, { fields: 'promoted_object' })
    return data?.promoted_object?.product_set_id || null
  } catch {
    return null
  }
}

async function fetchProductSetSample(productSetId, max = 6) {
  if (!productSetId) return []
  try {
    const data = await metaGet(`${productSetId}/products`, {
      fields: 'id,name,retailer_id,image_url,price',
      limit: max,
    })
    const products = Array.isArray(data?.data) ? data.data : []
    return products.slice(0, max).map(p => ({
      id: p.id,
      name: p.name || p.retailer_id || '',
      image_url: p.image_url || '',
      price: p.price || '',
    }))
  } catch {
    return []
  }
}

// Per inserzioni che linkano a un post pubblicato (carousel, catalog DPA,
// dynamic creative) possiamo recuperare le immagini direttamente dal post
// via attachments. Funziona quando product_set_id non è accessibile.
async function fetchPostAttachments(objectStoryId) {
  if (!objectStoryId) return []
  try {
    const data = await metaGet(`${objectStoryId}`, {
      fields: 'attachments{media,subattachments{media,description,title}}',
    })
    const att = data?.attachments?.data?.[0]
    if (!att) return []
    // Carousel: subattachments contiene le card singole
    const subs = att.subattachments?.data || []
    if (subs.length) {
      return subs.map((s, i) => ({
        id: `att_${i}`,
        name: s.title || s.description || '',
        image_url: s.media?.image?.src || '',
        price: '',
      })).filter(p => p.image_url)
    }
    // Single attachment fallback
    const url = att.media?.image?.src
    return url ? [{ id: 'att_0', name: '', image_url: url, price: '' }] : []
  } catch {
    return []
  }
}

async function hydrateCreatives(rows) {
  // Hydrate fino a 500 inserzioni così la UI mostra tutte le creative
  // attive (non solo le prime 200 per spesa)
  const limited = rows.slice(0, 500)

  const hydrated = await Promise.all(
    limited.map(async row => {
      try {
        if (!row.ad_id) return row

        const ad = await metaGet(row.ad_id, {
          fields: [
            'id',
            'name',
            'effective_status',
            'creative{id,name,thumbnail_url,image_url,product_set_id,effective_object_story_id,object_story_id,object_story_spec,asset_feed_spec}',
          ].join(','),
          thumbnail_width: CREATIVE_IMAGE_SIZE,
          thumbnail_height: CREATIVE_IMAGE_SIZE,
        })

        const creative = ad.creative || {}

        let fullCreative = {}

        if (creative.id) {
          try {
            fullCreative = await metaGet(creative.id, {
              fields: [
                'id',
                'name',
                'thumbnail_url',
                'image_url',
                'product_set_id',
                'effective_object_story_id',
                'object_story_id',
                'object_story_spec',
                'asset_feed_spec',
              ].join(','),
              thumbnail_width: CREATIVE_IMAGE_SIZE,
              thumbnail_height: CREATIVE_IMAGE_SIZE,
            })
          } catch {
            fullCreative = {}
          }
        }

        const fullImageUrl = pickBestImageUrl({
          creative,
          fullCreative,
          row,
        })

        const previewImageUrl = pickPreviewImageUrl({
          creative,
          fullCreative,
          row,
        })

        // Catalog ads: estrai un sample di prodotti dal product set
        // così la card mostra l'anteprima carosello come fa Meta.
        // 1) prova sul creative (DPA classico)
        // 2) fallback sull'adset (Advantage+ Catalog Ads tengono il
        //    product_set su adset.promoted_object, non sul creative)
        let productSetId = getProductSetId(creative, fullCreative)
        if (!productSetId) {
          productSetId = await getAdsetProductSetId(row.adset_id)
        }
        let products = productSetId
          ? await fetchProductSetSample(productSetId, 6)
          : []

        // Fallback: se non riusciamo a leggere il product_set (permessi
        // catalog_management non concessi), proviamo a tirare le card
        // direttamente dal post Facebook associato al creative
        if (products.length === 0) {
          const storyId =
            fullCreative?.effective_object_story_id ||
            creative?.effective_object_story_id ||
            fullCreative?.object_story_id ||
            creative?.object_story_id ||
            null
          if (storyId) {
            products = await fetchPostAttachments(storyId)
          }
        }

        return {
          ...row,
          status: ad.effective_status || row.status,
          creative_id: creative.id || fullCreative.id || null,

          image_url: fullImageUrl,
          full_image_url: fullImageUrl,

          thumbnail_url: previewImageUrl,
          preview_image_url: previewImageUrl,

          display_image_url: fullImageUrl || previewImageUrl,

          product_set_id: productSetId,
          products,

          ...extractAdContent(creative, fullCreative),
        }
      } catch {
        return row
      }
    })
  )

  return rows.map(row => {
    const found = hydrated.find(h => h.ad_id === row.ad_id)
    return found || row
  })
}

function buildSummary(rows) {
  const spend = rows.reduce((s, r) => s + toNum(r.spend), 0)
  const purchaseValue = rows.reduce((s, r) => s + toNum(r.purchase_value), 0)
  const linkClicks = rows.reduce((s, r) => s + toNum(r.link_clicks), 0)
  const impressions = rows.reduce((s, r) => s + toNum(r.impressions), 0)
  const orders = rows.reduce((s, r) => s + toNum(r.orders), 0)
  // Fallback pesato su Meta-precomputed cpc/ctr quando link clicks = 0
  const cpcWeighted = rows.reduce((s, r) => s + toNum(r.cpc_link) * toNum(r.spend), 0)
  const ctrWeighted = rows.reduce((s, r) => s + toNum(r.ctr_link) * toNum(r.spend), 0)

  const cpcComputed = div(spend, linkClicks)
  const ctrComputed = impressions ? (linkClicks / impressions) * 100 : 0

  return {
    creatives: rows.length,
    spend: round(spend, 2),
    revenue: round(purchaseValue, 2),
    roas: round(div(purchaseValue, spend), 2),
    ctr_link: round(ctrComputed || div(ctrWeighted, spend), 2),
    cpc_link: round(cpcComputed || div(cpcWeighted, spend), 2),
    link_clicks: round(linkClicks, 0),
    impressions: round(impressions, 0),
    orders: round(orders, 0),
    purchases: round(orders, 0),
    purchase_value: round(purchaseValue, 2),
  }
}

function getPrevRange(range) {
  const since = new Date(`${range.since}T00:00:00Z`)
  const until = new Date(`${range.until}T00:00:00Z`)
  const days = Math.max(1, Math.round((until - since) / 86400000) + 1)
  const prevUntil = addDays(since, -1)
  const prevSince = addDays(prevUntil, -(days - 1))
  return { since: ymd(prevSince), until: ymd(prevUntil) }
}

async function fetchAccountSummary(accounts, range) {
  let spend = 0, purchaseValue = 0, linkClicks = 0, impressions = 0, orders = 0
  // Anche valori CPC/CTR pesati come fallback se i click non arrivano
  let cpcLinkWeighted = 0, ctrLinkWeighted = 0
  for (const account of accounts) {
    const rows = await metaGetAll(`${account}/insights`, {
      level: 'account',
      fields: 'spend,impressions,clicks,unique_clicks,inline_link_clicks,unique_inline_link_clicks,cpc,cost_per_inline_link_click,cost_per_action_type,ctr,inline_link_click_ctr,actions,action_values',
      time_range: range,
    }, 100)
    for (const r of rows) {
      const rSpend = toNum(r.spend)
      spend += rSpend
      impressions += toNum(r.impressions)
      linkClicks +=
        toNum(r.inline_link_clicks) ||
        toNum(r.unique_inline_link_clicks) ||
        getActionValue(r.actions, ['link_click', 'onsite_conversion.post_save']) ||
        toNum(r.clicks) ||
        toNum(r.unique_clicks)
      const rCpc =
        toNum(r.cost_per_inline_link_click) ||
        getActionValue(r.cost_per_action_type, ['link_click']) ||
        toNum(r.cpc)
      cpcLinkWeighted += rCpc * rSpend
      ctrLinkWeighted += (toNum(r.inline_link_click_ctr) || toNum(r.ctr)) * rSpend
      orders += getActionValue(r.actions, [
        'purchase', 'offsite_conversion.fb_pixel_purchase',
        'onsite_conversion.purchase', 'omni_purchase',
      ])
      purchaseValue += getActionValue(r.action_values, [
        'purchase', 'offsite_conversion.fb_pixel_purchase',
        'onsite_conversion.purchase', 'omni_purchase',
      ])
    }
  }
  // Fallback finale: media pesata dei CPC/CTR di Meta se link clicks è 0
  const cpcComputed = div(spend, linkClicks)
  const ctrComputed = impressions ? (linkClicks / impressions) * 100 : 0
  return {
    spend: round(spend, 2),
    revenue: round(purchaseValue, 2),
    roas: round(div(purchaseValue, spend), 2),
    ctr_link: round(ctrComputed || div(ctrLinkWeighted, spend), 2),
    cpc_link: round(cpcComputed || div(cpcLinkWeighted, spend), 2),
    link_clicks: round(linkClicks, 0),
    impressions: round(impressions, 0),
    orders: round(orders, 0),
    purchase_value: round(purchaseValue, 2),
  }
}

async function fetchDailySeries(accounts, range) {
  const byDay = new Map()
  for (const account of accounts) {
    const rows = await metaGetAll(`${account}/insights`, {
      level: 'account',
      fields: 'spend,impressions,clicks,inline_link_clicks,cpc,cost_per_inline_link_click,actions,action_values',
      time_range: range,
      time_increment: 1,
    }, 500)
    for (const r of rows) {
      const date = r.date_start
      if (!date) continue
      const prev = byDay.get(date) || {
        date, spend: 0, revenue: 0, orders: 0,
        link_clicks: 0, impressions: 0,
      }
      prev.spend += toNum(r.spend)
      prev.impressions += toNum(r.impressions)
      const lc = toNum(r.inline_link_clicks) ||
        getActionValue(r.actions, ['link_click', 'onsite_conversion.post_save']) ||
        toNum(r.clicks)
      prev.link_clicks += lc
      prev.orders += getActionValue(r.actions, [
        'purchase', 'offsite_conversion.fb_pixel_purchase',
        'onsite_conversion.purchase', 'omni_purchase',
      ])
      prev.revenue += getActionValue(r.action_values, [
        'purchase', 'offsite_conversion.fb_pixel_purchase',
        'onsite_conversion.purchase', 'omni_purchase',
      ])
      byDay.set(date, prev)
    }
  }
  return Array.from(byDay.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      ...d,
      spend: round(d.spend, 2),
      revenue: round(d.revenue, 2),
      roas: round(div(d.revenue, d.spend), 2),
      ctr_link: round(d.impressions ? (d.link_clicks / d.impressions) * 100 : 0, 2),
      cpc_link: round(div(d.spend, d.link_clicks), 2),
    }))
}

export async function GET(req) {
  return withTenantContext(req, async () => {
  try {
    const { searchParams } = new URL(req.url)

    const preset = searchParams.get('preset') || 'last_28d'
    const activeOnly = searchParams.get('active_only') !== 'false'
    const debug = searchParams.get('debug') === '1'
    const accountFilter = searchParams.get('account_id') || null

    const range = getRange(preset, searchParams)
    const allAccounts = getAccountIds()
    const accounts = accountFilter
      ? allAccounts.filter(a => a === accountFilter)
      : allAccounts

    if (!allAccounts.length) {
      return json({
        ok: false,
        error:
          'Nessun account Meta configurato. Aggiungi META_AD_ACCOUNT_IDS o META_AD_ACCOUNT_ID nelle Environment Variables di Vercel. Esempio: act_123,act_456',
        rows: [],
        summary: buildSummary([]),
        debug: debug ? getSafeEnvDebug() : undefined,
      })
    }

    if (accountFilter && !accounts.length) {
      return json({
        ok: false,
        error: `Account ${accountFilter} non configurato nelle env vars`,
        rows: [],
        summary: buildSummary([]),
        allAccounts,
      })
    }

    const fields = [
      'ad_id',
      'ad_name',
      'adset_id',
      'adset_name',
      'campaign_id',
      'campaign_name',
      'impressions',
      'reach',
      'spend',
      'clicks',
      'unique_clicks',
      'inline_link_clicks',
      'unique_inline_link_clicks',
      'cpc',
      'cost_per_inline_link_click',
      'cost_per_action_type',
      'ctr',
      'inline_link_click_ctr',
      'actions',
      'action_values',
    ].join(',')

    let allRows = []

    for (const account of accounts) {
      const rows = await metaGetAll(
        `${account}/insights`,
        {
          level: 'ad',
          fields,
          time_range: range,
        },
        500
      )

      allRows = allRows.concat(rows.map(r => normalizeInsight(r, account)))
    }

    let merged = mergeByAd(allRows)

    merged = await hydrateCreatives(merged)

    if (activeOnly) {
      merged = merged.filter(r => {
        const status = String(r.status || '').toUpperCase()
        return !status || status === 'ACTIVE'
      })
    }

    merged = merged
      .map(r => ({
        ...r,
        spend: round(r.spend, 2),
        roas: round(r.roas, 2),
        ctr_link: round(r.ctr_link, 2),
        cpc_link: round(r.cpc_link, 2),
        purchase_value: round(r.purchase_value, 2),
      }))
      .sort((a, b) => b.spend - a.spend)

    const prevRange = getPrevRange(range)

    // Insights ad-level del periodo PRECEDENTE per fare comparazione
    // per-creative: ad_id → metrics. Restano usabili solo se l'ad era
    // attivo nel periodo precedente (Meta non ritorna righe per ad
    // senza spesa).
    async function fetchPrevAdMap() {
      const prevFields = [
        'ad_id','spend','impressions','clicks','inline_link_clicks',
        'cpc','cost_per_inline_link_click','ctr','inline_link_click_ctr',
        'actions','action_values',
      ].join(',')
      const map = {}
      for (const account of accounts) {
        try {
          const rows = await metaGetAll(`${account}/insights`, {
            level: 'ad',
            fields: prevFields,
            time_range: prevRange,
          }, 500)
          for (const r of rows) {
            if (!r.ad_id) continue
            const normalized = normalizeInsight(r, account)
            map[r.ad_id] = {
              spend: normalized.spend,
              revenue: normalized.purchase_value,
              orders: normalized.orders,
              roas: normalized.roas,
              cpc_link: normalized.cpc_link,
              ctr_link: normalized.ctr_link,
              link_clicks: normalized.link_clicks,
              impressions: normalized.impressions,
            }
          }
        } catch {}
      }
      return map
    }

    const [accountSummary, prevSummary, dailySeries, rawAccountRows, prevAdMap] = await Promise.all([
      fetchAccountSummary(accounts, range).catch(() => null),
      fetchAccountSummary(accounts, prevRange).catch(() => null),
      fetchDailySeries(accounts, range).catch(() => []),
      debug ? metaGetAll(`${accounts[0]}/insights`, {
        level: 'account',
        fields: 'spend,impressions,clicks,inline_link_clicks,cpc,cost_per_inline_link_click,ctr,inline_link_click_ctr,actions,action_values,cost_per_action_type',
        time_range: range,
      }, 5).catch(e => ({ error: e?.message })) : Promise.resolve(null),
      fetchPrevAdMap(),
    ])

    // Aggancia il previous a ogni row se esiste (l'ad era attivo nel
    // periodo precedente). Se manca → niente confronto (richiesta utente).
    merged = merged.map(r => {
      const prev = prevAdMap[r.ad_id]
      return prev && prev.spend > 0 ? { ...r, prev } : r
    })

    // Account-level summary è più affidabile per alcuni campi, ma non
    // deve sovrascrivere valori validi di adLevelSummary con 0. Merge
    // selettivo: override solo i campi non-zero da accountSummary.
    const adLevelSummary = buildSummary(merged)
    const summary = { ...adLevelSummary }
    if (accountSummary) {
      for (const key of Object.keys(accountSummary)) {
        const v = accountSummary[key]
        if (v != null && v !== 0) summary[key] = v
      }
    }
    summary.creatives = merged.length

    return json({
      ok: true,
      preset,
      range,
      prevRange,
      accounts,
      allAccounts,
      accountFilter,
      rows: merged,
      summary,
      prevSummary,
      dailySeries,
      debug: debug ? {
        env: getSafeEnvDebug(),
        rawAccountRows,
        adLevelSummary,
        accountSummary,
      } : undefined,
    })
  } catch (e) {
    return json(
      {
        ok: false,
        error: e?.message || 'Errore sconosciuto',
        rows: [],
        summary: buildSummary([]),
        debug: getSafeEnvDebug(),
      },
      500
    )
  }
  })
}
