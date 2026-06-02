export const dynamic = 'force-dynamic'
export const maxDuration = 15

import { NextResponse } from 'next/server'
import Stripe from 'stripe'

// Customer Portal: pagina Stripe-hosted dove il cliente puo' self-service
// cambio piano, cancellazione, aggiorna metodo di pagamento, scarica
// fatture, vede storico transazioni.
//
// Body POST: { customerId: 'cus_...' }
// Ritorna: { url } — il client fa window.location.href = url
//
// Prerequisito: configurazione portale su Stripe Dashboard
// https://dashboard.stripe.com/test/settings/billing/portal
// (la prima volta che provi il portal Stripe ti chiede di salvare la
// config: lascia tutto default + abilita "Subscription cancellation" +
// "Customer update" + "Invoice history" e' attivo per default)

export async function POST(req) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY non configurato' }, { status: 500 })
  }

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const customerId = body?.customerId
  if (!customerId || !customerId.startsWith('cus_')) {
    return NextResponse.json({ error: 'customerId mancante o invalido (deve iniziare con cus_)' }, { status: 400 })
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    req.headers.get('origin') ||
    'https://stmn-lyft.vercel.app'

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' })

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/?tab=settings&portal=return`,
    })
    return NextResponse.json({ url: session.url })
  } catch (e) {
    return NextResponse.json({
      error: `Stripe portal error: ${e?.message?.slice(0, 400) || 'unknown'}`,
      hint: e?.message?.includes('No configuration provided')
        ? 'Vai su https://dashboard.stripe.com/test/settings/billing/portal e attiva la configurazione del Customer Portal'
        : undefined,
    }, { status: 500 })
  }
}
