export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getMeta, getEffectiveTenantId } from '../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { swrSnapshot } from '../../../lib/cache/swr'
import { getRange } from '../../../lib/metaRange'

// ============================================================================
//  Meta Lead Gen — economia delle campagne lead generation (NO dati dei lead).
//
//  GET ?preset=last_28d →
//   - campaigns: [{ id, name, objective, spend, impressions, clicks, leads, cpl }]
//   - totals / prevTotals: { spend, leads, cpl, impressions, clicks }
//   - daily: [{ date, spend, leads, cpl }]
//   - settings: { avgValue, closeRate, marginPct, overrides } (leadgen_economics)
//  POST { avgValue, closeRate, marginPct, overrides } → upsert impostazioni.
//
//  Selezione campagne: objective contenente LEAD, più fallback su campagne
//  con lead>0 e zero acquisti (ottimizzazioni lead sotto altri obiettivi).
//  CAC/profitto/ROI/CPL di pareggio si calcolano nel client dalle settings.
// ============================================================================

const GRAPH = 'https://graph.facebook.com/v19.0'

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { accessToken, adAccountId } = getMeta()
    if (!accessToken) return NextResponse.json({ error: 'Meta token mancante' }, { status: 400 })
    if (!adAccountId) return NextResponse.json({ error: 'Meta Ad Account ID mancante' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('preset') || 'last_28d'
    const range = getRange(preset, searchParams)
    const accountIds = String(adAccountId).split(',').map(s => s.trim()).filter(Boolean)
      .map(a => a.startsWith('act_') ? a : `act_${a}`)

    return swrSnapshot(req, { tab: 'metaLeadgen', compute: async () => {
      try {
        const prevRange = previousRange(range)
        const [cur, prev, settings] = await Promise.all([
          buildLeadData({ accessToken, accountIds, range, withDaily: true }),
          buildLeadData({ accessToken, accountIds, range: prevRange, withDaily: false }),
          loadSettings(),
        ])
        return {
          preset, range, prevRange, accounts: accountIds,
          campaigns: cur.campaigns, totals: cur.totals, daily: cur.daily,
          prevTotals: prev.totals, settings,
          updatedAt: new Date().toISOString(),
        }
      } catch (err) {
        return { __noCache: true, error: err?.message || 'Errore Meta', campaigns: [], daily: [], totals: zeroTotals(), prevTotals: zeroTotals(), settings: null }
      }
    } })
  })
}

export async function POST(req) {
  return withTenantContext(req, async () => {
    const ws = await getEffectiveTenantId()
    if (!ws) return NextResponse.json({ error: 'workspace non identificato' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const row = {
      workspace_id: ws,
      avg_value: clampNum(body.avgValue, 0, 1e7, 0),
      close_rate: clampNum(body.closeRate, 0, 100, 0),
      margin_pct: clampNum(body.marginPct, 0, 100, 100),
      campaign_overrides: sanitizeOverrides(body.overrides),
      updated_at: new Date().toISOString(),
    }
    const admin = getAdminSupabase()
    const { error } = await admin.from('leadgen_economics').upsert(row, { onConflict: 'workspace_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, settings: toSettings(row) })
  })
}

// ── Impostazioni economics ──────────────────────────────────────────────────

async function loadSettings() {
  try {
    const ws = await getEffectiveTenantId()
    if (!ws) return null
    const admin = getAdminSupabase()
    const { data } = await admin.from('leadgen_economics').select('*').eq('workspace_id', ws).maybeSingle()
    return data ? toSettings(data) : null
  } catch { return null }
}

function toSettings(row) {
  return {
    avgValue: Number(row.avg_value || 0),
    closeRate: Number(row.close_rate || 0),
    marginPct: Number(row.margin_pct ?? 100),
    overrides: row.campaign_overrides || {},
  }
}

function clampNum(v, min, max, dflt) {
  const n = Number(v)
  if (!Number.isFinite(n)) return dflt
  return Math.min(max, Math.max(min, n))
}

function sanitizeOverrides(o) {
  if (!o || typeof o !== 'object') return {}
  const out = {}
  for (const [id, v] of Object.entries(o).slice(0, 200)) {
    if (!/^[0-9]+$/.test(id) || !v || typeof v !== 'object') continue
    const entry = {}
    if (v.avgValue !== undefined && v.avgValue !== null && v.avgValue !== '') entry.avgValue = clampNum(v.avgValue, 0, 1e7, 0)
    if (v.closeRate !== undefined && v.closeRate !== null && v.closeRate !== '') entry.closeRate = clampNum(v.closeRate, 0, 100, 0)
    if (Object.keys(entry).length) out[id] = entry
  }
  return out
}

// ── Meta Insights ───────────────────────────────────────────────────────────

async function fbGet(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      if ([429, 500, 503].includes(res.status) && i < retries) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)))
        continue
      }
      const data = await res.json()
      if (data.error) {
        if ([17, 4].includes(data.error.code) && i < retries) {
          await new Promise(r => setTimeout(r, 2000 * (i + 1)))
          continue
        }
        throw new Error(`Meta API: ${data.error.message || data.error.type}`)
      }
      return data
    } catch (e) {
      if (i === retries) throw e
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  throw new Error('Meta API failed')
}

