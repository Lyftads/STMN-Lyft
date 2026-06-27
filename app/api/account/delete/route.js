export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getCurrentUserId, invalidateTenantCache } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// GDPR — Diritto alla cancellazione / "oblio" (art. 17). Elimina l'account
// dell'utente LOGGATO e tutti i suoi dati. Irreversibile. Richiede conferma
// esplicita lato client (body { confirm: 'ELIMINA' }).
//
// Best-effort su più tabelle per-utente: una tabella assente non blocca il resto.
const USER_TABLES = [
  // tabelle keyed su user_id
  ['companies', 'user_id'],
  ['agent_memories', 'user_id'],
  ['ai_credits', 'user_id'],
  ['studio_boards', 'user_id'],
  ['studio_generations', 'user_id'],
  ['report_schedules', 'user_id'],
  ['web_scans', 'user_id'],
  ['seo_audits', 'user_id'],
  // tabelle keyed su workspace_id (= user_id per l'owner del proprio workspace)
  ['customer_segment_snapshots', 'workspace_id'],
  ['time_entries', 'workspace_id'],
  ['tab_snapshots', 'workspace_id'],
  ['metrics_history', 'tenant_id'],
]

export async function DELETE(req) {
  const uid = await getCurrentUserId()
  if (!uid) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body = {}
  try { body = await req.json() } catch {}
  if (String(body?.confirm || '').toUpperCase() !== 'ELIMINA') {
    return NextResponse.json({ error: 'Conferma mancante' }, { status: 400 })
  }

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Servizio non disponibile' }, { status: 500 })

  const removed = []
  for (const [table, col] of USER_TABLES) {
    try {
      const { error } = await admin.from(table).delete().eq(col, uid)
      if (!error) removed.push(table)
    } catch {}
  }

  // Elimina l'utente di autenticazione (account vero e proprio).
  let authDeleted = false
  try { const { error } = await admin.auth.admin.deleteUser(uid); authDeleted = !error } catch {}

  try { invalidateTenantCache(uid) } catch {}

  return NextResponse.json({ ok: true, removedTables: removed, authDeleted })
}
