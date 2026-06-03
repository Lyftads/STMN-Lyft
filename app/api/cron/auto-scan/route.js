export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — abbastanza per processare tutti i tenant attivi

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { rememberBatch, extractInsightsFromComparison } from '../../../../lib/tenant/agentMemory'

// ============================================================================
//  Cron notturno auto-scan (Batch B — autoalimentazione agent)
//
//  Esegue ogni notte ~06:00 Europe/Rome (04:00 UTC, gestito da vercel.json).
//  Per ogni tenant attivo:
//   1) Fetch metrics last_24h, last_7d, last_30d
//   2) Estrai 3-7 insight (anomalie, trend, milestone) via gpt-4o-mini
//   3) Salva come memorie 'insight' con agent_id 'auto-scan'
//   4) Il giorno dopo, quando l'utente apre un agent, recall semantico
//      tira fuori gli insight rilevanti come briefing
//
//  Auth: Vercel cron usa header 'authorization: Bearer <CRON_SECRET>' che
//  Vercel passa automaticamente. Per chiamate manuali serve lo stesso
//  header con valore di process.env.CRON_SECRET.
// ============================================================================

function isAuthorized(req) {
  const auth = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

async function fetchInternal(origin, path) {
  try {
    const res = await fetch(`${origin}${path}`, {
      headers: { 'x-internal-cron': '1' },
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

const fetchMetricsForPreset = (origin, preset) =>
  fetchInternal(origin, `/api/metrics?preset=${preset}`)

export async function GET(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getAdminSupabase()
  if (!admin) {
    return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })
  }

  // Origin per fetch interno verso /api/metrics
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'https://lyftai.io'

  // Lista tenant da scansionare. Per ora: tutti i tenant con subscription
  // attiva/trialing. Per il beta (STMN) anche se sub non attiva: is_beta=true.
  const { data: companies, error } = await admin
    .from('companies')
    .select('user_id, name, company_name, is_beta, stripe_subscription_status')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const eligible = (companies || []).filter(c => {
    if (c.is_beta) return true
    return ['active', 'trialing'].includes(c.stripe_subscription_status)
  })

  if (eligible.length === 0) {
    return NextResponse.json({ ok: true, scannedAt: new Date().toISOString(), tenantsScanned: 0, results: [] })
  }

  const date = new Date().toISOString().slice(0, 10)

  // Per ora env-only mode → i dati sono gli stessi per tutti i tenant beta.
  // Fetch UNA VOLTA e riusa per tutti (ottimizzazione). Quando passeremo a
  // multi-tenant mode, dovremo fare un fetch per ogni tenant con le sue creds.
  // Fetch esteso: Shopify metrics (3 preset) + Meta detail + Klaviyo + GA4
  // in parallelo. Tutti i dataset confluiscono nell'extractor di insight.
  const [last_24h, last_7d, last_30d, meta_detail, klaviyo, ga4] = await Promise.all([
    fetchMetricsForPreset(origin, 'last_24h'),
    fetchMetricsForPreset(origin, 'last_7d'),
    fetchMetricsForPreset(origin, 'last_30d'),
    fetchInternal(origin, '/api/meta-detail?preset=last_7d'),
    fetchInternal(origin, '/api/klaviyo?days=7'),
    fetchInternal(origin, '/api/ga4?days=7'),
  ])

  const results = []
  for (const c of eligible) {
    try {
      const insights = await extractInsightsFromComparison({
        last_24h, last_7d, last_30d,
        meta_detail, klaviyo, ga4,
        userId: c.user_id,
        date,
      })

      if (insights.length === 0) {
        results.push({ userId: c.user_id, insightsExtracted: 0 })
        continue
      }

      // Salva come memorie con agent_id 'auto-scan' — visibili a TUTTI gli
      // agent quando faranno recall (essendo agent_id unico, dobbiamo decidere:
      // se vuoi cross-agent visibility, query con agent_id IN list o duplicare.
      // Per ora salviamo come 'auto-scan' separato → gli agent li vedranno
      // quando faremo query con agent_id IN ('kpi', 'auto-scan') in futuro.
      // Per ora, replichiamo gli insight su ogni agent principale per visibility
      // immediata (storage cost: trascurabile).
      const targetAgents = ['kpi', 'auto-scan', 'performance']
      for (const agentId of targetAgents) {
        await rememberBatch(insights.map(i => ({
          userId: c.user_id,
          agentId,
          content: `[Auto-scan ${date}] ${i.content}`,
          role: i.role,
          importance: i.importance,
          source: 'cron-scan',
        })))
      }

      results.push({ userId: c.user_id, insightsExtracted: insights.length })
    } catch (e) {
      results.push({ userId: c.user_id, error: e?.message })
    }
  }

  return NextResponse.json({
    ok: true,
    scannedAt: new Date().toISOString(),
    date,
    tenantsScanned: eligible.length,
    results,
  })
}

// Allow Vercel cron to fire via POST too (some setups use POST)
export const POST = GET
