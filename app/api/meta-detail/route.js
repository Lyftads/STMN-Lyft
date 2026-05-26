import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const GRAPH_VERSION = process.env.META_API_VERSION || 'v20.0'

const ACCESS_TOKEN =
  process.env.META_ACCESS_TOKEN ||
  process.env.FB_ACCESS_TOKEN ||
  process.env.FACEBOOK_ACCESS_TOKEN ||
  ''

const RAW_AD_ACCOUNT_ID =
  process.env.META_AD_ACCOUNT_ID ||
  process.env.META_ADS_ACCOUNT_ID ||
  process.env.FB_AD_ACCOUNT_ID ||
  process.env.FACEBOOK_AD_ACCOUNT_ID ||
  ''

const AD_ACCOUNT_ID = RAW_AD_ACCOUNT_ID
  ? RAW_AD_ACCOUNT_ID.startsWith('act_')
    ? RAW_AD_ACCOUNT_ID
    : `act_${RAW_AD_ACCOUNT_ID}`
  : ''

const META_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

function n(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function div(a, b) {
  a = n(a)
  b = n(b)
  return b > 0 ? a / b : 0
}

function pct(a, b) {
  return div(a, b) * 100
}

function round(value, decimals = 2) {
  const x = Number(value)
  if (!Number.isFinite(x)) return 0
  return Number(x.toFixed(decimals))
}

function iso(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date, days) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function endOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
}

function getDateRange(preset, searchParams) {
  const today = new Date()
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))

  const yesterday = addDays(todayUTC, -1)

  if (preset === 'yesterday') {
    return {
      since: iso(yesterday),
      until: iso(yesterday),
      label: 'Ieri',
    }
  }

  if (preset === 'last_7d') {
    const since = addDays(todayUTC, -6)
    return {
      since: iso(since),
      until: iso(todayUTC),
      label: 'Ultimi 7g',
    }
  }

  if (preset === 'last_14d') {
    const since = addDays(todayUTC, -13)
    return {
      since: iso(since),
      until: iso(todayUTC),
      label: 'Ultimi 14g',
    }
  }

  if (preset === 'last_28d') {
    const since = addDays(todayUTC, -27)
    return {
      since: iso(since),
      until: iso(todayUTC),
      label: 'Ultimi 28g',
    }
  }

  if (preset === 'this_month') {
    return {
      since: iso(startOfMonth(todayUTC)),
      until: iso(todayUTC),
      label: 'Mese corrente',
    }
  }

  if (preset === 'last_month') {
    const lastMonth = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() - 1, 1))
    return {
      since: iso(startOfMonth(lastMonth)),
      until: iso(endOfMonth(lastMonth)),
      label: 'Mese scorso',
    }
  }

  if (preset === 'custom') {
    const since = searchParams.get('since')
    const until = searchParams.get('until')

    if (since && until) {
      return {
        since,
        until,
        label: 'Custom',
      }
    }
  }

  return {
    since: iso(todayUTC),
    until: iso(todayUTC),
    label: 'Oggi',
  }
}

function previousRange(range) {
  const sinceDate = new Date(`${range.since}T00:00:00.000Z`)
  const untilDate = new Date(`${range.until}T00:00:00.000Z`)

  const days = Math.max(1, Math.round((untilDate - sinceDate) / 86400000) + 1)

  const prevUntil = addDays(sinceDate, -1)
  const prevSince = addDays(prevUntil, -(days - 1))

  return {
    since: iso(prevSince),
    until: iso(prevUntil),
    label: 'Periodo precedente',
  }
}

function actionValue(actions, names) {
  if (!Array.isArray(actions)) return 0

  return actions.reduce((sum, item) => {
    const type = item?.action_type || ''
    if (names.includes(type)) {
      return sum + n(item?.value)
    }
    return sum
  }, 0)
}

function purchaseCount(row) {
  return actionValue(row.actions, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
    'onsite_conversion.purchase',
    'web_in_store_purchase',
  ])
}

function purchaseValue(row) {
  return actionValue(row.action_values, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
    'onsite_conversion.purchase',
    'web_in_store_purchase',
  ])
}

function resultCost(row, purchases) {
  const arr = row.cost_per_action_type
  if (Array.isArray(arr)) {
    const found = arr.find((x) =>
      [
        'purchase',
        'omni_purchase',
        'offsite_conversion.fb_pixel_purchase',
        'onsite_conversion.purchase',
        'web_in_store_purchase',
      ].includes(x?.action_type)
    )

    if (found) return n(found.value)
  }

  return purchases > 0 ? div(row.spend, purchases) : 0
}

