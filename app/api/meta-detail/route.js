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

function toISO(date) {
  return date.toISOString().slice(0, 10)
}

function parseDate(value) {
  const d = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function daysBetweenInclusive(start, end) {
  const ms = end.getTime() - start.getTime()
  return Math.floor(ms / 86400000) + 1
}

function addDays(date, days) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function getDefaultDates() {
  const today = new Date()
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const start = addDays(end, -6)

  return {
    start: toISO(start),
    end: toISO(end),
  }
}

function getDateRange(searchParams) {
  const defaults = getDefaultDates()

  const startParam =
    searchParams.get('start') ||
    searchParams.get('since') ||
    searchParams.get('dateStart') ||
    defaults.start

  const endParam =
    searchParams.get('end') ||
    searchParams.get('until') ||
    searchParams.get('dateStop') ||
    defaults.end

  const startDate = parseDate(startParam) || parseDate(defaults.start)
  const endDate = parseDate(endParam) || parseDate(defaults.end)

  const safeStart = startDate <= endDate ? startDate : endDate
  const safeEnd = startDate <= endDate ? endDate : startDate

  const days = daysBetweenInclusive(safeStart, safeEnd)

  const previousEnd = addDays(safeStart, -1)
  const previousStart = addDays(previousEnd, -(days - 1))

  return {
    current: {
      start: toISO(safeStart),
      end: toISO(safeEnd),
    },
    previous: {
      start: toISO(previousStart),
      end: toISO(previousEnd),
    },
    days,
  }
}

function getActionValue(actions, keys) {
  if (!Array.isArray(actions)) return 0

  return actions.reduce((sum, action) => {
    if (keys.includes(action.action_type)) {
      return sum + n(action.value)
    }

    return sum
  }, 0)
}

function getPurchaseValue(row) {
  if (Array.isArray(row.action_values)) {
    const value = row.action_values.reduce((sum, action) => {
      if (PURCHASE_KEYS.includes(action.action_type)) {
        return sum + n(action.value)
      }

      return sum
    }, 0)

    if (value > 0) return value
  }

  if (Array.isArray(row.conversion_values)) {
    return row.conversion_values.reduce((sum, action) => {
      if (PURCHASE_KEYS.includes(action.action_type)) {
        return sum + n(action.value)
      }

      return sum
    }, 0)
  }

  return 0
}

function normalizeInsight(row, level, dateStart, dateStop) {
  const spend = n(row.spend)
  const impressions = n(row.impressions)
  const reach = n(row.reach)
  const frequency = n(row.frequency)
  const cpm = n(row.cpm)

  const ctrLink = n(row.inline_link_click_ctr)
  const cpcLink = n(row.cost_per_inline_link_click)
  const linkClicks = n(row.inline_link_clicks)

  const costPerResult = n(row.cost_per_result)

  const purchases = getActionValue(row.actions, PURCHASE_KEYS)
  const purchaseConversions = getActionValue(row.conversions, PURCHASE_KEYS) || purchases
  const addToCart = getActionValue(row.actions, ADD_TO_CART_KEYS)

  const purchaseValue = getPurchaseValue(row)
  const roas = spend > 0 ? purchaseValue / spend : 0
  const cro = linkClicks > 0 ? (purchases / linkClicks) * 100 : 0
  const aov = purchases > 0 ? purchaseValue / purchases : 0

  return {
    level,

    date: dateStart,
    dateStart,
    dateStop,

    campaignId: row.campaign_id || null,
    campaignName: row.campaign_name || null,

    adsetId: row.adset_id || null,
    adsetName: row.adset_name || null,

    adId: row.ad_id || null,
    adName: row.ad_name || null,

    spend: r2(spend),
    impressions: Math.round(impressions),
    reach: Math.round(reach),
    frequency: r2(frequency),
    cpm: r2(cpm),
    ctrLink: r2(ctrLink),
    cpcLink: r2(cpcLink),
    linkClicks: Math.round(linkClicks),
    costPerResult: r2(costPerResult),
    roas: r2(roas),
    purchaseValue: r2(purchaseValue),
    purchaseConversions: Math.round(purchaseConversions),
    purchases: Math.round(purchases),
    addToCart: Math.round(addToCart),
    cro: r2(cro),
    aov: r2(aov),
  }
}

function emptyMetric(level, id, name) {
  return {
    level,

    date: null,
    dateStart: null,
    dateStop: null,

    campaignId: level === 'campaign' ? id : null,
    campaignName: level === 'campaign' ? name : null,

    adsetId: level === 'adset' ? id : null,
    adsetName: level === 'adset' ? name : null,

    adId: level === 'ad' ? id : null,
    adName: level === 'ad' ? name : null,

    spend: 0,
    impressions: 0,
    reach: 0,
    frequency: 0,
    cpm: 0,
    ctrLink: 0,
    cpcLink: 0,
    linkClicks: 0,
    costPerResult: 0,
    roas: 0,
    purchaseValue: 0,
    purchaseConversions: 0,
    purchases: 0,
    addToCart: 0,
    cro: 0,
    aov: 0,
  }
}

function deltaValue(current, previous) {
  const currentNum = n(current)
  const previousNum = n(previous)
  const value = r2(currentNum - previousNum)
  const pct = previousNum !== 0 ? r2(((currentNum - previousNum) / previousNum) * 100) : null

  return {
    value,
    pct,
  }
}

function buildDelta(current, previous) {
  const fields = [
    'spend',
    'impressions',
    'reach',
    'frequency',
    'cpm',
    'ctrLink',
    'cpcLink',
    'linkClicks',
    'costPerResult',
    'roas',
    'purchaseValue',
    'purchaseConversions',
    'purchases',
    'addToCart',
    'cro',
    'aov',
  ]

  const delta = {}

  fields.forEach((field) => {
    delta[field] = deltaValue(current?.[field], previous?.[field])
  })

  return delta
}

function mergeRows(rows) {
  const total = {
    spend: 0,
    impressions: 0,
    reach: 0,
    frequency: 0,
    cpm: 0,
    ctrLink: 0,
    cpcLink: 0,
    linkClicks: 0,
    costPerResult: 0,
    roas: 0,
    purchaseValue: 0,
    purchaseConversions: 0,
    purchases: 0,
    addToCart: 0,
    cro: 0,
    aov: 0,
  }

  rows.forEach((row) => {
    total.spend += n(row.spend)
    total.impressions += n(row.impressions)
    total.reach += n(row.reach)
    total.linkClicks += n(row.linkClicks)
    total.purchaseValue += n(row.purchaseValue)
    total.purchaseConversions += n(row.purchaseConversions)
    total.purchases += n(row.purchases)
    total.addToCart += n(row.addToCart)
  })

  total.frequency = total.reach > 0 ? total.impressions / total.reach : 0
  total.cpm = total.impressions > 0 ? (total.spend / total.impressions) * 1000 : 0
  total.ctrLink = total.impressions > 0 ? (total.linkClicks / total.impressions) * 100 : 0
  total.cpcLink = total.linkClicks > 0 ? total.spend / total.linkClicks : 0
  total.costPerResult = total.purchases > 0 ? total.spend / total.purchases : 0
  total.roas = total.spend > 0 ? total.purchaseValue / total.spend : 0
  total.cro = total.linkClicks > 0 ? (total.purchases / total.linkClicks) * 100 : 0
  total.aov = total.purchases > 0 ? total.purchaseValue / total.purchases : 0

  Object.keys(total).forEach((key) => {
    total[key] = key === 'impressions' ||
      key === 'reach' ||
      key === 'linkClicks' ||
      key === 'purchaseConversions' ||
      key === 'purchases' ||
      key === 'addToCart'
      ? Math.round(total[key])
      : r2(total[key])
  })

  return total
}

function getId(row, level) {
  if (level === 'campaign') return row.campaignId
  if (level === 'adset') return row.adsetId
  return row.adId
}

function getName(row, level) {
  if (level === 'campaign') return row.campaignName
  if (level === 'adset') return row.adsetName
  return row.adName
}

async function metaFetch(path, params) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  url.searchParams.set('access_token', META_TOKEN)

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  })

  const text = await response.text()

  let json = null

  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`Meta non ha restituito JSON valido. Status ${response.status}. Risposta: ${text.slice(0, 500)}`)
  }

  if (!response.ok || json?.error) {
    throw new Error(json?.error?.message || `Errore Meta API. Status ${response.status}`)
  }

  return json
}

