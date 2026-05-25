// app/api/meta-detail/route.js

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID
const API_VERSION = process.env.META_API_VERSION || 'v19.0'

const PURCHASE_KEYS = [
  'purchase',
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
]

const ADD_TO_CART_KEYS = [
  'add_to_cart',
  'omni_add_to_cart',
  'offsite_conversion.fb_pixel_add_to_cart',
]

function n(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function r2(value) {
  return Math.round(n(value) * 100) / 100
}

function toDate(value) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date, days) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function diffDaysInclusive(start, end) {
  const ms = end.getTime() - start.getTime()
  return Math.floor(ms / 86400000) + 1
}

function getAccountId() {
  return META_ACCOUNT.startsWith('act_') ? META_ACCOUNT : `act_${META_ACCOUNT}`
}

function getActionValue(actions = [], keys = []) {
  if (!Array.isArray(actions)) return 0

  return actions.reduce((total, item) => {
    if (keys.includes(item.action_type)) {
      return total + n(item.value)
    }

    return total
  }, 0)
}

function getPurchaseValue(actionValues = []) {
  if (!Array.isArray(actionValues)) return 0

  return actionValues.reduce((total, item) => {
    if (PURCHASE_KEYS.includes(item.action_type)) {
      return total + n(item.value)
    }

    return total
  }, 0)
}

function getCostPerResult(costPerActionType = []) {
  if (!Array.isArray(costPerActionType)) return 0

  const found = costPerActionType.find((item) =>
    PURCHASE_KEYS.includes(item.action_type)
  )

  return found ? n(found.value) : 0
}

function getRoas(purchaseRoas = []) {
  if (!Array.isArray(purchaseRoas)) return 0

  const found =
    purchaseRoas.find((item) => PURCHASE_KEYS.includes(item.action_type)) ||
    purchaseRoas[0]

  return found ? n(found.value) : 0
}

function normalizeInsight(row = {}, level = 'campaign') {
  const linkClicks = n(row.inline_link_clicks)

  const purchaseConversions = getActionValue(row.actions, PURCHASE_KEYS)
  const purchases = purchaseConversions
  const addToCart = getActionValue(row.actions, ADD_TO_CART_KEYS)
  const purchaseValue = getPurchaseValue(row.action_values)

  const cro = linkClicks > 0 ? (purchases / linkClicks) * 100 : 0
  const aov = purchases > 0 ? purchaseValue / purchases : 0

  return {
    level,

    date: row.date_start || null,
    dateStart: row.date_start || null,
    dateStop: row.date_stop || null,

    campaignId: row.campaign_id || null,
    campaignName: row.campaign_name || null,

    adsetId: row.adset_id || null,
    adsetName: row.adset_name || null,

    adId: row.ad_id || null,
    adName: row.ad_name || null,

    spend: r2(row.spend),
    impressions: n(row.impressions),
    reach: n(row.reach),
    frequency: r2(row.frequency),
    cpm: r2(row.cpm),

    ctrLink: r2(row.inline_link_click_ctr),
    cpcLink: r2(row.cost_per_inline_link_click),
    linkClicks,

    costPerResult: r2(getCostPerResult(row.cost_per_action_type)),
    roas: r2(getRoas(row.purchase_roas)),

    purchaseValue: r2(purchaseValue),
    purchaseConversions: r2(purchaseConversions),
    purchases: r2(purchases),
    addToCart: r2(addToCart),

    cro: r2(cro),
    aov: r2(aov),
  }
}

function firstText(items = []) {
  if (!Array.isArray(items)) return null

  const found = items.find((item) => {
    if (typeof item === 'string') return item.trim()
    if (typeof item?.text === 'string') return item.text.trim()
    if (typeof item?.body === 'string') return item.body.trim()
    if (typeof item?.title === 'string') return item.title.trim()
    return false
  })

  if (!found) return null

  if (typeof found === 'string') return found
  return found.text || found.body || found.title || null
}

function normalizeAssetText(items = []) {
  if (!Array.isArray(items)) return []

  return items
    .map((item) => {
      if (typeof item === 'string') return item
      return item?.text || item?.body || item?.title || item?.description || null
    })
    .filter(Boolean)
}

function normalizeAssetUrls(items = []) {
  if (!Array.isArray(items)) return []

  return items
    .map((item) => {
      if (typeof item === 'string') return item
      return item?.url || item?.website_url || item?.link || item?.thumbnail_url || item?.image_url || null
    })
    .filter(Boolean)
}

