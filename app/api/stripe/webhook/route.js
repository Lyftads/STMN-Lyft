export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// Stripe Webhook handler.
//
// Riceve eventi da Stripe in tempo reale: pagamenti completati, sub
// aggiornate/cancellate, fatture pagate/fallite. Per essere "production"
// abbiamo bisogno di:
// 1) Verificare la firma con stripe.webhooks.constructEvent (anti-spoofing)
// 2) Persistere lo stato — per ora logging + serverState in-memory che
//    si perde a ogni redeploy. La prossima evoluzione e' Vercel KV o un
//    DB vero per persistenza multi-tenant.
//
// Env vars richieste:
//   STRIPE_SECRET_KEY        gia' presente
//   STRIPE_WEBHOOK_SECRET    whsec_... — copiato dalla creazione del
//                            webhook endpoint su Stripe Dashboard

// Stato in-memory (per single-tenant testing). Sara' Vercel KV / DB.
// NOTE: questa Map vive solo nella stessa istanza serverless. Stripe
// retry alla peggio re-attiva il piano alla prossima visita.
const eventLog = []

export async function POST(req) {
  const secret = process.env.STRIPE_SECRET_KEY
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !whSecret) {
    return NextResponse.json({
      error: 'Stripe non configurato. Servono STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET.',
    }, { status: 500 })
  }

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' })
  const sig = req.headers.get('stripe-signature')
  const rawBody = await req.text()

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret)
  } catch (e) {
    return NextResponse.json({ error: `Signature mismatch: ${e.message}` }, { status: 400 })
  }

  // Log strutturato per ogni evento (visibile in Vercel runtime logs)
  const meta = { id: event.id, type: event.type, created: event.created }
  eventLog.push(meta)
  console.log('[stripe webhook]', JSON.stringify(meta))

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // L'utente ha completato il checkout. La sub e' attiva.
        const s = event.data.object
        const userId = s.metadata?.user_id
        const customerId = s.customer
        const planId = s.metadata?.plan
        console.log('[stripe webhook] checkout completed', { customer: customerId, subscription: s.subscription, plan: planId, user: userId })
        // Persiste sul record companies
        if (userId && customerId) {
          const admin = getAdminSupabase()
          if (admin) {
            await admin.from('companies').update({
              stripe_customer_id: customerId,
              stripe_subscription_id: s.subscription || null,
              plan: planId || null,
              updated_at: new Date().toISOString(),
            }).eq('user_id', userId)
          }
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object
        console.log('[stripe webhook] subscription state', { id: sub.id, customer: sub.customer, status: sub.status })
        const admin = getAdminSupabase()
        if (admin) {
          // Match by stripe_customer_id (piu' affidabile dell'user_id su metadata che potrebbe mancare su evento delta)
          await admin.from('companies').update({
            stripe_subscription_id: sub.id,
            stripe_subscription_status: sub.status,
            stripe_current_period_end: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString() : null,
            updated_at: new Date().toISOString(),
          }).eq('stripe_customer_id', sub.customer)
        }
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        console.log('[stripe webhook] subscription cancelled', { id: sub.id, customer: sub.customer })
        const admin = getAdminSupabase()
        if (admin) {
          await admin.from('companies').update({
            stripe_subscription_status: 'canceled',
            plan: null,
            updated_at: new Date().toISOString(),
          }).eq('stripe_customer_id', sub.customer)
        }
        break
      }
      case 'invoice.paid': {
        const inv = event.data.object
        console.log('[stripe webhook] invoice paid', {
          id: inv.id, customer: inv.customer,
          amount: inv.amount_paid, currency: inv.currency,
          subscription: inv.subscription,
        })
        // TODO: log fattura su DB / estendi current_period_end
        break
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object
        console.log('[stripe webhook] invoice FAILED', {
          id: inv.id, customer: inv.customer,
          amount: inv.amount_due, currency: inv.currency,
          attempts: inv.attempt_count,
        })
        // TODO: notifica utente / sospendi accesso dopo N tentativi
        break
      }
      default:
        // Ignora gli altri eventi (charge.refunded, ecc.)
        break
    }
    return NextResponse.json({ received: true })
  } catch (e) {
    // IMPORTANTE: ritorna 500 cosi' Stripe ritenta. Non 200, altrimenti
    // l'evento e' "consumato" anche se non lo abbiamo processato.
    console.error('[stripe webhook] handler error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET per debug: ritorna gli ultimi N eventi visti (utile per verificare
// che il webhook sia stato chiamato senza dover guardare i log Vercel)
export async function GET() {
  return NextResponse.json({
    received: eventLog.length,
    last: eventLog.slice(-20),
    note: 'In-memory log, si resetta ad ogni cold start',
  })
}
