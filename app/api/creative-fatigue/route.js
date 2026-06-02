export const dynamic = 'force-dynamic'
export const maxDuration = 45

import { NextResponse } from 'next/server'

// ── Creative Fatigue Tracker (additivo, isolato) ──────────────────
// Legge gli insights Meta a livello AD (tutto l'account) e calcola un fatigue
// score per creativa: frequency↑, CTR↓ (vs media account), CPA↑. Flagga le
// creative "da rinfrescare". Non tocca /api/meta-detail.

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID
const GRAPH_VERSION = 'v19.0'

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

function accounts() {
  return String(META_ACCOUNT || '').split(',').map(s => {
    const x = s.trim(); if (!x) return null; return x.startsWith('act_') ? x : `act_${x}`
  }).filter(Boolean)
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10)
}
function getRange(preset) {
  const today = new Date().toISOString().slice(0, 10)
  switch (preset) {
    case 'today': return { since: today, until: today }
    case 'yesterday': { const y = addDays(today, -1); return { since: y, until: y } }
    case 'last_7d': return { since: addDays(today, -7), until: today }
    case 'last_14d': return { since: addDays(today, -14), until: today }
    case 'last_90d': return { since: addDays(today, -90), until: today }
    case 'current_month': case 'mtd': return { since: `${today.slice(0, 7)}-01`, until: today }
    case 'last_month': {
      const d = new Date(`${today.slice(0, 7)}-01T00:00:00`); d.setDate(0)
      const end = d.toISOString().slice(0, 10); return { since: `${end.slice(0, 7)}-01`, until: end }
    }
    case 'last_28d': default: return { since: addDays(today, -28), until: today }
  }
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
    + `&limit=300&access_token=${encodeURIComponent(META_TOKEN)}`
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

export async function GET(req) {
  if (!META_TOKEN || !META_ACCOUNT) {
    return NextResponse.json({ error: 'Meta non configurato', ads: [] }, { status: 200 })
  }
  const { searchParams } = new URL(req.url)
  const preset = searchParams.get('preset') || 'last_28d'
  const range = getRange(preset)

  try {
    const raw = []
    for (const acc of accounts()) raw.push(...(await fetchAdInsights(acc, range)))

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

    return NextResponse.json({
      preset, range,
      avgCtr: Math.round(avgCtr * 100) / 100,
      avgCpa: Math.round(avgCpa * 100) / 100,
      total: ads.length,
      toRefresh: ads.filter(a => a.refresh).length,
      ads: ads.slice(0, 40),
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Errore Meta', ads: [] }, { status: 200 })
  }
}
