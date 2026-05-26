export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT_RAW = process.env.META_AD_ACCOUNT_ID

const GRAPH_VERSION = 'v19.0'

function json(data, status = 200) {
  return NextResponse.json(data, { status })
}

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function div(a, b) {
  a = toNum(a)
  b = toNum(b)
  return b > 0 ? a / b : null
}

function pct(a, b) {
  a = toNum(a)
  b = toNum(b)
  return b > 0 ? (a / b) * 100 : 0
}

function ymd(date) {
  return date.toISOString().slice(0, 10)
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

function getPresetRange(preset) {
  const today = new Date()
  const p = preset || 'last_28d'

  if (p === 'today') {
    return { since: ymd(today), until: ymd(today) }
  }

  if (p === 'yesterday') {
    const d = addDays(today, -1)
    return { since: ymd(d), until: ymd(d) }
  }

  if (p === 'last_7d') {
    return { since: ymd(addDays(today, -6)), until: ymd(today) }
  }

  if (p === 'last_14d') {
    return { since: ymd(addDays(today, -13)), until: ymd(today) }
  }

  if (p === 'last_28d') {
    return { since: ymd(addDays(today, -27)), until: ymd(today) }
  }

  if (p === 'this_month') {
    return { since: ymd(startOfMonth(today)), until: ymd(today) }
  }

  if (p === 'last_month') {
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    return {
      since: ymd(startOfMonth(lastMonth)),
      until: ymd(endOfMonth(lastMonth)),
    }
  }

  return { since: ymd(addDays(today, -27)), until: ymd(today) }
}

function getPreviousRange(range) {
  const since = new Date(range.since)
  const until = new Date(range.until)
  const days = Math.round((until - since) / 86400000) + 1

  const previousUntil = addDays(since, -1)
  const previousSince = addDays(previousUntil, -(days - 1))

  return {
    since: ymd(previousSince),
    until: ymd(previousUntil),
  }
}

function getAccounts() {
  if (!META_ACCOUNT_RAW) return []

  return META_ACCOUNT_RAW
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => {
      if (x.startsWith('act_')) return x
      return `act_${x}`
    })
}

function actionValue(arr, types) {
  if (!Array.isArray(arr)) return 0

  const wanted = Array.isArray(types) ? types : [types]

  return arr.reduce((sum, item) => {
    if (wanted.includes(item.action_type)) {
      return sum + toNum(item.value)
    }
    return sum
  }, 0)
}

function roasValue(purchaseRoas) {
  if (!Array.isArray(purchaseRoas)) return 0

  const found =
    purchaseRoas.find(x => x.action_type === 'omni_purchase') ||
    purchaseRoas.find(x => x.action_type === 'purchase') ||
    purchaseRoas[0]

  return toNum(found?.value)
}

function costPerResultValue(costPerActionType) {
  if (!Array.isArray(costPerActionType)) return null

  const found =
    costPerActionType.find(x => x.action_type === 'omni_purchase') ||
    costPerActionType.find(x => x.action_type === 'purchase') ||
    costPerActionType.find(x => x.action_type === 'offsite_conversion.fb_pixel_purchase')

  return found ? toNum(found.value) : null
}

