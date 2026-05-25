// app/api/meta-detail/route.js

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID
const API_VERSION = process.env.META_API_VERSION || 'v19.0'

const PURCHASE_KEYS = [
  'purchase',
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
]

const ADD_TO_CART_KEYS = [
  'add_to_cart',
  'omni_add_to_cart',
  'offsite_conversion.fb_pixel_add_to_cart',
]

function n(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function r2(value) {
  return Math.round(n(value) * 100) / 100
}

function r4(value) {
  return Math.round(n(value) * 10000) / 10000
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function parseDate(value) {
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function addDays(date, days) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function defaultRange() {
  const today = new Date()
  const until = isoDate(today)
  const since = isoDate(addDays(today, -6))
  return { since, until }
}

function previousRange(since, until) {
  const s = parseDate(since)
  const u = parseDate(until)

  if (!s || !u) return defaultRange()

  const days = Math.max(1, Math.round((u - s) / 86400000) + 1)
  const prevUntil = addDays(s, -1)
  const prevSince = addDays(prevUntil, -(days - 1))

  return {
    since: isoDate(prevSince),
    until: isoDate(prevUntil),
  }
}

function getActionValue(actions, keys) {
  if (!Array.isArray(actions)) return 0

  return actions
    .filter(a => keys.includes(a.action_type))
    .reduce((sum, a) => sum + n(a.value), 0)
}

function getPurchaseValue(row) {
  return getActionValue(row.action_values, PURCHASE_KEYS)
}

function getPurchaseRoas(row) {
  if (!Array.isArray(row.purchase_roas)) return 0

  const found =
    row.purchase_roas.find(x => PURCHASE_KEYS.includes(x.action_type)) ||
    row.purchase_roas[0]

  return n(found?.value)
}

function getCostPerPurchase(row) {
  if (!Array.isArray(row.cost_per_action_type)) return 0

  const found = row.cost_per_action_type.find(x =>
    PURCHASE_KEYS.includes(x.action_type)
  )

  return n(found?.value)
}

function getCtrLink(row) {
  return n(row.inline_link_click_ctr)
}

function getLinkClicks(row) {
  return n(row.inline_link_clicks)
}

function getCpcLink(row) {
  return n(row.cost_per_inline_link_click)
}

function normalizeInsight(row, level, period = 'current') {
  const linkClicks = getLinkClicks(row)
  const purchases = getActionValue(row.actions, PURCHASE_KEYS)
  const addToCart = getActionValue(row.actions, ADD_TO_CART_KEYS)
  const purchaseValue = getPurchaseValue(row)

  return {
    period,
    level,

    date: row.date_start || null,
    dateStart: row.date_start || null,
    dateStop: row.date_stop || null,

    campaignId: row.campaign_id || null,
    campaignName: row.campaign_name || 'Senza nome campagna',

    adsetId: row.adset_id || null,
    adsetName: row.adset_name || null,

    adId: row.ad_id || null,
    adName: row.ad_name || null,

    spend: r2(row.spend),
    impressions: Math.round(n(row.impressions)),
    reach: Math.round(n(row.reach)),
    frequency: r4(row.frequency),
    cpm: r2(row.cpm),

    ctrLink: r4(getCtrLink(row)),
    cpcLink: r2(getCpcLink(row)),
    linkClicks: Math.round(linkClicks),

    costPerResult: r2(getCostPerPurchase(row)),
    roas: r4(getPurchaseRoas(row)),

    purchaseValue: r2(purchaseValue),
    purchaseConversions: r2(purchases),
    purchases: r2(purchases),
    addToCart: r2(addToCart),

    cro: linkClicks > 0 ? r4((purchases / linkClicks) * 100) : null,
    aov: purchases > 0 ? r2(purchaseValue / purchases) : null,
  }
}

async function metaFetch(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  }

  url.searchParams.set('access_token', META_TOKEN)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const json = await res.json().catch(() => null)

  if (!json) {
    throw new Error('Risposta Meta non valida o vuota.')
  }

  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Meta API error ${res.status}`)
  }

  return json
}

async function fetchPaged(path, params = {}) {
  let json = await metaFetch(path, params)
  const data = [...(json.data || [])]

  while (json.paging?.next) {
    const res = await fetch(json.paging.next, { cache: 'no-store' })
    json = await res.json()

    if (json.error) throw new Error(json.error.message)
    data.push(...(json.data || []))
  }

  return data
}

function getAccounts() {
  return String(META_ACCOUNT || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => (x.startsWith('act_') ? x : `act_${x}`))
}

async function fetchInsights({
  level,
  since,
  until,
  period = 'current',
  timeIncrement = null,
}) {
  const accounts = getAccounts()

  if (!META_TOKEN || accounts.length === 0) return []

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
    'cost_per_action_type',
    'actions',
    'action_values',
    'purchase_roas',
    'date_start',
    'date_stop',
  ].join(',')

  const rows = []

  for (const account of accounts) {
    const params = {
      fields,
      level,
      time_range: JSON.stringify({ since, until }),
      limit: 500,
      filtering: JSON.stringify([
        {
          field: `${level}.effective_status`,
          operator: 'IN',
          value: ['ACTIVE'],
        },
      ]),
    }

    if (timeIncrement) {
      params.time_increment = timeIncrement
    }

    const data = await fetchPaged(`${account}/insights`, params)
    rows.push(...data.map(row => normalizeInsight(row, level, period)))
  }

  return rows
}

async function fetchCreatives(adIds) {
  const ids = [...new Set(adIds.filter(Boolean))]
  const map = {}

  await Promise.all(
    ids.map(async adId => {
      try {
        const ad = await metaFetch(adId, {
          fields: [
            'id',
            'name',
            'effective_status',
            'creative{id,name,thumbnail_url,image_url,object_story_spec,asset_feed_spec,url_tags}',
          ].join(','),
        })

        const creative = ad.creative || {}
        const oss = creative.object_story_spec || {}
        const linkData = oss.link_data || {}
        const videoData = oss.video_data || {}
        const templateData = oss.template_data || {}
        const assetFeed = creative.asset_feed_spec || {}

        const bodies = Array.isArray(assetFeed.bodies)
          ? assetFeed.bodies.map(x => x.text).filter(Boolean)
          : []

        const titles = Array.isArray(assetFeed.titles)
          ? assetFeed.titles.map(x => x.text).filter(Boolean)
          : []

        const descriptions = Array.isArray(assetFeed.descriptions)
          ? assetFeed.descriptions.map(x => x.text).filter(Boolean)
          : []

        const images = Array.isArray(assetFeed.images)
          ? assetFeed.images
          : []

        const videos = Array.isArray(assetFeed.videos)
          ? assetFeed.videos
          : []

        map[adId] = {
          adId,
          adName: ad.name || null,
          effectiveStatus: ad.effective_status || null,

          creativeId: creative.id || null,
          creativeName: creative.name || null,

          thumbnailUrl:
            creative.thumbnail_url ||
            linkData.picture ||
            videoData.image_url ||
            templateData.picture ||
            null,

          imageUrl:
            creative.image_url ||
            linkData.picture ||
            videoData.image_url ||
            templateData.picture ||
            null,

          copy:
            linkData.message ||
            videoData.message ||
            templateData.message ||
            bodies[0] ||
            null,

          headline:
            linkData.name ||
            videoData.title ||
            templateData.name ||
            titles[0] ||
            null,

          description:
            linkData.description ||
            videoData.description ||
            templateData.description ||
            descriptions[0] ||
            null,

          destinationUrl:
            linkData.link ||
            templateData.link ||
            null,

          urlTags: creative.url_tags || null,

          assetFeedSpec: assetFeed,
          assetBodies: bodies,
          assetTitles: titles,
          assetDescriptions: descriptions,
          assetImages: images,
          assetVideos: videos,
        }
      } catch (e) {
        map[adId] = {
          adId,
          error: e.message,
        }
      }
    })
  )

  return map
}

async function fetchCatalogProductBreakdown({ since, until }) {
  const accounts = getAccounts()
  const products = []

  if (!META_TOKEN || accounts.length === 0) {
    return {
      products: [],
      error: null,
    }
  }

  const fields = [
    'campaign_id',
    'campaign_name',
    'adset_id',
    'adset_name',
    'ad_id',
    'ad_name',
    'spend',
    'actions',
    'action_values',
    'purchase_roas',
    'date_start',
    'date_stop',
  ].join(',')

  for (const account of accounts) {
    try {
      const data = await fetchPaged(`${account}/insights`, {
        fields,
        level: 'ad',
        time_range: JSON.stringify({ since, until }),
        breakdowns: 'product_id',
        action_breakdowns: 'action_type',
        limit: 500,
        filtering: JSON.stringify([
          {
            field: 'ad.effective_status',
            operator: 'IN',
            value: ['ACTIVE'],
          },
        ]),
      })

      for (const row of data) {
        const purchases = getActionValue(row.actions, PURCHASE_KEYS)
        const purchaseValue = getPurchaseValue(row)

        if (!row.product_id && purchases <= 0 && purchaseValue <= 0) continue

        products.push({
          productId: row.product_id || null,
          campaignId: row.campaign_id || null,
          campaignName: row.campaign_name || null,
          adsetId: row.adset_id || null,
          adsetName: row.adset_name || null,
          adId: row.ad_id || null,
          adName: row.ad_name || null,
          spend: r2(row.spend),
          purchases: r2(purchases),
          purchaseValue: r2(purchaseValue),
          roas: r4(getPurchaseRoas(row)),
          aov: purchases > 0 ? r2(purchaseValue / purchases) : null,
        })
      }
    } catch (e) {
      return {
        products: [],
        error:
          'Meta non ha restituito il breakdown product_id. Possibile limite API/account/catalogo. ' +
          e.message,
      }
    }
  }

  products.sort((a, b) => b.purchaseValue - a.purchaseValue)

  return {
    products: products.slice(0, 100),
    error: null,
  }
}

function keyBy(rows, key) {
  const map = {}

  for (const row of rows) {
    const id = row[key]
    if (!id) continue
    map[id] = row
  }

  return map
}

function rowsBy(rows, key, id) {
  return rows
    .filter(row => row[key] === id)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

function buildTree({
  campaignCurrent,
  campaignPrevious,
  adsetCurrent,
  adsetPrevious,
  adCurrent,
  adPrevious,
  adDaily,
  creativeMap,
}) {
  const prevCampaignMap = keyBy(campaignPrevious, 'campaignId')
  const prevAdsetMap = keyBy(adsetPrevious, 'adsetId')
  const prevAdMap = keyBy(adPrevious, 'adId')

  const campaigns = campaignCurrent.map(c => ({
    id: c.campaignId,
    name: c.campaignName,
    latest: c,
    previous: prevCampaignMap[c.campaignId] || null,
    weeks: rowsBy(adDaily, 'campaignId', c.campaignId),
    adsets: [],
  }))

  const campaignMap = Object.fromEntries(campaigns.map(c => [c.id, c]))

  for (const adset of adsetCurrent) {
    const campaign = campaignMap[adset.campaignId]
    if (!campaign) continue

    campaign.adsets.push({
      id: adset.adsetId,
      name: adset.adsetName,
      latest: adset,
      previous: prevAdsetMap[adset.adsetId] || null,
      weeks: rowsBy(adDaily, 'adsetId', adset.adsetId),
      ads: [],
    })
  }

  const adsetMap = {}

  for (const campaign of campaigns) {
    for (const adset of campaign.adsets) {
      adsetMap[adset.id] = adset
    }
  }

  for (const ad of adCurrent) {
    const adset = adsetMap[ad.adsetId]
    if (!adset) continue

    adset.ads.push({
      id: ad.adId,
      name: ad.adName,
      latest: ad,
      previous: prevAdMap[ad.adId] || null,
      weeks: rowsBy(adDaily, 'adId', ad.adId),
      creative: creativeMap[ad.adId] || null,
    })
  }

  for (const campaign of campaigns) {
    campaign.adsets.sort((a, b) => n(b.latest.spend) - n(a.latest.spend))

    for (const adset of campaign.adsets) {
      adset.ads.sort((a, b) => n(b.latest.spend) - n(a.latest.spend))
    }
  }

  return campaigns.sort((a, b) => n(b.latest.spend) - n(a.latest.spend))
}

function aggregateDailyForCharts(rows) {
  const map = {}

  for (const row of rows) {
    const date = row.date
    if (!date) continue

    if (!map[date]) {
      map[date] = {
        date,
        spend: 0,
        purchases: 0,
        purchaseValue: 0,
        impressions: 0,
        reach: 0,
        linkClicks: 0,
        cpmSpend: 0,
        cpmImpressions: 0,
      }
    }

    map[date].spend += n(row.spend)
    map[date].purchases += n(row.purchases)
    map[date].purchaseValue += n(row.purchaseValue)
    map[date].impressions += n(row.impressions)
    map[date].reach += n(row.reach)
    map[date].linkClicks += n(row.linkClicks)
    map[date].cpmSpend += n(row.spend)
    map[date].cpmImpressions += n(row.impressions)
  }

  return Object.values(map)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(x => ({
      date: x.date,
      spend: r2(x.spend),
      purchases: r2(x.purchases),
      purchaseValue: r2(x.purchaseValue),
      roas: x.spend > 0 ? r4(x.purchaseValue / x.spend) : null,
      ctrLink: x.impressions > 0 ? r4((x.linkClicks / x.impressions) * 100) : null,
      cpcLink: x.linkClicks > 0 ? r2(x.spend / x.linkClicks) : null,
      cpm: x.impressions > 0 ? r2((x.spend / x.impressions) * 1000) : null,
      frequency: x.reach > 0 ? r4(x.impressions / x.reach) : null,
    }))
}

function sumCurrent(campaigns) {
  return campaigns.reduce(
    (acc, c) => {
      const x = c.latest || {}

      acc.spend += n(x.spend)
      acc.purchaseValue += n(x.purchaseValue)
      acc.purchases += n(x.purchases)
      acc.addToCart += n(x.addToCart)
      acc.linkClicks += n(x.linkClicks)
      acc.impressions += n(x.impressions)
      acc.reach += n(x.reach)

      return acc
    },
    {
      spend: 0,
      purchaseValue: 0,
      purchases: 0,
      addToCart: 0,
      linkClicks: 0,
      impressions: 0,
      reach: 0,
    }
  )
}

function generateInsights(campaigns, products) {
  const totals = sumCurrent(campaigns)

  const roas = totals.spend > 0 ? totals.purchaseValue / totals.spend : 0
  const cro = totals.linkClicks > 0 ? (totals.purchases / totals.linkClicks) * 100 : 0
  const aov = totals.purchases > 0 ? totals.purchaseValue / totals.purchases : 0
  const cpa = totals.purchases > 0 ? totals.spend / totals.purchases : 0

  const campaignRows = campaigns
    .map(c => ({
      id: c.id,
      name: c.name,
      ...c.latest,
      previous: c.previous,
    }))
    .sort((a, b) => n(b.spend) - n(a.spend))

  const winners = campaignRows
    .filter(c => n(c.spend) > 0 && n(c.purchases) > 0)
    .sort((a, b) => n(b.roas) - n(a.roas))
    .slice(0, 3)

  const losers = campaignRows
    .filter(c => n(c.spend) > 0)
    .sort((a, b) => n(a.roas) - n(b.roas))
    .slice(0, 3)

  const creativeRows = []

  for (const c of campaigns) {
    for (const a of c.adsets || []) {
      for (const ad of a.ads || []) {
        creativeRows.push({
          campaignName: c.name,
          adsetName: a.name,
          adName: ad.name,
          creative: ad.creative,
          ...ad.latest,
          previous: ad.previous,
        })
      }
    }
  }

  const bestCreatives = creativeRows
    .filter(x => n(x.spend) > 0 && n(x.purchases) > 0)
    .sort((a, b) => n(b.roas) - n(a.roas))
    .slice(0, 5)

  const weakCreatives = creativeRows
    .filter(x => n(x.spend) > 0)
    .sort((a, b) => n(a.roas) - n(b.roas))
    .slice(0, 5)

  const topProducts = [...products]
    .filter(p => n(p.purchaseValue) > 0 || n(p.purchases) > 0)
    .sort((a, b) => n(b.purchaseValue) - n(a.purchaseValue))
    .slice(0, 10)

  const notes = []

  if (roas >= 3) {
    notes.push({
      type: 'positive',
      title: 'ROAS complessivo buono',
      text: `Il ROAS aggregato è circa ${r2(roas)}x. Questo indica che la struttura sta generando ritorno positivo rispetto alla spesa.`,
    })
  } else if (roas > 0) {
    notes.push({
      type: 'warning',
      title: 'ROAS sotto soglia di sicurezza',
      text: `Il ROAS aggregato è circa ${r2(roas)}x. Prima di scalare, conviene capire quali campagne/adset stanno assorbendo budget senza generare acquisti efficienti.`,
    })
  }

  if (cro < 2 && totals.linkClicks > 100) {
    notes.push({
      type: 'warning',
      title: 'CRO campagna da migliorare',
      text: `La CRO campagna è circa ${r2(cro)}%. Il traffico clicca, ma una parte limitata converte in acquisto. Controllare coerenza creatività → landing → offerta.`,
    })
  }

  if (totals.addToCart > 0 && totals.purchases > 0) {
    const cartToPurchase = (totals.purchases / totals.addToCart) * 100

    if (cartToPurchase < 25) {
      notes.push({
        type: 'warning',
        title: 'Possibile perdita tra add to cart e acquisto',
        text: `Il rapporto acquisti/add to cart è circa ${r2(cartToPurchase)}%. Verificare checkout, costi di spedizione, urgenza, fiducia e retargeting carrello.`,
      })
    }
  }

  if (aov > 0) {
    notes.push({
      type: 'info',
      title: 'AOV medio campagna',
      text: `L’AOV aggregato è circa €${r2(aov)}. Questo dato va usato per capire quanto CPC e CPA massimo sono sostenibili.`,
    })
  }

  const todos = []

  if (winners.length > 0) {
    todos.push(
      `Proteggere e scalare gradualmente le campagne migliori: ${winners
        .map(x => x.name)
        .join(', ')}.`
    )
  }

  if (losers.length > 0) {
    todos.push(
      `Ridurre budget o isolare il problema sulle campagne meno efficienti: ${losers
        .map(x => x.name)
        .join(', ')}.`
    )
  }

  if (bestCreatives.length > 0) {
    todos.push(
      `Creare nuove varianti partendo dalle creatività con ROAS migliore: ${bestCreatives
        .map(x => x.adName)
        .slice(0, 3)
        .join(', ')}.`
    )
  }

  if (weakCreatives.length > 0) {
    todos.push(
      `Mettere in revisione creatività con spesa ma basso ritorno: ${weakCreatives
        .map(x => x.adName)
        .slice(0, 3)
        .join(', ')}.`
    )
  }

  if (topProducts.length > 0) {
    todos.push(
      `Nelle campagne catalogo, concentrare budget e creatività sui prodotti che generano più valore: ${topProducts
        .map(x => x.productId)
        .slice(0, 5)
        .join(', ')}.`
    )
  }

  return {
    totals: {
      spend: r2(totals.spend),
      purchaseValue: r2(totals.purchaseValue),
      purchases: r2(totals.purchases),
      addToCart: r2(totals.addToCart),
      linkClicks: r2(totals.linkClicks),
      roas: r4(roas),
      cro: r4(cro),
      aov: r2(aov),
      cpa: r2(cpa),
    },
    notes,
    todos,
    winners,
    losers,
    bestCreatives,
    weakCreatives,
    topProducts,
  }
}

export async function GET(req) {
  try {
    if (!META_TOKEN || !META_ACCOUNT) {
      return NextResponse.json(
        {
          campaigns: [],
          error: 'Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID',
        },
        { status: 200 }
      )
    }

    const { searchParams } = new URL(req.url)

    const fallback = defaultRange()

    const since = searchParams.get('since') || fallback.since
    const until = searchParams.get('until') || fallback.until

    const prev = previousRange(since, until)

    const [
      campaignCurrent,
      campaignPrevious,
      adsetCurrent,
      adsetPrevious,
      adCurrent,
      adPrevious,
      adDaily,
      productBreakdown,
    ] = await Promise.all([
      fetchInsights({
        level: 'campaign',
        since,
        until,
        period: 'current',
      }),
      fetchInsights({
        level: 'campaign',
        since: prev.since,
        until: prev.until,
        period: 'previous',
      }),
      fetchInsights({
        level: 'adset',
        since,
        until,
        period: 'current',
      }),
      fetchInsights({
        level: 'adset',
        since: prev.since,
        until: prev.until,
        period: 'previous',
      }),
      fetchInsights({
        level: 'ad',
        since,
        until,
        period: 'current',
      }),
      fetchInsights({
        level: 'ad',
        since: prev.since,
        until: prev.until,
        period: 'previous',
      }),
      fetchInsights({
        level: 'ad',
        since,
        until,
        period: 'current',
        timeIncrement: 1,
      }),
      fetchCatalogProductBreakdown({ since, until }),
    ])

    const creativeMap = await fetchCreatives(adCurrent.map(x => x.adId))

    const campaigns = buildTree({
      campaignCurrent,
      campaignPrevious,
      adsetCurrent,
      adsetPrevious,
      adCurrent,
      adPrevious,
      adDaily,
      creativeMap,
    })

    const chartDaily = aggregateDailyForCharts(adDaily)
    const insights = generateInsights(campaigns, productBreakdown.products)

    return NextResponse.json({
      campaigns,
      chartDaily,
      insights,
      catalogProducts: productBreakdown.products,
      catalogProductsError: productBreakdown.error,
      ranges: {
        current: { since, until },
        previous: prev,
      },
      rawCounts: {
        campaigns: campaignCurrent.length,
        adsets: adsetCurrent.length,
        ads: adCurrent.length,
        dailyRows: adDaily.length,
        catalogProducts: productBreakdown.products.length,
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json(
      {
        campaigns: [],
        error: e.message,
      },
      { status: 500 }
    )
  }
}
