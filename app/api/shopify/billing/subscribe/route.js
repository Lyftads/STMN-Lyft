export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../../../lib/tenant/credentials'

// ============================================================================
//  Shopify Billing API — crea l'abbonamento ricorrente (appSubscriptionCreate)
//  per il merchant arrivato da Shopify. Ritorna confirmationUrl → il client
//  redirige il merchant lì, lui approva su Shopify, e Shopify torna sul
//  callback (/api/shopify/billing/callback) dove segniamo l'abbonamento attivo.
//  Policy 1.2.1: per gli utenti Shopify gli addebiti passano da Shopify, NON Stripe.
// ============================================================================

const PLANS = {
  starter: { name: 'LyftAI Starter', amount: 119.99 },
  growth:  { name: 'LyftAI Growth',  amount: 179.99 },
  scale:   { name: 'LyftAI Scale',   amount: 349.99 },
}

export async function POST(req) {
  return withTenantContext(req, async () => {
    let body = {}
    try { body = await req.json() } catch {}
    const planId = String(body.planId || '').trim()
    const plan = PLANS[planId]
    if (!plan) return NextResponse.json({ error: 'Piano non valido' }, { status: 400 })

    const sh = getShopify()
    if (!sh?.storeUrl || !sh?.adminToken) {
      return NextResponse.json({ error: 'Shopify non collegato per questo account' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || (req.headers.get('host') ? `https://${req.headers.get('host')}` : 'https://lyftai.io')
    const returnUrl = `${origin}/api/shopify/billing/callback?plan=${encodeURIComponent(planId)}`

    const mutation = `mutation appSubscriptionCreate($name:String!,$lineItems:[AppSubscriptionLineItemInput!]!,$returnUrl:URL!,$trialDays:Int,$test:Boolean){
      appSubscriptionCreate(name:$name, returnUrl:$returnUrl, trialDays:$trialDays, test:$test, lineItems:$lineItems){
        confirmationUrl
        appSubscription { id status }
        userErrors { field message }
      }
    }`
    const variables = {
      name: plan.name,
      returnUrl,
      trialDays: 14,
      // test:true sui dev store → addebiti finti per la review. Su store reali
      // Shopify addebita davvero (i dev store restano comunque test lato Shopify).
      test: process.env.SHOPIFY_BILLING_TEST === 'true',
      lineItems: [{
        plan: { appRecurringPricingDetails: { price: { amount: plan.amount, currencyCode: 'EUR' }, interval: 'EVERY_30_DAYS' } },
      }],
    }

    try {
      const r = await fetch(`https://${sh.storeUrl}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': sh.adminToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mutation, variables }),
        signal: AbortSignal.timeout(15000),
      })
      const j = await r.json()
      const res = j?.data?.appSubscriptionCreate
      const errs = res?.userErrors || j?.errors
      if (!res?.confirmationUrl) {
        return NextResponse.json({ error: (errs && errs[0]?.message) || 'Creazione abbonamento Shopify fallita' }, { status: 502 })
      }
      return NextResponse.json({ confirmationUrl: res.confirmationUrl })
    } catch (e) {
      return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
    }
  })
}
