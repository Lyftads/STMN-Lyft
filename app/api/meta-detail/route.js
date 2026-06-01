export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID

const GRAPH_VERSION = 'v19.0'

function jsonError(message, status = 500, extra = {}) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      sources: { meta: false },
      ...extra,
    },
    { status }
  )
}

function cleanAccountId(id) {
  const x = String(id || '').trim()
  if (!x) return null
  return x.startsWith('act_') ? x : `act_${x}`
}

function getAccounts() {
  return String(META_ACCOUNT || '')
    .split(',')
    .map(cleanAccountId)
    .filter(Boolean)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function startOfMonth(date) {
  return `${date.slice(0, 7)}-01`
}

function endOfPreviousMonth(date) {
  const d = new Date(`${startOfMonth(date)}T00:00:00`)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function startOfPreviousMonth(date) {
  const endPrev = endOfPreviousMonth(date)
  return startOfMonth(endPrev)
}

function getRange(preset, searchParams) {
  const today = todayISO()

  if (preset === 'yesterday') {
    const y = addDays(today, -1)
    return { since: y, until: y }
  }

  if (preset === 'last_7d') {
    return { since: addDays(today, -6), until: today }
  }

  if (preset === 'last_14d') {
    return { since: addDays(today, -13), until: today }
  }

  if (preset === 'last_28d') {
    return { since: addDays(today, -27), until: today }
  }

  if (preset === 'this_month') {
    return { since: startOfMonth(today), until: today }
  }

  if (preset === 'last_month') {
    return {
      since: startOfPreviousMonth(today),
      until: endOfPreviousMonth(today),
    }
  }

  if (preset === 'custom') {
    const since = searchParams.get('since')
    const until = searchParams.get('until')

    if (since && until) return { since, until }
  }

  return { since: today, until: today }
}

function getPreviousRange(range) {
  const sinceDate = new Date(`${range.since}T00:00:00`)
  const untilDate = new Date(`${range.until}T00:00:00`)
  const diffDays = Math.round((untilDate - sinceDate) / 86400000) + 1

  return {
    since: addDays(range.since, -diffDays),
    until: addDays(range.since, -1),
  }
}

async function graph(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  }

  url.searchParams.set('access_token', META_TOKEN)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json()

  if (!res.ok || data.error) {
    const msg = data?.error?.message || `Meta API error ${res.status}`
    throw new Error(msg)
  }

  return data
}

async function graphAll(path, params = {}) {
  let data = await graph(path, params)
  let rows = Array.isArray(data.data) ? data.data : []

  while (data.paging?.next) {
    const res = await fetch(data.paging.next, { cache: 'no-store' })
    data = await res.json()

    if (data.error) throw new Error(data.error.message)

    rows = rows.concat(Array.isArray(data.data) ? data.data : [])
  }

  return rows
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function actionValue(actions, names) {
  if (!Array.isArray(actions)) return 0

  for (const name of names) {
    const found = actions.find(x => x.action_type === name)
    if (found) return num(found.value)
  }

  return 0
}

function moneyValue(actions, names) {
  if (!Array.isArray(actions)) return 0

  for (const name of names) {
    const found = actions.find(x => x.action_type === name)
    if (found) return num(found.value)
  }

  return 0
}

function calcRow(base, insight = {}) {
  const spend = num(insight.spend)
  const impressions = num(insight.impressions)
  const reach = num(insight.reach)
  const frequency = num(insight.frequency)
  const cpm = num(insight.cpm)

  const linkClicks =
    num(insight.inline_link_clicks) ||
    actionValue(insight.outbound_clicks, ['outbound_click']) ||
    actionValue(insight.actions, ['link_click'])

  const ctrLink =
    num(insight.inline_link_click_ctr) ||
    (impressions > 0 ? (linkClicks / impressions) * 100 : 0)

  const cpcLink =
    num(insight.cost_per_inline_link_click) ||
    (linkClicks > 0 ? spend / linkClicks : 0)

  const purchases = actionValue(insight.actions, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
  ])

  const purchaseValue = moneyValue(insight.action_values, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
  ])

  const costPerResult = purchases > 0 ? spend / purchases : 0
  const roas = spend > 0 ? purchaseValue / spend : 0
  const conversioneAcquisti = linkClicks > 0 ? (purchases / linkClicks) * 100 : 0
  const croCampagna = conversioneAcquisti
  const aovCampagna = purchases > 0 ? purchaseValue / purchases : 0

  return {
    ...base,

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
  }
}

