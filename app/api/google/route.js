import { NextResponse } from 'next/server'
import { withTenantContext, getGoogle } from '../../../lib/tenant/credentials'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

async function getAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('OAuth failed: ' + (data.error_description || data.error))
  return data.access_token
}

export async function GET(req) {
  return withTenantContext(req, async () => {
  // Tenant-aware: client/secret/refresh_token via getGoogle().
  // I 3 var Google Ads-specifici (developer token, customer id, MCC id)
  // restano env-only finche' non aggiungiamo colonne dedicate al schema.
  const g = getGoogle()
  const CLIENT_ID = g.clientId
  const CLIENT_SECRET = g.clientSecret
  const REFRESH_TOKEN = g.refreshToken
  const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN // app cred condivisa
  const CUSTOMER_ID = (g.adsCustomerId || '').replace(/-/g, '')  // per-tenant (resolver, env-fallback)
  const MCC_ID = (g.adsMccId || '').replace(/-/g, '')

  if (!DEVELOPER_TOKEN || !CUSTOMER_ID || !REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({
      totalSpend: 0, monthly: [], configured: false,
      missing: [
        !DEVELOPER_TOKEN && 'GOOGLE_ADS_DEVELOPER_TOKEN',
        !CUSTOMER_ID && 'GOOGLE_ADS_CUSTOMER_ID',
        !REFRESH_TOKEN && 'GOOGLE_REFRESH_TOKEN',
        !CLIENT_ID && 'GOOGLE_CLIENT_ID',
        !CLIENT_SECRET && 'GOOGLE_CLIENT_SECRET',
      ].filter(Boolean),
    })
  }

  try {
    const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)

    // Debug scope: ?debug=scopes → mostra gli scope effettivi del refresh token
    // in uso (NON espone il token). Serve a capire se manca 'adwords'.
    if (req.nextUrl?.searchParams?.get('debug') === 'scopes') {
      try {
        const ti = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(accessToken)).then(r => r.json())
        const scopes = (ti.scope || '').split(' ').filter(Boolean)
        return NextResponse.json({
          debug: 'scopes',
          email: ti.email || null,
          hasAdwords: scopes.includes('https://www.googleapis.com/auth/adwords'),
          scopes,
          projectNumber: CLIENT_ID ? String(CLIENT_ID).split('-')[0] : null,
          customerId: CUSTOMER_ID ? `***${String(CUSTOMER_ID).slice(-4)}` : null,
          mccSet: !!MCC_ID,
        })
      } catch (e) {
        return NextResponse.json({ debug: 'scopes', error: String(e?.message || e) })
      }
    }

    const { GoogleAdsServiceClient } = await import('google-ads-node')

    const grpc = await import('@grpc/grpc-js')

    const client = new GoogleAdsServiceClient({
      sslCreds: grpc.credentials.createSsl(),
      servicePath: 'googleads.googleapis.com',
      port: 443,
    })

    const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
    const until = new Date().toISOString().slice(0, 10)

    const query = `SELECT segments.month, metrics.cost_micros, metrics.impressions, metrics.clicks FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}'`

    const request = { customer_id: CUSTOMER_ID, query }

    const callOptions = {
      otherArgs: {
        headers: {
          'authorization': `Bearer ${accessToken}`,
          'developer-token': DEVELOPER_TOKEN,
          ...(MCC_ID ? { 'login-customer-id': MCC_ID } : {}),
        },
      },
    }

    const [response] = await client.search(request, callOptions)

    // google-ads-node ritorna i campi in snake_case (cost_micros, conversions_value)
    // e gli int64 grandi (cost_micros) possono arrivare come Long/stringa → num()
    // gestisce number/stringa/Long. Leggiamo sia snake che camel per robustezza.
    const num = (v) => (v == null ? 0 : (typeof v === 'object' ? Number(v.toString()) : Number(v)) || 0)
    const monthlyMap = {}
    for (const row of (response || [])) {
      const month = row?.segments?.month
      if (!month) continue
      const m = month.slice(0, 7)
      const M = row.metrics || {}
      if (!monthlyMap[m]) monthlyMap[m] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, convValue: 0 }
      monthlyMap[m].spend += num(M.cost_micros ?? M.costMicros) / 1_000_000
      monthlyMap[m].impressions += num(M.impressions)
      monthlyMap[m].clicks += num(M.clicks)
      monthlyMap[m].conversions += num(M.conversions)
      monthlyMap[m].convValue += num(M.conversions_value ?? M.conversionsValue)
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
    const msg = err?.message || err?.details || String(err)
    const code = err?.code
    const details = err?.statusDetails || err?.metadata?.internalRepr ? Object.fromEntries([...(err.metadata?.internalRepr?.entries?.() || [])].map(([k,v]) => [k, String(v)])) : null

    let hint = null
    if (code === 7 || msg.includes('PERMISSION_DENIED'))
      hint = 'Developer Token "Test" non può accedere ad account reali. Richiedi Basic Access dal MCC → API Center.'
    else if (code === 16 || msg.includes('UNAUTHENTICATED'))
      hint = 'Token scaduto o Developer Token non valido.'
    else if (msg.includes('CUSTOMER_NOT_FOUND'))
      hint = 'Account Ads non trovato. Verifica il Customer ID.'
    else if (msg.includes('USER_PERMISSION_DENIED'))
      hint = 'L\'account Google non ha accesso a questo account Ads.'
    else if (msg.includes('NOT_ADS_USER'))
      hint = 'L\'account Google usato per OAuth non è un utente Google Ads.'
    else if (msg.includes('DEVELOPER_TOKEN_NOT_APPROVED'))
      hint = 'Il Developer Token è in stato Test. Devi richiedere Basic Access: MCC → Tools → API Center → Apply for Basic Access.'

    return NextResponse.json({
      error: msg,
      grpcCode: code,
      details,
      hint,
      totalSpend: 0,
      monthly: [],
    }, { status: 502 })
  }
  })
}
