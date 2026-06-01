export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

// Customer Journey ibrido:
// 1) BigQuery export GA4 quando esiste (vero sankey sequenziale)
// 2) Fallback a GA4 Data API (approssimato sopra il livello 1) quando
//    BigQuery dataset e' vuoto / non ancora popolato
//
// Lo switch e' automatico: BigQuery e' la PRIMARY, su errore "does not
// match any table" (sandbox post-expiration, export non ancora arrivato,
// dataset appena creato) cade su GA4 Data API. Provider indicato nel
// payload cosi' il client mostra il badge corretto.

let bqClient = null

// trim: i copy-paste in Vercel env spesso lasciano spazi/newline. BigQuery
// rifiuta project ID con spazi → trimmiamo sempre.
const envTrim = name => process.env[name]?.trim() || ''

function getBQ() {
  if (bqClient) return { client: bqClient }
  const raw = envTrim('GOOGLE_SERVICE_ACCOUNT_JSON')
  const projectId = envTrim('BIGQUERY_PROJECT_ID')
  const dataset = envTrim('BIGQUERY_DATASET')
  const missing = []
  if (!projectId) missing.push('BIGQUERY_PROJECT_ID')
  if (!dataset) missing.push('BIGQUERY_DATASET')
  if (!raw) missing.push('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (missing.length) return { client: null, reason: `Env vars mancanti: ${missing.join(', ')}` }
  let credentials
  try { credentials = JSON.parse(raw) } catch (e) {
    return { client: null, reason: `GOOGLE_SERVICE_ACCOUNT_JSON non e' JSON valido: ${e?.message?.slice(0, 100)}` }
  }
  if (!credentials.client_email || !credentials.private_key) {
    return { client: null, reason: 'JSON mancante client_email o private_key (chiave service account incompleta?)' }
  }
  try {
    bqClient = new BigQuery({ projectId, credentials })
  } catch (e) {
    return { client: null, reason: `BigQuery init: ${e?.message?.slice(0, 120)}` }
  }
  return { client: bqClient }
}

function resolveDateRange(preset) {
  const today = new Date()
  const fmt = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  switch (preset) {
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      return { start: fmt(start), end: fmt(end), label: 'Mese scorso' }
    }
    case 'last_90d': {
      const start = new Date(today)
      start.setDate(start.getDate() - 90)
      return { start: fmt(start), end: fmt(today), label: '90 giorni' }
    }
    case 'last_180d': {
      const start = new Date(today)
      start.setDate(start.getDate() - 180)
      return { start: fmt(start), end: fmt(today), label: '180 giorni' }
    }
    case 'current_month':
    default: {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: fmt(start), end: fmt(today), label: 'Questo mese' }
    }
  }
}

const PRETTY_TITLES = {
  '/': 'Home',
  '/cart': 'Carrello',
  '/checkout': 'Checkout',
}

