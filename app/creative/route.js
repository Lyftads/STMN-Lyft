export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNTS_RAW = process.env.META_AD_ACCOUNT_ID

const GRAPH_VERSION = 'v19.0'

function json(data, status = 200) {
  return NextResponse.json(data, { status })
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function getRange(preset) {
  const today = new Date()

  if (preset === 'today') {
    return {
      since: fmtDate(today),
      until: fmtDate(today),
    }
  }

  if (preset === 'yesterday') {
    const y = addDays(today, -1)
    return {
      since: fmtDate(y),
      until: fmtDate(y),
    }
  }

  if (preset === 'last_7d') {
    return {
      since: fmtDate(addDays(today, -6)),
      until: fmtDate(today),
    }
  }

  if (preset === 'last_14d') {
    return {
      since: fmtDate(addDays(today, -13)),
      until: fmtDate(today),
    }
  }

  if (preset === 'last_28d') {
    return {
      since: fmtDate(addDays(today, -27)),
      until: fmtDate(today),
    }
  }

  if (preset === 'this_month') {
    return {
      since: fmtDate(startOfMonth(today)),
      until: fmtDate(today),
    }
  }

  if (preset === 'last_month') {
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    return {
      since: fmtDate(startOfMonth(lastMonthDate)),
      until: fmtDate(endOfMonth(lastMonthDate)),
    }
  }

  return {
    since: fmtDate(addDays(today, -27)),
    until: fmtDate(today),
  }
}

function getPreviousRange(range) {
  const since = new Date(range.since)
  const until = new Date(range.until)

  const days =
    Math.round((until.getTime() - since.getTime()) / (1000 * 60 * 60 * 24)) + 1

  const previousUntil = addDays(since, -1)
  const previousSince = addDays(previousUntil, -(days - 1))

  return {
    since: fmtDate(previousSince),
    until: fmtDate(previousUntil),
  }
}

function getAccounts() {
  if (!META_ACCOUNTS_RAW) return []

  return META_ACCOUNTS_RAW
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(id => (id.startsWith('act_') ? id : `act_${id}`))
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function getActionValue(actions, names) {
  if (!Array.isArray(actions)) return 0

  for (const name of names) {
    const found = actions.find(a => a.action_type === name)
    if (found) return num(found.value)
  }

  return 0
}

function getThumbnailFromCreative(creative) {
  if (!creative) return null

  if (creative.thumbnail_url) return creative.thumbnail_url
  if (creative.image_url) return creative.image_url

  const spec = creative.object_story_spec || {}

  if (spec.link_data?.picture) return spec.link_data.picture
  if (spec.video_data?.image_url) return spec.video_data.image_url
  if (spec.photo_data?.url) return spec.photo_data.url

  return null
}

async function graph(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  }

  url.searchParams.set('access_token', META_TOKEN)

  const res = await fetch(url.toString(), {
    cache: 'no-store',
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    const message = data?.error?.message || `Meta API error ${res.status}`
    throw new Error(message)
  }

  return data
}

async function fetchActiveAds(accountId) {
  const fields = [
    'id',
    'name',
    'status',
    'effective_status',
    'campaign_id',
    'adset_id',
    'creative{thumbnail_url,image_url,object_story_spec}',
    'campaign{id,name,status,effective_status}',
    'adset{id,name,status,effective_status}',
  ].join(',')

  const filtering = JSON.stringify([
    {
      field: 'effective_status',
      operator: 'IN',
      value: ['ACTIVE'],
    },
  ])

  let urlPath = `${accountId}/ads`
  let after = null
  let rows = []
  let pageCount = 0

  while (pageCount < 5) {
    const params = {
      fields,
      filtering,
      limit: 100,
    }

    if (after) params.after = after

    const data = await graph(urlPath, params)

    rows = rows.concat(data.data || [])

    after = data?.paging?.cursors?.after
    pageCount += 1

    if (!after) break
  }

  return rows.map(ad => ({
    id: ad.id,
    ad_id: ad.id,
    name: ad.name || 'Ad senza nome',
    ad_name: ad.name || 'Ad senza nome',
    status: ad.effective_status || ad.status || null,

    account_id: accountId,

    campaign_id: ad.campaign_id || ad.campaign?.id || null,
    campaign_name: ad.campaign?.name || 'Campagna senza nome',
    campaign_status: ad.campaign?.effective_status || ad.campaign?.status || null,

    adset_id: ad.adset_id || ad.adset?.id || null,
    adset_name: ad.adset?.name || 'Ad set senza nome',
    adset_status: ad.adset?.effective_status || ad.adset?.status || null,

    thumbnail_url: getThumbnailFromCreative(ad.creative),
  }))
}

async function fetchAdInsights(accountId, range) {
  const fields = [
    'ad_id',
    'ad_name',
    'adset_id',
    'adset_name',
    'campaign_id',
    'campaign_name',
    'impressions',
    'reach',
    'frequency',
    'cpm',
    'inline_link_click_ctr',
    'cost_per_inline_link_click',
    'inline_link_clicks',
    'spend',
    'actions',
    'action_values',
  ].join(',')

  const filtering = JSON.stringify([
    {
      field: 'ad.effective_status',
      operator: 'IN',
      value: ['ACTIVE'],
    },
  ])

  const timeRange = JSON.stringify({
    since: range.since,
    until: range.until,
  })

  let after = null
  let rows = []
  let pageCount = 0

  while (pageCount < 5) {
    const params = {
      fields,
      level: 'ad',
      time_range: timeRange,
      filtering,
      limit: 500,
    }

    if (after) params.after = after

    const data = await graph(`${accountId}/insights`, params)

    rows = rows.concat(data.data || [])

    after = data?.paging?.cursors?.after
    pageCount += 1

    if (!after) break
  }

  return rows
}

function normalizeInsight(row, accountId) {
  const spend = num(row.spend)
  const impressions = num(row.impressions)
  const reach = num(row.reach)
  const linkClicks = num(row.inline_link_clicks)

  const purchases = getActionValue(row.actions, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
  ])

  const purchaseValue = getActionValue(row.action_values, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
  ])

  const ctrLink = num(row.inline_link_click_ctr)
  const cpcLink = num(row.cost_per_inline_link_click)

  const roas = spend > 0 ? purchaseValue / spend : 0
  const costPerResult = purchases > 0 ? spend / purchases : 0
  const conversioneAcquisti = linkClicks > 0 ? (purchases / linkClicks) * 100 : 0
  const aov = purchases > 0 ? purchaseValue / purchases : 0

  return {
    id: row.ad_id,
    ad_id: row.ad_id,
    name: row.ad_name || 'Ad senza nome',
    ad_name: row.ad_name || 'Ad senza nome',

    account_id: accountId,

    campaign_id: row.campaign_id || null,
    campaign_name: row.campaign_name || 'Campagna senza nome',

    adset_id: row.adset_id || null,
    adset_name: row.adset_name || 'Ad set senza nome',

    impressions,
    reach,
    frequency: num(row.frequency),
    cpm: num(row.cpm),
    ctr_link: ctrLink,
    cpc_link: cpcLink,
    link_clicks: linkClicks,
    spend,

    purchases,
    orders: purchases,
    purchase_value: purchaseValue,
    roas,
    cost_per_result: costPerResult,
    conversione_acquisti: conversioneAcquisti,
    cro_campagna: conversioneAcquisti,
    aov_campagna: aov,

    thumbnail_url: null,
    status: 'ACTIVE',
  }
}

