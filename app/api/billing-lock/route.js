export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 15

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { withTenantContext, getEffectiveTenantId } from '../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { isOrderGateExempt } from '../../../lib/team/orderGateExempt'
import { checkTenantShopifySubscription } from '../../../lib/shopify/subscription'

// ============================================================================
//  Lock d'accesso per abbonamento SCADUTO/NON RINNOVATO.
//
//  GET → { locked: boolean }
//  locked=true SOLO se il workspace ha avuto un billing (Stripe o Shopify
//  Managed Pricing) e ora NON ha nessun abbonamento attivo. Il frontend
//  (AppShell) in quel caso forza OGNI navigazione sulla tab Settings (piani).
//
//  Chi NON viene mai bloccato:
//   - esenti storici (owner STMN + LYFT_ORDER_GATE_EXEMPT, es. Saracino)
//   - workspace SENZA alcun record billing (demo, reviewer, workspace-cliente
//     delle agency: lì fattura l'agency, non il workspace)
//   - Stripe in grace period (past_due/incomplete: sta ritentando l'addebito)
//
//  Anti falso-blocco: se il DB dice "scaduto", PRIMA di bloccare rifacciamo il
//  check LIVE (Shopify GraphQL / Stripe API) — il webhook può essere in ritardo
//  proprio dopo un rinnovo.
// ============================================================================

const STRIPE_ACTIVE = new Set(['active', 'trialing', 'past_due', 'incomplete'])

export async function GET(request) {
  return withTenantContext(request, async () => {
    const userId = await getEffectiveTenantId()
    if (!userId) return NextResponse.json({ locked: false })
    if (isOrderGateExempt(userId)) return NextResponse.json({ locked: false, exempt: true })

    const admin = getAdminSupabase()
    if (!admin) return NextResponse.json({ locked: false })
    const { data: row } = await admin
      .from('companies')
      .select('stripe_customer_id, stripe_subscription_status, shopify_subscription_status')
      .eq('user_id', userId)
      .maybeSingle()
    if (!row) return NextResponse.json({ locked: false })

    const stripeConsidered = !!row.stripe_subscription_status
    const shopConsidered = row.shopify_subscription_status != null
    // Mai fatturato → nessun lock (account legacy/demo/agency-shadow).
    if (!stripeConsidered && !shopConsidered) return NextResponse.json({ locked: false })

    let stripeActive = stripeConsidered && STRIPE_ACTIVE.has(String(row.stripe_subscription_status))
    let shopActive = row.shopify_subscription_status === 'active'
    if (stripeActive || shopActive) return NextResponse.json({ locked: false })

    // Doppio check live prima di bloccare (stato DB potenzialmente stantio).
    if (shopConsidered && !shopActive) {
      try { const v = await checkTenantShopifySubscription(userId); if (v.fetched) shopActive = v.active } catch {}
    }
    if (!shopActive && stripeConsidered && row.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
        const subs = await stripe.subscriptions.list({ customer: row.stripe_customer_id, status: 'all', limit: 5 })
        stripeActive = (subs?.data || []).some(s => STRIPE_ACTIVE.has(s.status))
        if (stripeActive) {
          try { await admin.from('companies').update({ stripe_subscription_status: 'active' }).eq('user_id', userId) } catch {}
        }
      } catch {}
    }

    return NextResponse.json({ locked: !(stripeActive || shopActive) })
  })
}
