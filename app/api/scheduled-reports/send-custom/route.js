export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { withTenantContext, getCurrentUserId } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { presetToRange } from '../../../lib/reportRange'
import { REPORT_SECTION_MAP } from '../../../../lib/reports/sections'
import { reportLogoEmail } from '../../../../lib/reports/logo'

// ============================================================================
//  /api/scheduled-reports/send-custom
//   POST { scheduleId }                          → carica la schedulazione dal DB
//   POST { name, sections[], timeframe, recipients[]|email, locale }  → invio diretto (test)
//   Genera un PDF per ogni sezione via /api/report e li allega a una sola email.
// ============================================================================

export async function POST(req) {
  return withTenantContext(req, async () => {
    let body
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Body invalido' }, { status: 400 }) }

    const cookie = req.headers.get('cookie') || ''
    const cron = req.headers.get('x-internal-cron') || ''
    const isCron = !!cron

    // Risolvi la configurazione: da DB (scheduleId) o inline.
    let cfg = null
    const admin = getAdminSupabase()
    if (body?.scheduleId) {
      if (!admin) return NextResponse.json({ error: 'Storage non disponibile' }, { status: 500 })
      let q = admin.from('report_schedules').select('*').eq('id', body.scheduleId)
      if (!isCron) {
        const uid = await getCurrentUserId()
        if (!uid) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
        q = q.eq('user_id', uid)
      }
      const { data } = await q.maybeSingle()
      if (!data) return NextResponse.json({ error: 'Schedulazione non trovata' }, { status: 404 })
      cfg = data
    } else {
      cfg = {
        name: String(body?.name || 'Report').slice(0, 80),
        sections: Array.isArray(body?.sections) ? body.sections : [],
        timeframe: String(body?.timeframe || 'last_7d'),
        recipients: Array.isArray(body?.recipients) && body.recipients.length
          ? body.recipients
          : (body?.email ? [body.email] : []),
      }
    }

    const sections = (cfg.sections || []).filter(s => REPORT_SECTION_MAP[s])
    const recipients = (cfg.recipients || []).map(r => String(r).trim()).filter(r => r.includes('@'))
    if (!sections.length) return NextResponse.json({ error: 'Nessun report selezionato' }, { status: 400 })
    if (!recipients.length) return NextResponse.json({ error: 'Nessun destinatario valido' }, { status: 400 })

    const locale = body?.locale || 'it'
    const { since, until, prevSince, prevUntil, label } = presetToRange(cfg.timeframe)
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

    const fwd = {}
    if (cookie) fwd.cookie = cookie
    if (cron) fwd['x-internal-cron'] = cron

    // Genera un PDF per ogni sezione (sequenziale: ognuna è pesante).
    const attachments = []
    const failed = []
    const slug = (s) => s.replace(/\s+/g, '_').replace(/[^\w-]/g, '')
    for (const secId of sections) {
      const sec = REPORT_SECTION_MAP[secId]
      try {
        let buf = null, fname = null
        if (sec.kind === 'seo') {
          buf = await seoAuditPdf(origin, fwd, cfg.target_url, locale)
          fname = `LyftAI_SEO_${slug(hostOf(cfg.target_url))}_${since}.pdf`
        } else if (sec.kind === 'scanner') {
          buf = await scannerPdf(origin, fwd, cfg.target_url, locale)
          fname = `LyftAI_Scanner_${slug(hostOf(cfg.target_url))}_${since}.pdf`
        } else {
          const qs = new URLSearchParams({ tab: sec.tab, label, since, until, prevSince, prevUntil, preset: cfg.timeframe, locale })
          const r = await fetch(`${origin}/api/report?${qs.toString()}`, { headers: fwd, signal: AbortSignal.timeout(120000) })
          if ((r.headers.get('content-type') || '').includes('pdf')) buf = Buffer.from(await r.arrayBuffer())
          fname = `LyftAI_${slug(sec.tab)}_${since}_${until}.pdf`
        }
        if (buf) attachments.push({ filename: fname, content: buf.toString('base64') })
        else failed.push(`${sec.label} (PDF non generato${sec.needsUrl && !cfg.target_url ? ' — URL mancante' : ' — Browserless?'})`)
      } catch (e) {
        failed.push(`${sec.label} (${e?.message || 'errore'})`)
      }
    }

    if (!attachments.length) {
      return NextResponse.json({ error: `Nessun PDF generato. ${failed.join('; ')}` }, { status: 500 })
    }

    const subject = `${cfg.name} — ${label} (${since} → ${until})`
    const html = bodyHtml(cfg.name, label, since, until, sections.map(s => REPORT_SECTION_MAP[s].label), failed)
    const result = await sendViaResend({ to: recipients, subject, html, attachments })
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 500 })

    // Aggiorna last_sent_at (solo schedulazioni reali).
    if (cfg.id && admin) {
      try { await admin.from('report_schedules').update({ last_sent_at: new Date().toISOString() }).eq('id', cfg.id) } catch {}
    }

    return NextResponse.json({ ok: true, sent_to: recipients, attachments: attachments.length, message_id: result.id, failed })
  })
}

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, '') } catch { return 'url' }
}

