export const dynamic = 'force-dynamic'
export const maxDuration = 15

import { NextResponse } from 'next/server'
import { getServerSupabase, getAdminSupabase } from '../../../lib/supabase/server'

// ============================================================================
//  Alerts feed — bell icon + alert center
//
//  GET → ritorna alert non-dismissed dell'utente.
//  Fonti:
//   - Memorie 'auto-scan' role='insight' importance >= 7 degli ultimi 7gg
//     (briefing notturno con anomalie / trend / milestone)
//   - Le anomalie auto-rilevate hanno importance 8-9 → diventano alert
//     'urgent'. Trend importance 6-7 → 'warning'. Milestone → 'info'.
//
//  POST { id, action: 'dismiss'|'restore' }
//   → marca un alert come dismissed (UI state in sessionStorage o DB).
//     Per ora: persistiamo in memoria con uno schema dismissed_alerts JSONB
//     in companies. Soluzione semplice senza tabella aggiuntiva.
// ============================================================================

async function getUserId() {
  const sb = getServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  return user?.id || null
}

function severityFromImportance(imp) {
  if (imp >= 8) return 'urgent'
  if (imp >= 6) return 'warning'
  return 'info'
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  // Carica memorie auto-scan recenti come alert
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString()

  const { data: memories, error } = await admin
    .from('agent_memories')
    .select('id, content, importance, created_at, source')
    .eq('user_id', userId)
    .eq('agent_id', 'auto-scan')
    .gte('created_at', sevenDaysAgo)
    .neq('role', 'consolidated_into')
    .order('importance', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Carica dismissed list dall'utente
  const { data: company } = await admin
    .from('companies')
    .select('dismissed_alerts')
    .eq('user_id', userId)
    .maybeSingle()

  const dismissedIds = new Set(
    Array.isArray(company?.dismissed_alerts) ? company.dismissed_alerts : []
  )

  const alerts = (memories || [])
    .filter(m => !dismissedIds.has(m.id))
    .map(m => ({
      id: m.id,
      severity: severityFromImportance(m.importance),
      content: m.content,
      importance: m.importance,
      createdAt: m.created_at,
      source: m.source,
    }))

  const counts = {
    urgent: alerts.filter(a => a.severity === 'urgent').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
    total: alerts.length,
  }

  return NextResponse.json({ alerts, counts })
}

export async function POST(req) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const id = body?.id
  const action = body?.action
  if (!id || !['dismiss', 'restore'].includes(action)) {
    return NextResponse.json({ error: 'id + action (dismiss|restore) richiesti' }, { status: 400 })
  }

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  const { data: row } = await admin
    .from('companies')
    .select('dismissed_alerts')
    .eq('user_id', userId)
    .maybeSingle()

  const current = Array.isArray(row?.dismissed_alerts) ? row.dismissed_alerts : []
  let next
  if (action === 'dismiss') {
    next = current.includes(id) ? current : [...current, id]
  } else {
    next = current.filter(x => x !== id)
  }

  const { error } = await admin
    .from('companies')
    .update({ dismissed_alerts: next })
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, dismissedCount: next.length })
}
