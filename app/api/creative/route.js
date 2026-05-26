import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const API_VERSION = 'v20.0'

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function div(a, b) {
  const x = n(a)
  const y = n(b)
  return y > 0 ? x / y : 0
}

function normalizeAccountId(id) {
  const clean = String(id || '').trim()
  if (!clean) return null
  return clean.startsWith('act_') ? clean : `act_${clean}`
}

function getAccessToken() {
  return (
    process.env.META_ACCESS_TOKEN ||
    process.env.META_TOKEN ||
    process.env.FACEBOOK_ACCESS_TOKEN ||
    process.env.FB_ACCESS_TOKEN ||
    ''
  ).trim()
}

function getAccountIds() {
  const raw =
    process.env.META_AD_ACCOUNT_IDS ||
    process.env.META_ACCOUNT_IDS ||
    process.env.FACEBOOK_AD_ACCOUNT_IDS ||
    process.env.FB_AD_ACCOUNT_IDS ||
    ''

  return raw
    .split(',')
    .map(normalizeAccountId)
    .filter(Boolean)
}

function getDateString(d) {
  return d.toISOString().slice(0, 10)
}

function getRange(preset) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const since = new Date(today)
  const until = new Date(today)

  if (preset === 'today') {
    return {
      since: getDateString(today),
      until: getDateString(today),
    }
  }

  if (preset === 'yesterday') {
    return {
      since: getDateString(yesterday),
      until: getDateString(yesterday),
    }
  }

  if (preset === 'last_7d') {
    since.setDate(today.getDate() - 6)
    return {
      since: getDateString(since),
      until: getDateString(today),
    }
  }

  if (preset === 'last_14d') {
    since.setDate(today.getDate() - 13)
    return {
      since: getDateString(since),
      until: getDateString(today),
    }
  }

  if (preset === 'last_28d') {
    since.setDate(today.getDate() - 27)
    return {
      since: getDateString(since),
      until: getDateString(today),
    }
  }

  if (preset === 'month_current') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    return {
      since: getDateString(first),
      until: getDateString(today),
    }
  }

  if (preset === 'month_previous') {
    const firstPrev = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastPrev = new Date(today.getFullYear(), today.getMonth(), 0)
    return {
      since: getDateString(firstPrev),
      until: getDateString(lastPrev),
    }
  }

  since.setDate(today.getDate() - 27)
  return {
    since: getDateString(since),
    until: getDateString(today),
  }
}

async function fetchMeta(path, params = {}) {
  const accessToken = getAccessToken()

  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  url.searchParams.set('access_token', accessToken)

  const res = await fetch(url.toString(), {
    cache: 'no-store',
  })

  const text = await res.text()

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(text || 'Risposta Meta non valida')
  }

  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || 'Errore Meta API')
  }

  return data
}

async function fetchAllMetaPages(path, params = {}) {
  let out = []
  let data = await fetchMeta(path, params)

  if (Array.isArray(data.data)) {
    out = out.concat(data.data)
  }

  let next = data?.paging?.next || null

  while (next) {
    const res = await fetch(next, { cache: 'no-store' })
    const text = await res.text()

    let page
    try {
      page = JSON.parse(text)
    } catch {
      break
    }

    if (page?.error) {
      throw new Error(page.error.message || 'Errore paginazione Meta')
    }

    if (Array.isArray(page.data)) {
      out = out.concat(page.data)
    }

    next = page?.paging?.next || null
  }

  return out
}

function getActionValue(actions, wantedTypes) {
  if (!Array.isArray(actions)) return 0

  const types = Array.isArray(wantedTypes) ? wantedTypes : [wantedTypes]

  return actions.reduce((sum, action) => {
    if (types.includes(action.action_type)) {
      return sum + n(action.value)
    }
    return sum
  }, 0)
}

function mapInsight(row) {
  const impressions = n(row.impressions)
  const spend = n(row.spend)
  const reach = n(row.reach)
  const clicks = n(row.inline_link_clicks)

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

  const ctrLink = div(clicks, impressions) * 100
  const cpcLink = div(spend, clicks)
  const roas = div(purchaseValue, spend)
  const costPerResult = div(spend, purchases)

  return {
    id: row.ad_id || row.id || '',
    ad_id: row.ad_id || '',
    ad_name: row.ad_name || 'Creative senza nome',
    adset_id: row.adset_id || '',
    adset_name: row.adset_name || '',
    campaign_id: row.campaign_id || '',
    campaign_name: row.campaign_name || '',
    account_id: row.account_id ? normalizeAccountId(row.account_id) : '',
    account_name: row.account_name || '',
    impressions,
    reach,
    spend,
    link_clicks: clicks,
    ctr_link: ctrLink,
    cpc_link: cpcLink,
    purchases,
    purchase_value: purchaseValue,
    roas,
    cost_per_result: costPerResult,
    thumbnail_url: null,
    image_url: null,
    status: null,
    effective_status: null,
  }
}

