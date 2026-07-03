export const dynamic = 'force-dynamic'
export const maxDuration = 15

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServerSupabase, getAdminSupabase } from '../../../../lib/supabase/server'
import { authoritativeMin, planRank, tierOf } from '../../../../lib/team/orderTiers'
import { isOrderGateExempt } from '../../../../lib/team/orderGateExempt'

// Stripe Checkout Session creator per i 3 piani.
//
// Env vars richieste su Vercel:
//   STRIPE_SECRET_KEY               sk_live_... / sk_test_...
//   STRIPE_PRICE_STARTER            price_... (recurring monthly Starter)
//   STRIPE_PRICE_GROWTH             price_... (recurring monthly Growth)
//   STRIPE_PRICE_SCALE              price_... (recurring monthly Scale)
//   STRIPE_PRICE_ENTERPRISE         price_... (recurring monthly Enterprise, €599, no annual discount)
//   STRIPE_PRICE_*_ANNUAL           price_... (recurring yearly = 2 mesi gratis)
//   STRIPE_PRICE_AGENCY_*           price_... (piani agenzia, mensile/annuale)
//   STRIPE_FOUNDER_PROMO (opt.)     coupon ID (es. YHECEgIG) o promotion code (promo_...)
//                                   per lo sconto −30% a vita primi 100; auto-applicato;
//                                   fallback a prezzo pieno quando il coupon è esaurito
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
  enterprise: 'STRIPE_PRICE_ENTERPRISE', // flat, niente annuale
  // Brand / Aziende (annuale = 2 mesi gratis)
  starter_annual: 'STRIPE_PRICE_STARTER_ANNUAL',
  growth_annual:  'STRIPE_PRICE_GROWTH_ANNUAL',
  scale_annual:   'STRIPE_PRICE_SCALE_ANNUAL',
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
  let declaredOrders = null
  let verifiedOrders = null
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
          .select('stripe_customer_id, company_name, declared_monthly_orders, verified_monthly_orders')
          .eq('user_id', user.id)
          .maybeSingle()
        stripeCustomerId = company?.stripe_customer_id || null
        companyName = company?.company_name || null
        declaredOrders = company?.declared_monthly_orders ?? null
        verifiedOrders = company?.verified_monthly_orders ?? null
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

    // Gate volume ordini (solo piani brand, non agency): il piano scelto non può
    // stare sotto il minimo autoritativo (verified Shopify > declared onboarding).
    // Upgrade sempre consentiti. Enforcement server-side: non aggirabile da UI.
    const basePlan = planId.replace(/_annual$/, '')
    if (['starter', 'growth', 'scale', 'enterprise'].includes(basePlan) && !isOrderGateExempt(userId)) {
      const min = authoritativeMin({ declared: declaredOrders, verified: verifiedOrders })
      if (min.rank >= 0 && planRank(basePlan) < min.rank) {
        const minLabel = tierOf(min.plan)?.label || min.plan
        return NextResponse.json({
          error: `Il tuo volume (~${min.orders} ordini/mese) richiede almeno il piano ${minLabel}. Seleziona ${minLabel} o superiore.`,
        }, { status: 400 })
      }
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

    const baseParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      // Riusa il customer esistente se ce ne e' uno → coerenza con webhook + portal
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : userEmail
          ? { customer_email: userEmail }
          : {}),
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
    }

    // Sconto FOUNDER automatico (−30% a vita, primi 100): se STRIPE_FOUNDER_PROMO
    // è settato lo applichiamo direttamente. `discounts` e `allow_promotion_codes`
    // sono mutuamente esclusivi su Stripe Checkout. Quando il promo è esaurito
    // (max_redemptions raggiunto) o non valido, la create lancia → fallback a
    // prezzo pieno con il campo "codice promozionale" abilitato.
    // Crea la sessione gestendo il caso "No such customer": un customer creato in
    // TEST (o cancellato) non esiste in LIVE → ricrea senza `customer`, usando
    // customer_email. Il webhook checkout.session.completed riallinea poi lo
    // stripe_customer_id (match by user_id) → self-heal dopo lo switch test→live.
    const createSession = async (extra) => {
      const params = { ...baseParams, ...extra }
      try {
        return await stripe.checkout.sessions.create(params)
      } catch (e) {
        if (/no such customer/i.test(e?.message || '') && params.customer) {
          const { customer, ...rest } = params
          return await stripe.checkout.sessions.create({ ...rest, ...(userEmail ? { customer_email: userEmail } : {}) })
        }
        throw e
      }
    }

    const founderPromo = process.env.STRIPE_FOUNDER_PROMO || null
    let session
    if (founderPromo) {
      // Accetta sia un Promotion Code (promo_...) sia un Coupon ID diretto: il
      // coupon può già avere max_redemptions (es. 100) → enforce lato Stripe.
      const discount = founderPromo.startsWith('promo_') ? { promotion_code: founderPromo } : { coupon: founderPromo }
      try {
        session = await createSession({ discounts: [discount] })
      } catch (e) {
        console.log('[checkout] founder promo non applicato (esaurito/non valido):', e?.message)
      }
    }
    if (!session) {
      session = await createSession({ allow_promotion_codes: true })
    }

    return NextResponse.json({ url: session.url })
  } catch (e) {
    return NextResponse.json({
      error: `Stripe error: ${e?.message?.slice(0, 300) || 'unknown'}`,
    }, { status: 500 })
  }
}
