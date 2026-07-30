export const dynamic = 'force-dynamic'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'

// ── Tracker metrics (ShopifyQL) ─────────────────────────────────────────────
// Metriche aggregate su range arbitrario per i tracker/report esterni:
//  - totale (revenue, ordini, unità)
//  - split per CANALE di vendita (es. Online Store vs Amazon)
//  - split nuovi/ritornanti (con revenue), se possibile per canale
//  - sessioni
// GET ?since=YYYY-MM-DD&until=YYYY-MM-DD
// I nomi delle dimensioni ShopifyQL variano tra store/versioni → si provano
// in ordine e si usa la prima che risponde senza parseErrors.

const num = (v) => {
  if (v == null) return 0
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

async function shopifyQL(query) {
  const { storeUrl: STORE, adminToken: TOKEN } = getShopify()
  if (!STORE || !TOKEN) return null
  const gql = `query($q: String!) { shopifyqlQuery(query: $q) { tableData { columns { name } rows } parseErrors } }`
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`https://${STORE}/admin/api/2026-04/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': TOKEN || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: gql, variables: { q: query } }),
      })
      const json = await res.json().catch(() => null)
      const errs = json?.errors || []
      const ts = json?.extensions?.cost?.throttleStatus
      const throttled = res.status === 429 || errs.some(e => /throttl/i.test(e?.message || '') || e?.extensions?.code === 'THROTTLED') || (ts && ts.currentlyAvailable === 0)
      if (throttled && attempt < 4) { await sleep(900 * attempt); continue }
      if (!res.ok || errs.length) return null
      const payload = json?.data?.shopifyqlQuery
      if (payload?.parseErrors?.length) return null
      const cols = payload?.tableData?.columns || []
      const rows = (payload?.tableData?.rows || []).map(row => {
        const o = {}
        cols.forEach((c, i) => { o[c.name || `c${i}`] = Array.isArray(row) ? row[i] : row?.[c.name] })
        return o
      })
      rows._cols = cols.map(c => c.name)
      return rows
    } catch { if (attempt < 4) { await sleep(900 * attempt); continue } return null }
  }
  return null
}

export async function GET(request) {
  return withTenantContext(request, async () => {
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since'), until = searchParams.get('until')
    if (!since || !until) return NextResponse.json({ error: 'since/until richiesti' }, { status: 400 })
    const R = `SINCE ${since} UNTIL ${until}`
    const H = { 'Cache-Control': 'private, no-store' }

    // Query verificate empiricamente su questo tipo di store (30 lug 2026):
    // dimensioni valide = sales_channel, new_or_returning_customer; unità =
    // net_items_sold. (customer_type / ordered_item_quantity NON esistono.)
    const [tot, chan, units, ct, sess] = await Promise.all([
      shopifyQL(`FROM sales SHOW orders, total_sales, net_items_sold ${R}`),
      shopifyQL(`FROM sales SHOW orders, total_sales GROUP BY sales_channel ${R}`),
      shopifyQL(`FROM sales SHOW net_items_sold GROUP BY sales_channel ${R}`),
      shopifyQL(`FROM sales SHOW orders, total_sales GROUP BY new_or_returning_customer, sales_channel ${R}`),
      shopifyQL(`FROM sessions SHOW sessions ${R}`),
    ])

    const t0 = (tot || [])[0] || {}
    const unitsBy = {}
    for (const r of (units || [])) unitsBy[r.sales_channel] = Math.round(num(r.net_items_sold))
    const channels = (chan || []).map(r => ({
      name: r.sales_channel || 'unknown',
      revenue: num(r.total_sales), orders: Math.round(num(r.orders)),
      units: unitsBy[r.sales_channel] ?? null,
    }))
    const customerTypes = (ct || []).map(r => ({
      type: r.new_or_returning_customer || 'unknown',
      channel: r.sales_channel || null,
      revenue: num(r.total_sales), orders: Math.round(num(r.orders)),
    }))

    return NextResponse.json({
      range: { since, until },
      totals: {
        revenue: num(t0.total_sales), orders: Math.round(num(t0.orders)),
        units: t0.net_items_sold != null ? Math.round(num(t0.net_items_sold)) : null,
      },
      channels, customerTypes,
      sessions: Math.round(num(((sess || [])[0] || {}).sessions)),
      source: (tot && tot.length) ? 'shopifyql' : 'empty',
    }, { headers: H })
  })
}
