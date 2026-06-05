export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { sendEmail, postSlack } from '../../../../lib/team/notify'

// Cron giornaliero: promemoria per i task in scadenza oggi/domani non ancora
// completati. Vercel cron invia 'authorization: Bearer <CRON_SECRET>'.
function authorized(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`
}

export async function GET(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().slice(0, 10)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stmn-lyft.vercel.app'

  try {
    const { data: tasks } = await admin
      .from('tasks')
      .select('id, workspace_id, title, due_date, status, assignee_id')
      .in('due_date', [todayStr, tomorrowStr])
      .not('assignee_id', 'is', null)

    const due = (tasks || []).filter(t => t.status !== 'done' && t.status !== 'approved')
    if (due.length === 0) return NextResponse.json({ ok: true, sent: 0 })

    const ids = [...new Set(due.map(t => t.assignee_id))]
    const { data: members } = await admin.from('team_members').select('id, email, full_name').in('id', ids)
    const map = {}
    ;(members || []).forEach(m => { map[m.id] = m })

    let sent = 0
    for (const t of due) {
      const m = map[t.assignee_id]
      const when = t.due_date === todayStr ? 'oggi' : 'domani'
      if (m?.email) {
        const ok = await sendEmail({
          to: m.email,
          subject: `⏰ Scadenza ${when}: ${t.title}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
            <p>Promemoria: il task <b>${t.title}</b> scade <b>${when}</b> (${t.due_date}).</p>
            <p><a href="${appUrl}/" style="background:#5b8bff;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Apri in LyftAI →</a></p>
          </div>`,
        })
        if (ok) sent++
      }
      await postSlack(`⏰ Scadenza ${when}: *${t.title}* (${m?.full_name || m?.email || '—'})`)
    }
    return NextResponse.json({ ok: true, sent, total: due.length })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
