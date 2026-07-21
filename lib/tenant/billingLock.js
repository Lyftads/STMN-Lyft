// ============================================================================
//  Blocco duro lato server per abbonamento SCADUTO (enforcement API).
//
//  Complementare al gate di navigazione (AppShell + /api/billing-lock): qui
//  OGNI route dati che passa da withTenantContext risponde 402 se il workspace
//  aveva un billing (Stripe o Shopify Managed Pricing) e ora non ha nessun
//  abbonamento attivo — anche a chi chiama le API direttamente.
//
//  Decisione DB-only (niente check live qui): il doppio check live anti
//  falso-blocco vive in /api/billing-lock, che la shell chiama a ogni accesso
//  e che aggiorna il DB + invalida questa cache appena trova un rinnovo.
//  In caso di errore DB NON si blocca mai (fail-open: meglio un accesso in
//  più che un cliente pagante chiuso fuori).
//
//  Esenzioni (identiche al gate di navigazione):
//   - isOrderGateExempt (owner STMN + LYFT_ORDER_GATE_EXEMPT, es. Saracino)
//   - workspace senza alcun record billing (demo/reviewer/workspace agency)
//   - grace period Stripe (past_due/incomplete)
// ============================================================================

import { getAdminSupabase } from '../supabase/server'
import { isOrderGateExempt } from '../team/orderGateExempt'

const STRIPE_ACTIVE = new Set(['active', 'trialing', 'past_due', 'incomplete'])

// Route che restano SEMPRE accessibili anche da bloccati: tutto ciò che serve
// per vedere i piani, pagare, gestire l'account e far girare la shell.
export const BILLING_LOCK_ALLOW = [
  '/api/billing-lock',
  '/api/stripe',
  '/api/plan-gate',
  '/api/shopify/billing',
  '/api/account',
  '/api/integrations/status',
  '/api/workspaces',
  '/api/geo',
]

const cache = new Map() // userId → { locked, at }
const TTL_MS = 60_000

export function invalidateBillingLock(userId) {
  if (userId) cache.delete(userId)
  else cache.clear()
}

export async function isBillingLocked(userId) {
  if (!userId) return false
  if (isOrderGateExempt(userId)) return false
  const hit = cache.get(userId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.locked

  let locked = false
  try {
    const admin = getAdminSupabase()
    if (admin) {
      const { data: row } = await admin
        .from('companies')
        .select('stripe_subscription_status, shopify_subscription_status')
        .eq('user_id', userId)
        .maybeSingle()
      const stripeConsidered = !!row?.stripe_subscription_status
      const shopConsidered = row?.shopify_subscription_status != null
      if (stripeConsidered || shopConsidered) {
        const stripeActive = stripeConsidered && STRIPE_ACTIVE.has(String(row.stripe_subscription_status))
        const shopActive = row?.shopify_subscription_status === 'active'
        locked = !(stripeActive || shopActive)
      }
    }
  } catch {
    locked = false // errore DB → mai bloccare per sbaglio
  }
  cache.set(userId, { locked, at: Date.now() })
  return locked
}
