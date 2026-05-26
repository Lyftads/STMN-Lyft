import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v20.0'

const ACCESS_TOKEN =
  process.env.META_ACCESS_TOKEN ||
  process.env.FACEBOOK_ACCESS_TOKEN ||
  process.env.FB_ACCESS_TOKEN ||
  ''

const ACCOUNT_IDS_RAW =
  process.env.META_AD_ACCOUNT_IDS ||
  process.env.META_AD_ACCOUNTS ||
  process.env.META_AD_ACCOUNT_ID ||
  process.env.FB_AD_ACCOUNT_IDS ||
  process.env.FB_AD_ACCOUNT_ID ||
  ''

const ACTIVE_STATUSES = new Set(['ACTIVE'])

const INSIGHT_FIELDS = [
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
  'purchase_roas',
].join(',')

function cleanAccountId(id) {
  const s = String(id || '').trim()
  if (!s) return ''
  return s.startsWith('act_') ? s : `act_${s}`
}

function getAccountIds() {
  return ACCOUNT_IDS_RAW
    .split(',')
    .map(cleanAccountId)
    .filter(Boolean)
}

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function div(a, b) {
  return b > 0 ? a / b : 0
}

function pct(a, b) {
  return b > 0 ? (a / b) * 100 : 0
}

function iso(d) {
  return d.toISOString().slice(0, 10)
}

function addDays(d, days) {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + days)
  return x
}

