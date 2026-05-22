// app/api/google/route.js
// Pulls ad spend from Google Ads API via reports
import { NextResponse } from 'next/server'
import { subDays, format } from 'date-fns'

const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
const GOOGLE_ADS_CUSTOMER_ID     = process.env.GOOGLE_ADS_CUSTOMER_ID   // senza trattini: 1234567890
const GOOGLE_REFRESH_TOKEN       = process.env.GOOGLE_REFRESH_TOKEN
const GOOGLE_CLIENT_ID           = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET       = process.env.GOOGLE_CLIENT_SECRET

// Ottieni access token da refresh token
async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    })
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Google OAuth fallito: ' + JSON.stringify(data))
  return data.access_token
}

export async function GET() {
  try {
    const accessToken = await getAccessToken()
    const since = format(subDays(new Date(), 365), 'yyyy-MM-dd')
    const until = format(new Date(), 'yyyy-MM-dd')

    // Google Ads Query Language (GAQL)
    const query = `
      SELECT
        segments.month,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.average_cpc
      FROM campaign
      WHERE segments.date BETWEEN '${since}' AND '${until}'
        AND campaign.status = 'ENABLED'
      ORDER BY segments.month
    `

    const res = await fetch(
      `https://googleads.googleapis.com/v16/customers/${GOOGLE_ADS_CUSTOMER_ID}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Authorization':           `Bearer ${accessToken}`,
          'developer-token':         GOOGLE_ADS_DEVELOPER_TOKEN,
          'Content-Type':            'application/json',
        },
        body: JSON.stringify({ query }),
        next: { revalidate: 3600 }
      }
    )

    const rows = await res.json()
    if (!res.ok) throw new Error(JSON.stringify(rows))

    // Aggrega per mese
    const monthlyMap = {}
    for (const batch of (Array.isArray(rows) ? rows : [rows])) {
      for (const row of (batch.results || [])) {
        const month = row.segments?.month?.slice(0,7)
        if (!month) continue
        if (!monthlyMap[month]) monthlyMap[month] = { spend: 0, impressions: 0, clicks: 0 }
        monthlyMap[month].spend       += (row.metrics?.costMicros || 0) / 1_000_000
        monthlyMap[month].impressions += parseInt(row.metrics?.impressions || 0)
        monthlyMap[month].clicks      += parseInt(row.metrics?.clicks || 0)
      }
    }

    const monthly = Object.entries(monthlyMap)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month,
        spend:       Math.round(d.spend * 100) / 100,
        impressions: d.impressions,
        clicks:      d.clicks,
      }))

    const totalSpend = monthly.reduce((s, m) => s + m.spend, 0)

    return NextResponse.json({
      totalSpend:  Math.round(totalSpend * 100) / 100,
      monthly,
      currency:    'EUR',
      updatedAt:   new Date().toISOString(),
    })
  } catch (err) {
    console.error('Google Ads error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