function roas(row, spend, revenue) {
  if (Array.isArray(row.purchase_roas) && row.purchase_roas.length) {
    const found = row.purchase_roas.find((x) =>
      ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'].includes(x?.action_type)
    )

    if (found) return n(found.value)
  }

  return spend > 0 ? div(revenue, spend) : 0
}

function video3SecViews(row) {
  return actionValue(row.actions, [
    'video_view',
    'video_3_sec_video_view',
    'video_play',
  ])
}

function normalizeRow(row, levelFallback = 'campaign') {
  const impressions = n(row.impressions)
  const reach = n(row.reach)
  const spend = n(row.spend)
  const linkClicks = n(row.inline_link_clicks)

  const purchases = purchaseCount(row)
  const revenue = purchaseValue(row)
  const cpa = resultCost(row, purchases)

  const out = {
    level: levelFallback,

    campaign_id: row.campaign_id || null,
    campaign_name: row.campaign_name || 'Campagna',

    adset_id: row.adset_id || null,
    adset_name: row.adset_name || null,

    ad_id: row.ad_id || null,
    ad_name: row.ad_name || null,

    impressions,
    reach,
    frequency: round(n(row.frequency) || div(impressions, reach), 2),

    cpm: round(n(row.cpm) || div(spend, impressions) * 1000, 2),

    ctr_link: round(n(row.inline_link_click_ctr) || pct(linkClicks, impressions), 2),
    cpc_link: round(n(row.cost_per_inline_link_click) || div(spend, linkClicks), 2),
    link_clicks: linkClicks,

    spend: round(spend, 2),

    cost_per_result: round(cpa, 2),
    roas: round(roas(row, spend, revenue), 2),

    purchases: round(purchases, 0),
    purchase_value: round(revenue, 2),

    conversione_acquisti: round(pct(purchases, linkClicks), 2),
    cro_campagna: round(pct(purchases, linkClicks), 2),

    aov_campagna: round(div(revenue, purchases), 2),

    video_3s_views: round(video3SecViews(row), 0),
    hook_rate: round(pct(video3SecViews(row), impressions), 2),

    thumbnail_url: null,
    creative_name: row.ad_name || null,
  }

  return out
}

function emptySummary() {
  return {
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
    purchase_value: 0,
    conversione_acquisti: 0,
    cro_campagna: 0,
    aov_campagna: 0,
    video_3s_views: 0,
    hook_rate: 0,
  }
}

function aggregate(rows) {
  const s = emptySummary()

  for (const r of rows) {
    s.impressions += n(r.impressions)
    s.reach += n(r.reach)
    s.link_clicks += n(r.link_clicks)
    s.spend += n(r.spend)
    s.purchases += n(r.purchases)
    s.purchase_value += n(r.purchase_value)
    s.video_3s_views += n(r.video_3s_views)
  }

  s.frequency = round(div(s.impressions, s.reach), 2)
  s.cpm = round(div(s.spend, s.impressions) * 1000, 2)
  s.ctr_link = round(pct(s.link_clicks, s.impressions), 2)
  s.cpc_link = round(div(s.spend, s.link_clicks), 2)
  s.cost_per_result = round(div(s.spend, s.purchases), 2)
  s.roas = round(div(s.purchase_value, s.spend), 2)
  s.conversione_acquisti = round(pct(s.purchases, s.link_clicks), 2)
  s.cro_campagna = round(pct(s.purchases, s.link_clicks), 2)
  s.aov_campagna = round(div(s.purchase_value, s.purchases), 2)
  s.hook_rate = round(pct(s.video_3s_views, s.impressions), 2)

  s.spend = round(s.spend, 2)
  s.purchase_value = round(s.purchase_value, 2)
  s.purchases = round(s.purchases, 0)
  s.link_clicks = round(s.link_clicks, 0)
  s.impressions = round(s.impressions, 0)
  s.reach = round(s.reach, 0)
  s.video_3s_views = round(s.video_3s_views, 0)

  return s
}

function delta(current, previous) {
  if (!previous || previous === 0) return null
  return round(((current - previous) / previous) * 100, 1)
}

function buildComparison(currentSummary, previousSummary) {
  return {
    spend: delta(currentSummary.spend, previousSummary.spend),
    roas: delta(currentSummary.roas, previousSummary.roas),
    cpa: delta(currentSummary.cost_per_result, previousSummary.cost_per_result),
    ctr: delta(currentSummary.ctr_link, previousSummary.ctr_link),
    purchases: delta(currentSummary.purchases, previousSummary.purchases),
    cpc_link: delta(currentSummary.cpc_link, previousSummary.cpc_link),
    hook_rate: delta(currentSummary.hook_rate, previousSummary.hook_rate),
  }
}

