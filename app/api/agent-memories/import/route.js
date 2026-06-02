export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../../lib/supabase/server'
import { rememberBatch } from '../../../../lib/tenant/agentMemory'

// POST → importa memorie da un file di export precedente.
// Body: JSON con shape { version: 1, memories: [{...}] }
//
// Rigenera embedding tramite remember() (richiamato in batch).
// Se memoria con content identico esiste gia' (stesso user_id, agent_id,
// content) NON la duplichiamo.

export async function POST(req) {
  const sb = getServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }

  if (body?.version !== 1) {
    return NextResponse.json({ error: 'Versione export non supportata' }, { status: 400 })
  }
  const memories = Array.isArray(body?.memories) ? body.memories : []
  if (memories.length === 0) {
    return NextResponse.json({ error: 'Nessuna memoria da importare' }, { status: 400 })
  }

  // Filtra payload valido + cap a 1000 per chiamata
  const valid = memories
    .filter(m => m && typeof m.content === 'string' && m.content.trim().length > 5)
    .slice(0, 1000)
    .map(m => ({
      userId: user.id,
      agentId: typeof m.agent_id === 'string' ? m.agent_id : 'kpi',
      content: m.content.trim(),
      role: ['preference', 'fact', 'insight', 'observation'].includes(m.role) ? m.role : 'observation',
      importance: Number.isFinite(m.importance) ? Math.max(1, Math.min(10, Math.round(m.importance))) : 5,
      source: 'imported',
    }))

  // rememberBatch genera embedding per ogni memoria (chiamata OpenAI).
  // Costo: ~$0.00002 per memoria con text-embedding-3-small. 1000 memorie ≈ $0.02
  const ids = await rememberBatch(valid)

  return NextResponse.json({
    ok: true,
    imported: ids.length,
    skipped: valid.length - ids.length,
    total: memories.length,
  })
}
