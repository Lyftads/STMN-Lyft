export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../../../lib/tenant/credentials'
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
    const sh = getShopify()
    if (!sh?.storeUrl) {
      return NextResponse.json({ error: 'Shopify non collegato per questo account' }, { status: 400 })
    }
    const url = managedPricingUrl(sh.storeUrl)
    if (!url) {
      return NextResponse.json({ error: 'Impossibile costruire la pagina prezzi Shopify' }, { status: 502 })
    }
    return NextResponse.json({ confirmationUrl: url, managed: true })
  })
}