// SEO Audit on-demand di un URL → PDF.
async function seoAuditPdf(origin, fwd, url, locale) {
  if (!url) return null
  const aRes = await fetch(`${origin}/api/seo-audit`, {
    method: 'POST', headers: { ...fwd, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, locale, save: false }), signal: AbortSignal.timeout(90000),
  })
  const audit = await aRes.json().catch(() => null)
  if (!audit || audit.error) return null
  const pRes = await fetch(`${origin}/api/seo-audit/pdf`, {
    method: 'POST', headers: { ...fwd, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: audit, locale }), signal: AbortSignal.timeout(60000),
  })
  if (!(pRes.headers.get('content-type') || '').includes('pdf')) return null
  return Buffer.from(await pRes.arrayBuffer())
}

// AI Website Scanner (analisi CRO Vision) di un URL → PDF.
async function scannerPdf(origin, fwd, url, locale) {
  if (!url) return null
  const sRes = await fetch(`${origin}/api/website-scanner`, {
    method: 'POST', headers: { ...fwd, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, viewport: 'desktop', locale, save: false }), signal: AbortSignal.timeout(120000),
  })
  const scan = await sRes.json().catch(() => null)
  if (!scan || !scan.analysis) return null
  const pRes = await fetch(`${origin}/api/website-scanner/pdf`, {
    method: 'POST', headers: { ...fwd, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { url: scan.url, viewport: scan.viewport, analysis: scan.analysis, updatedAt: scan.updatedAt }, locale }),
    signal: AbortSignal.timeout(60000),
  })
  if (!(pRes.headers.get('content-type') || '').includes('pdf')) return null
  return Buffer.from(await pRes.arrayBuffer())
}

function bodyHtml(name, label, since, until, sectionLabels, failed) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /></head>
<body style="margin:0;background:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a14;padding:32px 16px;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#14122a,#0a0a14);border-radius:20px;border:1px solid rgba(255,255,255,0.06);">
    <tr><td style="padding:32px;">
      ${reportLogoEmail()}
      <div style="font-size:11px;color:#2997ff;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;margin-bottom:8px;">Report</div>
      <div style="font-size:22px;font-weight:900;margin-bottom:6px;">${escapeHtml(name)}</div>
      <div style="font-size:13px;color:#9b90aa;margin-bottom:20px;">${escapeHtml(label)} · ${since} → ${until}</div>
      <div style="font-size:13px;color:#cfc8da;line-height:1.7;">In allegato trovi ${sectionLabels.length} report PDF:</div>
      <ul style="font-size:13px;color:#fff;line-height:1.8;margin:8px 0 0;padding-left:18px;">
        ${sectionLabels.map(l => `<li>${escapeHtml(l)}</li>`).join('')}
      </ul>
      ${failed.length ? `<div style="margin-top:14px;font-size:12px;color:#fca5a5;">Non generati: ${failed.map(escapeHtml).join('; ')}</div>` : ''}
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#6b6580;text-align:center;">
        Generato automaticamente da LyftAI · ${new Date().toLocaleString('it-IT')}
      </div>
    </td></tr>
  </table>
</td></tr></table></body></html>`
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function sendViaResend({ to, subject, html, attachments }) {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, reason: 'RESEND_API_KEY mancante' }
  const from = process.env.REPORT_FROM || process.env.CONTACT_FROM || 'LyftAI <onboarding@resend.dev>'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html, attachments }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) {
      const t = await res.text()
      return { ok: false, reason: `resend_${res.status}: ${t.slice(0, 200)}` }
    }
    const j = await res.json()
    return { ok: true, id: j?.id }
  } catch (e) {
    return { ok: false, reason: e?.message || 'send_failed' }
  }
}
