export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN

// Diagnostica TEMPORANEA: confronta la classificazione ShopifyQL
// (orders_first_time / orders_returning / total_sales) su piu' finestre
// candidate per gli "ultimi 7 giorni", per capire quale combacia col report.
async function ql(query) {
  const gql = `query($q:String!){ shopifyqlQuery(query:$q){ tableData{ columns{name} rows } parseErrors } }`
  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: gql, variables: { q: query } }),
  })
  const json = await res.json()
  const p = json?.data?.shopifyqlQuery
  return { rows: p?.tableData?.rows || [], parseErrors: p?.parseErrors || null, gqlErrors: json?.errors || null }
}

async function windowStats(since, until) {
  const q = `FROM sales SHOW orders_first_time, total_sales_first_time, orders_returning, total_sales_returning, orders, total_sales WHERE new_or_returning_customer IS NOT NULL SINCE ${since} UNTIL ${until} GROUP BY new_or_returning_customer WITH TOTALS, CURRENCY 'EUR' ORDER BY new_or_returning_customer ASC LIMIT 2`
  const { rows, parseErrors, gqlErrors } = await ql(q)
  let ncOrders = 0, rcOrders = 0, ncRev = 0, rcRev = 0, totOrders = 0, totRev = 0
  for (const r of rows) {
    const seg = String(r.new_or_returning_customer || '').toLowerCase()
    const o = Number(r.orders || 0)
    const ts = Number(r.total_sales || 0)
    totOrders += o; totRev += ts
    if (seg.includes('new') || seg.includes('first') || seg.includes('nuov')) { ncOrders += o; ncRev += ts }
    if (seg.includes('return') || seg.includes('ritorn')) { rcOrders += o; rcRev += ts }
  }
  return { since, until, ncOrders, rcOrders, ncRev: Math.round(ncRev), rcRev: Math.round(rcRev), totOrders, totRev: Math.round(totRev), parseErrors, gqlErrors, rawRows: rows }
}

export async function GET() {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return NextResponse.json({ error: 'no creds' })
  const windows = [
    ['2026-05-26', '2026-06-01'],
    ['2026-05-27', '2026-06-02'],
    ['2026-05-26', '2026-06-02'],
    ['2026-05-25', '2026-05-31'],
  ]
  const out = []
  for (const [s, u] of windows) out.push(await windowStats(s, u))
  return NextResponse.json({ note: 'report Shopify: NC=230 ord (18.938,61), RC=160 ord (13.201,61), tot 390 (32.140,22)', windows: out })
}