function extractCreativeDetails(ad = {}) {
  const creative = ad.creative || {}

  const objectStorySpec = creative.object_story_spec || {}
  const assetFeedSpec = creative.asset_feed_spec || {}

  const linkData = objectStorySpec.link_data || {}
  const videoData = objectStorySpec.video_data || {}
  const photoData = objectStorySpec.photo_data || {}

  const assetBodies = normalizeAssetText(assetFeedSpec.bodies)
  const assetTitles = normalizeAssetText(assetFeedSpec.titles)
  const assetDescriptions = normalizeAssetText(assetFeedSpec.descriptions)
  const assetImages = assetFeedSpec.images || []
  const assetVideos = assetFeedSpec.videos || []
  const assetLinkUrls = normalizeAssetUrls(assetFeedSpec.link_urls)

  const copy =
    linkData.message ||
    videoData.message ||
    photoData.message ||
    firstText(assetFeedSpec.bodies) ||
    null

  const headline =
    linkData.name ||
    videoData.title ||
    firstText(assetFeedSpec.titles) ||
    null

  const description =
    linkData.description ||
    videoData.description ||
    firstText(assetFeedSpec.descriptions) ||
    null

  const callToAction =
    linkData.call_to_action?.type ||
    videoData.call_to_action?.type ||
    assetFeedSpec.call_to_action_types?.[0] ||
    null

  const destinationUrl =
    linkData.call_to_action?.value?.link ||
    videoData.call_to_action?.value?.link ||
    linkData.link ||
    assetLinkUrls?.[0] ||
    null

  const thumbnailUrl =
    creative.thumbnail_url ||
    assetImages?.[0]?.url ||
    assetImages?.[0]?.thumbnail_url ||
    null

  const imageUrl =
    creative.image_url ||
    linkData.picture ||
    photoData.url ||
    assetImages?.[0]?.url ||
    null

  const videoId =
    videoData.video_id ||
    assetVideos?.[0]?.video_id ||
    assetVideos?.[0]?.id ||
    null

  return {
    adId: ad.id || null,
    adName: ad.name || null,
    campaignId: ad.campaign_id || null,
    adsetId: ad.adset_id || null,
    status: ad.status || null,
    effectiveStatus: ad.effective_status || null,

    creativeId: creative.id || null,
    creativeName: creative.name || null,

    copy,
    headline,
    description,
    callToAction,
    destinationUrl,

    thumbnailUrl,
    imageUrl,
    videoId,

    assetBodies,
    assetTitles,
    assetDescriptions,
    assetImages,
    assetVideos,
    assetLinkUrls,

    objectStorySpec,
    assetFeedSpec,
  }
}

async function metaFetch(path, params = {}) {
  if (!META_TOKEN || !META_ACCOUNT) {
    throw new Error(
      'Variabili ambiente mancanti: META_ACCESS_TOKEN o META_AD_ACCOUNT_ID'
    )
  }

  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  url.searchParams.set('access_token', META_TOKEN)

  const res = await fetch(url.toString(), {
    cache: 'no-store',
  })

  const text = await res.text()

  let json = null

  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`Risposta Meta non JSON: ${text.slice(0, 300)}`)
  }

  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `Errore Meta API ${res.status}`)
  }

  return json
}

async function metaFetchPaginated(path, params = {}) {
  let first = await metaFetch(path, params)
  let rows = Array.isArray(first.data) ? [...first.data] : []

  let next = first?.paging?.next

  while (next) {
    const res = await fetch(next, { cache: 'no-store' })
    const text = await res.text()

    let json = null

    try {
      json = text ? JSON.parse(text) : null
    } catch {
      throw new Error(`Risposta Meta non JSON: ${text.slice(0, 300)}`)
    }

    if (!res.ok || json?.error) {
      throw new Error(json?.error?.message || `Errore Meta API ${res.status}`)
    }

    rows = rows.concat(Array.isArray(json.data) ? json.data : [])
    next = json?.paging?.next
  }

  return rows
}

async function getActiveCampaigns() {
  const accountId = getAccountId()

  const rows = await metaFetchPaginated(`${accountId}/campaigns`, {
    fields: 'id,name,status,effective_status',
    limit: 500,
  })

  return rows.filter((campaign) => {
    const effective = String(campaign.effective_status || '').toUpperCase()
    const status = String(campaign.status || '').toUpperCase()

    return effective === 'ACTIVE' || status === 'ACTIVE'
  })
}

