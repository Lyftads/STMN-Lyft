export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 20

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getEffectiveTenantId } from '../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { authoritativeMin, minPlanForOrders, tierOf, planRank } from '../../../lib/team/orderTiers'
import { isOrderGateExempt } from '../../../lib/team/orderGateExempt'

// ============================================================================
//  Plan gate per volume ordini.
//
//  GET  → info per il gate del piano del workspace effettivo:
//         { declared, verified, orders, minPlan, minRank, minLabel, source,
//           plan, planRank }
//         minPlan = piano MINIMO selezionabile (verified vince sul declared).
//
//  POST ?action=verify → "prova del 9": conta gli ordini Shopify degli ultimi
//         90 giorni, calcola la media mensile (count/3), la salva in
//         companies.verified_monthly_orders e la ritorna. Va chiamata al
//         collegamento di Shopify (step 2 onboarding).
// ============================================================================

async function loadCompany() {
  const userId = await getEffectiveTenantId()
  const admin = getAdminSupabase()
  if (!userId || !admin) return { userId: null, admin: null, row: null }
  const { data } = await admin
    .from('companies')
    .select('plan, declared_monthly_orders, verified_monthly_orders')
    .eq('user_id', userId)
    .maybeSingle()
  return { userId, admin, row: data || null }
}

export async function GET(request) {
  return withTenantContext(request, async () => {
    const { userId, row } = await loadCompany()
    const declared = row?.declared_monthly_orders ?? null
    const verified = row?.verified_monthly_orders ?? null
    const plan = row?.plan || null
    // Clienti storici esenti (STMN owner, Saracino…): nessun gate.
    if (isOrderGateExempt(userId)) {
      return NextResponse.json({ exempt: true, declared, verified, orders: null, source: null, minPlan: null, minRank: -1, minLabel: null, plan, planRank: plan ? planRank(plan) : -1 })
    }
    const min = authoritativeMin({ declared, verified })
    return NextResponse.json({
      declared,
      verified,
      orders: min.orders,
      source: min.source,
      minPlan: min.plan,
      minRank: min.rank,
      minLabel: min.plan ? (tierOf(min.plan)?.label || null) : null,
      plan,
      planRank: plan ? planRank(plan) : -1,
    })
  })
}

export async function POST(request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  if (action !== 'verify') {
    return NextResponse.json({ error: 'action non valida (use ?action=verify)' }, { status: 400 })
  }

  return withTenantContext(request, async () => {
    // Clienti storici esenti: non ricalcolare verified_monthly_orders.
    if (isOrderGateExempt(await getEffectiveTenantId())) {
      return NextResponse.json({ exempt: true, verified: null })
    }
    const sh = getShopify()
    if (!sh?.storeUrl || !sh?.adminToken) {
      return NextResponse.json({ configured: false, verified: null })
    }

    // Media mensile = ordini ultimi 90 giorni / 3 (stesso metodo REST di plan-usage).
    const since = new Date(); since.setDate(since.getDate() - 90)
    const min = since.toISOString()
    const version = process.env.SHOPIFY_API_VERSION || '2024-10'
    let count = null
    try {
      const url = `https://${sh.storeUrl}/admin/api/${version}/orders/count.json?status=any&created_at_min=${encodeURIComponent(min)}`
      const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': sh.adminToken } })
      const j = await r.json().catch(() => ({}))
      if (r.ok && typeof j.count === 'number') count = j.count
    } catch {}

    if (count == null) {
      return NextResponse.json({ configured: true, verified: null })
    }

    const verified = Math.round(count / 3)

    // Persisti sul workspace effettivo.
    try {
      const userId = await getEffectiveTenantId()
      const admin = getAdminSupabase()
      if (userId && admin) {
        await admin.from('companies').update({ verified_monthly_orders: verified }).eq('user_id', userId)
      }
    } catch {}

    return NextResponse.json({
      configured: true,
      verified,
      minPlan: minPlanForOrders(verified),
    })
  })
}
