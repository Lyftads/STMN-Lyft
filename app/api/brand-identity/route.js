export const dynamic = 'force-dynamic'
export const maxDuration = 15

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { getEffectiveTenantId } from '../../../lib/tenant/credentials'

// GET → ritorna { identity, assets } del WORKSPACE EFFETTIVO (cliente agency se
// switchato, altrimenti l'utente stesso). POST → upsert idem.
//
// Brand Identity = system prompt context per AI agent + creative tools.
// Schema flessibile (JSONB) — frontend definisce la shape, backend persiste.

async function getUserId() {
  return getEffectiveTenantId()
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  const { data, error } = await admin
    .from('companies')
    .select('brand_identity, brand_assets, company_name')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    companyName: data?.company_name || '',
    identity: data?.brand_identity || {},
    assets: Array.isArray(data?.brand_assets) ? data.brand_assets : [],
  })
}

export async function POST(req) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  // Accetta { identity?: object, assets?: array }
  const updates = {}
  if (body.identity && typeof body.identity === 'object' && !Array.isArray(body.identity)) {
    updates.brand_identity = body.identity
  }
  if (Array.isArray(body.assets)) {
    updates.brand_assets = body.assets
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 })
  }

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  const { data, error } = await admin
    .from('companies')
    .update(updates)
    .eq('user_id', userId)
    .select('brand_identity, brand_assets')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    identity: data?.brand_identity || {},
    assets: data?.brand_assets || [],
    savedAt: new Date().toISOString(),
  })
}
