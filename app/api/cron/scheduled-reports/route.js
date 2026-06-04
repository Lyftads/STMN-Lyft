export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

// ============================================================================
//  /api/cron/scheduled-reports
//   Endpoint chiamato da Vercel Cron Jobs (vercel.json).
//   - Lunedi 09:00 → weekly digest
//   - Primo del mese 09:00 → monthly digest
//   Recipients da env REPORT_RECIPIENTS (comma-separated) o REPORT_RECIPIENT.
// ============================================================================

export async function GET(req) {
  // Verifica auth Vercel Cron (header authorization)
  const auth = req.headers.get('authorization') || ''
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  const dayOfWeek = today.getUTCDay() // 0=Sun..6=Sat
  const dayOfMonth = today.getUTCDate()

  // Decisione tipo digest da inviare oggi
  const types = []
  // Lunedi (1) → weekly
  if (dayOfWeek === 1) types.push('weekly')
  // Primo del mese → monthly
  if (dayOfMonth === 1) types.push('monthly')

  if (types.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      skipped: true,
      reason: 'Oggi non e\' un giorno di digest (lun=weekly, 1=monthly)',
    })
  }

  const recipientsEnv = process.env.REPORT_RECIPIENTS || process.env.REPORT_RECIPIENT || ''
  const recipients = recipientsEnv.split(',').map(s => s.trim()).filter(Boolean)
  if (recipients.length === 0) {
    return NextResponse.json({
      error: 'REPORT_RECIPIENT(S) env mancante',
    }, { status: 400 })
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const results = []
  for (const type of types) {
    for (const email of recipients) {
      try {
        const res = await fetch(`${origin}/api/scheduled-reports/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, email }),
        })
        const j = await res.json()
        results.push({ type, email, ok: !!j.ok, message_id: j.message_id, error: j.error })
      } catch (e) {
        results.push({ type, email, ok: false, error: e?.message })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    sent: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
  })
}
