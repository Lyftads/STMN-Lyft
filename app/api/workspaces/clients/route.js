export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getCurrentUserId, invalidateMembership } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// Un'agency crea un nuovo workspace cliente: utente auth "shadow" (senza login)
// → il trigger handle_new_user crea la riga companies → mapping agency_clients.
// L'agency poi collega le integrazioni del cliente (Nango/Google) entrando nel
// workspace e usando l'onboarding/integrazioni esistenti.
export async function POST(req) {
  const uid = await getCurrentUserId()
  if (!uid) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Servizio non disponibile' }, { status: 500 })

  let body = {}
  try { body = await req.json() } catch {}
  const label = String(body.label || body.companyName || '').trim()
  const companyName = String(body.companyName || body.label || '').trim()
  if (!label) return NextResponse.json({ error: 'Nome cliente obbligatorio' }, { status: 400 })

  try {
    // 1) Utente shadow (email tecnica, mai usata per login).
    const email = `ws_${randomUUID()}@workspaces.lyftai.io`
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, email_confirm: true, user_metadata: { company_name: companyName || label },
    })
    if (cErr || !created?.user) {
      return NextResponse.json({ error: cErr?.message || 'Creazione workspace fallita' }, { status: 500 })
    }
    const clientId = created.user.id

    // 2) Riga companies del workspace (upsert: il trigger l'ha già creata).
    //    is_beta=false ESPLICITO: il workspace cliente NON deve MAI ereditare
    //    l'esposizione delle env di STMN (env gate = company.is_beta in getTenantCreds).
    await admin.from('companies').upsert(
      { user_id: clientId, company_name: companyName || label, is_client_workspace: true, is_beta: false },
      { onConflict: 'user_id' }
    )

    // 3) Mapping agency → cliente + marca l'agency.
    await admin.from('agency_clients').insert({ agency_user_id: uid, client_user_id: clientId, label })
    await admin.from('companies').update({ is_agency: true }).eq('user_id', uid)

    invalidateMembership(uid)
    return NextResponse.json({ ok: true, workspace: { id: clientId, label, isSelf: false } })
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

// Elimina un cliente creato dall'agency: rimuove il mapping + (best-effort) la riga
// companies e l'utente shadow. Solo l'agency proprietaria del mapping può farlo.
export async function DELETE(req) {
  const uid = await getCurrentUserId()
  if (!uid) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Servizio non disponibile' }, { status: 500 })

  const clientId = new URL(req.url).searchParams.get('clientId') || ''
  if (!clientId) return NextResponse.json({ error: 'clientId obbligatorio' }, { status: 400 })
  if (clientId === uid) return NextResponse.json({ error: 'Non puoi eliminare il tuo workspace' }, { status: 400 })

  try {
    // Ownership: l'agency deve possedere QUESTO cliente (anti-leak).
    const { data: map } = await admin.from('agency_clients')
      .select('id').eq('agency_user_id', uid).eq('client_user_id', clientId).maybeSingle()
    if (!map) return NextResponse.json({ error: 'Cliente non trovato o non autorizzato' }, { status: 403 })

    // 1) Rimuovi il mapping (sparisce dallo switcher) — questo è il passo critico.
    await admin.from('agency_clients').delete().eq('agency_user_id', uid).eq('client_user_id', clientId)
    // 2) Best-effort: elimina la riga companies e l'utente shadow (no orphan).
    try { await admin.from('companies').delete().eq('user_id', clientId) } catch {}
    try { await admin.auth.admin.deleteUser(clientId) } catch {}

    invalidateMembership(uid)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
