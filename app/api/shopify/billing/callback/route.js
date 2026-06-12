export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getCurrentUserId, invalidateTenantCache } from '../../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../../lib/supabase/server'

// Return URL dell'appSubscriptionCreate: Shopify ci rimanda qui dopo che il
// merchant approva. Verifichiamo che l'abbonamento sia ATTIVO e lo salviamo su
// companies (shopify_subscription_*), poi redirect in app.
export async function GET(req) {
  return withTenantContext(req, async () => {
    const url = new URL(req.url)
    const plan = url.searchParams.get('plan') || null
    const origin = req.headers.get('origin') || (req.headers.get('host') ? `https://${req.headers.get('host')}` : 'https://lyftai.io')

    const sh = getShopify()
    const userId = await getCurrentUserId()
    if (!sh?.storeUrl || !sh?.adminToken || !userId) {
      return NextResponse.redirect(`${origin}/?tab=settings&shopify_billing=error`)
    }

    try {
      const q = `{ currentAppInstallation { activeSubscriptions { id name status } } }`
      const r = await fetch(`https://${sh.storeUrl}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': sh.adminToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: AbortSignal.timeout(15000),
      })
      const j = await r.json()
      const subs = j?.data?.currentAppInstallation?.activeSubscriptions || []
      const active = subs.find(s => s.status === 'ACTIVE')

      if (active) {
        const admin = getAdminSupabase()
        if (admin) {
          const patch = { shopify_subscription_id: active.id, shopify_subscription_status: 'active', shopify_subscription_plan: plan, plan }
          const { data: upd } = await admin.from('companies').update(patch).eq('user_id', userId).select('user_id')
          if (!upd || upd.length === 0) await admin.from('companies').insert({ user_id: userId, ...patch })
          invalidateTenantCache(userId)
        }
        return NextResponse.redirect(`${origin}/?tab=dashboard&welcome=1`)
      }
      return NextResponse.redirect(`${origin}/?tab=settings&shopify_billing=pending`)
    } catch {
      return NextResponse.redirect(`${origin}/?tab=settings&shopify_billing=error`)
    }
  })
}
