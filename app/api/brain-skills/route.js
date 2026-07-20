export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getEffectiveTenantId, getCurrentUserId } from '../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../lib/supabase/server'

// ── Skills del Cervello (prompt salvati, condivisi nel workspace) ───────────
// GET    → { skills: [...] }
// POST   { title, prompt } → crea (cap 30 per workspace)
// PATCH  { id, used: true } → incrementa il contatore usi
// DELETE ?id= → elimina (solo autore o owner del workspace)
// Tabella: supabase/brain_skills.sql

const MAX_SKILLS = 30

async function ctx() {
  const ws = await getEffectiveTenantId()
  const uid = await getCurrentUserId()
  const admin = getAdminSupabase()
  return { ws, uid, admin }
}

export async function GET() {
  const { ws, admin } = await ctx()
  if (!ws || !admin) return NextResponse.json({ skills: [] })
  const { data, error } = await admin
    .from('brain_skills')
    .select('id, title, prompt, uses, author_id, updated_at')
    .eq('workspace_id', ws)
    .order('uses', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(MAX_SKILLS)
  if (error) return NextResponse.json({ skills: [], error: error.message })
  return NextResponse.json({ skills: data || [] })
}

export async function POST(req) {
  const { ws, uid, admin } = await ctx()
  if (!ws || !uid || !admin) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  let body; try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }
  const title = String(body?.title || '').trim().slice(0, 80)
  const prompt = String(body?.prompt || '').trim().slice(0, 4000)
  if (!title || !prompt) return NextResponse.json({ error: 'Titolo e prompt obbligatori' }, { status: 400 })

  const { count } = await admin.from('brain_skills').select('id', { count: 'exact', head: true }).eq('workspace_id', ws)
  if ((count || 0) >= MAX_SKILLS) return NextResponse.json({ error: `Limite di ${MAX_SKILLS} skills raggiunto: eliminane una prima.` }, { status: 400 })

  const { data, error } = await admin
    .from('brain_skills')
    .insert({ workspace_id: ws, author_id: uid, title, prompt })
    .select('id, title, prompt, uses, author_id, updated_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ skill: data })
}

export async function PATCH(req) {
  const { ws, admin } = await ctx()
  if (!ws || !admin) return NextResponse.json({ ok: false }, { status: 401 })
  let body; try { body = await req.json() } catch { return NextResponse.json({ ok: false }, { status: 400 }) }
  if (body?.id && body?.used) {
    const { data } = await admin.from('brain_skills').select('uses').eq('id', body.id).eq('workspace_id', ws).maybeSingle()
    if (data) await admin.from('brain_skills').update({ uses: (data.uses || 0) + 1, updated_at: new Date().toISOString() }).eq('id', body.id).eq('workspace_id', ws)
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req) {
  const { ws, uid, admin } = await ctx()
  if (!ws || !uid || !admin) return NextResponse.json({ ok: false }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false }, { status: 400 })
  // Può eliminare: l'autore della skill, o l'owner del workspace (ws === uid)
  const { data } = await admin.from('brain_skills').select('author_id').eq('id', id).eq('workspace_id', ws).maybeSingle()
  if (!data) return NextResponse.json({ ok: false }, { status: 404 })
  if (data.author_id !== uid && ws !== uid) return NextResponse.json({ ok: false, error: 'Solo l’autore può eliminarla' }, { status: 403 })
  await admin.from('brain_skills').delete().eq('id', id).eq('workspace_id', ws)
  return NextResponse.json({ ok: true })
}
