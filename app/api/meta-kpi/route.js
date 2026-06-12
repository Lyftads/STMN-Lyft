export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getMeta } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'
import { getRange } from '../../../lib/metaRange'

// ============================================================================
//  Meta KPI — endpoint unico per la tab Meta KPI.
//
//  Una sola chiamata Meta Insights aggregata + una con time_increment=1
//  per il daily breakdown dei grafici. Ritorna:
//   - totals: { spend, revenue, purchases, roas, cpo, cpm, ctr, ctr_link,
//              cpc, cpc_link, impressions, clicks, link_clicks, reach,
//              frequency }
//   - daily:  [{ date, spend, revenue, purchases, roas, cpo, cpm, ctr,
//              ctr_link, cpc, cpc_link, impressions, clicks, link_clicks,
//              reach, frequency }]
//
//  GET ?preset=last_28d
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

    return swrSnapshot(req, { tab: 'metaKpi', compute: async () => {
      try {
        const prevRange = previousRange(range)
        const [{ totals, daily }, prevAgg] = await Promise.all([
          buildKpi({ accessToken, accountIds, range }),
          buildKpiTotalsOnly({ accessToken, accountIds, range: prevRange }),
        ])
        return {
          preset, range, prevRange,
          accounts: accountIds,
          totals, prevTotals: prevAgg.totals, daily,
          updatedAt: new Date().toISOString(),
        }
      } catch (err) {
        return { __noCache: true, error: err?.message || 'Errore Meta', totals: zeroBucket(), prevTotals: zeroBucket(), daily: [] }
      }
    } })
  })
}

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

function numFrom(actions, types) {
  if (!Array.isArray(actions)) return 0
  for (const t of types) {
    const v = actions.find(a => a.action_type === t)?.value
    if (v) return parseFloat(v)
  }
  return 0
}

function pickPurchases(actions) {
  return numFrom(actions, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'])
}

function pickRevenue(actionValues) {
  return numFrom(actionValues, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'])
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

async function buildKpiTotalsOnly({ accessToken, accountIds, range }) {
  const totals = zeroBucket()
  for (const accId of accountIds) {
    const fields = encodeURIComponent('spend,impressions,clicks,inline_link_clicks,reach,frequency,actions,action_values')
    const timeRange = encodeURIComponent(JSON.stringify({ since: range.since, until: range.until }))
    const url = `${GRAPH}/${accId}/insights?level=account&time_range=${timeRange}&fields=${fields}&access_token=${accessToken}`
    try {
      const data = await fbGet(url)
      for (const r of (data.data || [])) accumulate(totals, r)
    } catch (e) {
      console.log('[meta-kpi] prev totals failed', accId, e?.message)
    }
  }
  finalize(totals)
  return { totals }
}

async function buildKpi({ accessToken, accountIds, range }) {
  // Aggregato totale account (somma di account multipli se applicable)
  const totals = zeroBucket()
  const dailyMap = new Map() // date → bucket

  for (const accId of accountIds) {
    // Aggregato totale
    {
      const fields = encodeURIComponent('spend,impressions,clicks,inline_link_clicks,reach,frequency,actions,action_values')
      const timeRange = encodeURIComponent(JSON.stringify({ since: range.since, until: range.until }))
      const url = `${GRAPH}/${accId}/insights?level=account&time_range=${timeRange}&fields=${fields}&access_token=${accessToken}`
      try {
        const data = await fbGet(url)
        for (const r of (data.data || [])) accumulate(totals, r)
      } catch (e) {
        console.log('[meta-kpi] totals failed', accId, e?.message)
      }
    }

    // Daily breakdown
    {
      const fields = encodeURIComponent('date_start,spend,impressions,clicks,inline_link_clicks,reach,frequency,actions,action_values')
      const timeRange = encodeURIComponent(JSON.stringify({ since: range.since, until: range.until }))
      const url = `${GRAPH}/${accId}/insights?level=account&time_range=${timeRange}&time_increment=1&fields=${fields}&limit=500&access_token=${accessToken}`
      try {
        const rows = await fbGetAllPages(url, 10)
        for (const r of rows) {
          const day = r.date_start
          if (!dailyMap.has(day)) dailyMap.set(day, zeroBucket(day))
          accumulate(dailyMap.get(day), r)
        }
      } catch (e) {
        console.log('[meta-kpi] daily failed', accId, e?.message)
      }
    }
  }

  // Finalize totali
  finalize(totals)

  // Finalize daily series
  const daily = Array.from(dailyMap.values())
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map(b => {
      finalize(b)
      return b
    })

  return { totals, daily }
}

function zeroBucket(date = null) {
  return {
    date,
    spend: 0, revenue: 0, purchases: 0,
    impressions: 0, clicks: 0, link_clicks: 0,
    reach: 0, frequency: 0,
    roas: 0, cpo: null, cpm: 0,
    ctr: 0, ctr_link: 0,
    cpc: null, cpc_link: null,
  }
}

function accumulate(b, r) {
  b.spend       += parseFloat(r.spend || 0)
  b.revenue     += pickRevenue(r.action_values)
  b.purchases   += pickPurchases(r.actions)
  b.impressions += parseInt(r.impressions || 0)
  b.clicks      += parseInt(r.clicks || 0)
  b.link_clicks += parseInt(r.inline_link_clicks || 0) || numFrom(r.actions, ['link_click'])
  b.reach       += parseInt(r.reach || 0)
  // Frequency e' una media ponderata da Meta: la riprendiamo come max
  // (per il daily prendiamo direttamente, per il totale aggregato la
  // ricalcoliamo come impressions/reach in finalize).
  const f = parseFloat(r.frequency || 0)
  if (f > b.frequency) b.frequency = f
}

function finalize(b) {
  // Per il totale aggregato, frequency = impressions / reach (Meta dixit).
  // Per il daily lasciamo quella ritornata da Meta (gia' media).
  if (b.reach > 0 && b.impressions > 0) {
    const computed = b.impressions / b.reach
    if (computed > b.frequency) b.frequency = computed
  }
  b.roas      = b.spend > 0 ? +(b.revenue / b.spend).toFixed(2) : 0
  b.cpo       = b.purchases > 0 ? +(b.spend / b.purchases).toFixed(2) : null
  b.cpm       = b.impressions > 0 ? +((b.spend / b.impressions) * 1000).toFixed(2) : 0
  b.ctr       = b.impressions > 0 ? +((b.clicks / b.impressions) * 100).toFixed(2) : 0
  b.ctr_link  = b.impressions > 0 ? +((b.link_clicks / b.impressions) * 100).toFixed(2) : 0
  b.cpc       = b.clicks > 0 ? +(b.spend / b.clicks).toFixed(2) : null
  b.cpc_link  = b.link_clicks > 0 ? +(b.spend / b.link_clicks).toFixed(2) : null
  b.spend     = +b.spend.toFixed(2)
  b.revenue   = +b.revenue.toFixed(2)
  b.purchases = Math.round(b.purchases)
  b.frequency = +b.frequency.toFixed(2)
}
