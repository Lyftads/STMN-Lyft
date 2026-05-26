export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { format, subDays, parseISO } from 'date-fns'

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID

const INSIGHT_FIELDS = [
  'campaign_id','campaign_name',
  'adset_id','adset_name',
  'ad_id','ad_name',
  'spend','impressions','reach','frequency','cpm',
  'inline_link_clicks','inline_link_click_ctr','cost_per_inline_link_click',
  'actions','action_values','cost_per_action_type',
  'purchase_roas',
  'video_3_sec_watched_actions',
].join(',')

const PURCHASE_TYPES = [
  'omni_purchase',
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
]
const VIEW_TYPES = ['video_view']

function findActionValue(actions, types) {
  if (!Array.isArray(actions)) return 0
  for (const t of types) {
    const found = actions.find(a => a.action_type === t)
    if (found) return parseFloat(found.value || 0)
  }
  return 0
}

async function fetchAdInsights(accountId, since, until) {
  if (!accountId || !META_TOKEN) return []
  const all = []
  let url = `https://graph.facebook.com/v19.0/${accountId}/insights?level=ad&fields=${INSIGHT_FIELDS}&time_range={"since":"${since}","until":"${until}"}&limit=500&access_token=${META_TOKEN}`
  let safety = 0
  while (url && safety < 30) {
    safety++
    try {
      const res = await fetch(url)
      const data = await res.json()
      if (data.error) { console.log('Meta detail insights:', data.error.message); break }

      for (const row of (data.data || [])) {
        const purchases = findActionValue(row.actions, PURCHASE_TYPES)
        const purchaseValue = findActionValue(row.action_values, PURCHASE_TYPES)
        const videoViews3s = findActionValue(row.video_3_sec_watched_actions, VIEW_TYPES)

        all.push({
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          adset_id: row.adset_id,
          adset_name: row.adset_name,
          ad_id: row.ad_id,
          ad_name: row.ad_name,
          spend: parseFloat(row.spend || 0),
          impressions: parseInt(row.impressions || 0),
          reach: parseInt(row.reach || 0),
          linkClicks: parseInt(row.inline_link_clicks || 0),
          purchases,
          purchaseValue,
          videoViews3s,
        })
      }
      url = data.paging?.next || null
    } catch (e) {
      console.log('Meta detail fetch:', e.message); break
    }
  }
  return all
}

async function fetchAdCreatives(adIds) {
  if (!adIds.length || !META_TOKEN) return {}
  const map = {}
  for (let i = 0; i < adIds.length; i += 50) {
    const chunk = adIds.slice(i, i + 50)
    const url = `https://graph.facebook.com/v19.0/?ids=${chunk.join(',')}&fields=creative{thumbnail_url,image_url,video_id},effective_status,status&access_token=${META_TOKEN}`
    try {
      const res = await fetch(url)
      const data = await res.json()
      for (const adId of chunk) {
        const ad = data[adId]
        if (!ad) continue
        map[adId] = {
          thumbnail: ad.creative?.thumbnail_url || ad.creative?.image_url || null,
          videoId: ad.creative?.video_id || null,
          status: ad.effective_status || ad.status || null,
        }
      }
    } catch (e) { console.log('Creatives:', e.message) }
  }
  return map
}

function computeRates(a) {
  return {
    spend: a.spend, impressions: a.impressions, reach: a.reach,
    linkClicks: a.linkClicks, purchases: a.purchases,
    purchaseValue: a.purchaseValue, videoViews3s: a.videoViews3s,
    frequency: a.reach > 0 ? a.impressions / a.reach : 0,
    cpm: a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0,
    linkCTR: a.impressions > 0 ? (a.linkClicks / a.impressions) * 100 : 0,
    cpcLink: a.linkClicks > 0 ? a.spend / a.linkClicks : 0,
    roas: a.spend > 0 ? a.purchaseValue / a.spend : 0,
    costPerPurchase: a.purchases > 0 ? a.spend / a.purchases : 0,
    aov: a.purchases > 0 ? a.purchaseValue / a.purchases : 0,
    purchaseConversion: a.linkClicks > 0 ? (a.purchases / a.linkClicks) * 100 : 0,
    hookRate: a.impressions > 0 ? (a.videoViews3s / a.impressions) * 100 : 0,
  }
}

