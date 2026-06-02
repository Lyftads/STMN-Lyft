export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { getServerSupabase, getAdminSupabase } from '../../../../lib/supabase/server'

// GET → ritorna JSON con tutte le memorie dell'utente (per backup/sync).
// Formato: { version: 1, exportedAt, userId, memories: [...] }
//
// Le memorie includono content + role + importance + metadata, MA NON
// l'embedding (e' rigenerabile e occuperebbe troppo spazio).

export async function GET() {
  const sb = getServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  const { data, error } = await admin
    .from('agent_memories')
    .select('agent_id, role, content, importance, source, created_at, last_used_at, use_count')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    userId: user.id,
    count: data?.length || 0,
    memories: data || [],
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="lyftai-memories-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
