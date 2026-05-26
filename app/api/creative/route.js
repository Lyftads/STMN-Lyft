import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const META_VERSION = 'v20.0'

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

function n(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function div(a, b) {
  const x = n(a)
  const y = n(b)
  return y > 0 ? x / y : 0
}

function getActionValue(actions, keys = []) {
  if (!Array.isArray(actions)) return 0

  return actions.reduce((sum, action) => {
    const type = String(action?.action_type || '').toLowerCase()
    const value = n(action?.value)

    if (keys.some(k => type.includes(k.toLowerCase()))) {
      return sum + value
    }

    return sum
  }, 0)
}

function getDateRange(preset) {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const d = today.getDate()

  const toISO = date => date.toISOString().slice(0, 10)

  const make = (start, end) => ({
    since: toISO(start),
    until: toISO(end),
  })

  if (preset === 'today') {
    return make(new Date(y, m, d), new Date(y, m, d))
  }

  if (preset === 'yesterday') {
    return make(new Date(y, m, d - 1), new Date(y, m, d - 1))
  }

  if (preset === 'last_7d') {
    return make(new Date(y, m, d - 6), new Date(y, m, d))
  }

  if (preset === 'last_14d') {
    return make(new Date(y, m, d - 13), new Date(y, m, d))
  }

  if (preset === 'last_28d') {
    return make(new Date(y, m, d - 27), new Date(y, m, d))
  }

  if (preset === 'this_month') {
    return make(new Date(y, m, 1), new Date(y, m, d))
  }

  if (preset === 'last_month') {
    return make(new Date(y, m - 1, 1), new Date(y, m, 0))
  }

  return make(new Date(y, m, d - 27), new Date(y, m, d))
}

function getAccountIds() {
  const raw =
    process.env.META_AD_ACCOUNT_IDS ||
    process.env.META_ACCOUNT_IDS ||
    process.env.FB_AD_ACCOUNT_IDS ||
    process.env.FACEBOOK_AD_ACCOUNT_IDS ||
    ''

  return raw
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(id => (id.startsWith('act_') ? id : `act_${id}`))
}

async function metaGet(path, params = {}) {
  const token =
    process.env.META_ACCESS_TOKEN ||
    process.env.FACEBOOK_ACCESS_TOKEN ||
    process.env.FB_ACCESS_TOKEN

  if (!token) {
    throw new Error('META_ACCESS_TOKEN mancante nelle Environment Variables di Vercel.')
  }

  const url = new URL(`https://graph.facebook.com/${META_VERSION}/${path}`)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value))
    }
  })

  url.searchParams.set('access_token', token)

  const res = await fetch(url.toString(), {
    cache: 'no-store',
  })

  const body = await res.json().catch(() => null)

  if (!res.ok) {
    const msg =
      body?.error?.error_user_msg ||
      body?.error?.message ||
      `Errore Meta API ${res.status}`

    throw new Error(msg)
  }

  return body
}

async function fetchAll(path, params = {}, maxPages = 6) {
  let out = []
  let page = await metaGet(path, params)

  if (Array.isArray(page?.data)) {
    out = out.concat(page.data)
  }

  let next = page?.paging?.next
  let pages = 1

  while (next && pages < maxPages) {
    const res = await fetch(next, { cache: 'no-store' })
    const body = await res.json().catch(() => null)

    if (!res.ok) break

    if (Array.isArray(body?.data)) {
      out = out.concat(body.data)
    }

    next = body?.paging?.next
    pages += 1
  }

  return out
}

async function fetchActiveAdsForAccount(accountId) {
  const rows = await fetchAll(
    `${accountId}/ads`,
    {
      fields: [
        'id',
        'name',
        'effective_status',
        'status',
        'campaign{id,name,effective_status,status}',
        'adset{id,name,effective_status,status}',
        'creative{id,name,thumbnail_url,image_url,object_story_spec}',
      ].join(','),
      limit: 500,
      filtering: [
        {
          field: 'ad.effective_status',
          operator: 'IN',
          value: ['ACTIVE'],
        },
      ],
    },
    8
  )

  const map = new Map()

  rows.forEach(ad => {
    map.set(String(ad.id), {
      ad_id: String(ad.id),
      ad_name: ad.name || 'Ad senza nome',
      ad_status: ad.effective_status || ad.status || '',
      adset_id: ad.adset?.id || '',
      adset_name: ad.adset?.name || '',
      campaign_id: ad.campaign?.id || '',
      campaign_name: ad.campaign?.name || '',
      creative_id: ad.creative?.id || '',
      creative_name: ad.creative?.name || ad.name || 'Creative senza nome',
      thumbnail_url:
        ad.creative?.thumbnail_url ||
        ad.creative?.image_url ||
        '',
    })
  })

  return map
}

