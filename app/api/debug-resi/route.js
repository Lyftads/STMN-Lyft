export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN

// Diagnostica TEMPORANEA: confronta gross_sales / net_sales / total_sales /
// returns di ShopifyQL su una settimana consolidata, per stabilire se
// total_sales netta gia' i resi. Da rimuovere dopo.
export async function GET(req) {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return NextResponse.json({ error: 'no creds' })

  const { searchParams } = new URL(req.url)
  const since = searchParams.get('since') || '2026-05-04'
  const until = searchParams.get('until') || '2026-05-10'

  const q = `FROM sales SHOW gross_sales, net_sales, total_sales, returns, discounts, orders SINCE ${since} UNTIL ${until} WITH TOTALS, CURRENCY 'EUR'`

  const gql = `query($q:String!){ shopifyqlQuery(query:$q){ tableData{ columns{name} rows } parseErrors } }`

  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: gql, variables: { q } }),
  })
  const json = await res.json()
  const p = json?.data?.shopifyqlQuery
  const cols = (p?.tableData?.columns || []).map(c => c.name)
  const rows = p?.tableData?.rows || []

  return NextResponse.json({
    since, until,
    gqlErrors: json?.errors || null,
    parseErrors: p?.parseErrors || null,
    columns: cols,
    rowsRaw: rows,
  })
}
