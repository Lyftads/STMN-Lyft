export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID

const GRAPH_VERSION = 'v19.0'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function toISODate(d) {
  return d.toISOString().slice(0, 10)
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

function getDateRange(preset = 'last_28d', customSince, customUntil) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (preset === 'today') {
    return {
      since: toISODate(today),
      until: toISODate(today),
      label: 'Oggi',
    }
  }

  if (preset === 'yesterday') {
    const y = addDays(today, -1)
    return {
      since: toISODate(y),
      until: toISODate(y),
      label: 'Ieri',
    }
  }

  if (preset === 'last_7d') {
    return {
      since: toISODate(addDays(today, -6)),
      until: toISODate(today),
      label: 'Ultimi 7g',
    }
  }

  if (preset === 'last_14d') {
    return {
      since: toISODate(addDays(today, -13)),
      until: toISODate(today),
      label: 'Ultimi 14g',
    }
  }

  if (preset === 'last_28d') {
    return {
      since: toISODate(addDays(today, -27)),
      until: toISODate(today),
      label: 'Ultimi 28g',
    }
  }

  if (preset === 'this_month') {
    return {
      since: toISODate(startOfMonth(today)),
      until: toISODate(today),
      label: 'Mese corrente',
    }
  }

  if (preset === 'last_month') {
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    return {
      since: toISODate(startOfMonth(lastMonth)),
      until: toISODate(endOfMonth(lastMonth)),
      label: 'Mese scorso',
    }
  }

  if (preset === 'custom' && customSince && customUntil) {
    return {
      since: customSince,
      until: customUntil,
      label: 'Custom',
    }
  }

  return {
    since: toISODate(addDays(today, -27)),
    until: toISODate(today),
    label: 'Ultimi 28g',
  }
}

function getPreviousRange(since, until) {
  const s = new Date(`${since}T00:00:00`)
  const u = new Date(`${until}T00:00:00`)
  const days = Math.round((u - s) / 86400000) + 1

  const prevUntil = addDays(s, -1)
  const prevSince = addDays(prevUntil, -(days - 1))

  return {
    since: toISODate(prevSince),
    until: toISODate(prevUntil),
  }
}

