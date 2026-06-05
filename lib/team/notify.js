import { getAdminSupabase } from '../supabase/server'

// Notifiche del modulo Team: email (Resend) + Slack (incoming webhook opzionale)
// + invito Google Calendar (allegato .ics, METHOD:REQUEST → Gmail lo aggiunge al
// calendario dell'assegnatario). Best-effort: ogni errore viene ingoiato.

const STATUS_LABEL = { todo: 'Da fare', in_progress: 'In corso', in_review: 'In revisione', approved: 'Approvato', done: 'Fatto' }
const PRIO_LABEL = { low: 'Bassa', medium: 'Media', high: 'Alta', urgent: 'Urgente' }

function fromAddr() {
  return process.env.REPORT_FROM || process.env.CONTACT_FROM || 'LyftAI <onboarding@resend.dev>'
}
function organizerEmail() {
  const m = fromAddr().match(/<([^>]+)>/)
  return m ? m[1] : fromAddr()
}

export async function sendEmail({ to, subject, html, attachments }) {
  const key = process.env.RESEND_API_KEY
  if (!key || !to) return false
  const body = { from: fromAddr(), to: [to], subject, html }
  if (attachments && attachments.length) body.attachments = attachments
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok
  } catch { return false }
}

export async function postSlack(text) {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) return false
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
    return true
  } catch { return false }
}

async function getMember(admin, workspaceId, memberId) {
  if (!memberId) return null
  try {
    const { data } = await admin.from('team_members').select('email, full_name').eq('workspace_id', workspaceId).eq('id', memberId).maybeSingle()
    return data || null
  } catch { return null }
}

function appUrl(origin) {
  return origin || process.env.NEXT_PUBLIC_APP_URL || 'https://stmn-lyft.vercel.app'
}

function taskHtml(task, intro, origin) {
  const due = task.due_date ? `<p>Scadenza: <b>${task.due_date}</b> (aggiunta al tuo calendario)</p>` : ''
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
    <p>${intro}</p>
    <h2 style="margin:6px 0">${task.title}</h2>
    <p>Priorità: <b>${PRIO_LABEL[task.priority] || task.priority || '-'}</b> · Stato: <b>${STATUS_LABEL[task.status] || task.status}</b></p>
    ${due}
    <p><a href="${appUrl(origin)}/" style="background:#5b8bff;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Apri in LyftAI →</a></p>
  </div>`
}

// ── Google Calendar via allegato .ics ────────────────────────────────────────
function escapeICS(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}
function ymd(dateStr) { return dateStr.replace(/-/g, '') }
function nextDayYmd(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}
function buildICS(task, attendeeEmail) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const org = organizerEmail()
  return [
    'BEGIN:VCALENDAR', 'PRODID:-//LyftAI//Task//IT', 'VERSION:2.0', 'METHOD:REQUEST', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:task-${task.id}@lyftai`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(task.due_date)}`,
    `DTEND;VALUE=DATE:${nextDayYmd(task.due_date)}`,
    `SUMMARY:${escapeICS('Scadenza task: ' + task.title)}`,
    `DESCRIPTION:${escapeICS('Task LyftAI: ' + task.title)}`,
    `ORGANIZER;CN=LyftAI:mailto:${org}`,
    `ATTENDEE;CN=${escapeICS(attendeeEmail)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendeeEmail}`,
    'STATUS:CONFIRMED', 'TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Promemoria scadenza task', 'TRIGGER:-P1D', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}
function icsAttachment(task, attendeeEmail) {
  if (!task.due_date || !attendeeEmail) return null
  return {
    filename: 'scadenza.ics',
    content: Buffer.from(buildICS(task, attendeeEmail)).toString('base64'),
    content_type: 'text/calendar; method=REQUEST; charset=UTF-8',
  }
}

// ── Eventi ───────────────────────────────────────────────────────────────────
export async function notifyAssignment({ workspaceId, task, origin }) {
  try {
    const admin = getAdminSupabase()
    if (!admin) return
    const m = await getMember(admin, workspaceId, task.assignee_id)
    if (m?.email) {
      const att = icsAttachment(task, m.email)
      await sendEmail({ to: m.email, subject: `Nuovo task assegnato: ${task.title}`, html: taskHtml(task, 'Ti è stato assegnato un task:', origin), attachments: att ? [att] : undefined })
    }
    await postSlack(`📋 *${task.title}* assegnato a ${m?.full_name || m?.email || 'qualcuno'}${task.due_date ? ` · scadenza ${task.due_date}` : ''}`)
  } catch {}
}

export async function notifyStatusChange({ workspaceId, task, origin }) {
  try {
    const admin = getAdminSupabase()
    if (!admin) return
    const m = await getMember(admin, workspaceId, task.assignee_id)
    const label = STATUS_LABEL[task.status] || task.status
    if (m?.email) {
      await sendEmail({ to: m.email, subject: `Task aggiornato: ${task.title} → ${label}`, html: taskHtml(task, `Lo stato del task è ora <b>${label}</b>:`, origin) })
    }
    await postSlack(`🔄 *${task.title}* → ${label}`)
  } catch {}
}

// Scadenza impostata/aggiornata (senza cambio assegnatario) → invito calendario.
export async function notifyCalendarUpdate({ workspaceId, task, origin }) {
  try {
    const admin = getAdminSupabase()
    if (!admin || !task.due_date) return
    const m = await getMember(admin, workspaceId, task.assignee_id)
    if (!m?.email) return
    const att = icsAttachment(task, m.email)
    await sendEmail({ to: m.email, subject: `Scadenza aggiornata: ${task.title} (${task.due_date})`, html: taskHtml(task, `La scadenza del task è ora <b>${task.due_date}</b>:`, origin), attachments: att ? [att] : undefined })
    await postSlack(`📅 *${task.title}* scadenza ${task.due_date} (${m.full_name || m.email})`)
  } catch {}
}
