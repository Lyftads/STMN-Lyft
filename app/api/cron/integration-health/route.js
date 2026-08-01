export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { getTenantCreds, getCurrentUserId } from '../../../../lib/tenant/credentials'
import { CHECKS } from '../../../../lib/health/checks'
import { buildHealthEmail, resolveRecipient } from '../../../../lib/health/healthEmail'
import { sendEmail } from '../../../../lib/team/notify'

// ============================================================================
//  Cron salute integrazioni — gira su TUTTI i workspace.
//
//  Per ogni integrazione COLLEGATA fa una chiamata minima di verifica. Al
//  primo fallimento di un episodio avvisa il cliente via email, nella sua
//  lingua e col nome azienda della registrazione.
//
//  Anti-spam: una sola email per EPISODIO di guasto. `failing_since` marca
//  l inizio dell episodio, `notified_at` l avviso gia' mandato; quando il
//  provider torna ok entrambi si azzerano, cosi' un guasto futuro riavvisa.
//
//  ?dry=1 → esegue i controlli e riporta cosa farebbe, senza scrivere né
//  inviare nulla (per verificare in produzione senza spammare i clienti).
//
//  Auth: header 'authorization: Bearer <CRON_SECRET>' (Vercel lo passa da sé).
// ============================================================================

function isAuthorized(req) {
  const auth = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  return !!secret && auth === `Bearer ${secret}`
}

// L OWNER autenticato puo' lanciare il solo dry-run (nessun invio, nessuna
// scrittura): serve per verificare a mano senza il CRON_SECRET, che Vercel non
// rivela piu' dopo la creazione. L esecuzione REALE resta legata al segreto.
async function isOwnerSession() {
  try {
    const owner = process.env.LYFT_OWNER_USER_ID
    if (!owner) return false
    return (await getCurrentUserId()) === owner
  } catch { return false }
}

export async function GET(req) {
  const dry = new URL(req.url).searchParams.get('dry') === '1'
  if (!isAuthorized(req) && !(dry && await isOwnerSession())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  const { data: companies, error } = await admin
    .from('companies')
    .select('user_id, email, company_name, name, language, is_client_workspace')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Stato precedente, per capire cosa e' un guasto NUOVO.
  // FAIL-CLOSED: se la tabella non c'e' si esce SUBITO, prima di inviare
  // qualsiasi email. Senza lo stato persistito nessun invio sarebbe piu'
  // marcato come gia' fatto → una mail identica al cliente ogni giorno.
  const prev = new Map()
  {
    const { data, error: readErr } = await admin.from('integration_health')
      .select('workspace_id, provider, status, failing_since, notified_at')
    if (readErr) {
      return NextResponse.json({
        ok: false,
        error: `integration_health non leggibile (${readErr.message}) — esegui supabase/integration_health.sql prima di attivare il cron`,
      }, { status: 500 })
    }
    for (const r of (data || [])) prev.set(`${r.workspace_id}|${r.provider}`, r)
  }

  const now = new Date().toISOString()
  const rows = []
  const summary = { workspaces: 0, checked: 0, ok: 0, down: 0, emails: 0, skippedNoEmail: 0 }
  const notified = []

  for (const c of (companies || [])) {
    let creds = null
    try { creds = await getTenantCreds(c.user_id) } catch { continue }
    if (!creds) continue
    summary.workspaces++

    for (const { provider, run } of CHECKS) {
      let out
      try { out = await run(creds) } catch (e) { out = { configured: true, ok: false, error: String(e?.message || e).slice(0, 300) } }
      if (!out?.configured) continue      // non collegata → non e' un guasto
      summary.checked++

      const key = `${c.user_id}|${provider}`
      const before = prev.get(key)
      const wasFailing = before?.status === 'error'

      if (out.ok) {
        summary.ok++
        // Recupero: azzera l episodio così un guasto futuro riavvisa.
        rows.push({ workspace_id: c.user_id, provider, status: 'ok', error: null,
                    checked_at: now, failing_since: null, notified_at: null, notified_to: null })
        continue
      }

      summary.down++
      const failingSince = wasFailing ? (before.failing_since || now) : now
      const alreadyNotified = wasFailing && !!before.notified_at
      let notifiedAt = wasFailing ? before.notified_at : null
      let notifiedTo = null

      if (!alreadyNotified) {
        const rec = await resolveRecipient(admin, c)
        if (!rec.email) {
          summary.skippedNoEmail++
        } else {
          const brand = c.company_name || c.name || null
          const { subject, html } = buildHealthEmail({
            companyName: brand,
            provider,
            // Se l avviso passa dall agency, si usa la lingua dell agency.
            locale: rec.viaAgency ? (rec.agencyLocale || c.language) : c.language,
            error: out.error,
            viaAgency: rec.viaAgency,
          })
          const sent = dry ? true : await sendEmail({ to: rec.email, subject, html })
          if (sent) {
            summary.emails++
            notifiedAt = now
            notifiedTo = rec.email
            notified.push({ workspace: brand || c.user_id, provider, to: rec.email,
                            viaAgency: rec.viaAgency, error: out.error })
          }
        }
      }

      rows.push({ workspace_id: c.user_id, provider, status: 'error',
                  error: out.error || null, checked_at: now,
                  failing_since: failingSince, notified_at: notifiedAt, notified_to: notifiedTo })
    }
  }

  if (!dry && rows.length) {
    try {
      await admin.from('integration_health').upsert(rows, { onConflict: 'workspace_id,provider' })
    } catch (e) {
      return NextResponse.json({ ok: false, error: `upsert fallito: ${e?.message}`, summary }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, dry, summary, notified, at: now })
}
