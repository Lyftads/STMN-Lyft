export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

// Risolve il membro corrente (id + nome) per attribuire le registrazioni.
// Gestisce anche l'owner che non ha ancora una riga memberId risolta.
async function resolveMember(admin, ws) {
  try {
    if (ws.memberId) {
      const { data } = await admin.from('team_members').select('id, full_name, email, avatar_url').eq('id', ws.memberId).maybeSingle()
      return { id: ws.memberId, name: data?.full_name || data?.email || 'Utente', avatar_url: data?.avatar_url || null }
    }
    const { data } = await admin.from('team_members').select('id, full_name, email, avatar_url').eq('user_id', ws.userId).maybeSingle()
    if (data) return { id: data.id, name: data.full_name || data.email || 'Owner', avatar_url: data.avatar_url || null }
  } catch {}
  return { id: ws.memberId || null, name: 'Owner', avatar_url: null }
}

function periodStart(period) {
  const now = new Date()
  if (period === 'today') {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString()
  }
  if (period === 'week') {
    const d = new Date(now); const dow = (d.getDay() + 6) % 7 // lunedì = 0
    d.setDate(d.getDate() - dow); d.setHours(0, 0, 0, 0); return d.toISOString()
  }
  return null // 'all'
}

export async function GET(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ entries: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ entries: [] })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || 'week'
  const scope = searchParams.get('scope') || 'me'
  const me = await resolveMember(admin, ws)

  try {
    // Mappe nomi per arricchire le voci
    const [{ data: projs }, { data: tks }, { data: mems }] = await Promise.all([
      admin.from('projects').select('id, name, color').eq('workspace_id', ws.workspaceId),
      admin.from('tasks').select('id, title').eq('workspace_id', ws.workspaceId),
      admin.from('team_members').select('id, full_name, email, avatar_url').eq('workspace_id', ws.workspaceId),
    ])
    const pMap = {}; (projs || []).forEach(p => { pMap[p.id] = p })
    const tMap = {}; (tks || []).forEach(t => { tMap[t.id] = t.title })
    const mMap = {}; (mems || []).forEach(m => { mMap[m.id] = { name: m.full_name || m.email, avatar_url: m.avatar_url || null } })

    let q = admin.from('time_entries').select('*').eq('workspace_id', ws.workspaceId)
    // I membri non-admin vedono solo le proprie voci. L'admin può scegliere.
    if (!ws.isAdmin || scope === 'me') q = q.eq('member_id', me.id)
    const from = periodStart(period)
    if (from) q = q.gte('started_at', from)
    q = q.order('started_at', { ascending: false }).limit(1000)
    const { data } = await q

    const entries = (data || []).map(e => ({
      ...e,
      project_name: e.project_id ? (pMap[e.project_id]?.name || '') : '',
      project_color: e.project_id ? (pMap[e.project_id]?.color || null) : null,
      task_title: e.task_id ? (tMap[e.task_id] || e.task_name || '') : (e.task_name || ''),
      member_name: (e.member_id && mMap[e.member_id]?.name) || e.member_name || '',
      member_avatar: e.member_id ? (mMap[e.member_id]?.avatar_url || null) : null,
    }))

    // Timer in corso del membro corrente (sopravvive al refresh)
    let running = null
    try {
      const { data: r } = await admin.from('time_entries').select('*')
        .eq('workspace_id', ws.workspaceId).eq('member_id', me.id).is('ended_at', null)
        .order('started_at', { ascending: false }).limit(1).maybeSingle()
      if (r) running = { ...r, project_name: r.project_id ? (pMap[r.project_id]?.name || '') : '', project_color: r.project_id ? (pMap[r.project_id]?.color || null) : null, task_title: r.task_id ? (tMap[r.task_id] || r.task_name || '') : (r.task_name || '') }
    } catch {}

    // Summary ultimi 7 giorni (indipendente dal filtro periodo) per le card + sparkline
    let summary = null
    try {
      const since = new Date(); since.setDate(since.getDate() - 6); since.setHours(0, 0, 0, 0)
      let sq = admin.from('time_entries').select('started_at, duration_seconds, project_id, member_id')
        .eq('workspace_id', ws.workspaceId).gte('started_at', since.toISOString())
      if (!ws.isAdmin || scope === 'me') sq = sq.eq('member_id', me.id)
      const { data: sd } = await sq

      const days = []
      for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0); days.push({ key: d.toDateString(), label: d.toLocaleDateString('it-IT', { weekday: 'short' }), sec: 0 }) }
      const dayIdx = {}; days.forEach((d, i) => { dayIdx[d.key] = i })
      const today0 = new Date(); today0.setHours(0, 0, 0, 0); const todayKey = today0.toDateString()
      const wkStart = new Date(); const dow = (wkStart.getDay() + 6) % 7; wkStart.setDate(wkStart.getDate() - dow); wkStart.setHours(0, 0, 0, 0)

      let todaySec = 0, weekSec = 0, total7 = 0
      const memAgg = {}, projAgg = {}
      for (const e of (sd || [])) {
        const sec = e.duration_seconds || 0
        const dt = new Date(e.started_at), dk = dt.toDateString()
        if (dayIdx[dk] !== undefined) days[dayIdx[dk]].sec += sec
        total7 += sec
        if (dk === todayKey) todaySec += sec
        if (dt >= wkStart) weekSec += sec
        const mk = e.member_id || '__me'
        if (!memAgg[mk]) memAgg[mk] = { name: (mMap[e.member_id]?.name) || me.name, avatar: mMap[e.member_id]?.avatar_url || null, todaySec: 0, weekSec: 0 }
        if (dk === todayKey) memAgg[mk].todaySec += sec
        if (dt >= wkStart) memAgg[mk].weekSec += sec
        const pk = e.project_id || '__none'
        if (!projAgg[pk]) projAgg[pk] = { name: e.project_id ? (pMap[e.project_id]?.name || '—') : 'Senza progetto', color: e.project_id ? (pMap[e.project_id]?.color || null) : null, sec: 0 }
        projAgg[pk].sec += sec
      }
      summary = {
        spark: days.map(d => d.sec),
        days: days.map(d => ({ label: d.label, sec: d.sec })),
        todaySec, weekSec, total7,
        members: Object.values(memAgg).sort((a, b) => b.weekSec - a.weekSec),
        projects: Object.values(projAgg).sort((a, b) => b.sec - a.sec),
      }
    } catch {}

    return NextResponse.json({ entries, running, summary, me: { memberId: me.id, name: me.name, avatar: me.avatar_url, isAdmin: ws.isAdmin } })
  } catch (e) {
    return NextResponse.json({ entries: [], error: e.message })
  }
}

