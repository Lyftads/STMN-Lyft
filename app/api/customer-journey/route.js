export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

// Customer Journey via BigQuery export GA4.
// Vero sankey sequenziale: ricostruisce l'ordine reale delle pagine
// visitate dentro ogni sessione (event_timestamp) e raggruppa per
// (level, path-prefix) per ottenere conteggi accurati di transizione.

let bqClient = null

function getBQ() {
  if (bqClient) return { client: bqClient }
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  const projectId = process.env.BIGQUERY_PROJECT_ID
  const dataset = process.env.BIGQUERY_DATASET
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
    hasProjectId: !!process.env.BIGQUERY_PROJECT_ID,
    hasDataset: !!process.env.BIGQUERY_DATASET,
    hasJson: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    projectId: process.env.BIGQUERY_PROJECT_ID || null,
    dataset: process.env.BIGQUERY_DATASET || null,
    jsonLength: process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.length || 0,
  }

  const { client: bq, reason } = getBQ()
  if (!bq) {
    return NextResponse.json({ configured: false, reason: reason || 'BQ client null senza reason', debug }, { status: 200 })
  }

  const dataset = process.env.BIGQUERY_DATASET
  const projectId = process.env.BIGQUERY_PROJECT_ID

  const { searchParams } = new URL(request.url)
  const preset = searchParams.get('preset') || 'current_month'
  const pathParam = searchParams.get('path') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 25)
  const path = pathParam ? pathParam.split('|').filter(Boolean) : []
  const level = path.length

  const { start, end } = resolveDateRange(preset)

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
    // Env vars ci sono ma la query e' fallita (permessi, dataset
    // inesistente, SQL syntax, timeout). Inquadra come "non configurato"
    // con reason esplicito cosi' il client mostra il riquadro rosso.
    return NextResponse.json({
      configured: false,
      reason: `Query BigQuery fallita: ${e?.message?.slice(0, 400) || 'unknown'}`,
      debug,
    }, { status: 200 })
  }
}
