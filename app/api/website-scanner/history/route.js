export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { getCurrentUserId } from '../../../../lib/tenant/credentials'

// GET           → lista scan recenti (id, url, viewport, score, score_label, created_at)
// GET ?id=xxx   → scan completo (result jsonb) per riaprirlo nella tab
export async function GET(request) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ items: [] })

  const id = new URL(request.url).searchParams.get('id')

  try {
    if (id) {
      const { data } = await admin.from('web_scans')
        .select('id, url, viewport, score, score_label, result, created_at')
        .eq('user_id', userId).eq('id', id).maybeSingle()
      if (!data) return NextResponse.json({ error: 'Scan non trovato' }, { status: 404 })
      return NextResponse.json(data)
    }
    const { data } = await admin.from('web_scans')
      .select('id, url, viewport, score, score_label, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60)
    return NextResponse.json({ items: data || [] })
  } catch (e) {
    // tabella mancante / errore → lista vuota (storico opzionale)
    return NextResponse.json({ items: [], error: e.message })
  }
}

// DELETE ?id=xxx → rimuove uno scan dallo storico
export async function DELETE(request) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id mancante' }, { status: 400 })
  try {
    await admin.from('web_scans').delete().eq('user_id', userId).eq('id', id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