function sumRows(rows) {
  const total = rows.reduce(
    (acc, row) => {
      acc.impressions += num(row.impressions)
      acc.reach += num(row.reach)
      acc.link_clicks += num(row.link_clicks)
      acc.spend += num(row.spend)
      acc.purchases += num(row.purchases)
      acc.purchase_value += num(row.purchase_value)
      acc.frequencyWeighted += num(row.frequency) * num(row.reach)
      acc.frequencyReach += num(row.reach)
      return acc
    },
    {
      impressions: 0,
      reach: 0,
      link_clicks: 0,
      spend: 0,
      purchases: 0,
      purchase_value: 0,
      frequencyWeighted: 0,
      frequencyReach: 0,
    }
  )

  total.frequency =
    total.frequencyReach > 0 ? total.frequencyWeighted / total.frequencyReach : 0

  total.cpm =
    total.impressions > 0 ? (total.spend / total.impressions) * 1000 : 0

  total.ctr_link =
    total.impressions > 0 ? (total.link_clicks / total.impressions) * 100 : 0

  total.cpc_link =
    total.link_clicks > 0 ? total.spend / total.link_clicks : 0

  total.cost_per_result =
    total.purchases > 0 ? total.spend / total.purchases : 0

  total.roas =
    total.spend > 0 ? total.purchase_value / total.spend : 0

  total.conversione_acquisti =
    total.link_clicks > 0 ? (total.purchases / total.link_clicks) * 100 : 0

  total.cro_campagna = total.conversione_acquisti

  total.aov_campagna =
    total.purchases > 0 ? total.purchase_value / total.purchases : 0

  delete total.frequencyWeighted
  delete total.frequencyReach

  return total
}

function comparison(current, previous) {
  const diff = (a, b) => {
    if (!b) return null
    return ((a - b) / b) * 100
  }

  return {
    spend: diff(current.spend, previous.spend),
    roas: diff(current.roas, previous.roas),
    cpa: diff(current.cost_per_result, previous.cost_per_result),
    ctr: diff(current.ctr_link, previous.ctr_link),
  }
}

function insightText(range, summary) {
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
  }

  parts.push(
    '[Inferenza] In ottica Andromeda, conviene mantenere una struttura chiara: creatività differenziate, naming ordinato e segnali di conversione coerenti.'
  )

  return parts.join(' ')
}

function todos(summary) {
  const out = []

  if (!summary || summary.impressions <= 0) {
    return ['Nessun dato Meta disponibile per il periodo selezionato.']
  }

  if (summary.frequency >= 8) {
    out.push(
      `[Inferenza] Frequenza alta (${summary.frequency.toFixed(2)}): controlla saturazione creativa. Inserisci nuovi hook, nuove angle e nuove prime righe copy.`
    )
  }

  if (summary.ctr_link > 0 && summary.ctr_link < 1) {
    out.push(
      `[Inferenza] CTR link basso (${summary.ctr_link.toFixed(2)}%): testa creatività con promessa più chiara, visual più diretto e CTA più evidente.`
    )
  }

  if (summary.link_clicks > 100 && summary.purchases <= 0) {
    out.push(
      '[Inferenza] Ci sono click ma non acquisti: controlla landing, offerta, checkout e coerenza messaggio-annuncio.'
    )
  }

  if (summary.roas > 3 && summary.purchases > 0) {
    out.push(
      `[Inferenza] ROAS positivo (${summary.roas.toFixed(2)}x): valuta scaling graduale sulle campagne/ad set con CPA stabile.`
    )
  }

  if (!out.length) {
    out.push(
      '[Inferenza] Non emergono criticità automatiche forti dai dati disponibili. Continua a scalare gradualmente le campagne con ROAS e CRO migliori.'
    )
  }

  return out
}

