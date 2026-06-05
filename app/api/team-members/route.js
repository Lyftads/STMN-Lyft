export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase, getServerSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

// Ruoli validi del modulo Team (oltre ad 'admin' = owner).
const ROLES = [
  'cro_specialist',
  'ecommerce_manager',
  'advertising_manager',
  'data_analyst',
]

// Garantisce che l'owner esista come team_member 'admin' attivo (così è
// assegnabile ai task e ha un memberId). Best-effort.
async function ensureOwnerMember(admin, ws) {
  if (!(ws.workspaceId === ws.userId)) return
  try {
    const { data: existing } = await admin
      .from('team_members')
      .select('id')
      .eq('workspace_id', ws.workspaceId)
      .eq('user_id', ws.userId)
      .maybeSingle()
    if (existing) return
    let email = `owner-${ws.userId}@workspace.local`
    try {
      const sb = getServerSupabase()
      const { data: { user } } = await sb.auth.getUser()
      if (user?.email) email = user.email
    } catch {}
    await admin.from('team_members').insert({
      workspace_id: ws.workspaceId,
      user_id: ws.userId,
      email,
      full_name: 'Admin',
      roles: ['admin'],
      status: 'active',
      accepted_at: new Date().toISOString(),
    })
  } catch {
    // tabella assente → degrada senza rompere
  }
}

export async function GET() {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ members: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ members: [] })

  await ensureOwnerMember(admin, ws)
  try {
    const { data } = await admin
      .from('team_members')
      .select('*')
      .eq('workspace_id', ws.workspaceId)
      .order('created_at', { ascending: true })
    return NextResponse.json({
      members: data || [],
      roles: ROLES,
      me: { userId: ws.userId, memberId: ws.memberId, roles: ws.roles, isAdmin: ws.isAdmin },
    })
  } catch (e) {
    return NextResponse.json({ members: [], error: e.message })
  }
}

// Crea/aggiorna un membro (invito). L'invio email verrà aggiunto in Fase 2;
// per ora registra la riga 'invited' col set di ruoli. Solo Admin.
export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!ws.isAdmin) return NextResponse.json({ ok: false, error: 'Solo Admin' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

  let b = {}
  try { b = await req.json() } catch {}
  const email = String(b.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Email non valida' }, { status: 400 })
  }
  const roles = Array.isArray(b.roles) ? b.roles.filter(r => ROLES.includes(r)) : []

  try {
    const { data, error } = await admin
      .from('team_members')
      .upsert(
        {
          workspace_id: ws.workspaceId,
          email,
          full_name: b.full_name || null,
          roles,
          status: 'invited',
        },
        { onConflict: 'workspace_id,email' }
      )
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, member: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

export async function PATCH(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!ws.isAdmin) return NextResponse.json({ ok: false, error: 'Solo Admin' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let b = {}
  try { b = await req.json() } catch {}
  if (!b.id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })
  const patch = {}
  if (b.roles !== undefined) patch.roles = Array.isArray(b.roles) ? b.roles.filter(r => ROLES.includes(r) || r === 'admin') : []
  if (b.full_name !== undefined) patch.full_name = b.full_name || null
  if (b.status !== undefined && ['invited', 'active', 'disabled'].includes(b.status)) patch.status = b.status
  try {
    await admin.from('team_members').update(patch).eq('id', b.id).eq('workspace_id', ws.workspaceId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

export async function DELETE(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!ws.isAdmin) return NextResponse.json({ ok: false, error: 'Solo Admin' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })
  try {
    // non eliminare l'owner
    await admin.from('team_members').delete().eq('id', id).eq('workspace_id', ws.workspaceId).neq('user_id', ws.workspaceId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
