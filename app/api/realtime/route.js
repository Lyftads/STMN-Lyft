export const dynamic = 'force-dynamic'
export const maxDuration = 20

import { NextResponse } from 'next/server'
import { withTenantContext, getGoogle } from '../../../lib/tenant/credentials'
import { locateByCountry } from '../../../lib/geo/countryCentroids'

// Live View stile Shopify: utenti attivi (ultimi 30 min) per Paese/città dalla
// GA4 Realtime API. Tenant-aware via getGoogle() come /api/ga4.
async function getAccessToken(g) {
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
  const data = await res.json().catch(() => ({}))
  // Ritorna anche l'errore OAuth (invalid_grant / invalid_client / ...) per diagnosi
  return { token: data.access_token || null, error: data.error || null, desc: data.error_description || null }
}

async function runRealtime(token, propertyId, body) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { ok: res.ok, status: res.status, json, errText: res.ok ? null : text.slice(0, 500) }
}

export async function GET(request) {
  return withTenantContext(request, async () => {
    const g = getGoogle()
    const propertyId = g.ga4PropertyId
    if (!propertyId || !g.clientId || !g.refreshToken) {
      return NextResponse.json({ configured: false })
    }

    const { searchParams } = new URL(request.url)
    const debug = searchParams.get('debug') === '1'

    try {
      const auth = await getAccessToken(g)
      if (!auth.token) {
        // Token refresh fallito: in debug mostra l'errore OAuth esatto
        if (debug) {
          return NextResponse.json({
            configured: true, propertyId,
            oauthError: auth.error, oauthDesc: auth.desc,
            hint: auth.error === 'invalid_grant'
              ? 'Refresh token scaduto/revocato (probabile consent screen in Test mode → scade ogni 7gg). Ricollega Google o pubblica il consent screen.'
              : 'Verifica GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN.',
          })
        }
        throw new Error('Google OAuth failed')
      }
      const token = auth.token

      const res = await runRealtime(token, propertyId, {
        dimensions: [{ name: 'countryId' }, { name: 'country' }, { name: 'city' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 100,
      })

      if (debug) {
        return NextResponse.json({
          configured: true,
          propertyId,
          apiOk: res.ok,
          apiStatus: res.status,
          apiError: res.errText,
          rowCount: res.json?.rows?.length || 0,
          sampleRows: (res.json?.rows || []).slice(0, 5),
        })
      }

      const rows = res.json?.rows || []
      let activeUsers = 0
      const byLocation = []
      const points = []

      for (const r of rows) {
        const countryId = r.dimensionValues?.[0]?.value || ''
        const country = r.dimensionValues?.[1]?.value || ''
        const city = r.dimensionValues?.[2]?.value || ''
        const count = parseInt(r.metricValues?.[0]?.value || '0', 10)
        if (!count) continue
        activeUsers += count

        const loc = locateByCountry(countryId, city)
        byLocation.push({
          countryId,
          country: country || loc?.countryName || countryId,
          city: city && city !== '(not set)' ? city : '',
          activeUsers: count,
        })
        if (loc) {
          points.push({
            lat: loc.lat,
            lng: loc.lng,
            count,
            label: [city && city !== '(not set)' ? city : null, country || loc.countryName]
              .filter(Boolean)
              .join(', '),
          })
        }
      }

      return NextResponse.json({
        configured: true,
        activeUsers,
        byLocation: byLocation.slice(0, 12),
        points,
        updatedAt: new Date().toISOString(),
      })
    } catch (e) {
      return NextResponse.json({ configured: false, error: e.message }, { status: 200 })
    }
  })
}
