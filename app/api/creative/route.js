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
  const s = String(id).trim()
  if (!s) return null
  return s.startsWith('act_') ? s : `act_${s}`
}

function getAccountIds() {
  const raw =
    process.env.META_AD_ACCOUNT_IDS ||
    process.env.META_ACCOUNT_IDS ||
    process.env.META_ACCOUNTS ||
    process.env.META_ACCOUNT_ID ||
    ''

  return raw
    .split(',')
    .map(cleanAccountId)
    .filter(Boolean)
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
      url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value))
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
    const res = await fetch(next, { cache: 'no-store' })
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
  const linkClicks = getActionValue(row.actions, [
    'link_click',
    'onsite_conversion.post_save',
  ])

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

    thumbnail_url: null,
    image_url: null,
    creative_id: null,
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
            'creative{id,name,thumbnail_url,image_url,object_story_spec}',
          ].join(','),
        })

        const creative = ad.creative || {}

        return {
          ...row,
          status: ad.effective_status || row.status,
          creative_id: creative.id || null,
          thumbnail_url:
            creative.thumbnail_url ||
            creative.image_url ||
            row.thumbnail_url ||
            null,
          image_url:
            creative.image_url ||
            creative.thumbnail_url ||
            row.image_url ||
            null,
        }
      } catch {
        return row
      }
    })
  )

  return hydrated
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
    roas: round(div(purchaseValue, spend), 2),
    ctr_link: round(impressions ? (linkClicks / impressions) * 100 : 0, 2),
    orders: round(orders, 0),
    purchases: round(orders, 0),
    purchase_value: round(purchaseValue, 2),
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)

    const preset = searchParams.get('preset') || 'last_28d'
    const activeOnly = searchParams.get('active_only') !== 'false'
    const range = getRange(preset)

    const accounts = getAccountIds()

    if (!accounts.length) {
      return json({
        ok: false,
        error:
          'Nessun account Meta configurato. Aggiungi META_AD_ACCOUNT_IDS nelle Environment Variables di Vercel. Esempio: act_123,act_456',
        rows: [],
        summary: buildSummary([]),
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
      'actions',
      'action_values',
    ].join(',')

    let allRows = []

    for (const account of accounts) {
      const rows = await metaGetAll(`${account}/insights`, {
        level: 'ad',
        fields,
        time_range: range,
        action_breakdowns: 'action_type',
      }, 500)

      allRows = allRows.concat(rows.map(r => normalizeInsight(r, account)))
    }

    let merged = mergeByAd(allRows)

    if (activeOnly) {
      merged = await hydrateCreatives(merged)
      merged = merged.filter(r => {
        const status = String(r.status || '').toUpperCase()
        return !status || status === 'ACTIVE'
      })
    } else {
      merged = await hydrateCreatives(merged)
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

    return json({
      ok: true,
      preset,
      range,
      accounts,
      rows: merged,
      summary: buildSummary(merged),
    })
  } catch (e) {
    return json({
      ok: false,
      error: e?.message || 'Errore sconosciuto',
      rows: [],
      summary: buildSummary([]),
    }, 500)
  }
}
