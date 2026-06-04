export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { withTenantContext, getGoogle } from '../../../lib/tenant/credentials'

const GSC = 'https://searchconsole.googleapis.com/webmasters/v3'

async function getToken(g) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: g.clientId || '', client_secret: g.clientSecret || '',
      refresh_token: g.refreshToken || '', grant_type: 'refresh_token',
    }),
  })
  const d = await res.json().catch(() => ({}))
  return { token: d.access_token || null, error: d.error || null, desc: d.error_description || null }
}

async function gscFetch(token, path, body) {
  const res = await fetch(`${GSC}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null; try { json = JSON.parse(text) } catch {}
  return { ok: res.ok, status: res.status, json, errText: res.ok ? null : text.slice(0, 400) }
}

const ymd = (d) => d.toISOString().slice(0, 10)
const rowObj = (r) => ({ key: r.keys?.[0] || '', clicks: r.clicks || 0, impressions: r.impressions || 0, ctr: r.ctr || 0, position: r.position || 0 })

export async function GET(request) {
  return withTenantContext(request, async () => {
    const g = getGoogle()
    const { searchParams } = new URL(request.url)
    const debug = searchParams.get('debug') === '1'

    if (!g.clientId || !g.refreshToken) return NextResponse.json({ configured: false, reason: 'no-creds' })

    const auth = await getToken(g)
    if (!auth.token) {
      const out = { configured: false, reason: 'oauth', oauthError: auth.error, oauthDesc: auth.desc }
      return NextResponse.json(debug ? out : { configured: false })
    }

    // lista proprietà verificate
    if (searchParams.get('action') === 'sites') {
      const r = await gscFetch(auth.token, '/sites')
      if (!r.ok) return NextResponse.json(debug ? { configured: true, apiStatus: r.status, apiError: r.errText } : { configured: false, reason: 'api', status: r.status })
      const sites = (r.json?.siteEntry || [])
        .filter(s => s.permissionLevel !== 'siteUnverifiedUser')
        .map(s => ({ siteUrl: s.siteUrl, permission: s.permissionLevel }))
      return NextResponse.json({ configured: true, sites })
    }

    const site = searchParams.get('site')
    if (!site) return NextResponse.json({ configured: true, sites: null, error: 'site mancante' }, { status: 200 })
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '28', 10), 7), 180)
    const end = new Date(); const start = new Date(); start.setDate(start.getDate() - days)
    const base = { startDate: ymd(start), endDate: ymd(end) }
    const path = `/sites/${encodeURIComponent(site)}/searchAnalytics/query`

    const [totalsR, queryR, pageR] = await Promise.all([
      gscFetch(auth.token, path, { ...base }),
      gscFetch(auth.token, path, { ...base, dimensions: ['query'], rowLimit: 250 }),
      gscFetch(auth.token, path, { ...base, dimensions: ['page'], rowLimit: 50 }),
    ])

    if (!queryR.ok) {
      return NextResponse.json(debug
        ? { configured: true, apiStatus: queryR.status, apiError: queryR.errText }
        : { configured: false, reason: 'api', status: queryR.status, error: queryR.status === 403 ? 'Token senza scope Search Console (webmasters.readonly) o nessun accesso a questa proprietà.' : `Errore API ${queryR.status}` }, { status: 200 })
    }

    const t = totalsR.json?.rows?.[0]
    const totals = t ? { clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position } : { clicks: 0, impressions: 0, ctr: 0, position: 0 }
    const queries = (queryR.json?.rows || []).map(rowObj)
    const pages = (pageR.json?.rows || []).map(rowObj)

    // opportunità
    const nearFirstPage = queries.filter(q => q.position > 10 && q.position <= 20).sort((a, b) => b.impressions - a.impressions).slice(0, 15)
    const lowCtr = queries.filter(q => q.position <= 10 && q.ctr < 0.03 && q.impressions >= 20).sort((a, b) => b.impressions - a.impressions).slice(0, 15)

    return NextResponse.json({
      configured: true, site, range: base,
      totals,
      queries: queries.slice(0, 100),
      pages,
      opportunities: { nearFirstPage, lowCtr },
      updatedAt: new Date().toISOString(),
    })
  })
}
