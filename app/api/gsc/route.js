export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 45

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
const sumRows = (rows) => rows.reduce((a, r) => ({ clicks: a.clicks + (r.clicks || 0), impressions: a.impressions + (r.impressions || 0) }), { clicks: 0, impressions: 0 })

function brandTokens(site, override) {
  if (override) return override.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  const host = site.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '')
  return [host.split('.')[0].toLowerCase()].filter(Boolean)
}

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

    if (searchParams.get('action') === 'sites') {
      const r = await gscFetch(auth.token, '/sites')
      if (!r.ok) return NextResponse.json(debug ? { configured: true, apiStatus: r.status, apiError: r.errText } : { configured: false, reason: 'api', status: r.status })
      const sites = (r.json?.siteEntry || []).filter(s => s.permissionLevel !== 'siteUnverifiedUser').map(s => ({ siteUrl: s.siteUrl, permission: s.permissionLevel }))
      // `saved` = sito scelto dal cliente (companies.gsc_site_url) → il pannello
      // lo pre-seleziona invece di ripartire sempre dal primo.
      const saved = g.gscSiteUrl && sites.some(s => s.siteUrl === g.gscSiteUrl) ? g.gscSiteUrl : null
      return NextResponse.json({ configured: true, sites, saved })
    }

    const site = searchParams.get('site')
    if (!site) return NextResponse.json({ configured: true, error: 'site mancante' }, { status: 200 })
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '28', 10), 7), 180)

    const end = new Date(); const start = new Date(); start.setDate(start.getDate() - days)
    const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days)
    const base = { startDate: ymd(start), endDate: ymd(end) }
    const prevBase = { startDate: ymd(prevStart), endDate: ymd(prevEnd) }
    const path = `/sites/${encodeURIComponent(site)}/searchAnalytics/query`
    const q = (extra, range = base) => gscFetch(auth.token, path, { ...range, ...extra })

    const [totalsR, totalsPrevR, dateR, queryR, queryPrevR, pageR, pagePrevR, countryR, deviceR, apprR] = await Promise.all([
      q({}), q({}, prevBase),
      q({ dimensions: ['date'], rowLimit: 500 }),
      q({ dimensions: ['query'], rowLimit: 250 }),
      q({ dimensions: ['query'], rowLimit: 250 }, prevBase),
      q({ dimensions: ['page'], rowLimit: 100 }),
      q({ dimensions: ['page'], rowLimit: 100 }, prevBase),
      q({ dimensions: ['country'], rowLimit: 15 }),
      q({ dimensions: ['device'], rowLimit: 5 }),
      q({ dimensions: ['searchAppearance'], rowLimit: 10 }),
    ])

    if (!queryR.ok) {
      return NextResponse.json(debug
        ? { configured: true, apiStatus: queryR.status, apiError: queryR.errText }
        : { configured: false, reason: 'api', status: queryR.status, error: queryR.status === 403 ? 'Token senza scope Search Console (webmasters.readonly) o nessun accesso a questa proprietà.' : `Errore API ${queryR.status}` }, { status: 200 })
    }

    const t = totalsR.json?.rows?.[0] || {}
    const tp = totalsPrevR.json?.rows?.[0] || {}
    const totals = { clicks: t.clicks || 0, impressions: t.impressions || 0, ctr: t.ctr || 0, position: t.position || 0 }
    const prev = { clicks: tp.clicks || 0, impressions: tp.impressions || 0, ctr: tp.ctr || 0, position: tp.position || 0 }
    const pctDelta = (c, p) => p ? +(((c - p) / p) * 100).toFixed(1) : (c ? 100 : 0)
    const deltas = {
      clicks: pctDelta(totals.clicks, prev.clicks),
      impressions: pctDelta(totals.impressions, prev.impressions),
      ctr: +((totals.ctr - prev.ctr) * 100).toFixed(2),     // punti percentuali
      position: +(totals.position - prev.position).toFixed(1), // negativo = miglioramento
    }

    const series = (dateR.json?.rows || []).map(r => ({ date: r.keys?.[0], clicks: r.clicks || 0, impressions: r.impressions || 0, ctr: +((r.ctr || 0) * 100).toFixed(1), position: +(r.position || 0).toFixed(1) })).sort((a, b) => a.date < b.date ? -1 : 1)
    const queries = (queryR.json?.rows || []).map(rowObj)
    const pages = (pageR.json?.rows || []).map(rowObj)
    const countries = (countryR.json?.rows || []).map(rowObj)
    const devices = (deviceR.json?.rows || []).map(rowObj)
    const appearance = apprR.ok ? (apprR.json?.rows || []).map(rowObj) : []

    // branded vs non-branded
    const toks = brandTokens(site, searchParams.get('brand'))
    let bClicks = 0, nbClicks = 0
    for (const qq of queries) { (toks.some(tk => qq.key.toLowerCase().includes(tk)) ? bClicks += qq.clicks : nbClicks += qq.clicks) }
    const branded = { brandedClicks: bClicks, nonBrandedClicks: nbClicks, brandedPct: (bClicks + nbClicks) ? Math.round(bClicks / (bClicks + nbClicks) * 100) : 0, tokens: toks }

    // pagine in crescita / calo vs periodo precedente
    const prevPageMap = Object.fromEntries((pagePrevR.json?.rows || []).map(r => [r.keys?.[0], r.clicks || 0]))
    const movers = pages.map(p => ({ key: p.key, clicks: p.clicks, prev: prevPageMap[p.key] || 0, delta: p.clicks - (prevPageMap[p.key] || 0) }))
    const pageMovers = {
      up: movers.filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 8),
      down: movers.filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 8),
    }

    // opportunità
    const nearFirstPage = queries.filter(qq => qq.position > 10 && qq.position <= 20).sort((a, b) => b.impressions - a.impressions).slice(0, 15)
    const lowCtr = queries.filter(qq => qq.position <= 10 && qq.ctr < 0.03 && qq.impressions >= 20).sort((a, b) => b.impressions - a.impressions).slice(0, 15)

    return NextResponse.json({
      configured: true, site, range: base, prevRange: prevBase, days,
      totals, deltas,
      series, queries: queries.slice(0, 100), pages, countries, devices, appearance,
      branded, pageMovers,
      opportunities: { nearFirstPage, lowCtr },
      updatedAt: new Date().toISOString(),
    })
  })
}
