export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { fitIncrementality, responseCurve, forecast } from '../../../lib/incrementality/model'
import { swrSnapshot } from '../../../lib/cache/swr'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'

// Chiama un endpoint interno inoltrando i cookie del tenant (riusa auth + cache).
async function internal(req, path) {
  try {
    const url = new URL(path, req.url)
    const r = await fetch(url, { headers: { cookie: req.headers.get('cookie') || '' }, cache: 'no-store', signal: AbortSignal.timeout(45000) })
    if (!r.ok) return null
    return await r.json().catch(() => null)
  } catch { return null }
}

const num = (v) => { if (v == null) return 0; const n = parseFloat(String(v).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0 }

// ShopifyQL con retry sul throttling (stesso pattern di /api/cro, /api/metrics).
async function shopifyQL(query) {
  const { storeUrl: STORE, adminToken: TOKEN } = getShopify()
  if (!STORE || !TOKEN) return []
  const gql = `query($q: String!) { shopifyqlQuery(query: $q) { tableData { columns { name } rows } parseErrors } }`
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`https://${STORE}/admin/api/2026-04/graphql.json`, {
        method: 'POST', headers: { 'X-Shopify-Access-Token': TOKEN || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: gql, variables: { q: query } }),
      })
      const json = await res.json().catch(() => null)
      const errs = json?.errors || []
      const ts = json?.extensions?.cost?.throttleStatus
      const throttled = res.status === 429 || errs.some(e => /throttl/i.test(e?.message || '')) || (ts && ts.currentlyAvailable === 0)
      if (throttled && attempt < 4) { await sleep(900 * attempt); continue }
      if (!res.ok || errs.length) return []
      const payload = json?.data?.shopifyqlQuery
      if (payload?.parseErrors?.length) return []
      const cols = payload?.tableData?.columns || []
      return (payload?.tableData?.rows || []).map(row => {
        if (!Array.isArray(row)) return row
        const o = {}; cols.forEach((c, i) => { o[c.name || `c${i}`] = row[i] }); return o
      })
    } catch { if (attempt < 4) { await sleep(900 * attempt); continue } return [] }
  }
  return []
}

// Serie giornaliera reale del ricavo Shopify (una riga per data).
async function fetchShopDaily(since, until) {
  const rows = await shopifyQL(`FROM sales SHOW total_sales GROUP BY day SINCE ${since} UNTIL ${until} ORDER BY day ASC`)
  return rows.map(r => {
    const date = String(r.day || r.date || r.c0 || '').slice(0, 10)
    return { date, revenue: num(r.total_sales ?? r.net_sales ?? r.gross_sales) }
  }).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const days = Math.min(365, Math.max(30, parseInt(searchParams.get('days') || '150', 10)))
  const locale = (searchParams.get('locale') || 'it').slice(0, 2)
  const until = new Date()
  const since = new Date(Date.now() - days * 86400000)
  const sIso = since.toISOString().slice(0, 10)
  const uIso = until.toISOString().slice(0, 10)

  return withTenantContext(req, async () => swrSnapshot(req, {
    tab: `incrementality_v5_${days}_${locale}`,
    ttlMs: 6 * 3600 * 1000,
    compute: async () => {
      const [meta, google, shopDaily] = await Promise.all([
        internal(req, `/api/meta-kpi?preset=custom&since=${sIso}&until=${uIso}`),
        internal(req, `/api/google-kpi?preset=custom&since=${sIso}&until=${uIso}`),
        fetchShopDaily(sIso, uIso),
      ])

      const byDate = new Map()
      for (const d of shopDaily) byDate.set(d.date, { date: d.date, revenue: d.revenue, channels: {}, attributed: {} })

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
        return { __noCache: true, ok: false, reason: !channels.length ? 'no_channels' : 'not_enough_data', days: rows.length, sources }
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
  }))
}
