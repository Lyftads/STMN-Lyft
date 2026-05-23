export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN

function shopifyAuth() {
  return { 'X-Shopify-Access-Token': SHOPIFY_TOKEN || '' }
}

export async function GET() {
  const results = {}

  // Test ShopifyQL — vediamo esattamente cosa restituisce
  const salesQuery = `FROM sales SHOW orders, gross_sales, average_order_value TIMESERIES month SINCE 2026-04-01 UNTIL 2026-05-31`
  const custQuery  = `FROM customers SHOW new_customers TIMESERIES month SINCE 2026-04-01 UNTIL 2026-05-31`

  const runQuery = async (q) => {
    const gql = `{ shopifyqlQuery(query: "${q.replace(/"/g,'\\\"')}") { __typename ... on TableResponse { tableData { headers rowData unformattedData } } ... on AnalyticsQueryErrorResponse { errors { code message } } } }`
    const res  = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: { ...shopifyAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gql })
    })
    return { status: res.status, body: await res.json() }
  }

  try { results.shopifyql_sales     = await runQuery(salesQuery) } catch(e) { results.shopifyql_sales = { error: e.message } }
  try { results.shopifyql_customers = await runQuery(custQuery)  } catch(e) { results.shopifyql_customers = { error: e.message } }

  // Test ordini count mese
  try {
    const res  = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/orders/count.json?status=any&financial_status=paid&created_at_min=2026-05-01T00:00:00Z&created_at_max=2026-05-31T23:59:59Z`, { headers: shopifyAuth() })
    results.orders_may_2026 = { status: res.status, body: await res.json() }
  } catch(e) { results.orders_may_2026 = { error: e.message } }

  // Test nuovi clienti maggio
  try {
    const res  = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/customers/count.json?created_at_min=2026-05-01T00:00:00Z&created_at_max=2026-05-31T23:59:59Z`, { headers: shopifyAuth() })
    results.new_customers_may_2026 = { status: res.status, body: await res.json() }
  } catch(e) { results.new_customers_may_2026 = { error: e.message } }

  return NextResponse.json({ store: SHOPIFY_STORE, results })
}
