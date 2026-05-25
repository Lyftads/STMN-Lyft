// app/api/meta-detail/route.js

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID
const API_VERSION = process.env.META_API_VERSION || 'v19.0'

// Data di partenza analisi settimanale
const WEEKLY_START_DATE = '2025-12-29'

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

function r4(value) {
  return Math.round(n(value) * 10000) / 10000
}

function getActionValue(actions, keys) {
  if (!Array.isArray(actions)) return 0

  return actions
    .filter(action => keys.includes(action.action_type))
    .reduce((sum, action) => sum + n(action.value), 0)
}

function getLinkClicks(row) {
  return n(row.inline_link_clicks)
}

function getCostPerLinkClick(row) {
  const apiValue = n(row.cost_per_inline_link_click)

  if (apiValue > 0) return apiValue

  const spend = n(row.spend)
  const clicks = getLinkClicks(row)

  return clicks > 0 ? spend / clicks : 0
}

function getPurchaseValue(row) {
  return getActionValue(row.action_values, PURCHASE_KEYS)
}

function getPurchaseRoas(row) {
  if (!Array.isArray(row.purchase_roas)) return 0

  const found =
    row.purchase_roas.find(item => PURCHASE_KEYS.includes(item.action_type)) ||
    row.purchase_roas[0]

  return n(found?.value)
}

function getCostPerPurchase(row) {
  if (!Array.isArray(row.cost_per_action_type)) return 0

  const found = row.cost_per_action_type.find(item =>
    PURCHASE_KEYS.includes(item.action_type)
  )

  return n(found?.value)
}

function normalizeInsight(row, level) {
  const linkClicks = getLinkClicks(row)
  const purchases = getActionValue(row.actions, PURCHASE_KEYS)
  const addToCart = getActionValue(row.actions, ADD_TO_CART_KEYS)
  const purchaseValue = getPurchaseValue(row)

  return {
    level,

    date: row.date_start,
    dateStart: row.date_start,
    dateStop: row.date_stop,

    campaignId: row.campaign_id || null,
    campaignName: row.campaign_name || 'Senza nome campagna',

    adsetId: row.adset_id || null,
    adsetName: row.adset_name || null,

    adId: row.ad_id || null,
    adName: row.ad_name || null,

    spend: r2(row.spend),
    impressions: Math.round(n(row.impressions)),
    reach: Math.round(n(row.reach)),
    frequency: r4(row.frequency),
    cpm: r2(row.cpm),

    // CTR click sul link
    ctrLink: r4(row.inline_link_click_ctr || 0),

    // CPC costo per click sul link
    cpcLink: r2(getCostPerLinkClick(row)),

    // Click sul link
    linkClicks: Math.round(linkClicks),

    // Costo per risultato = costo per acquisto
    costPerResult: r2(getCostPerPurchase(row)),

    roas: r4(getPurchaseRoas(row)),

    purchaseValue: r2(purchaseValue),
    purchaseConversions: r2(purchases),
    purchases: r2(purchases),
    addToCart: r2(addToCart),

    // CRO campagna = Acquisti / Click sul link × 100
    cro: linkClicks > 0 ? r4((purchases / linkClicks) * 100) : null,

    // AOV campagna = Valore acquisti / Acquisti
    aov: purchases > 0 ? r2(purchaseValue / purchases) : null,
  }
}

function getDateRange() {
  const since = WEEKLY_START_DATE
  const until = new Date().toISOString().slice(0, 10)

  return { since, until }
}

async function metaFetch(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value)
    }
  }

  url.searchParams.set('access_token', META_TOKEN)

  const response = await fetch(url.toString(), {
    cache: 'no-store',
  })

  const text = await response.text()

  let json = null

  try {
    json = text ? JSON.parse(text) : null
  } catch (error) {
    throw new Error(
      `Meta ha risposto con un contenuto non JSON. Status: ${response.status}`
    )
  }

  if (!response.ok || json?.error) {
    throw new Error(json?.error?.message || `Meta API error: ${response.status}`)
  }

  return json
}

async function fetchPaged(path, params = {}) {
  let json = await metaFetch(path, params)
  const data = [...(json?.data || [])]

  while (json?.paging?.next) {
    const response = await fetch(json.paging.next, {
      cache: 'no-store',
    })

    const text = await response.text()

    try {
      json = text ? JSON.parse(text) : null
    } catch (error) {
      throw new Error(
        `Meta pagination ha risposto con contenuto non JSON. Status: ${response.status}`
      )
    }

    if (json?.error) {
      throw new Error(json.error.message)
    }

    data.push(...(json?.data || []))
  }

  return data
}

