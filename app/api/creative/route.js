import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v20.0'

const ACCESS_TOKEN =
  process.env.META_ACCESS_TOKEN ||
  process.env.FACEBOOK_ACCESS_TOKEN ||
  process.env.FB_ACCESS_TOKEN ||
  ''

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
  const raw =
    process.env.META_AD_ACCOUNT_IDS ||
    process.env.META_AD_ACCOUNT_ID ||
    process.env.META_ACCOUNT_IDS ||
    process.env.META_ACCOUNTS ||
    process.env.META_ACCOUNT_ID ||
    ''

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

function getRange(preset) {
  const today = new Date(todayYMD())

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

  // Catena di fallback per link clicks (Meta a volte non popola
  // tutti i campi insieme — dipende dal tipo di campagna):
  // 1) inline_link_clicks (campo diretto, prioritario)
  // 2) azione 'link_click' (a volte solo questa è presente)
  // 3) clicks (TUTTI i click — fallback per non perdere il CPC quando
  //    Meta non separa i link click, p.es. campagne CPM)
  const linkClicks =
    toNum(row.inline_link_clicks) ||
    getActionValue(row.actions, [
      'link_click',
      'onsite_conversion.post_save',
    ]) ||
    toNum(row.clicks)

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

  const ctrLink = impressions ? (linkClicks / impressions) * 100 : toNum(row.ctr)
  const roas = spend ? purchaseValue / spend : 0
  const cpcLink = linkClicks ? spend / linkClicks : 0

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

function pickBestImageUrl({ creative = {}, fullCreative = {}, row = {} }) {
  return (
    fullCreative.image_url ||
    creative.image_url ||
    fullCreative.thumbnail_url ||
    creative.thumbnail_url ||
    row.image_url ||
    row.thumbnail_url ||
    null
  )
}

function pickPreviewImageUrl({ creative = {}, fullCreative = {}, row = {} }) {
  return (
    fullCreative.thumbnail_url ||
    creative.thumbnail_url ||
    fullCreative.image_url ||
    creative.image_url ||
    row.thumbnail_url ||
    row.image_url ||
    null
  )
}

async function hydrateCreatives(rows) {
  const limited = rows.slice(0, 200)

  const hydrated = await Promise.all(
    limited.map(async row => {
      try {
        if (!row.ad_id) return row

        const ad = await metaGet(row.ad_id, {
          fields: [
            'id',
            'name',
            'effective_status',
            'creative{id,name,thumbnail_url,image_url,object_story_spec,asset_feed_spec}',
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

        return {
          ...row,
          status: ad.effective_status || row.status,
          creative_id: creative.id || fullCreative.id || null,

          image_url: fullImageUrl,
          full_image_url: fullImageUrl,

          thumbnail_url: previewImageUrl,
          preview_image_url: previewImageUrl,

          display_image_url: fullImageUrl || previewImageUrl,
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

  return {
    creatives: rows.length,
    spend: round(spend, 2),
    revenue: round(purchaseValue, 2),
    roas: round(div(purchaseValue, spend), 2),
    ctr_link: round(impressions ? (linkClicks / impressions) * 100 : 0, 2),
    cpc_link: round(div(spend, linkClicks), 2),
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
  for (const account of accounts) {
    const rows = await metaGetAll(`${account}/insights`, {
      level: 'account',
      fields: 'spend,impressions,clicks,inline_link_clicks,actions,action_values',
      time_range: range,
      action_breakdowns: 'action_type',
    }, 100)
    for (const r of rows) {
      spend += toNum(r.spend)
      impressions += toNum(r.impressions)
      linkClicks += toNum(r.inline_link_clicks) ||
        getActionValue(r.actions, ['link_click', 'onsite_conversion.post_save']) ||
        toNum(r.clicks)
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
  return {
    spend: round(spend, 2),
    revenue: round(purchaseValue, 2),
    roas: round(div(purchaseValue, spend), 2),
    ctr_link: round(impressions ? (linkClicks / impressions) * 100 : 0, 2),
    cpc_link: round(div(spend, linkClicks), 2),
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
      fields: 'spend,impressions,clicks,inline_link_clicks,actions,action_values',
      time_range: range,
      time_increment: 1,
      action_breakdowns: 'action_type',
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
  try {
    const { searchParams } = new URL(req.url)

    const preset = searchParams.get('preset') || 'last_28d'
    const activeOnly = searchParams.get('active_only') !== 'false'
    const debug = searchParams.get('debug') === '1'

    const range = getRange(preset)
    const accounts = getAccountIds()

    if (!accounts.length) {
      return json({
        ok: false,
        error:
          'Nessun account Meta configurato. Aggiungi META_AD_ACCOUNT_IDS o META_AD_ACCOUNT_ID nelle Environment Variables di Vercel. Esempio: act_123,act_456',
        rows: [],
        summary: buildSummary([]),
        debug: debug ? getSafeEnvDebug() : undefined,
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
      'inline_link_clicks',
      'cpc',
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
          action_breakdowns: 'action_type',
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
    const [prevSummary, dailySeries] = await Promise.all([
      fetchAccountSummary(accounts, prevRange).catch(() => null),
      fetchDailySeries(accounts, range).catch(() => []),
    ])

    return json({
      ok: true,
      preset,
      range,
      prevRange,
      accounts,
      rows: merged,
      summary: buildSummary(merged),
      prevSummary,
      dailySeries,
      debug: debug ? getSafeEnvDebug() : undefined,
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
}
