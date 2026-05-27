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

    // Diagnostic: try 3 different approaches to find one that works
    const ver = 'v17'
    const diag = []

    // Test 1: standard URL with client account ID
    const url1 = `https://googleads.googleapis.com/${ver}/customers/${cleanCustomerId}/googleAds:search`
    const r1 = await fetch(url1, { method: 'POST', headers, body: JSON.stringify({ query }) })
    const t1 = await r1.text()
    diag.push({ test: 'client_id_in_url', status: r1.status, body: t1.slice(0, 200) })

    if (r1.status !== 404) {
      // This worked — continue with normal flow
      var adsText = t1
      var adsStatus = r1.status
    } else {
      // Test 2: use MCC ID in URL instead of client ID
      const url2 = `https://googleads.googleapis.com/${ver}/customers/${cleanMccId}/googleAds:search`
      const r2 = await fetch(url2, { method: 'POST', headers, body: JSON.stringify({ query }) })
      const t2 = await r2.text()
      diag.push({ test: 'mcc_id_in_url', status: r2.status, body: t2.slice(0, 200) })

      if (r2.status !== 404) {
        var adsText = t2
        var adsStatus = r2.status
      } else {
        // Test 3: no developer-token (to see if error changes)
        const headersNoDev = { ...headers }
        delete headersNoDev['developer-token']
        delete headersNoDev['login-customer-id']
        const r3 = await fetch(url1, { method: 'POST', headers: headersNoDev, body: JSON.stringify({ query }) })
        const t3 = await r3.text()
        diag.push({ test: 'no_dev_token', status: r3.status, body: t3.slice(0, 200) })

        // Test 4: simple GET to check if domain is reachable at all
        const r4 = await fetch(`https://googleads.googleapis.com/${ver}/customers/${cleanCustomerId}`, {
          headers: { 'Authorization': headers['Authorization'], 'developer-token': headers['developer-token'] },
        })
        diag.push({ test: 'simple_get', status: r4.status, body: (await r4.text()).slice(0, 200) })

        return NextResponse.json({
          error: 'All approaches failed',
          diagnostic: diag,
          debug: { customerId: cleanCustomerId, mccId: cleanMccId, ver },
          totalSpend: 0,
          monthly: [],
        }, { status: 502 })
      }
    }

    let rows
    try {
      rows = JSON.parse(adsText)
    } catch {
      return NextResponse.json({
        error: 'Google Ads API returned non-JSON',
        status: adsStatus,
        hint: adsText.slice(0, 300),
        debug: { customerId: cleanCustomerId, mccId: cleanMccId || '(not set)' },
        totalSpend: 0,
        monthly: [],
      }, { status: 502 })
    }

    if (rows.error) {
      return NextResponse.json({
        error: `Google Ads API: ${rows.error.message}`,
        code: rows.error.code,
        googleStatus: rows.error.status,
        hint: rows.error.code === 403
          ? 'Developer Token senza accesso. Aggiungi GOOGLE_ADS_MCC_ID con il Customer ID del MCC.'
          : rows.error.code === 401
          ? 'Token scaduto o revocato. Rigenera GOOGLE_REFRESH_TOKEN.'
          : null,
        details: rows.error.details?.slice(0, 3),
        totalSpend: 0,
        monthly: [],
      }, { status: 502 })
    }

    // Parse results
    const resultRows = Array.isArray(rows) ? rows : [rows]
    const monthlyMap = {}
    for (const batch of resultRows) {
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
