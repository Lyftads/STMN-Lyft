export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID

const GRAPH_VERSION = 'v19.0'

function json(data, status = 200) {
  return NextResponse.json(data, { status })
}

function n(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function r2(value) {
  return Math.round(n(value) * 100) / 100
}

function r4(value) {
  return Math.round(n(value) * 10000) / 10000
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(date, amount) {
  const d = new Date(date)
  d.setDate(d.getDate() + amount)
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

function getRange(preset, customSince, customUntil) {
  const now = new Date()
  const today = new Date(todayISO())

  if (preset === 'yesterday') {
    const d = addDays(today, -1)
    return { since: iso(d), until: iso(d), label: 'Ieri' }
  }

  if (preset === 'last_7d') {
    return {
      since: iso(addDays(today, -6)),
      until: iso(today),
      label: 'Ultimi 7g',
    }
  }

  if (preset === 'last_14d') {
    return {
      since: iso(addDays(today, -13)),
      until: iso(today),
      label: 'Ultimi 14g',
    }
  }

  if (preset === 'last_28d') {
    return {
      since: iso(addDays(today, -27)),
      until: iso(today),
      label: 'Ultimi 28g',
    }
  }

  if (preset === 'this_month') {
    return {
      since: iso(startOfMonth(now)),
      until: iso(today),
      label: 'Mese corrente',
    }
  }

  if (preset === 'last_month') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = endOfMonth(first)

    return {
      since: iso(first),
      until: iso(last),
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
    since: iso(today),
    until: iso(today),
    label: 'Oggi',
  }
}

function getPreviousRange(range) {
  const since = new Date(range.since)
  const until = new Date(range.until)

  const days =
    Math.round((until.getTime() - since.getTime()) / 86400000) + 1

  const previousUntil = addDays(since, -1)
  const previousSince = addDays(previousUntil, -(days - 1))

  return {
    since: iso(previousSince),
    until: iso(previousUntil),
    label: `Periodo precedente`,
  }
}

function getAccounts() {
  if (!META_ACCOUNT) return []

  return META_ACCOUNT
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(id => {
      if (id.startsWith('act_')) return id
      return `act_${id}`
    })
}

function getActionValue(actions, names) {
  if (!Array.isArray(actions)) return 0

  const found = actions.find(a => names.includes(a.action_type))

  return n(found?.value)
}

function getCostPerActionValue(actions, names) {
  if (!Array.isArray(actions)) return 0

  const found = actions.find(a => names.includes(a.action_type))

  return n(found?.value)
}

function getRoas(row) {
  const purchaseRoas = Array.isArray(row.purchase_roas)
    ? n(row.purchase_roas[0]?.value)
    : 0

  const websiteRoas = Array.isArray(row.website_purchase_roas)
    ? n(row.website_purchase_roas[0]?.value)
    : 0

  return purchaseRoas || websiteRoas || 0
}

function normalizeRow(row, level) {
  const spend = n(row.spend)
  const impressions = n(row.impressions)
  const reach = n(row.reach)
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

  const costPerResult =
    getCostPerActionValue(row.cost_per_action_type, [
      'purchase',
      'omni_purchase',
      'offsite_conversion.fb_pixel_purchase',
    ]) || (purchases > 0 ? spend / purchases : 0)

  const cpm = n(row.cpm) || (impressions > 0 ? spend / impressions * 1000 : 0)

  const ctrLink =
    n(row.inline_link_click_ctr) ||
    (impressions > 0 ? linkClicks / impressions * 100 : 0)

  const cpcLink =
    n(row.cost_per_inline_link_click) ||
    (linkClicks > 0 ? spend / linkClicks : 0)

  const roas =
    getRoas(row) ||
    (spend > 0 && purchaseValue > 0 ? purchaseValue / spend : 0)

  const conversionPurchases =
    linkClicks > 0 && purchases > 0 ? purchases / linkClicks * 100 : 0

  const croCampagna =
    linkClicks > 0 && purchases > 0 ? purchases / linkClicks * 100 : 0

  const aovCampagna =
    purchases > 0 && purchaseValue > 0 ? purchaseValue / purchases : 0

  return {
    id:
      row.ad_id ||
      row.adset_id ||
      row.campaign_id ||
      `${level}_${Math.random().toString(36).slice(2)}`,

    level,

    campaign_id: row.campaign_id || null,
    campaign_name: row.campaign_name || 'Campagna',

    adset_id: row.adset_id || null,
    adset_name: row.adset_name || null,

    ad_id: row.ad_id || null,
    ad_name: row.ad_name || null,

    name:
      row.ad_name ||
      row.adset_name ||
      row.campaign_name ||
      'Senza nome',

    impressions,
    reach,
    frequency: r2(row.frequency),
    cpm: r2(cpm),
    ctr_link: r2(ctrLink),
    cpc_link: r2(cpcLink),
    link_clicks: linkClicks,
    spend: r2(spend),
    cost_per_result: r2(costPerResult),
    roas: r2(roas),
    purchases,
    purchase_conversion: r2(conversionPurchases),
    cro_campagna: r2(croCampagna),
    aov_campagna: r2(aovCampagna),
    purchase_value: r2(purchaseValue),

    thumbnail_url: null,
    creative_name: null,
  }
}

function aggregate(rows) {
  const spend = rows.reduce((s, r) => s + n(r.spend), 0)
  const impressions = rows.reduce((s, r) => s + n(r.impressions), 0)
  const reach = rows.reduce((s, r) => s + n(r.reach), 0)
  const linkClicks = rows.reduce((s, r) => s + n(r.link_clicks), 0)
  const purchases = rows.reduce((s, r) => s + n(r.purchases), 0)
  const purchaseValue = rows.reduce((s, r) => s + n(r.purchase_value), 0)

  const frequency = reach > 0 ? impressions / reach : 0
  const cpm = impressions > 0 ? spend / impressions * 1000 : 0
  const ctrLink = impressions > 0 ? linkClicks / impressions * 100 : 0
  const cpcLink = linkClicks > 0 ? spend / linkClicks : 0
  const costPerResult = purchases > 0 ? spend / purchases : 0
  const roas = spend > 0 ? purchaseValue / spend : 0
  const purchaseConversion = linkClicks > 0 ? purchases / linkClicks * 100 : 0
  const aovCampagna = purchases > 0 ? purchaseValue / purchases : 0

  return {
    spend: r2(spend),
    impressions,
    reach,
    frequency: r2(frequency),
    cpm: r2(cpm),
    ctr_link: r2(ctrLink),
    cpc_link: r2(cpcLink),
    link_clicks: linkClicks,
    cost_per_result: r2(costPerResult),
    roas: r2(roas),
    purchases,
    purchase_conversion: r2(purchaseConversion),
    cro_campagna: r2(purchaseConversion),
    aov_campagna: r2(aovCampagna),
    purchase_value: r2(purchaseValue),
  }
}

function pctChange(current, previous) {
  if (!previous || previous === 0) return null
  return r2((current - previous) / previous * 100)
}

async function metaFetch(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value)
    }
  })

  url.searchParams.set('access_token', META_TOKEN)

  const res = await fetch(url.toString(), {
    cache: 'no-store',
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Meta API error ${res.status}`)
  }

  return data
}

async function fetchInsightsForAccount(accountId, range, level) {
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
    'cost_per_action_type',
    'purchase_roas',
    'website_purchase_roas',
  ].join(',')

  const all = []
  let after = null

  do {
    const params = {
      fields,
      level,
      time_range: JSON.stringify({
        since: range.since,
        until: range.until,
      }),
      limit: '500',
    }

    if (after) params.after = after

    const data = await metaFetch(`${accountId}/insights`, params)

    all.push(...(data.data || []))

    after = data.paging?.cursors?.after || null
  } while (after)

  return all.map(row => normalizeRow(row, level))
}

async function fetchCreativeThumbnails(accountId, adRows) {
  const adIds = adRows
    .map(r => r.ad_id)
    .filter(Boolean)

  if (!adIds.length) return {}

  const map = {}

  const chunks = []
  for (let i = 0; i < adIds.length; i += 50) {
    chunks.push(adIds.slice(i, i + 50))
  }

  for (const chunk of chunks) {
    try {
      const data = await metaFetch(`${accountId}/ads`, {
        fields: 'id,name,creative{name,thumbnail_url,image_url,object_story_spec}',
        filtering: JSON.stringify([
          {
            field: 'id',
            operator: 'IN',
            value: chunk,
          },
        ]),
        limit: '50',
      })

      for (const ad of data.data || []) {
        map[ad.id] = {
          creative_name: ad.creative?.name || ad.name || null,
          thumbnail_url:
            ad.creative?.thumbnail_url ||
            ad.creative?.image_url ||
            null,
        }
      }
    } catch (e) {
      console.log('Creative thumbnail error:', e.message)
    }
  }

  return map
}

function buildHierarchy(campaigns, adsets, ads) {
  const adsetsByCampaign = {}
  const adsByAdset = {}

  for (const adset of adsets) {
    const key = adset.campaign_id || 'unknown_campaign'
    if (!adsetsByCampaign[key]) adsetsByCampaign[key] = []
    adsetsByCampaign[key].push(adset)
  }

  for (const ad of ads) {
    const key = ad.adset_id || 'unknown_adset'
    if (!adsByAdset[key]) adsByAdset[key] = []
    adsByAdset[key].push(ad)
  }

  return campaigns.map(campaign => ({
    ...campaign,
    children: (adsetsByCampaign[campaign.campaign_id] || []).map(adset => ({
      ...adset,
      children: adsByAdset[adset.adset_id] || [],
    })),
  }))
}

function makeTodos(summary) {
  const todos = []

  if (summary.ctr_link < 1) {
    todos.push({
      title: 'Testare nuovi hook creativi',
      why:
        'CTR link sotto 1%: il problema più probabile è nella prima impressione creativa o nel messaggio iniziale. [Inferenza]',
    })
  }

  if (summary.link_clicks > 0 && summary.purchases === 0) {
    todos.push({
      title: 'Controllare landing, offerta e checkout',
      why:
        'Ci sono click ma non risultano acquisti: il collo di bottiglia sembra dopo il click, non prima. [Inferenza]',
    })
  }

  if (summary.frequency > 4 && summary.ctr_link < 1.2) {
    todos.push({
      title: 'Ridurre saturazione creativa',
      why:
        'Frequenza alta con CTR debole: possibile stanchezza creativa o pubblico troppo ristretto. [Inferenza]',
    })
  }

  if (summary.cpm > 4 && summary.ctr_link < 1) {
    todos.push({
      title: 'Allargare angoli creativi e segnali',
      why:
        'CPM alto e CTR basso indicano che Meta non sta trovando facilmente pubblico reattivo. In logica Andromeda conviene fornire creatività più differenziate, non micro-varianti quasi uguali. [Inferenza]',
    })
  }

  if (summary.roas > 0 && summary.roas < 1.5) {
    todos.push({
      title: 'Separare creatività di prospecting e retargeting',
      why:
        'ROAS basso: serve capire se il problema è acquisizione fredda, retargeting o conversione post-click. [Inferenza]',
    })
  }

  if (!todos.length) {
    todos.push({
      title: 'Continuare monitoraggio per livello campagna/ad set/ad',
      why:
        'Le metriche principali non mostrano un problema evidente nel periodo selezionato. [Inferenza]',
    })
  }

  return todos
}

function makeInsight(summary, range) {
  const parts = []

  parts.push(
    `Nel periodo ${range.since} → ${range.until}, Meta ha generato ${summary.impressions.toLocaleString('it-IT')} impression, ${summary.reach.toLocaleString('it-IT')} persone raggiunte e ${summary.link_clicks.toLocaleString('it-IT')} click sul link, con una spesa totale di €${summary.spend}.`
  )

  parts.push(
    `La frequenza media è ${summary.frequency}, il CPM è €${summary.cpm}, il CTR link è ${summary.ctr_link}% e il CPC link è €${summary.cpc_link}.`
  )

  if (summary.purchases > 0) {
    parts.push(
      `Sono stati rilevati ${summary.purchases} acquisti, ROAS ${summary.roas}x, costo per risultato €${summary.cost_per_result} e AOV campagna €${summary.aov_campagna}.`
    )
  } else {
    parts.push(
      `Non risultano acquisti attribuiti nel periodo selezionato, quindi ROAS, costo per risultato e AOV campagna restano poco indicativi.`
    )
  }

  parts.push(
    `[Inferenza] In ottica Andromeda, conviene dare più segnali creativi chiari all’algoritmo: creatività differenziate, angoli di comunicazione distinti e segnali di conversione coerenti, evitando troppe varianti quasi uguali.`
  )

  return parts.join(' ')
}

async function fetchAll(range) {
  const accounts = getAccounts()

  if (!META_TOKEN) {
    throw new Error('META_ACCESS_TOKEN mancante nelle variabili ambiente.')
  }

  if (!accounts.length) {
    throw new Error('META_AD_ACCOUNT_ID mancante nelle variabili ambiente.')
  }

  const allCampaigns = []
  const allAdsets = []
  const allAds = []

  const errors = []

  for (const accountId of accounts) {
    try {
      const [campaigns, adsets, ads] = await Promise.all([
        fetchInsightsForAccount(accountId, range, 'campaign'),
        fetchInsightsForAccount(accountId, range, 'adset'),
        fetchInsightsForAccount(accountId, range, 'ad'),
      ])

      const thumbnails = await fetchCreativeThumbnails(accountId, ads)

      const adsWithCreative = ads.map(ad => ({
        ...ad,
        creative_name: thumbnails[ad.ad_id]?.creative_name || null,
        thumbnail_url: thumbnails[ad.ad_id]?.thumbnail_url || null,
      }))

      allCampaigns.push(...campaigns)
      allAdsets.push(...adsets)
      allAds.push(...adsWithCreative)
    } catch (e) {
      errors.push({
        accountId,
        message: e.message,
      })
    }
  }

  if (!allCampaigns.length && errors.length) {
    throw new Error(errors.map(e => `${e.accountId}: ${e.message}`).join(' | '))
  }

  const summary = aggregate(allCampaigns.length ? allCampaigns : allAds)

  return {
    summary,
    campaigns: allCampaigns,
    adsets: allAdsets,
    ads: allAds,
    hierarchy: buildHierarchy(allCampaigns, allAdsets, allAds),
    errors,
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)

    const preset = searchParams.get('preset') || 'today'
    const since = searchParams.get('since')
    const until = searchParams.get('until')

    const range = getRange(preset, since, until)
    const previousRange = getPreviousRange(
      preset === 'last_7d'
        ? range
        : {
            since: iso(addDays(new Date(range.until), -6)),
            until: range.until,
          }
    )

    const current = await fetchAll(range)
    const previous = await fetchAll(previousRange)

    const comparison = {
      range: previousRange,
      spend: pctChange(current.summary.spend, previous.summary.spend),
      roas: pctChange(current.summary.roas, previous.summary.roas),
      cost_per_result: pctChange(
        current.summary.cost_per_result,
        previous.summary.cost_per_result
      ),
      ctr_link: pctChange(current.summary.ctr_link, previous.summary.ctr_link),
      cpc_link: pctChange(current.summary.cpc_link, previous.summary.cpc_link),
      purchases: pctChange(current.summary.purchases, previous.summary.purchases),
      impressions: pctChange(current.summary.impressions, previous.summary.impressions),
      reach: pctChange(current.summary.reach, previous.summary.reach),
    }

    return json({
      ok: true,
      preset,
      range,
      previousRange,
      sources: {
        meta: true,
      },
      summary: current.summary,
      comparison,
      todos: makeTodos(current.summary),
      insight: makeInsight(current.summary, range),
      hierarchy: current.hierarchy,
      campaigns: current.campaigns,
      adsets: current.adsets,
      ads: current.ads,
      errors: current.errors,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return json(
      {
        ok: false,
        error: e.message,
        sources: {
          meta: false,
        },
      },
      500
    )
  }
}
