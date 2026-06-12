export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { withTenantContext, getGoogle } from '../../../../lib/tenant/credentials'

// ============================================================================
//  Google Ads — lista gli account accessibili dall'utente loggato (per il
//  selettore in onboarding/integrazioni). Usa la OAuth del tenant (scope
//  `adwords`) + il Developer Token condiviso. Per i clienti self-serve si
//  interroga l'account direttamente (niente login-customer-id).
//  GET → { accounts: [{ id, name }] } | { notConnected:true } | { error }
// ============================================================================

async function getAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(10_000),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('OAuth failed')
  return data.access_token
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const g = getGoogle()
    const CLIENT_ID = g.clientId, CLIENT_SECRET = g.clientSecret, REFRESH = g.refreshToken
    const DEV = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    if (!REFRESH || !CLIENT_ID || !CLIENT_SECRET) {
      return NextResponse.json({ error: 'Google non connesso', notConnected: true }, { status: 400 })
    }
    if (!DEV) return NextResponse.json({ error: 'Developer Token non configurato', accounts: [] })

    let accessToken
    try { accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET, REFRESH) }
    catch { return NextResponse.json({ error: 'Token Google scaduto, riconnetti' }, { status: 401 }) }

    try {
      const { CustomerServiceClient, GoogleAdsServiceClient } = await import('google-ads-node')
      const grpc = await import('@grpc/grpc-js')
      const ssl = grpc.credentials.createSsl()
      const headers = { authorization: `Bearer ${accessToken}`, 'developer-token': DEV }

      const custClient = new CustomerServiceClient({ sslCreds: ssl, servicePath: 'googleads.googleapis.com', port: 443 })
      const [resp] = await custClient.listAccessibleCustomers({}, { otherArgs: { headers } })
      const ids = (resp?.resourceNames || []).map(rn => String(rn).split('/').pop()).filter(Boolean)
      if (!ids.length) return NextResponse.json({ accounts: [] })

      // Nome descrittivo best-effort (parallelo, cap 15); fallback all'ID.
      const gads = new GoogleAdsServiceClient({ sslCreds: ssl, servicePath: 'googleads.googleapis.com', port: 443 })
      const accounts = await Promise.all(ids.slice(0, 15).map(async (id) => {
        let name = null
        try {
          const [rows] = await gads.search(
            { customer_id: id, query: 'SELECT customer.descriptive_name FROM customer LIMIT 1' },
            { otherArgs: { headers } },
          )
          name = rows?.[0]?.customer?.descriptiveName || rows?.[0]?.customer?.descriptive_name || null
        } catch {}
        return { id, name: name || `Account ${id}` }
      }))
      return NextResponse.json({ accounts })
    } catch (e) {
      return NextResponse.json({ error: String(e?.message || e).slice(0, 200), accounts: [] }, { status: 502 })
    }
  })
}
