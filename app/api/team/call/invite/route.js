export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { resolveWorkspace } from '../../../../../lib/team/workspace'
import { getAdminSupabase } from '../../../../../lib/supabase/server'
import { addNotification, sendEmail } from '../../../../../lib/team/notify'

// Invita un MEMBRO del team a una call di gruppo in corso: notifica in-app +
// messaggio in LyftTalk (col pulsante per entrare) + email best-effort.
export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'no db' }, { status: 500 })

  let b = {}
  try { b = await req.json() } catch {}
  const memberId = String(b.memberId || '').trim()
  const channelId = String(b.channelId || '').trim()
  const room = String(b.room || '').trim()
  if (!memberId) return NextResponse.json({ ok: false, error: 'memberId mancante' }, { status: 400 })

  // Nome di chi invita.
  let inviter = 'Un collega'
  try { const { data: me } = await admin.from('team_members').select('full_name, email').eq('id', ws.memberId).maybeSingle(); inviter = me?.full_name || me?.email?.split('@')[0] || inviter } catch {}
  // Destinatario.
  const { data: target } = await admin.from('team_members').select('id, email, full_name').eq('id', memberId).eq('workspace_id', ws.workspaceId).maybeSingle()
  if (!target) return NextResponse.json({ ok: false, error: 'membro non trovato' }, { status: 404 })

  // Notifica in-app.
  try { await addNotification({ workspaceId: ws.workspaceId, recipientId: memberId, type: 'call', title: '📞 Invito a una call di gruppo', body: `${inviter} ti ha invitato a una call di gruppo. Entra da LyftTalk → Call di gruppo.`, tab: 'chat' }) } catch {}

  // Messaggio in LyftTalk (col contesto per entrare).
  try {
    if (channelId) {
      await admin.from('channel_messages').insert({
        channel_id: channelId, workspace_id: ws.workspaceId, author_id: null, author_name: 'Sistema',
        body: `📞 ${inviter} ha invitato ${target.full_name || target.email?.split('@')[0] || 'un membro'} alla call di gruppo. Entrate dal pulsante "👥 Call di gruppo" qui sopra.`,
      })
    }
  } catch {}

  // Email best-effort.
  try {
    if (target.email) await sendEmail({ to: target.email, subject: '📞 Invito a una call di gruppo', html: `<div style="font-family:system-ui,Arial,sans-serif"><p>${inviter} ti ha invitato a una <b>call di gruppo</b> della squadra.</p><p>Apri <b>LyftAI → LyftTalk</b> e premi <b>"👥 Call di gruppo"</b> per entrare.</p></div>` })
  } catch {}

  return NextResponse.json({ ok: true, invited: target.full_name || target.email || memberId })
}