async function fetchActiveCampaigns(accountId) {
  return graphAll(`${accountId}/campaigns`, {
    fields: 'id,name,status,effective_status',
    effective_status: JSON.stringify(['ACTIVE']),
    limit: '100',
  })
}

async function fetchActiveAdsets(campaignId) {
  return graphAll(`${campaignId}/adsets`, {
    fields: 'id,name,status,effective_status,campaign_id,campaign{name}',
    effective_status: JSON.stringify(['ACTIVE']),
    limit: '100',
  })
}

async function fetchActiveAds(adsetId) {
  return graphAll(`${adsetId}/ads`, {
    fields:
      'id,name,status,effective_status,campaign_id,adset_id,campaign{name},adset{name},creative{id,thumbnail_url,image_url,product_set_id,object_story_spec,asset_feed_spec}',
    effective_status: JSON.stringify(['ACTIVE']),
    limit: '100',
  })
}

// Meta espone questo hash come placeholder generico per le creative
// dinamiche / DPA — lo trattiamo come "nessuna immagine reale"
const META_GENERIC_PLACEHOLDER = '75341531_494485104475166'
function isGenericPlaceholder(url) {
  return typeof url === 'string' && url.includes(META_GENERIC_PLACEHOLDER)
}

function getCreativeProductSetId(creative) {
  if (!creative) return null
  return (
    creative.product_set_id ||
    creative.object_story_spec?.template_data?.product_set_id ||
    creative.asset_feed_spec?.product_set_id ||
    null
  )
}

async function getAdsetProductSetId(adsetId) {
  if (!adsetId) return null
  try {
    const data = await graph(adsetId, { fields: 'promoted_object' })
    return data?.promoted_object?.product_set_id || null
  } catch {
    return null
  }
}

async function fetchProductSetSample(productSetId, max = 6) {
  if (!productSetId) return []
  try {
    const data = await graph(`${productSetId}/products`, {
      fields: 'id,name,retailer_id,image_url,price',
      limit: String(max),
    })
    const products = Array.isArray(data?.data) ? data.data : []
    return products.slice(0, max).map(p => ({
      id: p.id,
      name: p.name || p.retailer_id || '',
      image_url: p.image_url || '',
      price: p.price || '',
    })).filter(p => p.image_url)
  } catch {
    return []
  }
}

async function fetchInsightsByIds(accountId, level, ids, range) {
  if (!ids.length) return []

  const idField =
    level === 'campaign' ? 'campaign.id' :
    level === 'adset' ? 'adset.id' :
    'ad.id'

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
    'frequency',
    'cpm',
    'inline_link_clicks',
    'inline_link_click_ctr',
    'cost_per_inline_link_click',
    'actions',
    'action_values',
  ].join(',')

  return graphAll(`${accountId}/insights`, {
    fields,
    level,
    time_range: JSON.stringify(range),
    filtering: JSON.stringify([
      {
        field: idField,
        operator: 'IN',
        value: ids,
      },
    ]),
    limit: '500',
  })
}

async function getCampaignRows(accounts, range) {
  const allRows = []

  for (const accountId of accounts) {
    const campaigns = await fetchActiveCampaigns(accountId)
    const ids = campaigns.map(x => x.id)

    if (!ids.length) continue

    const insights = await fetchInsightsByIds(accountId, 'campaign', ids, range)
    const insightMap = new Map(insights.map(x => [x.campaign_id, x]))

    for (const campaign of campaigns) {
      const insight = insightMap.get(campaign.id) || {}

      allRows.push(
        calcRow(
          {
            id: campaign.id,
            level: 'campaign',
            name: campaign.name,
            account_id: accountId,
            account_name: accountId,
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            adset_id: null,
            adset_name: null,
            ad_id: null,
            ad_name: null,
            status: campaign.effective_status || campaign.status || null,
            thumbnail_url: null,
            has_children: true,
          },
          insight
        )
      )
    }
  }

  return allRows
}

