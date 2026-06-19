export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { fitIncrementality, responseCurve, forecast } from '../../../lib/incrementality/model'
import { swrSnapshot } from '../../../lib/cache/swr'

// Chiama un endpoint interno inoltrando i cookie del tenant (riusa auth + cache).
async function internal(req, path) {
  try {
    const url = new URL(path, req.url)
    const r = await fetch(url, { headers: { cookie: req.headers.get('cookie') || '' }, cache: 'no-store', signal: AbortSignal.timeout(45000) })
    if (!r.ok) return null
    return await r.json().catch(() => null)
  } catch { return null }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const days = Math.min(365, Math.max(30, parseInt(searchParams.get('days') || '150', 10)))
  const locale = (searchParams.get('locale') || 'it').slice(0, 2)
  const until = new Date()
  const since = new Date(Date.now() - days * 86400000)
  const sIso = since.toISOString().slice(0, 10)
  const uIso = until.toISOString().slice(0, 10)

  return swrSnapshot(req, {
    tab: `incrementality_${days}_${locale}`,
    ttlMs: 6 * 3600 * 1000,
    compute: async () => {
      const [meta, google, metrics] = await Promise.all([
        internal(req, `/api/meta-kpi?preset=custom&since=${sIso}&until=${uIso}`),
        internal(req, `/api/google-kpi?preset=custom&since=${sIso}&until=${uIso}`),
        internal(req, `/api/metrics?preset=custom_${sIso}_${uIso}`),
      ])

      const shopDaily = metrics?.shopifyDayBreakdown || metrics?.shopify?.dayBreakdown || []
      const byDate = new Map()
      for (const d of shopDaily) {
        const date = d.date || d.day
        if (!date) continue
        byDate.set(date, { date, revenue: Number(d.revenue) || 0, channels: {}, attributed: {} })
      }

      const channels = []
      if (meta?.daily?.length) {
        channels.push('meta')
        for (const d of meta.daily) { const row = byDate.get(d.date); if (row) { row.channels.meta = Number(d.spend) || 0; row.attributed.meta = Number(d.revenue) || 0 } }
      }
      if (google?.daily?.length) {
        channels.push('google')
        for (const d of google.daily) { const row = byDate.get(d.date); if (row) { row.channels.google = Number(d.spend) || 0; row.attributed.google = Number(d.revenue ?? d.conversions_value) || 0 } }
      }

      const rows = [...byDate.values()].filter(r => r.date).sort((a, b) => a.date.localeCompare(b.date))
      const sources = { meta: channels.includes('meta'), google: channels.includes('google'), shopify: shopDaily.length > 0 }

      if (rows.length < 21 || !channels.length) {
        return { __noCache: true, ok: false, reason: rows.length < 21 ? 'not_enough_data' : 'no_channels', days: rows.length, sources }
      }

      const fit = fitIncrementality(rows, channels, {})
      if (!fit.ok) return { __noCache: true, ...fit, sources }

      const curves = {}
      for (const c of channels) curves[c] = responseCurve(fit, c)
      const fc = forecast(fit, Object.fromEntries(fit.channels.map(c => [c.key, c.avgSpend])), 4)

      const { _cfg, _beta, ...clean } = fit
      return {
        ok: true,
        range: { since: sIso, until: uIso, days },
        ...clean,
        curves,
        forecast: fc,
        channelNames: { meta: 'Meta', google: 'Google' },
        sources,
        updatedAt: new Date().toISOString(),
      }
    },
  })
}