function normalizeRow(row, level, accountId) {
  const impressions = toNum(row.impressions)
  const reach = toNum(row.reach)
  const spend = toNum(row.spend)
  const linkClicks = toNum(row.inline_link_clicks)

  const purchases = actionValue(row.actions, [
    'omni_purchase',
    'purchase',
    'offsite_conversion.fb_pixel_purchase',
  ])

  const purchaseValue = actionValue(row.action_values, [
    'omni_purchase',
    'purchase',
    'offsite_conversion.fb_pixel_purchase',
  ])

  const roas =
    roasValue(row.purchase_roas) ||
    div(purchaseValue, spend) ||
    0

  const costPerResult =
    costPerResultValue(row.cost_per_action_type) ||
    div(spend, purchases)

  const conversioneAcquisti = pct(purchases, linkClicks)
  const croCampagna = pct(purchases, linkClicks)
  const aovCampagna = div(purchaseValue, purchases)

  return {
    id:
      row.ad_id ||
      row.adset_id ||
      row.campaign_id ||
      accountId,

    level,

    account_id: accountId,
    account_name: row.account_name || accountId,

    campaign_id: row.campaign_id || null,
    campaign_name: row.campaign_name || null,

    adset_id: row.adset_id || null,
    adset_name: row.adset_name || null,

    ad_id: row.ad_id || null,
    ad_name: row.ad_name || null,

    name:
      row.ad_name ||
      row.adset_name ||
      row.campaign_name ||
      row.account_name ||
      accountId,

    impressions,
    reach,
    frequency: toNum(row.frequency),
    cpm: toNum(row.cpm),
    ctr_link: toNum(row.inline_link_click_ctr),
    cpc_link: toNum(row.cost_per_inline_link_click),
    link_clicks: linkClicks,
    spend,
    cost_per_result: costPerResult,
    roas,
    purchases,
    purchase_value: purchaseValue,
    conversione_acquisti: conversioneAcquisti,
    cro_campagna: croCampagna,
    aov_campagna: aovCampagna,
    thumbnail_url: null,
  }
}

function aggregateRows(rows, level = 'account') {
  const base = {
    id: 'summary',
    level,
    name: 'Totale',
    impressions: 0,
    reach: 0,
    spend: 0,
    link_clicks: 0,
    purchases: 0,
    purchase_value: 0,
    frequencyNumerator: 0,
    frequencyDenominator: 0,
  }

  for (const r of rows) {
    base.impressions += toNum(r.impressions)
    base.reach += toNum(r.reach)
    base.spend += toNum(r.spend)
    base.link_clicks += toNum(r.link_clicks)
    base.purchases += toNum(r.purchases)
    base.purchase_value += toNum(r.purchase_value)

    if (toNum(r.reach) > 0 && toNum(r.frequency) > 0) {
      base.frequencyNumerator += toNum(r.frequency) * toNum(r.reach)
      base.frequencyDenominator += toNum(r.reach)
    }
  }

  const frequency =
    base.frequencyDenominator > 0
      ? base.frequencyNumerator / base.frequencyDenominator
      : div(base.impressions, base.reach) || 0

  const summary = {
    id: base.id,
    level: base.level,
    name: base.name,

    impressions: base.impressions,
    reach: base.reach,
    frequency,

    cpm: base.impressions > 0 ? (base.spend / base.impressions) * 1000 : 0,
    ctr_link: pct(base.link_clicks, base.impressions),
    cpc_link: div(base.spend, base.link_clicks),

    link_clicks: base.link_clicks,
    spend: base.spend,

    cost_per_result: div(base.spend, base.purchases),
    roas: div(base.purchase_value, base.spend) || 0,

    purchases: base.purchases,
    purchase_value: base.purchase_value,

    conversione_acquisti: pct(base.purchases, base.link_clicks),
    cro_campagna: pct(base.purchases, base.link_clicks),
    aov_campagna: div(base.purchase_value, base.purchases),

    thumbnail_url: null,
  }

  return summary
}

function delta(current, previous) {
  current = toNum(current)
  previous = toNum(previous)

  if (previous === 0 && current === 0) return 0
  if (previous === 0) return null

  return ((current - previous) / previous) * 100
}

async function metaFetch(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value)
    }
  }

  url.searchParams.set('access_token', META_TOKEN)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json()

  if (data?.error) {
    throw new Error(data.error.message || 'Errore Meta API')
  }

  return data
}

async function fetchInsightsForAccount(accountId, level, range) {
  const fields = [
    'account_name',
    'campaign_id',
    'campaign_name',
    'adset_id',
    'adset_name',
    'ad_id',
    'ad_name',
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
    'cost_per_action_type',
    'purchase_roas',
  ].join(',')

  const params = {
    fields,
    level,
    time_range: JSON.stringify({
      since: range.since,
      until: range.until,
    }),
    limit: '500',
  }

  let all = []
  let data = await metaFetch(`${accountId}/insights`, params)

  all = all.concat(data.data || [])

  while (data?.paging?.next) {
    const res = await fetch(data.paging.next, { cache: 'no-store' })
    data = await res.json()

    if (data?.error) {
      throw new Error(data.error.message || 'Errore Meta API pagination')
    }

    all = all.concat(data.data || [])
  }

  return all.map(row => normalizeRow(row, level, accountId))
}

