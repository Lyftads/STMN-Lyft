export const dynamic = 'force-dynamic'

const GRAPH_VERSION = 'v20.0'

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function div(a, b) {
  return b > 0 ? a / b : null
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10)
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function getRangeFromPreset(preset, since, until) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = addDays(today, -1)

  if (preset === 'today') {
    return { since: fmtDate(today), until: fmtDate(today) }
  }

  if (preset === 'yesterday') {
    return { since: fmtDate(yesterday), until: fmtDate(yesterday) }
  }

  if (preset === 'last_7d') {
    return { since: fmtDate(addDays(today, -6)), until: fmtDate(today) }
  }

  if (preset === 'last_14d') {
    return { since: fmtDate(addDays(today, -13)), until: fmtDate(today) }
  }

  if (preset === 'last_28d') {
    return { since: fmtDate(addDays(today, -27)), until: fmtDate(today) }
  }

  if (preset === 'this_month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    return { since: fmtDate(start), until: fmtDate(today) }
  }

  if (preset === 'last_month') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const end = new Date(today.getFullYear(), today.getMonth(), 0)
    return { since: fmtDate(start), until: fmtDate(end) }
  }

  if (preset === 'custom' && since && until) {
    return { since, until }
  }

  return { since: fmtDate(addDays(today, -6)), until: fmtDate(today) }
}

function getPreviousRange(since, until) {
  const s = new Date(`${since}T00:00:00`)
  const u = new Date(`${until}T00:00:00`)
  const diffDays = Math.round((u - s) / 86400000) + 1

  const prevUntil = addDays(s, -1)
  const prevSince = addDays(prevUntil, -(diffDays - 1))

  return {
    since: fmtDate(prevSince),
    until: fmtDate(prevUntil),
  }
}

function getAction(actions = [], type) {
  const item = actions.find(a => a.action_type === type)
  return n(item?.value)
}

function getActionValue(values = [], type) {
  const item = values.find(a => a.action_type === type)
  return n(item?.value)
}

function getPurchaseRoas(row) {
  const list = row.purchase_roas || row.website_purchase_roas || []
  if (!Array.isArray(list) || !list.length) return null
  return n(list[0]?.value)
}

function normalizeInsightRow(row = {}, creativeMap = {}) {
  const impressions = n(row.impressions)
  const reach = n(row.reach)
  const spend = n(row.spend)

  const linkClicks =
    n(row.inline_link_clicks) ||
    getAction(row.actions, 'link_click')

  const purchases =
    getAction(row.actions, 'purchase') ||
    getAction(row.actions, 'omni_purchase') ||
    getAction(row.actions, 'offsite_conversion.fb_pixel_purchase')

  const purchaseValue =
    getActionValue(row.action_values, 'purchase') ||
    getActionValue(row.action_values, 'omni_purchase') ||
    getActionValue(row.action_values, 'offsite_conversion.fb_pixel_purchase')

  const video3s =
    getAction(row.actions, 'video_view') ||
    n(row.video_3_sec_watched_actions?.[0]?.value)

  const cpm = n(row.cpm)
  const ctrLink = n(row.inline_link_click_ctr) || n(row.ctr)
  const cpcLink = n(row.cpc) || div(spend, linkClicks)
  const costPerResult = div(spend, purchases)
  const roas = getPurchaseRoas(row) || div(purchaseValue, spend)
  const purchaseConversion = div(purchases, linkClicks)
  const croCampaign = purchaseConversion ? purchaseConversion * 100 : null
  const aovCampaign = div(purchaseValue, purchases)
  const hookRate = div(video3s, impressions)

  const creative = creativeMap[row.ad_id] || {}

  return {
    campaignId: row.campaign_id || null,
    campaignName: row.campaign_name || 'Senza nome campagna',

    adsetId: row.adset_id || null,
    adsetName: row.adset_name || 'Senza nome ad set',

    adId: row.ad_id || null,
    adName: row.ad_name || 'Senza nome ad',

    impressions,
    reach,
    cpm,
    ctrLink,
    cpcLink,
    linkClicks,
    spend,
    costPerResult,
    roas,
    purchases,
    purchaseConversion,
    croCampaign,
    aovCampaign,
    hookRate,
    purchaseValue,
    video3s,

    thumbnailUrl: creative.thumbnail_url || creative.image_url || null,
    creativeName: creative.name || row.ad_name || null,
  }
}

function emptyMetrics() {
  return {
    impressions: 0,
    reach: 0,
    spend: 0,
    linkClicks: 0,
    purchases: 0,
    purchaseValue: 0,
    video3s: 0,
    cpm: null,
    ctrLink: null,
    cpcLink: null,
    costPerResult: null,
    roas: null,
    purchaseConversion: null,
    croCampaign: null,
    aovCampaign: null,
    hookRate: null,
  }
}

