export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { format, subDays } from 'date-fns'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN
const META_TOKEN    = process.env.META_ACCESS_TOKEN
const META_ACCOUNT  = process.env.META_AD_ACCOUNT_ID
const START_DATE    = '2026-04-01'

function shopifyAuth() {
  return { 'X-Shopify-Access-Token': SHOPIFY_TOKEN || '' }
}

// ── AOV: ultimi 30 giorni (veloce, per riferimento) ────────────
async function fetchAOV() {
  try {
    const since = subDays(new Date(), 30).toISOString()
    const res   = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250&fields=total_price`,
      { headers: shopifyAuth() }
    )
    if (!res.ok) return { aov: 0, orders: 0 }
    const data = await res.json()
    const ords = data.orders || []
    const rev  = ords.reduce((s,o) => s + parseFloat(o.total_price||0), 0)
    return { aov: ords.length > 0 ? rev/ords.length : 0, orders: ords.length }
  } catch { return { aov: 0, orders: 0 } }
}

// ── Meta spesa mensile ─────────────────────────────────────────
async function fetchMeta() {
  if (!META_TOKEN || !META_ACCOUNT) return []
  const accounts = META_ACCOUNT.split(',').map(s => s.trim()).filter(Boolean)
  try {
    const results = await Promise.all(accounts.map(async id => {
      const res  = await fetch(`https://graph.facebook.com/v19.0/${id}/insights?fields=spend&time_range={"since":"${START_DATE}","until":"${format(new Date(),'yyyy-MM-dd')}"}&time_increment=monthly&access_token=${META_TOKEN}`)
      const data = await res.json()
      if (data.error) { console.log('Meta:', data.error.message); return [] }
      return data.data || []
    }))
    const map = {}
    for (const rows of results)
      for (const d of rows) {
        const m = d.date_start?.slice(0,7)
        if (m) map[m] = (map[m]||0) + parseFloat(d.spend||0)
      }
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b))
      .map(([month,spend]) => ({ month, spend: Math.round(spend*100)/100 }))
  } catch { return [] }
}

export async function GET() {
  try {
    const [aovData, metaMonthly] = await Promise.all([fetchAOV(), fetchMeta()])
    const metaTotal = metaMonthly.reduce((s,m) => s+m.spend, 0)
    return NextResponse.json({
      aovLive:    Math.round(aovData.aov*100)/100,
      ordersLive: aovData.orders,
      metaSpend:  Math.round(metaTotal*100)/100,
      metaMonthly,
      sources: { shopify: aovData.orders > 0, meta: metaMonthly.length > 0 },
      updatedAt: new Date().toISOString(),
    })
  } catch(err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
