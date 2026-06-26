export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getCurrentUserId } from '../../../lib/tenant/credentials'

// Diagnostica config Stripe (solo owner o cron). Verifica che ogni Price env
// punti a un prezzo reale con importo/ricorrenza/valuta attesi, + Founder promo
// + presenza webhook secret. Apri /api/stripe-health (owner) dopo aver messo le env.

// Importi attesi in centesimi (EUR). interval = month|year.
const EXPECTED = [
  { plan: 'starter',                  env: 'STRIPE_PRICE_STARTER',                  amount: 6900,    interval: 'month' },
  { plan: 'starter_annual',           env: 'STRIPE_PRICE_STARTER_ANNUAL',           amount: 69000,   interval: 'year'  },
  { plan: 'growth',                   env: 'STRIPE_PRICE_GROWTH',                   amount: 14900,   interval: 'month' },
  { plan: 'growth_annual',            env: 'STRIPE_PRICE_GROWTH_ANNUAL',            amount: 149000,  interval: 'year'  },
  { plan: 'scale',                    env: 'STRIPE_PRICE_SCALE',                    amount: 29900,   interval: 'month' },
  { plan: 'scale_annual',             env: 'STRIPE_PRICE_SCALE_ANNUAL',             amount: 299000,  interval: 'year'  },
  { plan: 'enterprise',               env: 'STRIPE_PRICE_ENTERPRISE',               amount: 59900,   interval: 'month' },
  { plan: 'agency_freelance',         env: 'STRIPE_PRICE_AGENCY_FREELANCE',         amount: 19900,   interval: 'month' },
  { plan: 'agency_freelance_annual',  env: 'STRIPE_PRICE_AGENCY_FREELANCE_ANNUAL',  amount: 199000,  interval: 'year'  },
  { plan: 'agency_agency',            env: 'STRIPE_PRICE_AGENCY_AGENCY',            amount: 59900,   interval: 'month' },
  { plan: 'agency_agency_annual',     env: 'STRIPE_PRICE_AGENCY_AGENCY_ANNUAL',     amount: 599000,  interval: 'year'  },
  { plan: 'agency_pro',               env: 'STRIPE_PRICE_AGENCY_PRO',               amount: 129000,  interval: 'month' },
  { plan: 'agency_pro_annual',        env: 'STRIPE_PRICE_AGENCY_PRO_ANNUAL',        amount: 1290000, interval: 'year'  },
  { plan: 'agency_enterprise',        env: 'STRIPE_PRICE_AGENCY_ENTERPRISE',        amount: 199000,  interval: 'month' },
]

export async function GET(req) {
  const owner = process.env.LYFT_OWNER_USER_ID
  const cronOk = !!process.env.CRON_SECRET && req.headers.get('x-internal-cron') === process.env.CRON_SECRET
  let userId = null
  try { userId = await getCurrentUserId() } catch {}
  if (!cronOk && (!owner || userId !== owner)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return NextResponse.json({ error: 'STRIPE_SECRET_KEY mancante' }, { status: 500 })
  const stripe = new Stripe(key, { apiVersion: '2024-06-20' })

  const out = { mode: key.startsWith('sk_live_') ? 'LIVE' : key.startsWith('sk_test_') ? 'TEST' : 'unknown', prices: [], summary: {} }
  let okCount = 0

  for (const e of EXPECTED) {
    const id = process.env[e.env]
    if (!id) { out.prices.push({ plan: e.plan, env: e.env, set: false, ok: false }); continue }
    try {
      const p = await stripe.prices.retrieve(id)
      const amount = p.unit_amount
      const interval = p.recurring?.interval || null
      const currency = p.currency
      const ok = p.active && amount === e.amount && interval === e.interval && currency === 'eur'
      if (ok) okCount++
      out.prices.push({
        plan: e.plan, env: e.env, set: true, ok,
        expected: { amount: e.amount, interval: e.interval },
        got: { amount, interval, currency, active: p.active },
        ...(ok ? {} : { hint: 'importo/ricorrenza/valuta non combaciano o price non attivo' }),
      })
    } catch (err) {
      out.prices.push({ plan: e.plan, env: e.env, set: true, ok: false, error: (err?.message || '').slice(0, 160) })
    }
  }

  // Founder discount (coupon id o promotion code promo_...)
  const fp = process.env.STRIPE_FOUNDER_PROMO || null
  if (!fp) out.founder = { set: false }
  else {
    try {
      if (fp.startsWith('promo_')) {
        const pc = await stripe.promotionCodes.retrieve(fp)
        const c = pc.coupon || {}
        out.founder = { set: true, type: 'promotion_code', code: pc.code, active: pc.active, percentOff: c.percent_off, duration: c.duration, maxRedemptions: pc.max_redemptions ?? c.max_redemptions, timesRedeemed: pc.times_redeemed }
      } else {
        const c = await stripe.coupons.retrieve(fp)
        out.founder = { set: true, type: 'coupon', valid: c.valid, percentOff: c.percent_off, duration: c.duration, maxRedemptions: c.max_redemptions, timesRedeemed: c.times_redeemed }
      }
    } catch (err) { out.founder = { set: true, ok: false, error: (err?.message || '').slice(0, 160) } }
  }

  out.webhookSecret = { set: !!process.env.STRIPE_WEBHOOK_SECRET }
  out.summary = { pricesOk: okCount, pricesTotal: EXPECTED.length, allPricesOk: okCount === EXPECTED.length }
  return NextResponse.json(out)
}