async function metaFetchAll(path, params) {
  let json = await metaFetch(path, params)
  const data = Array.isArray(json.data) ? [...json.data] : []

  while (json?.paging?.next) {
    const response = await fetch(json.paging.next, {
      method: 'GET',
      cache: 'no-store',
    })

    const text = await response.text()

    try {
      json = text ? JSON.parse(text) : null
    } catch {
      throw new Error(`Meta paging non ha restituito JSON valido. Risposta: ${text.slice(0, 500)}`)
    }

    if (!response.ok || json?.error) {
      throw new Error(json?.error?.message || 'Errore Meta API durante il paging')
    }

    if (Array.isArray(json.data)) {
      data.push(...json.data)
    }
  }

  return data
}

async function fetchInsights(level, range, timeIncrement = null) {
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
    'cost_per_result',
    'actions',
    'action_values',
    'conversions',
    'conversion_values',
  ]

  const params = {
    level,
    fields: fields.join(','),
    time_range: JSON.stringify({
      since: range.start,
      until: range.end,
    }),
    limit: '500',
  }

  if (timeIncrement) {
    params.time_increment = String(timeIncrement)
  }

  const rawRows = await metaFetchAll(`act_${META_ACCOUNT}/insights`, params)

  return rawRows.map((row) => {
    const dateStart = row.date_start || range.start
    const dateStop = row.date_stop || range.end

    return normalizeInsight(row, level, dateStart, dateStop)
  })
}

