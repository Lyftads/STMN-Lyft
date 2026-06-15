export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getCurrentUserId } from '../../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../../lib/supabase/server'
import { managedPricingUrl } from '../../../../../lib/shopify/subscription'

// ============================================================================
//  Shopify Managed Pricing — il merchant sceglie/abbona un piano sulla pagina
//  prezzi GESTITA di Shopify (non più via appSubscriptionCreate, che Shopify
//  blocca per le Managed Pricing App). Qui ritorniamo l'URL della pagina prezzi;
//  il client redirige il merchant lì. Shopify gestisce addebito/trial/disdette
//  e, al ritorno in app, il gate legge l'abbonamento attivo via Admin API.
//  Policy 1.2.1: gli addebiti passano interamente da Shopify.
//  Manteniamo il campo `confirmationUrl` per compatibilità col client esistente.
// ============================================================================

export async function POST(req) {
  return withTenantContext(req, async () => {
    // Store dal resolver live; se manca (es. fetch Nango lenta/timeout) FALLBACK
    // su companies.shopify_store_url (DB, veloce) → il pulsante "cambia piano"
    // non fallisce più con "Shopify non collegato".
    let storeUrl = getShopify()?.storeUrl || null
    if (!storeUrl) {
      try {
        const userId = await getCurrentUserId()
        const admin = getAdminSupabase()
        if (userId && admin) {
          const { data } = await admin.from('companies').select('shopify_store_url').eq('user_id', userId).maybeSingle()
          storeUrl = data?.shopify_store_url || null
        }
      } catch {}
    }
    if (!storeUrl) {
      return NextResponse.json({ error: 'Shopify non collegato per questo account' }, { status: 400 })
    }
    const url = managedPricingUrl(storeUrl)
    if (!url) {
      return NextResponse.json({ error: 'Impossibile costruire la pagina prezzi Shopify' }, { status: 502 })
    }
    return NextResponse.json({ confirmationUrl: url, managed: true })
  })
}