async function fbGetAllPages(url, maxPages = 30) {
  const out = []
  let next = url, guard = 0
  while (next && guard < maxPages) {
    guard++
    const data = await fbGet(next)
    for (const r of (data.data || [])) out.push(r)
    next = data.paging?.next || null
  }
  return out
}

function actionVal(actions, type) {
  if (!Array.isArray(actions)) return 0
  return parseFloat(actions.find(a => a.action_type === type)?.value || 0)
}

// Lead totali senza doppi conteggi: 'lead' è già l'aggregato Meta; in mancanza
// somma moduli istantanei (grouped) + lead da pixel sito.
function pickLeads(actions) {
  const total = actionVal(actions, 'lead')
  if (total) return total
  const onsite = actionVal(actions, 'onsite_conversion.lead_grouped') || actionVal(actions, 'leadgen_grouped')
  const offsite = actionVal(actions, 'offsite_conversion.fb_pixel_lead')
  return onsite + offsite
}

function pickPurchases(actions) {
  for (const t of ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase']) {
    const v = actionVal(actions, t)
    if (v) return v
  }
  return 0
}

function isLeadCampaign(row, leads) {
  const obj = String(row.objective || '').toUpperCase()
  if (obj.includes('LEAD')) return true
  return leads > 0 && pickPurchases(row.actions) === 0
}

function zeroTotals() {
  return { spend: 0, leads: 0, cpl: 0, impressions: 0, clicks: 0 }
}

async function buildLeadData({ accessToken, accountIds, range, withDaily }) {
  const byCampaign = new Map()
  const timeRange = encodeURIComponent(JSON.stringify({ since: range.since, until: range.until }))
  const fields = encodeURIComponent('campaign_id,campaign_name,objective,spend,impressions,clicks,actions')

  for (const accId of accountIds) {
    const url = `${GRAPH}/${accId}/insights?level=campaign&time_range=${timeRange}&fields=${fields}&limit=200&access_token=${accessToken}`
    const rows = await fbGetAllPages(url, 10)
    for (const r of rows) {
      const leads = pickLeads(r.actions)
      if (!isLeadCampaign(r, leads)) continue
      const cur = byCampaign.get(r.campaign_id) || {
        id: r.campaign_id, name: r.campaign_name, objective: r.objective,
        spend: 0, impressions: 0, clicks: 0, leads: 0,
      }
      cur.spend += parseFloat(r.spend || 0)
      cur.impressions += parseInt(r.impressions || 0, 10)
      cur.clicks += parseInt(r.clicks || 0, 10)
      cur.leads += leads
      byCampaign.set(r.campaign_id, cur)
    }
  }

  const campaigns = [...byCampaign.values()]
    .map(c => ({ ...c, cpl: c.leads > 0 ? c.spend / c.leads : 0 }))
    .sort((a, b) => b.spend - a.spend)

  const totals = campaigns.reduce((t, c) => ({
    spend: t.spend + c.spend, leads: t.leads + c.leads,
    impressions: t.impressions + c.impressions, clicks: t.clicks + c.clicks, cpl: 0,
  }), zeroTotals())
  totals.cpl = totals.leads > 0 ? totals.spend / totals.leads : 0

  // Daily solo delle campagne lead individuate (trend spesa/lead/CPL)
  let daily = []
  if (withDaily && byCampaign.size > 0) {
    const ids = new Set(byCampaign.keys())
    const dFields = encodeURIComponent('campaign_id,date_start,spend,actions')
    const dailyMap = new Map()
    for (const accId of accountIds) {
      const url = `${GRAPH}/${accId}/insights?level=campaign&time_range=${timeRange}&time_increment=1&fields=${dFields}&limit=500&access_token=${accessToken}`
      try {
        const rows = await fbGetAllPages(url, 20)
        for (const r of rows) {
          if (!ids.has(r.campaign_id)) continue
          const day = r.date_start
          const cur = dailyMap.get(day) || { date: day, spend: 0, leads: 0 }
          cur.spend += parseFloat(r.spend || 0)
          cur.leads += pickLeads(r.actions)
          dailyMap.set(day, cur)
        }
      } catch (e) {
        console.log('[meta-leadgen] daily failed', accId, e?.message)
      }
    }
    daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ ...d, cpl: d.leads > 0 ? d.spend / d.leads : 0 }))
  }

  return { campaigns, totals, daily }
}

function previousRange({ since, until }) {
  const day = 24 * 60 * 60 * 1000
  const sinceD = new Date(`${since}T00:00:00Z`)
  const untilD = new Date(`${until}T00:00:00Z`)
  const days = Math.floor((untilD - sinceD) / day) + 1
  const prevUntilD = new Date(sinceD.getTime() - day)
  const prevSinceD = new Date(prevUntilD.getTime() - (days - 1) * day)
  const fmt = d => d.toISOString().slice(0, 10)
  return { since: fmt(prevSinceD), until: fmt(prevUntilD) }
}