function parseAccounts(raw) {
  if (!raw) return []

  return raw
    .split(/[,\n;]+/)
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => x.replace(/^["']|["']$/g, ''))
    .map(x => {
      if (x.startsWith('act_')) return x
      return `act_${x}`
    })
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function round(v, decimals = 2) {
  if (!Number.isFinite(v)) return 0
  const p = Math.pow(10, decimals)
  return Math.round(v * p) / p
}

function getActionValue(actions, names) {
  if (!Array.isArray(actions)) return 0

  for (const name of names) {
    const found = actions.find(a => a.action_type === name)
    if (found) return num(found.value)
  }

  return 0
}

function getPurchaseValue(row) {
  const values = row.action_values || []

  return getActionValue(values, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
  ])
}

function getPurchases(row) {
  const actions = row.actions || []

  return getActionValue(actions, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
  ])
}

function getRoas(row, spend, purchaseValue) {
  const roasFields = [
    row.purchase_roas,
    row.website_purchase_roas,
    row.catalog_segment_value,
  ]

  for (const field of roasFields) {
    if (Array.isArray(field) && field.length > 0) {
      const value = num(field[0]?.value)
      if (value > 0) return value
    }
  }

  return spend > 0 ? purchaseValue / spend : 0
}

function normalizeInsightRow(row, level) {
  const spend = num(row.spend)
  const impressions = num(row.impressions)
  const reach = num(row.reach)
  const frequency = num(row.frequency)

  const linkClicks = num(row.inline_link_clicks)
  const ctrLink = num(row.inline_link_click_ctr)
  const cpcLink = num(row.cost_per_inline_link_click)

  const purchases = getPurchases(row)
  const purchaseValue = getPurchaseValue(row)
  const roas = getRoas(row, spend, purchaseValue)

  const costPerResult = purchases > 0 ? spend / purchases : 0
  const purchaseConversion = linkClicks > 0 ? purchases / linkClicks * 100 : 0
  const croCampagna = purchaseConversion
  const aovCampagna = purchases > 0 ? purchaseValue / purchases : 0

  return {
    level,

    account_id: row.account_id || '',
    account_name: row.account_name || '',

    campaign_id: row.campaign_id || '',
    campaign_name: row.campaign_name || '',

    adset_id: row.adset_id || '',
    adset_name: row.adset_name || '',

    ad_id: row.ad_id || '',
    ad_name: row.ad_name || '',

    name:
      row.ad_name ||
      row.adset_name ||
      row.campaign_name ||
      row.account_name ||
      'Meta',

    impressions,
    reach,
    frequency: frequency || (reach > 0 ? impressions / reach : 0),

    cpm: impressions > 0 ? spend / impressions * 1000 : num(row.cpm),
    ctr_link: ctrLink,
    cpc_link: cpcLink || (linkClicks > 0 ? spend / linkClicks : 0),
    link_clicks: linkClicks,

    spend,
    cost_per_result: costPerResult,
    roas,
    purchases,
    purchase_conversion: purchaseConversion,
    cro_campagna: croCampagna,
    aov_campagna: aovCampagna,

    purchase_value: purchaseValue,

    thumbnail_url: '',
    creative_id: '',
  }
}

function aggregateRows(rows, levelName) {
  const out = {
    level: levelName,
    name: levelName,

    impressions: 0,
    reach: 0,
    frequency: 0,

    cpm: 0,
    ctr_link: 0,
    cpc_link: 0,
    link_clicks: 0,

    spend: 0,
    cost_per_result: 0,
    roas: 0,
    purchases: 0,
    purchase_conversion: 0,
    cro_campagna: 0,
    aov_campagna: 0,

    purchase_value: 0,
  }

  for (const r of rows) {
    out.impressions += num(r.impressions)
    out.reach += num(r.reach)
    out.link_clicks += num(r.link_clicks)
    out.spend += num(r.spend)
    out.purchases += num(r.purchases)
    out.purchase_value += num(r.purchase_value)
  }

  out.frequency = out.reach > 0 ? out.impressions / out.reach : 0
  out.cpm = out.impressions > 0 ? out.spend / out.impressions * 1000 : 0
  out.ctr_link = out.impressions > 0 ? out.link_clicks / out.impressions * 100 : 0
  out.cpc_link = out.link_clicks > 0 ? out.spend / out.link_clicks : 0
  out.cost_per_result = out.purchases > 0 ? out.spend / out.purchases : 0
  out.roas = out.spend > 0 ? out.purchase_value / out.spend : 0
  out.purchase_conversion = out.link_clicks > 0 ? out.purchases / out.link_clicks * 100 : 0
  out.cro_campagna = out.purchase_conversion
  out.aov_campagna = out.purchases > 0 ? out.purchase_value / out.purchases : 0

  return cleanMetricObject(out)
}

function cleanMetricObject(obj) {
  return {
    ...obj,

    impressions: Math.round(num(obj.impressions)),
    reach: Math.round(num(obj.reach)),
    frequency: round(num(obj.frequency), 2),

    cpm: round(num(obj.cpm), 2),
    ctr_link: round(num(obj.ctr_link), 2),
    cpc_link: round(num(obj.cpc_link), 2),
    link_clicks: Math.round(num(obj.link_clicks)),

    spend: round(num(obj.spend), 2),
    cost_per_result: round(num(obj.cost_per_result), 2),
    roas: round(num(obj.roas), 2),
    purchases: round(num(obj.purchases), 2),
    purchase_conversion: round(num(obj.purchase_conversion), 2),
    cro_campagna: round(num(obj.cro_campagna), 2),
    aov_campagna: round(num(obj.aov_campagna), 2),

    purchase_value: round(num(obj.purchase_value), 2),
  }
}

async function fetchPaged(url) {
  const rows = []
  let nextUrl = url

  for (let i = 0; i < 10 && nextUrl; i++) {
    const res = await fetch(nextUrl, {
      cache: 'no-store',
    })

    const json = await res.json()

    if (!res.ok || json.error) {
      throw new Error(json?.error?.message || `Meta API error ${res.status}`)
    }

    rows.push(...(json.data || []))
    nextUrl = json.paging?.next || null
  }

  return rows
}

async function fetchInsightsForAccount(accountId, level, since, until) {
  const fields = [
    'account_id',
    'account_name',

    'campaign_id',
    'campaign_name',

    level === 'adset' || level === 'ad' ? 'adset_id' : null,
    level === 'adset' || level === 'ad' ? 'adset_name' : null,

    level === 'ad' ? 'ad_id' : null,
    level === 'ad' ? 'ad_name' : null,

    'spend',
    'impressions',
    'reach',
    'frequency',
    'cpm',

    'inline_link_clicks',
    'inline_link_click_ctr',
    'cost_per_inline_link_click',

    'actions',
    'action_values',
    'purchase_roas',
    'website_purchase_roas',
  ]
    .filter(Boolean)
    .join(',')

  const params = new URLSearchParams({
    access_token: META_TOKEN,
    fields,
    level,
    limit: '500',
    time_range: JSON.stringify({
      since,
      until,
    }),
  })

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/insights?${params.toString()}`

  const rows = await fetchPaged(url)

  return rows.map(row => normalizeInsightRow(row, level))
}

async function fetchAdCreativesForAccount(accountId, since, until) {
  const fields = [
    'ad_id',
    'ad_name',
    'campaign_id',
    'campaign_name',
    'adset_id',
    'adset_name',
    'creative{id,name,thumbnail_url,image_url,object_story_spec}',
  ].join(',')

  const params = new URLSearchParams({
    access_token: META_TOKEN,
    fields,
    limit: '500',
    effective_status: JSON.stringify([
      'ACTIVE',
      'PAUSED',
      'ARCHIVED',
      'WITH_ISSUES',
    ]),
  })

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/ads?${params.toString()}`

  try {
    const rows = await fetchPaged(url)

    const map = {}

    for (const ad of rows) {
      const creative = ad.creative || {}

      map[ad.id || ad.ad_id] = {
        ad_id: ad.id || ad.ad_id || '',
        ad_name: ad.name || ad.ad_name || '',
        creative_id: creative.id || '',
        thumbnail_url: creative.thumbnail_url || creative.image_url || '',
      }
    }

    return map
  } catch (err) {
    return {}
  }
}

async function fetchLevel(level, since, until) {
  const accounts = parseAccounts(META_ACCOUNT)

  const rows = []
  const errors = []

  for (const accountId of accounts) {
    try {
      const accountRows = await fetchInsightsForAccount(accountId, level, since, until)
      rows.push(...accountRows)
    } catch (err) {
      errors.push({
        account: accountId,
        error: err.message,
      })
    }
  }

  return {
    rows: rows.map(cleanMetricObject),
    errors,
  }
}

async function fetchAdsWithCreatives(since, until) {
  const accounts = parseAccounts(META_ACCOUNT)

  const ads = []
  const errors = []

  for (const accountId of accounts) {
    try {
      const [insights, creatives] = await Promise.all([
        fetchInsightsForAccount(accountId, 'ad', since, until),
        fetchAdCreativesForAccount(accountId, since, until),
      ])

      const merged = insights.map(ad => {
        const creative = creatives[ad.ad_id] || {}

        return cleanMetricObject({
          ...ad,
          creative_id: creative.creative_id || '',
          thumbnail_url: creative.thumbnail_url || '',
        })
      })

      ads.push(...merged)
    } catch (err) {
      errors.push({
        account: accountId,
        error: err.message,
      })
    }
  }

  return {
    rows: ads,
    errors,
  }
}

function percentChange(current, previous) {
  if (!previous || previous === 0) {
    if (!current || current === 0) return 0
    return 100
  }

  return (current - previous) / previous * 100
}

function buildInsight(summary, range) {
  if (!summary || summary.spend <= 0) {
    return 'Non ci sono dati Meta disponibili nel periodo selezionato.'
  }

  const parts = []

  parts.push(
    `Nel periodo ${range.since} → ${range.until}, Meta ha generato ${summary.impressions.toLocaleString('it-IT')} impression, ${summary.reach.toLocaleString('it-IT')} persone raggiunte e ${summary.link_clicks.toLocaleString('it-IT')} click sul link, con una spesa totale di €${summary.spend.toFixed(0)}.`
  )

  parts.push(
    `Il CPM medio è €${summary.cpm.toFixed(2)}, la frequenza media è ${summary.frequency.toFixed(2)}, il CTR link è ${summary.ctr_link.toFixed(2)}% e il CPC link è €${summary.cpc_link.toFixed(2)}.`
  )

  if (summary.purchases > 0) {
    parts.push(
      `Sono stati rilevati ${summary.purchases.toFixed(0)} acquisti, ROAS ${summary.roas.toFixed(2)}x, costo per risultato €${summary.cost_per_result.toFixed(2)} e AOV campagna €${summary.aov_campagna.toFixed(2)}.`
    )
  } else {
    parts.push(
      `Non risultano acquisti attribuiti nel periodo; il ROAS è quindi ${summary.roas.toFixed(2)}x e il costo per risultato non è calcolabile.`
    )
  }

  parts.push(
    `[Inferenza] In ottica Andromeda, conviene alimentare l’algoritmo con creatività distinguibili, segnali chiari e coerenza tra angolo creativo, landing e conversion event.`
  )

  return parts.join(' ')
}

function buildTodos(summary, campaigns = []) {
  const todos = []

  if (!summary || summary.spend <= 0) {
    return [
      '[Inferenza] Verifica token, account Meta e intervallo selezionato: non risultano dati nel periodo.',
    ]
  }

  if (summary.ctr_link < 1) {
    todos.push(
      '[Inferenza] CTR link basso: testa nuovi hook creativi, prime righe copy più dirette e visual più leggibili nei primi secondi.'
    )
  }

  if (summary.cpc_link > 1) {
    todos.push(
      '[Inferenza] CPC link alto: controlla pertinenza audience-creatività, promessa dell’annuncio e qualità del traffico generato.'
    )
  }

  if (summary.frequency > 5 && summary.ctr_link < 1.5) {
    todos.push(
      '[Inferenza] Frequenza alta con CTR non forte: valuta refresh creativi o esclusione/rotazione degli asset più saturi.'
    )
  }

  if (summary.link_clicks > 0 && summary.purchases <= 0) {
    todos.push(
      '[Inferenza] Ci sono click ma non acquisti: controlla landing, offerta, checkout e coerenza messaggio-annuncio.'
    )
  }

  if (summary.roas > 0 && summary.roas < 1) {
    todos.push(
      '[Inferenza] ROAS sotto 1: riduci budget sulle campagne con bassa qualità del traffico e concentra la spesa sugli angoli con migliore CRO.'
    )
  }

  const winners = campaigns
    .filter(c => c.spend > 0)
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 3)

  if (winners.length > 0) {
    todos.push(
      `[Inferenza] Priorità scaling: parti dalle campagne con migliore combinazione ROAS/CRO/CPC. Top attuale: ${winners.map(w => w.name).join(', ')}.`
    )
  }

  if (todos.length === 0) {
    todos.push(
      '[Inferenza] Non emergono criticità automatiche forti dai dati disponibili. Continua a scalare gradualmente le campagne con ROAS e CRO migliori.'
    )
  }

  return todos
}