function calcDerived(m) {
  m.cpm = div(m.spend, m.impressions) ? div(m.spend, m.impressions) * 1000 : null
  m.ctrLink = div(m.linkClicks, m.impressions) ? div(m.linkClicks, m.impressions) * 100 : null
  m.cpcLink = div(m.spend, m.linkClicks)
  m.costPerResult = div(m.spend, m.purchases)
  m.roas = div(m.purchaseValue, m.spend)
  m.purchaseConversion = div(m.purchases, m.linkClicks)
  m.croCampaign = m.purchaseConversion ? m.purchaseConversion * 100 : null
  m.aovCampaign = div(m.purchaseValue, m.purchases)
  m.hookRate = div(m.video3s, m.impressions) ? div(m.video3s, m.impressions) * 100 : null
  return m
}

function addToMetrics(target, row) {
  target.impressions += n(row.impressions)
  target.reach += n(row.reach)
  target.spend += n(row.spend)
  target.linkClicks += n(row.linkClicks)
  target.purchases += n(row.purchases)
  target.purchaseValue += n(row.purchaseValue)
  target.video3s += n(row.video3s)
}

function buildHierarchy(rows) {
  const campaigns = {}

  for (const row of rows) {
    const campaignKey = row.campaignId || row.campaignName
    const adsetKey = row.adsetId || row.adsetName
    const adKey = row.adId || row.adName

    if (!campaigns[campaignKey]) {
      campaigns[campaignKey] = {
        id: row.campaignId,
        name: row.campaignName,
        metrics: emptyMetrics(),
        adsets: {},
      }
    }

    if (!campaigns[campaignKey].adsets[adsetKey]) {
      campaigns[campaignKey].adsets[adsetKey] = {
        id: row.adsetId,
        name: row.adsetName,
        metrics: emptyMetrics(),
        ads: {},
      }
    }

    campaigns[campaignKey].adsets[adsetKey].ads[adKey] = {
      id: row.adId,
      name: row.adName,
      creativeName: row.creativeName,
      thumbnailUrl: row.thumbnailUrl,
      metrics: calcDerived({
        ...emptyMetrics(),
        impressions: row.impressions,
        reach: row.reach,
        spend: row.spend,
        linkClicks: row.linkClicks,
        purchases: row.purchases,
        purchaseValue: row.purchaseValue,
        video3s: row.video3s,
      }),
    }

    addToMetrics(campaigns[campaignKey].metrics, row)
    addToMetrics(campaigns[campaignKey].adsets[adsetKey].metrics, row)
  }

  return Object.values(campaigns).map(c => ({
    ...c,
    metrics: calcDerived(c.metrics),
    adsets: Object.values(c.adsets).map(a => ({
      ...a,
      metrics: calcDerived(a.metrics),
      ads: Object.values(a.ads),
    })),
  }))
}

function summarize(rows) {
  const total = emptyMetrics()
  for (const row of rows) addToMetrics(total, row)
  return calcDerived(total)
}

function pctChange(current, previous) {
  if (previous == null || previous === 0) return null
  return ((current - previous) / previous) * 100
}

function buildComparison(current, previous) {
  const keys = [
    'impressions',
    'reach',
    'spend',
    'linkClicks',
    'purchases',
    'purchaseValue',
    'cpm',
    'ctrLink',
    'cpcLink',
    'costPerResult',
    'roas',
    'croCampaign',
    'aovCampaign',
    'hookRate',
  ]

  const out = {}

  for (const key of keys) {
    out[key] = {
      current: current[key],
      previous: previous[key],
      delta: current[key] != null && previous[key] != null
        ? current[key] - previous[key]
        : null,
      deltaPct: current[key] != null && previous[key] != null
        ? pctChange(current[key], previous[key])
        : null,
    }
  }

  return out
}

function buildInsights(summary, comparison) {
  const lines = []
  const todos = []

  if (summary.roas != null) {
    if (summary.roas >= 3) {
      lines.push(`ROAS positivo: la campagna sta generando circa ${summary.roas.toFixed(2)}€ per ogni euro investito.`)
    } else if (summary.roas >= 1.5) {
      lines.push(`ROAS intermedio: la campagna genera ritorno, ma non è ancora in una zona pienamente scalabile.`)
      todos.push({
        title: 'Ottimizzare creatività e offerte',
        reason: 'Il ROAS è presente ma migliorabile. Serve aumentare il valore generato per euro speso.',
      })
    } else {
      lines.push(`ROAS basso: il ritorno non sembra sufficiente rispetto alla spesa.`)
      todos.push({
        title: 'Ridurre budget sugli asset deboli',
        reason: 'ROAS basso: prima di scalare conviene isolare campagne/ad set/ad con CPA alto o pochi acquisti.',
      })
    }
  }

  if (summary.hookRate != null) {
    if (summary.hookRate < 20) {
      todos.push({
        title: 'Testare nuovi hook creativi',
        reason: 'Hook Rate basso: poche persone guardano almeno i primi secondi rispetto alle impression. Serve migliorare apertura video/visual.',
      })
    } else {
      lines.push(`Hook Rate buono: la creatività sembra catturare attenzione nei primi secondi.`)
    }
  }

  if (summary.ctrLink != null) {
    if (summary.ctrLink < 1) {
      todos.push({
        title: 'Migliorare angolo creativo e CTA',
        reason: 'CTR link basso: le persone vedono l’annuncio ma cliccano poco.',
      })
    } else {
      lines.push(`CTR link sopra soglia minima: l’annuncio genera interesse sufficiente al click.`)
    }
  }

  if (summary.croCampaign != null) {
    if (summary.croCampaign < 2) {
      todos.push({
        title: 'Controllare landing page e coerenza offerta',
        reason: 'CRO campagna basso: arrivano click, ma pochi diventano acquisti.',
      })
    } else {
      lines.push(`CRO campagna discreto: i click stanno convertendo in acquisti.`)
    }
  }

  if (comparison?.purchases?.deltaPct != null) {
    if (comparison.purchases.deltaPct > 0) {
      lines.push(`Gli acquisti sono in crescita rispetto al periodo precedente.`)
    } else if (comparison.purchases.deltaPct < 0) {
      todos.push({
        title: 'Analizzare calo acquisti vs periodo precedente',
        reason: 'Gli acquisti risultano in calo rispetto al periodo di confronto.',
      })
    }
  }

  if (!lines.length) {
    lines.push('Dati insufficienti per generare un insight affidabile.')
  }

  if (!todos.length) {
    todos.push({
      title: 'Continuare il monitoraggio',
      reason: 'Non emergono criticità evidenti dai dati aggregati. Verificare comunque le performance per singola creatività.',
    })
  }

  return {
    insight: lines.join(' '),
    todos,
    note: '[Non verificato] Le raccomandazioni sono euristiche basate sui dati disponibili. Non sono una lettura ufficiale del sistema Meta/Andromeda.',
  }
}

