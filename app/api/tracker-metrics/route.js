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

// Prova le varianti in ordine; torna { rows, used } della prima che risponde.
async function firstOk(variants) {
  for (const v of variants) {
    const rows = await shopifyQL(v.q)
    if (rows && rows.length) return { rows, used: v.name }
  }
  return { rows: null, used: null }
}

export async function GET(request) {
  return withTenantContext(request, async () => {
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since'), until = searchParams.get('until')
    if (!since || !until) return NextResponse.json({ error: 'since/until richiesti' }, { status: 400 })
    const R = `SINCE ${since} UNTIL ${until}`
    const H = { 'Cache-Control': 'private, no-store' }

    // Debug: eco di colonne e prime righe grezze di una query base, per
    // capire come questo store nomina colonne/dimensioni.
    if (searchParams.get('debug') === '1') {
      const probe = async (q) => {
        const rows = await shopifyQL(q)
        return { q, cols: rows?._cols || null, rows: (rows || []).slice(0, 4) }
      }
      return NextResponse.json({
        base: await probe(`FROM sales SHOW orders, total_sales ${R}`),
        chan: await probe(`FROM sales SHOW orders, total_sales GROUP BY sales_channel ${R}`),
        ct: await probe(`FROM sales SHOW orders, total_sales GROUP BY customer_type ${R}`),
      }, { headers: H })
    }

    const [tot, chan, ct, sess] = await Promise.all([
      firstOk([
        { name: 'units', q: `FROM sales SHOW orders, total_sales, ordered_item_quantity ${R}` },
        { name: 'base', q: `FROM sales SHOW orders, total_sales ${R}` },
      ]),
      firstOk([
        { name: 'sales_channel', q: `FROM sales SHOW orders, total_sales, ordered_item_quantity GROUP BY sales_channel ${R}` },
        { name: 'sales_channel_base', q: `FROM sales SHOW orders, total_sales GROUP BY sales_channel ${R}` },
        { name: 'channel', q: `FROM sales SHOW orders, total_sales GROUP BY channel ${R}` },
        { name: 'api_client_title', q: `FROM sales SHOW orders, total_sales GROUP BY api_client_title ${R}` },
      ]),
      firstOk([
        { name: 'ct_x_channel', q: `FROM sales SHOW orders, total_sales GROUP BY customer_type, sales_channel ${R}` },
        { name: 'ct', q: `FROM sales SHOW orders, total_sales GROUP BY customer_type ${R}` },
        { name: 'norc_x_channel', q: `FROM sales SHOW orders, total_sales GROUP BY new_or_returning_customer, sales_channel ${R}` },
        { name: 'norc', q: `FROM sales SHOW orders, total_sales GROUP BY new_or_returning_customer ${R}` },
      ]),
      firstOk([{ name: 'sessions', q: `FROM sessions SHOW sessions ${R}` }]),
    ])

    const t0 = (tot.rows || [])[0] || {}
    const channels = (chan.rows || []).map(r => ({
      name: r.sales_channel ?? r.channel ?? r.api_client_title ?? 'unknown',
      revenue: num(r.total_sales), orders: Math.round(num(r.orders)),
      units: r.ordered_item_quantity != null ? Math.round(num(r.ordered_item_quantity)) : null,
    }))
    const customerTypes = (ct.rows || []).map(r => ({
      type: r.customer_type ?? r.new_or_returning_customer ?? 'unknown',
      channel: r.sales_channel ?? null,
      revenue: num(r.total_sales), orders: Math.round(num(r.orders)),
    }))

    return NextResponse.json({
      range: { since, until },
      totals: {
        revenue: num(t0.total_sales), orders: Math.round(num(t0.orders)),
        units: t0.ordered_item_quantity != null ? Math.round(num(t0.ordered_item_quantity)) : null,
      },
      channels, customerTypes,
      sessions: Math.round(num(((sess.rows || [])[0] || {}).sessions)),
      chosen: { totals: tot.used, channels: chan.used, customerTypes: ct.used },
      source: 'shopifyql',
    }, { headers: H })
  })
}
