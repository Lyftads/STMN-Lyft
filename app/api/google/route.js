import { NextResponse } from 'next/server'
import { GoogleAdsApi } from 'google-ads-api'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
  const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const CUSTOMER_ID = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '')
  const MCC_ID = (process.env.GOOGLE_ADS_MCC_ID || '').replace(/-/g, '')
  const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN

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
    const client = new GoogleAdsApi({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      developer_token: DEVELOPER_TOKEN,
    })

    const customer = client.Customer({
      customer_id: CUSTOMER_ID,
      login_customer_id: MCC_ID || undefined,
      refresh_token: REFRESH_TOKEN,
    })

    const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
    const until = new Date().toISOString().slice(0, 10)

    const rows = await customer.query(`
      SELECT
        segments.month,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${since}' AND '${until}'
        AND campaign.status = 'ENABLED'
    `)

    const monthlyMap = {}
    for (const row of rows) {
      const month = row.segments?.month?.slice(0, 7)
      if (!month) continue
      if (!monthlyMap[month]) monthlyMap[month] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, convValue: 0 }
      monthlyMap[month].spend += (Number(row.metrics?.cost_micros) || 0) / 1_000_000
      monthlyMap[month].impressions += Number(row.metrics?.impressions) || 0
      monthlyMap[month].clicks += Number(row.metrics?.clicks) || 0
      monthlyMap[month].conversions += Number(row.metrics?.conversions) || 0
      monthlyMap[month].convValue += Number(row.metrics?.conversions_value) || 0
    }

    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month,
        spend: Math.round(d.spend * 100) / 100,
        impressions: d.impressions,
        clicks: d.clicks,
        conversions: Math.round(d.conversions * 100) / 100,
        convValue: Math.round(d.convValue * 100) / 100,
      }))

    const totalSpend = monthly.reduce((s, m) => s + m.spend, 0)

    return NextResponse.json({
      totalSpend: Math.round(totalSpend * 100) / 100,
      monthly,
      configured: true,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err?.message || String(err)

    // Extract the real Google Ads error from the gRPC failure
    const failures = err?.failures || err?.errors || []
    const gadsErrors = []
    try {
      for (const f of (Array.isArray(failures) ? failures : [])) {
        for (const e of (f?.errors || [])) {
          gadsErrors.push({
            message: e?.message,
            errorCode: e?.errorCode,
          })
        }
      }
    } catch {}

    // Also check metadata/details in the gRPC error
    const details = err?.metadata?.getMap?.() || err?.details || null
    const code = err?.code || null

    const combined = gadsErrors.length
      ? gadsErrors.map(e => e.message).join('; ')
      : msg

    let hint = null
    if (combined.includes('DEVELOPER_TOKEN') || combined.includes('developer_token'))
      hint = 'Il Developer Token è in stato "Test Account" — può accedere solo a test account, non a account reali. Devi richiedere "Basic Access" dal pannello API Center del tuo MCC.'
    else if (combined.includes('PERMISSION_DENIED') || code === 7)
      hint = 'L\'MCC non ha accesso a questo account Ads. Verifica che il link tra MCC (1825952409) e account (5152245976) sia stato accettato.'
    else if (combined.includes('CUSTOMER_NOT_FOUND') || combined.includes('customer_not_found'))
      hint = 'Customer ID non trovato. Verifica il numero.'
    else if (combined.includes('invalid_grant'))
      hint = 'Refresh Token scaduto. Rigeneralo da OAuth Playground.'
    else if (combined.includes('UNAUTHENTICATED') || code === 16)
      hint = 'Autenticazione fallita. Verifica Developer Token e Refresh Token.'
    else if (combined.includes('NOT_ADS_USER'))
      hint = 'L\'account Google usato per il Refresh Token non ha accesso a Google Ads.'

    return NextResponse.json({
      error: combined,
      gadsErrors: gadsErrors.length ? gadsErrors : undefined,
      grpcCode: code,
      hint,
      totalSpend: 0,
      monthly: [],
    }, { status: 502 })
  }
}
