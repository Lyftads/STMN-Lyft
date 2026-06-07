export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { resolveWorkspace } from '../../../../lib/team/workspace'

// Upload media Social Studio: ritorna un SIGNED UPLOAD URL così il client carica
// il file DIRETTAMENTE su Supabase Storage (bypassa il limite ~4.5MB delle
// serverless di Vercel) → supporta video/immagini pesanti SENZA compressione,
// nessuna perdita di qualità. Il client usa uploadToSignedUrl(path, token, file).
const BUCKET = 'social-media'

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'Storage non disponibile' })

  let b = {}
  try { b = await req.json() } catch {}
  const filename = String(b.filename || 'file')
  const ext = (filename.toLowerCase().match(/\.([a-z0-9]+)$/) || [, 'bin'])[1]

  // Bucket pubblico con limite file alto (i video full-quality possono pesare).
  try { await admin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: '1024MB' }) } catch {}

  const path = `${ws.workspaceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  try {
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error) throw error
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ ok: true, bucket: BUCKET, path: data.path, token: data.token, publicUrl: pub.publicUrl })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
