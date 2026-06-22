export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'

// ============================================================================
//  Forecast — proiezione revenue + spesa + MER (di forecast revenue)
//
//  Metodologia:
//   - Pulisce le serie giornaliere (revenue Shopify + spend Meta).
//   - Fitta una regressione lineare semplice (least-squares) sui dati storici.
//   - Calcola anche EMA per smoothing.
//   - Genera proiezione N giorni con banda di confidenza ±2σ.
//   - Output: history + forecast (con confidence_low / confidence_high).
//
//  GET ?horizon=30 (default 30, max 90)
//      &history_days=90 (default 90)
// ============================================================================

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { searchParams } = new URL(req.url)
    const horizon = Math.min(90, Math.max(7, parseInt(searchParams.get('horizon') || '30', 10)))
    const historyDays = Math.min(180, Math.max(30, parseInt(searchParams.get('history_days') || '90', 10)))

    return swrSnapshot(req, { tab: 'forecast', compute: async () => {
    try {
      const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const cookieHeader = req.headers.get('cookie') || ''

      // Fetch revenue Shopify daily + Meta spend daily.
      const [metricsRes, metaRes] = await Promise.all([
        fetch(`${origin}/api/metrics?preset=last_90d`, {
          cache: 'no-store',
          headers: cookieHeader ? { cookie: cookieHeader } : {},
        }).then(r => r.json()),
        fetch(`${origin}/api/meta-kpi?preset=last_90d`, {
          cache: 'no-store',
          headers: cookieHeader ? { cookie: cookieHeader } : {},
        }).then(r => r.json()),
      ])

      const shopifyDaily = Array.isArray(metricsRes?.shopifyDailySeries) ? metricsRes.shopifyDailySeries : []
      const metaDaily = Array.isArray(metaRes?.daily) ? metaRes.daily : []

      // Merge per date.
      const merged = mergeDailySeries(shopifyDaily, metaDaily, historyDays)
      if (merged.length < 14) {
        return {
          horizon, history_days: historyDays,
          history: merged,
          forecast: [],
          warning: 'Dati insufficienti: servono almeno 14 giorni di storia',
          updatedAt: new Date().toISOString(),
        }
      }

      const forecastRevenue = forecastSeries(merged.map(d => d.revenue), horizon)
      const forecastSpend = forecastSeries(merged.map(d => d.spend), horizon)
      const lastDate = merged[merged.length - 1].date

      const forecast = []
      for (let i = 0; i < horizon; i++) {
        const d = addDays(lastDate, i + 1)
        const r = forecastRevenue[i]
        const s = forecastSpend[i]
        forecast.push({
          date: d,
          revenue: Math.max(0, Math.round(r.value)),
          revenue_low: Math.max(0, Math.round(r.low)),
          revenue_high: Math.max(0, Math.round(r.high)),
          spend: Math.max(0, Math.round(s.value)),
          spend_low: Math.max(0, Math.round(s.low)),
          spend_high: Math.max(0, Math.round(s.high)),
          mer: s.value > 0 ? +(r.value / s.value).toFixed(2) : 0,
        })
      }

      // Totali periodo forecast
      const proj_revenue = forecast.reduce((sum, d) => sum + d.revenue, 0)
      const proj_spend = forecast.reduce((sum, d) => sum + d.spend, 0)
      const proj_mer = proj_spend > 0 ? +(proj_revenue / proj_spend).toFixed(2) : 0

      // Vs periodo storico equivalente (ultimi N giorni)
      const recentRevenue = merged.slice(-horizon).reduce((s, d) => s + d.revenue, 0)
      const recentSpend = merged.slice(-horizon).reduce((s, d) => s + d.spend, 0)

      return {
        horizon, history_days: historyDays,
        history: merged,
        forecast,
        summary: {
          projected_revenue: proj_revenue,
          projected_spend: proj_spend,
          projected_mer: proj_mer,
          last_period_revenue: recentRevenue,
          last_period_spend: recentSpend,
          revenue_change_pct: recentRevenue > 0 ? +(((proj_revenue - recentRevenue) / recentRevenue) * 100).toFixed(1) : 0,
        },
        updatedAt: new Date().toISOString(),
      }
    } catch (err) {
      return {
        __noCache: true,
        error: err?.message || 'Errore',
        history: [], forecast: [],
      }
    }
    } })
  })
}

function mergeDailySeries(shopify, meta, takeLast) {
  const map = new Map()
  for (const d of shopify) {
    if (!d.date) continue
    map.set(d.date, { date: d.date, revenue: Number(d.revenue || 0), spend: 0 })
  }
  for (const d of meta) {
    if (!d.date) continue
    if (!map.has(d.date)) map.set(d.date, { date: d.date, revenue: 0, spend: 0 })
    map.get(d.date).spend = Number(d.spend || 0)
  }
  const arr = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  return arr.slice(-takeLast)
}

// Linear regression + sigma forecasting.
function forecastSeries(values, horizon) {
  const n = values.length
  if (n < 2) return Array(horizon).fill({ value: 0, low: 0, high: 0 })

  // Least-squares fit: y = a + b*x
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumXX += i * i
  }
  const meanX = sumX / n, meanY = sumY / n
  const denom = sumXX - n * meanX * meanX
  const b = denom !== 0 ? (sumXY - n * meanX * meanY) / denom : 0
  const a = meanY - b * meanX

  // Residuals + sigma per la banda di confidenza
  let sumSq = 0
  for (let i = 0; i < n; i++) {
    const yhat = a + b * i
    sumSq += (values[i] - yhat) ** 2
  }
  const sigma = Math.sqrt(sumSq / Math.max(1, n - 2))

  // EMA per smoothing del valore predetto (riduce overshoot)
  const alpha = 0.3
  let ema = values[0]
  for (let i = 1; i < n; i++) ema = alpha * values[i] + (1 - alpha) * ema

  const out = []
  for (let i = 0; i < horizon; i++) {
    const x = n + i
    const trend = a + b * x
    // Blend 70% trend / 30% ema (anchor sul livello recente)
    const value = 0.7 * trend + 0.3 * ema
    // Confidence band: ±2σ * sqrt(1 + horizon expansion)
    const band = 2 * sigma * Math.sqrt(1 + (i + 1) / n)
    out.push({
      value,
      low: value - band,
      high: value + band,
    })
  }
  return out
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
