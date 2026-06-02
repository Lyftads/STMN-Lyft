export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { getServerSupabase, getAdminSupabase } from '../../../../lib/supabase/server'

// POST multipart/form-data:
//   field 'file' (binary) — il file da caricare
//   field 'type' (string) — 'logo_png' | 'logo_svg' | 'photo_ref' | 'mood_board' | 'other'
//
// Upload nel bucket Supabase Storage 'brand-assets' al path
// '{user_id}/{timestamp}_{filename}' (RLS by user_id), poi appende
// l'asset metadata al companies.brand_assets array.
//
// Ritorna: { asset: {type, url, name, size, uploadedAt}, assets: [...] }

const ALLOWED_TYPES = ['logo_png', 'logo_svg', 'photo_ref', 'mood_board', 'other']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

function sanitizeFilename(name) {
  return String(name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
}

export async function POST(req) {
  const sb = getServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let form
  try {
    form = await req.formData()
  } catch (e) {
    return NextResponse.json({ error: 'multipart non valido' }, { status: 400 })
  }

  const file = form.get('file')
  const type = String(form.get('type') || 'other')

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Campo file mancante' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: `type non valido (allowed: ${ALLOWED_TYPES.join(', ')})` }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `file troppo grande (max ${MAX_BYTES / 1024 / 1024}MB)` }, { status: 400 })
  }

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  // Upload nel bucket
  const filename = sanitizeFilename(file.name || 'upload')
  const path = `${user.id}/${Date.now()}_${filename}`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from('brand-assets')
    .upload(path, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: `Upload fallito: ${uploadError.message}` }, { status: 500 })
  }

  // URL pubblica del file caricato
  const { data: { publicUrl } } = admin.storage.from('brand-assets').getPublicUrl(path)

  const asset = {
    type,
    url: publicUrl,
    path, // serve per delete in futuro
    name: filename,
    size: file.size,
    mime: file.type || null,
    uploadedAt: new Date().toISOString(),
  }

  // Append all'array brand_assets
  const { data: existing } = await admin
    .from('companies')
    .select('brand_assets')
    .eq('user_id', user.id)
    .maybeSingle()

  const currentAssets = Array.isArray(existing?.brand_assets) ? existing.brand_assets : []
  const newAssets = [...currentAssets, asset]

  const { error: updateError } = await admin
    .from('companies')
    .update({ brand_assets: newAssets })
    .eq('user_id', user.id)

  if (updateError) {
    // best-effort: file resta nel bucket, l'utente puo' ritentare il save
    return NextResponse.json({ error: `Save metadata fallito: ${updateError.message}` }, { status: 500 })
  }

  return NextResponse.json({ asset, assets: newAssets })
}

// DELETE ?path={storage_path} → rimuove asset dal bucket + dall'array
export async function DELETE(req) {
  const sb = getServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path mancante' }, { status: 400 })

  // Sicurezza: path deve iniziare con user.id/ — evita delete cross-tenant
  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'path non autorizzato' }, { status: 403 })
  }

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  await admin.storage.from('brand-assets').remove([path])

  const { data: existing } = await admin
    .from('companies')
    .select('brand_assets')
    .eq('user_id', user.id)
    .maybeSingle()

  const newAssets = (Array.isArray(existing?.brand_assets) ? existing.brand_assets : [])
    .filter(a => a.path !== path)

  await admin
    .from('companies')
    .update({ brand_assets: newAssets })
    .eq('user_id', user.id)

  return NextResponse.json({ assets: newAssets })
}