function prettifyPath(p) {
  if (!p) return '(unknown)'
  if (PRETTY_TITLES[p]) return PRETTY_TITLES[p]
  const last = p.replace(/\/$/, '').split('/').pop() || p
  return last
    .replace(/[-_]/g, ' ')
    .replace(/\?.*/, '')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// Costruisce la WHERE per il path-prefix. path = ['/'] → solo livello 0
// fissato. Ogni elemento path[i] vincola path_array[OFFSET(i)] = path[i].
function buildPrefixWhere(path) {
  if (!path.length) return ''
  const clauses = path.map((_, i) => `path_array[OFFSET(${i})] = @p${i}`)
  return `AND ${clauses.join(' AND ')}`
}

function pathParams(path) {
  const params = {}
  const types = {}
  path.forEach((p, i) => {
    params[`p${i}`] = p
    types[`p${i}`] = 'STRING'
  })
  return { params, types }
}

export async function GET(request) {
  // Debug envelope sempre presente — utile a vedere se le env vars sono
  // arrivate al runtime serverless dopo il redeploy.
  const debug = {
    hasProjectId: !!envTrim('BIGQUERY_PROJECT_ID'),
    hasDataset: !!envTrim('BIGQUERY_DATASET'),
    hasJson: !!envTrim('GOOGLE_SERVICE_ACCOUNT_JSON'),
    projectId: envTrim('BIGQUERY_PROJECT_ID') || null,
    dataset: envTrim('BIGQUERY_DATASET') || null,
    jsonLength: envTrim('GOOGLE_SERVICE_ACCOUNT_JSON').length || 0,
    ga4PropertyId: envTrim('GA4_PROPERTY_ID') || null,
    hasGa4OAuth: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_REFRESH_TOKEN,
  }

  const { searchParams } = new URL(request.url)
  const preset = searchParams.get('preset') || 'current_month'
  const pathParam = searchParams.get('path') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 25)
  const path = pathParam ? pathParam.split('|').filter(Boolean) : []
  const level = path.length

  const { start, end } = resolveDateRange(preset)

  const { client: bq, reason } = getBQ()
  // BigQuery non configurato → cade subito su GA4 Data API se disponibile
  if (!bq) {
    try {
      const fallback = await fetchFromGA4DataAPI({ preset, path, level, limit, start, end })
      if (fallback) return NextResponse.json({ ...fallback, debug })
    } catch {}
    return NextResponse.json({ configured: false, reason: reason || 'BQ client null senza reason', debug }, { status: 200 })
  }

  const dataset = envTrim('BIGQUERY_DATASET')
  const projectId = envTrim('BIGQUERY_PROJECT_ID')

  // SQL: ricostruzione path sequenziale.
  // 1) page_views: estrae page_path, session_id, event_timestamp da
  //    tutte le tabelle events_* e events_intraday_* nel range
  // 2) ordered: aggiunge LAG per dedupe consecutive duplicates
  //    (refresh della stessa pagina non e' un "passaggio")
  // 3) deduped: tiene solo le pagine effettivamente diverse dalla precedente
  // 4) session_paths: aggrega per sessione in array ordinato
  // 5) la SELECT finale legge path_array[OFFSET(level)] applicando il prefix
  // events_* wildcard matcha SIA events_YYYYMMDD (suffix = '20260102')
  // SIA events_intraday_YYYYMMDD (suffix = 'intraday_20260102'). Cosi'
  // catturiamo anche il dato di oggi in real-time, senza dover gestire
  // due wildcard separate (e potenziali errori se intraday non esiste).
  const tableUnion = `
    SELECT * FROM \`${projectId}.${dataset}.events_*\`
    WHERE _TABLE_SUFFIX BETWEEN @start_date AND @end_date
       OR _TABLE_SUFFIX BETWEEN CONCAT('intraday_', @start_date) AND CONCAT('intraday_', @end_date)
  `

  const prefixWhere = buildPrefixWhere(path)
  const { params: prefixParams, types: prefixTypes } = pathParams(path)

  // Unica query: top N pagine al livello richiesto + totale matchanti
  // via window function. Salva uno scan completo di BigQuery rispetto
  // a due query separate.
  const query = `
    WITH events_all AS (${tableUnion}),
    page_views AS (
      SELECT
        user_pseudo_id,
        (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,
        event_timestamp,
        COALESCE(
          NULLIF(
            REGEXP_EXTRACT(
              (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'),
              r'^https?://[^/]+([^?#]*)'
            ),
            ''
          ),
          '/'
        ) AS page_path
      FROM events_all
      WHERE event_name = 'page_view'
    ),
    ordered AS (
      SELECT
        user_pseudo_id, session_id, page_path, event_timestamp,
        LAG(page_path) OVER (PARTITION BY user_pseudo_id, session_id ORDER BY event_timestamp) AS prev_path
      FROM page_views
      WHERE session_id IS NOT NULL
    ),
    deduped AS (
      SELECT user_pseudo_id, session_id, page_path, event_timestamp
      FROM ordered
      WHERE prev_path IS NULL OR prev_path != page_path
    ),
    session_paths AS (
      SELECT
        user_pseudo_id, session_id,
        ARRAY_AGG(page_path ORDER BY event_timestamp) AS path_array
      FROM deduped
      GROUP BY user_pseudo_id, session_id
    ),
    grouped AS (
      SELECT
        path_array[OFFSET(@level)] AS page,
        COUNT(*) AS sessions
      FROM session_paths
      WHERE ARRAY_LENGTH(path_array) > @level
      ${prefixWhere}
      GROUP BY page
    )
    SELECT
      page,
      sessions,
      SUM(sessions) OVER () AS total_sessions
    FROM grouped
    ORDER BY sessions DESC
    LIMIT @limit
  `

  const sharedParams = {
    start_date: start,
    end_date: end,
    level,
    limit,
    ...prefixParams,
  }
  const sharedTypes = {
    start_date: 'STRING',
    end_date: 'STRING',
    level: 'INT64',
    limit: 'INT64',
    ...prefixTypes,
  }

  try {
    const [rows] = await bq.query({
      query,
      params: sharedParams,
      types: sharedTypes,
      location: 'us-west2',
    })

    const parentSessions = Number(rows?.[0]?.total_sessions || 0)
    const nodes = (rows || [])
      .filter(r => r.page != null)
      .map(r => ({
        path: r.page,
        title: prettifyPath(r.page),
        sessions: Number(r.sessions || 0),
      }))

    return NextResponse.json({
      configured: true,
      provider: 'bigquery',
      level,
      path,
      parentSessions,
      rootSessions: level === 0 ? parentSessions : null,
      nodes,
      preset,
      dateRange: { start, end },
      approximated: false,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e?.message || ''
    // BigQuery vuoto → fallback a GA4 Data API (approssimato sopra L1)
    const isEmptyDataset = msg.includes('does not match any table') || msg.includes('Not found: Dataset')
    if (isEmptyDataset) {
      try {
        const fallback = await fetchFromGA4DataAPI({ preset, path, level, limit, start, end })
        if (fallback) return NextResponse.json({ ...fallback, debug })
      } catch (fe) {
        // fall through al messaggio sotto
      }
    }
    return NextResponse.json({
      configured: false,
      reason: `Query BigQuery fallita: ${msg.slice(0, 400) || 'unknown'}`,
      debug,
    }, { status: 200 })
  }
}

// ── Fallback GA4 Data API ─────────────────────────────────────────
// Stesso flow del primo MVP: top landingPage al livello 0, top pagePath
// filtrato per landingPage = path[0] sopra. Conteggi approssimati ai
// livelli > 1 (GA4 Data API senza BigQuery non espone l'ordine).
async function getGA4AccessToken() {
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

async function ga4RunReport(token, propertyId, body) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`GA4 ${res.status}: ${text.slice(0, 300)}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

async function fetchFromGA4DataAPI({ preset, path, level, limit, start, end }) {
  const propertyId = envTrim('GA4_PROPERTY_ID')
  if (!propertyId || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
    return { configured: false, reason: 'GA4 Data API env vars mancanti (GA4_PROPERTY_ID, GOOGLE_CLIENT_ID, GOOGLE_REFRESH_TOKEN)' }
  }
  const token = await getGA4AccessToken()
  if (!token) return { configured: false, reason: 'OAuth refresh_token GA4 scaduto/revocato — rinnova GOOGLE_REFRESH_TOKEN su Vercel' }

  // GA4 Data API accetta YYYY-MM-DD, non YYYYMMDD. Converti.
  const toIso = s => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  const dateRange = { startDate: toIso(start), endDate: toIso(end) }

  if (level === 0) {
    let landingRep, totalRep
    try {
      [landingRep, totalRep] = await Promise.all([
        ga4RunReport(token, propertyId, {
          dateRanges: [dateRange],
          dimensions: [{ name: 'landingPage' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit,
        }),
        ga4RunReport(token, propertyId, {
          dateRanges: [dateRange],
          metrics: [{ name: 'sessions' }],
        }),
      ])
    } catch (e) {
      return { configured: false, reason: `GA4 Data API: ${e?.message?.slice(0, 300)} — property=${propertyId}` }
    }
    const totalSessions = parseFloat(totalRep?.rows?.[0]?.metricValues?.[0]?.value || '0')
    const nodes = (landingRep?.rows || []).map(r => ({
      path: r.dimensionValues?.[0]?.value || '(unknown)',
      title: prettifyPath(r.dimensionValues?.[0]?.value || ''),
      sessions: parseFloat(r.metricValues?.[0]?.value || '0'),
    })).filter(n => n.sessions > 0)
    return {
      configured: true,
      provider: 'ga4-data-api',
      level: 0,
      path: [],
      rootSessions: totalSessions,
      parentSessions: totalSessions,
      nodes,
      preset,
      dateRange: { start, end },
      ga4PropertyIdUsed: propertyId,
      approximated: false,
      updatedAt: new Date().toISOString(),
    }
  }

  // Livello 1+ approssimato: filter sessions by landingPage = path[0],
  // mostra pagePath visitati con esclusione del breadcrumb.
  const landingFilter = {
    filter: {
      fieldName: 'landingPage',
      stringFilter: { value: path[0], matchType: 'EXACT' },
    },
  }
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

  let pagesRep, parentRep
  try {
    [pagesRep, parentRep] = await Promise.all([
      ga4RunReport(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit,
      }),
      ga4RunReport(token, propertyId, {
        dateRanges: [dateRange],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: landingFilter,
      }),
    ])
  } catch (e) {
    return { configured: false, reason: `GA4 Data API: ${e?.message?.slice(0, 300)} — property=${propertyId}` }
  }

  const parentSessions = parseFloat(parentRep?.rows?.[0]?.metricValues?.[0]?.value || '0')
  const nodes = (pagesRep?.rows || []).map(r => ({
    path: r.dimensionValues?.[0]?.value || '(unknown)',
    title: prettifyPath(r.dimensionValues?.[0]?.value || ''),
    sessions: parseFloat(r.metricValues?.[0]?.value || '0'),
  })).filter(n => n.sessions > 0)

  return {
    configured: true,
    provider: 'ga4-data-api',
    level,
    path,
    parentSessions,
    rootSessions: null,
    nodes,
    preset,
    dateRange: { start, end },
    ga4PropertyIdUsed: propertyId,
    approximated: level > 1,
    updatedAt: new Date().toISOString(),
  }
}
