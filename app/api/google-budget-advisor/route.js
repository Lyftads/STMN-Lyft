export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getGoogle } from '../../../lib/tenant/credentials'
import { getRange } from '../../../lib/metaRange'

// ============================================================================
//  Google Budget Advisor — consiglia riallocazione budget tra campagne Google.
//  Stessa logica di /api/budget-advisor (Meta): scala le campagne efficienti
//  (ROAS alto vs MER account), riduci/taglia quelle sotto soglia, e stima la
//  revenue incrementale spostando il budget liberato. Multi-tenant (getGoogle).
//  GET ?preset=last_28d
// ============================================================================

const num = (v) => (v == null ? 0 : (typeof v === 'object' ? Number(v.toString()) : Number(v)) || 0)
const mkDelta = (cur, prev) => ({ pct: prev > 0 ? +(((cur - prev) / prev) * 100).toFixed(1) : null })

export async function GET(req) {
  return withTenantContext(req, async () => {
    const g = getGoogle()
    const CLIENT_ID = g.clientId, CLIENT_SECRET = g.clientSecret, REFRESH_TOKEN = g.refreshToken
    const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    const CUSTOMER_ID = (g.adsCustomerId || '').replace(/-/g, '')
    const MCC_ID = (g.adsMccId || '').replace(/-/g, '')

    if (!DEVELOPER_TOKEN || !CUSTOMER_ID || !REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
      return NextResponse.json({ configured: false, campaigns: [] })
    }

    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('preset') || 'last_28d'
    const range = getRange(preset, searchParams)
    const prevRange = previousRange(range)

    try {
      const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)
      const { GoogleAdsServiceClient } = await import('google-ads-node')
      const grpc = await import('@grpc/grpc-js')
      const client = new GoogleAdsServiceClient({ sslCreds: grpc.credentials.createSsl(), servicePath: 'googleads.googleapis.com', port: 443 })
      const callOptions = { otherArgs: { headers: { 'authorization': `Bearer ${accessToken}`, 'developer-token': DEVELOPER_TOKEN, ...(MCC_ID ? { 'login-customer-id': MCC_ID } : {}) } } }
      const search = async (q) => { const [r] = await client.search({ customer_id: CUSTOMER_ID, query: q }, callOptions); return r || [] }
      const M = 'metrics.cost_micros, metrics.conversions, metrics.conversions_value'

      const [resp, prevResp] = await Promise.all([
        search(`SELECT campaign.id, campaign.name, ${M} FROM campaign WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`),
        search(`SELECT ${M} FROM campaign WHERE segments.date BETWEEN '${prevRange.since}' AND '${prevRange.until}'`).catch(() => []),
      ])

      const campaigns = resp.map(r => {
        const spend = num(r.metrics?.cost_micros ?? r.metrics?.costMicros) / 1e6
        const revenue = num(r.metrics?.conversions_value ?? r.metrics?.conversionsValue)
        const conversions = num(r.metrics?.conversions)
        const roas = spend > 0 ? revenue / spend : 0
        return {
          id: String(r.campaign?.id), name: r.campaign?.name || `Campagna ${r.campaign?.id}`,
          spend: +spend.toFixed(2), revenue: +revenue.toFixed(2),
          roas: +roas.toFixed(2), cpa: conversions > 0 ? +(spend / conversions).toFixed(2) : null,
        }
      }).filter(c => c.spend > 0)

      const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
      const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0)
      const mer = totalSpend > 0 ? totalRevenue / totalSpend : 0

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
      campaigns.sort((a, b) => b.spend - a.spend)

      const freed = campaigns.filter(c => c.deltaPct < 0).reduce((s, c) => s + (c.spend - c.suggestedSpend), 0)
      const scaleCamps = campaigns.filter(c => c.action === 'scala')
      const scaleSpend = scaleCamps.reduce((s, c) => s + c.spend, 0)
      const avgScaleRoas = scaleSpend > 0 ? scaleCamps.reduce((s, c) => s + c.roas * c.spend, 0) / scaleSpend : mer
      const cutCamps = campaigns.filter(c => c.deltaPct < 0)
      const cutSpend = cutCamps.reduce((s, c) => s + (c.spend - c.suggestedSpend), 0)
      const avgCutRoas = cutSpend > 0 ? cutCamps.reduce((s, c) => s + c.roas * (c.spend - c.suggestedSpend), 0) / cutSpend : 0
      const forecastDelta = Math.round(freed * (avgScaleRoas - avgCutRoas))

      const prevSpend = prevResp.reduce((s, r) => s + num(r.metrics?.cost_micros ?? r.metrics?.costMicros) / 1e6, 0)
      const prevRevenue = prevResp.reduce((s, r) => s + num(r.metrics?.conversions_value ?? r.metrics?.conversionsValue), 0)
      const prevMer = prevSpend > 0 ? prevRevenue / prevSpend : 0

      return NextResponse.json({
        configured: true, preset, range, accounts: [], campaigns,
        totalSpend: Math.round(totalSpend * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        mer: Math.round(mer * 100) / 100,
        prev: { totalSpend: Math.round(prevSpend * 100) / 100, totalRevenue: Math.round(prevRevenue * 100) / 100, mer: Math.round(prevMer * 100) / 100 },
        delta: { spend: mkDelta(totalSpend, prevSpend), revenue: mkDelta(totalRevenue, prevRevenue), mer: mkDelta(mer, prevMer) },
        counts: {
          scala: campaigns.filter(c => c.action === 'scala').length,
          riduci: campaigns.filter(c => c.action === 'riduci').length,
          taglia: campaigns.filter(c => c.action === 'taglia').length,
        },
        reallocation: {
          freed: Math.round(freed * 100) / 100,
          avgScaleRoas: Math.round(avgScaleRoas * 100) / 100,
          avgCutRoas: Math.round(avgCutRoas * 100) / 100,
          forecastDelta: forecastDelta > 0 ? forecastDelta : 0,
        },
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      return NextResponse.json({ configured: true, error: err?.message || 'Errore Google', campaigns: [] }, { status: 200 })
    }
  })
}

async function getAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('OAuth failed: ' + (data.error_description || data.error))
  return data.access_token
}

function previousRange({ since, until }) {
  const day = 24 * 60 * 60 * 1000
  const sinceD = new Date(`${since}T00:00:00Z`), untilD = new Date(`${until}T00:00:00Z`)
  const days = Math.floor((untilD - sinceD) / day) + 1
  const prevUntilD = new Date(sinceD.getTime() - day)
  const prevSinceD = new Date(prevUntilD.getTime() - (days - 1) * day)
  const fmt = d => d.toISOString().slice(0, 10)
  return { since: fmt(prevSinceD), until: fmt(prevUntilD) }
}