async function fetchActiveCampaigns() {
  const rows = await metaFetchAll(`act_${META_ACCOUNT}/campaigns`, {
    fields: 'id,name,status,effective_status',
    filtering: JSON.stringify([
      {
        field: 'effective_status',
        operator: 'IN',
        value: ['ACTIVE'],
      },
    ]),
    limit: '500',
  })

  return rows.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    effectiveStatus: campaign.effective_status,
  }))
}

async function fetchActiveAdsets() {
  const rows = await metaFetchAll(`act_${META_ACCOUNT}/adsets`, {
    fields: 'id,name,campaign_id,status,effective_status',
    filtering: JSON.stringify([
      {
        field: 'effective_status',
        operator: 'IN',
        value: ['ACTIVE'],
      },
    ]),
    limit: '500',
  })

  return rows.map((adset) => ({
    id: adset.id,
    name: adset.name,
    campaignId: adset.campaign_id,
    status: adset.status,
    effectiveStatus: adset.effective_status,
  }))
}

async function fetchActiveAds() {
  const rows = await metaFetchAll(`act_${META_ACCOUNT}/ads`, {
    fields: 'id,name,campaign_id,adset_id,status,effective_status,creative{id,name,thumbnail_url,object_story_spec}',
    filtering: JSON.stringify([
      {
        field: 'effective_status',
        operator: 'IN',
        value: ['ACTIVE'],
      },
    ]),
    limit: '500',
  })

  return rows.map((ad) => ({
    id: ad.id,
    name: ad.name,
    campaignId: ad.campaign_id,
    adsetId: ad.adset_id,
    status: ad.status,
    effectiveStatus: ad.effective_status,
    creative: ad.creative || null,
  }))
}

function indexById(rows, level) {
  const map = new Map()

  rows.forEach((row) => {
    const id = getId(row, level)

    if (id) {
      map.set(id, row)
    }
  })

  return map
}

function groupBy(rows, key) {
  const map = new Map()

  rows.forEach((row) => {
    const id = row[key]

    if (!id) return

    if (!map.has(id)) {
      map.set(id, [])
    }

    map.get(id).push(row)
  })

  return map
}

function attachComparison(currentRow, previousRow, level, fallbackId, fallbackName) {
  const current = currentRow || emptyMetric(level, fallbackId, fallbackName)
  const previous = previousRow || emptyMetric(level, fallbackId, fallbackName)

  return {
    ...current,
    latest: current,
    previous,
    delta: buildDelta(current, previous),
  }
}

function makeSeries(currentWeeklyRows, previousWeeklyRows, level, fallbackId, fallbackName) {
  const previousByDate = new Map()

  previousWeeklyRows.forEach((row) => {
    previousByDate.set(row.dateStart, row)
  })

  return currentWeeklyRows.map((current) => {
    const previous = previousByDate.get(current.dateStart) || emptyMetric(level, fallbackId, fallbackName)

    return {
      ...current,
      latest: current,
      previous,
      delta: buildDelta(current, previous),
    }
  })
}