function startOfMonth(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function endOfMonth(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
}

function getDateRange(preset, sinceParam, untilParam) {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  if (preset === 'yesterday') {
    const y = addDays(today, -1)
    return { since: iso(y), until: iso(y) }
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
    return { since: iso(startOfMonth(today)), until: iso(today) }
  }

  if (preset === 'last_month') {
    const prev = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
    return { since: iso(startOfMonth(prev)), until: iso(endOfMonth(prev)) }
  }

  if (preset === 'custom' && sinceParam && untilParam) {
    return { since: sinceParam, until: untilParam }
  }

  return { since: iso(today), until: iso(today) }
}

function previousSameRange(range) {
  const since = new Date(`${range.since}T00:00:00Z`)
  const until = new Date(`${range.until}T00:00:00Z`)
  const days = Math.round((until - since) / 86400000) + 1

  const prevUntil = addDays(since, -1)
  const prevSince = addDays(prevUntil, -(days - 1))

  return {
    since: iso(prevSince),
    until: iso(prevUntil),
  }
}

async function graph(path, params = {}) {
  if (!ACCESS_TOKEN) {
    throw new Error('META_ACCESS_TOKEN mancante nelle variabili ambiente.')
  }

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`)

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v))
    }
  })

  url.searchParams.set('access_token', ACCESS_TOKEN)

  const res = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  })

  const json = await res.json().catch(() => ({}))

  if (!res.ok || json.error) {
    const msg = json?.error?.message || `Errore Meta API ${res.status}`
    throw new Error(msg)
  }

  return json
}

async function graphAll(path, params = {}) {
  let out = []
  let first = await graph(path, params)

  out = out.concat(first.data || [])

  let next = first?.paging?.next

  while (next) {
    const res = await fetch(next, { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))

    if (!res.ok || json.error) break

    out = out.concat(json.data || [])
    next = json?.paging?.next
  }

  return out
}

function getActionValue(arr, names) {
  if (!Array.isArray(arr)) return 0

  return arr.reduce((sum, item) => {
    const type = String(item.action_type || '').toLowerCase()
    const match = names.some(name => type === name || type.includes(name))
    return match ? sum + n(item.value) : sum
  }, 0)
}

function getPurchaseRoas(row) {
  if (Array.isArray(row.purchase_roas)) {
    const found =
      row.purchase_roas.find(x => String(x.action_type || '').includes('purchase')) ||
      row.purchase_roas[0]

    return n(found?.value)
  }

  return 0
}

function normalizeInsight(row = {}) {
  const impressions = n(row.impressions)
  const reach = n(row.reach)
  const spend = n(row.spend)
  const linkClicks = n(row.inline_link_clicks)

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

  const roasFromMeta = getPurchaseRoas(row)
  const roas = roasFromMeta || div(purchaseValue, spend)

  return {
    impressions,
    reach,
    frequency: n(row.frequency) || div(impressions, reach),
    cpm: n(row.cpm) || div(spend * 1000, impressions),
    ctr_link: n(row.inline_link_click_ctr),
    cpc_link: n(row.cost_per_inline_link_click) || div(spend, linkClicks),
    link_clicks: linkClicks,
    spend,
    purchases,
    purchase_value: purchaseValue,
    cost_per_result: purchases > 0 ? spend / purchases : 0,
    roas,
    conversione_acquisti: pct(purchases, linkClicks),
    cro_campagna: pct(purchases, linkClicks),
    aov_campagna: purchases > 0 ? purchaseValue / purchases : 0,
  }
}

function emptyMetrics() {
  return normalizeInsight({})
}

function sumMetrics(rows) {
  const total = rows.reduce((a, r) => {
    a.impressions += n(r.impressions)
    a.reach += n(r.reach)
    a.link_clicks += n(r.link_clicks)
    a.spend += n(r.spend)
    a.purchases += n(r.purchases)
    a.purchase_value += n(r.purchase_value)
    return a
  }, {
    impressions: 0,
    reach: 0,
    link_clicks: 0,
    spend: 0,
    purchases: 0,
    purchase_value: 0,
  })

  return {
    impressions: total.impressions,
    reach: total.reach,
    frequency: div(total.impressions, total.reach),
    cpm: div(total.spend * 1000, total.impressions),
    ctr_link: pct(total.link_clicks, total.impressions),
    cpc_link: div(total.spend, total.link_clicks),
    link_clicks: total.link_clicks,
    spend: total.spend,
    purchases: total.purchases,
    purchase_value: total.purchase_value,
    cost_per_result: div(total.spend, total.purchases),
    roas: div(total.purchase_value, total.spend),
    conversione_acquisti: pct(total.purchases, total.link_clicks),
    cro_campagna: pct(total.purchases, total.link_clicks),
    aov_campagna: div(total.purchase_value, total.purchases),
  }
}

async function getObjectInsight(objectId, range) {
  const rows = await graphAll(`${objectId}/insights`, {
    fields: INSIGHT_FIELDS,
    time_range: {
      since: range.since,
      until: range.until,
    },
    limit: 100,
  })

  return normalizeInsight(rows[0] || {})
}

async function getActiveCampaigns(accountId) {
  const rows = await graphAll(`${accountId}/campaigns`, {
    fields: 'id,name,status,effective_status,objective',
    limit: 500,
  })

  return rows
    .filter(c => ACTIVE_STATUSES.has(String(c.effective_status || c.status || '').toUpperCase()))
    .map(c => ({
      id: c.id,
      name: c.name || 'Campagna',
      status: c.status || '',
      effective_status: c.effective_status || '',
      objective: c.objective || '',
      account_id: accountId,
    }))
}

async function getActiveAdsets(campaignId) {
  const rows = await graphAll(`${campaignId}/adsets`, {
    fields: 'id,name,status,effective_status,campaign_id',
    limit: 500,
  })

  return rows
    .filter(a => ACTIVE_STATUSES.has(String(a.effective_status || a.status || '').toUpperCase()))
    .map(a => ({
      id: a.id,
      name: a.name || 'Ad set',
      status: a.status || '',
      effective_status: a.effective_status || '',
      campaign_id: campaignId,
    }))
}

async function getActiveAds(adsetId) {
  const rows = await graphAll(`${adsetId}/ads`, {
    fields: 'id,name,status,effective_status,campaign_id,adset_id,creative{id,name,thumbnail_url,image_url,object_story_spec}',
    limit: 500,
  })

  return rows
    .filter(a => ACTIVE_STATUSES.has(String(a.effective_status || a.status || '').toUpperCase()))
    .map(a => ({
      id: a.id,
      name: a.name || 'Ad',
      status: a.status || '',
      effective_status: a.effective_status || '',
      adset_id: adsetId,
      campaign_id: a.campaign_id || '',
      thumbnail_url:
        a?.creative?.thumbnail_url ||
        a?.creative?.image_url ||
        null,
    }))
}

async function buildHierarchy(range) {
  const accounts = getAccountIds()

  if (!accounts.length) {
    throw new Error('Nessun account Meta configurato. Controlla META_AD_ACCOUNT_IDS.')
  }

  const hierarchy = []

  for (const accountId of accounts) {
    const campaigns = await getActiveCampaigns(accountId)

    for (const campaign of campaigns) {
      const campaignMetrics = await getObjectInsight(campaign.id, range)
      const adsetsRaw = await getActiveAdsets(campaign.id)

      const adsets = []

      for (const adset of adsetsRaw) {
        const adsetMetrics = await getObjectInsight(adset.id, range)
        const adsRaw = await getActiveAds(adset.id)

        const ads = []

        for (const ad of adsRaw) {
          const adMetrics = await getObjectInsight(ad.id, range)

          ads.push({
            ...ad,
            level: 'ad',
            metrics: adMetrics,
          })
        }

        adsets.push({
          ...adset,
          level: 'adset',
          metrics: adsetMetrics,
          ads,
        })
      }

      hierarchy.push({
        ...campaign,
        level: 'campaign',
        metrics: campaignMetrics,
        adsets,
      })
    }
  }

  return hierarchy
}

function flattenMetrics(hierarchy) {
  return hierarchy.map(c => c.metrics)
}

function compare(current, previous) {
  const delta = (a, b) => {
    if (!b) return null
    return ((a - b) / b) * 100
  }

  return {
    spend: delta(current.spend, previous.spend),
    roas: delta(current.roas, previous.roas),
    cpa: delta(current.cost_per_result, previous.cost_per_result),
    ctr: delta(current.ctr_link, previous.ctr_link),
  }
}

function makeInsight(summary, range) {
  if (!summary.impressions && !summary.spend) {
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
      `Non risultano acquisti attribuiti nel periodo; per questo ROAS, costo per risultato e AOV non sono pienamente valutabili.`
    )
  }

  parts.push(
    `[Inferenza] In ottica Andromeda, conviene dare segnali creativi chiari all’algoritmo: creatività differenziate, angoli di comunicazione distinti e segnali di conversione coerenti, evitando troppe varianti quasi uguali.`
  )

  return parts.join(' ')
}

function makeTodos(summary) {
  const todos = []

  if (summary.frequency > 8) {
    todos.push('[Inferenza] Frequenza alta: controlla saturazione creativa. Inserisci nuovi hook, nuove angle e nuove prime righe copy.')
  }

  if (summary.ctr_link > 0 && summary.ctr_link < 1) {
    todos.push('[Inferenza] CTR link basso: testa creatività con promessa più chiara, visual più diretto e messaggio meno generico.')
  }

  if (summary.link_clicks > 100 && summary.purchases === 0) {
    todos.push('[Inferenza] Ci sono click ma non acquisti: controlla landing, offerta, checkout e coerenza messaggio-annuncio.')
  }

  if (summary.roas > 3 && summary.purchases > 0) {
    todos.push('[Inferenza] Campagne con ROAS positivo: valuta scaling graduale mantenendo struttura e segnali coerenti.')
  }

  if (!todos.length) {
    todos.push('[Inferenza] Non emergono criticità automatiche forti dai dati disponibili. Continua a scalare gradualmente le campagne con ROAS e CRO migliori.')
  }

  return todos
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)

    const preset = searchParams.get('preset') || 'today'
    const sinceParam = searchParams.get('since')
    const untilParam = searchParams.get('until')

    const range = getDateRange(preset, sinceParam, untilParam)
    const previousRange = previousSameRange(range)

    const hierarchy = await buildHierarchy(range)
    const previousHierarchy = await buildHierarchy(previousRange)

    const summary = sumMetrics(flattenMetrics(hierarchy))
    const previousSummary = sumMetrics(flattenMetrics(previousHierarchy))

    return NextResponse.json({
      ok: true,
      preset,
      range,
      previousRange,
      accounts: getAccountIds(),
      summary,
      previousSummary,
      comparison: compare(summary, previousSummary),
      insight: makeInsight(summary, range),
      todos: makeTodos(summary),
      hierarchy,
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'Errore sconosciuto Meta Detail.',
        sources: {
          meta: false,
        },
      },
      { status: 200 }
    )
  }
}
