export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN

export async function GET() {
  const token = SHOPIFY_TOKEN || ''
  const results = {}

  // Test 1: X-Shopify-Access-Token
  try {
    const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/shop.json`, { headers: { 'X-Shopify-Access-Token': token } })
    results.classic = { status: res.status, ok: res.ok, body: (await res.text()).slice(0,300) }
  } catch(e) { results.classic = { error: e.message } }

  // Test 2: Bearer
  try {
    const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/shop.json`, { headers: { 'Authorization': `Bearer ${token}` } })
    results.bearer = { status: res.status, ok: res.ok, body: (await res.text()).slice(0,300) }
  } catch(e) { results.bearer = { error: e.message } }

  // Test 3: Orders
  try {
    const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/orders/count.json`, { headers: { 'X-Shopify-Access-Token': token } })
    results.orders = { status: res.status, ok: res.ok, body: (await res.text()).slice(0,300) }
  } catch(e) { results.orders = { error: e.message } }

  return NextResponse.json({ store: SHOPIFY_STORE, token: token.slice(0,20)+'...', results })
}
