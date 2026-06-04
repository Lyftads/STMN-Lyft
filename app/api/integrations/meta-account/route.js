export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUserId, invalidateTenantCache } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// Salva l'ad account Meta scelto per il tenant (companies.meta_account_id).
export async function POST(req) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body = {}
  try { body = await req.json() } catch {}
  const accountId = String(body.accountId || '').trim() // formato "act_123"
  if (!accountId) return NextResponse.json({ error: 'accountId mancante' }, { status: 400 })

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'DB non disponibile' }, { status: 500 })

  try {
    const { data: company } = await admin.from('companies').select('id').eq('user_id', userId).maybeSingle()
    if (company) {
      const { error } = await admin.from('companies').update({ meta_account_id: accountId }).eq('user_id', userId)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await admin.from('companies').insert({ user_id: userId, meta_account_id: accountId })
      if (error) throw new Error(error.message)
    }
    invalidateTenantCache(userId)
    return NextResponse.json({ ok: true, meta_account_id: accountId })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Errore salvataggio' }, { status: 500 })
  }
}