async function fetchInsights(level, since, until) {
  const accounts = String(META_ACCOUNT || '')
    .split(',')
    .map(account => account.trim())
    .filter(Boolean)

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
    'actions',
    'action_values',
    'purchase_roas',
    'date_start',
    'date_stop',
  ].join(',')

  const rows = []

  for (const account of accounts) {
    const accountId = account.startsWith('act_') ? account : `act_${account}`

    const data = await fetchPaged(`${accountId}/insights`, {
      fields,
      level,
      time_range: JSON.stringify({ since, until }),
      time_increment: 7,
      limit: 500,
      filtering: JSON.stringify([
        {
          field: `${level}.effective_status`,
          operator: 'IN',
          value: ['ACTIVE'],
        },
      ]),
    })

    rows.push(...data.map(row => normalizeInsight(row, level)))
  }

  return rows
}

async function fetchAdsCreativeMap(adIds) {
  const ids = [...new Set(adIds.filter(Boolean))]
  const map = {}

  // Limite di sicurezza: evita troppe chiamate Meta contemporanee
  const limitedIds = ids.slice(0, 80)

  for (const adId of limitedIds) {
    try {
      const ad = await metaFetch(adId, {
        fields:
          'id,name,effective_status,creative{id,name,thumbnail_url,image_url,object_story_spec,asset_feed_spec}',
      })

      map[adId] = {
        adId,
        adName: ad.name || null,
        effectiveStatus: ad.effective_status || null,
        creativeId: ad.creative?.id || null,
        creativeName: ad.creative?.name || null,
        thumbnailUrl: ad.creative?.thumbnail_url || null,
        imageUrl: ad.creative?.image_url || null,
        objectStorySpec: ad.creative?.object_story_spec || null,
        assetFeedSpec: ad.creative?.asset_feed_spec || null,
      }
    } catch (error) {
      map[adId] = {
        adId,
        error: error.message,
      }
    }
  }

  return map
}

function latestById(rows, idKey) {
  const map = {}

  for (const row of rows) {
    const id = row[idKey]
    if (!id) continue

    if (!map[id] || row.date > map[id].date) {
      map[id] = row
    }
  }

  return map
}

function buildTree(campaignRows, adsetRows, adRows, creativeMap) {
  const latestCampaign = latestById(campaignRows, 'campaignId')
  const latestAdset = latestById(adsetRows, 'adsetId')
  const latestAd = latestById(adRows, 'adId')

  const campaigns = Object.values(latestCampaign).map(campaign => ({
    id: campaign.campaignId,
    name: campaign.campaignName,
    latest: campaign,
    weeks: campaignRows
      .filter(row => row.campaignId === campaign.campaignId)
      .sort((a, b) => a.date.localeCompare(b.date)),
    adsets: [],
  }))

  const campaignMap = Object.fromEntries(
    campaigns.map(campaign => [campaign.id, campaign])
  )

  for (const adset of Object.values(latestAdset)) {
    const campaign = campaignMap[adset.campaignId]
    if (!campaign) continue

    campaign.adsets.push({
      id: adset.adsetId,
      name: adset.adsetName,
      latest: adset,
      weeks: adsetRows
        .filter(row => row.adsetId === adset.adsetId)
        .sort((a, b) => a.date.localeCompare(b.date)),
      ads: [],
    })
  }

  const adsetMap = {}

  for (const campaign of campaigns) {
    for (const adset of campaign.adsets) {
      adsetMap[adset.id] = adset
    }
  }

  for (const ad of Object.values(latestAd)) {
    const adset = adsetMap[ad.adsetId]
    if (!adset) continue

    adset.ads.push({
      id: ad.adId,
      name: ad.adName,
      latest: ad,
      creative: creativeMap[ad.adId] || null,
      weeks: adRows
        .filter(row => row.adId === ad.adId)
        .sort((a, b) => a.date.localeCompare(b.date)),
    })
  }

  for (const campaign of campaigns) {
    campaign.adsets.sort((a, b) => b.latest.spend - a.latest.spend)

    for (const adset of campaign.adsets) {
      adset.ads.sort((a, b) => b.latest.spend - a.latest.spend)
    }
  }

  return campaigns.sort((a, b) => b.latest.spend - a.latest.spend)
}

export async function GET() {
  try {
    if (!META_TOKEN || !META_ACCOUNT) {
      return NextResponse.json(
        {
          campaigns: [],
          error: 'Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID',
        },
        { status: 200 }
      )
    }

    const { since, until } = getDateRange()

    const campaignRows = await fetchInsights('campaign', since, until)
    const adsetRows = await fetchInsights('adset', since, until)
    const adRows = await fetchInsights('ad', since, until)

    const creativeMap = await fetchAdsCreativeMap(adRows.map(row => row.adId))
    const campaigns = buildTree(campaignRows, adsetRows, adRows, creativeMap)

    return NextResponse.json(
      {
        campaigns,
        rawCounts: {
          campaignWeeks: campaignRows.length,
          adsetWeeks: adsetRows.length,
          adWeeks: adRows.length,
        },
        updatedAt: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        campaigns: [],
        error: error.message || 'Errore sconosciuto nella API Meta Detail',
      },
      { status: 500 }
    )
  }
}
