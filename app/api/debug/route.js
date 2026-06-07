export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { format, subMonths, startOfMonth } from 'date-fns'
import { withTenantContext, getShopify, getCurrentUserId } from '../../../lib/tenant/credentials'

export async function GET() {
  return withTenantContext(null, async () => {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { storeUrl: SHOPIFY_STORE, adminToken: SHOPIFY_TOKEN } = getShopify()
    if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return NextResponse.json({ error: 'Shopify not configured' }, { status: 500 })

    const since = format(startOfMonth(subMonths(new Date(), 12)), 'yyyy-MM-dd')
    const until = format(new Date(), 'yyyy-MM-dd')

    const QUERY = `FROM sales SHOW orders, gross_sales, net_sales, total_sales, new_customers, returning_customers, orders_returning, total_sales_first_time, total_sales_returning TIMESERIES month WITH CURRENCY 'EUR' SINCE ${since} UNTIL ${until} ORDER BY month ASC LIMIT 100`

    const GQL = `{ shopifyqlQuery(query: ${JSON.stringify(QUERY)}) {
      __typename
      ... on TableResponse { tableData { headers rowData unformattedData } }
      ... on AnalyticsQueryErrorResponse { errors { code message } }
    } }`

    const results = {}

    for (const ver of ['2025-04', '2025-01', '2024-10', '2024-07', '2024-04', '2024-01']) {
      try {
        const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/${ver}/graphql.json`, {
          method: 'POST',
          headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: GQL }),
        })
        const json = await res.json()
        const qr = json?.data?.shopifyqlQuery
        results[ver] = {
          status: res.status,
          typename: qr?.__typename || null,
          gql_error: json?.errors?.[0]?.message || null,
          ql_errors: qr?.errors?.map(e => e.message) || null,
          headers: qr?.tableData?.headers || null,
          sample: (qr?.tableData?.unformattedData || qr?.tableData?.rowData || []).slice(0, 2),
        }
        if (qr?.__typename === 'TableResponse') break
      } catch (e) { results[ver] = { error: e.message } }
    }

    return NextResponse.json({ query: QUERY, results })
  })
}
