export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getMeta } from '../../../lib/tenant/credentials'
import { getRange } from '../../../lib/metaRange'
import { swrSnapshot } from '../../../lib/cache/swr'

// ============================================================================
//  Meta — KPI per SEGMENTO DI PUBBLICO (breakdown nativo user_segment_key:
//  prospecting=Nuovo / existing=Esistenti / engaged=Interagito / unknown).
//  Per OGNI segmento: totals + daily (timeseries) + prevTotals, con le STESSE
//  chiavi di /api/meta-kpi → la tab Meta KPI può mostrare card+grafici identici
//  per il segmento scelto. Aggregato su tutti gli account.
//  CAC nuovi clienti = cpo del segmento prospecting (spesa/acquisti, dato reale Meta).
//  GET ?preset=last_28d | ?preset=custom&since=&until=
// ============================================================================

const GRAPH = 'v19.0'
const metaToken = () => getMeta().accessToken
const metaAccount = () => getMeta().adAccountId
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(num(n) * 100) / 100

function accounts() {
  return String(metaAccount() || '').split(',').map(s => {
    const x = s.trim().replace(/["']/g, ''); if (!x) return null
    return x.startsWith('act_') ? x : `act_${x}`
  }).filter(Boolean)
}

const SEG_MAP = { prospecting: 'new', existing: 'returning', engaged: 'engaged', unknown: 'unknown' }
const SEG_LABEL = { new: 'Nuovo pubblico', returning: 'Clienti esistenti', engaged: 'Pubblico che ha interagito', unknown: 'Sconosciuto' }
const PURCHASE = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase']

function actVal(arr, names) {
  if (!Array.isArray(arr)) return 0
  for (const n of names) { const f = arr.find(a => a.action_type === n); if (f) return num(f.value) }
  return 0
}
const zero = () => ({ spend: 0, impressions: 0, reach: 0, link_clicks: 0, purchases: 0, revenue: 0 })

// Da accumulatore grezzo → KPI derivati (stesse chiavi di /api/meta-kpi).
function finalize(a, date) {
  const cpo = a.purchases > 0 ? r2(a.spend / a.purchases) : null
  return {
    ...(date ? { date } : {}),
    spend: r2(a.spend),
    revenue: r2(a.revenue),
    roas: a.spend > 0 ? r2(a.revenue / a.spend) : 0,
    purchases: Math.round(a.purchases),
    cpo, cac: cpo, cpa: cpo,
    impressions: Math.round(a.impressions),
    reach: Math.round(a.reach),
    link_clicks: Math.round(a.link_clicks),
    cpc_link: a.link_clicks > 0 ? r2(a.spend / a.link_clicks) : null,
    ctr_link: a.impressions > 0 ? r2((a.link_clicks / a.impressions) * 100) : null,
    cpm: a.impressions > 0 ? r2((a.spend / a.impressions) * 1000) : null,
    frequency: a.reach > 0 ? r2(a.impressions / a.reach) : null,
  }
}

function addRow(acc, row) {
  acc.spend += num(row.spend)
  acc.impressions += num(row.impressions)
  acc.reach += num(row.reach)
  acc.link_clicks += num(row.inline_link_clicks) || num(row.clicks)
  acc.purchases += actVal(row.actions, PURCHASE)
  acc.revenue += actVal(row.action_values, PURCHASE)
}

async function fb(path, params) {
  const url = new URL(`https://graph.facebook.com/${GRAPH}/${path}`)
  for (const [k, v] of Object.entries(params || {})) {
    if (v != null && v !== '') url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  }
  url.searchParams.set('access_token', metaToken())
  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (data?.error) throw new Error(data.error.message || 'Meta API')
  return Array.isArray(data?.data) ? data.data : []
}

// Totals per segmento sul range (no timeseries)
async function segTotals(since, until) {
  const agg = {}
  for (const acc of accounts()) {
    let rows = []
    try { rows = await fb(`${acc}/insights`, { level: 'account', time_range: JSON.stringify({ since, until }), breakdowns: 'user_segment_key', fields: 'spend,impressions,reach,inline_link_clicks,clicks,actions,action_values', limit: '50' }) } catch {}
    for (const row of rows) {
      const b = SEG_MAP[row.user_segment_key] || 'unknown'
      if (!agg[b]) agg[b] = zero()
      addRow(agg[b], row)
    }
  }
  return agg
}

// Totals + daily per segmento sul range
async function segDetailed(since, until) {
  const totalsAgg = {}
  const dailyAgg = {} // segment → date → acc
  for (const acc of accounts()) {
    let rows = []
    try { rows = await fb(`${acc}/insights`, { level: 'account', time_range: JSON.stringify({ since, until }), breakdowns: 'user_segment_key', time_increment: '1', fields: 'spend,impressions,reach,inline_link_clicks,clicks,actions,action_values', limit: '500' }) } catch {}
    for (const row of rows) {
      const b = SEG_MAP[row.user_segment_key] || 'unknown'
      const date = row.date_start
      if (!totalsAgg[b]) totalsAgg[b] = zero()
      addRow(totalsAgg[b], row)
      if (date) {
        if (!dailyAgg[b]) dailyAgg[b] = {}
        if (!dailyAgg[b][date]) dailyAgg[b][date] = zero()
        addRow(dailyAgg[b][date], row)
      }
    }
  }
  return { totalsAgg, dailyAgg }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    if (!metaToken() || !metaAccount()) {
      return NextResponse.json({ ok: false, configured: false, error: 'Meta non configurato' })
    }
    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('preset') || 'last_28d'
    const range = getRange(preset, searchParams)
    // periodo precedente, stessa lunghezza
    const d0 = new Date(`${range.since}T00:00:00Z`), d1 = new Date(`${range.until}T00:00:00Z`)
    const len = Math.round((d1 - d0) / 86400000) + 1
    const prevUntil = new Date(d0.getTime() - 86400000)
    const prevSince = new Date(prevUntil.getTime() - (len - 1) * 86400000)
    const prevRange = { since: prevSince.toISOString().slice(0, 10), until: prevUntil.toISOString().slice(0, 10) }

    return swrSnapshot(req, { tab: 'metaSegments', ttlMs: 30 * 60 * 1000, compute: async () => {
      const [{ totalsAgg, dailyAgg }, prevAgg] = await Promise.all([
        segDetailed(range.since, range.until),
        segTotals(prevRange.since, prevRange.until),
      ])
      const segments = {}
      for (const key of ['new', 'returning', 'engaged', 'unknown']) {
        const t = totalsAgg[key] || zero()
        const daily = Object.entries(dailyAgg[key] || {})
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, acc]) => finalize(acc, date))
        segments[key] = {
          label: SEG_LABEL[key],
          ...finalize(t),
          totals: finalize(t),
          prevTotals: finalize(prevAgg[key] || zero()),
          daily,
        }
      }
      return {
        ok: true, configured: true, preset, range, prevRange,
        segments,
        cacNew: segments.new?.cpo ?? null,
        updatedAt: new Date().toISOString(),
      }
    } })
  })
}
