export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 20

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getCurrentUserId } from '../../../../../lib/tenant/credentials'
import { checkTenantShopifySubscription, invalidateShopifySubCache, managedPricingUrl } from '../../../../../lib/shopify/subscription'

// Stato abbonamento Shopify del tenant (Managed Pricing), letto live e
// persistito su companies. Usato dal client per sincronizzare l'accesso al
// ritorno dalla pagina prezzi e per ottenere l'URL prezzi gestita.
// ?refresh=1 → bypassa la cache del check.
export async function GET(req) {
  return withTenantContext(req, async () => {
    const url = new URL(req.url)
    const userId = await getCurrentUserId()
    const sh = getShopify()

    if (url.searchParams.get('refresh') === '1') invalidateShopifySubCache(userId)

    if (!sh?.storeUrl || !sh?.adminToken) {
      return NextResponse.json({ connected: false, active: false, plan: null, managedPricingUrl: null })
    }

    const val = await checkTenantShopifySubscription(userId, sh)
    return NextResponse.json({
      connected: true,
      active: val.active,
      plan: val.plan,
      planName: val.name,
      managedPricingUrl: managedPricingUrl(sh.storeUrl),
    })
  })
}
