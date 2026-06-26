export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getEffectiveTenantId, invalidateTenantCache } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// Salva (merge) il connectionId di un provider nella mappa
// companies.nango_connections del WORKSPACE EFFETTIVO (così un'agency che ha
// switchato su un cliente collega il provider al CLIENTE, non all'owner).
export async function POST(req) {
  const userId = await getEffectiveTenantId()
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

// Rimuove un provider dalla mappa nango_connections del WORKSPACE EFFETTIVO
// (così l'utente può "scollegare" e rifare la connessione). Per l'owner i dati
// restano accessibili via env; per i clienti la rimozione li riporta a
// "non collegato". ?integrationId=facebook|klaviyo-oauth|shopify
export async function DELETE(req) {
  const userId = await getEffectiveTenantId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const integrationId = String(new URL(req.url).searchParams.get('integrationId') || '').trim()
  if (!integrationId) return NextResponse.json({ error: 'integrationId mancante' }, { status: 400 })

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'DB non disponibile' }, { status: 500 })

  try {
    const { data: existing } = await admin
      .from('companies')
      .select('nango_connections')
      .eq('user_id', userId)
      .maybeSingle()

    const map = { ...(existing?.nango_connections && typeof existing.nango_connections === 'object' ? existing.nango_connections : {}) }
    delete map[integrationId]

    const { error: upErr } = await admin
      .from('companies').update({ nango_connections: map }).eq('user_id', userId)
    if (upErr) throw new Error(upErr.message)

    invalidateTenantCache(userId)
    return NextResponse.json({ ok: true, nango_connections: map })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Errore disconnessione' }, { status: 500 })
  }
}
