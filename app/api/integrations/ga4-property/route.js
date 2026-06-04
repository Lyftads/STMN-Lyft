export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUserId, invalidateTenantCache } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// Salva la proprietà GA4 scelta per il tenant (companies.ga4_property_id).
export async function POST(req) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body = {}
  try { body = await req.json() } catch {}
  const propertyId = String(body.propertyId || '').trim()
  if (!propertyId) return NextResponse.json({ error: 'propertyId mancante' }, { status: 400 })

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'DB non disponibile' }, { status: 500 })

  try {
    const { data: updated, error: upErr } = await admin
      .from('companies').update({ ga4_property_id: propertyId }).eq('user_id', userId).select('user_id')
    if (upErr) throw new Error(upErr.message)
    if (!updated || updated.length === 0) {
      const { error: insErr } = await admin.from('companies').insert({ user_id: userId, ga4_property_id: propertyId })
      if (insErr) throw new Error(insErr.message)
    }
    invalidateTenantCache(userId)
    return NextResponse.json({ ok: true, ga4_property_id: propertyId })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Errore salvataggio' }, { status: 500 })
  }
}
