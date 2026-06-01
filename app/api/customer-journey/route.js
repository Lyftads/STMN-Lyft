export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'

// Customer Journey API: replica GA4 Path Exploration con i dati che la
// GA4 Data API ci permette di ottenere senza BigQuery.
//
// Limiti tecnici (importanti):
// - landingPage e' session-scoped: ottimo per definire "da dove parte"
// - pagePath e' event-scoped + sessions e' session-scoped: il count e'
//   "sessioni che includono questa pagina"
// - Senza BigQuery, NON possiamo ordinare gli step in vero ordine
//   sequenziale. Approssimiamo filtrando per landingPage del path[0]
//   e mostrando le pagine visitate in quelle sessioni.
//
// Risultato: il primo livello e' un vero entry point GA4, i livelli
// successivi sono "altre pagine viste in quelle sessioni", che e'
// quello che serve a Marino per capire il flusso di navigazione.

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  return data.access_token || null
}

async function runReport(token, propertyId, body) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GA4 ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

const PRETTY_TITLES = {
  '/': 'Home',
  '/cart': 'Carrello',
  '/checkout': 'Checkout',
}

function prettifyPath(p) {
  if (!p) return '(unknown)'
  if (PRETTY_TITLES[p]) return PRETTY_TITLES[p]
  // Path tipo /products/paracalli-zero-slim → "Paracalli Zero Slim"
  const last = p.replace(/\/$/, '').split('/').pop() || p
  return last
    .replace(/[-_]/g, ' ')
    .replace(/\?.*/, '')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export async function GET(request) {
  const propertyId = process.env.GA4_PROPERTY_ID
  const hasConfig = propertyId && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN

  if (!hasConfig) {
    return NextResponse.json({ configured: false }, { status: 200 })
  }

  const { searchParams } = new URL(request.url)
  const preset = searchParams.get('preset') || 'current_month'
  const pathParam = searchParams.get('path') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 25)
  const path = pathParam ? pathParam.split('|').filter(Boolean) : []

  // Risolve il preset in startDate/endDate GA4 (formato ISO o keyword)
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const today = new Date()
  let startDate, endDate
  switch (preset) {
    case 'last_month': {
      const firstPrev = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastPrev = new Date(today.getFullYear(), today.getMonth(), 0)
      startDate = fmt(firstPrev)
      endDate = fmt(lastPrev)
      break
    }
    case 'last_90d':
      startDate = '90daysAgo'
      endDate = 'today'
      break
    case 'last_180d':
      startDate = '180daysAgo'
      endDate = 'today'
      break
    case 'current_month':
    default: {
      const firstThis = new Date(today.getFullYear(), today.getMonth(), 1)
      startDate = fmt(firstThis)
      endDate = 'today'
      break
    }
  }

  try {
    const token = await getAccessToken()
    if (!token) throw new Error('Google OAuth failed')

    const dateRange = { startDate, endDate }

    // Livello 0 (path vuoto) → entry pages
    if (path.length === 0) {
      const [landingRep, totalRep] = await Promise.all([
        runReport(token, propertyId, {
          dateRanges: [dateRange],
          dimensions: [{ name: 'landingPage' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit,
        }),
        runReport(token, propertyId, {
          dateRanges: [dateRange],
          metrics: [{ name: 'sessions' }],
        }),
      ])

      const totalSessions = parseFloat(totalRep?.rows?.[0]?.metricValues?.[0]?.value || '0')
      const nodes = (landingRep?.rows || []).map(r => ({
        path: r.dimensionValues?.[0]?.value || '(unknown)',
        title: prettifyPath(r.dimensionValues?.[0]?.value || ''),
        sessions: parseFloat(r.metricValues?.[0]?.value || '0'),
      })).filter(n => n.sessions > 0)

      return NextResponse.json({
        configured: true,
        level: 0,
        path: [],
        rootSessions: totalSessions,
        parentSessions: totalSessions,
        nodes,
        preset,
        dateRange: { startDate, endDate },
        updatedAt: new Date().toISOString(),
      })
    }

    // Livello 1+ → pagine viste in sessioni che hanno path[0] come landing
    // (approssimazione: ignoriamo gli step intermedi nel filter perche'
    // GA4 Data API senza BigQuery non supporta filtri session-scoped
    // su pagePath. Il path serve solo a costruire il breadcrumb.)
    const landingFilter = {
      filter: {
        fieldName: 'landingPage',
        stringFilter: { value: path[0], matchType: 'EXACT' },
      },
    }

    // Esclude le pagine gia' nel breadcrumb dal next-step
    const excludeFilters = path.map(p => ({
      notExpression: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: { value: p, matchType: 'EXACT' },
        },
      },
    }))

    const dimensionFilter = excludeFilters.length
      ? { andGroup: { expressions: [landingFilter, ...excludeFilters] } }
      : landingFilter

    const [pagesRep, parentRep] = await Promise.all([
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit,
      }),
      // Sessioni totali con quella landing page → per calcolare la %
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: landingFilter,
      }),
    ])

    const parentSessions = parseFloat(parentRep?.rows?.[0]?.metricValues?.[0]?.value || '0')
    const nodes = (pagesRep?.rows || []).map(r => ({
      path: r.dimensionValues?.[0]?.value || '(unknown)',
      title: prettifyPath(r.dimensionValues?.[0]?.value || ''),
      sessions: parseFloat(r.metricValues?.[0]?.value || '0'),
    })).filter(n => n.sessions > 0)

    return NextResponse.json({
      configured: true,
      level: path.length,
      path,
      parentSessions,
      nodes,
      preset,
      dateRange: { startDate, endDate },
      // Hint UI: avvisa che oltre il livello 1 e' un'approssimazione
      approximated: path.length > 1,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ configured: false, error: e.message }, { status: 500 })
  }
}
