export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { resolveWorkspace, isCollaborator } from '../../../../lib/team/workspace'

// ============================================================================
//  Permesso firmato per caricare un file direttamente nello storage.
//
//  Il file NON passa dal server: su Vercel una richiesta è limitata a 4,5 MB
//  e un video non ci sta. Qui si firma un permesso di scrittura per UN
//  percorso dentro la cartella del workspace, il browser carica lì, poi
//  registra l'anagrafica su /api/creative-library.
//
//  Il percorso lo decide il server: se lo scegliesse il client, si potrebbe
//  scrivere nella cartella di un altro tenant.
// ============================================================================

const BUCKET = 'creativita'
const MAX_BYTES = 50 * 1024 * 1024 // limite del bucket sul progetto Supabase

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!(ws.isAdmin || isCollaborator(ws))) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'Storage non configurato' })

  let b = {}
  try { b = await req.json() } catch {}
  const filename = String(b.filename || '').trim()
  if (!filename) return NextResponse.json({ ok: false, error: 'Nome file mancante' }, { status: 400 })
  if (Number.isFinite(b.size) && b.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: `Il file supera i ${Math.round(MAX_BYTES / 1024 / 1024)} MB consentiti dallo storage.` }, { status: 400 })
  }

  // Nome ripulito ma riconoscibile: il nome originale è l'unica cosa che
  // permette di ritrovare un file fra centinaia.
  const safe = filename.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120)
  const path = `${ws.workspaceId}/${Date.now()}_${safe}`

  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({
    ok: true,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: pub?.publicUrl || null,
    bucket: BUCKET,
  })
}
