export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'
import { getRange } from '../../../lib/metaRange'
import { swrSnapshot } from '../../../lib/cache/swr'
import { KOONGO_EXCLUDE } from '../../../lib/shopify/koongo'
import { shopifyql } from '../../../lib/shopify/shopifyql'

// ============================================================================
//  Fasce orarie migliori per ogni giorno della settimana.
//
//  Due fonti Shopify, incrociate per giorno × ora:
//   - `sales`    → ordini e fatturato (senza marketplace: un ordine Amazon non
//                  ha una visita sul sito, e sporcherebbe la conversione);
//   - `sessions` → visite e tasso di conversione della sessione.
//  L'ora e' quella del NEGOZIO (fuso orario impostato su Shopify).
//  ShopifyQL numera i giorni da 0 = lunedi' a 6 = domenica (verificato).
//
//  Le 24 ore si raggruppano in fasce, perche' un'ora singola in un mese ha
//  pochi ordini e il "picco" sarebbe rumore: la fascia regge il confronto.
//
//  GET ?since=YYYY-MM-DD&until=YYYY-MM-DD   oppure   ?preset=last_30d
// ============================================================================

const BANDS = [
  { key: '00-06', from: 0, to: 6 },
  { key: '06-09', from: 6, to: 9 },
  { key: '09-12', from: 9, to: 12 },
  { key: '12-15', from: 12, to: 15 },
  { key: '15-18', from: 15, to: 18 },
  { key: '18-21', from: 18, to: 21 },
  { key: '21-24', from: 21, to: 24 },
]
// Sotto questa soglia di visite la conversione di una fascia non si mette in
// classifica: 2 ordini su 20 visite fanno 10% e vincerebbero per caso.
const MIN_SESSIONS_CRO = 40

