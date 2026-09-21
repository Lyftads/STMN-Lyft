export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { getCurrentUserId, getEffectiveTenantId } from '../../../../lib/tenant/credentials'
import { REPORT_SECTION_MAP, REPORT_FREQUENCIES, sectionsNeedUrl } from '../../../../lib/reports/sections'

// CRUD delle schedulazioni report personalizzate (report_schedules).
//
// Ogni schedulazione appartiene a un WORKSPACE e a un PRODOTTO (dal 21 set 2026):
//  · workspace_id: il cron genera i PDF con i dati di quello, e un'agenzia vede in ogni cliente
//    solo i report di quel cliente. Prima c'era solo l'autore (user_id): per un'agenzia il cron
//    non poteva sapere per quale cliente l'aveva creato.
//  · prodotto: la tabella e' la STESSA del fork di Anna Virgili (stesso database). Senza, il cron
//    di LyftAI mandava anche i report creati su AV, con i dati sbagliati, e quello di AV poteva
//    mandarli una seconda volta.
// Le colonne si aggiungono con supabase/report_schedules.sql. Finche' mancano l'elenco funziona
// come prima, ma un report nuovo NON si crea: resterebbe una riga che nessun cron sa a chi mandare.
const PRODOTTO = 'lyftai'
const senzaColonna = (error) => /workspace_id|prodotto/.test(String(error?.message || ''))

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
    // UI usa 1-7 (7=domenica), il cron confronta con getUTCDay() 0-6 → 7→0.
    // Prima il clamp a 6 rendeva la domenica un sabato.
    weekday: frequency === 'weekly' ? (() => { const w = parseInt(body?.weekday ?? 1, 10) || 1; return w === 7 ? 0 : Math.min(6, Math.max(0, w)) })() : null,
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
    const ws = await getEffectiveTenantId()
    const base = () => admin.from('report_schedules').select('*').eq('user_id', userId)
    // I report di LyftAI di QUESTO workspace, piu' quelli nati prima delle due colonne.
    const filtro = ws ? `workspace_id.eq.${ws},workspace_id.is.null` : 'workspace_id.is.null'
    let { data, error } = await base().or(filtro).or(`prodotto.eq.${PRODOTTO},prodotto.is.null`).order('created_at', { ascending: false })
    if (error && senzaColonna(error)) ({ data, error } = await base().order('created_at', { ascending: false }))
    if (error) throw error
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
    const workspace_id = await getEffectiveTenantId()
    if (!workspace_id) return NextResponse.json({ error: 'workspace_ignoto' }, { status: 409 })
    const { data, error } = await admin.from('report_schedules')
      .insert({ user_id: userId, workspace_id, prodotto: PRODOTTO, ...row }).select().maybeSingle()
    if (error && senzaColonna(error)) return NextResponse.json({ error: 'db_da_aggiornare' }, { status: 503 })
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
