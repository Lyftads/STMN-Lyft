export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUserId, invalidateTenantCache } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// Salva l'account Google Ads scelto per il tenant (companies.google_ads_customer_id).
export async function POST(req) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body = {}
  try { body = await req.json() } catch {}
  const customerId = String(body.customerId || '').replace(/-/g, '').trim()
  if (!customerId) return NextResponse.json({ error: 'customerId mancante' }, { status: 400 })

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'DB non disponibile' }, { status: 500 })

  try {
    const { data: updated, error: upErr } = await admin
      .from('companies').update({ google_ads_customer_id: customerId }).eq('user_id', userId).select('user_id')
    if (upErr) throw new Error(upErr.message)
    if (!updated || updated.length === 0) {
      const { error: insErr } = await admin.from('companies').insert({ user_id: userId, google_ads_customer_id: customerId })
      if (insErr) throw new Error(insErr.message)
    }
    invalidateTenantCache(userId)
    return NextResponse.json({ ok: true, google_ads_customer_id: customerId })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Errore salvataggio' }, { status: 500 })
  }
}
