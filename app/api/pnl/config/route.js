export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { getCurrentUserId } from '../../../../lib/tenant/credentials'

// Persistenza per-account della config costi del Conto Economico (P&L).
// Salvata in companies.pnl_config (jsonb). Best-effort: se la colonna non
// esiste o l'utente non è loggato, il client usa il fallback localStorage.

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ config: null })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ config: null })
  try {
    const { data } = await admin.from('companies').select('pnl_config').eq('user_id', userId).maybeSingle()
    return NextResponse.json({ config: data?.pnl_config ?? null })
  } catch (e) {
    return NextResponse.json({ config: null, error: e.message })
  }
}

export async function POST(req) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'DB non disponibile' }, { status: 200 })

  let body = {}
  try { body = await req.json() } catch {}
  const config = body?.config ?? {}

  try {
    const { data: updated } = await admin
      .from('companies').update({ pnl_config: config }).eq('user_id', userId).select('user_id')
    if (!updated || updated.length === 0) {
      await admin.from('companies').insert({ user_id: userId, pnl_config: config })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    // colonna mancante o altro → il client tiene comunque il localStorage
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
