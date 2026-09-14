export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace, isCollaborator } from '../../../lib/team/workspace'

// ============================================================================
//  Calendario — ferie/permessi/malattia + eventi e promo, in una vista sola.
//
//  Le assenze NON sono duplicate qui: restano in `time_off` col loro flusso di
//  approvazione (Lyftimer). Eventi e promo vivono in `calendar_events`.
//  Questa route legge da entrambe e normalizza le voci in un formato unico,
//  così la UI non deve sapere da dove arriva ciascuna riga.
//
//  Privacy: tutti i membri vedono CHI è assente (serve a pianificare), ma la
//  nota resta visibile solo all'interessato e agli admin — una malattia non
//  deve raccontare il motivo a tutto il team.
// ============================================================================

const ABSENCE_KINDS = ['ferie', 'permesso', 'malattia']
const EVENT_KINDS = ['promo_b2c', 'promo_negozi', 'evento', 'meeting']
const ALL_KINDS = [...ABSENCE_KINDS, ...EVENT_KINDS]

// La tabella eventi può non essere ancora stata creata (supabase/calendar_events.sql):
// in quel caso la UI mostra l'avviso di setup invece di un errore incomprensibile.
function isMissingTable(error) {
  const s = `${error?.code || ''} ${error?.message || ''}`.toLowerCase()
  return s.includes('42p01') || s.includes('does not exist') || s.includes('could not find the table')
}

async function resolveMember(admin, ws) {
  try {
    if (ws.memberId) {
      const { data } = await admin.from('team_members').select('id, full_name, email').eq('id', ws.memberId).maybeSingle()
      return { id: ws.memberId, name: data?.full_name || data?.email || 'Utente' }
    }
    const { data } = await admin.from('team_members').select('id, full_name, email').eq('user_id', ws.userId).maybeSingle()
    if (data) return { id: data.id, name: data.full_name || data.email || 'Owner' }
  } catch {}
  return { id: ws.memberId || null, name: 'Owner' }
}

const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

export async function GET(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ entries: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ entries: [] })

  const url = new URL(req.url)
  const from = isDate(url.searchParams.get('from')) ? url.searchParams.get('from') : null
  const to = isDate(url.searchParams.get('to')) ? url.searchParams.get('to') : null

  const me = await resolveMember(admin, ws)
  const entries = []
  let needsSetup = false

  // ── Assenze (time_off) ────────────────────────────────────────────────────
  try {
    let q = admin.from('time_off').select('*').eq('workspace_id', ws.workspaceId)
    // Sovrapposizione col periodo richiesto, non contenimento: un evento che
    // inizia il mese prima e finisce dentro deve comparire lo stesso.
    if (from) q = q.gte('end_date', from)
    if (to) q = q.lte('start_date', to)
    const { data } = await q
    for (const r of (data || [])) {
      const mine = r.member_id === me.id
      entries.push({
        id: r.id,
        source: 'time_off',
        kind: ABSENCE_KINDS.includes(r.type) ? r.type : 'permesso',
        title: r.member_name || '—',
        person: r.member_name || null,
        memberId: r.member_id || null,
        start: r.start_date,
        end: r.end_date,
        status: r.status === 'approved' ? 'confirmed' : (r.status === 'rejected' ? 'rejected' : 'draft'),
        note: (ws.isAdmin || mine) ? (r.note || null) : null,
        canEdit: ws.isAdmin || mine,
      })
    }
  } catch {}

  // ── Eventi e promo (calendar_events) ──────────────────────────────────────
  try {
    let q = admin.from('calendar_events').select('*').eq('workspace_id', ws.workspaceId)
    if (from) q = q.gte('end_date', from)
    if (to) q = q.lte('start_date', to)
    const { data, error } = await q
    if (error && isMissingTable(error)) needsSetup = true
    for (const r of (data || [])) {
      entries.push({
        id: r.id,
        source: 'event',
        kind: EVENT_KINDS.includes(r.kind) ? r.kind : 'evento',
        title: r.title,
        person: r.person_name || null,
        memberId: r.member_id || null,
        start: r.start_date,
        end: r.end_date,
        status: r.status === 'draft' ? 'draft' : 'confirmed',
        note: r.note || null,
        color: r.color || null,
        canEdit: ws.isAdmin || isCollaborator(ws),
      })
    }
  } catch (e) {
    if (isMissingTable(e)) needsSetup = true
  }

  entries.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))

  // Elenco membri: serve al modulo di creazione per assegnare un'assenza.
  let members = []
  try {
    const { data } = await admin.from('team_members')
      .select('id, full_name, email, status')
      .eq('workspace_id', ws.workspaceId).in('status', ['active', 'invited'])
    members = (data || []).map(m => ({ id: m.id, name: m.full_name || m.email }))
  } catch {}

  return NextResponse.json({
    entries,
    members,
    needsSetup,
    me: { memberId: me.id, name: me.name, isAdmin: ws.isAdmin, canWrite: ws.isAdmin || isCollaborator(ws) },
  })
}

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase non configurato' }, { status: 500 })

  let b
  try { b = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }) }

  const kind = ALL_KINDS.includes(b?.kind) ? b.kind : null
  if (!kind) return NextResponse.json({ ok: false, error: 'Tipo non valido' }, { status: 400 })
  if (!isDate(b?.start) || !isDate(b?.end)) return NextResponse.json({ ok: false, error: 'Date non valide' }, { status: 400 })
  if (b.end < b.start) return NextResponse.json({ ok: false, error: 'La fine precede l\'inizio' }, { status: 400 })

  const me = await resolveMember(admin, ws)

  if (ABSENCE_KINDS.includes(kind)) {
    // Un membro può registrare solo le PROPRIE assenze; l'admin per chiunque.
    const memberId = (ws.isAdmin && b.memberId) ? b.memberId : me.id
    let memberName = me.name
    if (memberId !== me.id) {
      try {
        const { data } = await admin.from('team_members').select('full_name, email').eq('id', memberId).eq('workspace_id', ws.workspaceId).maybeSingle()
        if (!data) return NextResponse.json({ ok: false, error: 'Membro non trovato' }, { status: 400 })
        memberName = data.full_name || data.email
      } catch { return NextResponse.json({ ok: false, error: 'Membro non trovato' }, { status: 400 }) }
    }
    const { error } = await admin.from('time_off').insert({
      workspace_id: ws.workspaceId, member_id: memberId, member_name: memberName, type: kind,
      start_date: b.start, end_date: b.end,
      note: b.note ? String(b.note).slice(0, 500) : null,
      status: ws.isAdmin ? 'approved' : 'pending',
      approved_by: ws.isAdmin ? me.id : null,
      approved_at: ws.isAdmin ? new Date().toISOString() : null,
    })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    return NextResponse.json({ ok: true })
  }

  if (!(ws.isAdmin || isCollaborator(ws))) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  }
  const title = String(b.title || '').trim().slice(0, 160)
  if (!title) return NextResponse.json({ ok: false, error: 'Titolo mancante' }, { status: 400 })

  const { error } = await admin.from('calendar_events').insert({
    workspace_id: ws.workspaceId, kind, title,
    member_id: b.memberId || null,
    person_name: b.person ? String(b.person).slice(0, 120) : null,
    start_date: b.start, end_date: b.end,
    note: b.note ? String(b.note).slice(0, 500) : null,
    status: b.status === 'draft' ? 'draft' : 'confirmed',
    created_by: ws.userId,
  })
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ ok: false, needsSetup: true, error: 'Tabella calendar_events assente' }, { status: 200 })
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
  }
  return NextResponse.json({ ok: true })
}

