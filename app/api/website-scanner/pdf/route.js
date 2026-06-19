export const dynamic = 'force-dynamic'
export const maxDuration = 45
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { reportT, localeTag } from '../../../../lib/reportI18n'
import { reportLogoBar } from '../../../../lib/reports/logo'

// PDF dell'analisi CRO dell'AI Website Scanner, nella lingua del cliente.
let _loc = 'it-IT'
let _tr = (k) => k
function setLocale(locale) { _loc = localeTag(locale); _tr = reportT(locale) }

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const scoreCol = s => s >= 85 ? '#1a8f3c' : s >= 70 ? '#1f6feb' : s >= 50 ? '#b8770a' : '#c8102e'
const PRIO = { critical: '#c8102e', high: '#c8102e', medium: '#b8770a', low: '#1f6feb' }
const IMP = { high: '#1a8f3c', medium: '#b8770a', low: '#999' }

function wrap(inner) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box} body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;margin:0;padding:36px 40px;font-size:13px;line-height:1.5}
    .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #eee;padding-bottom:16px;margin-bottom:20px}
    .brand{font-size:18px;font-weight:800} .url{color:#444;margin-top:4px;word-break:break-all} .date{color:#999;font-size:11px;margin-top:2px}
    .score{border:2px solid;border-radius:14px;padding:10px 18px;text-align:center;min-width:96px}
    .score .num{font-size:38px;font-weight:800;line-height:1} .score .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.5px}
    h2{font-size:15px;margin:22px 0 10px;border-bottom:1px solid #eee;padding-bottom:5px}
    .p{margin:6px 0;color:#333}
    .item{padding:8px 0;border-bottom:1px solid #f3f3f3}
    .item b{font-size:13px}
    .tag{font-size:9px;text-transform:uppercase;font-weight:800;padding:2px 7px;border-radius:5px;margin-left:8px;color:#fff}
    .sub{color:#555;font-size:12px;margin-top:3px} .sub b{color:#222}
    .ex{background:#f6f8fa;border-left:3px solid #d0d7de;border-radius:4px;padding:6px 10px;margin-top:5px;font-size:12px;color:#444}
    ul{margin:6px 0;padding-left:18px} li{margin:3px 0}
    .chip{display:inline-block;background:#eef4ff;border-radius:7px;padding:3px 9px;margin:3px 4px 3px 0;font-size:11px}
    .chipx{display:inline-block;background:#fdeeee;color:#9a2222;border-radius:7px;padding:3px 9px;margin:3px 4px 3px 0;font-size:11px}
    table{width:100%;border-collapse:collapse;margin-top:6px} td{padding:5px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top}
  </style></head><body>${reportLogoBar()}${inner}<div style="margin-top:30px;color:#bbb;font-size:10px;text-align:center">${_tr('Generato da LyftAI · AI Website Scanner')}</div></body></html>`
}

function buildHtml(r) {
  const a = r.analysis || {}
  const score = typeof a.overallScore === 'number' ? a.overallScore : 0
  const head = `
    <div class="hd">
      <div>
        <div class="brand">LyftAI · AI Website Scanner</div>
        <div class="url">${esc(r.url)}</div>
        <div class="date">${new Date(r.updatedAt || Date.now()).toLocaleString(_loc)}${r.viewport ? ` · ${r.viewport === 'mobile' ? 'Mobile' : 'Desktop'}` : ''}</div>
      </div>
      <div class="score" style="color:${scoreCol(score)};border-color:${scoreCol(score)}">
        <div class="num">${score}</div><div class="lbl">${esc(a.scoreLabel || 'CRO')}</div>
      </div>
    </div>`

  const summary = a.summary ? `<div class="p">${esc(a.summary)}</div>` : ''
  const first = a.firstImpression ? `<h2>${_tr('Prima impressione')}</h2><div class="p">${esc(a.firstImpression)}</div>` : ''

  const works = (a.works || []).length ? `<h2>${_tr('Cosa funziona')}</h2>${a.works.map(w => `
    <div class="item"><b>${esc(w.title)}</b>${w.impact ? `<span class="tag" style="background:${IMP[w.impact] || '#999'}">${esc(w.impact)}</span>` : ''}
    <div class="sub">${esc(w.details)}</div></div>`).join('')}` : ''

  const improve = (a.improve || []).length ? `<h2>${_tr('Da migliorare')}</h2>${a.improve.map(w => `
    <div class="item"><b>${esc(w.title)}</b>${w.priority ? `<span class="tag" style="background:${PRIO[w.priority] || '#999'}">${esc(w.priority)}</span>` : ''}
    ${w.current ? `<div class="sub"><b>${_tr('Ora')}:</b> ${esc(w.current)}</div>` : ''}
    ${w.suggestion ? `<div class="sub"><b>${_tr('Azione')}:</b> ${esc(w.suggestion)}</div>` : ''}
    ${w.example ? `<div class="ex">${esc(w.example)}</div>` : ''}
    ${w.expectedImpact ? `<div class="sub"><b>${_tr('Impatto atteso')}:</b> ${esc(w.expectedImpact)}</div>` : ''}</div>`).join('')}` : ''

  const remove = (a.remove || []).length ? `<h2>${_tr('Da rimuovere / ridurre')}</h2>${a.remove.map(w => `
    <div class="item"><b>${esc(w.title)}</b>
    ${w.reason ? `<div class="sub">${esc(w.reason)}</div>` : ''}
    ${w.alternative ? `<div class="sub"><b>${_tr('Alternativa')}:</b> ${esc(w.alternative)}</div>` : ''}</div>`).join('')}` : ''

  const quick = (a.quickWins || []).length ? `<h2>${_tr('Quick win')}</h2><ul>${a.quickWins.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : ''

  const cta = a.ctaAnalysis ? `<h2>${_tr('Analisi CTA')}</h2><table>
    ${a.ctaAnalysis.primaryCta ? `<tr><td>${_tr('CTA principale')}</td><td>${esc(a.ctaAnalysis.primaryCta)}</td></tr>` : ''}
    ${a.ctaAnalysis.position ? `<tr><td>${_tr('Posizione')}</td><td>${esc(a.ctaAnalysis.position)}</td></tr>` : ''}
    ${a.ctaAnalysis.contrast ? `<tr><td>${_tr('Contrasto')}</td><td>${esc(a.ctaAnalysis.contrast)}</td></tr>` : ''}
    ${a.ctaAnalysis.verdict ? `<tr><td>${_tr('Verdetto')}</td><td>${esc(a.ctaAnalysis.verdict)}</td></tr>` : ''}</table>` : ''

  const trust = a.trustSignals ? `<h2>${_tr('Trust signals')}</h2>
    ${(a.trustSignals.present || []).length ? `<div class="sub"><b>${_tr('Presenti')}:</b><br>${a.trustSignals.present.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : ''}
    ${(a.trustSignals.missing || []).length ? `<div class="sub" style="margin-top:6px"><b>${_tr('Mancanti')}:</b><br>${a.trustSignals.missing.map(x => `<span class="chipx">${esc(x)}</span>`).join('')}</div>` : ''}` : ''

  const copy = a.copyAnalysis ? `<h2>${_tr('Analisi copy')}</h2><table>
    ${a.copyAnalysis.headline ? `<tr><td>Headline</td><td>${esc(a.copyAnalysis.headline)}</td></tr>` : ''}
    ${a.copyAnalysis.valueProposition ? `<tr><td>${_tr('Value proposition')}</td><td>${esc(a.copyAnalysis.valueProposition)}</td></tr>` : ''}
    ${a.copyAnalysis.tone ? `<tr><td>${_tr('Tono')}</td><td>${esc(a.copyAnalysis.tone)}</td></tr>` : ''}</table>` : ''

  return wrap(`${head}${summary}${first}${quick}${improve}${works}${remove}${cta}${trust}${copy}`)
}

async function renderPdf(html) {
  const token = process.env.BROWSERLESS_TOKEN
  if (!token) return { error: 'BROWSERLESS_TOKEN mancante' }
  let browser
  try {
    const { default: puppeteer } = await import('puppeteer-core')
    const endpoint = process.env.BROWSERLESS_ENDPOINT || 'production-lon.browserless.io'
    browser = await puppeteer.connect({ browserWSEndpoint: `wss://${endpoint}/?token=${encodeURIComponent(token)}` })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 })
    await page.emulateMediaType('screen')
    const buf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '16px', bottom: '16px', left: '0', right: '0' } })
    return { buf }
  } catch (e) { return { error: e?.message || 'render error' } } finally { if (browser) await browser.disconnect().catch(() => {}) }
}

export async function POST(request) {
  let body = {}
  try { body = await request.json() } catch {}
  setLocale(body.locale)
  const data = body.data || body.result
  if (!data || !data.analysis) return NextResponse.json({ error: 'dati mancanti' }, { status: 400 })

  const html = buildHtml(data)
  const { buf, error } = await renderPdf(html)
  if (!buf) {
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-PDF-Error': (error || 'unknown').slice(0, 120) } })
  }
  const slug = (() => {
    try { return new URL(data.url).hostname.replace(/^www\./, '') } catch {}
    return 'scan'
  })()
  const fname = `CRO_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`
  return new NextResponse(buf, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fname}"` },
  })
}
