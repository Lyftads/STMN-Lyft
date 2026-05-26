export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID

const GRAPH_VERSION = 'v19.0'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function iso(date) {
  return date.toISOString().slice(0, 10)
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function getDateRange(preset, customSince, customUntil) {
  const now = new Date()
  const today = new Date(todayISO())

  if (preset === 'yesterday') {
    const d = addDays(today, -1)
    return { since: iso(d), until: iso(d) }
  }

  if (preset === 'last_7d') {
    return { since: iso(addDays(today, -6)), until: iso(today) }
  }

  if (preset === 'last_14d') {
    return { since: iso(addDays(today, -13)), until: iso(today) }
  }

  if (preset === 'last_28d') {
    return { since: iso(addDays(today, -27)), until: iso(today) }
  }

  if (preset === 'this_month') {
    return {
      since: iso(startOfMonth(now)),
      until: iso(today),
    }
  }

  if (preset === 'last_month') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return {
      since: iso(startOfMonth(lastMonth)),
      until: iso(endOfMonth(lastMonth)),
    }
  }

  if (preset === 'custom' && customSince && customUntil) {
    return {
      since: customSince,
      until: customUntil,
    }
  }

  return { since: iso(today), until: iso(today) }
}

function previousRange(since, until) {
  const start = new Date(since)
  const end = new Date(until)
  const diffDays = Math.round((end - start) / 86400000) + 1

  const prevUntil = addDays(start, -1)
  const prevSince = addDays(prevUntil, -(diffDays - 1))

  return {
    since: iso(prevSince),
    until: iso(prevUntil),
  }
}

function n(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function round(value, decimals = 2) {
  const num = n(value)
  const p = Math.pow(10, decimals)
  return Math.round(num * p) / p
}

function actionValue(actions, types) {
  if (!Array.isArray(actions)) return 0

  for (const type of types) {
    const found = actions.find(a => a.action_type === type)
    if (found) return n(found.value)
  }

  return 0
}

function getPurchases(row) {
  return actionValue(row.actions, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
    'onsite_conversion.purchase',
  ])
}

function getPurchaseValue(row) {
  return actionValue(row.action_values, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
    'onsite_conversion.purchase',
  ])
}

function getVideo3s(row) {
  return actionValue(row.video_3_sec_watched_actions, [
    'video_view',
  ])
}

function getRoas(row, spend, purchaseValue) {
  if (Array.isArray(row.website_purchase_roas) && row.website_purchase_roas.length) {
    return n(row.website_purchase_roas[0]?.value)
  }

  if (Array.isArray(row.purchase_roas) && row.purchase_roas.length) {
    return n(row.purchase_roas[0]?.value)
  }

  return spend > 0 ? purchaseValue / spend : 0
}

function enrichRow(row, level = 'ad') {
  const spend = n(row.spend)
  const impressions = n(row.impressions)
  const reach = n(row.reach)

  const linkClicks = n(row.inline_link_clicks)
  const purchases = getPurchases(row)
  const purchaseValue = getPurchaseValue(row)
  const video3s = getVideo3s(row)

  const cpm = impressions > 0 ? spend / impressions * 1000 : 0
  const ctrLink = impressions > 0 ? linkClicks / impressions * 100 : 0
  const cpcLink = linkClicks > 0 ? spend / linkClicks : 0
  const costPerResult = purchases > 0 ? spend / purchases : 0
  const roas = getRoas(row, spend, purchaseValue)
  const conversioneAcquisti = linkClicks > 0 ? purchases / linkClicks * 100 : 0
  const croCampagna = linkClicks > 0 ? purchases / linkClicks * 100 : 0
  const aovCampagna = purchases > 0 ? purchaseValue / purchases : 0
  const hookRate = impressions > 0 ? video3s / impressions * 100 : 0

  return {
    id:
      row.ad_id ||
      row.adset_id ||
      row.campaign_id ||
      `${level}-${row.date_start || ''}`,

    level,

    campaign_id: row.campaign_id || null,
    campaign_name: row.campaign_name || 'Campagna',

    adset_id: row.adset_id || null,
    adset_name: row.adset_name || 'Ad set',

    ad_id: row.ad_id || null,
    ad_name: row.ad_name || 'Ad',

    name:
      level === 'campaign'
        ? row.campaign_name || 'Campagna'
        : level === 'adset'
          ? row.adset_name || 'Ad set'
          : row.ad_name || 'Ad',

    impressions,
    reach,

    spend: round(spend, 2),
    cpm: round(cpm, 2),
    ctr_link: round(ctrLink, 2),
    cpc_link: round(cpcLink, 2),
    link_clicks: linkClicks,

    cost_per_result: round(costPerResult, 2),
    roas: round(roas, 2),
    purchases: round(purchases, 0),
    conversione_acquisti: round(conversioneAcquisti, 2),
    cro_campagna: round(croCampagna, 2),
    aov_campagna: round(aovCampagna, 2),
    hook_rate: round(hookRate, 2),

    purchase_value: round(purchaseValue, 2),
    video_3s: round(video3s, 0),

    thumbnail_url: null,
    creative_thumbnail: null,
  }
}