function mergeAdsWithInsights(activeAds, insights) {
  const activeMap = new Map()

  for (const ad of activeAds) {
    activeMap.set(ad.id, ad)
  }

  const rows = []

  for (const insight of insights) {
    const base = activeMap.get(insight.id)

    if (!base) continue

    rows.push({
      ...insight,
      name: base.name || insight.name,
      ad_name: base.ad_name || insight.ad_name,

      campaign_id: base.campaign_id || insight.campaign_id,
      campaign_name: base.campaign_name || insight.campaign_name,

      adset_id: base.adset_id || insight.adset_id,
      adset_name: base.adset_name || insight.adset_name,

      thumbnail_url: base.thumbnail_url || null,
      status: base.status || 'ACTIVE',
    })
  }

  return rows
}

function summarize(rows) {
  const spend = rows.reduce((s, r) => s + num(r.spend), 0)
  const impressions = rows.reduce((s, r) => s + num(r.impressions), 0)
  const reach = rows.reduce((s, r) => s + num(r.reach), 0)
  const linkClicks = rows.reduce((s, r) => s + num(r.link_clicks), 0)
  const purchases = rows.reduce((s, r) => s + num(r.purchases), 0)
  const purchaseValue = rows.reduce((s, r) => s + num(r.purchase_value), 0)

  return {
    creatives: rows.length,
    spend,
    impressions,
    reach,
    link_clicks: linkClicks,
    purchases,
    orders: purchases,
    purchase_value: purchaseValue,
    ctr_link: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
    cpc_link: linkClicks > 0 ? spend / linkClicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    frequency: reach > 0 ? impressions / reach : 0,
    roas: spend > 0 ? purchaseValue / spend : 0,
    cost_per_result: purchases > 0 ? spend / purchases : 0,
  }
}

export async function GET(req) {
  try {
    if (!META_TOKEN) {
      return json({
        ok: false,
        error: 'META_ACCESS_TOKEN mancante',
        rows: [],
        summary: summarize([]),
      }, 400)
    }

    const accounts = getAccounts()

    if (accounts.length === 0) {
      return json({
        ok: false,
        error: 'META_AD_ACCOUNT_ID mancante',
        rows: [],
        summary: summarize([]),
      }, 400)
    }

    const { searchParams } = new URL(req.url)

    const preset = searchParams.get('preset') || 'last_28d'
    const range = getRange(preset)
    const previousRange = getPreviousRange(range)

    const accountResults = await Promise.all(
      accounts.map(async accountId => {
        const [activeAdsRaw, insightsRaw] = await Promise.all([
          fetchActiveAds(accountId),
          fetchAdInsights(accountId, range),
        ])

        const insights = insightsRaw.map(row => normalizeInsight(row, accountId))
        const rows = mergeAdsWithInsights(activeAdsRaw, insights)

        return rows
      })
    )

    const rows = accountResults
      .flat()
      .sort((a, b) => num(b.spend) - num(a.spend))

    const summary = summarize(rows)

    return json({
      ok: true,
      preset,
      range,
      previousRange,
      accounts,
      rows,
      summary,
      sources: {
        meta: true,
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return json({
      ok: false,
      error: err.message || 'Errore API Creative',
      rows: [],
      summary: summarize([]),
      sources: {
        meta: false,
      },
    }, 500)
  }
}