function summarize(rows) {
  const spend = rows.reduce((s, r) => s + n(r.spend), 0)
  const purchaseValue = rows.reduce((s, r) => s + n(r.purchase_value), 0)
  const purchases = rows.reduce((s, r) => s + n(r.purchases), 0)
  const impressions = rows.reduce((s, r) => s + n(r.impressions), 0)
  const linkClicks = rows.reduce((s, r) => s + n(r.link_clicks), 0)

  return {
    creative: rows.length,
    spend,
    roas: div(purchaseValue, spend),
    ctr_link: div(linkClicks, impressions) * 100,
    orders: purchases,
    impressions,
    link_clicks: linkClicks,
  }
}

async function enrichAdsWithStatusAndCreative(rows) {
  const byAdId = new Map()

  rows.forEach(row => {
    if (row.ad_id) byAdId.set(row.ad_id, row)
  })

  const adIds = [...byAdId.keys()]

  const chunks = []
  for (let i = 0; i < adIds.length; i += 50) {
    chunks.push(adIds.slice(i, i + 50))
  }

  for (const chunk of chunks) {
    const idsObject = {}
    chunk.forEach(id => {
      idsObject[id] = id
    })

    const ids = Object.keys(idsObject).join(',')

    let adsData = {}

    try {
      adsData = await fetchMeta('', {
        ids,
        fields: [
          'id',
          'name',
          'status',
          'effective_status',
          'creative{id,name,thumbnail_url,image_url,object_story_spec}',
        ].join(','),
      })
    } catch {
      adsData = {}
    }

    Object.values(adsData).forEach(ad => {
      const row = byAdId.get(ad.id)
      if (!row) return

      row.status = ad.status || null
      row.effective_status = ad.effective_status || null

      const creative = ad.creative || {}

      row.creative_id = creative.id || null
      row.creative_name = creative.name || null
      row.thumbnail_url =
        creative.thumbnail_url ||
        creative.image_url ||
        creative?.object_story_spec?.link_data?.picture ||
        creative?.object_story_spec?.video_data?.image_url ||
        null

      row.image_url =
        creative.image_url ||
        creative.thumbnail_url ||
        creative?.object_story_spec?.link_data?.picture ||
        creative?.object_story_spec?.video_data?.image_url ||
        null
    })
  }

  return rows
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)

    const preset = searchParams.get('preset') || 'last_28d'
    const activeOnly = searchParams.get('active_only') !== 'false'

    const accessToken = getAccessToken()
    const accounts = getAccountIds()

    if (!accessToken) {
      return json(
        {
          ok: false,
          error:
            'Token Meta mancante. Aggiungi META_ACCESS_TOKEN nelle Environment Variables di Vercel.',
          rows: [],
          summary: summarize([]),
        },
        200
      )
    }

    if (!accounts.length) {
      return json(
        {
          ok: false,
          error:
            'Nessun account Meta configurato. Aggiungi META_AD_ACCOUNT_IDS nelle Environment Variables di Vercel. Esempio: act_123,act_456',
          rows: [],
          summary: summarize([]),
        },
        200
      )
    }

    const range = getRange(preset)

    const fields = [
      'account_id',
      'account_name',
      'campaign_id',
      'campaign_name',
      'adset_id',
      'adset_name',
      'ad_id',
      'ad_name',
      'impressions',
      'reach',
      'spend',
      'inline_link_clicks',
      'actions',
      'action_values',
    ].join(',')

    const allRows = []

    for (const account of accounts) {
      try {
        const rows = await fetchAllMetaPages(`${account}/insights`, {
          level: 'ad',
          fields,
          time_range: JSON.stringify(range),
          limit: 500,
        })

        rows.forEach(row => {
          allRows.push(mapInsight(row))
        })
      } catch (err) {
        console.error(`Errore account ${account}:`, err.message)
      }
    }

    let enriched = await enrichAdsWithStatusAndCreative(allRows)

    if (activeOnly) {
      enriched = enriched.filter(row => {
        const status = String(row.effective_status || row.status || '').toUpperCase()
        return status === 'ACTIVE'
      })
    }

    enriched.sort((a, b) => n(b.roas) - n(a.roas))

    return json({
      ok: true,
      preset,
      range,
      accounts,
      active_only: activeOnly,
      summary: summarize(enriched),
      rows: enriched,
    })
  } catch (err) {
    return json(
      {
        ok: false,
        error: err.message || 'Errore caricamento creative',
        rows: [],
        summary: summarize([]),
      },
      200
    )
  }
}
