export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT_RAW =
  process.env.META_AD_ACCOUNT_ID ||
  process.env.META_ACCOUNT_ID ||
  ''

const API_VERSION = 'v19.0'

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

function firstDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function lastDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function normalizeAccountId(id) {
  const clean = String(id || '').trim()
  if (!clean) return null
  return clean.startsWith('act_') ? clean : `act_${clean}`
}

function getAccounts() {
  return META_ACCOUNT_RAW
    .split(',')
    .map(s => normalizeAccountId(s))
    .filter(Boolean)
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function int(v) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}

function div(a, b) {
  a = num(a)
  b = num(b)
  return b > 0 ? a / b : 0
}

function sum(arr, key) {
  return arr.reduce((s, r) => s + num(r[key]), 0)
}

function getActionValue(actions, types) {
  if (!Array.isArray(actions)) return 0

  for (const type of types) {
    const found = actions.find(a => a.action_type === type)
    if (found) return num(found.value)
  }

  return 0
}

function parsePreset(preset, searchParams) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let since
  let until

  switch (preset) {
    case 'yesterday':
      since = addDays(today, -1)
      until = addDays(today, -1)
      break

    case 'last_7d':
      since = addDays(today, -6)
      until = today
      break

    case 'last_14d':
      since = addDays(today, -13)
      until = today
      break

    case 'last_28d':
      since = addDays(today, -27)
      until = today
      break

    case 'this_month':
      since = firstDayOfMonth(today)
      until = today
      break

    case 'last_month': {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      since = firstDayOfMonth(lastMonth)
      until = lastDayOfMonth(lastMonth)
      break
    }

    case 'custom': {
      const s = searchParams.get('since')
      const u = searchParams.get('until')

      since = s ? new Date(s) : today
      until = u ? new Date(u) : today
      break
    }

    case 'today':
    default:
      since = today
      until = today
      break
  }

  return {
    since: iso(since),
    until: iso(until),
  }
}

function previousRange(range) {
  const since = new Date(range.since)
  const until = new Date(range.until)

  const days =
    Math.round((until.getTime() - since.getTime()) / 86400000) + 1

  const prevUntil = addDays(since, -1)
  const prevSince = addDays(prevUntil, -(days - 1))

  return {
    since: iso(prevSince),
    until: iso(prevUntil),
  }
}

function encodeTimeRange(range) {
  return encodeURIComponent(
    JSON.stringify({
      since: range.since,
      until: range.until,
    })
  )
}

async function metaFetch(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  }

  url.searchParams.set('access_token', META_TOKEN)

  const res = await fetch(url.toString(), {
    cache: 'no-store',
  })

  const json = await res.json()

  if (!res.ok || json.error) {
    throw new Error(json?.error?.message || 'Errore Meta API')
  }

  return json
}

async function fetchInsightsForAccount(accountId, range, level = 'campaign') {
  const baseFields = [
    'account_id',
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
    'ctr',
    'inline_link_clicks',
    'cost_per_inline_link_click',
    'actions',
    'action_values',
    'cost_per_action_type',
  ]

  const json = await metaFetch(`${accountId}/insights`, {
    level,
    fields: baseFields.join(','),
    time_range: JSON.stringify({
      since: range.since,
      until: range.until,
    }),
    limit: 500,
  })

  return json.data || []
}

async function fetchAllAccounts(range, level) {
  const accounts = getAccounts()

  const settled = await Promise.allSettled(
    accounts.map(accountId =>
      fetchInsightsForAccount(accountId, range, level)
    )
  )

  const rows = []
  const errors = []

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      rows.push(...result.value)
    } else {
      errors.push(result.reason?.message || 'Errore Meta sconosciuto')
    }
  }

  return {
    rows,
    errors,
  }
}

