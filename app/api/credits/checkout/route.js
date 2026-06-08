export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 15

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServerSupabase, getAdminSupabase } from '../../../../lib/supabase/server'
import { getCreditPack } from '../../../../lib/studio/models'

// POST { packId } → crea una Stripe Checkout Session one-time (mode: payment)
// per acquistare un pacchetto di crediti. Il webhook accredita al pagamento.
//
// Env: STRIPE_SECRET_KEY + STRIPE_PRICE_CREDITS_100 / _500 / _2000 (price_...
// di prodotti ONE-TIME su Stripe, non recurring).

export async function POST(req) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return NextResponse.json({ error: 'Stripe non configurato (STRIPE_SECRET_KEY).' }, { status: 500 })

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const pack = getCreditPack(body?.packId)
  if (!pack) return NextResponse.json({ error: 'Pacchetto sconosciuto' }, { status: 400 })

  const priceId = process.env[pack.priceEnv]
  if (!priceId) return NextResponse.json({ error: `Manca ${pack.priceEnv} su Vercel (price_... one-time).` }, { status: 500 })

  const origin =
    req.headers.get('origin') ||
    (req.headers.get('host') ? `https://${req.headers.get('host')}` : null) ||
    process.env.NEXT_PUBLIC_APP_URL || 'https://lyftai.io'

  // Utente + customer Stripe esistente
  let userId = null, userEmail = null, stripeCustomerId = null
  try {
    const sb = getServerSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    userId = user.id; userEmail = user.email
    const admin = getAdminSupabase()
    if (admin) {
      const { data: company } = await admin.from('companies').select('stripe_customer_id').eq('user_id', user.id).maybeSingle()
      stripeCustomerId = company?.stripe_customer_id || null
    }
  } catch {
    return NextResponse.json({ error: 'Errore sessione' }, { status: 500 })
  }

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' })
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      ...(stripeCustomerId ? { customer: stripeCustomerId } : userEmail ? { customer_email: userEmail } : {}),
      success_url: `${origin}/?tab=creativeStudio&credits=success`,
      cancel_url: `${origin}/?tab=creativeStudio&credits=cancel`,
      metadata: { kind: 'credits', user_id: userId, pack: pack.id, credits: String(pack.credits) },
      payment_intent_data: { metadata: { kind: 'credits', user_id: userId, credits: String(pack.credits) } },
    })
    return NextResponse.json({ url: session.url })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
