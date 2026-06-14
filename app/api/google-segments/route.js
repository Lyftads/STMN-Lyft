export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getGoogle } from '../../../lib/tenant/credentials'
import { getRange } from '../../../lib/metaRange'
import { swrSnapshot } from '../../../lib/cache/swr'

// ============================================================================
//  Google — nuovi vs ritornanti (segmento nativo new_versus_returning_customers).
//  Google segmenta solo le CONVERSIONI per tipo cliente, NON il costo. Quindi:
//    CAC nuovi (Google) = spesa Google totale / conversioni NUOVI clienti.
//  Ritorna: segments (conv/valore) + cacNew + daily (cac/giorno) + cacNewPrev
//  (stesso periodo precedente, per il delta %). Difensivo: available:false se il
//  segmento non è popolato (serve l'obiettivo Customer Acquisition).
// ============================================================================

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(num(n) * 100) / 100
const micros = (v) => num(v) / 1e6

async function getAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('OAuth failed')
  return data.access_token
}

function bucketOf(v) {
  const s = String(v || '').toUpperCase()
  if (s === 'NEW') return 'new'
  if (s === 'RETURNING') return 'returning'
  return 'unknown'
}

// Conversioni per segmento + costo totale su un range
async function periodData(client, CUSTOMER_ID, callOptions, range) {
  let totalSpend = 0
  try {
    const [costResp] = await client.search({ customer_id: CUSTOMER_ID, query: `SELECT metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'` }, callOptions)
    for (const row of (costResp || [])) totalSpend += micros(row?.metrics?.costMicros ?? row?.metrics?.cost_micros)
  } catch {}
  const agg = {}; let segAvailable = true
  try {
    const [resp] = await client.search({ customer_id: CUSTOMER_ID, query: `SELECT segments.new_versus_returning_customers, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'` }, callOptions)
    for (const row of (resp || [])) {
      const b = bucketOf(row?.segments?.newVersusReturningCustomers ?? row?.segments?.new_versus_returning_customers)
      if (!agg[b]) agg[b] = { conversions: 0, value: 0 }
      agg[b].conversions += num(row?.metrics?.conversions)
      agg[b].value += num(row?.metrics?.conversionsValue ?? row?.metrics?.conversions_value)
    }
  } catch { segAvailable = false }
  return { totalSpend, agg, segAvailable }
}

// CAC nuovi per giorno = costo del giorno / conversioni NUOVI del giorno
async function dailyCac(client, CUSTOMER_ID, callOptions, range) {
  const costByDay = {}, newConvByDay = {}
  try {
    const [r1] = await client.search({ customer_id: CUSTOMER_ID, query: `SELECT segments.date, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'` }, callOptions)
    for (const row of (r1 || [])) { const d = row?.segments?.date; if (d) costByDay[d] = (costByDay[d] || 0) + micros(row?.metrics?.costMicros ?? row?.metrics?.cost_micros) }
  } catch {}
  try {
    const [r2q] = await client.search({ customer_id: CUSTOMER_ID, query: `SELECT segments.date, segments.new_versus_returning_customers, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'` }, callOptions)
    for (const row of (r2q || [])) {
      const d = row?.segments?.date
      const b = bucketOf(row?.segments?.newVersusReturningCustomers ?? row?.segments?.new_versus_returning_customers)
      if (d && b === 'new') newConvByDay[d] = (newConvByDay[d] || 0) + num(row?.metrics?.conversions)
    }
  } catch {}
  return Object.keys(costByDay).sort().map(d => ({ date: d, cac: newConvByDay[d] > 0 ? r2(costByDay[d] / newConvByDay[d]) : null }))
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const g = getGoogle()
    const CLIENT_ID = g.clientId, CLIENT_SECRET = g.clientSecret, REFRESH_TOKEN = g.refreshToken
    const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    const CUSTOMER_ID = (g.adsCustomerId || '').replace(/-/g, '')
    const MCC_ID = (g.adsMccId || '').replace(/-/g, '')
    if (!DEVELOPER_TOKEN || !CUSTOMER_ID || !REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
      return NextResponse.json({ ok: false, configured: false })
    }
    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('preset') || 'last_28d'
    const range = getRange(preset, searchParams)
    const d0 = new Date(`${range.since}T00:00:00Z`), d1 = new Date(`${range.until}T00:00:00Z`)
    const len = Math.round((d1 - d0) / 86400000) + 1
    const prevUntil = new Date(d0.getTime() - 86400000)
    const prevSince = new Date(prevUntil.getTime() - (len - 1) * 86400000)
    const prevRange = { since: prevSince.toISOString().slice(0, 10), until: prevUntil.toISOString().slice(0, 10) }

    return swrSnapshot(req, { tab: 'googleSegments', ttlMs: 30 * 60 * 1000, compute: async () => {
      try {
        const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)
        const { GoogleAdsServiceClient } = await import('google-ads-node')
        const grpc = await import('@grpc/grpc-js')
        const client = new GoogleAdsServiceClient({ sslCreds: grpc.credentials.createSsl(), servicePath: 'googleads.googleapis.com', port: 443 })
        const callOptions = { otherArgs: { headers: { authorization: `Bearer ${accessToken}`, 'developer-token': DEVELOPER_TOKEN, ...(MCC_ID ? { 'login-customer-id': MCC_ID } : {}) } } }

        const [cur, prev, daily] = await Promise.all([
          periodData(client, CUSTOMER_ID, callOptions, range),
          periodData(client, CUSTOMER_ID, callOptions, prevRange),
          dailyCac(client, CUSTOMER_ID, callOptions, range),
        ])

        const newConv = cur.agg.new?.conversions || 0
        const hasNew = cur.segAvailable && newConv > 0
        const seg = (b) => { const s = cur.agg[b] || { conversions: 0, value: 0 }; return { conversions: r2(s.conversions), value: r2(s.value), roas: cur.totalSpend > 0 ? r2(s.value / cur.totalSpend) : 0 } }
        const newConvPrev = prev.agg.new?.conversions || 0
        const cacNewPrev = newConvPrev > 0 ? r2(prev.totalSpend / newConvPrev) : null

        return {
          ok: true, configured: true, available: hasNew, preset, range,
          totalSpend: r2(cur.totalSpend),
          segments: { new: seg('new'), returning: seg('returning'), unknown: seg('unknown') },
          cacNew: hasNew ? r2(cur.totalSpend / newConv) : null,
          cacNewPrev,
          daily,
          updatedAt: new Date().toISOString(),
        }
      } catch (err) {
        return { __noCache: true, ok: false, configured: true, available: false, error: String(err?.message || err) }
      }
    } })
  })
}
