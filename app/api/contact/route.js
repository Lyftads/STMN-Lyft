export const dynamic = 'force-dynamic'
export const maxDuration = 15

import { NextResponse } from 'next/server'

// ============================================================================
//  Contact form endpoint — landing page
//
//  POST body: { name, company, email, phone, website, revenue, message, lang }
//
//  Invia email a catastamarino@gmail.com con i dati del form.
//  Provider: Resend (RESEND_API_KEY env var). Se manca la key, logga la
//  richiesta in console + ritorna 200 cosi' la UI funziona comunque.
//
//  Setup necessario su Vercel:
//    RESEND_API_KEY=re_xxxxxxxx
//    CONTACT_TO=catastamarino@gmail.com (opzionale, default catastamarino)
//    CONTACT_FROM=noreply@lyftai.io (opzionale, richiede dominio verificato
//                                    su Resend; fallback su onboarding@resend.dev)
// ============================================================================

const CONTACT_TO = process.env.CONTACT_TO || 'catastamarino@gmail.com'

function sanitize(s, max = 500) {
  if (typeof s !== 'string') return ''
  return s.replace(/[\r\n]+/g, ' ').replace(/<[^>]*>/g, '').trim().slice(0, max)
}

function buildEmailHtml(data) {
  const fields = [
    ['Nome', data.name],
    ['Azienda', data.company],
    ['Email', data.email],
    ['Telefono', data.phone],
    ['Sito web', data.website],
    ['Fatturato annuo', data.revenue],
    ['Lingua landing', data.lang],
  ]
  const rows = fields.filter(([_, v]) => v).map(([k, v]) => `
    <tr>
      <td style="padding:6px 12px;color:#666;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">${k}</td>
      <td style="padding:6px 12px;color:#111;font-size:14px;">${escapeHtml(v)}</td>
    </tr>
  `).join('')

  const msg = data.message ? `
    <div style="margin-top:20px;padding:16px;background:#f5f5f7;border-radius:10px;">
      <div style="font-size:11px;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Messaggio</div>
      <div style="font-size:14px;color:#111;line-height:1.5;white-space:pre-wrap;">${escapeHtml(data.message)}</div>
    </div>
  ` : ''

  return `
    <div style="font-family:-apple-system,system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
      <div style="border-bottom:1px solid #eee;padding-bottom:16px;margin-bottom:24px;">
        <div style="font-size:22px;font-weight:900;color:#111;letter-spacing:-0.02em;">LyftAI</div>
        <div style="font-size:13px;color:#666;margin-top:4px;">Nuova richiesta dalla landing page</div>
      </div>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      ${msg}
      <div style="margin-top:30px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;">
        Ricevuto il ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}
      </div>
    </div>
  `
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

async function sendViaResend(payload) {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, reason: 'no_resend_key' }

  const from = process.env.CONTACT_FROM || 'LyftAI <onboarding@resend.dev>'
  const html = buildEmailHtml(payload)
  const subject = `LyftAI — nuova richiesta da ${payload.name} (${payload.company})`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [CONTACT_TO],
        reply_to: payload.email,
        subject,
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, reason: `resend_${res.status}: ${text.slice(0, 200)}` }
    }
    const j = await res.json()
    return { ok: true, id: j?.id }
  } catch (e) {
    return { ok: false, reason: e?.message || 'resend_threw' }
  }
}

export async function POST(req) {
  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  // Sanitize tutti i campi
  const payload = {
    name:    sanitize(body.name, 200),
    company: sanitize(body.company, 200),
    email:   sanitize(body.email, 200),
    phone:   sanitize(body.phone, 60),
    website: sanitize(body.website, 300),
    revenue: sanitize(body.revenue, 40),
    message: sanitize(body.message, 4000),
    lang:    sanitize(body.lang, 5) || 'it',
  }

  // Validazione minima
  if (!payload.name || !payload.email || !payload.company) {
    return NextResponse.json({ error: 'Nome, azienda ed email sono obbligatori' }, { status: 400 })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) {
    return NextResponse.json({ error: 'Email non valida' }, { status: 400 })
  }

  // Honeypot anti-spam (campo nascosto nella form; se popolato → bot)
  if (typeof body.website_check === 'string' && body.website_check.length > 0) {
    // Pretend it worked (no error per non far capire al bot che e' un trap)
    return NextResponse.json({ ok: true })
  }

  // Log sempre (anche se Resend non e' configurato, abbiamo traccia su Vercel logs)
  console.log('[contact] nuova richiesta:', JSON.stringify(payload, null, 2))

  const result = await sendViaResend(payload)
  if (!result.ok) {
    console.log('[contact] invio fallito:', result.reason)
    // Per l'utente comunque ritorniamo ok: la richiesta e' loggata su Vercel
    // e Marino la vede da li' anche senza email. Setup Resend completera' il
    // flusso quando le env vars saranno settate.
    return NextResponse.json({
      ok: true,
      warning: 'Email service non configurato — richiesta loggata',
      reason: result.reason,
    })
  }

  return NextResponse.json({ ok: true, id: result.id })
}