// Avvia un nuovo timer (chiude eventuali timer ancora aperti del membro).
export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let b = {}
  try { b = await req.json() } catch {}
  const me = await resolveMember(admin, ws)

  try {
    // Chiudi timer aperti residui (un solo timer attivo per membro)
    const { data: open } = await admin.from('time_entries').select('id, started_at')
      .eq('workspace_id', ws.workspaceId).eq('member_id', me.id).is('ended_at', null)
    for (const o of (open || [])) {
      const dur = Math.max(0, Math.round((Date.now() - new Date(o.started_at).getTime()) / 1000))
      await admin.from('time_entries').update({ ended_at: new Date().toISOString(), duration_seconds: dur }).eq('id', o.id)
    }

    const row = {
      workspace_id: ws.workspaceId,
      member_id: me.id,
      member_name: me.name,
      project_id: b.project_id || null,
      task_id: b.task_id || null,
      task_name: (!b.task_id && b.task_name) ? String(b.task_name).slice(0, 200) : null,
      description: b.description ? String(b.description).slice(0, 1000) : null,
      started_at: new Date().toISOString(),
    }
    const { data, error } = await admin.from('time_entries').insert(row).select('*').single()
    if (error) throw error
    return NextResponse.json({ ok: true, entry: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

// Stop di un timer (o aggiornamento descrizione/progetto di una voce).
export async function PATCH(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let b = {}
  try { b = await req.json() } catch {}
  const me = await resolveMember(admin, ws)

  try {
    if (b.stop) {
      // Stop: se non passato id, ferma il timer aperto del membro
      let target = b.id
      if (!target) {
        const { data: r } = await admin.from('time_entries').select('id, started_at')
          .eq('workspace_id', ws.workspaceId).eq('member_id', me.id).is('ended_at', null)
          .order('started_at', { ascending: false }).limit(1).maybeSingle()
        if (!r) return NextResponse.json({ ok: true })
        target = r.id
      }
      const { data: row } = await admin.from('time_entries').select('started_at, ended_at').eq('id', target).eq('workspace_id', ws.workspaceId).maybeSingle()
      if (!row || row.ended_at) return NextResponse.json({ ok: true })
      const dur = Math.max(0, Math.round((Date.now() - new Date(row.started_at).getTime()) / 1000))
      await admin.from('time_entries').update({ ended_at: new Date().toISOString(), duration_seconds: dur }).eq('id', target).eq('workspace_id', ws.workspaceId)
      return NextResponse.json({ ok: true })
    }
    // Modifica voce
    if (!b.id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })
    const patch = {}
    if (b.description !== undefined) patch.description = b.description ? String(b.description).slice(0, 1000) : null
    if (b.project_id !== undefined) patch.project_id = b.project_id || null
    if (b.task_id !== undefined) { patch.task_id = b.task_id || null; if (b.task_id) patch.task_name = null }
    if (b.task_name !== undefined && !b.task_id) patch.task_name = b.task_name ? String(b.task_name).slice(0, 200) : null
    await admin.from('time_entries').update(patch).eq('id', b.id).eq('workspace_id', ws.workspaceId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

export async function DELETE(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })
  const me = await resolveMember(admin, ws)
  try {
    let q = admin.from('time_entries').delete().eq('id', id).eq('workspace_id', ws.workspaceId)
    if (!ws.isAdmin) q = q.eq('member_id', me.id) // i membri cancellano solo le proprie
    await q
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
