export const dynamic = 'force-dynamic'
export const maxDuration = 15

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServerSupabase, getAdminSupabase } from '../../../../lib/supabase/server'

// Subscription + Payment Method read.
//
// GET ?customerId=cus_... → ritorna info aggregata sul cliente:
//   {
//     customerId, email, name,
//     subscription: { id, status, priceId, planId, currentPeriodEnd, cancelAtPeriodEnd },
//     paymentMethod: { brand, last4, expMonth, expYear },
//     upcomingInvoiceAmount, currency,
//     invoices: [{ id, date, amount, status, pdfUrl }]
//   }
//
// GET ?sessionId=cs_... → fa lo scambio session → customerId
// (usato dopo redirect da Stripe Checkout success_url che include
// {CHECKOUT_SESSION_ID}). Ritorna solo { customerId }.

// Mappa reverse Stripe priceId → planId locale, usando le stesse env
// vars STRIPE_PRICE_* che il checkout creator legge.
function priceIdToPlanId(priceId) {
  const map = {
    [process.env.STRIPE_PRICE_STARTER]: 'starter',
    [process.env.STRIPE_PRICE_GROWTH]: 'growth',
    [process.env.STRIPE_PRICE_SCALE]: 'scale',
  }
  return map[priceId] || null
}

export async function GET(req) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY non configurato' }, { status: 500 })
  }

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' })
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  const customerId = searchParams.get('customerId')

  try {
    // Path 1: scambio session → customer dopo redirect checkout success
    if (sessionId) {
      if (!sessionId.startsWith('cs_')) {
        return NextResponse.json({ error: 'sessionId deve iniziare con cs_' }, { status: 400 })
      }
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      return NextResponse.json({
        customerId: session.customer,
        subscriptionId: session.subscription,
        planId: session.metadata?.plan || null,
      })
    }

    // Path 2: leggi tutto su un customer. Se non specificato, lo ricava
    // dall'utente loggato (companies.stripe_customer_id).
    let resolvedCustomerId = customerId
    let compStatus = null, compPlan = null
    let shopStatus = null, shopPlan = null
    if (!resolvedCustomerId) {
      try {
        const sb = getServerSupabase()
        const { data: { user } } = await sb.auth.getUser()
        if (user) {
          const admin = getAdminSupabase()
          if (admin) {
            const { data: company } = await admin
              .from('companies')
              .select('stripe_customer_id, stripe_subscription_status, plan, shopify_subscription_status, shopify_subscription_plan')
              .eq('user_id', user.id)
              .maybeSingle()
            resolvedCustomerId = company?.stripe_customer_id || null
            compStatus = company?.stripe_subscription_status || null
            compPlan = company?.plan || null
            shopStatus = company?.shopify_subscription_status || null
            shopPlan = company?.shopify_subscription_plan || null
          }
        }
      } catch {}
    }

    if (!resolvedCustomerId) {
      // Abbonamento Shopify (App Store, policy 1.2.1) → accesso concesso.
      if (shopStatus === 'active') {
        return NextResponse.json({
          customerId: null, email: null, name: null,
          subscription: { id: 'shopify', status: 'active', planId: shopPlan || compPlan || 'scale', cancelAtPeriodEnd: false },
          paymentMethod: null, invoices: [], shopify: true,
        })
      }
      // Account "comp"/omaggio: nessun cliente Stripe ma stato attivo impostato a
      // mano sulla riga companies → concedi accesso (usato per account demo/review).
      if (compStatus === 'active' || compStatus === 'trialing') {
        return NextResponse.json({
          customerId: null, email: null, name: null,
          subscription: { id: 'comp', status: compStatus, planId: compPlan || 'scale', cancelAtPeriodEnd: false },
          paymentMethod: null, invoices: [], comp: true,
        })
      }
      // Utente non ancora associato a Stripe → ritorna empty stato
      return NextResponse.json({
        customerId: null, email: null, name: null,
        subscription: null, paymentMethod: null, invoices: [],
      })
    }
    if (!resolvedCustomerId.startsWith('cus_')) {
      return NextResponse.json({ error: 'customerId malformato' }, { status: 400 })
    }
    const customerIdToUse = resolvedCustomerId

    const [customer, subs, pms, invoiceList] = await Promise.all([
      stripe.customers.retrieve(customerIdToUse),
      stripe.subscriptions.list({ customer: customerIdToUse, status: 'all', limit: 5, expand: ['data.default_payment_method'] }),
      stripe.paymentMethods.list({ customer: customerIdToUse, type: 'card', limit: 5 }),
      stripe.invoices.list({ customer: customerIdToUse, limit: 10 }),
    ])

    // Subscription "vincitore": preferisci active, poi trialing, altrimenti la piu' recente
    const activeSub =
      subs.data.find(s => s.status === 'active') ||
      subs.data.find(s => s.status === 'trialing') ||
      subs.data[0] || null

    // Payment method: default della sub > primo della lista
    let pm = activeSub?.default_payment_method
    if (typeof pm === 'string') pm = pms.data.find(p => p.id === pm) || null
    if (!pm) pm = pms.data[0] || null

    const formattedPm = pm
      ? {
          id: pm.id,
          brand: pm.card?.brand || 'card',
          last4: pm.card?.last4 || '••••',
          expMonth: pm.card?.exp_month,
          expYear: pm.card?.exp_year,
        }
      : null

    const formattedSub = activeSub
      ? {
          id: activeSub.id,
          status: activeSub.status,
          priceId: activeSub.items?.data?.[0]?.price?.id || null,
          planId: priceIdToPlanId(activeSub.items?.data?.[0]?.price?.id),
          currentPeriodStart: activeSub.current_period_start,
          currentPeriodEnd: activeSub.current_period_end,
          cancelAtPeriodEnd: !!activeSub.cancel_at_period_end,
          amount: activeSub.items?.data?.[0]?.price?.unit_amount,
          currency: activeSub.items?.data?.[0]?.price?.currency,
          interval: activeSub.items?.data?.[0]?.price?.recurring?.interval,
        }
      : null

    const invoices = (invoiceList.data || []).map(inv => ({
      id: inv.id,
      number: inv.number,
      date: inv.created,
      amount: inv.total,
      currency: inv.currency,
      status: inv.status, // paid / open / void / draft / uncollectible
      pdfUrl: inv.invoice_pdf,
      hostedUrl: inv.hosted_invoice_url,
    }))

    return NextResponse.json({
      customerId: customerIdToUse,
      email: customer?.email || null,
      name: customer?.name || null,
      subscription: formattedSub,
      paymentMethod: formattedPm,
      invoices,
    })
  } catch (e) {
    return NextResponse.json({
      error: `Stripe error: ${e?.message?.slice(0, 400) || 'unknown'}`,
    }, { status: 500 })
  }
}