async function fetchAllInsights(accounts, range) {
  const levels = ['campaign', 'adset', 'ad']

  const errors = []
  const hierarchy = []

  for (const accountId of accounts) {
    for (const level of levels) {
      try {
        const rows = await fetchInsightsForAccount(accountId, level, range)
        hierarchy.push(...rows)
      } catch (err) {
        errors.push({
          account: accountId,
          level,
          error: err.message,
        })
      }
    }
  }

  return { hierarchy, errors }
}

async function fetchCreativeMap(adIds) {
  const uniqueIds = [...new Set(adIds.filter(Boolean))]
  const out = {}

  for (const adId of uniqueIds) {
    try {
      const data = await metaFetch(adId, {
        fields: 'id,name,creative{thumbnail_url,image_url}',
      })

      out[adId] =
        data?.creative?.thumbnail_url ||
        data?.creative?.image_url ||
        null
    } catch {
      out[adId] = null
    }
  }

  return out
}

function buildInsight(summary, range) {
  if (!summary || summary.spend <= 0) {
    return 'Non ci sono dati Meta disponibili nel periodo selezionato.'
  }

  const parts = []

  parts.push(
    `Nel periodo ${range.since} → ${range.until}, Meta ha generato ${Math.round(summary.impressions).toLocaleString('it-IT')} impression, ${Math.round(summary.reach).toLocaleString('it-IT')} persone raggiunte e ${Math.round(summary.link_clicks).toLocaleString('it-IT')} click sul link, con una spesa totale di €${Math.round(summary.spend).toLocaleString('it-IT')}.`
  )

  parts.push(
    `La frequenza media è ${summary.frequency.toFixed(2)}, il CPM è €${summary.cpm.toFixed(2)}, il CTR link è ${summary.ctr_link.toFixed(2)}% e il CPC link è €${summary.cpc_link ? summary.cpc_link.toFixed(2) : '—'}.`
  )

  if (summary.purchases > 0) {
    parts.push(
      `Sono stati rilevati ${Math.round(summary.purchases).toLocaleString('it-IT')} acquisti, ROAS ${summary.roas.toFixed(2)}x, costo per risultato €${summary.cost_per_result ? summary.cost_per_result.toFixed(2) : '—'} e AOV campagna €${summary.aov_campagna ? summary.aov_campagna.toFixed(2) : '—'}.`
    )
  } else {
    parts.push(
      `Non risultano acquisti attribuiti nel periodo selezionato, quindi ROAS, costo per risultato e AOV campagna restano non significativi.`
    )
  }

  parts.push(
    `[Inferenza] In ottica Andromeda, conviene dare segnali creativi chiari all’algoritmo: creatività differenziate, angoli di comunicazione distinti, naming ordinato e segnali di conversione coerenti, evitando troppe varianti quasi uguali.`
  )

  return parts.join(' ')
}

function buildTodos(summary, hierarchy) {
  const todos = []

  if (!summary || summary.spend <= 0) {
    return [
      'Non ci sono dati sufficienti nel periodo selezionato. Controlla range date, account Meta e permessi token.',
    ]
  }

  if (summary.frequency > 8) {
    todos.push(
      `[Inferenza] Frequenza alta (${summary.frequency.toFixed(2)}): controlla saturazione creativa. Inserisci nuovi hook, nuove angle e nuove prime righe copy.`
    )
  }

  if (summary.ctr_link > 0 && summary.ctr_link < 1) {
    todos.push(
      `[Inferenza] CTR link basso (${summary.ctr_link.toFixed(2)}%): testa creatività più dirette, promessa più chiara e visual con beneficio immediato.`
    )
  }

  if (summary.link_clicks > 100 && summary.purchases === 0) {
    todos.push(
      `[Inferenza] Ci sono click ma non acquisti: controlla landing page, offerta, checkout, prezzo e coerenza messaggio-annuncio.`
    )
  }

  const campaigns = hierarchy.filter(x => x.level === 'campaign')
  const weakCampaigns = campaigns
    .filter(x => x.spend > 50 && x.roas < 1)
    .slice(0, 3)

  for (const c of weakCampaigns) {
    todos.push(
      `[Inferenza] Campagna "${c.name}" con ROAS basso (${c.roas.toFixed(2)}x): valuta taglio budget, nuova creatività o nuova offerta prima di scalare.`
    )
  }

  const bestCampaigns = campaigns
    .filter(x => x.roas >= 2 && x.purchases > 0)
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 2)

  for (const c of bestCampaigns) {
    todos.push(
      `[Inferenza] Campagna "${c.name}" performante: valuta scaling graduale e nuove varianti creative coerenti con lo stesso angolo.`
    )
  }

  if (todos.length === 0) {
    todos.push(
      `[Inferenza] Non emergono criticità automatiche forti dai dati disponibili. Continua a scalare gradualmente le campagne con ROAS e CRO migliori.`
    )
  }

  return todos
}

