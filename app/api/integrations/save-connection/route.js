export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUserId, invalidateTenantCache } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// Salva (merge) il connectionId di un provider nella mappa
// companies.nango_connections del tenant loggato, dopo che la Connect UI
// ha completato il collegamento.
export async function POST(req) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body = {}
  try { body = await req.json() } catch {}
  const integrationId = String(body.integrationId || '').trim()
  const connectionId = String(body.connectionId || '').trim()
  if (!integrationId || !connectionId) {
    return NextResponse.json({ error: 'integrationId/connectionId mancanti' }, { status: 400 })
  }

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'DB non disponibile' }, { status: 500 })

  try {
    const { data: existing } = await admin
      .from('companies')
      .select('nango_connections')
      .eq('user_id', userId)
      .maybeSingle()

    const map = { ...(existing?.nango_connections && typeof existing.nango_connections === 'object' ? existing.nango_connections : {}), [integrationId]: connectionId }

    // Update-first: aggiorna se la riga esiste, inserisce solo se assente.
    const { data: updated, error: upErr } = await admin
      .from('companies').update({ nango_connections: map }).eq('user_id', userId).select('user_id')
    if (upErr) throw new Error(upErr.message)
    if (!updated || updated.length === 0) {
      const { error: insErr } = await admin.from('companies').insert({ user_id: userId, nango_connections: map })
      if (insErr) throw new Error(insErr.message)
    }

    invalidateTenantCache(userId) // forza il refresh delle creds al prossimo giro
    return NextResponse.json({ ok: true, nango_connections: map })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Errore salvataggio' }, { status: 500 })
  }
}
