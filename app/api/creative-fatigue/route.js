export const dynamic = 'force-dynamic'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { getRange, prevRange } from '../../../lib/metaRange'
import { withTenantContext, getMeta } from '../../../lib/tenant/credentials'

// ── Creative Fatigue Tracker (additivo, isolato, tenant-aware) ────
// Legge gli insights Meta a livello AD e calcola un fatigue score per
// creativa: frequency↑, CTR↓ (vs media account), CPA↑. Flagga le creative
// "da rinfrescare". Non tocca /api/meta-detail.

const metaToken = () => getMeta().accessToken
const metaAccount = () => getMeta().adAccountId
const GRAPH_VERSION = 'v19.0'

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

function normAcc(s) { const x = String(s || '').trim(); if (!x) return null; return x.startsWith('act_') ? x : `act_${x}` }
function allAccounts() { return String(metaAccount() || '').split(',').map(normAcc).filter(Boolean) }
function usedAccounts(param) { const n = normAcc(param); return n && allAccounts().includes(n) ? [n] : allAccounts() }
async function accountNames(ids) {
  const out = []
  for (const id of ids) {
    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${id}?fields=name&access_token=${encodeURIComponent(metaToken())}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      const j = await res.json(); out.push({ id, name: j?.name || id })
    } catch { out.push({ id, name: id }) }
  }
  return out
}

// Aggregato account-level per il periodo (per le variazioni vs precedente)
async function accountAgg(used, since, until) {
  let spend = 0, impressions = 0, clicks = 0, purchases = 0
  for (const id of used) {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${id}/insights?time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&fields=${encodeURIComponent('spend,impressions,inline_link_clicks,actions')}&access_token=${encodeURIComponent(metaToken())}`
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
      const j = await res.json()
      for (const r of (j.data || [])) { spend += num(r.spend); impressions += num(r.impressions); clicks += num(r.inline_link_clicks); purchases += purchasesFrom(r.actions) }
    } catch {}
  }
  return { spend, ctr: impressions > 0 ? (clicks / impressions) * 100 : 0, cpa: purchases > 0 ? spend / purchases : 0, purchases }
}

function purchasesFrom(actions) {
  if (!Array.isArray(actions)) return 0
  const find = (t) => num(actions.find(a => a.action_type === t)?.value)
  return find('omni_purchase') || find('purchase') || find('offsite_conversion.fb_pixel_purchase') || 0
}

async function fetchAdInsights(accountId, range) {
  const out = []
  let url = `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/insights`
    + `?level=ad&time_range=${encodeURIComponent(JSON.stringify({ since: range.since, until: range.until }))}`
    + `&fields=${encodeURIComponent('ad_id,ad_name,campaign_name,adset_name,spend,impressions,reach,frequency,inline_link_click_ctr,actions')}`
    + `&filtering=${encodeURIComponent(JSON.stringify([{ field: 'impressions', operator: 'GREATER_THAN', value: 200 }]))}`
    + `&limit=300&access_token=${encodeURIComponent(metaToken())}`
  let guard = 0
  while (url && guard < 12) {
    guard++
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data?.error?.message || `Meta ${res.status}`)
    for (const r of (data.data || [])) out.push(r)
    url = data.paging?.next || null
  }
  return out
}

// Meta usa questo hash come placeholder generico per DPA → niente immagine reale
const GENERIC_PLACEHOLDER = '75341531_494485104475166'
const okUrl = (u) => u && !u.includes(GENERIC_PLACEHOLDER)

async function graph(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`)
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') url.searchParams.set(k, v)
  url.searchParams.set('access_token', metaToken())
  try {
    const res = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(12000) })
    const data = await res.json()
    if (!res.ok || data.error) return null
    return data
  } catch { return null }
}

function creativeProductSetId(c) {
  if (!c) return null
  return c.product_set_id
    || c.object_story_spec?.template_data?.product_set_id
    || c.asset_feed_spec?.product_set_id
    || null
}
async function adsetProductSetId(adsetId) {
  if (!adsetId) return null
  const d = await graph(adsetId, { fields: 'promoted_object' })
  return d?.promoted_object?.product_set_id || null
}
// Immagine reale del prodotto dal catalogo (per inserzioni DPA / Advantage+)
async function productSetImage(psId) {
  if (!psId) return null
  const d = await graph(`${psId}/products`, { fields: 'image_url,images{url}', limit: '1' })
  const p = (d?.data || [])[0]
  return p?.image_url || p?.images?.data?.[0]?.url || null
}

async function fetchThumbnails(adIds) {
  const out = {}
  const meta = {} // adId -> { creative, adsetId }

  // 1) batch read creative + adset_id
  for (let i = 0; i < adIds.length; i += 50) {
    const chunk = adIds.slice(i, i + 50)
    const data = await graph('', {
      ids: chunk.join(','),
      fields: 'creative{thumbnail_url,image_url,product_set_id,object_story_spec,asset_feed_spec},adset_id',
    })
    if (!data) continue
    for (const id of chunk) if (data[id]) meta[id] = { creative: data[id].creative || {}, adsetId: data[id].adset_id || null }
  }

  // 2) risolvi thumbnail; per le catalogo usa l'immagine del product set
  const psImgCache = new Map()      // productSetId -> imageUrl
  const adsetPsCache = new Map()    // adsetId -> productSetId
  for (const id of adIds) {
    const c = meta[id]?.creative || {}
    const adsetId = meta[id]?.adsetId
    let thumb = okUrl(c.thumbnail_url) ? c.thumbnail_url : (okUrl(c.image_url) ? c.image_url : null)

    if (!thumb) {
      let psId = creativeProductSetId(c)
      if (!psId && adsetId) {
        if (!adsetPsCache.has(adsetId)) adsetPsCache.set(adsetId, await adsetProductSetId(adsetId))
        psId = adsetPsCache.get(adsetId)
      }
      if (psId) {
        if (!psImgCache.has(psId)) psImgCache.set(psId, await productSetImage(psId))
        thumb = psImgCache.get(psId) || null
      }
    }
    out[id] = { thumbnail: thumb, image: okUrl(c.image_url) ? c.image_url : thumb }
  }
  return out
}