const money = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0 }
const count = (v) => { const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(n * 100) / 100
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Errori propagati: una query fallita NON deve diventare "nessuna visita".
// Dalla porta unica (lib/shopify/shopifyql.js): cache per interrogazione, passo al minuto,
// ultimo dato buono se Shopify rifiuta. Il vecchio ritento locale non riconosceva "Rate limited".
async function shopifyQL(q) {
  return shopifyql(q)
}

function resolveRange(sp) {
  const since = sp.get('since'), until = sp.get('until')
  if (since && until) return { since, until }
  const preset = sp.get('preset') || 'last_30d'
  const m = preset.match(/^custom_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/)
  if (m) return { since: m[1], until: m[2] }
  return getRange(preset, sp)
}

// Quante volte ogni giorno della settimana cade nel periodo: serve a leggere le
// medie ("un martedi' tipo") e non solo i totali, che premiano il giorno che
// nel periodo capita piu' volte.
function weekdayOccurrences(range) {
  const occ = [0, 0, 0, 0, 0, 0, 0]
  for (let d = new Date(`${range.since}T00:00:00Z`); d <= new Date(`${range.until}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    occ[(d.getUTCDay() + 6) % 7]++ // JS: 0=domenica → 0=lunedi'
  }
  return occ
}

async function compute(range) {
  const salesRows = await shopifyQL(`FROM sales SHOW orders, total_sales WHERE ${KOONGO_EXCLUDE} GROUP BY day_of_week, hour_of_day SINCE ${range.since} UNTIL ${range.until} ORDER BY day_of_week, hour_of_day LIMIT 500`)
  const sessRows = await shopifyQL(`FROM sessions SHOW sessions, conversion_rate GROUP BY day_of_week, hour_of_day SINCE ${range.since} UNTIL ${range.until} ORDER BY day_of_week, hour_of_day LIMIT 500`)

  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, (_, h) => ({ hour: h, sessions: 0, orders: 0, revenue: 0, convSessions: 0 })))
  for (const r of salesRows) {
    const d = count(r.day_of_week), h = count(r.hour_of_day)
    if (d < 0 || d > 6 || h < 0 || h > 23) continue
    grid[d][h].orders += count(r.orders)
    grid[d][h].revenue += money(r.total_sales)
  }
  for (const r of sessRows) {
    const d = count(r.day_of_week), h = count(r.hour_of_day)
    if (d < 0 || d > 6 || h < 0 || h > 23) continue
    const s = count(r.sessions)
    grid[d][h].sessions += s
    // conversion_rate e' la quota di sessioni che hanno comprato: ricavo il
    // numero di sessioni convertite, cosi' le fasce si sommano correttamente.
    grid[d][h].convSessions += s * (parseFloat(r.conversion_rate) || 0)
  }

  const occ = weekdayOccurrences(range)
  const cro = (conv, sess) => sess > 0 ? r2((conv / sess) * 100) : null

  const days = grid.map((hours, dow) => {
    const bands = BANDS.map(b => {
      const slice = hours.slice(b.from, b.to)
      const sessions = slice.reduce((s, x) => s + x.sessions, 0)
      const orders = slice.reduce((s, x) => s + x.orders, 0)
      const revenue = slice.reduce((s, x) => s + x.revenue, 0)
      const conv = slice.reduce((s, x) => s + x.convSessions, 0)
      return { band: b.key, from: b.from, to: b.to, sessions, orders, revenue: r2(revenue), cro: cro(conv, sessions) }
    })
    const tot = bands.reduce((a, b) => ({ sessions: a.sessions + b.sessions, orders: a.orders + b.orders, revenue: a.revenue + b.revenue }), { sessions: 0, orders: 0, revenue: 0 })
    const conv = hours.reduce((s, x) => s + x.convSessions, 0)
    const top = (key, pool = bands) => pool.length ? pool.reduce((a, b) => ((b[key] ?? -1) > (a[key] ?? -1) ? b : a)) : null
    const croPool = bands.filter(b => b.sessions >= MIN_SESSIONS_CRO && b.cro != null)
    const bestOrders = top('orders')
    return {
      dow,
      occurrences: occ[dow],
      totals: { sessions: tot.sessions, orders: tot.orders, revenue: r2(tot.revenue), cro: cro(conv, tot.sessions) },
      bands,
      best: {
        orders: bestOrders && bestOrders.orders > 0 ? bestOrders.band : null,
        sessions: (top('sessions')?.sessions || 0) > 0 ? top('sessions').band : null,
        cro: croPool.length ? top('cro', croPool).band : null,
      },
      hours: hours.map(x => ({ hour: x.hour, sessions: x.sessions, orders: x.orders, revenue: r2(x.revenue), cro: cro(x.convSessions, x.sessions) })),
    }
  })

  const all = days.reduce((a, d) => ({ sessions: a.sessions + d.totals.sessions, orders: a.orders + d.totals.orders, revenue: a.revenue + d.totals.revenue }), { sessions: 0, orders: 0, revenue: 0 })
  return {
    ok: true, range, bands: BANDS.map(b => b.key), minSessionsForCro: MIN_SESSIONS_CRO,
    marketplaceExcluded: true, timezone: 'shop',
    totals: { ...all, revenue: r2(all.revenue) },
    days,
    updatedAt: new Date().toISOString(),
  }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { storeUrl, adminToken } = getShopify()
    if (!storeUrl || !adminToken) return NextResponse.json({ ok: false, configured: false, error: 'Shopify non collegato' })
    const { searchParams } = new URL(req.url)
    const range = resolveRange(searchParams)
    if (!range?.since || !range?.until) return NextResponse.json({ ok: false, error: 'Periodo non valido' }, { status: 400 })
    return swrSnapshot(req, { tab: 'hourlySales', ttlMs: 30 * 60 * 1000, compute: async () => {
      try { return await compute(range) }
      catch (e) { return { ok: false, error: e?.message || 'Errore Shopify', range, __noCache: true } }
    } })
  })
}
