export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { resolveWorkspace } from '../../../../lib/team/workspace'
import { sendEmail } from '../../../../lib/team/notify'
import { getTeamAgent } from '../../../../lib/agent/team'

// Programma la CALL SETTIMANALE della Squadra AI: crea un evento .ics ricorrente
// (RRULE settimanale, TZID Europe/Rome) con link Jitsi e lo invia via email a
// tutto il team → si aggiunge automaticamente a Google/Apple/Outlook Calendar.
// Annuncia anche la call in LyftTalk.

const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const pad = n => String(n).padStart(2, '0')

function buildRecurringICS({ localDate, startHHMMSS, endHHMMSS, jitsi, attendees, org }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const att = attendees.map(e => `ATTENDEE;CN=${esc(e)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${e}`)
  return [
    'BEGIN:VCALENDAR', 'PRODID:-//LyftAI//TeamCall//IT', 'VERSION:2.0', 'METHOD:REQUEST', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:weekly-team-call-${localDate}-${startHHMMSS}@lyftai`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/Rome:${localDate}T${startHHMMSS}`,
    `DTEND;TZID=Europe/Rome:${localDate}T${endHHMMSS}`,
    'RRULE:FREQ=WEEKLY',
    `SUMMARY:${esc('📞 Call settimanale Squadra AI')}`,
    `DESCRIPTION:${esc('Call settimanale con la Squadra AI di LyftAI.\nEntra qui: ' + jitsi)}`,
    `LOCATION:${esc(jitsi)}`,
    `URL:${jitsi}`,
    `ORGANIZER;CN=LyftAI:mailto:${org}`,
    ...att,
    'STATUS:CONFIRMED', 'TRANSP:OPAQUE',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Promemoria call settimanale', 'TRIGGER:-PT15M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  if (!ws.isAdmin) return NextResponse.json({ ok: false, error: 'Solo admin' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'no db' }, { status: 500 })

  let b = {}
  try { b = await req.json() } catch {}
  const weekday = Math.min(7, Math.max(1, Number(b.weekday) || 1)) // 1=lun … 7=dom
  const [hh, mm] = String(b.time || '10:00').split(':').map(n => Number(n))
  const durationMin = Math.min(180, Math.max(15, Number(b.durationMin) || 45))

  // Prossima occorrenza del giorno scelto (wall-clock Europe/Rome via TZID).
  const now = new Date()
  const jsTarget = weekday % 7 // lun=1 … dom=0
  let add = (jsTarget - now.getUTCDay() + 7) % 7
  if (add === 0) add = 7
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + add))
  const localDate = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
  const startHHMMSS = `${pad(hh || 10)}${pad(mm || 0)}00`
  const endMin = (hh || 10) * 60 + (mm || 0) + durationMin
  const endHHMMSS = `${pad(Math.floor(endMin / 60) % 24)}${pad(endMin % 60)}00`

  const jitsi = `https://meet.jit.si/LyftAI-Team-${ws.workspaceId.slice(0, 8)}`
  const org = process.env.REPORT_FROM_EMAIL || process.env.REPLY_TO || 'info@lyftads.agency'

  // Destinatari: membri attivi non-guest con email.
  const { data: members } = await admin.from('team_members')
    .select('email, roles, status').eq('workspace_id', ws.workspaceId).eq('status', 'active')
  const recipients = [...new Set((members || []).filter(m => m.email && !(m.roles || []).includes('guest')).map(m => m.email))]
  if (!recipients.length) return NextResponse.json({ ok: false, error: 'nessun destinatario con email' }, { status: 400 })

  const ics = buildRecurringICS({ localDate, startHHMMSS, endHHMMSS, jitsi, attendees: recipients, org })
  const attachment = {
    filename: 'call-settimanale.ics',
    content: Buffer.from(ics).toString('base64'),
    content_type: 'text/calendar; method=REQUEST; charset=UTF-8',
  }
  const DAYS = ['', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']
  const whenLabel = `ogni ${DAYS[weekday]} alle ${pad(hh || 10)}:${pad(mm || 0)}`

  let sent = 0
  for (const to of recipients) {
    const ok = await sendEmail({
      to,
      subject: '📅 Call settimanale della Squadra AI',
      html: `<div style="font-family:system-ui,Arial,sans-serif;max-width:520px">
        <h2 style="margin:0 0 8px">📞 Call settimanale Squadra AI</h2>
        <p style="color:#444">Appuntamento ricorrente <b>${whenLabel}</b> (Europe/Rome). L'evento è in allegato (.ics): aprilo per aggiungerlo al tuo calendario.</p>
        <p><a href="${jitsi}" style="background:#7c5cff;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:700">Entra nella call →</a></p>
        <p style="font-size:12px;color:#888">${jitsi}</p>
      </div>`,
      attachments: [attachment],
    })
    if (ok) sent++
  }

  // Annuncio in LyftTalk (Chiara).
  try {
    const { data: chans } = await admin.from('channels').select('id, name')
      .eq('workspace_id', ws.workspaceId).order('created_at', { ascending: true })
    const general = (chans || []).find(c => (c.name || '').toLowerCase() === 'generale') || (chans || [])[0]
    if (general) {
      const ceo = getTeamAgent('ceo')
      await admin.from('channel_messages').insert({
        channel_id: general.id, workspace_id: ws.workspaceId, author_id: null,
        author_name: `${ceo.name} · ${ceo.role}`,
        body: `📅 Ho fissato la nostra call settimanale: ${whenLabel}. L'invito è nelle vostre email (si aggiunge al calendario). Ci vediamo qui: ${jitsi}`,
      })
    }
  } catch {}

  return NextResponse.json({ ok: true, sent, recipients: recipients.length, jitsi, when: whenLabel })
}
