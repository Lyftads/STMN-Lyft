export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// ============================================================================
//  /api/cron/scheduled-reports
//   Chiamato OGNI GIORNO alle 09:00 UTC da Vercel Cron (vercel.json).
//   1) Digest email legacy via env: weekly (lun) + monthly (giorno 1).
//   2) Schedulazioni personalizzate da DB (report_schedules) in scadenza oggi
//      → /api/scheduled-reports/send-custom (PDF in allegato).
// ============================================================================

export async function GET(req) {
  const auth = req.headers.get('authorization') || ''
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const cronHeaders = { 'Content-Type': 'application/json', 'x-internal-cron': process.env.CRON_SECRET || '' }
  const today = new Date()
  const dayOfWeek = today.getUTCDay() // 0=Sun..6=Sat
  const dayOfMonth = today.getUTCDate()
  const todayStr = today.toISOString().slice(0, 10)

  const results = { digests: [], schedules: [] }

  // ── 1) Digest legacy via env (back-compat) ──
  const types = []
  if (dayOfWeek === 1) types.push('weekly')
  if (dayOfMonth === 1) types.push('monthly')
  const recipientsEnv = process.env.REPORT_RECIPIENTS || process.env.REPORT_RECIPIENT || ''
  const recipients = recipientsEnv.split(',').map(s => s.trim()).filter(Boolean)
  for (const type of types) {
    for (const email of recipients) {
      try {
        const res = await fetch(`${origin}/api/scheduled-reports/send`, {
          method: 'POST', headers: cronHeaders, body: JSON.stringify({ type, email }),
        })
        const j = await res.json()
        results.digests.push({ type, email, ok: !!j.ok, error: j.error })
      } catch (e) {
        results.digests.push({ type, email, ok: false, error: e?.message })
      }
    }
  }

  // ── 2) Schedulazioni personalizzate da DB ──
  const admin = getAdminSupabase()
  if (admin) {
    try {
      let q = admin.from('report_schedules').select('*').eq('enabled', true)
      // In cron i report usano le creds dell'owner (x-internal-cron). Per non
      // generare dati dell'owner per schedulazioni di altri tenant, processo
      // solo quelle dell'owner se l'env è configurato.
      const owner = process.env.LYFT_OWNER_USER_ID
      if (owner) q = q.eq('user_id', owner)
      const { data } = await q
      for (const sched of (data || [])) {
        if (!isDue(sched, dayOfWeek, dayOfMonth)) continue
        if (sched.last_sent_at && String(sched.last_sent_at).slice(0, 10) === todayStr) continue
        try {
          const res = await fetch(`${origin}/api/scheduled-reports/send-custom`, {
            method: 'POST', headers: cronHeaders, body: JSON.stringify({ scheduleId: sched.id, locale: 'it' }),
          })
          const j = await res.json()
          results.schedules.push({ id: sched.id, name: sched.name, ok: !!j.ok, attachments: j.attachments, error: j.error })
        } catch (e) {
          results.schedules.push({ id: sched.id, name: sched.name, ok: false, error: e?.message })
        }
      }
    } catch (e) {
      results.schedules.push({ ok: false, error: e?.message })
    }
  }

  return NextResponse.json({
    ok: true,
    sentDigests: results.digests.filter(r => r.ok).length,
    sentSchedules: results.schedules.filter(r => r.ok).length,
    results,
  })
}

// Una schedulazione è in scadenza oggi?
function isDue(sched, dayOfWeek, dayOfMonth) {
  if (sched.frequency === 'daily') return true
  if (sched.frequency === 'weekly') return dayOfWeek === (sched.weekday ?? 1)
  if (sched.frequency === 'monthly') return dayOfMonth === (sched.monthday ?? 1)
  return false
}