async function getAdsetRows(accounts, range, campaignId) {
  const adsets = await fetchActiveAdsets(campaignId)
  const ids = adsets.map(x => x.id)

  if (!ids.length) return []

  const allInsights = []

  for (const accountId of accounts) {
    const rows = await fetchInsightsByIds(accountId, 'adset', ids, range)
    allInsights.push(...rows)
  }

  const insightMap = new Map(allInsights.map(x => [x.adset_id, x]))

  return adsets.map(adset => {
    const insight = insightMap.get(adset.id) || {}

    return calcRow(
      {
        id: adset.id,
        level: 'adset',
        name: adset.name,
        account_id: null,
        account_name: null,
        campaign_id: adset.campaign_id || campaignId,
        campaign_name: adset.campaign?.name || insight.campaign_name || '',
        adset_id: adset.id,
        adset_name: adset.name,
        ad_id: null,
        ad_name: null,
        status: adset.effective_status || adset.status || null,
        thumbnail_url: null,
        has_children: true,
      },
      insight
    )
  })
}

async function fetchDailySeries(accounts, range) {
  const byDay = new Map()
  for (const accountId of accounts) {
    try {
      const rows = await graphAll(`${accountId}/insights`, {
        level: 'account',
        fields: 'spend,impressions,reach,frequency,cpm,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,actions,action_values',
        time_range: JSON.stringify(range),
        time_increment: '1',
        limit: '500',
      })
      for (const r of rows) {
        const date = r.date_start
        if (!date) continue
        const prev = byDay.get(date) || {
          date, spend: 0, revenue: 0, orders: 0,
          link_clicks: 0, impressions: 0, frequency: 0,
          frequencyWeight: 0, cpm: 0, cpmWeight: 0,
        }
        const sp = num(r.spend)
        const imp = num(r.impressions)
        prev.spend += sp
        prev.impressions += imp
        prev.link_clicks += num(r.inline_link_clicks) || actionValue(r.actions, ['link_click'])
        prev.orders += actionValue(r.actions, ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'])
        prev.revenue += moneyValue(r.action_values, ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'])
        // freq/cpm pesate per impression
        prev.frequencyWeight += imp
        prev.frequency += num(r.frequency) * imp
        prev.cpmWeight += imp
        prev.cpm += num(r.cpm) * imp
        byDay.set(date, prev)
      }
    } catch {}
  }
  return Array.from(byDay.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      date: d.date,
      spend: Math.round(d.spend * 100) / 100,
      revenue: Math.round(d.revenue * 100) / 100,
      orders: Math.round(d.orders),
      link_clicks: Math.round(d.link_clicks),
      impressions: Math.round(d.impressions),
      roas: d.spend > 0 ? Math.round((d.revenue / d.spend) * 100) / 100 : 0,
      cost_per_result: d.orders > 0 ? Math.round((d.spend / d.orders) * 100) / 100 : 0,
      ctr_link: d.impressions > 0 ? Math.round((d.link_clicks / d.impressions) * 10000) / 100 : 0,
      cpc_link: d.link_clicks > 0 ? Math.round((d.spend / d.link_clicks) * 100) / 100 : 0,
      frequency: d.frequencyWeight > 0 ? Math.round((d.frequency / d.frequencyWeight) * 100) / 100 : 0,
      cpm: d.cpmWeight > 0 ? Math.round((d.cpm / d.cpmWeight) * 100) / 100 : 0,
    }))
}

