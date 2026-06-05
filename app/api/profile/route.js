export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

const BUCKET = 'avatars'
const ALLOWED = ['png', 'jpg', 'jpeg', 'webp', 'gif']
function extOf(n) { const m = String(n || '').toLowerCase().match(/\.([a-z0-9]+)$/); return m ? m[1] : '' }

export async function GET() {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ profile: null }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin || !ws.memberId) return NextResponse.json({ profile: null })
  try {
    const { data } = await admin.from('team_members').select('id, full_name, email, avatar_url, roles').eq('workspace_id', ws.workspaceId).eq('id', ws.memberId).maybeSingle()
    return NextResponse.json({ profile: data || null })
  } catch (e) {
    return NextResponse.json({ profile: null, error: e.message })
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
