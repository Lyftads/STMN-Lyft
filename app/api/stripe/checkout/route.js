export const dynamic = 'force-dynamic'
export const maxDuration = 15

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServerSupabase, getAdminSupabase } from '../../../../lib/supabase/server'

// Stripe Checkout Session creator per i 3 piani.
//
// Env vars richieste su Vercel:
//   STRIPE_SECRET_KEY               sk_live_... / sk_test_...
//   STRIPE_PRICE_STARTER            price_... (recurring monthly Starter)
//   STRIPE_PRICE_GROWTH             price_... (recurring monthly Growth)
//   STRIPE_PRICE_SCALE              price_... (recurring monthly Scale)
//   STRIPE_PRICE_ENTERPRISE         price_... (recurring monthly Enterprise, €599, no annual discount)
//   NEXT_PUBLIC_APP_URL  (opt.)     https://lyftai.io
//                                   (fallback: ricavato da request origin)
//
// Body POST: { planId: 'starter' | 'growth' | 'scale' | 'enterprise', mode?: 'subscription' | 'setup' }
// - mode 'subscription' (default): crea sub + salva PM automatic
// - mode 'setup': salva solo il PM senza addebitare nulla

const PRICE_ENV_MAP = {
  // Brand / Aziende (mensile)
  starter:    'STRIPE_PRICE_STARTER',
  growth:     'STRIPE_PRICE_GROWTH',
  scale:      'STRIPE_PRICE_SCALE',
  enterprise: 'STRIPE_PRICE_ENTERPRISE',
  // Agenzie / Freelance — mensile
  agency_freelance:  'STRIPE_PRICE_AGENCY_FREELANCE',
  agency_agency:     'STRIPE_PRICE_AGENCY_AGENCY',
  agency_pro:        'STRIPE_PRICE_AGENCY_PRO',
  agency_enterprise: 'STRIPE_PRICE_AGENCY_ENTERPRISE', // flat, niente annuale
  // Agenzie / Freelance — annuale (2 mesi gratis)
  agency_freelance_annual: 'STRIPE_PRICE_AGENCY_FREELANCE_ANNUAL',
  agency_agency_annual:    'STRIPE_PRICE_AGENCY_AGENCY_ANNUAL',
  agency_pro_annual:       'STRIPE_PRICE_AGENCY_PRO_ANNUAL',
}

export async function POST(req) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return NextResponse.json({
      error: 'Stripe non configurato. Imposta STRIPE_SECRET_KEY su Vercel.',
    }, { status: 500 })
  }

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const planId = body?.planId
  const mode = body?.mode === 'setup' ? 'setup' : 'subscription'

  // Origin per success/cancel — IMPORTANTE: usa il dominio della richiesta
  // attuale, non NEXT_PUBLIC_APP_URL hardcoded. Altrimenti se l'utente fa
  // checkout da stmn-lyft.vercel.app e poi viene redirezionato su lyftai.io,
  // i cookie di Supabase non lo seguono (cookie scope per dominio) → bounce
  // al login dopo Stripe.
  const origin =
    req.headers.get('origin') ||
    (req.headers.get('host') ? `https://${req.headers.get('host')}` : null) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://lyftai.io'

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' })

  // Recupera l'utente loggato e l'eventuale customerId gia' creato.
  // Cosi' Stripe riusa lo stesso customer invece di crearne uno nuovo
  // ad ogni checkout — fondamentale per webhook + portal coerenti.
  let userId = null
  let userEmail = null
  let stripeCustomerId = null
  let companyName = null
  try {
    const sb = getServerSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (user) {
      userId = user.id
      userEmail = user.email
      const admin = getAdminSupabase()
      if (admin) {
        const { data: company } = await admin
          .from('companies')
          .select('stripe_customer_id, company_name')
          .eq('user_id', user.id)
          .maybeSingle()
        stripeCustomerId = company?.stripe_customer_id || null
        companyName = company?.company_name || null
      }
    }
  } catch {}

  try {
    if (mode === 'setup') {
      // Setup mode: salva il PM senza addebitare. Usato dal bottone
      // "+ Aggiungi metodo di pagamento" quando l'utente vuole solo
      // registrare la carta senza scegliere subito un piano.
      const session = await stripe.checkout.sessions.create({
        mode: 'setup',
        payment_method_types: ['card'],
        ...(stripeCustomerId ? { customer: stripeCustomerId } : userEmail ? { customer_email: userEmail } : {}),
        success_url: `${origin}/?tab=settings&setup=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?tab=settings&setup=cancelled`,
        metadata: { user_id: userId || '', source: 'lyft-dashboard' },
      })
      return NextResponse.json({ url: session.url })
    }

    // Subscription mode: serve un priceId per il piano
    if (!planId || !PRICE_ENV_MAP[planId]) {
      return NextResponse.json({ error: `planId non valido: ${planId}` }, { status: 400 })
    }
    const priceId = process.env[PRICE_ENV_MAP[planId]]
    if (!priceId) {
      return NextResponse.json({
        error: `Price ID mancante per "${planId}". Imposta ${PRICE_ENV_MAP[planId]} su Vercel con il Price ID Stripe del piano.`,
      }, { status: 500 })
    }

    // Trial 14gg per nuovi customer: passa subscription_data.trial_period_days.
    // payment_method_collection: 'if_required' = no carta richiesta upfront
    // (matcha la promessa "niente carta richiesta" della landing). Alla
    // scadenza Stripe manda email per chiedere PM o sub si cancella.
    //
    // Body opt-out: se il client manda trial=false (upgrade da Settings di
    // utente gia' attivo), saltiamo il trial.
    const enableTrial = body?.trial !== false && !stripeCustomerId
    const trialPeriodDays = enableTrial ? 14 : undefined

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      // Riusa il customer esistente se ce ne e' uno → coerenza con webhook + portal
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : userEmail
          ? { customer_email: userEmail }
          : {}),
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      automatic_tax: { enabled: false },
      // No carta richiesta in trial → max conversione signup
      ...(enableTrial ? { payment_method_collection: 'if_required' } : {}),
      success_url: `${origin}/?tab=settings&checkout=success&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing-required?cancelled=1`,
      // Metadata: usate dal webhook per associare la sub all'utente nel DB
      metadata: {
        plan: planId,
        user_id: userId || '',
        company_name: companyName || '',
        source: 'lyft-dashboard',
        trial: enableTrial ? '14d' : 'none',
      },
      subscription_data: {
        ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
        metadata: {
          plan: planId,
          user_id: userId || '',
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    return NextResponse.json({
      error: `Stripe error: ${e?.message?.slice(0, 300) || 'unknown'}`,
    }, { status: 500 })
  }
}
