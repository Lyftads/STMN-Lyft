export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { subDays } from 'date-fns'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN

function shopifyAuth() {
  return { 'X-Shopify-Access-Token': SHOPIFY_TOKEN || '' }
}

// Diagnostica TEMPORANEA: ispeziona la classificazione NC/RC sul fallback
// Admin Orders per gli ultimi 7 giorni. Da rimuovere dopo il fix.
export async function GET() {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) {
    return NextResponse.json({ error: 'no creds' })
  }

  const since = subDays(new Date(), 6).toISOString().slice(0, 10)
  const until = new Date().toISOString().slice(0, 10)

  const url =
    `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json` +
    `?status=any&financial_status=paid` +
    `&created_at_min=${since}T00:00:00Z&created_at_max=${until}T23:59:59Z` +
    `&limit=250&fields=id,total_price,email,customer,financial_status`

  const res = await fetch(url, { headers: shopifyAuth() })
  const data = await res.json()
  const orders = data.orders || []

  let withCustomer = 0
  let withOrdersCount = 0
  let nc = 0
  let rc = 0
  let withEmail = 0

  for (const o of orders) {
    if (o.email) withEmail++
    if (o.customer) withCustomer++
    const oc = o.customer?.orders_count
    if (oc != null) withOrdersCount++
    const isNew = !oc || Number(oc) <= 1
    if (isNew) nc++
    else rc++
  }

  // campione del primo ordine per vedere la forma reale del customer
  const sample = orders[0]
    ? {
        id: orders[0].id,
        email_present: !!orders[0].email,
        customer_keys: orders[0].customer ? Object.keys(orders[0].customer) : null,
        customer_orders_count: orders[0].customer?.orders_count ?? null,
      }
    : null

  return NextResponse.json({
    httpStatus: res.status,
    window: { since, until },
    totalOrders: orders.length,
    withEmail,
    withCustomer,
    withOrdersCount,
    classified: { nc, rc },
    sample,
  })
}