async function getActiveAdsWithCreatives() {
  const accountId = getAccountId()

  const rows = await metaFetchPaginated(`${accountId}/ads`, {
    fields: [
      'id',
      'name',
      'campaign_id',
      'adset_id',
      'status',
      'effective_status',
      'creative{id,name,thumbnail_url,image_url,object_story_spec,asset_feed_spec,effective_object_story_id}',
    ].join(','),
    limit: 500,
  })

  const activeAds = rows.filter((ad) => {
    const effective = String(ad.effective_status || '').toUpperCase()
    const status = String(ad.status || '').toUpperCase()

    return effective === 'ACTIVE' || status === 'ACTIVE'
  })

  const map = new Map()

  activeAds.forEach((ad) => {
    map.set(String(ad.id), extractCreativeDetails(ad))
  })

  return {
    activeAds,
    creativesByAdId: map,
  }
}

async function getInsights({ level, since, until, timeIncrement = null }) {
  const accountId = getAccountId()

  const fields = [
    'campaign_id',
    'campaign_name',
    'adset_id',
    'adset_name',
    'ad_id',
    'ad_name',
    'spend',
    'impressions',
    'reach',
    'frequency',
    'cpm',
    'inline_link_click_ctr',
    'inline_link_clicks',
    'cost_per_inline_link_click',
    'cost_per_action_type',
    'purchase_roas',
    'actions',
    'action_values',
    'date_start',
    'date_stop',
  ].join(',')

  const params = {
    level,
    fields,
    time_range: JSON.stringify({
      since,
      until,
    }),
    limit: 500,
  }

  if (timeIncrement) {
    params.time_increment = timeIncrement
  }

  const rows = await metaFetchPaginated(`${accountId}/insights`, params)

  return rows.map((row) => normalizeInsight(row, level))
}

function byId(rows = [], idKey, id) {
  return rows.find((row) => String(row[idKey]) === String(id)) || null
}

function rowsById(rows = [], idKey, id) {
  return rows
    .filter((row) => String(row[idKey]) === String(id))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
}

function uniqueBy(rows = [], idKey) {
  const map = new Map()

  rows.forEach((row) => {
    const id = row[idKey]
    if (!id) return

    if (!map.has(id)) {
      map.set(id, row)
    }
  })

  return Array.from(map.values())
}

