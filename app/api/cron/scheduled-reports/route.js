export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { workspaceDelReport } from '../../../../lib/tenant/credentials'
import { isBillingLocked } from '../../../../lib/tenant/billingLock'

// ============================================================================
//  /api/cron/scheduled-reports
//   Chiamato ogni giorno alle 09, 10, 11 e 12 UTC da Vercel Cron (vercel.json).
//   1) Digest email legacy via env: weekly (lun) + monthly (giorno 1). Solo al
//      giro delle 9.
//   2) Schedulazioni personalizzate da DB (report_schedules) in scadenza oggi e
//      non ancora spedite oggi, di TUTTI i clienti → /api/scheduled-reports/send-custom
//      (PDF in allegato), ognuna con i dati del SUO workspace. I giri delle 10-12
//      riprendono quelle rimaste indietro (tempo finito) o fallite.
//
//   Fino al 21 set 2026 partivano solo quelle dell'owner (LYFT_OWNER_USER_ID), con
//   le credenziali delle variabili d'ambiente: i report programmati dai clienti non
//   partivano proprio. Ora il workspace lo decide workspaceDelReport — mai
//   indovinato — e il cron passa x-lyft-workspace, cosi' le credenziali vengono dal
//   DB come nell'app.
// ============================================================================

// Ogni invio puo' durare minuti (un PDF per sezione, in fila). maxDuration e' 300 s:
// dopo PARTENZA_MAX non se ne comincia un altro (lo prende il giro dell'ora dopo),
// e a FINE si smette di aspettare — l'invio gia' partito finisce da solo e segna
// last_sent_at, quindi non si ripete.
const PARTENZA_MAX_MS = 150_000
const FINE_MS = 285_000

export async function GET(req) {
  const auth = req.headers.get('authorization') || ''
  const cronSecret = process.env.CRON_SECRET
  // fail-closed come gli altri cron: senza secret l'endpoint restava pubblico
  // e chiunque poteva far partire l'invio dei report per email.
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const inizio = Date.now()
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const cronHeaders = { 'Content-Type': 'application/json', 'x-internal-cron': process.env.CRON_SECRET || '' }
  const today = new Date()
  const dayOfWeek = today.getUTCDay() // 0=Sun..6=Sat
  const dayOfMonth = today.getUTCDate()
  const todayStr = today.toISOString().slice(0, 10)
  const primoGiro = today.getUTCHours() === 9

  const results = { digests: [], schedules: [] }

  // ── 1) Digest legacy via env (back-compat) ──
  const types = []
  if (primoGiro && dayOfWeek === 1) types.push('weekly')
  if (primoGiro && dayOfMonth === 1) types.push('monthly')
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

  // ── 2) Schedulazioni personalizzate da DB, di tutti i clienti ──
  const admin = getAdminSupabase()
  if (admin) {
    try {
      // Solo i report di LyftAI: la tabella e' condivisa col fork di Anna Virgili, che manda i suoi.
      const { data, error } = await admin.from('report_schedules').select('*').eq('enabled', true).eq('prodotto', 'lyftai')
      if (error) {
        // Colonne non ancora aggiunte (supabase/report_schedules.sql): senza, non si sa di chi e'
        // un report, e non se ne manda nessuno piuttosto che mandarlo coi dati sbagliati.
        console.log('[scheduled-reports] report_schedules non leggibile:', error.message)
        results.schedules.push({ ok: false, error: error.message })
      }
      const daFare = (data || []).filter(sched => isDue(sched, dayOfWeek, dayOfMonth)
        && !(sched.last_sent_at && String(sched.last_sent_at).slice(0, 10) === todayStr))
      for (const sched of daFare) {
        const voce = { id: sched.id, name: sched.name }
        if (Date.now() - inizio > PARTENZA_MAX_MS) { results.schedules.push({ ...voce, ok: false, rinviato: true }); continue }
        const { ws, motivo } = await workspaceDelReport(sched)
        if (!ws) {
          console.log('[scheduled-reports] saltato', sched.id, motivo)
          results.schedules.push({ ...voce, ok: false, saltato: motivo })
          continue
        }
        // Abbonamento scaduto: l'app e' chiusa, e i report non partono.
        if (await isBillingLocked(ws)) { results.schedules.push({ ...voce, ok: false, saltato: 'abbonamento scaduto' }); continue }
        try {
          const res = await fetch(`${origin}/api/scheduled-reports/send-custom`, {
            method: 'POST',
            headers: { ...cronHeaders, 'x-lyft-workspace': ws },
            body: JSON.stringify({ scheduleId: sched.id, locale: await linguaDel(admin, ws) }),
            signal: AbortSignal.timeout(Math.max(20_000, FINE_MS - (Date.now() - inizio))),
          })
          const j = await res.json().catch(() => ({}))
          results.schedules.push({ ...voce, ok: !!j.ok, attachments: j.attachments, error: j.error })
        } catch (e) {
          results.schedules.push({ ...voce, ok: false, error: e?.name === 'TimeoutError' ? 'ancora in corso allo scadere del giro' : e?.message })
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

// La lingua del cliente per i PDF (companies.language), come nell'app; prima il cron li
// chiedeva tutti in italiano.
async function linguaDel(admin, ws) {
  try {
    const { data } = await admin.from('companies').select('language').eq('user_id', ws).maybeSingle()
    return ['it', 'en', 'es', 'fr', 'de'].includes(data?.language) ? data.language : 'it'
  } catch { return 'it' }
}

// Una schedulazione è in scadenza oggi?
function isDue(sched, dayOfWeek, dayOfMonth) {
  if (sched.frequency === 'daily') return true
  if (sched.frequency === 'weekly') return dayOfWeek === (sched.weekday ?? 1)
  if (sched.frequency === 'monthly') return dayOfMonth === (sched.monthday ?? 1)
  return false
}
