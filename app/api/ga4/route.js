export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { withTenantContext, getGoogle } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'

// Tenant-aware: Google OAuth creds + GA4 property id risolti per-request
async function getAccessToken() {
  const g = getGoogle()
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: g.clientId || '',
      client_secret: g.clientSecret || '',
      refresh_token: g.refreshToken || '',
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  return data.access_token || null
}

async function runReport(token, propertyId, body) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) return null
  return res.json()
}

export async function GET(request) {
  return withTenantContext(request, async () => {
  const g = getGoogle()
  const propertyId = g.ga4PropertyId
  const hasConfig = propertyId && g.clientId && g.refreshToken

  if (!hasConfig) {
    return NextResponse.json({ configured: false })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30', 10)

  return swrSnapshot(request, { tab: 'ga4', compute: async () => {
  try {
    const token = await getAccessToken()
    if (!token) throw new Error('Google OAuth failed')

    const dateRange = { startDate: `${days}daysAgo`, endDate: 'today' }

    const [overview, channels, pages, geo] = await Promise.all([
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'conversions' },
          { name: 'totalRevenue' },
        ],
      }),
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'conversions' },
          { name: 'totalRevenue' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      }),
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
    ])

    const parseRow = (row, dims, mets) => {
      const obj = {}
      dims?.forEach((d, i) => { obj[d.name] = row.dimensionValues?.[i]?.value })
      mets?.forEach((m, i) => { obj[m.name] = parseFloat(row.metricValues?.[i]?.value || '0') })
      return obj
    }

    const ov = overview?.rows?.[0]
    const ovMetrics = overview?.metricHeaders || []

    const summaryObj = {}
    ovMetrics.forEach((m, i) => {
      summaryObj[m.name] = parseFloat(ov?.metricValues?.[i]?.value || '0')
    })

    const channelRows = (channels?.rows || []).map(r =>
      parseRow(r, channels.dimensionHeaders, channels.metricHeaders)
    )
    const pageRows = (pages?.rows || []).map(r =>
      parseRow(r, pages.dimensionHeaders, pages.metricHeaders)
    )
    const geoRows = (geo?.rows || []).map(r =>
      parseRow(r, geo.dimensionHeaders, geo.metricHeaders)
    )

    return {
      configured: true,
      summary: summaryObj,
      channels: channelRows,
      topPages: pageRows,
      topCountries: geoRows,
      updatedAt: new Date().toISOString(),
    }
  } catch (e) {
    return { __noCache: true, configured: false, error: e.message }
  }
  } })
  })
}
