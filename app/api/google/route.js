// app/api/google/route.js
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Google Ads non ancora configurato — restituisce dati vuoti senza errore
  const hasConfig = process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
                    process.env.GOOGLE_ADS_CUSTOMER_ID &&
                    process.env.GOOGLE_REFRESH_TOKEN

  if (!hasConfig) {
    return NextResponse.json({
      totalSpend: 0,
      monthly:    [],
      currency:   'EUR',
      configured: false,
      updatedAt:  new Date().toISOString(),
    })
  }

  try {
    const { subDays, format } = await import('date-fns')
    const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    const GOOGLE_ADS_CUSTOMER_ID     = process.env.GOOGLE_ADS_CUSTOMER_ID
    const GOOGLE_REFRESH_TOKEN       = process.env.GOOGLE_REFRESH_TOKEN
    const GOOGLE_CLIENT_ID           = process.env.GOOGLE_CLIENT_ID
    const GOOGLE_CLIENT_SECRET       = process.env.GOOGLE_CLIENT_SECRET

    // OAuth token refresh
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type:    'refresh_token',
      })
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) throw new Error('Google OAuth fallito: ' + JSON.stringify(tokenData))

    const since = format(subDays(new Date(), 365), 'yyyy-MM-dd')
    const until = format(new Date(), 'yyyy-MM-dd')
    const query = `
      SELECT segments.month, metrics.cost_micros, metrics.impressions, metrics.clicks
      FROM campaign
      WHERE segments.date BETWEEN '${since}' AND '${until}'
        AND campaign.status = 'ENABLED'
      ORDER BY segments.month
    `

    const res = await fetch(
      `https://googleads.googleapis.com/v16/customers/${GOOGLE_ADS_CUSTOMER_ID}/googleAds:searchStream`,
      {
        method:  'POST',
        headers: {
          'Authorization':   `Bearer ${tokenData.access_token}`,
          'developer-token': GOOGLE_ADS_DEVELOPER_TOKEN,
          'Content-Type':    'application/json',
        },
        body: JSON.stringify({ query }),
      }
    )

    const rows = await res.json()
    const monthlyMap = {}
    for (const batch of (Array.isArray(rows) ? rows : [rows])) {
      for (const row of (batch.results || [])) {
        const month = row.segments?.month?.slice(0,7)
        if (!month) continue
        if (!monthlyMap[month]) monthlyMap[month] = { spend: 0 }
        monthlyMap[month].spend += (row.metrics?.costMicros || 0) / 1_000_000
      }
    }

    const monthly = Object.entries(monthlyMap)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([month, d]) => ({ month, spend: Math.round(d.spend * 100) / 100 }))

    const totalSpend = monthly.reduce((s, m) => s + m.spend, 0)
    return NextResponse.json({ totalSpend: Math.round(totalSpend * 100) / 100, monthly, configured: true, updatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('Google Ads error:', err.message)
    return NextResponse.json({ error: err.message, totalSpend: 0, monthly: [] }, { status: 500 })
  }
}
