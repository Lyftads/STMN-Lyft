export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'

// ── Budget Advisor (additivo, isolato, CONSULENZIALE — non esecutivo) ─────────
// Legge gli insights Meta a livello CAMPAGNA e suggerisce riallocazioni di
// budget: scala le campagne efficienti, riduci/taglia quelle sotto soglia.
// Forecast incrementale sullo spostamento di budget a parità di spesa totale.

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID
const GRAPH_VERSION = 'v19.0'

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

function normAcc(s) { const x = String(s || '').trim(); if (!x) return null; return x.startsWith('act_') ? x : `act_${x}` }
function allAccounts() { return String(META_ACCOUNT || '').split(',').map(normAcc).filter(Boolean) }
function usedAccounts(param) { const n = normAcc(param); return n && allAccounts().includes(n) ? [n] : allAccounts() }

async function accountNames(ids) {
  const out = []
  for (const id of ids) {
    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${id}?fields=name&access_token=${encodeURIComponent(META_TOKEN)}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      const j = await res.json()
      out.push({ id, name: j?.name || id })
    } catch { out.push({ id, name: id }) }
  }
  return out
}

// Set degli ID campagna ATTIVE (effective_status ACTIVE)
async function activeCampaignIds(accountId) {
  const ids = new Set()
  let url = `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/campaigns?fields=id&effective_status=${encodeURIComponent(JSON.stringify(['ACTIVE']))}&limit=500&access_token=${encodeURIComponent(META_TOKEN)}`
  let guard = 0
  while (url && guard < 6) {
    guard++
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
      const j = await res.json()
      if (!res.ok || j.error) break
      for (const c of (j.data || [])) ids.add(c.id)
      url = j.paging?.next || null
    } catch { break }
  }
  return ids
}
function addDays(date, days) { const d = new Date(`${date}T00:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10) }
function getRange(preset) {
  const today = new Date().toISOString().slice(0, 10)
  switch (preset) {
    case 'last_7d': return { since: addDays(today, -7), until: today }
    case 'last_14d': return { since: addDays(today, -14), until: today }
    case 'last_90d': return { since: addDays(today, -90), until: today }
    case 'current_month': case 'mtd': return { since: `${today.slice(0, 7)}-01`, until: today }
    case 'last_month': { const d = new Date(`${today.slice(0, 7)}-01T00:00:00`); d.setDate(0); const e = d.toISOString().slice(0, 10); return { since: `${e.slice(0, 7)}-01`, until: e } }
    case 'last_28d': default: return { since: addDays(today, -28), until: today }
  }
}
function valFrom(arr, types) {
  if (!Array.isArray(arr)) return 0
  for (const t of types) { const v = num(arr.find(a => a.action_type === t)?.value); if (v) return v }
  return 0
}

async function fetchCampaignInsights(accountId, range) {
  const out = []
  let url = `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/insights`
    + `?level=campaign&time_range=${encodeURIComponent(JSON.stringify({ since: range.since, until: range.until }))}`
    + `&fields=${encodeURIComponent('campaign_id,campaign_name,spend,purchase_roas,action_values,actions,impressions')}`
    + `&filtering=${encodeURIComponent(JSON.stringify([{ field: 'spend', operator: 'GREATER_THAN', value: 1 }]))}`
    + `&limit=200&access_token=${encodeURIComponent(META_TOKEN)}`
  let guard = 0
  while (url && guard < 10) {
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
  if (!META_TOKEN || !META_ACCOUNT) return NextResponse.json({ error: 'Meta non configurato', campaigns: [] }, { status: 200 })
  const { searchParams } = new URL(req.url)
  const preset = searchParams.get('preset') || 'last_28d'
  const range = getRange(preset)
  const used = usedAccounts(searchParams.get('account'))

  try {
    // ID campagne ATTIVE sugli account usati (il Budget Advisor lavora solo su queste)
    const activeIds = new Set()
    for (const acc of used) { const s = await activeCampaignIds(acc); s.forEach(id => activeIds.add(id)) }

    const raw = []
    for (const acc of used) raw.push(...(await fetchCampaignInsights(acc, range)))

    let campaigns = raw
      .filter(r => activeIds.has(r.campaign_id)) // SOLO campagne attive
      .map(r => {
        const spend = num(r.spend)
        const purchases = valFrom(r.actions, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'])
        let revenue = valFrom(r.action_values, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'])
        let roas = spend > 0 ? revenue / spend : 0
        if (!revenue) { const pr = valFrom(r.purchase_roas, ['omni_purchase', 'purchase']); if (pr) { roas = pr; revenue = pr * spend } }
        return {
          name: r.campaign_name || '—',
          spend: Math.round(spend * 100) / 100,
          revenue: Math.round(revenue * 100) / 100,
          roas: Math.round(roas * 100) / 100,
          purchases,
          cpa: purchases > 0 ? Math.round((spend / purchases) * 100) / 100 : null,
        }
      }).filter(c => c.spend >= 5)

    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
    const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0)
    const mer = totalSpend > 0 ? totalRevenue / totalSpend : 0

    // Classificazione + budget consigliato (a parità di spesa totale)
    for (const c of campaigns) {
      let action = 'mantieni', deltaPct = 0
      if (c.roas > 0 && c.roas < 1) { action = 'taglia'; deltaPct = -100 }
      else if (mer > 0 && c.roas >= mer * 1.2 && c.roas >= 2) { action = 'scala'; deltaPct = 25 }
      else if (mer > 0 && c.roas > 0 && c.roas < mer * 0.7) { action = 'riduci'; deltaPct = -30 }
      else if (c.roas === 0 && c.spend > 0) { action = 'taglia'; deltaPct = -100 }
      c.action = action
      c.deltaPct = deltaPct
      c.suggestedSpend = Math.round(c.spend * (1 + deltaPct / 100) * 100) / 100
    }

    // Riallocazione: budget liberato dai tagli/riduzioni → verso le "scala"
    const freed = campaigns.filter(c => c.deltaPct < 0).reduce((s, c) => s + (c.spend - c.suggestedSpend), 0)
    const scaleCamps = campaigns.filter(c => c.action === 'scala')
    const scaleRoasW = scaleCamps.reduce((s, c) => s + c.roas * c.spend, 0)
    const scaleSpend = scaleCamps.reduce((s, c) => s + c.spend, 0)
    const avgScaleRoas = scaleSpend > 0 ? scaleRoasW / scaleSpend : mer
    const cutCamps = campaigns.filter(c => c.deltaPct < 0)
    const cutSpend = cutCamps.reduce((s, c) => s + (c.spend - c.suggestedSpend), 0)
    const cutRoasW = cutCamps.reduce((s, c) => s + c.roas * (c.spend - c.suggestedSpend), 0)
    const avgCutRoas = cutSpend > 0 ? cutRoasW / cutSpend : 0
    // Revenue incrementale stimata spostando `freed` da ROAS basso a ROAS alto
    const forecastDelta = Math.round(freed * (avgScaleRoas - avgCutRoas))

    campaigns.sort((a, b) => b.spend - a.spend)

    const accountsList = await accountNames(allAccounts())

    return NextResponse.json({
      preset, range,
      accounts: accountsList,
      account: used.length === 1 ? used[0] : '',
      totalSpend: Math.round(totalSpend * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      mer: Math.round(mer * 100) / 100,
      counts: {
        scala: campaigns.filter(c => c.action === 'scala').length,
        riduci: campaigns.filter(c => c.action === 'riduci').length,
        taglia: campaigns.filter(c => c.action === 'taglia').length,
      },
      reallocation: {
        freed: Math.round(freed * 100) / 100,
        forecastDelta: Number.isFinite(forecastDelta) ? forecastDelta : 0,
        avgScaleRoas: Math.round(avgScaleRoas * 100) / 100,
        avgCutRoas: Math.round(avgCutRoas * 100) / 100,
      },
      campaigns,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Errore Meta', campaigns: [] }, { status: 200 })
  }
}
