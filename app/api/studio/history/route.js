export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAuthUser } from '../../../../lib/studio/credits'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// GET /api/studio/history — board persistente: ultime generazioni done dell'utente.
export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ items: [] })
  const { data } = await admin.from('studio_generations')
    .select('id, type, url, model_name, prompt, format, source, created_at')
    .eq('user_id', user.id).eq('status', 'done')
    .order('created_at', { ascending: false }).limit(60)
  const items = (data || []).map(g => ({
    type: g.type, url: g.url, modelName: g.model_name, prompt: g.prompt,
    format: g.format, fromImage: g.source === 'image',
  }))
  return NextResponse.json({ items })
}