function aggregateRows(rows) {
  const a = { spend:0, impressions:0, reach:0, linkClicks:0, purchases:0, purchaseValue:0, videoViews3s:0 }
  for (const r of rows) {
    a.spend += r.spend; a.impressions += r.impressions; a.reach += r.reach
    a.linkClicks += r.linkClicks; a.purchases += r.purchases
    a.purchaseValue += r.purchaseValue; a.videoViews3s += r.videoViews3s
  }
  return computeRates(a)
}

function buildHierarchy(currentRows, prevRows, creatives) {
  const campaigns = {}
  for (const r of currentRows) {
    const cid = r.campaign_id, aid = r.adset_id
    if (!cid || !aid) continue
    if (!campaigns[cid]) campaigns[cid] = { id: cid, name: r.campaign_name, _rows: [], adsets: {} }
    if (!campaigns[cid].adsets[aid]) campaigns[cid].adsets[aid] = { id: aid, name: r.adset_name, _rows: [], ads: [] }

    campaigns[cid]._rows.push(r)
    campaigns[cid].adsets[aid]._rows.push(r)

    const cr = creatives[r.ad_id] || {}
    const prev = prevRows.find(p => p.ad_id === r.ad_id)
    campaigns[cid].adsets[aid].ads.push({
      id: r.ad_id, name: r.ad_name,
      thumbnail: cr.thumbnail, videoId: cr.videoId, status: cr.status,
      ...computeRates(r),
      previous: prev ? computeRates(prev) : null,
    })
  }

  return Object.values(campaigns).map(c => {
    const adsets = Object.values(c.adsets).map(a => {
      const prevRowsAdset = prevRows.filter(p => p.adset_id === a.id)
      return {
        id: a.id, name: a.name,
        ...aggregateRows(a._rows),
        previous: prevRowsAdset.length ? aggregateRows(prevRowsAdset) : null,
        ads: a.ads.sort((x,y) => y.spend - x.spend),
      }
    }).sort((x,y) => y.spend - x.spend)

    const prevRowsCamp = prevRows.filter(p => p.campaign_id === c.id)
    return {
      id: c.id, name: c.name,
      ...aggregateRows(c._rows),
      previous: prevRowsCamp.length ? aggregateRows(prevRowsCamp) : null,
      adsets,
    }
  }).sort((x,y) => y.spend - x.spend)
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const today = new Date()
  const since = searchParams.get('since') || format(subDays(today, 6), 'yyyy-MM-dd')
  const until = searchParams.get('until') || format(today, 'yyyy-MM-dd')

  const sinceDate = parseISO(since)
  const untilDate = parseISO(until)
  const days = Math.round((untilDate - sinceDate) / 86400000) + 1
  const prevUntilDate = subDays(sinceDate, 1)
  const prevSinceDate = subDays(prevUntilDate, days - 1)
  const prevSince = format(prevSinceDate, 'yyyy-MM-dd')
  const prevUntil = format(prevUntilDate, 'yyyy-MM-dd')

  const accounts = (META_ACCOUNT || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!accounts.length || !META_TOKEN) {
    return NextResponse.json({ error: 'Missing Meta credentials' }, { status: 500 })
  }

  try {
    const [curr, prev] = await Promise.all([
      Promise.all(accounts.map(id => fetchAdInsights(id, since, until))).then(a => a.flat()),
      Promise.all(accounts.map(id => fetchAdInsights(id, prevSince, prevUntil))).then(a => a.flat()),
    ])

    const adIds = [...new Set(curr.map(r => r.ad_id).filter(Boolean))]
    const creatives = await fetchAdCreatives(adIds)

    const campaigns = buildHierarchy(curr, prev, creatives)
    const totals = aggregateRows(curr)
    const previousTotals = aggregateRows(prev)

    return NextResponse.json({
      since, until, prevSince, prevUntil, days,
      campaigns, totals, previousTotals,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
