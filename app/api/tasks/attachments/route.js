export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { resolveWorkspace } from '../../../../lib/team/workspace'

const BUCKET = 'task-files'
const MAX_BYTES = 4 * 1024 * 1024 // ~4MB (limite body serverless Vercel ≈ 4.5MB)
const ALLOWED_EXT = ['pdf', 'csv', 'png', 'jpg', 'jpeg', 'webp', 'xls', 'xlsx', 'doc', 'docx', 'txt']

function safeName(name) {
  return String(name || 'file')
    .replace(/[^\w.\-]+/g, '_')
    .slice(-120)
}
function extOf(name) {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

async function ensureBucket(admin) {
  try {
    await admin.storage.createBucket(BUCKET, { public: false })
  } catch {
    // già esistente → ok
  }
}

// POST multipart: { file, taskId } → carica su storage e registra in tasks.attachments
export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'DB non disponibile' })

  let formData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ ok: false, error: 'Formato non valido' }, { status: 400 })
  }
  const taskId = String(formData.get('taskId') || '')
  const file = formData.get('file')
  if (!taskId || !file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ ok: false, error: 'taskId o file mancante' }, { status: 400 })
  }

  const ext = extOf(file.name)
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ ok: false, error: `Tipo non supportato (.${ext}). Ammessi: ${ALLOWED_EXT.join(', ')}` }, { status: 400 })
  }
  const size = file.size || 0
  if (size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'File troppo grande (max ~4MB)' }, { status: 400 })
  }

  // verifica che il task appartenga al workspace
  const { data: task } = await admin.from('tasks').select('id, attachments').eq('id', taskId).eq('workspace_id', ws.workspaceId).maybeSingle()
  if (!task) return NextResponse.json({ ok: false, error: 'Task non trovato' }, { status: 404 })

  await ensureBucket(admin)
  const path = `${ws.workspaceId}/${taskId}/${Date.now()}-${safeName(file.name)}`
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (upErr) throw upErr

    const meta = { path, name: file.name, size, type: file.type || ext, uploaded_at: new Date().toISOString() }
    const attachments = Array.isArray(task.attachments) ? [...task.attachments, meta] : [meta]
    const { data: updated } = await admin.from('tasks').update({ attachments, updated_at: new Date().toISOString() })
      .eq('id', taskId).eq('workspace_id', ws.workspaceId).select('*').single()
    return NextResponse.json({ ok: true, task: updated, attachment: meta })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

// GET ?path=... → URL di download firmato (a scadenza)
export async function GET(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path') || ''
  if (!path.startsWith(`${ws.workspaceId}/`)) {
    return NextResponse.json({ ok: false, error: 'Accesso negato' }, { status: 403 })
  }
  try {
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 600)
    if (error) throw error
    return NextResponse.json({ ok: true, url: data.signedUrl })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

// DELETE ?taskId=&path=... → rimuove da storage + da tasks.attachments
export async function DELETE(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId') || ''
  const path = searchParams.get('path') || ''
  if (!taskId || !path.startsWith(`${ws.workspaceId}/`)) {
    return NextResponse.json({ ok: false, error: 'Parametri non validi' }, { status: 400 })
  }
  try {
    await admin.storage.from(BUCKET).remove([path])
    const { data: task } = await admin.from('tasks').select('attachments').eq('id', taskId).eq('workspace_id', ws.workspaceId).maybeSingle()
    const attachments = (Array.isArray(task?.attachments) ? task.attachments : []).filter(a => a.path !== path)
    const { data: updated } = await admin.from('tasks').update({ attachments, updated_at: new Date().toISOString() })
      .eq('id', taskId).eq('workspace_id', ws.workspaceId).select('*').single()
    return NextResponse.json({ ok: true, task: updated })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
