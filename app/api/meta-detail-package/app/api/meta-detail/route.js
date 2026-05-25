export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID
const API_VERSION = process.env.META_API_VERSION || 'v19.0'
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
    .filter(a => keys.includes(a.action_type))
    .reduce((sum, a) => sum + n(a.value), 0)
}

function getOutboundClicks(row) {
  if (Array.isArray(row.outbound_clicks)) {
    const found = row.outbound_clicks.find(x => x.action_type === 'outbound_click')
    return n(found?.value)
  }

  return 0
}

function getCostPerOutboundClick(row) {
  if (Array.isArray(row.cost_per_outbound_click)) {
    const found = row.cost_per_outbound_click.find(x => x.action_type === 'outbound_click')
    return n(found?.value)
  }

  return 0
}

function getPurchaseValue(row) {
  const fromActionValues = getActionValue(row.action_values, PURCHASE_KEYS)
  if (fromActionValues > 0) return fromActionValues

  return 0
}

function getPurchaseRoas(row) {
  if (!Array.isArray(row.purchase_roas)) return 0

  const best = row.purchase_roas.find(x => PURCHASE_KEYS.includes(x.action_type)) || row.purchase_roas[0]
  return n(best?.value)
}

function getCostPerPurchase(row) {
  if (!Array.isArray(row.cost_per_action_type)) return 0

  const found = row.cost_per_action_type.find(x => PURCHASE_KEYS.includes(x.action_type))
  return n(found?.value)
}

function normalizeInsight(row, level) {
  const linkClicks = getOutboundClicks(row)
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
    ctrLink: r4(row.outbound_ctr?.[0]?.value || 0),
    cpcLink: r2(getCostPerOutboundClick(row)),
    linkClicks: Math.round(linkClicks),

    costPerResult: r2(getCostPerPurchase(row)),
    roas: r4(getPurchaseRoas(row)),
    purchaseValue: r2(purchaseValue),
    purchaseConversions: r2(purchases),
    purchases: r2(purchases),
    addToCart: r2(addToCart),
    cro: linkClicks > 0 ? r4((purchases / linkClicks) * 100) : null,
    aov: purchases > 0 ? r2(purchaseValue / purchases) : null,
  }
}

function weekRanges() {
  const weeks = []
  let d = new Date(`${WEEKLY_START_DATE}T00:00:00Z`)
  const now = new Date()

  while (d <= now) {
    const start = new Date(d)
    const end = new Date(d)
    end.setUTCDate(end.getUTCDate() + 6)

    weeks.push({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    })

    d.setUTCDate(d.getUTCDate() + 7)
  }

  return weeks
}

async function metaFetch(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value)
  }

  url.searchParams.set('access_token', META_TOKEN)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const json = await res.json()

  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Meta API error: ${res.status}`)
  }

  return json
}

async function fetchPaged(path, params = {}) {
  let json = await metaFetch(path, params)
  const data = [...(json.data || [])]

  while (json.paging?.next) {
    const res = await fetch(json.paging.next, { cache: 'no-store' })
    json = await res.json()

    if (json.error) throw new Error(json.error.message)
    data.push(...(json.data || []))
  }

  return data
}

async function fetchInsights(level, since, until) {
  const accounts = String(META_ACCOUNT || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)

  if (!META_TOKEN || accounts.length === 0) return []

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
    'outbound_ctr',
    'outbound_clicks',
    'cost_per_outbound_click',
    'cost_per_action_type',
    'actions',
    'action_values',
    'purchase_roas',
    'date_start',
    'date_stop',
  ].join(',')

  const rows = []

  for (const account of accounts) {
    const data = await fetchPaged(`${account}/insights`, {
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

  await Promise.all(
    ids.map(async adId => {
      try {
        const ad = await metaFetch(adId, {
          fields: 'id,name,effective_status,creative{id,name,thumbnail_url,image_url,object_story_spec,asset_feed_spec}',
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
      } catch (e) {
        map[adId] = { adId, error: e.message }
      }
    })
  )

  return map
}

function latestById(rows, idKey) {
  const map = {}

  for (const row of rows) {
    const id = row[idKey]
    if (!id) continue
    if (!map[id] || row.date > map[id].date) map[id] = row
  }

  return map
}

function buildTree(campaignRows, adsetRows, adRows, creativeMap) {
  const latestCampaign = latestById(campaignRows, 'campaignId')
  const latestAdset = latestById(adsetRows, 'adsetId')
  const latestAd = latestById(adRows, 'adId')

  const campaigns = Object.values(latestCampaign).map(c => ({
    id: c.campaignId,
    name: c.campaignName,
    latest: c,
    weeks: campaignRows.filter(w => w.campaignId === c.campaignId).sort((a, b) => a.date.localeCompare(b.date)),
    adsets: [],
  }))

  const campaignMap = Object.fromEntries(campaigns.map(c => [c.id, c]))

  for (const adset of Object.values(latestAdset)) {
    const campaign = campaignMap[adset.campaignId]
    if (!campaign) continue

    campaign.adsets.push({
      id: adset.adsetId,
      name: adset.adsetName,
      latest: adset,
      weeks: adsetRows.filter(w => w.adsetId === adset.adsetId).sort((a, b) => a.date.localeCompare(b.date)),
      ads: [],
    })
  }

  const adsetMap = {}
  for (const campaign of campaigns) {
    for (const adset of campaign.adsets) adsetMap[adset.id] = adset
  }

  for (const ad of Object.values(latestAd)) {
    const adset = adsetMap[ad.adsetId]
    if (!adset) continue

    adset.ads.push({
      id: ad.adId,
      name: ad.adName,
      latest: ad,
      creative: creativeMap[ad.adId] || null,
      weeks: adRows.filter(w => w.adId === ad.adId).sort((a, b) => a.date.localeCompare(b.date)),
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
      return NextResponse.json({ campaigns: [], error: 'Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID' }, { status: 200 })
    }

    const ranges = weekRanges()
    const since = ranges[0]?.start || WEEKLY_START_DATE
    const until = ranges[ranges.length - 1]?.end || new Date().toISOString().slice(0, 10)

    const [campaignRows, adsetRows, adRows] = await Promise.all([
      fetchInsights('campaign', since, until),
      fetchInsights('adset', since, until),
      fetchInsights('ad', since, until),
    ])

    const creativeMap = await fetchAdsCreativeMap(adRows.map(r => r.adId))
    const campaigns = buildTree(campaignRows, adsetRows, adRows, creativeMap)

    return NextResponse.json({
      campaigns,
      rawCounts: {
        campaignWeeks: campaignRows.length,
        adsetWeeks: adsetRows.length,
        adWeeks: adRows.length,
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
