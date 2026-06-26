export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getEffectiveTenantId, invalidateTenantCache } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// Salva il sito Search Console scelto per il tenant (companies.gsc_site_url).
export async function POST(req) {
  const userId = await getEffectiveTenantId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body = {}
  try { body = await req.json() } catch {}
  const site = String(body.site || '').trim()
  if (!site) return NextResponse.json({ error: 'site mancante' }, { status: 400 })

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'DB non disponibile' }, { status: 500 })

  try {
    const { data: updated, error: upErr } = await admin
      .from('companies').update({ gsc_site_url: site }).eq('user_id', userId).select('user_id')
    if (upErr) throw new Error(upErr.message)
    if (!updated || updated.length === 0) {
      const { error: insErr } = await admin.from('companies').insert({ user_id: userId, gsc_site_url: site })
      if (insErr) throw new Error(insErr.message)
    }
    invalidateTenantCache(userId)
    return NextResponse.json({ ok: true, gsc_site_url: site })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Errore salvataggio' }, { status: 500 })
  }
}
