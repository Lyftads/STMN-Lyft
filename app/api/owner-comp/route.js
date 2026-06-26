export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getCurrentUserId } from '../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../lib/supabase/server'

// Diagnostica + riparazione del "comp" (accesso owner gratuito) per l'UTENTE
// LOGGATO. GET mostra perché il comp passa o no (dati propri → safe). Con
// ?fix=<CRON_SECRET> imposta il comp e pulisce l'eventuale stripe_customer_id
// stale (guard: serve il CRON_SECRET, quindi non abusabile).
export async function GET(req) {
  const userId = await getCurrentUserId().catch(() => null)
  if (!userId) return NextResponse.json({ error: 'not logged in' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'no admin supabase' }, { status: 500 })

  const { data } = await admin
    .from('companies')
    .select('stripe_subscription_status, plan, shopify_store_url, stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  const ownerEnv = process.env.LYFT_OWNER_USER_ID || null
  const isOwner = !!ownerEnv && userId === ownerEnv
  const compStatus = data?.stripe_subscription_status || null
  const isShopifyMerchant = !!data?.shopify_store_url
  const wouldComp = (compStatus === 'active' || compStatus === 'trialing') && (!isShopifyMerchant || isOwner)

  const diag = {
    userId,
    ownerEnvSet: !!ownerEnv,
    isOwnerMatch: isOwner,
    compStatus,
    plan: data?.plan || null,
    shopifyStore: isShopifyMerchant,
    stripeCustomerId: data?.stripe_customer_id ? `${data.stripe_customer_id.slice(0, 8)}…` : null,
    wouldComp,
  }

  // Riparazione protetta da CRON_SECRET
  const fix = new URL(req.url).searchParams.get('fix')
  if (fix) {
    if (!process.env.CRON_SECRET || fix !== process.env.CRON_SECRET) {
      diag.fixed = false
      diag.fixError = 'secret errato'
    } else {
      await admin.from('companies').update({
        stripe_subscription_status: 'active',
        plan: data?.plan || 'scale',
        stripe_customer_id: null, // pulisce l'id di TEST stale → niente retrieve su Live
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId)
      diag.fixed = true
      diag.note = 'comp impostato + customer stale rimosso. Ricarica l\'app.'
    }
  }

  return NextResponse.json(diag)
}