function normalizeRow(row, level) {
  const actions = row.actions || []
  const values = row.action_values || []
  const costs = row.cost_per_action_type || []

  const purchases = getActionValue(actions, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
    'onsite_conversion.purchase',
  ])

  const purchaseValue = getActionValue(values, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
    'onsite_conversion.purchase',
  ])

  const costPerResult =
    getActionValue(costs, [
      'purchase',
      'omni_purchase',
      'offsite_conversion.fb_pixel_purchase',
      'onsite_conversion.purchase',
    ]) || div(num(row.spend), purchases)

  const linkClicks =
    int(row.inline_link_clicks) ||
    getActionValue(actions, ['link_click', 'inline_link_click'])

  const spend = num(row.spend)
  const impressions = int(row.impressions)
  const reach = int(row.reach)

  const name =
    level === 'campaign'
      ? row.campaign_name || 'Campagna'
      : level === 'adset'
        ? row.adset_name || 'Ad set'
        : row.ad_name || 'Ad'

  const id =
    level === 'campaign'
      ? row.campaign_id
      : level === 'adset'
        ? row.adset_id
        : row.ad_id

  return {
    id: id || `${level}_${name}`,
    level,
    name,

    account_id: row.account_id || null,
    account_name: row.account_name || null,

    campaign_id: row.campaign_id || null,
    campaign_name: row.campaign_name || null,

    adset_id: row.adset_id || null,
    adset_name: row.adset_name || null,

    ad_id: row.ad_id || null,
    ad_name: row.ad_name || null,

    impressions,
    reach,
    frequency: num(row.frequency),
    cpm: num(row.cpm),
    ctr_link: num(row.ctr),
    cpc_link: num(row.cost_per_inline_link_click),
    link_clicks: linkClicks,

    spend,
    cost_per_result: costPerResult,
    roas: div(purchaseValue, spend),
    purchases,
    purchase_value: purchaseValue,
    conversione_acquisti: div(purchases, linkClicks) * 100,
    cro_campagna: div(purchases, linkClicks) * 100,
    aov_campagna: div(purchaseValue, purchases),

    thumbnail_url: null,
  }
}

function aggregateSummary(rows) {
  const spend = sum(rows, 'spend')
  const impressions = sum(rows, 'impressions')
  const reach = sum(rows, 'reach')
  const linkClicks = sum(rows, 'link_clicks')
  const purchases = sum(rows, 'purchases')
  const purchaseValue = sum(rows, 'purchase_value')

  return {
    spend,
    impressions,
    reach,
    frequency: div(impressions, reach),
    cpm: div(spend, impressions) * 1000,
    ctr_link: div(linkClicks, impressions) * 100,
    cpc_link: div(spend, linkClicks),
    link_clicks: linkClicks,
    cost_per_result: div(spend, purchases),
    roas: div(purchaseValue, spend),
    purchases,
    purchase_value: purchaseValue,
    conversione_acquisti: div(purchases, linkClicks) * 100,
    cro_campagna: div(purchases, linkClicks) * 100,
    aov_campagna: div(purchaseValue, purchases),
  }
}

function pctChange(current, previous) {
  current = num(current)
  previous = num(previous)

  if (previous === 0 && current === 0) return 0
  if (previous === 0) return 100

  return ((current - previous) / previous) * 100
}

function buildComparison(current, previous) {
  return {
    spend: pctChange(current.spend, previous.spend),
    roas: pctChange(current.roas, previous.roas),
    cpa: pctChange(current.cost_per_result, previous.cost_per_result),
    ctr: pctChange(current.ctr_link, previous.ctr_link),
  }
}

function buildInsight(range, summary) {
  if (!summary || summary.impressions === 0) {
    return 'Non ci sono dati Meta disponibili nel periodo selezionato.'
  }

  const parts = []

  parts.push(
    `Nel periodo ${range.since} → ${range.until}, Meta ha generato ${Math.round(summary.impressions).toLocaleString('it-IT')} impression, ${Math.round(summary.reach).toLocaleString('it-IT')} persone raggiunte e ${Math.round(summary.link_clicks).toLocaleString('it-IT')} click sul link, con una spesa totale di €${summary.spend.toFixed(0)}.`
  )

  parts.push(
    `La frequenza media è ${summary.frequency.toFixed(2)}, il CPM è €${summary.cpm.toFixed(2)}, il CTR link è ${summary.ctr_link.toFixed(2)}% e il CPC link è €${summary.cpc_link.toFixed(2)}.`
  )

  if (summary.purchases > 0) {
    parts.push(
      `Sono stati rilevati ${summary.purchases.toFixed(0)} acquisti, ROAS ${summary.roas.toFixed(2)}x, costo per risultato €${summary.cost_per_result.toFixed(2)} e AOV campagna €${summary.aov_campagna.toFixed(2)}.`
    )
  } else {
    parts.push(
      `Non risultano acquisti attribuiti nel periodo selezionato: il ROAS è ${summary.roas.toFixed(2)}x e il costo per risultato non è calcolabile.`
    )
  }

  parts.push(
    `[Inferenza] In ottica Andromeda, conviene dare più segnali creativi chiari all’algoritmo: creatività differenziate, angoli di comunicazione distinti e segnali di conversione coerenti, evitando troppe varianti quasi uguali.`
  )

  return parts.join(' ')
}

