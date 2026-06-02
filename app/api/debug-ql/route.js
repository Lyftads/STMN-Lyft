export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { subDays } from 'date-fns'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN

// Diagnostica TEMPORANEA: misura la latenza di aggregazione del dataset
// `sales` di ShopifyQL, giorno per giorno sugli ultimi 12 giorni.
export async function GET() {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return NextResponse.json({ error: 'no creds' })

  const since = subDays(new Date(), 12).toISOString().slice(0, 10)
  const until = new Date().toISOString().slice(0, 10)

  const query = `FROM sales SHOW orders, total_sales SINCE ${since} UNTIL ${until} TIMESERIES day WITH CURRENCY 'EUR' ORDER BY day ASC LIMIT 50`

  const gql = `
    query($q: String!) {
      shopifyqlQuery(query: $q) {
        __typename
        ... on TableResponse { tableData { columns { name } rows } }
        ... on AnalyticsQueryErrorResponse { errors { code message } }
      }
    }
  `

  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: gql, variables: { q: query } }),
  })
  const json = await res.json()
  const payload = json?.data?.shopifyqlQuery
  const cols = (payload?.tableData?.columns || []).map(c => c.name)
  const rows = payload?.tableData?.rows || []

  const daily = rows.map(r => {
    const obj = {}
    cols.forEach((c, i) => { obj[c] = r[i] })
    return obj
  })

  return NextResponse.json({
    today: until,
    queriedSince: since,
    typename: payload?.__typename,
    gqlErrors: json?.errors || null,
    qlErrors: payload?.errors || null,
    columns: cols,
    daily,
  })
}
