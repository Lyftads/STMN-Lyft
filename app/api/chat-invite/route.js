export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'
import { ensureAuthUser, sendChatInviteEmail } from '../../../lib/team/invite'

function originOf(req) {
  // Questo valore finisce dentro un'EMAIL, quindi deve essere il dominio
  // PUBBLICO. origin/host sono quelli della richiesta: se chi invita sta
  // navigando un URL di deployment (…-lyftads-projects.vercel.app, protetto
  // da Vercel), l'invitato riceveva un link che lo portava al login di Vercel
  // invece che a quello dell'app. Percio' la variabile canonica viene PRIMA.
  const canonico = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || '').trim()
  if (canonico) return canonico.replace(/\/+$/, '')
  // Niente dominio fisso come ultima risorsa: questo file vive anche nel fork
  // di Anna Virgili, e un lyftai.io scritto a mano manderebbe le persone
  // nell'altro prodotto. Meglio il dominio della richiesta.
  return req.headers.get('origin') ||
    (req.headers.get('host') ? `https://${req.headers.get('host')}` : '')
}

// Invita una persona ESTERNA (guest) alla chat, opzionalmente a un canale.
// Il guest accede solo alla Chat (ruolo 'guest' → gating chat-only).
export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws || !ws.memberId) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

  let b = {}
  try { b = await req.json() } catch {}
  const email = String(b.email || '').trim().toLowerCase()
  const channelId = b.channel_id || null
  const fullName = b.full_name ? String(b.full_name).trim() : null
  if (!email || !email.includes('@')) return NextResponse.json({ ok: false, error: 'Email non valida' }, { status: 400 })

  // 1) account auth confermato + password temporanea
  let auth
  try { auth = await ensureAuthUser(admin, email) }
  catch (e) { return NextResponse.json({ ok: false, error: 'Auth: ' + e.message }, { status: 200 }) }

  // 2) team_member 'guest' attivo (vede solo la chat)
  let member = null
  try {
    const { data } = await admin.from('team_members').upsert(
      { workspace_id: ws.workspaceId, email, full_name: fullName, user_id: auth.userId, roles: ['guest'], status: 'active', accepted_at: new Date().toISOString() },
      { onConflict: 'workspace_id,email' }
    ).select('*').single()
    member = data
  } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 200 }) }

  // 3) opzionale: aggiungilo al canale
  if (channelId && member) {
    try { await admin.from('channel_members').upsert({ channel_id: channelId, member_id: member.id }, { onConflict: 'channel_id,member_id' }) } catch {}
  }

  // 4) email con credenziali + link alla chat
  const mail = await sendChatInviteEmail({ to: email, origin: originOf(req), password: auth.password })
  return NextResponse.json({ ok: true, member, tempPassword: auth.password, emailSent: mail.ok, emailError: mail.ok ? null : mail.reason })
}
