export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { withTenantContext, getGoogle } from '../../../lib/tenant/credentials'

// Path Exploration "vero" (Sankey pagina→pagina) ricostruito dai dati
// event-level di GA4 esportati in BigQuery. Richiede:
//  - GA4 → BigQuery export attivo (dataset analytics_<propertyId>)
//  - env GA4_BQ_PROJECT (progetto GCP) + GA4_BQ_DATASET (es. analytics_381385723)
//  - refresh token con scope bigquery.readonly (oltre a analytics+webmasters)

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
  return { token: d.access_token || null, error: d.error || null }
}

const suffix = (d) => d.toISOString().slice(0, 10).replace(/-/g, '')

function topSet(rows, key, n = 8) {
  const m = new Map()
  for (const r of rows) { const v = r[key]; if (v) m.set(v, (m.get(v) || 0) + r.c) }
  return new Set([...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]))
}

export async function GET(request) {
  return withTenantContext(request, async () => {
    const g = getGoogle()
    const { searchParams } = new URL(request.url)
    const debug = searchParams.get('debug') === '1'
    const project = process.env.GA4_BQ_PROJECT
    const dataset = process.env.GA4_BQ_DATASET

    if (!project || !dataset) return NextResponse.json({ configured: false, reason: 'no-config' })
    if (!g.clientId || !g.refreshToken) return NextResponse.json({ configured: false, reason: 'no-creds' })

    const auth = await getToken(g)
    if (!auth.token) return NextResponse.json(debug ? { configured: false, reason: 'oauth', oauthError: auth.error } : { configured: false, reason: 'oauth' })

    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '28', 10), 7), 90)
    const end = new Date(); end.setDate(end.getDate() - 1) // export giornaliero ha lag ~1g
    const start = new Date(end); start.setDate(start.getDate() - days)

    const sql = `
      WITH pv AS (
        SELECT user_pseudo_id,
          (SELECT value.int_value FROM UNNEST(event_params) WHERE key='ga_session_id') sid,
          event_timestamp ts,
          COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='page_title'),'(not set)') title
        FROM \`${project}.${dataset}.events_*\`
        WHERE event_name='page_view' AND (_TABLE_SUFFIX BETWEEN '${suffix(start)}' AND '${suffix(end)}' OR STARTS_WITH(_TABLE_SUFFIX, 'intraday_'))
      ),
      o AS (SELECT *, ROW_NUMBER() OVER(PARTITION BY user_pseudo_id, sid ORDER BY ts) step FROM pv),
      s AS (
        SELECT user_pseudo_id, sid,
          MAX(IF(step=1,title,NULL)) s1,
          MAX(IF(step=2,title,NULL)) s2,
          MAX(IF(step=3,title,NULL)) s3
        FROM o WHERE step<=3 GROUP BY 1,2
      )
      SELECT s1,s2,s3,COUNT(*) c FROM s WHERE s1 IS NOT NULL GROUP BY 1,2,3 ORDER BY c DESC LIMIT 400`

    const res = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${project}/queries`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql, useLegacySql: false, timeoutMs: 30000, maxResults: 400 }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = j?.error?.message || `BigQuery ${res.status}`
      const insufficient = /bigquery.readonly|permission|access denied|insufficient|jobs.create/i.test(msg)
      const notReady = /does not match any table|not found: table|was not found/i.test(msg)
      const reason = notReady ? 'not-ready' : insufficient ? 'scope' : 'api'
      return NextResponse.json(debug
        ? { configured: false, reason, status: res.status, error: msg }
        : { configured: false, reason, error: msg.slice(0, 200) })
    }

    const rows = (j.rows || []).map(r => ({ s1: r.f[0].v, s2: r.f[1].v, s3: r.f[2].v, c: +r.f[3].v }))
    if (!rows.length) return NextResponse.json({ configured: true, empty: true, nodes: [], links: [] })

    const t1 = topSet(rows, 's1'), t2 = topSet(rows, 's2'), t3 = topSet(rows, 's3')
    const lab = (v, top) => v ? (top.has(v) ? v : 'Altre') : null

    const idx = new Map(); const nodes = []
    const nodeId = (step, label) => { const k = step + '|' + label; if (!idx.has(k)) { idx.set(k, nodes.length); nodes.push({ name: label, step }) } return idx.get(k) }
    const linkMap = new Map()
    const addLink = (a, b, v) => linkMap.set(a + '>' + b, (linkMap.get(a + '>' + b) || 0) + v)

    for (const r of rows) {
      const a = lab(r.s1, t1), b = lab(r.s2, t2), c2 = lab(r.s3, t3)
      if (a && b) addLink(nodeId(1, a), nodeId(2, b), r.c)
      if (b && c2) addLink(nodeId(2, b), nodeId(3, c2), r.c)
    }
    const links = [...linkMap.entries()].map(([k, v]) => { const [source, target] = k.split('>').map(Number); return { source, target, value: v } })
    const totalSessions = rows.reduce((a, r) => a + r.c, 0)

    return NextResponse.json({ configured: true, nodes, links, totalSessions, range: { start: suffix(start), end: suffix(end) }, days, updatedAt: new Date().toISOString() })
  })
}