export async function GET(req) {
  return withTenantContext(req, async () => {
  if (!metaToken() || !metaAccount()) {
    return NextResponse.json({ error: 'Meta non configurato', ads: [] }, { status: 200 })
  }
  const { searchParams } = new URL(req.url)
  const preset = searchParams.get('preset') || 'last_28d'
  const range = getRange(preset)
  const used = usedAccounts(searchParams.get('account'))

  try {
    const raw = []
    for (const acc of used) raw.push(...(await fetchAdInsights(acc, range)))

    const ads = raw.map(r => {
      const spend = num(r.spend)
      const impressions = num(r.impressions)
      const frequency = num(r.frequency)
      const ctr = num(r.inline_link_click_ctr)
      const purchases = purchasesFrom(r.actions)
      const cpa = purchases > 0 ? spend / purchases : null
      return {
        adId: r.ad_id, name: r.ad_name || r.ad_id,
        campaign: r.campaign_name || '', adset: r.adset_name || '',
        spend: Math.round(spend * 100) / 100, impressions,
        frequency: Math.round(frequency * 100) / 100,
        ctr: Math.round(ctr * 100) / 100,
        purchases, cpa: cpa != null ? Math.round(cpa * 100) / 100 : null,
      }
    }).filter(a => a.impressions >= 500)

    // Medie account (CTR pesata su impression, CPA pesata su acquisti)
    const totImpr = ads.reduce((s, a) => s + a.impressions, 0)
    const avgCtr = totImpr > 0 ? ads.reduce((s, a) => s + a.ctr * a.impressions, 0) / totImpr : 0
    const totPur = ads.reduce((s, a) => s + a.purchases, 0)
    const totSpendWithPur = ads.reduce((s, a) => s + (a.purchases > 0 ? a.spend : 0), 0)
    const avgCpa = totPur > 0 ? totSpendWithPur / totPur : 0

    for (const a of ads) {
      const ctrPenalty = avgCtr > 0 && a.ctr < avgCtr ? (avgCtr - a.ctr) / avgCtr : 0
      const cpaPenalty = avgCpa > 0 && a.cpa != null && a.cpa > avgCpa ? (a.cpa - avgCpa) / avgCpa : 0
      const freqPart = Math.min(a.frequency / 2, 4) // 0..4
      a.score = Math.round((freqPart + ctrPenalty * 3 + cpaPenalty * 2) * 100) / 100
      a.refresh = a.frequency >= 5 || (a.frequency >= 3 && (ctrPenalty >= 0.2 || cpaPenalty >= 0.3))
      a.severity = (a.frequency >= 5 || a.score >= 4) ? 'high' : (a.refresh || a.score >= 2.5) ? 'medium' : 'low'
      const reasons = []
      if (a.frequency >= 5) reasons.push(`frequency ${a.frequency} (alta)`)
      else if (a.frequency >= 3) reasons.push(`frequency ${a.frequency}`)
      if (ctrPenalty >= 0.2) reasons.push(`CTR ${a.ctr}% sotto media ${avgCtr.toFixed(2)}%`)
      if (cpaPenalty >= 0.3 && a.cpa != null) reasons.push(`CPA €${a.cpa} sopra media €${avgCpa.toFixed(2)}`)
      a.reasons = reasons
    }

    ads.sort((a, b) => b.score - a.score)
    const top = ads.slice(0, 40)

    // Thumbnail della creativa (batch read ?ids=…&fields=creative{...})
    try {
      const thumbs = await fetchThumbnails(top.map(a => a.adId))
      for (const a of top) {
        const t = thumbs[a.adId]
        if (t) { a.thumbnail = t.thumbnail || null; a.image = t.image || null }
      }
    } catch { /* thumbnail best-effort */ }

    // Periodo precedente → variazioni
    const pr = prevRange(range)
    const [curAgg, prevAgg] = await Promise.all([accountAgg(used, range.since, range.until), accountAgg(used, pr.since, pr.until)])
    const mkDelta = (cur, prev) => ({ abs: Math.round((cur - prev) * 100) / 100, pct: prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null })

    const accountsList = await accountNames(allAccounts())

    return NextResponse.json({
      preset, range,
      accounts: accountsList,
      account: used.length === 1 ? used[0] : '',
      avgCtr: Math.round(avgCtr * 100) / 100,
      avgCpa: Math.round(avgCpa * 100) / 100,
      spend: Math.round(curAgg.spend * 100) / 100,
      prev: { spend: Math.round(prevAgg.spend * 100) / 100, ctr: Math.round(prevAgg.ctr * 100) / 100, cpa: Math.round(prevAgg.cpa * 100) / 100 },
      delta: { spend: mkDelta(curAgg.spend, prevAgg.spend), ctr: mkDelta(curAgg.ctr, prevAgg.ctr), cpa: mkDelta(curAgg.cpa, prevAgg.cpa) },
      total: ads.length,
      toRefresh: ads.filter(a => a.refresh).length,
      ads: top,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Errore Meta', ads: [] }, { status: 200 })
  }
  })
}
