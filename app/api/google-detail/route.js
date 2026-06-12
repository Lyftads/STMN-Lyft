export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getGoogle } from '../../../lib/tenant/credentials'
import { getRange } from '../../../lib/metaRange'

// ============================================================================
//  Google Detail — gerarchia drill-down Google Ads (gemella di /api/meta-detail).
//   level=campaigns                      → campagne
//   level=adgroups & campaign_id=X       → gruppi annunci della campagna
//   level=ads & adgroup_id=X             → annunci del gruppo
//  Multi-tenant: credenziali Google del tenant via getGoogle().
//  GET ?preset=last_28d&level=campaigns
// ============================================================================

const num = (v) => (v == null ? 0 : (typeof v === 'object' ? Number(v.toString()) : Number(v)) || 0)

const STATUS = { 2: 'ENABLED', 3: 'PAUSED', 4: 'REMOVED' }
const statusLabel = (s) => (typeof s === 'number' ? (STATUS[s] || String(s)) : String(s || ''))

export async function GET(req) {
  return withTenantContext(req, async () => {
    const g = getGoogle()
    const CLIENT_ID = g.clientId, CLIENT_SECRET = g.clientSecret, REFRESH_TOKEN = g.refreshToken
    const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    const CUSTOMER_ID = (g.adsCustomerId || '').replace(/-/g, '')
    const MCC_ID = (g.adsMccId || '').replace(/-/g, '')

    if (!DEVELOPER_TOKEN || !CUSTOMER_ID || !REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
      return NextResponse.json({ ok: false, configured: false, rows: [], summary: zeroSummary() })
    }

    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('preset') || 'last_28d'
    const level = searchParams.get('level') || 'campaigns'
    const campaignId = searchParams.get('campaign_id')
    const adgroupId = searchParams.get('adgroup_id')
    const range = getRange(preset, searchParams)
    const prevRange = previousRange(range)

    try {
      const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)
      const { GoogleAdsServiceClient } = await import('google-ads-node')
      const grpc = await import('@grpc/grpc-js')
      const client = new GoogleAdsServiceClient({ sslCreds: grpc.credentials.createSsl(), servicePath: 'googleads.googleapis.com', port: 443 })
      const callOptions = { otherArgs: { headers: { 'authorization': `Bearer ${accessToken}`, 'developer-token': DEVELOPER_TOKEN, ...(MCC_ID ? { 'login-customer-id': MCC_ID } : {}) } } }
      const search = async (query) => {
        const [resp] = await client.search({ customer_id: CUSTOMER_ID, query }, callOptions)
        return resp || []
      }

      const METRICS = 'metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value'
      let rows = []

      if (level === 'campaigns') {
        const resp = await search(`SELECT campaign.id, campaign.name, campaign.status, ${METRICS} FROM campaign WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`)
        rows = resp.map(r => buildRow({
          id: String(r.campaign?.id), level: 'campaign', name: r.campaign?.name || `Campagna ${r.campaign?.id}`,
          status: statusLabel(r.campaign?.status), has_children: true,
        }, r.metrics))
      } else if (level === 'adgroups') {
        if (!campaignId) return NextResponse.json({ ok: false, error: 'campaign_id mancante' }, { status: 400 })
        const resp = await search(`SELECT ad_group.id, ad_group.name, ad_group.status, ${METRICS} FROM ad_group WHERE campaign.id = ${campaignId} AND segments.date BETWEEN '${range.since}' AND '${range.until}'`)
        rows = resp.map(r => buildRow({
          id: String(r.adGroup?.id ?? r.ad_group?.id), level: 'adgroup', name: (r.adGroup ?? r.ad_group)?.name || `Gruppo ${(r.adGroup ?? r.ad_group)?.id}`,
          status: statusLabel((r.adGroup ?? r.ad_group)?.status), campaign_id: campaignId, has_children: true,
        }, r.metrics))
      } else if (level === 'ads') {
        if (!adgroupId) return NextResponse.json({ ok: false, error: 'adgroup_id mancante' }, { status: 400 })
        const resp = await search(`SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.status, ${METRICS} FROM ad_group_ad WHERE ad_group.id = ${adgroupId} AND segments.date BETWEEN '${range.since}' AND '${range.until}'`)
        rows = resp.map(r => {
          const ad = (r.adGroupAd ?? r.ad_group_ad)?.ad || {}
          return buildRow({
            id: String(ad.id), level: 'ad', name: ad.name || `${prettyType(ad.type)} ${ad.id}`,
            status: statusLabel((r.adGroupAd ?? r.ad_group_ad)?.status), adgroup_id: adgroupId, has_children: false,
          }, r.metrics)
        })
      } else {
        return NextResponse.json({ ok: false, error: `level non valido: ${level}` }, { status: 400 })
      }

      rows.sort((a, b) => b.spend - a.spend)
      const summary = sumRows(rows)

      let previousSummary = zeroSummary()
      let dailySeries = []
      if (level === 'campaigns') {
        const [prevResp, dailyResp] = await Promise.all([
          search(`SELECT ${METRICS} FROM campaign WHERE segments.date BETWEEN '${prevRange.since}' AND '${prevRange.until}'`).catch(() => []),
          search(`SELECT segments.date, ${METRICS} FROM campaign WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`).catch(() => []),
        ])
        previousSummary = sumRows(prevResp.map(r => buildRow({}, r.metrics)))
        const dayMap = new Map()
        for (const r of dailyResp) {
          const d = r.segments?.date; if (!d) continue
          const cur = dayMap.get(d) || { date: d, spend: 0, conversions: 0, convValue: 0 }
          cur.spend += num(r.metrics?.cost_micros ?? r.metrics?.costMicros) / 1e6
          cur.conversions += num(r.metrics?.conversions)
          cur.convValue += num(r.metrics?.conversions_value ?? r.metrics?.conversionsValue)
          dayMap.set(d, cur)
        }
        dailySeries = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))
          .map(d => ({ ...d, spend: +d.spend.toFixed(2), roas: d.spend > 0 ? +(d.convValue / d.spend).toFixed(2) : 0 }))
      }

      return NextResponse.json({
        ok: true, configured: true, preset, level, range, prevRange,
        rows, summary, previousSummary, dailySeries, updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      return NextResponse.json({ ok: false, configured: true, error: String(err?.message || err), rows: [], summary: zeroSummary() }, { status: 200 })
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

function prettyType(t) {
  const s = String(t || '').toUpperCase()
  if (s.includes('RESPONSIVE_SEARCH')) return 'RSA'
  if (s.includes('SEARCH')) return 'Search'
  if (s.includes('SHOPPING')) return 'Shopping'
  if (s.includes('VIDEO')) return 'Video'
  if (s.includes('DISPLAY') || s.includes('RESPONSIVE_DISPLAY')) return 'Display'
  if (s.includes('PERFORMANCE_MAX') || s.includes('PMAX')) return 'PMax'
  return 'Annuncio'
}

function buildRow(base, M = {}) {
  const spend = num(M.cost_micros ?? M.costMicros) / 1e6
  const impressions = num(M.impressions)
  const clicks = num(M.clicks)
  const conversions = num(M.conversions)
  const convValue = num(M.conversions_value ?? M.conversionsValue)
  return {
    ...base,
    spend: +spend.toFixed(2),
    impressions, clicks,
    conversions: +conversions.toFixed(2),
    convValue: +convValue.toFixed(2),
    roas: spend > 0 ? +(convValue / spend).toFixed(2) : 0,
    cpa: conversions > 0 ? +(spend / conversions).toFixed(2) : 0,
    ctr: impressions > 0 ? +((clicks / impressions) * 100).toFixed(2) : 0,
    cpc: clicks > 0 ? +(spend / clicks).toFixed(2) : 0,
    convRate: clicks > 0 ? +((conversions / clicks) * 100).toFixed(2) : 0,
  }
}

function zeroSummary() {
  return { spend: 0, impressions: 0, clicks: 0, conversions: 0, convValue: 0, roas: 0, cpa: 0, ctr: 0, cpc: 0, convRate: 0 }
}

function sumRows(rows) {
  const s = zeroSummary()
  for (const r of rows) {
    s.spend += r.spend; s.impressions += r.impressions; s.clicks += r.clicks
    s.conversions += r.conversions; s.convValue += r.convValue
  }
  s.spend = +s.spend.toFixed(2); s.convValue = +s.convValue.toFixed(2); s.conversions = +s.conversions.toFixed(2)
  s.roas = s.spend > 0 ? +(s.convValue / s.spend).toFixed(2) : 0
  s.cpa = s.conversions > 0 ? +(s.spend / s.conversions).toFixed(2) : 0
  s.ctr = s.impressions > 0 ? +((s.clicks / s.impressions) * 100).toFixed(2) : 0
  s.cpc = s.clicks > 0 ? +(s.spend / s.clicks).toFixed(2) : 0
  s.convRate = s.clicks > 0 ? +((s.conversions / s.clicks) * 100).toFixed(2) : 0
  return s
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
