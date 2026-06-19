export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { getCurrentUserId } from '../../../../lib/tenant/credentials'
import { REPORT_SECTION_MAP, REPORT_FREQUENCIES, sectionsNeedUrl } from '../../../../lib/reports/sections'

// CRUD delle schedulazioni report personalizzate (report_schedules).

function clean(body) {
  const sections = Array.isArray(body?.sections)
    ? body.sections.filter(s => REPORT_SECTION_MAP[s])
    : []
  const recipients = Array.isArray(body?.recipients)
    ? body.recipients.map(r => String(r).trim()).filter(r => r.includes('@'))
    : String(body?.recipients || '').split(',').map(r => r.trim()).filter(r => r.includes('@'))
  const frequency = REPORT_FREQUENCIES.includes(body?.frequency) ? body.frequency : 'weekly'
  return {
    name: String(body?.name || '').trim().slice(0, 80) || 'Report',
    sections,
    frequency,
    weekday: frequency === 'weekly' ? Math.min(6, Math.max(0, parseInt(body?.weekday ?? 1, 10) || 1)) : null,
    monthday: frequency === 'monthly' ? Math.min(28, Math.max(1, parseInt(body?.monthday ?? 1, 10) || 1)) : null,
    timeframe: String(body?.timeframe || 'last_7d'),
    recipients,
    target_url: body?.target_url ? String(body.target_url).trim().slice(0, 500) : null,
    enabled: body?.enabled !== false,
  }
}

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ items: [] })
  try {
    const { data } = await admin.from('report_schedules')
      .select('*').eq('user_id', userId).order('created_at', { ascending: false })
    return NextResponse.json({ items: data || [] })
  } catch (e) {
    return NextResponse.json({ items: [], error: e.message })
  }
}

export async function POST(req) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Storage non disponibile' }, { status: 500 })
  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body invalido' }, { status: 400 }) }
  const row = clean(body)
  if (!row.sections.length) return NextResponse.json({ error: 'Seleziona almeno un report' }, { status: 400 })
  if (!row.recipients.length) return NextResponse.json({ error: 'Inserisci almeno un destinatario valido' }, { status: 400 })
  if (sectionsNeedUrl(row.sections) && !row.target_url) return NextResponse.json({ error: 'SEO Audit / Website Scanner richiedono un URL' }, { status: 400 })
  try {
    const { data, error } = await admin.from('report_schedules')
      .insert({ user_id: userId, ...row }).select().maybeSingle()
    if (error) throw error
    return NextResponse.json({ ok: true, item: data })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Storage non disponibile' }, { status: 500 })
  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body invalido' }, { status: 400 }) }
  if (!body?.id) return NextResponse.json({ error: 'id mancante' }, { status: 400 })
  // Toggle veloce enabled, oppure update completo.
  const patch = typeof body.enabled === 'boolean' && Object.keys(body).length === 2
    ? { enabled: body.enabled }
    : clean(body)
  try {
    const { data, error } = await admin.from('report_schedules')
      .update(patch).eq('id', body.id).eq('user_id', userId).select().maybeSingle()
    if (error) throw error
    return NextResponse.json({ ok: true, item: data })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id mancante' }, { status: 400 })
  try {
    await admin.from('report_schedules').delete().eq('id', id).eq('user_id', userId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