export async function GET(req) {
  try {
    if (!META_TOKEN) {
      return NextResponse.json(
        {
          ok: false,
          error: 'META_ACCESS_TOKEN mancante.',
          sources: {
            meta: false,
          },
        },
        { status: 200 }
      )
    }

    const accounts = parseAccounts(META_ACCOUNT)

    if (accounts.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'META_AD_ACCOUNT_ID mancante.',
          sources: {
            meta: false,
          },
        },
        { status: 200 }
      )
    }

    const { searchParams } = new URL(req.url)

    const preset = searchParams.get('preset') || 'last_28d'
    const customSince = searchParams.get('since')
    const customUntil = searchParams.get('until')

    const range = getDateRange(preset, customSince, customUntil)
    const previousRange = getPreviousRange(range.since, range.until)

    const [
      campaignData,
      adsetData,
      adData,
      previousCampaignData,
    ] = await Promise.all([
      fetchLevel('campaign', range.since, range.until),
      fetchLevel('adset', range.since, range.until),
      fetchAdsWithCreatives(range.since, range.until),
      fetchLevel('campaign', previousRange.since, previousRange.until),
    ])

    const campaigns = campaignData.rows
    const adsets = adsetData.rows
    const ads = adData.rows

    const summary = aggregateRows(campaigns, 'Totale Meta')
    const previousSummary = aggregateRows(previousCampaignData.rows, 'Periodo precedente')

    const comparison = {
      range: previousRange,

      spend: round(percentChange(summary.spend, previousSummary.spend), 1),
      roas: round(percentChange(summary.roas, previousSummary.roas), 1),
      cpa: round(percentChange(summary.cost_per_result, previousSummary.cost_per_result), 1),
      ctr: round(percentChange(summary.ctr_link, previousSummary.ctr_link), 1),

      current: summary,
      previous: previousSummary,
    }

    const hierarchy = {
      campaigns,
      adsets,
      ads,
    }

    const errors = [
      ...campaignData.errors,
      ...adsetData.errors,
      ...adData.errors,
      ...previousCampaignData.errors,
    ]

    return NextResponse.json({
      ok: true,

      preset,
      range,
      previousRange,

      accounts,

      summary,
      comparison,
      hierarchy,

      campaigns,
      adsets,
      ads,

      insight: buildInsight(summary, range),
      todos: buildTodos(summary, campaigns),

      sources: {
        meta: campaigns.length > 0 || adsets.length > 0 || ads.length > 0,
      },

      errors,

      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        sources: {
          meta: false,
        },
      },
      { status: 200 }
    )
  }
}
