export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getGoogle } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'
import { getRange } from '../../../lib/metaRange'

// ============================================================================
//  Google KPI — endpoint unico per la tab Google KPI (gemella di /api/meta-kpi).
//
//  Query GAQL su `campaign` con segments.date → totals + daily per il preset,
//  più i totals del periodo precedente per i delta. Multi-tenant: credenziali
//  Google del tenant via getGoogle() (mai env STMN per i non-owner).
//
//  Ritorna:
//   - totals:     { spend, convValue, conversions, impressions, clicks,
//                   roas, cpa, cpm, ctr, cpc, convRate }
//   - prevTotals: stessa forma, periodo precedente
//   - daily:      [{ date, ...stessi campi }]
//
//  GET ?preset=last_28d
// ============================================================================

const num = (v) => (v == null ? 0 : (typeof v === 'object' ? Number(v.toString()) : Number(v)) || 0)

export async function GET(req) {
  return withTenantContext(req, async () => {
    const g = getGoogle()
    const CLIENT_ID = g.clientId
    const CLIENT_SECRET = g.clientSecret
    const REFRESH_TOKEN = g.refreshToken
    const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    const CUSTOMER_ID = (g.adsCustomerId || '').replace(/-/g, '')
    const MCC_ID = (g.adsMccId || '').replace(/-/g, '')

    if (!DEVELOPER_TOKEN || !CUSTOMER_ID || !REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
      return NextResponse.json({
        configured: false, totals: zeroBucket(), prevTotals: zeroBucket(), daily: [],
        missing: [
          !DEVELOPER_TOKEN && 'GOOGLE_ADS_DEVELOPER_TOKEN',
          !CUSTOMER_ID && 'GOOGLE_ADS_CUSTOMER_ID',
          !REFRESH_TOKEN && 'GOOGLE_REFRESH_TOKEN',
          !CLIENT_ID && 'GOOGLE_CLIENT_ID',
          !CLIENT_SECRET && 'GOOGLE_CLIENT_SECRET',
        ].filter(Boolean),
      })
    }

    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('preset') || 'last_28d'
    const range = getRange(preset, searchParams)
    const prevRange = previousRange(range)

    return swrSnapshot(req, { tab: 'googleKpi', compute: async () => {
      try {
        const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)
        const { GoogleAdsServiceClient } = await import('google-ads-node')
        const grpc = await import('@grpc/grpc-js')
        const client = new GoogleAdsServiceClient({
          sslCreds: grpc.credentials.createSsl(),
          servicePath: 'googleads.googleapis.com',
          port: 443,
        })
        const callOptions = {
          otherArgs: {
            headers: {
              'authorization': `Bearer ${accessToken}`,
              'developer-token': DEVELOPER_TOKEN,
              ...(MCC_ID ? { 'login-customer-id': MCC_ID } : {}),
            },
          },
        }

        const [{ totals, daily }, prevTotals] = await Promise.all([
          buildKpi({ client, CUSTOMER_ID, callOptions, range }),
          buildTotalsOnly({ client, CUSTOMER_ID, callOptions, range: prevRange }),
        ])

        return {
          configured: true, preset, range, prevRange,
          totals, prevTotals, daily,
          updatedAt: new Date().toISOString(),
        }
      } catch (err) {
        return {
          __noCache: true,
          configured: true, preset, range, prevRange,
          totals: zeroBucket(), prevTotals: zeroBucket(), daily: [],
          error: String(err?.message || err),
        }
      }
    } })
  })
}

async function getAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('OAuth failed: ' + (data.error_description || data.error))
  return data.access_token
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

async function buildKpi({ client, CUSTOMER_ID, callOptions, range }) {
  const query = `SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`
  const [resp] = await client.search({ customer_id: CUSTOMER_ID, query }, callOptions)
  const totals = zeroBucket()
  const dailyMap = new Map()
  for (const row of (resp || [])) {
    const date = row?.segments?.date
    accumulate(totals, row)
    if (date) {
      if (!dailyMap.has(date)) dailyMap.set(date, zeroBucket(date))
      accumulate(dailyMap.get(date), row)
    }
  }
  finalize(totals)
  const daily = Array.from(dailyMap.values())
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map(b => { finalize(b); return b })
  return { totals, daily }
}

async function buildTotalsOnly({ client, CUSTOMER_ID, callOptions, range }) {
  const query = `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`
  const [resp] = await client.search({ customer_id: CUSTOMER_ID, query }, callOptions)
  const totals = zeroBucket()
  for (const row of (resp || [])) accumulate(totals, row)
  finalize(totals)
  return totals
}

function zeroBucket(date = null) {
  return {
    date,
    spend: 0, convValue: 0, conversions: 0, impressions: 0, clicks: 0,
    roas: 0, cpa: null, cpm: 0, ctr: 0, cpc: null, convRate: 0,
  }
}

function accumulate(b, row) {
  const M = row.metrics || {}
  b.spend       += num(M.cost_micros ?? M.costMicros) / 1_000_000
  b.convValue   += num(M.conversions_value ?? M.conversionsValue)
  b.conversions += num(M.conversions)
  b.impressions += num(M.impressions)
  b.clicks      += num(M.clicks)
}

function finalize(b) {
  b.roas     = b.spend > 0 ? +(b.convValue / b.spend).toFixed(2) : 0
  b.cpa      = b.conversions > 0 ? +(b.spend / b.conversions).toFixed(2) : null
  b.cpm      = b.impressions > 0 ? +((b.spend / b.impressions) * 1000).toFixed(2) : 0
  b.ctr      = b.impressions > 0 ? +((b.clicks / b.impressions) * 100).toFixed(2) : 0
  b.cpc      = b.clicks > 0 ? +(b.spend / b.clicks).toFixed(2) : null
  b.convRate = b.clicks > 0 ? +((b.conversions / b.clicks) * 100).toFixed(2) : 0
  b.spend       = +b.spend.toFixed(2)
  b.convValue   = +b.convValue.toFixed(2)
  b.conversions = +b.conversions.toFixed(2)
  b.impressions = Math.round(b.impressions)
  b.clicks      = Math.round(b.clicks)
}
