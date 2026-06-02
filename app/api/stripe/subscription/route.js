export const dynamic = 'force-dynamic'
export const maxDuration = 15

import { NextResponse } from 'next/server'
import Stripe from 'stripe'

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

    // Path 2: leggi tutto su un customer
    if (!customerId || !customerId.startsWith('cus_')) {
      return NextResponse.json({ error: 'customerId o sessionId richiesto' }, { status: 400 })
    }

    const [customer, subs, pms, invoiceList] = await Promise.all([
      stripe.customers.retrieve(customerId),
      stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 5, expand: ['data.default_payment_method'] }),
      stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 5 }),
      stripe.invoices.list({ customer: customerId, limit: 10 }),
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
      customerId,
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
