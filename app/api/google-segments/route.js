export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getGoogle } from '../../../lib/tenant/credentials'
import { getRange } from '../../../lib/metaRange'
import { swrSnapshot } from '../../../lib/cache/swr'

// ============================================================================
//  Google — nuovi vs ritornanti (segmento nativo GAQL
//  new_versus_returning_customers). A differenza di Meta, Google NON separa il
//  COSTO per tipo cliente (il costo è per click, non per cliente): segmenta solo
//  le CONVERSIONI. Quindi:
//    CAC nuovi (Google) = spesa Google totale / conversioni NUOVI clienti.
//  Difensivo: se il segmento non è disponibile sull'account (serve l'obiettivo
//  "Customer Acquisition" / dati nuovo-vs-ritorno), torna available:false.
//  GET ?preset=last_28d | ?preset=custom&since=&until=
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

// Enum new_versus_returning_customers → bucket
function bucketOf(v) {
  const s = String(v || '').toUpperCase()
  if (s === 'NEW') return 'new'
  if (s === 'RETURNING') return 'returning'
  return 'unknown'
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

    return swrSnapshot(req, { tab: 'googleSegments', ttlMs: 30 * 60 * 1000, compute: async () => {
      try {
        const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)
        const { GoogleAdsServiceClient } = await import('google-ads-node')
        const grpc = await import('@grpc/grpc-js')
        const client = new GoogleAdsServiceClient({ sslCreds: grpc.credentials.createSsl(), servicePath: 'googleads.googleapis.com', port: 443 })
        const callOptions = { otherArgs: { headers: { authorization: `Bearer ${accessToken}`, 'developer-token': DEVELOPER_TOKEN, ...(MCC_ID ? { 'login-customer-id': MCC_ID } : {}) } } }

        // Costo totale del periodo (Google non lo separa per tipo cliente)
        let totalSpend = 0
        try {
          const [costResp] = await client.search({ customer_id: CUSTOMER_ID, query: `SELECT metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'` }, callOptions)
          for (const row of (costResp || [])) totalSpend += micros(row?.metrics?.costMicros ?? row?.metrics?.cost_micros)
        } catch {}

        // Conversioni per segmento nuovo/ritorno
        const agg = {}
        let segAvailable = true
        try {
          const [resp] = await client.search({ customer_id: CUSTOMER_ID, query: `SELECT segments.new_versus_returning_customers, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'` }, callOptions)
          for (const row of (resp || [])) {
            const b = bucketOf(row?.segments?.newVersusReturningCustomers ?? row?.segments?.new_versus_returning_customers)
            if (!agg[b]) agg[b] = { conversions: 0, value: 0 }
            agg[b].conversions += num(row?.metrics?.conversions)
            agg[b].value += num(row?.metrics?.conversionsValue ?? row?.metrics?.conversions_value)
          }
        } catch { segAvailable = false }

        const newConv = agg.new?.conversions || 0
        const hasNew = segAvailable && newConv > 0
        const seg = (b) => {
          const s = agg[b] || { conversions: 0, value: 0 }
          return { conversions: r2(s.conversions), value: r2(s.value), roas: totalSpend > 0 ? r2(s.value / totalSpend) : 0 }
        }

        return {
          ok: true, configured: true, available: hasNew, preset, range,
          totalSpend: r2(totalSpend),
          segments: { new: seg('new'), returning: seg('returning'), unknown: seg('unknown') },
          // Google non separa il costo per cliente → CAC nuovi = spesa totale / nuovi clienti
          cacNew: hasNew ? r2(totalSpend / newConv) : null,
          updatedAt: new Date().toISOString(),
        }
      } catch (err) {
        return { __noCache: true, ok: false, configured: true, available: false, error: String(err?.message || err) }
      }
    } })
  })
}
