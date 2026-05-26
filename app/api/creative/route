import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const GRAPH_VERSION = 'v20.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

function env(name, fallback = '') {
  return process.env[name] || fallback
}

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  })
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function div(a, b) {
  a = num(a)
  b = num(b)
  return b ? a / b : 0
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysISO(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function startOfMonthISO(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10)
}

function endOfPreviousMonthISO(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0))
    .toISOString()
    .slice(0, 10)
}

function startOfPreviousMonthISO(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 10)
}

function getRange(preset) {
  const today = todayISO()

  if (preset === 'today') {
    return { since: today, until: today }
  }

  if (preset === 'yesterday') {
    const y = addDaysISO(today, -1)
    return { since: y, until: y }
  }

  if (preset === 'last_7d') {
    return { since: addDaysISO(today, -6), until: today }
  }

  if (preset === 'last_14d') {
    return { since: addDaysISO(today, -13), until: today }
  }

  if (preset === 'last_28d') {
    return { since: addDaysISO(today, -27), until: today }
  }

  if (preset === 'this_month') {
    return { since: startOfMonthISO(today), until: today }
  }

  if (preset === 'last_month') {
    return {
      since: startOfPreviousMonthISO(today),
      until: endOfPreviousMonthISO(today),
    }
  }

  return { since: addDaysISO(today, -27), until: today }
}

function getAccounts() {
  const raw =
    env('META_ACCOUNT_IDS') ||
    env('META_AD_ACCOUNT_IDS') ||
    env('FACEBOOK_AD_ACCOUNT_IDS') ||
    env('FB_AD_ACCOUNT_IDS') ||
    ''

  return raw
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => (x.startsWith('act_') ? x : `act_${x}`))
}

function actionValue(actions, keys) {
  if (!Array.isArray(actions)) return 0

  return actions.reduce((sum, item) => {
    if (keys.includes(item.action_type)) {
      return sum + num(item.value)
    }
    return sum
  }, 0)
}

function extractImage(creative) {
  if (!creative) return null

  return (
    creative.thumbnail_url ||
    creative.image_url ||
    creative.object_story_spec?.link_data?.picture ||
    creative.object_story_spec?.video_data?.image_url ||
    null
  )
}

async function graphGet(path, params) {
  const token =
    env('META_ACCESS_TOKEN') ||
    env('FACEBOOK_ACCESS_TOKEN') ||
    env('FB_ACCESS_TOKEN')

  if (!token) {
    throw new Error('META_ACCESS_TOKEN mancante')
  }

  const url = new URL(`${GRAPH_BASE}/${path}`)

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  })

  url.searchParams.set('access_token', token)

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
    throw new Error(data.error?.message || `Errore Meta API ${res.status}`)
  }

  return data
}

function normalizeAd(ad, accountId, accountName, range) {
  const insight = Array.isArray(ad.insights?.data) ? ad.insights.data[0] : null

  const spend = num(insight?.spend)
  const impressions = num(insight?.impressions)
  const reach = num(insight?.reach)
  const linkClicks = num(insight?.inline_link_clicks)
  const purchaseValue = actionValue(insight?.action_values, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
  ])
  const purchases = actionValue(insight?.actions, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
  ])

  const ctrLink = div(linkClicks, impressions) * 100
  const cpcLink = div(spend, linkClicks)
  const roas = div(purchaseValue, spend)

  return {
    id: ad.id,
    ad_id: ad.id,
    name: ad.name || 'Ad senza nome',
    ad_name: ad.name || 'Ad senza nome',

    account_id: accountId,
    account_name: accountName || accountId,

    campaign_id: ad.campaign?.id || null,
    campaign_name: ad.campaign?.name || 'Campagna non disponibile',

    adset_id: ad.adset?.id || null,
    adset_name: ad.adset?.name || 'Ad set non disponibile',

    status: ad.status || null,
    effective_status: ad.effective_status || null,

    thumbnail_url: extractImage(ad.creative),

    spend,
    impressions,
    reach,
    frequency: div(impressions, reach),
    ctr_link: ctrLink,
    cpc_link: cpcLink,
    link_clicks: linkClicks,
    roas,
    purchases,
    orders: purchases,
    purchase_value: purchaseValue,

    since: range.since,
    until: range.until,
  }
}

function buildSummary(rows) {
  const spend = rows.reduce((s, r) => s + num(r.spend), 0)
  const impressions = rows.reduce((s, r) => s + num(r.impressions), 0)
  const linkClicks = rows.reduce((s, r) => s + num(r.link_clicks), 0)
  const purchaseValue = rows.reduce((s, r) => s + num(r.purchase_value), 0)
  const orders = rows.reduce((s, r) => s + num(r.orders), 0)

  return {
    creatives: rows.length,
    spend,
    impressions,
    link_clicks: linkClicks,
    purchase_value: purchaseValue,
    orders,
    roas: div(purchaseValue, spend),
    ctr_link: div(linkClicks, impressions) * 100,
  }
}

async function fetchAccountCreatives(accountId, range) {
  const rows = []
  let after = null
  let page = 0

  do {
    page += 1

    const fields = [
      'id',
      'name',
      'status',
      'effective_status',
      'campaign{id,name,status,effective_status}',
      'adset{id,name,status,effective_status}',
      'creative{id,name,thumbnail_url,image_url,object_story_spec}',
      `insights.time_range({"since":"${range.since}","until":"${range.until}"}){spend,impressions,reach,inline_link_clicks,actions,action_values}`,
    ].join(',')

    const data = await graphGet(`${accountId}/ads`, {
      fields,
      limit: 100,
      after,
    })

    const accountName = accountId

    const activeAds = (data.data || []).filter(ad => {
      const adActive = ad.effective_status === 'ACTIVE' || ad.status === 'ACTIVE'
      const campaignActive =
        !ad.campaign ||
        ad.campaign.effective_status === 'ACTIVE' ||
        ad.campaign.status === 'ACTIVE'
      const adsetActive =
        !ad.adset ||
        ad.adset.effective_status === 'ACTIVE' ||
        ad.adset.status === 'ACTIVE'

      return adActive && campaignActive && adsetActive
    })

    for (const ad of activeAds) {
      rows.push(normalizeAd(ad, accountId, accountName, range))
    }

    after = data.paging?.cursors?.after || null

    if (page >= 5) {
      after = null
    }
  } while (after)

  return rows
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const preset = searchParams.get('preset') || 'last_28d'
    const range = getRange(preset)
    const accounts = getAccounts()

    if (!accounts.length) {
      return json({
        ok: false,
        error: 'Nessun account Meta configurato. Controlla META_ACCOUNT_IDS o META_AD_ACCOUNT_IDS.',
        rows: [],
        summary: buildSummary([]),
      })
    }

    const results = await Promise.allSettled(
      accounts.map(accountId => fetchAccountCreatives(accountId, range))
    )

    const rows = []
    const errors = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        rows.push(...result.value)
      } else {
        errors.push({
          account: accounts[index],
          error: result.reason?.message || 'Errore sconosciuto',
        })
      }
    })

    rows.sort((a, b) => num(b.spend) - num(a.spend))

    return json({
      ok: errors.length === 0,
      preset,
      range,
      accounts,
      summary: buildSummary(rows),
      rows,
      errors,
      error: errors[0]?.error || null,
    })
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || 'Errore route creative',
        rows: [],
        summary: buildSummary([]),
      },
      500
    )
  }
}
