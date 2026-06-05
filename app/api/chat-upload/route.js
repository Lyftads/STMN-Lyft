export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

const BUCKET = 'chat-media'
const MAX = 8 * 1024 * 1024 // 8MB

// POST multipart { file } → carica su bucket pubblico, ritorna l'URL pubblico.
export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let form
  try { form = await req.formData() } catch { return NextResponse.json({ ok: false, error: 'Formato non valido' }, { status: 400 }) }
  const file = form.get('file')
  if (!file || typeof file.arrayBuffer !== 'function') return NextResponse.json({ ok: false, error: 'File mancante' }, { status: 400 })
  if ((file.size || 0) > MAX) return NextResponse.json({ ok: false, error: 'File troppo grande (max 8MB)' }, { status: 400 })

  try { await admin.storage.createBucket(BUCKET, { public: true }) } catch {}
  const nameMatch = String(file.name || '').toLowerCase().match(/\.([a-z0-9]+)$/)
  const ext = nameMatch ? nameMatch[1] : ((file.type && file.type.includes('mp4')) ? 'mp4' : 'webm')
  const path = `${ws.workspaceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const { error } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (error) throw error
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ ok: true, url: pub.publicUrl, name: file.name || `file.${ext}`, type: file.type || '' })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
