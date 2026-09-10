export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

const BUCKET = 'avatars'
const ALLOWED = ['png', 'jpg', 'jpeg', 'webp', 'gif']
function extOf(n) { const m = String(n || '').toLowerCase().match(/\.([a-z0-9]+)$/); return m ? m[1] : '' }

const LOCALES = ['it', 'en', 'es', 'fr', 'de']

export async function GET() {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ profile: null, language: null }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ profile: null, language: null })

  // Lingua per-cliente: legata alla company (PK = user_id dell'owner del workspace).
  let language = null
  try {
    const { data: comp } = await admin.from('companies').select('language').eq('user_id', ws.workspaceId).maybeSingle()
    if (comp?.language && LOCALES.includes(comp.language)) language = comp.language
  } catch {}

  // Il profilo si cerca per memberId quando c'e', altrimenti per utente: chi
  // comanda il workspace senza esserne membro puo' comunque avere una riga.
  let profile = null
  try {
    let q = admin.from('team_members').select('id, full_name, email, avatar_url, roles').eq('workspace_id', ws.workspaceId)
    q = ws.memberId ? q.eq('id', ws.memberId) : q.eq('user_id', ws.userId)
    const { data } = await q.maybeSingle()
    profile = data || null
  } catch (e) {
    return NextResponse.json({ profile: null, language, error: e.message })
  }
  return NextResponse.json({ profile, language })
}

// PATCH: persiste la lingua UI scelta dal cliente sulla company (binding per-cliente).
export async function PATCH(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let body = {}
  try { body = await req.json() } catch {}
  const language = String(body?.language || '').trim()
  if (!LOCALES.includes(language)) return NextResponse.json({ ok: false, error: 'Lingua non valida' }, { status: 400 })
  try {
    await admin.from('companies').update({ language }).eq('user_id', ws.workspaceId)
    return NextResponse.json({ ok: true, language })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

// Chi comanda il workspace ma non ha una riga in team_members non ha un
// profilo da scrivere: e' il caso dell'agency entrata in un workspace cliente.
// Prima il salvataggio veniva rifiutato con un 401 muto, e in LyftTalk quella
// persona restava "Utente" senza volto, senza modo di rimediare. Se ha i
// diritti sul workspace, la riga si crea: e' esattamente cio' che manca.
async function ensureMemberId(admin, ws) {
  if (ws.memberId) return ws.memberId
  if (!ws.isAdmin) return null

  const { data: gia } = await admin.from('team_members').select('id')
    .eq('workspace_id', ws.workspaceId).eq('user_id', ws.userId).maybeSingle()
  if (gia?.id) return gia.id

  let email = null
  try {
    const { data } = await admin.auth.admin.getUserById(ws.userId)
    email = data?.user?.email || null
  } catch {}
  if (!email) return null

  // Un invito con quella email puo' esistere gia', non ancora collegato a un
  // utente: (workspace_id, email) e' unico, quindi inserire sbatterebbe sul
  // vincolo. Si adotta la riga invece di duplicarla.
  const { data: invito } = await admin.from('team_members').select('id, user_id')
    .eq('workspace_id', ws.workspaceId).eq('email', email).maybeSingle()
  if (invito?.id) {
    if (!invito.user_id) {
      await admin.from('team_members')
        .update({ user_id: ws.userId, status: 'active', accepted_at: new Date().toISOString() })
        .eq('id', invito.id)
    }
    return invito.id
  }

  const { data: nuovo, error } = await admin.from('team_members').insert({
    workspace_id: ws.workspaceId, user_id: ws.userId, email,
    roles: ['admin'], status: 'active', accepted_at: new Date().toISOString(),
  }).select('id').single()
  if (error) throw error
  return nuovo?.id || null
}

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

  let memberId
  try {
    memberId = await ensureMemberId(admin, ws)
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
  if (!memberId) return NextResponse.json({ ok: false, error: 'Nessun profilo su questo spazio di lavoro' }, { status: 403 })

  let form
  try { form = await req.formData() } catch { return NextResponse.json({ ok: false, error: 'Formato non valido' }, { status: 400 }) }
  const fullName = String(form.get('full_name') || '').trim()
  const file = form.get('avatar')
  const patch = {}
  if (fullName) patch.full_name = fullName

  if (file && typeof file.arrayBuffer === 'function') {
    const e = extOf(file.name)
    if (!ALLOWED.includes(e)) return NextResponse.json({ ok: false, error: 'Immagine non valida (png/jpg/webp/gif)' }, { status: 400 })
    if ((file.size || 0) > 3 * 1024 * 1024) return NextResponse.json({ ok: false, error: 'Immagine troppo grande (max 3MB)' }, { status: 400 })
    try { await admin.storage.createBucket(BUCKET, { public: true }) } catch {}
    const path = `${ws.workspaceId}/${memberId}-${Date.now()}.${e}`
    // Se il caricamento fallisce si DEVE dire: prima l'errore veniva
    // inghiottito e la risposta era "salvato" con la foto rimasta indietro.
    try {
      const buf = Buffer.from(await file.arrayBuffer())
      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: file.type || 'image/png', upsert: true })
      if (upErr) return NextResponse.json({ ok: false, error: `Caricamento immagine non riuscito: ${upErr.message}` }, { status: 200 })
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
      patch.avatar_url = pub.publicUrl
    } catch (err) {
      return NextResponse.json({ ok: false, error: `Caricamento immagine non riuscito: ${err.message}` }, { status: 200 })
    }
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true })
  try {
    const { data, error } = await admin.from('team_members').update(patch)
      .eq('id', memberId).eq('workspace_id', ws.workspaceId)
      .select('id, full_name, email, avatar_url, roles').single()
    // L'errore c'era gia' nella risposta di Supabase e veniva ignorato: si
    // rispondeva "salvato" con un profilo vuoto.
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    return NextResponse.json({ ok: true, profile: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
