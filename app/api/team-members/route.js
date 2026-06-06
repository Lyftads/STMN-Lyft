export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getAdminSupabase, getServerSupabase } from '../../../lib/supabase/server'
import { getCurrentUserId } from '../../../lib/tenant/credentials'
import { resolveWorkspace } from '../../../lib/team/workspace'

// Ruoli validi del modulo Team (oltre ad 'admin' = owner).
const ROLES = [
  'cro_specialist',
  'ecommerce_manager',
  'advertising_manager',
  'data_analyst',
]
const ROLE_LABELS = {
  admin: 'Admin',
  cro_specialist: 'CRO Specialist',
  ecommerce_manager: 'E-commerce Manager',
  advertising_manager: 'Advertising / Marketing / SEO',
  data_analyst: 'Data Analyst / Revisore',
}

async function currentEmail() {
  try {
    const sb = getServerSupabase()
    const { data: { user } } = await sb.auth.getUser()
    return user?.email ? user.email.toLowerCase() : null
  } catch { return null }
}

// Aggancia l'utente loggato agli inviti pendenti che combaciano con la sua email
// (status invited, user_id null) → status active. Best-effort.
async function acceptPendingInvites(admin, userId, email) {
  if (!userId || !email) return
  try {
    await admin
      .from('team_members')
      .update({ user_id: userId, status: 'active', accepted_at: new Date().toISOString() })
      .eq('email', email)
      .is('user_id', null)
      .eq('status', 'invited')
  } catch {}
}

// Garantisce che l'owner esista come team_member 'admin' attivo.
async function ensureOwnerMember(admin, ws, email) {
  if (ws.workspaceId !== ws.userId) return
  try {
    const { data: existing } = await admin
      .from('team_members').select('id')
      .eq('workspace_id', ws.workspaceId).eq('user_id', ws.userId).maybeSingle()
    if (existing) return
    await admin.from('team_members').insert({
      workspace_id: ws.workspaceId, user_id: ws.userId,
      email: email || `owner-${ws.userId}@workspace.local`,
      full_name: 'Admin', roles: ['admin'], status: 'active',
      accepted_at: new Date().toISOString(),
    })
  } catch {}
}

function originOf(req) {
  return req.headers.get('origin') ||
    (req.headers.get('host') ? `https://${req.headers.get('host')}` : null) ||
    process.env.NEXT_PUBLIC_APP_URL || 'https://stmn-lyft.vercel.app'
}

// Trova un utente auth per email (no filtro nativo → scorre le pagine).
async function findAuthUserByEmail(admin, email) {
  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    return (data?.users || []).find(u => (u.email || '').toLowerCase() === email) || null
  } catch { return null }
}

// Crea (o aggiorna) l'utente auth GIÀ confermato con una password temporanea.
// Bypassa del tutto l'email di conferma Supabase. Ritorna { userId, password }.
async function ensureAuthUser(admin, email) {
  const password = 'Ly' + randomBytes(6).toString('hex') // 14 char, ≥ min Supabase
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (!error && created?.user?.id) return { userId: created.user.id, password }
  // probabile "already registered" → trova e aggiorna (conferma + nuova password)
  const existing = await findAuthUserByEmail(admin, email)
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
    return { userId: existing.id, password }
  }
  throw new Error(error?.message || 'createUser fallito')
}

async function sendCredentialsEmail({ to, origin, roles, password }) {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, reason: 'RESEND_API_KEY mancante' }
  const from = process.env.REPORT_FROM || process.env.CONTACT_FROM || 'LyftAI <onboarding@resend.dev>'
  const roleNames = (roles || []).map(r => ROLE_LABELS[r] || r).join(', ') || 'Collaboratore'
  const link = `${origin}/login`
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#5b8bff">Il tuo accesso a LyftAI è pronto</h2>
      <p>Sei stato aggiunto al team come <b>${roleNames}</b>.</p>
      <p>Accedi con queste credenziali:</p>
      <p style="background:#f4f4f8;padding:14px 16px;border-radius:8px;font-size:15px">
        Email: <b>${to}</b><br>
        Password temporanea: <b style="font-family:monospace">${password}</b>
      </p>
      <p><a href="${link}" style="background:#5b8bff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Accedi →</a></p>
      <p style="color:#888;font-size:13px">Dopo il primo accesso puoi cambiare la password dalla pagina di reset.</p>
    </div>`
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: process.env.REPLY_TO || 'info@lyftads.agency', subject: 'Il tuo accesso a LyftAI', html }),
    })
    if (!res.ok) { const t = await res.text(); return { ok: false, reason: `resend_${res.status}: ${t.slice(0, 160)}` } }
    return { ok: true }
  } catch (e) { return { ok: false, reason: e.message } }
}

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ members: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ members: [] })

  const email = await currentEmail()
  // 1) aggancia eventuali inviti pendenti PRIMA di risolvere il workspace
  await acceptPendingInvites(admin, userId, email)
  // 2) risolvi il workspace (ora un invitato accettato punta all'owner)
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ members: [] }, { status: 401 })
  await ensureOwnerMember(admin, ws, email)

  try {
    const { data } = await admin
      .from('team_members').select('*')
      .eq('workspace_id', ws.workspaceId)
      .order('created_at', { ascending: true })
    return NextResponse.json({
      members: data || [],
      roles: ROLES,
      roleLabels: ROLE_LABELS,
      me: { userId: ws.userId, memberId: ws.memberId, roles: ws.roles, isAdmin: ws.isAdmin, isMember: ws.workspaceId !== ws.userId },
    })
  } catch (e) {
    return NextResponse.json({ members: [], error: e.message })
  }
}

// Invito: crea/aggiorna riga 'invited' + invia email. Solo Admin.
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

  // 1) account auth GIÀ confermato con password temporanea (no email Supabase)
  let auth
  try {
    auth = await ensureAuthUser(admin, email)
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'Auth: ' + e.message }, { status: 200 })
  }

  // 2) team_member attivo e collegato all'utente auth
  let member = null
  try {
    const { data, error } = await admin
      .from('team_members')
      .upsert(
        { workspace_id: ws.workspaceId, email, full_name: b.full_name || null, user_id: auth.userId, roles, status: 'active', accepted_at: new Date().toISOString() },
        { onConflict: 'workspace_id,email' }
      )
      .select('*').single()
    if (error) throw error
    member = data
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }

  // 3) email con credenziali via Resend (password mostrata anche all'admin come fallback)
  const mail = await sendCredentialsEmail({ to: email, origin: originOf(req), roles, password: auth.password })
  return NextResponse.json({ ok: true, member, emailSent: mail.ok, emailError: mail.ok ? null : mail.reason, tempPassword: auth.password })
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
    // non declassare l'owner (ruoli/stato/nome)
    if (Object.keys(patch).length) {
      await admin.from('team_members').update(patch).eq('id', b.id).eq('workspace_id', ws.workspaceId).neq('user_id', ws.workspaceId)
    }
    // la tariffa oraria si può impostare su chiunque, owner incluso
    if (b.hourly_rate !== undefined) {
      const rate = (b.hourly_rate === '' || b.hourly_rate === null) ? null : Number(b.hourly_rate)
      await admin.from('team_members').update({ hourly_rate: rate }).eq('id', b.id).eq('workspace_id', ws.workspaceId)
    }
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
