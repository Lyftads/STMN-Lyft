export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { withTenantContext } from '../../../lib/tenant/credentials'
import {
  amazonConfigured, amazonEnv, getMarketplaceParticipations, getOrders,
} from '../../../lib/amazon/spapi'

// ============================================================================
//  Amazon SP-API — route diagnostica (Fase 1, solo sandbox).
//
//  GET            → { configured, env, marketplaces }
//  GET ?action=orders → ordini di test dal sandbox statico
//
//  GUARDIA: finché non esiste il collegamento per-tenant via Nango, questa
//  route risponde SOLO in sandbox (dati finti Amazon). In produzione tornerà
//  501 finché le credenziali non saranno per-workspace — mai env condivise
//  verso i clienti (regola multi-tenant).
// ============================================================================

export async function GET(request) {
  return withTenantContext(request, async () => {
    if (!amazonConfigured()) {
      return NextResponse.json({ configured: false, reason: 'env' })
    }
    if (amazonEnv() !== 'sandbox') {
      return NextResponse.json(
        { configured: true, error: 'per-tenant Amazon non ancora attivo' },
        { status: 501 },
      )
    }
    try {
      const action = new URL(request.url).searchParams.get('action')
      if (action === 'orders') {
        const orders = await getOrders({})
        return NextResponse.json({ configured: true, env: 'sandbox', orders })
      }
      const marketplaces = await getMarketplaceParticipations()
      return NextResponse.json({ configured: true, env: 'sandbox', marketplaces })
    } catch (e) {
      return NextResponse.json({ configured: true, env: 'sandbox', error: String(e.message || e) }, { status: 502 })
    }
  })
}
