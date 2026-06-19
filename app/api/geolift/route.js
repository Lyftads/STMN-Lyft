export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getGoogle } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'
import { designGeoLift } from '../../../lib/incrementality/geolift'

async function getAccessToken(g) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: g.clientId || '', client_secret: g.clientSecret || '', refresh_token: g.refreshToken || '', grant_type: 'refresh_token' }),
  })
  const data = await res.json().catch(() => ({}))
  return data.access_token || null
}

async function runReport(token, propertyId, body) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) return null
  return res.json().catch(() => null)
}

const ymd = (s) => String(s || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')

export async function GET(req) {
  return withTenantContext(req, async () => {
    const g = getGoogle()
    const propertyId = g.ga4PropertyId
    if (!propertyId || !g.clientId || !g.refreshToken) {
      return NextResponse.json({ ok: false, reason: 'ga4_not_connected' })
    }
    const { searchParams } = new URL(req.url)
    const days = Math.min(180, Math.max(30, parseInt(searchParams.get('days') || '120', 10)))
    const locale = (searchParams.get('locale') || 'it').slice(0, 2)

    return swrSnapshot(req, { tab: `geolift_${days}_${locale}`, ttlMs: 6 * 3600 * 1000, compute: async () => {
      const token = await getAccessToken(g)
      if (!token) return { __noCache: true, ok: false, reason: 'ga4_auth_failed' }

      const rep = await runReport(token, propertyId, {
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'region' }, { name: 'date' }],
        metrics: [{ name: 'totalRevenue' }, { name: 'conversions' }, { name: 'sessions' }],
        limit: 100000,
      })
      const rows = rep?.rows || []
      if (!rows.length) return { __noCache: true, ok: false, reason: 'no_geo_data' }

      // Scegli la metrica con segnale: ricavo > conversioni > sessioni.
      const tot = { rev: 0, conv: 0, sess: 0 }
      for (const r of rows) { tot.rev += parseFloat(r.metricValues?.[0]?.value || '0'); tot.conv += parseFloat(r.metricValues?.[1]?.value || '0'); tot.sess += parseFloat(r.metricValues?.[2]?.value || '0') }
      const metricIdx = tot.rev > 0 ? 0 : tot.conv > 0 ? 1 : 2
      const metricKey = ['revenue', 'conversions', 'sessions'][metricIdx]

      // region → { daily: [{date,value}], total }
      const byRegion = new Map()
      for (const r of rows) {
        const region = r.dimensionValues?.[0]?.value || ''
        const date = ymd(r.dimensionValues?.[1]?.value)
        const val = parseFloat(r.metricValues?.[metricIdx]?.value || '0')
        if (!region || region === '(not set)' || !date) continue
        if (!byRegion.has(region)) byRegion.set(region, { region, daily: [], total: 0 })
        const e = byRegion.get(region)
        e.daily.push({ date, value: val }); e.total += val
      }
      const regions = [...byRegion.values()]

      const design = designGeoLift(regions, { metricNote: metricKey })
      if (!design.ok) return { __noCache: true, ...design, metric: metricKey }

      return { ...design, metric: metricKey, range: { days }, updatedAt: new Date().toISOString() }
    } })
  })
}
