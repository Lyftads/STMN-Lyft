export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { addCredits } from '../../../../lib/studio/credits'

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
        console.log('[stripe webhook] checkout completed', { customer: customerId, subscription: s.subscription, plan: planId, user: userId, kind: s.metadata?.kind })

        // Acquisto crediti Creative Studio (mode: payment, kind=credits).
        // Idempotente: ref = session.id (indice unico su credit_transactions).
        if (s.metadata?.kind === 'credits' && userId && s.payment_status === 'paid') {
          const credits = parseInt(s.metadata?.credits || '0')
          if (credits > 0) {
            await addCredits(userId, credits, 'purchase', s.id, null)
            console.log('[stripe webhook] credits added', { user: userId, credits, ref: s.id })
          }
          break
        }

        // Persiste sul record companies (abbonamenti)
        if (userId && customerId) {
          const admin = getAdminSupabase()
          if (admin) {
            // Recupera lo stato REALE della subscription (trialing/active) così il
            // piano è attivo SUBITO, senza dipendere dall'ordine di arrivo degli
            // eventi customer.subscription.* (il gate legge stripe_subscription_status).
            let subStatus = null, periodEnd = null
            if (s.subscription) {
              try {
                const sub = await stripe.subscriptions.retrieve(s.subscription)
                subStatus = sub.status
                periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null
              } catch (e) { console.log('[stripe webhook] retrieve subscription fallito:', e?.message) }
            }
            await admin.from('companies').update({
              stripe_customer_id: customerId,
              stripe_subscription_id: s.subscription || null,
              plan: planId || null,
              ...(subStatus ? { stripe_subscription_status: subStatus } : {}),
              ...(periodEnd ? { stripe_current_period_end: periodEnd } : {}),
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
          const { data: cur } = await admin.from('companies')
            .select('stripe_subscription_id').eq('stripe_customer_id', sub.customer).maybeSingle()
          // Regola: vince la subscription ATTIVA più recente del customer.
          // (Col solo confronto sul puntatore memorizzato, durante un cambio
          // piano la vecchia sub "active" se lo riprendeva e il deleted
          // successivo azzerava il piano di un cliente pagante.)
          const isCurrent = !cur?.stripe_subscription_id || cur.stripe_subscription_id === sub.id
          const active = ['active', 'trialing'].includes(sub.status)
          if (!isCurrent) {
            if (!active) { console.log('[stripe webhook] update ignorato: sub non corrente e non attiva'); break }
            try {
              const list = await stripe.subscriptions.list({ customer: sub.customer, status: 'all', limit: 10 })
              const actives = (list.data || []).filter(x => ['active', 'trialing'].includes(x.status))
              const newest = actives.sort((a, b) => (b.created || 0) - (a.created || 0))[0]
              if (newest && newest.id !== sub.id) { console.log('[stripe webhook] update ignorato: esiste una sub attiva più recente'); break }
            } catch (e) { console.log('[stripe webhook] list subs fallita:', e?.message) }
          }
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
          // Cambio piano = nuova sub sullo stesso customer: il deleted della
          // VECCHIA non deve azzerare piano/status della nuova (cliente pagante
          // finiva in 402) — si applica solo se la sub cancellata è la corrente.
          const { data: row } = await admin.from('companies')
            .select('user_id, stripe_subscription_id')
            .eq('stripe_customer_id', sub.customer).maybeSingle()
          let noOtherActive = false
          try {
            const list = await stripe.subscriptions.list({ customer: sub.customer, status: 'all', limit: 10 })
            noOtherActive = !(list.data || []).some(x => x.id !== sub.id && ['active', 'trialing', 'past_due'].includes(x.status))
          } catch { noOtherActive = false }
          if (row && (!row.stripe_subscription_id || row.stripe_subscription_id === sub.id || noOtherActive)) {
            await admin.from('companies').update({
              stripe_subscription_status: 'canceled',
              plan: null,
              updated_at: new Date().toISOString(),
            }).eq('stripe_customer_id', sub.customer)
          } else {
            console.log('[stripe webhook] deleted ignorato: non è la sub corrente')
          }
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
  // Niente dettagli eventi senza auth (id/tipi/timestamp erano pubblici)
  return NextResponse.json({ ok: true })
}