function buildTodos(summary, rows) {
  const todos = []

  if (!summary || summary.impressions === 0) {
    return [
      'Non ci sono dati sufficienti nel periodo selezionato. Verifica account, permessi, periodo e campagne attive.',
    ]
  }

  if (summary.ctr_link < 1) {
    todos.push(
      '[Inferenza] CTR link basso: testa nuovi hook creativi, prime righe copy più dirette e visual con proposta di valore più chiara.'
    )
  }

  if (summary.link_clicks > 0 && summary.purchases === 0) {
    todos.push(
      '[Inferenza] Ci sono click ma non acquisti: controlla landing, offerta, checkout e coerenza messaggio-annuncio.'
    )
  }

  if (summary.frequency > 4 && summary.ctr_link < 1.2) {
    todos.push(
      '[Inferenza] Frequenza alta con CTR non forte: possibile saturazione creativa. Inserisci nuovi asset e nuovi angoli.'
    )
  }

  const sortedBySpend = [...rows]
    .filter(r => r.level === 'campaign')
    .sort((a, b) => b.spend - a.spend)

  const top = sortedBySpend[0]

  if (top && top.spend > 0 && top.roas < 1) {
    todos.push(
      `[Inferenza] La campagna “${top.name}” assorbe budget ma ha ROAS sotto 1: valuta riduzione budget o revisione creatività/offerta.`
    )
  }

  if (todos.length === 0) {
    todos.push(
      '[Inferenza] Non emergono criticità automatiche forti dai dati disponibili. Continua a scalare gradualmente le campagne con ROAS e CRO migliori.'
    )
  }

  return todos
}

async function fetchAdThumbnails(adRows) {
  const ads = adRows
    .filter(r => r.ad_id)
    .slice(0, 50)

  if (ads.length === 0) return adRows

  const updated = [...adRows]

  await Promise.allSettled(
    ads.map(async ad => {
      try {
        const json = await metaFetch(ad.ad_id, {
          fields: 'creative{thumbnail_url,image_url,object_story_spec}',
        })

        const thumb =
          json?.creative?.thumbnail_url ||
          json?.creative?.image_url ||
          null

        if (!thumb) return

        const index = updated.findIndex(r => r.ad_id === ad.ad_id)

        if (index >= 0) {
          updated[index] = {
            ...updated[index],
            thumbnail_url: thumb,
          }
        }
      } catch {
        // Se Meta non dà il permesso sulle creative, lasciamo thumbnail null.
      }
    })
  )

  return updated
}

export async function GET(req) {
  try {
    if (!META_TOKEN) {
      return NextResponse.json({
        ok: false,
        error: 'META_ACCESS_TOKEN mancante',
        sources: {
          meta: false,
        },
      })
    }

    const accounts = getAccounts()

    if (accounts.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'META_AD_ACCOUNT_ID mancante',
        sources: {
          meta: false,
        },
      })
    }

    const { searchParams } = new URL(req.url)

    const preset = searchParams.get('preset') || 'today'
    const range = parsePreset(preset, searchParams)
    const prevRange = previousRange(range)

    const [
      campaignResult,
      adsetResult,
      adResult,
      prevCampaignResult,
    ] = await Promise.all([
      fetchAllAccounts(range, 'campaign'),
      fetchAllAccounts(range, 'adset'),
      fetchAllAccounts(range, 'ad'),
      fetchAllAccounts(prevRange, 'campaign'),
    ])

    const campaignRows = campaignResult.rows.map(r =>
      normalizeRow(r, 'campaign')
    )

    const adsetRows = adsetResult.rows.map(r =>
      normalizeRow(r, 'adset')
    )

    let adRows = adResult.rows.map(r =>
      normalizeRow(r, 'ad')
    )

    adRows = await fetchAdThumbnails(adRows)

    const hierarchy = [
      ...campaignRows,
      ...adsetRows,
      ...adRows,
    ]

    const summary = aggregateSummary(campaignRows)
    const prevSummary = aggregateSummary(
      prevCampaignResult.rows.map(r => normalizeRow(r, 'campaign'))
    )

    const comparison = buildComparison(summary, prevSummary)

    const errors = [
      ...campaignResult.errors,
      ...adsetResult.errors,
      ...adResult.errors,
      ...prevCampaignResult.errors,
    ]

    return NextResponse.json({
      ok: true,

      preset,
      range,
      previousRange: prevRange,

      accounts,

      summary,
      comparison,

      insight: buildInsight(range, summary),
      todos: buildTodos(summary, hierarchy),

      hierarchy,

      rows: hierarchy,

      sources: {
        meta: hierarchy.length > 0,
      },

      warnings: errors,

      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'Errore sconosciuto Meta Detail',
        sources: {
          meta: false,
        },
      },
      {
        status: 500,
      }
    )
  }
}