// Cambia stato o date di una voce. Sulle assenze equivale ad approvare/rifiutare.
export async function PATCH(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 })

  let b
  try { b = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }) }
  if (!b?.id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })
  const me = await resolveMember(admin, ws)

  if (b.source === 'time_off') {
    // Approvare/rifiutare resta prerogativa dell'admin.
    if (!ws.isAdmin) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
    const status = ['approved', 'rejected', 'pending'].includes(b.status) ? b.status : null
    if (!status) return NextResponse.json({ ok: false, error: 'Stato non valido' }, { status: 400 })
    await admin.from('time_off').update({
      status,
      approved_by: status === 'pending' ? null : me.id,
      approved_at: status === 'pending' ? null : new Date().toISOString(),
    }).eq('id', b.id).eq('workspace_id', ws.workspaceId)
    return NextResponse.json({ ok: true })
  }

  if (!(ws.isAdmin || isCollaborator(ws))) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  const patch = { updated_at: new Date().toISOString() }
  if (typeof b.title === 'string' && b.title.trim()) patch.title = b.title.trim().slice(0, 160)
  if (isDate(b.start)) patch.start_date = b.start
  if (isDate(b.end)) patch.end_date = b.end
  if (b.status === 'draft' || b.status === 'confirmed') patch.status = b.status
  if (typeof b.note === 'string') patch.note = b.note.slice(0, 500)
  if (patch.start_date && patch.end_date && patch.end_date < patch.start_date) {
    return NextResponse.json({ ok: false, error: 'La fine precede l\'inizio' }, { status: 400 })
  }
  const { error } = await admin.from('calendar_events').update(patch).eq('id', b.id).eq('workspace_id', ws.workspaceId)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const source = url.searchParams.get('source')
  if (!id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })
  const me = await resolveMember(admin, ws)

  if (source === 'time_off') {
    let q = admin.from('time_off').delete().eq('id', id).eq('workspace_id', ws.workspaceId)
    if (!ws.isAdmin) q = q.eq('member_id', me.id) // il membro cancella solo le proprie
    await q
    return NextResponse.json({ ok: true })
  }
  if (!(ws.isAdmin || isCollaborator(ws))) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  await admin.from('calendar_events').delete().eq('id', id).eq('workspace_id', ws.workspaceId)
  return NextResponse.json({ ok: true })
}
