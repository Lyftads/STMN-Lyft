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

  let profile = null
  if (ws.memberId) {
    try {
      const { data } = await admin.from('team_members').select('id, full_name, email, avatar_url, roles').eq('workspace_id', ws.workspaceId).eq('id', ws.memberId).maybeSingle()
      profile = data || null
    } catch (e) {
      return NextResponse.json({ profile: null, language, error: e.message })
    }
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

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws || !ws.memberId) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

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
    const path = `${ws.workspaceId}/${ws.memberId}-${Date.now()}.${e}`
    try {
      const buf = Buffer.from(await file.arrayBuffer())
      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: file.type || 'image/png', upsert: true })
      if (!upErr) {
        const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
        patch.avatar_url = pub.publicUrl
      }
    } catch {}
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true })
  try {
    const { data } = await admin.from('team_members').update(patch).eq('id', ws.memberId).eq('workspace_id', ws.workspaceId).select('id, full_name, email, avatar_url, roles').single()
    return NextResponse.json({ ok: true, profile: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