async function metaFetch(path, params) {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) throw new Error('META_ACCESS_TOKEN mancante')

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`)

  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  }

  url.searchParams.set('access_token', token)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const json = await res.json()

  if (!res.ok) {
    throw new Error(json?.error?.message || 'Errore Meta API')
  }

  return json
}

async function getAllPages(path, params) {
  let json = await metaFetch(path, params)
  let data = Array.isArray(json.data) ? json.data : []

  while (json.paging?.next) {
    const res = await fetch(json.paging.next, { cache: 'no-store' })
    json = await res.json()
    data = data.concat(Array.isArray(json.data) ? json.data : [])
  }

  return data
}

async function getCreativesMap(accountId) {
  const rows = await getAllPages(`${accountId}/ads`, {
    limit: 500,
    fields: [
      'id',
      'name',
      'creative{name,thumbnail_url,image_url,video_id,effective_object_story_id}',
    ].join(','),
  })

  const map = {}

  for (const ad of rows) {
    map[ad.id] = {
      name: ad.creative?.name || ad.name,
      thumbnail_url: ad.creative?.thumbnail_url || null,
      image_url: ad.creative?.image_url || null,
      video_id: ad.creative?.video_id || null,
    }
  }

  return map
}

async function getInsights(accountId, range, creativeMap) {
  const fields = [
    'campaign_id',
    'campaign_name',
    'adset_id',
    'adset_name',
    'ad_id',
    'ad_name',
    'impressions',
    'reach',
    'spend',
    'cpm',
    'ctr',
    'inline_link_click_ctr',
    'inline_link_clicks',
    'cpc',
    'actions',
    'action_values',
    'purchase_roas',
    'website_purchase_roas',
  ].join(',')

  const rows = await getAllPages(`${accountId}/insights`, {
    level: 'ad',
    limit: 500,
    fields,
    time_range: JSON.stringify({
      since: range.since,
      until: range.until,
    }),
  })

  return rows.map(row => normalizeInsightRow(row, creativeMap))
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)

    const accountRaw =
      process.env.META_AD_ACCOUNT_ID ||
      process.env.META_ACCOUNT_ID ||
      process.env.FB_AD_ACCOUNT_ID

    if (!accountRaw) {
      return Response.json(
        { ok: false, error: 'META_AD_ACCOUNT_ID mancante' },
        { status: 500 }
      )
    }

    const accountId = accountRaw.startsWith('act_')
      ? accountRaw
      : `act_${accountRaw}`

    const preset = searchParams.get('preset') || 'last_7d'
    const since = searchParams.get('since')
    const until = searchParams.get('until')

    const range = getRangeFromPreset(preset, since, until)
    const previousRange = getPreviousRange(range.since, range.until)

    const creativeMap = await getCreativesMap(accountId)

    const currentRows = await getInsights(accountId, range, creativeMap)
    const previousRows = await getInsights(accountId, previousRange, creativeMap)

    const summary = summarize(currentRows)
    const previousSummary = summarize(previousRows)
    const comparison = buildComparison(summary, previousSummary)
    const hierarchy = buildHierarchy(currentRows)
    const analysis = buildInsights(summary, comparison)

    return Response.json({
      ok: true,
      preset,
      range,
      previousRange,
      summary,
      previousSummary,
      comparison,
      hierarchy,
      rows: currentRows,
      analysis,
    })
  } catch (e) {
    return Response.json(
      {
        ok: false,
        error: e.message || 'Errore sconosciuto',
      },
      { status: 500 }
    )
  }
}
