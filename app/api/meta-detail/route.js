export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID

const GRAPH_VERSION = 'v19.0'

function json(data, status = 200) {
  return NextResponse.json(data, { status })
}

function getAccounts() {
  return String(META_ACCOUNT || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(id => id.startsWith('act_') ? id : `act_${id}`)
}

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function safeDiv(a, b) {
  return b > 0 ? a / b : 0
}

function iso(d) {
  return d.toISOString().slice(0, 10)
}

function addDays(d, days) {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function getRange(preset) {
  const today = new Date()
  const endToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  let since
  let until

  if (preset === 'yesterday') {
    since = addDays(endToday, -1)
    until = addDays(endToday, -1)
  } else if (preset === 'last_7d') {
    since = addDays(endToday, -6)
    until = endToday
  } else if (preset === 'last_14d') {
    since = addDays(endToday, -13)
    until = endToday
  } else if (preset === 'last_28d') {
    since = addDays(endToday, -27)
    until = endToday
  } else if (preset === 'this_month') {
    since = startOfMonth(endToday)
    until = endToday
  } else if (preset === 'last_month') {
    const lastMonth = new Date(endToday.getFullYear(), endToday.getMonth() - 1, 1)
    since = startOfMonth(lastMonth)
    until = endOfMonth(lastMonth)
  } else {
    since = endToday
    until = endToday
  }

  const days = Math.max(1, Math.round((until - since) / 86400000) + 1)
  const prevUntil = addDays(since, -1)
  const prevSince = addDays(prevUntil, -(days - 1))

  return {
    since: iso(since),
    until: iso(until),
    previousSince: iso(prevSince),
    previousUntil: iso(prevUntil),
  }
}

async function fb(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`)

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v))
    }
  }

  url.searchParams.set('access_token', META_TOKEN)

  const res = await fetch(url.toString(), {
    cache: 'no-store',
  })

  const data = await res.json()

  if (!res.ok || data?.error) {
    const msg = data?.error?.message || `Meta API error ${res.status}`
    const code = data?.error?.code

    const isRateLimit =
      code === 4 ||
      code === 17 ||
      msg.toLowerCase().includes('user request limit') ||
      msg.toLowerCase().includes('rate limit')

    const err = new Error(msg)
    err.status = isRateLimit ? 429 : 500
    err.metaCode = code
    throw err
  }

  return data
}

async function fetchAll(path, params = {}) {
  let out = []
  let data = await fb(path, params)

  out = out.concat(data.data || [])

  while (data?.paging?.next && out.length < 500) {
    const res = await fetch(data.paging.next, { cache: 'no-store' })
    data = await res.json()

    if (data?.error) {
      const err = new Error(data.error.message)
      err.status = 500
      throw err
    }

    out = out.concat(data.data || [])
  }

  return out
}

function getActionValue(actions, keys) {
  if (!Array.isArray(actions)) return 0

  for (const key of keys) {
    const found = actions.find(a => a.action_type === key)
    if (found) return n(found.value)
  }

  return 0
}

function normalizeInsight(row, level, accountId, accountName) {
  const impressions = n(row.impressions)
  const reach = n(row.reach)
  const spend = n(row.spend)
  const frequency = n(row.frequency)
  const cpm = n(row.cpm)

  const linkClicks =
    n(row.inline_link_clicks) ||
    getActionValue(row.outbound_clicks, ['outbound_click']) ||
    getActionValue(row.actions, ['link_click'])

  const ctrLink =
    n(row.inline_link_click_ctr) ||
    safeDiv(linkClicks, impressions) * 100

  const cpcLink =
    n(row.cost_per_inline_link_click) ||
    safeDiv(spend, linkClicks)

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

  const costPerResult = purchases > 0 ? spend / purchases : 0
  const roas = spend > 0 ? purchaseValue / spend : 0
  const conversioneAcquisti = linkClicks > 0 ? purchases / linkClicks * 100 : 0
  const croCampagna = conversioneAcquisti
  const aovCampagna = purchases > 0 ? purchaseValue / purchases : 0

  const id =
    row.campaign_id ||
    row.adset_id ||
    row.ad_id ||
    accountId

  const name =
    row.campaign_name ||
    row.adset_name ||
    row.ad_name ||
    accountName ||
    id

  return {
    id,
    level,
    account_id: accountId,
    account_name: accountName || accountId,

    campaign_id: row.campaign_id || null,
    campaign_name: row.campaign_name || null,
    adset_id: row.adset_id || null,
    adset_name: row.adset_name || null,
    ad_id: row.ad_id || null,
    ad_name: row.ad_name || null,

    name,
    status: 'ACTIVE',

    impressions,
    reach,
    frequency,
    cpm,
    ctr_link: ctrLink,
    cpc_link: cpcLink,
    link_clicks: linkClicks,
    spend,
    cost_per_result: costPerResult,
    roas,
    purchases,
    purchase_value: purchaseValue,
    conversione_acquisti: conversioneAcquisti,
    cro_campagna: croCampagna,
    aov_campagna: aovCampagna,

    thumbnail_url: row.thumbnail_url || null,
  }
}

function sumRows(rows) {
  const s = {
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
  }

  for (const r of rows) {
    s.impressions += n(r.impressions)
    s.reach += n(r.reach)
    s.link_clicks += n(r.link_clicks)
    s.spend += n(r.spend)
    s.purchases += n(r.purchases)
    s.purchase_value += n(r.purchase_value)
  }

  s.frequency = safeDiv(s.impressions, s.reach)
  s.cpm = safeDiv(s.spend, s.impressions) * 1000
  s.ctr_link = safeDiv(s.link_clicks, s.impressions) * 100
  s.cpc_link = safeDiv(s.spend, s.link_clicks)
  s.cost_per_result = safeDiv(s.spend, s.purchases)
  s.roas = safeDiv(s.purchase_value, s.spend)
  s.conversione_acquisti = safeDiv(s.purchases, s.link_clicks) * 100
  s.cro_campagna = s.conversione_acquisti
  s.aov_campagna = safeDiv(s.purchase_value, s.purchases)

  return s
}

function pct(current, previous) {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

function makeInsight(summary, range) {
  if (!summary || summary.impressions <= 0) {
    return 'Non ci sono dati Meta disponibili nel periodo selezionato.'
  }

  const parts = []

  parts.push(
    `Nel periodo ${range.since} → ${range.until}, Meta ha generato ${Math.round(summary.impressions).toLocaleString('it-IT')} impression, ${Math.round(summary.reach).toLocaleString('it-IT')} persone raggiunte e ${Math.round(summary.link_clicks).toLocaleString('it-IT')} click sul link, con una spesa totale di €${Math.round(summary.spend).toLocaleString('it-IT')}.`
  )

  parts.push(
    `La frequenza media è ${summary.frequency.toFixed(2)}, il CPM è €${summary.cpm.toFixed(2)}, il CTR link è ${summary.ctr_link.toFixed(2)}% e il CPC link è €${summary.cpc_link.toFixed(2)}.`
  )

  if (summary.purchases > 0) {
    parts.push(
      `Sono stati rilevati ${Math.round(summary.purchases).toLocaleString('it-IT')} acquisti, ROAS ${summary.roas.toFixed(2)}x, costo per risultato €${summary.cost_per_result.toFixed(2)} e AOV campagna €${summary.aov_campagna.toFixed(2)}.`
    )
  } else {
    parts.push(
      `Non risultano acquisti attribuiti nel periodo selezionato. [Inferenza] Prima di scalare, controlla coerenza tra creatività, offerta, landing e checkout.`
    )
  }

  parts.push(
    `[Inferenza] In ottica Andromeda, conviene dare segnali creativi chiari all’algoritmo: creatività differenziate, naming ordinato e segnali di conversione coerenti.`
  )

  return parts.join(' ')
}

function makeTodos(summary) {
  const todos = []

  if (!summary || summary.impressions <= 0) {
    return ['[Inferenza] Nessun dato disponibile: verifica periodo, account Meta, token e campagne attive.']
  }

  if (summary.frequency > 8) {
    todos.push(`[Inferenza] Frequenza alta (${summary.frequency.toFixed(2)}): controlla saturazione creativa. Inserisci nuovi hook, nuove angle e nuove prime righe copy.`)
  }

  if (summary.ctr_link < 1) {
    todos.push(`[Inferenza] CTR link sotto 1%: testa creatività più dirette, promesse più chiare e visual con maggiore contrasto.`)
  }

  if (summary.link_clicks > 0 && summary.purchases === 0) {
    todos.push(`[Inferenza] Ci sono click ma non acquisti: controlla landing, offerta, prezzo, checkout e coerenza messaggio-annuncio.`)
  }

  if (summary.roas > 0 && summary.roas < 1.5) {
    todos.push(`[Inferenza] ROAS basso: riduci budget sulle campagne con CPA alto e concentra spesa su campagne/ad set con migliore conversione.`)
  }

  if (todos.length === 0) {
    todos.push('[Inferenza] Non emergono criticità automatiche forti dai dati disponibili. Continua a scalare gradualmente le campagne con ROAS e CRO migliori.')
  }

  return todos
}

async function fetchCampaignRows(account, range) {
  const filtering = [
    {
      field: 'campaign.effective_status',
      operator: 'IN',
      value: ['ACTIVE'],
    },
  ]

  const rows = await fetchAll(`${account}/insights`, {
    level: 'campaign',
    fields: [
      'campaign_id',
      'campaign_name',
      'impressions',
      'reach',
      'frequency',
      'cpm',
      'inline_link_clicks',
      'inline_link_click_ctr',
      'cost_per_inline_link_click',
      'spend',
      'actions',
      'action_values',
    ].join(','),
    time_range: {
      since: range.since,
      until: range.until,
    },
    filtering,
    limit: 100,
  })

  return rows.map(r => normalizeInsight(r, 'campaign', account, account))
}

async function fetchAdsetRows(account, range, campaignId) {
  const filtering = [
    {
      field: 'campaign.id',
      operator: 'EQUAL',
      value: campaignId,
    },
    {
      field: 'adset.effective_status',
      operator: 'IN',
      value: ['ACTIVE'],
    },
  ]

  const rows = await fetchAll(`${account}/insights`, {
    level: 'adset',
    fields: [
      'campaign_id',
      'campaign_name',
      'adset_id',
      'adset_name',
      'impressions',
      'reach',
      'frequency',
      'cpm',
      'inline_link_clicks',
      'inline_link_click_ctr',
      'cost_per_inline_link_click',
      'spend',
      'actions',
      'action_values',
    ].join(','),
    time_range: {
      since: range.since,
      until: range.until,
    },
    filtering,
    limit: 100,
  })

  return rows.map(r => normalizeInsight(r, 'adset', account, account))
}

async function fetchAdRows(account, range, adsetId) {
  const filtering = [
    {
      field: 'adset.id',
      operator: 'EQUAL',
      value: adsetId,
    },
    {
      field: 'ad.effective_status',
      operator: 'IN',
      value: ['ACTIVE'],
    },
  ]

  const insightRows = await fetchAll(`${account}/insights`, {
    level: 'ad',
    fields: [
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
      'inline_link_clicks',
      'inline_link_click_ctr',
      'cost_per_inline_link_click',
      'spend',
      'actions',
      'action_values',
    ].join(','),
    time_range: {
      since: range.since,
      until: range.until,
    },
    filtering,
    limit: 100,
  })

  const ads = await fetchAll(`${adsetId}/ads`, {
    fields: 'id,name,effective_status,creative{thumbnail_url}',
    effective_status: ['ACTIVE'],
    limit: 100,
  })

  const thumbMap = {}
  for (const ad of ads) {
    thumbMap[ad.id] = ad?.creative?.thumbnail_url || null
  }

  return insightRows.map(r => ({
    ...normalizeInsight(r, 'ad', account, account),
    thumbnail_url: thumbMap[r.ad_id] || null,
  }))
}

async function fetchPreviousSummary(accounts, previousRange) {
  const all = []

  for (const account of accounts) {
    const rows = await fetchCampaignRows(account, {
      since: previousRange.previousSince,
      until: previousRange.previousUntil,
    })

    all.push(...rows)
  }

  return sumRows(all)
}

export async function GET(req) {
  try {
    if (!META_TOKEN || !META_ACCOUNT) {
      return json({
        ok: false,
        error: 'META_ACCESS_TOKEN o META_AD_ACCOUNT_ID mancanti.',
        rows: [],
      }, 500)
    }

    const { searchParams } = new URL(req.url)

    const preset = searchParams.get('preset') || 'last_28d'
    const level = searchParams.get('level') || 'campaigns'
    const campaignId = searchParams.get('campaign_id')
    const adsetId = searchParams.get('adset_id')

    const range = getRange(preset)
    const accounts = getAccounts()

    let rows = []

    if (level === 'adsets') {
      if (!campaignId) {
        return json({ ok: false, error: 'campaign_id mancante', rows: [] }, 400)
      }

      for (const account of accounts) {
        rows.push(...await fetchAdsetRows(account, range, campaignId))
      }
    } else if (level === 'ads') {
      if (!adsetId) {
        return json({ ok: false, error: 'adset_id mancante', rows: [] }, 400)
      }

      for (const account of accounts) {
        rows.push(...await fetchAdRows(account, range, adsetId))
      }
    } else {
      for (const account of accounts) {
        rows.push(...await fetchCampaignRows(account, range))
      }
    }

    rows = rows
      .filter(r => r.spend > 0 || r.impressions > 0)
      .sort((a, b) => b.spend - a.spend)

    const summary = sumRows(rows)

    let previousSummary = null
    let comparison = null

    if (level === 'campaigns') {
      previousSummary = await fetchPreviousSummary(accounts, range)

      comparison = {
        spend: pct(summary.spend, previousSummary.spend),
        roas: pct(summary.roas, previousSummary.roas),
        cpa: pct(summary.cost_per_result, previousSummary.cost_per_result),
        ctr: pct(summary.ctr_link, previousSummary.ctr_link),
      }
    }

    return json({
      ok: true,
      preset,
      level,
      range: {
        since: range.since,
        until: range.until,
      },
      previousRange: {
        since: range.previousSince,
        until: range.previousUntil,
      },
      accounts,
      summary,
      previousSummary,
      comparison,
      insight: makeInsight(summary, range),
      todos: makeTodos(summary),
      rows,
    })
  } catch (err) {
    return json({
      ok: false,
      error: err.message || 'Errore sconosciuto',
      rows: [],
      summary: {},
    }, err.status || 500)
  }
}
