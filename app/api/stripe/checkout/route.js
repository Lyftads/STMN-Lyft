export const dynamic = 'force-dynamic'
export const maxDuration = 15

import { NextResponse } from 'next/server'
import Stripe from 'stripe'

// Stripe Checkout Session creator per i 3 piani.
//
// Env vars richieste su Vercel:
//   STRIPE_SECRET_KEY               sk_live_... / sk_test_...
//   STRIPE_PRICE_STARTER            price_... (recurring monthly Starter)
//   STRIPE_PRICE_GROWTH             price_... (recurring monthly Growth)
//   STRIPE_PRICE_SCALE              price_... (recurring monthly Scale)
//   NEXT_PUBLIC_APP_URL  (opt.)     https://stmn-lyft.vercel.app
//                                   (fallback: ricavato da request origin)
//
// Body POST: { planId: 'starter' | 'growth' | 'scale', mode?: 'subscription' | 'setup' }
// - mode 'subscription' (default): crea sub + salva PM automatic
// - mode 'setup': salva solo il PM senza addebitare nulla

const PRICE_ENV_MAP = {
  starter: 'STRIPE_PRICE_STARTER',
  growth:  'STRIPE_PRICE_GROWTH',
  scale:   'STRIPE_PRICE_SCALE',
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

  // Origin per success/cancel — preferisce env var, altrimenti header origin
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    req.headers.get('origin') ||
    req.headers.get('referer')?.replace(/\/[^/]*$/, '') ||
    'https://stmn-lyft.vercel.app'

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' })

  try {
    if (mode === 'setup') {
      // Setup mode: salva il PM senza addebitare. Usato dal bottone
      // "+ Aggiungi metodo di pagamento" quando l'utente vuole solo
      // registrare la carta senza scegliere subito un piano.
      const session = await stripe.checkout.sessions.create({
        mode: 'setup',
        payment_method_types: ['card'],
        success_url: `${origin}/?tab=settings&setup=success`,
        cancel_url: `${origin}/?tab=settings&setup=cancelled`,
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

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      // Allow_promotion_codes per gestire promo via Stripe Dashboard
      allow_promotion_codes: true,
      // Permette al cliente di salvare il metodo per addebiti futuri
      // (automatico con mode=subscription, ma esplicitiamolo)
      billing_address_collection: 'auto',
      automatic_tax: { enabled: false }, // attiva true se hai Stripe Tax configurato
      success_url: `${origin}/?tab=settings&checkout=success&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?tab=settings&checkout=cancelled`,
      metadata: {
        plan: planId,
        source: 'lyft-dashboard',
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    return NextResponse.json({
      error: `Stripe error: ${e?.message?.slice(0, 300) || 'unknown'}`,
    }, { status: 500 })
  }
}
