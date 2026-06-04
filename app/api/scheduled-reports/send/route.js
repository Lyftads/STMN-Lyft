export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext } from '../../../../lib/tenant/credentials'

// ============================================================================
//  /api/scheduled-reports/send
//   POST { type: 'weekly' | 'monthly', email: '...' }
//   Genera digest HTML + invia via Resend.
// ============================================================================

export async function POST(req) {
  return withTenantContext(req, async () => {
    let body
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Body invalido' }, { status: 400 }) }

    const type = body?.type === 'monthly' ? 'monthly' : 'weekly'
    const email = String(body?.email || process.env.REPORT_RECIPIENT || '').trim()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email destinatario mancante o invalida' }, { status: 400 })
    }

    try {
      const data = await buildDigest({ type, req })
      const html = renderDigestHtml({ type, data })
      const subject = type === 'weekly'
        ? `LyftAI — Weekly Digest (${data.range.since} → ${data.range.until})`
        : `LyftAI — Monthly Digest (${data.range.since} → ${data.range.until})`

      const result = await sendViaResend({ to: email, subject, html })
      if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 500 })

      return NextResponse.json({
        ok: true,
        sent_to: email,
        message_id: result.id,
        type,
        range: data.range,
      })
    } catch (err) {
      return NextResponse.json({ error: err?.message || 'Errore' }, { status: 500 })
    }
  })
}

async function buildDigest({ type, req }) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const cookieHeader = req.headers.get('cookie') || ''
  const preset = type === 'weekly' ? 'last_7d' : 'last_30d'

  const headers = cookieHeader ? { cookie: cookieHeader } : {}

  const [metricsRes, metaKpiRes] = await Promise.allSettled([
    fetch(`${origin}/api/metrics?preset=${preset}`, { cache: 'no-store', headers }).then(r => r.json()),
    fetch(`${origin}/api/meta-kpi?preset=${preset}`, { cache: 'no-store', headers }).then(r => r.json()),
  ])

  const metrics = metricsRes.status === 'fulfilled' ? metricsRes.value : {}
  const metaKpi = metaKpiRes.status === 'fulfilled' ? metaKpiRes.value : {}

  return {
    range: metrics?.shopifyRange?.range || metaKpi?.range || { since: '—', until: '—' },
    shopify: metrics?.shopifyRange || {},
    shopify_prev: metrics?.shopifyPrevRange || {},
    meta: metaKpi?.totals || {},
    meta_prev: metaKpi?.prevTotals || {},
    top_products: Array.isArray(metrics?.shopifyTopProducts) ? metrics.shopifyTopProducts.slice(0, 5) : [],
  }
}

function renderDigestHtml({ type, data }) {
  const eur = v => v != null ? `&euro;${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '&mdash;'
  const num = v => v != null ? Number(v).toLocaleString('it-IT') : '&mdash;'
  const mul = v => v != null && v > 0 ? `${Number(v).toFixed(2)}x` : '&mdash;'
  const pct = v => v != null && Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : '&mdash;'
  const deltaPct = (cur, prev) => prev > 0 ? ((cur - prev) / prev) * 100 : null

  const s = data.shopify, sp = data.shopify_prev
  const m = data.meta, mp = data.meta_prev
  const mer = (m?.spend > 0 && s?.revenue > 0) ? s.revenue / m.spend : 0
  const merPrev = (mp?.spend > 0 && sp?.revenue > 0) ? sp.revenue / mp.spend : 0

  const title = type === 'weekly' ? 'Weekly Digest' : 'Monthly Digest'
  const period = type === 'weekly' ? 'settimana' : 'mese'

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0a0a14;padding:32px 16px;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" border="0" width="600" style="background:linear-gradient(180deg,#14122a 0%,#0a0a14 100%);border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
      <tr><td style="padding:32px;">
        <div style="font-size:11px;color:#2997ff;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;margin-bottom:8px;">LyftAI · ${title}</div>
        <div style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-0.02em;margin-bottom:6px;">Performance ${period} ${data.range.since} → ${data.range.until}</div>
        <div style="font-size:13px;color:#9b90aa;margin-bottom:24px;">Confronto vs periodo precedente equivalente.</div>

        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
          ${headlineCell('Revenue', eur(s?.revenue), deltaPct(s?.revenue, sp?.revenue))}
          ${headlineCell('Ordini', num(s?.orders), deltaPct(s?.orders, sp?.orders))}
          ${headlineCell('Nuovi clienti', num(s?.nc), deltaPct(s?.nc, sp?.nc))}
          ${headlineCell('Meta Spend', eur(m?.spend), deltaPct(m?.spend, mp?.spend))}
          ${headlineCell('ROAS Meta', mul(m?.roas), deltaPct(m?.roas, mp?.roas))}
          ${headlineCell('MER blended', mul(mer), deltaPct(mer, merPrev))}
        </table>

        ${data.top_products.length > 0 ? `
          <div style="font-size:11px;color:#9b90aa;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;margin:24px 0 12px;">Top 5 prodotti</div>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(255,255,255,0.03);border-radius:12px;padding:8px;">
            ${data.top_products.map((p, i) => `
              <tr><td style="padding:10px 14px;border-bottom:${i === data.top_products.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)'};">
                <div style="font-size:13px;color:#fff;font-weight:700;">${escapeHtml(p.label || p.name || '—')}</div>
                <div style="font-size:11px;color:#9b90aa;margin-top:2px;">${eur(p.value || p.revenue)} · ${num(p.orders)} ordini</div>
              </td></tr>
            `).join('')}
          </table>
        ` : ''}

        <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#6b6580;text-align:center;line-height:1.6;">
          Email generata automaticamente da LyftAI<br/>
          Dati live al momento dell'invio · ${new Date().toLocaleString('it-IT')}
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

function headlineCell(label, value, delta) {
  const color = delta == null ? '#9b90aa' : (delta > 0 ? '#22c55e' : '#f87171')
  const arrow = delta == null ? '' : (delta > 0 ? '▲' : '▼')
  const deltaStr = delta != null && Math.abs(delta) > 0.1
    ? `<span style="color:${color};font-size:11px;font-weight:700;margin-left:6px;">${arrow} ${Math.abs(delta).toFixed(1)}%</span>`
    : ''
  return `<tr><td style="padding:12px 14px;background:rgba(255,255,255,0.04);border-radius:10px;display:block;margin-bottom:8px;">
    <div style="font-size:10px;color:#9b90aa;font-weight:800;letter-spacing:0.10em;text-transform:uppercase;margin-bottom:6px;">${label}</div>
    <div style="font-size:18px;color:#fff;font-weight:900;letter-spacing:-0.01em;">${value}${deltaStr}</div>
  </td></tr>`
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function sendViaResend({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, reason: 'RESEND_API_KEY mancante' }
  const from = process.env.REPORT_FROM || process.env.CONTACT_FROM || 'LyftAI <onboarding@resend.dev>'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(15_000),
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
