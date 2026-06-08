export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAuthUser } from '../../../../lib/studio/credits'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// GET /api/studio/history?boardId= — generazioni done dell'utente (filtrate per board).
export async function GET(req) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ items: [] })
  const boardId = new URL(req.url).searchParams.get('boardId')
  let q = admin.from('studio_generations')
    .select('id, type, url, model_name, prompt, format, source, created_at')
    .eq('user_id', user.id).eq('status', 'done')
  if (boardId) q = q.eq('board_id', boardId)
  const { data } = await q.order('created_at', { ascending: false }).limit(120)
  const items = (data || []).map(g => ({
    type: g.type, url: g.url, modelName: g.model_name, prompt: g.prompt,
    format: g.format, fromImage: g.source === 'image',
  }))
  return NextResponse.json({ items })
}

// DELETE /api/studio/history { urls: [...] } — elimina le generazioni indicate.
export async function DELETE(req) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let body; try { body = await req.json() } catch { body = {} }
  const urls = Array.isArray(body?.urls) ? body.urls.filter(Boolean).slice(0, 200) : []
  if (!urls.length) return NextResponse.json({ error: 'urls mancanti' }, { status: 400 })
  const { error } = await admin.from('studio_generations').delete().eq('user_id', user.id).in('url', urls)
  return NextResponse.json({ ok: !error })
}
