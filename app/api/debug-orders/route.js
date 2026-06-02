export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { subDays } from 'date-fns'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN

// Diagnostica TEMPORANEA: verifica se la GraphQL Admin API restituisce
// customer.numberOfOrders (classificazione NC/RC affidabile per i giorni
// recenti che ShopifyQL non ha ancora consolidato). Da rimuovere dopo il fix.
export async function GET() {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) {
    return NextResponse.json({ error: 'no creds' })
  }

  const since = subDays(new Date(), 6).toISOString().slice(0, 10)
  const until = new Date().toISOString().slice(0, 10)

  const query = `
    query($q: String!, $cursor: String) {
      orders(first: 100, query: $q, after: $cursor) {
        edges {
          cursor
          node {
            id
            currentTotalPriceSet { shopMoney { amount } }
            customer { numberOfOrders }
          }
        }
        pageInfo { hasNextPage }
      }
    }
  `

  const q = `created_at:>=${since} created_at:<=${until} financial_status:paid`

  let cursor = null
  let pages = 0
  let total = 0
  let withCustomer = 0
  let withNumberOfOrders = 0
  let nc = 0
  let rc = 0
  let firstError = null
  let sampleNode = null

  try {
    while (pages < 6) {
      const res = await fetch(
        `https://${SHOPIFY_STORE}/admin/api/2024-01/graphql.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, variables: { q, cursor } }),
        }
      )
      const json = await res.json()
      if (json.errors) {
        firstError = JSON.stringify(json.errors).slice(0, 500)
        break
      }
      const conn = json.data?.orders
      const edges = conn?.edges || []
      for (const e of edges) {
        total++
        const n = e.node
        if (!sampleNode) sampleNode = n
        const num = n.customer?.numberOfOrders
        if (n.customer) withCustomer++
        if (num != null) withNumberOfOrders++
        const isNew = !num || Number(num) <= 1
        if (isNew) nc++
        else rc++
      }
      pages++
      if (!conn?.pageInfo?.hasNextPage) break
      cursor = edges[edges.length - 1]?.cursor
    }
  } catch (e) {
    firstError = e.message
  }

  return NextResponse.json({
    window: { since, until },
    pages,
    total,
    withCustomer,
    withNumberOfOrders,
    classified: { nc, rc },
    firstError,
    sampleNode,
  })
}