async function fetchInsightsForAccount(accountId, range) {
  return fetchAll(
    `${accountId}/insights`,
    {
      level: 'ad',
      time_range: range,
      fields: [
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
        'frequency',
        'cpm',
        'ctr',
        'inline_link_click_ctr',
        'cpc',
        'inline_link_clicks',
        'spend',
        'actions',
        'action_values',
      ].join(','),
      limit: 500,
    },
    8
  )
}

function normalizeCreative(insight, activeAd) {
  const spend = n(insight.spend)
  const impressions = n(insight.impressions)
  const reach = n(insight.reach)
  const linkClicks = n(insight.inline_link_clicks)

  const purchases = getActionValue(insight.actions, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
  ])

  const purchaseValue = getActionValue(insight.action_values, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
  ])

  const ctrLink =
    n(insight.inline_link_click_ctr) ||
    div(linkClicks, impressions) * 100

  const roas = div(purchaseValue, spend)
  const cpcLink = n(insight.cpc) || div(spend, linkClicks)
  const cpa = div(spend, purchases)

  return {
    id: String(insight.ad_id || activeAd?.ad_id || ''),
    ad_id: String(insight.ad_id || activeAd?.ad_id || ''),
    ad_name: activeAd?.ad_name || insight.ad_name || 'Ad senza nome',

    creative_id: activeAd?.creative_id || '',
    creative_name: activeAd?.creative_name || activeAd?.ad_name || insight.ad_name || 'Creative senza nome',
    thumbnail_url: activeAd?.thumbnail_url || '',

    campaign_id: insight.campaign_id || activeAd?.campaign_id || '',
    campaign_name: activeAd?.campaign_name || insight.campaign_name || '',

    adset_id: insight.adset_id || activeAd?.adset_id || '',
    adset_name: activeAd?.adset_name || insight.adset_name || '',

    impressions,
    reach,
    frequency: n(insight.frequency),
    cpm: n(insight.cpm),
    ctr: n(insight.ctr),
    ctr_link: ctrLink,
    cpc_link: cpcLink,
    link_clicks: linkClicks,
    spend,
    cost_per_result: cpa,
    roas,
    purchases,
    purchase_value: purchaseValue,
    orders: purchases,

    status: activeAd?.ad_status || 'ACTIVE',
  }
}

function buildSummary(rows) {
  const spend = rows.reduce((s, r) => s + n(r.spend), 0)
  const impressions = rows.reduce((s, r) => s + n(r.impressions), 0)
  const clicks = rows.reduce((s, r) => s + n(r.link_clicks), 0)
  const purchaseValue = rows.reduce((s, r) => s + n(r.purchase_value), 0)
  const purchases = rows.reduce((s, r) => s + n(r.purchases), 0)

  return {
    creatives: rows.length,
    spend,
    roas: div(purchaseValue, spend),
    ctr_link: div(clicks, impressions) * 100,
    orders: purchases,
    purchases,
    purchase_value: purchaseValue,
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('preset') || 'last_28d'

    const range = getDateRange(preset)
    const accountIds = getAccountIds()

    if (!accountIds.length) {
      return json({
        ok: false,
        error:
          'Nessun account Meta configurato. Aggiungi META_AD_ACCOUNT_IDS nelle Environment Variables di Vercel. Esempio: act_123,act_456',
        rows: [],
        summary: buildSummary([]),
      }, 400)
    }

    const allRows = []
    const errors = []

    for (const accountId of accountIds) {
      try {
        const activeAdsMap = await fetchActiveAdsForAccount(accountId)

        if (!activeAdsMap.size) {
          continue
        }

        const insights = await fetchInsightsForAccount(accountId, range)

        for (const insight of insights) {
          const adId = String(insight.ad_id || '')
          const activeAd = activeAdsMap.get(adId)

          if (!activeAd) continue

          allRows.push(normalizeCreative(insight, activeAd))
        }
      } catch (err) {
        errors.push({
          account_id: accountId,
          error: err.message,
        })
      }
    }

    allRows.sort((a, b) => n(b.spend) - n(a.spend))

    return json({
      ok: true,
      preset,
      range,
      accounts: accountIds,
      rows: allRows,
      summary: buildSummary(allRows),
      errors,
    })
  } catch (err) {
    return json({
      ok: false,
      error: err.message || 'Errore sconosciuto creative API',
      rows: [],
      summary: buildSummary([]),
    }, 500)
  }
}