function buildTree({
  activeCampaigns,
  activeAdsets,
  activeAds,
  currentCampaignRows,
  previousCampaignRows,
  currentAdsetRows,
  previousAdsetRows,
  currentAdRows,
  previousAdRows,
  weeklyCampaignRows,
}) {
  const previousCampaignById = indexById(previousCampaignRows, 'campaign')
  const currentCampaignById = indexById(currentCampaignRows, 'campaign')

  const previousAdsetById = indexById(previousAdsetRows, 'adset')
  const currentAdsetById = indexById(currentAdsetRows, 'adset')

  const previousAdById = indexById(previousAdRows, 'ad')
  const currentAdById = indexById(currentAdRows, 'ad')

  const adsetsByCampaign = groupBy(activeAdsets, 'campaignId')
  const adsByAdset = groupBy(activeAds, 'adsetId')
  const weeklyByCampaign = groupBy(weeklyCampaignRows, 'campaignId')

  return activeCampaigns.map((campaign) => {
    const latestCampaign = currentCampaignById.get(campaign.id)
    const previousCampaign = previousCampaignById.get(campaign.id)

    const campaignNode = attachComparison(
      latestCampaign,
      previousCampaign,
      'campaign',
      campaign.id,
      campaign.name
    )

    const campaignWeeklyRows = weeklyByCampaign.get(campaign.id) || []

    campaignNode.weeks = makeSeries(
      campaignWeeklyRows,
      [],
      'campaign',
      campaign.id,
      campaign.name
    )

    campaignNode.id = campaign.id
    campaignNode.name = campaign.name
    campaignNode.campaignId = campaign.id
    campaignNode.campaignName = campaign.name

    campaignNode.adsets = (adsetsByCampaign.get(campaign.id) || []).map((adset) => {
      const latestAdset = currentAdsetById.get(adset.id)
      const previousAdset = previousAdsetById.get(adset.id)

      const adsetNode = attachComparison(
        latestAdset,
        previousAdset,
        'adset',
        adset.id,
        adset.name
      )

      adsetNode.id = adset.id
      adsetNode.name = adset.name
      adsetNode.campaignId = campaign.id
      adsetNode.campaignName = campaign.name
      adsetNode.adsetId = adset.id
      adsetNode.adsetName = adset.name

      adsetNode.ads = (adsByAdset.get(adset.id) || []).map((ad) => {
        const latestAd = currentAdById.get(ad.id)
        const previousAd = previousAdById.get(ad.id)

        const adNode = attachComparison(
          latestAd,
          previousAd,
          'ad',
          ad.id,
          ad.name
        )

        adNode.id = ad.id
        adNode.name = ad.name
        adNode.campaignId = campaign.id
        adNode.campaignName = campaign.name
        adNode.adsetId = adset.id
        adNode.adsetName = adset.name
        adNode.adId = ad.id
        adNode.adName = ad.name
        adNode.creative = ad.creative

        return adNode
      })

      return adsetNode
    })

    return campaignNode
  })
}

function buildTotals(rows, previousRows) {
  const latest = mergeRows(rows)
  const previous = mergeRows(previousRows)

  return {
    latest,
    previous,
    delta: buildDelta(latest, previous),
  }
}

export async function GET(request) {
  try {
    if (!META_TOKEN || !META_ACCOUNT) {
      return NextResponse.json(
        {
          campaigns: [],
          error: 'Mancano META_ACCESS_TOKEN o META_AD_ACCOUNT_ID nelle variabili ambiente.',
        },
        { status: 200 }
      )
    }

    const { searchParams } = new URL(request.url)
    const range = getDateRange(searchParams)

    const [
      activeCampaigns,
      activeAdsets,
      activeAds,

      currentCampaignRows,
      previousCampaignRows,

      currentAdsetRows,
      previousAdsetRows,

      currentAdRows,
      previousAdRows,

      weeklyCampaignRows,
    ] = await Promise.all([
      fetchActiveCampaigns(),
      fetchActiveAdsets(),
      fetchActiveAds(),

      fetchInsights('campaign', range.current),
      fetchInsights('campaign', range.previous),

      fetchInsights('adset', range.current),
      fetchInsights('adset', range.previous),

      fetchInsights('ad', range.current),
      fetchInsights('ad', range.previous),

      fetchInsights('campaign', range.current, 1),
    ])

    const campaigns = buildTree({
      activeCampaigns,
      activeAdsets,
      activeAds,
      currentCampaignRows,
      previousCampaignRows,
      currentAdsetRows,
      previousAdsetRows,
      currentAdRows,
      previousAdRows,
      weeklyCampaignRows,
    })

    const totals = buildTotals(currentCampaignRows, previousCampaignRows)

    return NextResponse.json({
      range: {
        current: range.current,
        previous: range.previous,
        days: range.days,
      },
      updatedAt: new Date().toISOString(),
      totals,
      campaigns,
    })
  } catch (error) {
    return NextResponse.json(
      {
        campaigns: [],
        error: error?.message || 'Errore sconosciuto nella route Meta Detail.',
      },
      { status: 200 }
    )
  }
}
