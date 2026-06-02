export const dynamic = 'force-dynamic'
export const maxDuration = 15

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServerSupabase, getAdminSupabase } from '../../../../lib/supabase/server'

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

  // Recupera customerId dall'utente loggato (DB), no piu' da body
  let customerId = null
  try {
    const sb = getServerSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    const admin = getAdminSupabase()
    if (admin) {
      const { data: company } = await admin
        .from('companies')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle()
      customerId = company?.stripe_customer_id
    }
  } catch {}

  if (!customerId || !customerId.startsWith('cus_')) {
    return NextResponse.json({ error: 'Nessun cliente Stripe associato. Completa prima un checkout.' }, { status: 400 })
  }

  // Origin per return_url — usa dominio della richiesta attuale per
  // mantenere la sessione cookie-based (vedi checkout per dettagli)
  const origin =
    req.headers.get('origin') ||
    (req.headers.get('host') ? `https://${req.headers.get('host')}` : null) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://lyftai.io'

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