function groupBy(rows, key) {
  const map = new Map()

  for (const row of rows) {
    const id = row[key] || 'unknown'
    if (!map.has(id)) map.set(id, [])
    map.get(id).push(row)
  }

  return map
}

function buildHierarchy(rows) {
  const campaigns = []

  const byCampaign = groupBy(rows, 'campaign_id')

  for (const [campaignId, campaignRows] of byCampaign.entries()) {
    const campaignName = campaignRows[0]?.campaign_name || 'Campagna'
    const adsets = []

    const byAdset = groupBy(campaignRows, 'adset_id')

    for (const [adsetId, adsetRows] of byAdset.entries()) {
      const adsetName = adsetRows[0]?.adset_name || 'Ad set'
      const ads = adsetRows.map((ad) => ({
        ...ad,
        level: 'ad',
        name: ad.ad_name || 'Ad',
      }))

      adsets.push({
        level: 'adset',
        id: adsetId,
        name: adsetName,
        ...aggregate(adsetRows),
        ads,
      })
    }

    campaigns.push({
      level: 'campaign',
      id: campaignId,
      name: campaignName,
      ...aggregate(campaignRows),
      adsets,
    })
  }

  return campaigns
}

function buildFlatRows(hierarchy) {
  const out = []

  for (const campaign of hierarchy) {
    out.push({
      ...campaign,
      row_type: 'campaign',
      label: `Campagna · ${campaign.name}`,
    })

    for (const adset of campaign.adsets || []) {
      out.push({
        ...adset,
        row_type: 'adset',
        label: `Ad set · ${adset.name}`,
      })

      for (const ad of adset.ads || []) {
        out.push({
          ...ad,
          row_type: 'ad',
          label: `Ad · ${ad.ad_name || ad.name || 'Ad'}`,
        })
      }
    }
  }

  return out
}

function buildTodos(summary) {
  const todos = []

  if (summary.ctr_link < 1) {
    todos.push({
      title: 'CTR link basso',
      text: 'Testa nuovi hook creativi e prime righe copy più dirette. [Inferenza]',
      reason: `CTR link attuale: ${summary.ctr_link}%.`,
    })
  }

  if (summary.hook_rate > 0 && summary.hook_rate < 20) {
    todos.push({
      title: 'Hook Rate debole',
      text: 'Lavora sui primi 3 secondi: apertura più visuale, promessa chiara e meno introduzione. [Inferenza]',
      reason: `Hook Rate attuale: ${summary.hook_rate}%.`,
    })
  }

  if (summary.link_clicks > 0 && summary.purchases === 0) {
    todos.push({
      title: 'Click senza acquisti',
      text: 'Controlla landing, offerta, checkout e coerenza messaggio-annuncio. [Inferenza]',
      reason: `${summary.link_clicks} click link, ma 0 acquisti rilevati.`,
    })
  }

  if (summary.frequency > 4 && summary.ctr_link < 1.2) {
    todos.push({
      title: 'Possibile saturazione',
      text: 'Inserisci nuove creatività o angoli diversi per evitare audience fatigue. [Inferenza]',
      reason: `Frequenza ${summary.frequency} e CTR link ${summary.ctr_link}%.`,
    })
  }

  if (summary.roas > 0 && summary.roas < 1.5) {
    todos.push({
      title: 'ROAS sotto soglia',
      text: 'Riduci budget sulle combinazioni con CPA alto e sposta spesa su creatività/ad set con segnali migliori. [Inferenza]',
      reason: `ROAS attuale: ${summary.roas}x.`,
    })
  }

  if (!todos.length) {
    todos.push({
      title: 'Performance stabile',
      text: 'Mantieni monitoraggio su CTR, Hook Rate, CPA e ROAS prima di scalare. [Inferenza]',
      reason: 'Non emergono anomalie forti dai dati disponibili.',
    })
  }

  return todos
}

function buildInsight(summary, range) {
  const parts = []

  parts.push(
    `Nel periodo ${range.since} → ${range.until}, Meta ha generato ${summary.impressions} impression, ${summary.reach} persone raggiunte, frequenza ${summary.frequency}, ${summary.link_clicks} click sul link e una spesa totale di €${summary.spend}.`
  )

  if (summary.purchases > 0) {
    parts.push(
      `Sono stati rilevati ${summary.purchases} acquisti, ROAS ${summary.roas}x, costo per risultato €${summary.cost_per_result} e AOV campagna €${summary.aov_campagna}.`
    )
  } else {
    parts.push(
      `Il ROAS rilevato è ${summary.roas}x e il costo per risultato è non disponibile perché non risultano acquisti nel periodo.`
    )
  }

  parts.push(
    `[Inferenza] In ottica Andromeda, conviene dare più segnali creativi chiari all’algoritmo: creatività differenziate, angoli di comunicazione distinti e segnali di conversione coerenti, evitando troppe varianti quasi uguali.`
  )

  return parts.join(' ')
}