async function graphFetch(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value)
    }
  }

  url.searchParams.set('access_token', META_TOKEN)

  const res = await fetch(url.toString(), {
    cache: 'no-store',
  })

  const json = await res.json()

  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Meta API error ${res.status}`)
  }

  return json
}

async function graphFetchAll(path, params = {}) {
  let json = await graphFetch(path, params)
  let data = Array.isArray(json.data) ? json.data : []

  while (json.paging?.next) {
    const res = await fetch(json.paging.next, { cache: 'no-store' })
    json = await res.json()

    if (json.error) {
      throw new Error(json.error?.message || 'Meta paging error')
    }

    data = data.concat(Array.isArray(json.data) ? json.data : [])
  }

  return data
}

function getAccountIds() {
  return String(META_ACCOUNT || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(id => id.startsWith('act_') ? id : `act_${id}`)
}

async function fetchInsightsByLevel(accountId, level, since, until) {
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
    'inline_link_clicks',
    'actions',
    'action_values',
    'website_purchase_roas',
    'purchase_roas',
    'video_3_sec_watched_actions',
  ].join(',')

  const rows = await graphFetchAll(`${accountId}/insights`, {
    fields,
    level,
    time_range: JSON.stringify({ since, until }),
    limit: '500',
  })

  return rows.map(row => enrichRow(row, level))
}

async function fetchCreativesForAds(adRows) {
  const ads = adRows
    .filter(row => row.ad_id)
    .slice(0, 50)

  const results = await Promise.allSettled(
    ads.map(async row => {
      const json = await graphFetch(row.ad_id, {
        fields: 'name,creative{thumbnail_url,image_url,object_story_spec,effective_object_story_id}',
      })

      const creative = json.creative || {}

      return {
        ad_id: row.ad_id,
        ad_name: json.name || row.ad_name,
        thumbnail_url:
          creative.thumbnail_url ||
          creative.image_url ||
          null,
      }
    })
  )

  const map = {}

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value?.ad_id) {
      map[r.value.ad_id] = r.value
    }
  }

  return map
}

function aggregateRows(rows, level) {
  const map = {}

  for (const row of rows) {
    const id =
      level === 'campaign'
        ? row.campaign_id
        : level === 'adset'
          ? row.adset_id
          : row.ad_id

    if (!id) continue

    if (!map[id]) {
      map[id] = {
        id,
        level,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        adset_id: row.adset_id,
        adset_name: row.adset_name,
        ad_id: row.ad_id,
        ad_name: row.ad_name,
        name:
          level === 'campaign'
            ? row.campaign_name
            : level === 'adset'
              ? row.adset_name
              : row.ad_name,
        impressions: 0,
        reach: 0,
        spend: 0,
        link_clicks: 0,
        purchases: 0,
        purchase_value: 0,
        video_3s: 0,
        thumbnail_url: row.thumbnail_url || null,
      }
    }

    map[id].impressions += n(row.impressions)
    map[id].reach += n(row.reach)
    map[id].spend += n(row.spend)
    map[id].link_clicks += n(row.link_clicks)
    map[id].purchases += n(row.purchases)
    map[id].purchase_value += n(row.purchase_value)
    map[id].video_3s += n(row.video_3s)

    if (!map[id].thumbnail_url && row.thumbnail_url) {
      map[id].thumbnail_url = row.thumbnail_url
    }
  }

  return Object.values(map).map(row => {
    const cpm = row.impressions > 0 ? row.spend / row.impressions * 1000 : 0
    const ctrLink = row.impressions > 0 ? row.link_clicks / row.impressions * 100 : 0
    const cpcLink = row.link_clicks > 0 ? row.spend / row.link_clicks : 0
    const costPerResult = row.purchases > 0 ? row.spend / row.purchases : 0
    const roas = row.spend > 0 ? row.purchase_value / row.spend : 0
    const conversioneAcquisti = row.link_clicks > 0 ? row.purchases / row.link_clicks * 100 : 0
    const croCampagna = row.link_clicks > 0 ? row.purchases / row.link_clicks * 100 : 0
    const aovCampagna = row.purchases > 0 ? row.purchase_value / row.purchases : 0
    const hookRate = row.impressions > 0 ? row.video_3s / row.impressions * 100 : 0

    return {
      ...row,
      spend: round(row.spend, 2),
      cpm: round(cpm, 2),
      ctr_link: round(ctrLink, 2),
      cpc_link: round(cpcLink, 2),
      cost_per_result: round(costPerResult, 2),
      roas: round(roas, 2),
      purchases: round(row.purchases, 0),
      conversione_acquisti: round(conversioneAcquisti, 2),
      cro_campagna: round(croCampagna, 2),
      aov_campagna: round(aovCampagna, 2),
      hook_rate: round(hookRate, 2),
      purchase_value: round(row.purchase_value, 2),
      video_3s: round(row.video_3s, 0),
    }
  })
}

function summarize(rows) {
  const spend = rows.reduce((s, r) => s + n(r.spend), 0)
  const impressions = rows.reduce((s, r) => s + n(r.impressions), 0)
  const reach = rows.reduce((s, r) => s + n(r.reach), 0)
  const linkClicks = rows.reduce((s, r) => s + n(r.link_clicks), 0)
  const purchases = rows.reduce((s, r) => s + n(r.purchases), 0)
  const purchaseValue = rows.reduce((s, r) => s + n(r.purchase_value), 0)
  const video3s = rows.reduce((s, r) => s + n(r.video_3s), 0)

  return {
    spend: round(spend, 2),
    impressions,
    reach,
    cpm: impressions > 0 ? round(spend / impressions * 1000, 2) : 0,
    ctr_link: impressions > 0 ? round(linkClicks / impressions * 100, 2) : 0,
    cpc_link: linkClicks > 0 ? round(spend / linkClicks, 2) : 0,
    link_clicks: linkClicks,
    cost_per_result: purchases > 0 ? round(spend / purchases, 2) : 0,
    roas: spend > 0 ? round(purchaseValue / spend, 2) : 0,
    purchases: round(purchases, 0),
    conversione_acquisti: linkClicks > 0 ? round(purchases / linkClicks * 100, 2) : 0,
    cro_campagna: linkClicks > 0 ? round(purchases / linkClicks * 100, 2) : 0,
    aov_campagna: purchases > 0 ? round(purchaseValue / purchases, 2) : 0,
    hook_rate: impressions > 0 ? round(video3s / impressions * 100, 2) : 0,
    purchase_value: round(purchaseValue, 2),
  }
}

function pctChange(current, previous) {
  if (!previous || previous === 0) return null
  return round((current - previous) / previous * 100, 1)
}

function generateInsight(summary, since, until) {
  const parts = []

  parts.push(
    `Nel periodo ${since} → ${until}, Meta ha generato ${summary.impressions.toLocaleString('it-IT')} impression, ${summary.reach.toLocaleString('it-IT')} persone raggiunte e ${summary.link_clicks.toLocaleString('it-IT')} click sul link, con una spesa di €${summary.spend.toLocaleString('it-IT')}.`
  )

  if (summary.purchases > 0) {
    parts.push(
      `Sono stati rilevati ${summary.purchases} acquisti, ROAS ${summary.roas.toFixed(2)}x, costo per risultato €${summary.cost_per_result.toFixed(2),} e AOV campagna €${summary.aov_campagna.toFixed(2)}.`
    )
  } else {
    parts.push(
      `Non risultano acquisti attribuiti nel periodo selezionato: controlla tracciamento eventi, qualità traffico, landing, offerta e checkout.`
    )
  }

  parts.push(
    `[Inferenza] In ottica Andromeda, conviene dare segnali creativi chiari all’algoritmo: differenziare davvero hook, angoli e promesse, evitando troppe varianti simili che competono tra loro senza generare segnali distinti.`
  )

  return parts.join(' ')
}

function generateTodos(summary) {
  const todos = []

  if (summary.ctr_link < 1) {
    todos.push({
      title: 'CTR link basso',
      why: 'Il traffico clicca poco rispetto alle impression.',
      action: 'Testa nuovi hook creativi, prime righe copy più dirette e visual con promessa più evidente. [Inferenza]',
    })
  }

  if (summary.link_clicks > 0 && summary.purchases === 0) {
    todos.push({
      title: 'Click senza acquisti',
      why: 'La campagna porta traffico ma non conversioni attribuite.',
      action: 'Controlla landing, offerta, prezzo, checkout, tracking Pixel/CAPI e coerenza messaggio-annuncio. [Inferenza]',
    })
  }

  if (summary.roas > 0 && summary.roas < 1.5) {
    todos.push({
      title: 'ROAS sotto soglia',
      why: 'La revenue attribuita non copre abbastanza la spesa.',
      action: 'Riduci budget sulle ads deboli e sposta budget su creatività con migliori segnali di acquisto. [Inferenza]',
    })
  }

  if (summary.hook_rate > 0 && summary.hook_rate < 20) {
    todos.push({
      title: 'Hook rate migliorabile',
      why: 'Poche persone guardano almeno 3 secondi rispetto alle impression.',
      action: 'Rendi i primi 1–2 secondi più forti: problema esplicito, beneficio immediato, visual più chiaro. [Inferenza]',
    })
  }

  if (!todos.length) {
    todos.push({
      title: 'Mantieni e scala con controllo',
      why: 'I principali KPI non mostrano criticità evidenti.',
      action: 'Continua a monitorare ROAS, CPA, CTR link e Hook Rate prima di aumentare il budget. [Inferenza]',
    })
  }

  return todos
}

export async function GET(request) {
  try {
    if (!META_TOKEN || !META_ACCOUNT) {
      return NextResponse.json(
        {
          error: 'Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID',
          sources: { meta: false },
        },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)

    const preset = searchParams.get('preset') || 'today'
    const customSince = searchParams.get('since')
    const customUntil = searchParams.get('until')

    const { since, until } = getDateRange(preset, customSince, customUntil)
    const prev = previousRange(since, until)

    const accountIds = getAccountIds()

    const allAdRows = []
    const allPrevAdRows = []

    for (const accountId of accountIds) {
      const adRows = await fetchInsightsByLevel(accountId, 'ad', since, until)
      const prevAdRows = await fetchInsightsByLevel(accountId, 'ad', prev.since, prev.until)

      allAdRows.push(...adRows)
      allPrevAdRows.push(...prevAdRows)
    }

    const creativeMap = await fetchCreativesForAds(allAdRows)

    const ads = allAdRows.map(row => ({
      ...row,
      thumbnail_url: creativeMap[row.ad_id]?.thumbnail_url || null,
      creative_thumbnail: creativeMap[row.ad_id]?.thumbnail_url || null,
    }))

    const campaigns = aggregateRows(ads, 'campaign')
    const adsets = aggregateRows(ads, 'adset')
    const adsFinal = aggregateRows(ads, 'ad')

    const hierarchy = [
      ...campaigns,
      ...adsets,
      ...adsFinal,
    ].sort((a, b) => {
      if (a.level !== b.level) {
        const order = { campaign: 1, adset: 2, ad: 3 }
        return order[a.level] - order[b.level]
      }

      return b.spend - a.spend
    })

    const summary = summarize(ads)
    const prevSummary = summarize(allPrevAdRows)

    const compare = {
      current: summary,
      previous: prevSummary,
      range: {
        current: { since, until },
        previous: prev,
      },
      changes: {
        spend: pctChange(summary.spend, prevSummary.spend),
        roas: pctChange(summary.roas, prevSummary.roas),
        cost_per_result: pctChange(summary.cost_per_result, prevSummary.cost_per_result),
        ctr_link: pctChange(summary.ctr_link, prevSummary.ctr_link),
        purchases: pctChange(summary.purchases, prevSummary.purchases),
        cpc_link: pctChange(summary.cpc_link, prevSummary.cpc_link),
        hook_rate: pctChange(summary.hook_rate, prevSummary.hook_rate),
      },
    }

    const creatives = adsFinal
      .filter(row => row.thumbnail_url)
      .map(row => ({
        ad_id: row.ad_id,
        ad_name: row.ad_name || row.name,
        thumbnail_url: row.thumbnail_url,
        spend: row.spend,
        roas: row.roas,
        purchases: row.purchases,
        ctr_link: row.ctr_link,
      }))

    return NextResponse.json({
      ok: true,
      sources: { meta: true },
      updatedAt: new Date().toISOString(),

      preset,
      since,
      until,

      summary,
      compare,

      hierarchy,
      campaigns,
      adsets,
      ads: adsFinal,
      creatives,

      insight: generateInsight(summary, since, until),
      todos: generateTodos(summary),

      // Alias utili se la pagina usa nomi diversi
      rows: hierarchy,
      totals: summary,
      data: hierarchy,
    })
  } catch (err) {
    console.error('Meta detail route error:', err)

    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'Meta detail route error',
        sources: { meta: false },
      },
      { status: 500 }
    )
  }
}
