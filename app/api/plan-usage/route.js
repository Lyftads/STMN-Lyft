export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 20

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getCurrentUserId } from '../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { recommendedTier, tierOf, planRank } from '../../../lib/team/orderTiers'

// Conta gli ordini degli ultimi 30 giorni (proxy "ordini/mese") via REST count,
// confronta con la fascia del piano corrente e segnala se è da fare upgrade.
export async function GET(request) {
  return withTenantContext(request, async () => {
    // piano corrente dal record companies
    let plan = null
    try {
      const userId = await getCurrentUserId()
      const admin = getAdminSupabase()
      if (userId && admin) {
        const { data } = await admin.from('companies').select('plan').eq('user_id', userId).maybeSingle()
        plan = data?.plan || null
      }
    } catch {}

    const sh = getShopify()
    if (!sh.storeUrl || !sh.adminToken) {
      return NextResponse.json({ plan, orders: null, configured: false })
    }

    const since = new Date(); since.setDate(since.getDate() - 30)
    const min = since.toISOString()
    const version = process.env.SHOPIFY_API_VERSION || '2024-10'
    let orders = null
    try {
      const url = `https://${sh.storeUrl}/admin/api/${version}/orders/count.json?status=any&created_at_min=${encodeURIComponent(min)}`
      const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': sh.adminToken } })
      const j = await r.json().catch(() => ({}))
      if (r.ok && typeof j.count === 'number') orders = j.count
    } catch {}

    if (orders == null) return NextResponse.json({ plan, orders: null, configured: true })

    const rec = recommendedTier(orders)
    const current = tierOf(plan)
    // "over" solo se c'è un piano corrente conosciuto e la fascia consigliata è superiore
    const over = !!current && planRank(rec.plan) > planRank(plan)

    return NextResponse.json({
      plan,
      orders,
      recommended: { plan: rec.plan, label: rec.label, price: rec.price },
      current: current ? { plan: current.plan, label: current.label, max: current.max === Infinity ? null : current.max } : null,
      over,
    })
  })
}