async function metaFetch(path, params = {}) {
  if (!ACCESS_TOKEN) {
    throw new Error('META_ACCESS_TOKEN mancante nelle variabili ambiente.')
  }

  if (!AD_ACCOUNT_ID) {
    throw new Error('META_AD_ACCOUNT_ID mancante nelle variabili ambiente.')
  }

  const url = new URL(`${META_BASE}${path}`)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value))
    }
  }

  url.searchParams.set('access_token', ACCESS_TOKEN)

  const res = await fetch(url.toString(), {
    cache: 'no-store',
  })

  const json = await res.json()

  if (!res.ok || json.error) {
    const msg = json?.error?.message || `Meta API error ${res.status}`
    throw new Error(msg)
  }

  return json
}

async function fetchInsights(range) {
  const fields = [
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
    'inline_link_click_ctr',
    'cost_per_inline_link_click',
    'inline_link_clicks',
    'spend',
    'actions',
    'action_values',
    'cost_per_action_type',
    'purchase_roas',
  ].join(',')

  let all = []
  let after = null

  do {
    const json = await metaFetch(`/${AD_ACCOUNT_ID}/insights`, {
      level: 'ad',
      fields,
      time_range: {
        since: range.since,
        until: range.until,
      },
      limit: 500,
      after,
    })

    all = all.concat(json.data || [])
    after = json?.paging?.cursors?.after || null

    if (!json?.paging?.next) {
      after = null
    }
  } while (after)

  return all.map((row) => normalizeRow(row, 'ad'))
}

async function fetchAdCreatives(adIds) {
  const uniqueIds = [...new Set(adIds.filter(Boolean))].slice(0, 200)

  const creativeMap = {}

  await Promise.all(
    uniqueIds.map(async (adId) => {
      try {
        const json = await metaFetch(`/${adId}`, {
          fields: 'id,name,creative{id,name,thumbnail_url,image_url,video_id,object_story_spec,effective_object_story_id}',
        })

        creativeMap[adId] = {
          ad_id: adId,
          ad_name: json.name || null,
          creative_id: json?.creative?.id || null,
          creative_name: json?.creative?.name || json.name || null,
          thumbnail_url:
            json?.creative?.thumbnail_url ||
            json?.creative?.image_url ||
            null,
          video_id: json?.creative?.video_id || null,
        }
      } catch (e) {
        creativeMap[adId] = {
          ad_id: adId,
          ad_name: null,
          creative_id: null,
          creative_name: null,
          thumbnail_url: null,
          video_id: null,
        }
      }
    })
  )

  return creativeMap
}

function attachCreatives(rows, creativeMap) {
  return rows.map((row) => {
    const creative = creativeMap[row.ad_id] || {}

    return {
      ...row,
      creative_name: creative.creative_name || row.ad_name || null,
      thumbnail_url: creative.thumbnail_url || null,
      video_id: creative.video_id || null,
    }
  })
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)

    const preset = searchParams.get('preset') || 'today'
    const range = getDateRange(preset, searchParams)
    const prevRange = previousRange(range)

    const currentRowsRaw = await fetchInsights(range)
    const previousRowsRaw = await fetchInsights(prevRange)

    const creativeMap = await fetchAdCreatives(currentRowsRaw.map((row) => row.ad_id))
    const currentRows = attachCreatives(currentRowsRaw, creativeMap)

    const hierarchy = buildHierarchy(currentRows)
    const rows = buildFlatRows(hierarchy)

    const summary = aggregate(currentRows)
    const previousSummary = aggregate(previousRowsRaw)
    const comparison = buildComparison(summary, previousSummary)

    const todos = buildTodos(summary)
    const insight = buildInsight(summary, range)

    return NextResponse.json({
      ok: true,
      sources: {
        meta: true,
      },
      preset,
      range,
      previous_range: prevRange,

      summary,
      previous_summary: previousSummary,
      comparison,

      todos,
      insight,

      hierarchy,
      rows,

      creatives: Object.values(creativeMap),

      meta: {
        graph_version: GRAPH_VERSION,
        level: 'ad',
        note: 'Hook Rate calcolato da actions video quando disponibili. Non viene richiesto video_3_sec_watched_actions perché può generare errore API.',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Errore sconosciuto',
        sources: {
          meta: false,
        },
      },
      { status: 500 }
    )
  }
}
