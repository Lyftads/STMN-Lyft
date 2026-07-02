export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getEffectiveTenantId } from '../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../lib/supabase/server'

// Check LEGGERO (no ShopifyQL) per il banner "preparazione dati": lo storico
// metrics è già stato calcolato e cachato su Supabase per il tenant effettivo?
// weekly con ≥5 punti = dashboard pronte.
export async function GET() {
  const uid = await getEffectiveTenantId().catch(() => null)
  if (!uid) return NextResponse.json({ ready: false })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ready: false })
  try {
    const { data } = await admin
      .from('metrics_history')
      .select('weekly, updated_at')
      .eq('tenant_id', uid)
      .maybeSingle()
    const ready = Array.isArray(data?.weekly) && data.weekly.length >= 5
    return NextResponse.json({ ready })
  } catch {
    return NextResponse.json({ ready: false })
  }
}