function sortHierarchy(rows) {
  const order = {
    campaign: 1,
    adset: 2,
    ad: 3,
  }

  return rows.sort((a, b) => {
    const l = order[a.level] - order[b.level]
    if (l !== 0) return l
    return toNum(b.spend) - toNum(a.spend)
  })
}

export async function GET(req) {
  try {
    if (!META_TOKEN) {
      return json({
        ok: false,
        error: 'META_ACCESS_TOKEN mancante nelle variabili ambiente.',
        sources: { meta: false },
      })
    }

    const accounts = getAccounts()

    if (!accounts.length) {
      return json({
        ok: false,
        error: 'META_AD_ACCOUNT_ID mancante. Inserisci uno o più account separati da virgola.',
        sources: { meta: false },
      })
    }

    const { searchParams } = new URL(req.url)

    const preset = searchParams.get('preset') || 'last_28d'
    let range = getPresetRange(preset)

    const customSince = searchParams.get('since')
    const customUntil = searchParams.get('until')

    if (preset === 'custom' && customSince && customUntil) {
      range = {
        since: customSince,
        until: customUntil,
      }
    }

    const previousRange = getPreviousRange(range)

    const [current, previous] = await Promise.all([
      fetchAllInsights(accounts, range),
      fetchAllInsights(accounts, previousRange),
    ])

    const hierarchy = sortHierarchy(current.hierarchy)
    const previousHierarchy = previous.hierarchy

    const summary = aggregateRows(
      hierarchy.filter(x => x.level === 'campaign'),
      'summary'
    )

    const previousSummary = aggregateRows(
      previousHierarchy.filter(x => x.level === 'campaign'),
      'summary'
    )

    const comparison = {
      spend: delta(summary.spend, previousSummary.spend),
      roas: delta(summary.roas, previousSummary.roas),
      cpa: delta(summary.cost_per_result || 0, previousSummary.cost_per_result || 0),
      ctr: delta(summary.ctr_link, previousSummary.ctr_link),
      frequency: delta(summary.frequency, previousSummary.frequency),
      cpm: delta(summary.cpm, previousSummary.cpm),
      cpc_link: delta(summary.cpc_link || 0, previousSummary.cpc_link || 0),
      purchases: delta(summary.purchases, previousSummary.purchases),
    }

    const adIds = hierarchy
      .filter(x => x.level === 'ad')
      .map(x => x.ad_id)

    const creativeMap = await fetchCreativeMap(adIds)

    const hierarchyWithCreative = hierarchy.map(row => ({
      ...row,
      thumbnail_url:
        row.level === 'ad'
          ? creativeMap[row.ad_id] || null
          : null,
    }))

    const insight = buildInsight(summary, range)
    const todos = buildTodos(summary, hierarchyWithCreative)

    return json({
      ok: true,
      preset,
      range,
      previousRange,
      accounts,

      summary,
      previousSummary,
      comparison,

      insight,
      todos,

      hierarchy: hierarchyWithCreative,

      errors: [...current.errors, ...previous.errors],

      sources: {
        meta: hierarchyWithCreative.length > 0,
      },

      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return json({
      ok: false,
      error: err.message || 'Errore sconosciuto nella route meta-detail.',
      sources: { meta: false },
    }, 500)
  }
}