function buildHierarchy({
  activeCampaigns,
  activeAds,
  creativesByAdId,
  campaignCurrent,
  campaignPrevious,
  campaignTrend,
  adsetCurrent,
  adsetPrevious,
  adsetTrend,
  adCurrent,
  adPrevious,
  adTrend,
}) {
  const activeIds = new Set(activeCampaigns.map((c) => String(c.id)))

  const campaignsSource = uniqueBy(
    [
      ...campaignCurrent,
      ...campaignPrevious,
      ...campaignTrend,
      ...activeCampaigns.map((c) => ({
        campaignId: c.id,
        campaignName: c.name,
      })),
    ],
    'campaignId'
  ).filter((campaign) => activeIds.has(String(campaign.campaignId)))

  return campaignsSource.map((campaign) => {
    const campaignId = campaign.campaignId

    const adsetsSource = uniqueBy(
      [
        ...adsetCurrent,
        ...adsetPrevious,
        ...adsetTrend,
        ...activeAds
          .filter((ad) => String(ad.campaign_id) === String(campaignId))
          .map((ad) => ({
            campaignId: ad.campaign_id,
            adsetId: ad.adset_id,
            adsetName: null,
          })),
      ].filter((row) => String(row.campaignId) === String(campaignId)),
      'adsetId'
    )

    const adsets = adsetsSource.map((adset) => {
      const adsetId = adset.adsetId

      const adsSource = uniqueBy(
        [
          ...adCurrent,
          ...adPrevious,
          ...adTrend,
          ...activeAds
            .filter((ad) => String(ad.adset_id) === String(adsetId))
            .map((ad) => ({
              campaignId: ad.campaign_id,
              adsetId: ad.adset_id,
              adId: ad.id,
              adName: ad.name,
            })),
        ].filter((row) => String(row.adsetId) === String(adsetId)),
        'adId'
      )

      const ads = adsSource.map((ad) => {
        const adId = ad.adId
        const creative = creativesByAdId.get(String(adId)) || null

        return {
          id: adId,
          name: ad.adName || creative?.adName || 'Creatività senza nome',

          latest: byId(adCurrent, 'adId', adId) || {},
          previous: byId(adPrevious, 'adId', adId) || {},

          trend: rowsById(adTrend, 'adId', adId),
          weeks: rowsById(adTrend, 'adId', adId),

          creative,
        }
      })

      return {
        id: adsetId,
        name: adset.adsetName || 'Adset senza nome',

        latest: byId(adsetCurrent, 'adsetId', adsetId) || {},
        previous: byId(adsetPrevious, 'adsetId', adsetId) || {},

        trend: rowsById(adsetTrend, 'adsetId', adsetId),
        weeks: rowsById(adsetTrend, 'adsetId', adsetId),

        ads,
      }
    })

    return {
      id: campaignId,
      name:
        campaign.campaignName ||
        activeCampaigns.find((c) => String(c.id) === String(campaignId))?.name ||
        'Campagna senza nome',

      latest: byId(campaignCurrent, 'campaignId', campaignId) || {},
      previous: byId(campaignPrevious, 'campaignId', campaignId) || {},

      trend: rowsById(campaignTrend, 'campaignId', campaignId),
      weeks: rowsById(campaignTrend, 'campaignId', campaignId),

      adsets,
    }
  })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const today = new Date()
    const defaultUntil = formatDate(today)
    const defaultSince = formatDate(addDays(today, -6))

    const sinceParam = searchParams.get('since') || defaultSince
    const untilParam = searchParams.get('until') || defaultUntil

    const sinceDate = toDate(`${sinceParam}T00:00:00.000Z`)
    const untilDate = toDate(`${untilParam}T00:00:00.000Z`)

    if (!sinceDate || !untilDate) {
      return NextResponse.json({
        campaigns: [],
        error: 'Date non valide. Usa formato YYYY-MM-DD.',
      })
    }

    if (sinceDate > untilDate) {
      return NextResponse.json({
        campaigns: [],
        error: 'La data iniziale non può essere successiva alla data finale.',
      })
    }

    const days = diffDaysInclusive(sinceDate, untilDate)

    const previousUntilDate = addDays(sinceDate, -1)
    const previousSinceDate = addDays(previousUntilDate, -(days - 1))

    const since = formatDate(sinceDate)
    const until = formatDate(untilDate)

    const previousSince = formatDate(previousSinceDate)
    const previousUntil = formatDate(previousUntilDate)

    const trendSince = formatDate(addDays(untilDate, -83))
    const trendUntil = until

    const activeCampaigns = await getActiveCampaigns()
    const { activeAds, creativesByAdId } = await getActiveAdsWithCreatives()

    const [
      campaignCurrent,
      campaignPrevious,
      campaignTrend,

      adsetCurrent,
      adsetPrevious,
      adsetTrend,

      adCurrent,
      adPrevious,
      adTrend,
    ] = await Promise.all([
      getInsights({
        level: 'campaign',
        since,
        until,
      }),
      getInsights({
        level: 'campaign',
        since: previousSince,
        until: previousUntil,
      }),
      getInsights({
        level: 'campaign',
        since: trendSince,
        until: trendUntil,
        timeIncrement: 7,
      }),

      getInsights({
        level: 'adset',
        since,
        until,
      }),
      getInsights({
        level: 'adset',
        since: previousSince,
        until: previousUntil,
      }),
      getInsights({
        level: 'adset',
        since: trendSince,
        until: trendUntil,
        timeIncrement: 7,
      }),

      getInsights({
        level: 'ad',
        since,
        until,
      }),
      getInsights({
        level: 'ad',
        since: previousSince,
        until: previousUntil,
      }),
      getInsights({
        level: 'ad',
        since: trendSince,
        until: trendUntil,
        timeIncrement: 7,
      }),
    ])

    const campaigns = buildHierarchy({
      activeCampaigns,
      activeAds,
      creativesByAdId,

      campaignCurrent,
      campaignPrevious,
      campaignTrend,

      adsetCurrent,
      adsetPrevious,
      adsetTrend,

      adCurrent,
      adPrevious,
      adTrend,
    })

    return NextResponse.json({
      campaigns,
      meta: {
        since,
        until,
        previousSince,
        previousUntil,
        trendSince,
        trendUntil,
        activeCampaigns: activeCampaigns.length,
        activeAds: activeAds.length,
        creatives: creativesByAdId.size,
        updatedAt: new Date().toISOString(),
      },
      error: null,
    })
  } catch (error) {
    return NextResponse.json({
      campaigns: [],
      error: error?.message || 'Errore sconosciuto nella route Meta Detail',
    })
  }
}
