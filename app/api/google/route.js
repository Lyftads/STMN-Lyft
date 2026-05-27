import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID
  const MCC_ID = process.env.GOOGLE_ADS_MCC_ID || ''
  const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

  if (!DEVELOPER_TOKEN || !CUSTOMER_ID || !REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({
      totalSpend: 0,
      monthly: [],
      configured: false,
      missing: [
        !DEVELOPER_TOKEN && 'GOOGLE_ADS_DEVELOPER_TOKEN',
        !CUSTOMER_ID && 'GOOGLE_ADS_CUSTOMER_ID',
        !REFRESH_TOKEN && 'GOOGLE_REFRESH_TOKEN',
        !CLIENT_ID && 'GOOGLE_CLIENT_ID',
        !CLIENT_SECRET && 'GOOGLE_CLIENT_SECRET',
      ].filter(Boolean),
      updatedAt: new Date().toISOString(),
    })
  }

  try {
    // Step 1: OAuth token refresh
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    })

    const tokenText = await tokenRes.text()
    let tokenData
    try {
      tokenData = JSON.parse(tokenText)
    } catch {
      return NextResponse.json({
        error: 'OAuth token refresh returned non-JSON',
        hint: 'Verifica GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET. Il body ricevuto inizia con: ' + tokenText.slice(0, 200),
        totalSpend: 0,
        monthly: [],
      }, { status: 502 })
    }

    if (!tokenData.access_token) {
      return NextResponse.json({
        error: 'OAuth fallito: ' + (tokenData.error_description || tokenData.error || 'nessun access_token'),
        hint: tokenData.error === 'invalid_grant'
          ? 'Il Refresh Token è scaduto o revocato. Rigeneralo da OAuth Playground.'
          : 'Controlla Client ID, Client Secret e Refresh Token.',
        totalSpend: 0,
        monthly: [],
      }, { status: 401 })
    }

    // Step 2: Google Ads API query
    const { format } = await import('date-fns')
    const since = format(new Date(Date.now() - 365 * 86400000), 'yyyy-MM-dd')
    const until = format(new Date(), 'yyyy-MM-dd')

    const query = `
      SELECT segments.month, metrics.cost_micros, metrics.impressions, metrics.clicks
      FROM campaign
      WHERE segments.date BETWEEN '${since}' AND '${until}'
        AND campaign.status = 'ENABLED'
      ORDER BY segments.month
    `

    const cleanCustomerId = CUSTOMER_ID.replace(/-/g, '')
    const cleanMccId = MCC_ID.replace(/-/g, '')

    const headers = {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'developer-token': DEVELOPER_TOKEN,
      'Content-Type': 'application/json',
    }
    if (cleanMccId) {
      headers['login-customer-id'] = cleanMccId
    }

    const adsRes = await fetch(
      `https://googleads.googleapis.com/v17/customers/${cleanCustomerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
      }
    )

    const adsText = await adsRes.text()
    let rows
    try {
      rows = JSON.parse(adsText)
    } catch {
      return NextResponse.json({
        error: 'Google Ads API returned non-JSON',
        status: adsRes.status,
        hint: adsText.slice(0, 300),
        totalSpend: 0,
        monthly: [],
      }, { status: 502 })
    }

    if (rows.error) {
      return NextResponse.json({
        error: `Google Ads API error: ${rows.error.message}`,
        code: rows.error.code,
        status: rows.error.status,
        hint: rows.error.code === 403
          ? 'Il Developer Token potrebbe non avere accesso. Se è un test token, aggiungi GOOGLE_ADS_MCC_ID col Customer ID del tuo MCC.'
          : null,
        totalSpend: 0,
        monthly: [],
      }, { status: 502 })
    }

    // Parse results
    const monthlyMap = {}
    for (const batch of (Array.isArray(rows) ? rows : [rows])) {
      for (const row of (batch.results || [])) {
        const month = row.segments?.month?.slice(0, 7)
        if (!month) continue
        if (!monthlyMap[month]) monthlyMap[month] = { spend: 0, impressions: 0, clicks: 0 }
        monthlyMap[month].spend += (row.metrics?.costMicros || 0) / 1_000_000
        monthlyMap[month].impressions += Number(row.metrics?.impressions || 0)
        monthlyMap[month].clicks += Number(row.metrics?.clicks || 0)
      }
    }

    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month,
        spend: Math.round(d.spend * 100) / 100,
        impressions: d.impressions,
        clicks: d.clicks,
      }))

    const totalSpend = monthly.reduce((s, m) => s + m.spend, 0)

    return NextResponse.json({
      totalSpend: Math.round(totalSpend * 100) / 100,
      monthly,
      configured: true,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({
      error: err.message,
      totalSpend: 0,
      monthly: [],
    }, { status: 500 })
  }
}