async function getAdRows(accounts, range, adsetId) {
  const ads = await fetchActiveAds(adsetId)
  const ids = ads.map(x => x.id)

  if (!ids.length) return []

  const allInsights = []

  for (const accountId of accounts) {
    const rows = await fetchInsightsByIds(accountId, 'ad', ids, range)
    allInsights.push(...rows)
  }

  const insightMap = new Map(allInsights.map(x => [x.ad_id, x]))

  // Estraggo il product_set_id condiviso a livello adset (DPA / Advantage+
  // Catalog di solito lo tengono qui invece che sul creative)
  const adsetProductSetId = await getAdsetProductSetId(adsetId)

  return await Promise.all(ads.map(async ad => {
    const insight = insightMap.get(ad.id) || {}

    // Thumbnail: scarta il placeholder generico Meta per le DPA
    const rawThumb = ad.creative?.thumbnail_url || ad.creative?.image_url || null
    const thumbnail = rawThumb && !isGenericPlaceholder(rawThumb) ? rawThumb : null

    // Per catalog ads recupero un sample di prodotti reali del catalogo
    const productSetId = getCreativeProductSetId(ad.creative) || adsetProductSetId
    const products = productSetId ? await fetchProductSetSample(productSetId, 6) : []

    return calcRow(
      {
        id: ad.id,
        level: 'ad',
        name: ad.name,
        account_id: null,
        account_name: null,
        campaign_id: ad.campaign_id || insight.campaign_id || null,
        campaign_name: ad.campaign?.name || insight.campaign_name || '',
        adset_id: ad.adset_id || adsetId,
        adset_name: ad.adset?.name || insight.adset_name || '',
        ad_id: ad.id,
        ad_name: ad.name,
        status: ad.effective_status || ad.status || null,
        thumbnail_url: thumbnail,
        product_set_id: productSetId,
        products,
        has_children: false,
      },
      insight
    )
  }))
}

export async function GET(req) {
  try {
    if (!META_TOKEN) return jsonError('META_ACCESS_TOKEN mancante', 500)
    if (!META_ACCOUNT) return jsonError('META_AD_ACCOUNT_ID mancante', 500)

    const { searchParams } = new URL(req.url)

    const preset = searchParams.get('preset') || 'last_28d'
    const level = searchParams.get('level') || 'campaigns'
    const campaignId = searchParams.get('campaign_id')
    const adsetId = searchParams.get('adset_id')

    const accounts = getAccounts()

    if (!accounts.length) {
      return jsonError('Nessun account Meta configurato in META_AD_ACCOUNT_ID', 500)
    }

    const range = getRange(preset, searchParams)
    const previousRange = getPreviousRange(range)

    let rows = []

    if (level === 'campaigns') {
      rows = await getCampaignRows(accounts, range)
    } else if (level === 'adsets') {
      if (!campaignId) return jsonError('campaign_id mancante', 400)
      rows = await getAdsetRows(accounts, range, campaignId)
    } else if (level === 'ads') {
      if (!adsetId) return jsonError('adset_id mancante', 400)
      rows = await getAdRows(accounts, range, adsetId)
    } else {
      return jsonError(`level non valido: ${level}`, 400)
    }

    const summary = sumRows(rows)

    let previousSummary = {
      spend: 0,
      roas: 0,
      cost_per_result: 0,
      ctr_link: 0,
    }

    let dailySeries = []

    if (level === 'campaigns') {
      const [previousRows, daily] = await Promise.all([
        getCampaignRows(accounts, previousRange),
        fetchDailySeries(accounts, range).catch(() => []),
      ])
      previousSummary = sumRows(previousRows)
      dailySeries = daily
    }

    return NextResponse.json({
      ok: true,
      preset,
      level,
      range,
      previousRange,
      accounts,
      summary,
      previousSummary,
      comparison: comparison(summary, previousSummary),
      insight: insightText(range, summary),
      todos: todos(summary),
      rows,
      dailySeries,
      sources: { meta: true },
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return jsonError(err.message || 'Errore Meta Detail', 500)
  }
}
