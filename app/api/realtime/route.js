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
  const data = await res.json()
  return data.access_token || null
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
  if (!res.ok) return null
  return res.json()
}

export async function GET(request) {
  return withTenantContext(request, async () => {
    const g = getGoogle()
    const propertyId = g.ga4PropertyId
    if (!propertyId || !g.clientId || !g.refreshToken) {
      return NextResponse.json({ configured: false })
    }

    try {
      const token = await getAccessToken(g)
      if (!token) throw new Error('Google OAuth failed')

      const report = await runRealtime(token, propertyId, {
        dimensions: [{ name: 'countryId' }, { name: 'country' }, { name: 'city' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 100,
      })

      const rows = report?.rows || []
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
