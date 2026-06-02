export const dynamic = 'force-dynamic'
export const maxDuration = 15

import { NextResponse } from 'next/server'
import { getServerSupabase, getAdminSupabase } from '../../../lib/supabase/server'

// ============================================================================
//  Memory Inspector API
//
//  GET /api/agent-memories?agent_id=kpi&limit=100
//    → lista memorie dell'utente loggato (filtri opzionali)
//  DELETE /api/agent-memories?id=<uuid>
//    → cancella una memoria specifica
//  PATCH /api/agent-memories?id=<uuid> body { importance? content? }
//    → modifica una memoria
// ============================================================================

async function getUserId() {
  const sb = getServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  return user?.id || null
}

export async function GET(req) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agent_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500)
  const includeConsolidated = searchParams.get('include_consolidated') === '1'

  let q = admin
    .from('agent_memories')
    .select('id, agent_id, role, content, importance, source, created_at, last_used_at, use_count')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (agentId) q = q.eq('agent_id', agentId)
  if (!includeConsolidated) q = q.neq('role', 'consolidated_into')

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggrega per agent_id per dare al client una vista organizzata
  const byAgent = {}
  for (const m of (data || [])) {
    if (!byAgent[m.agent_id]) byAgent[m.agent_id] = []
    byAgent[m.agent_id].push(m)
  }

  return NextResponse.json({
    total: data?.length || 0,
    byAgent,
    flat: data || [],
  })
}

export async function DELETE(req) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id mancante' }, { status: 400 })

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  const { error } = await admin
    .from('agent_memories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function PATCH(req) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id mancante' }, { status: 400 })

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const updates = {}
  if (typeof body.importance === 'number') {
    updates.importance = Math.max(1, Math.min(10, Math.round(body.importance)))
  }
  if (typeof body.content === 'string' && body.content.trim()) {
    updates.content = body.content.trim().slice(0, 4000)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 })
  }

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  const { error } = await admin
    .from('agent_memories')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
