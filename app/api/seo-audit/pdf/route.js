export const dynamic = 'force-dynamic'
export const maxDuration = 45
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

const COL = { pass: '#1a8f3c', warn: '#b8770a', fail: '#c8102e' }
const ICON = { pass: '✓', warn: '!', fail: '×' }
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const scoreCol = s => s >= 85 ? '#1a8f3c' : s >= 70 ? '#1f6feb' : s >= 50 ? '#b8770a' : '#c8102e'

function buildHtml(r) {
  const isSite = r.mode === 'site'
  const score = isSite ? r.avgScore : r.score
  const head = `
    <div class="hd">
      <div>
        <div class="brand">LyftAI · SEO Audit</div>
        <div class="url">${esc(r.url)}</div>
        <div class="date">${new Date(r.updatedAt || Date.now()).toLocaleString('it-IT')}${isSite ? ` · ${r.pagesAnalyzed} pagine` : ''}</div>
      </div>
      <div class="score" style="color:${scoreCol(score)};border-color:${scoreCol(score)}">
        <div class="num">${score}</div><div class="lbl">${esc(r.scoreLabel || '')}</div>
      </div>
    </div>`

  const recs = (r.recommendations || []).length ? `
    <h2>Azioni consigliate</h2>
    ${r.recommendations.map(x => `<div class="rec"><span class="prio prio-${esc(x.priority)}">${esc(x.priority)}</span><b>${esc(x.title)}</b> — ${esc(x.action)}</div>`).join('')}` : ''

  if (isSite) {
    const issues = (r.commonIssues || []).map(i => `<tr><td>${esc(i.label)}</td><td style="text-align:right">${i.affected}/${r.pagesAnalyzed} pagine</td></tr>`).join('')
    const pages = (r.pages || []).map(p => `<tr><td style="color:${scoreCol(p.score)};font-weight:700">${p.score}</td><td>${esc(p.url)}</td><td class="sm">${esc((p.issues || []).slice(0, 4).join(' · '))}</td></tr>`).join('')
    return wrap(`${head}${recs}
      <h2>Problemi ricorrenti</h2><table>${issues}</table>
      <h2>Pagine analizzate (peggiori in alto)</h2><table><tr class="th"><td>Score</td><td>URL</td><td>Problemi</td></tr>${pages}</table>`)
  }

  const groups = ['Essenziali', 'Social/Sharing', 'Strutturati', 'Contenuto', 'Tecnici']
  const checks = groups.map(g => {
    const items = (r.checks || []).filter(c => c.group === g)
    if (!items.length) return ''
    return `<h3>${g}</h3>${items.map(c => `<div class="ck"><span class="ic" style="background:${COL[c.status]}22;color:${COL[c.status]}">${ICON[c.status]}</span><b>${esc(c.label)}</b> <span class="dt">${esc(c.detail)}</span></div>`).join('')}`
  }).join('')

  const kw = r.keywords
  const chips = (list) => (list || []).map(k => `<span class="chip">${esc(k.term)} <i>${k.count}× · ${k.density}%</i></span>`).join('')
  const kwBlock = kw ? `<h2>Analisi keyword</h2>
    ${kw.target ? `<div class="tgt">Target <b>"${esc(kw.target.keyword)}"</b>: ${kw.target.count} occorrenze · densità ${kw.target.density}%</div>` : ''}
    <div class="lbl2">Parole più frequenti</div><div>${chips(kw.unigrams)}</div>
    <div class="lbl2">Frasi (2 parole)</div><div>${chips(kw.bigrams)}</div>` : ''

  return wrap(`${head}
    <div class="sum"><span style="color:${COL.pass}">${r.summary.pass} ok</span> · <span style="color:${COL.warn}">${r.summary.warn} da migliorare</span> · <span style="color:${COL.fail}">${r.summary.fail} critici</span></div>
    ${recs}${kwBlock}<h2>Dettaglio controlli</h2>${checks}`)
}

function wrap(inner) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box} body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;margin:0;padding:36px 40px;font-size:13px;line-height:1.5}
    .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #eee;padding-bottom:16px;margin-bottom:20px}
    .brand{font-size:18px;font-weight:800} .url{color:#444;margin-top:4px;word-break:break-all} .date{color:#999;font-size:11px;margin-top:2px}
    .score{border:2px solid;border-radius:14px;padding:10px 18px;text-align:center;min-width:90px}
    .score .num{font-size:38px;font-weight:800;line-height:1} .score .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.5px}
    .sum{margin:6px 0 14px;font-weight:600}
    h2{font-size:15px;margin:22px 0 10px;border-bottom:1px solid #eee;padding-bottom:5px} h3{font-size:12px;color:#666;margin:14px 0 6px;text-transform:uppercase;letter-spacing:.4px}
    .ck{padding:4px 0;display:flex;align-items:flex-start;gap:8px} .ic{width:16px;height:16px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0}
    .dt{color:#777} .rec{padding:6px 0} .prio{font-size:9px;text-transform:uppercase;font-weight:700;padding:2px 7px;border-radius:5px;margin-right:8px;color:#fff}
    .prio-alta{background:#c8102e} .prio-media{background:#b8770a} .prio-bassa{background:#1f6feb}
    table{width:100%;border-collapse:collapse;margin-top:6px} td{padding:5px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top;word-break:break-word} .th td{font-weight:700;color:#666;font-size:11px} .sm{color:#999;font-size:11px}
    .chip{display:inline-block;background:#f3f4f6;border-radius:7px;padding:3px 9px;margin:3px 4px 3px 0;font-size:11px} .chip i{color:#999;font-style:normal}
    .lbl2{color:#888;font-size:11px;margin:12px 0 4px} .tgt{background:#eef4ff;border-radius:8px;padding:8px 12px;margin-bottom:8px}
  </style></head><body>${inner}<div style="margin-top:30px;color:#bbb;font-size:10px;text-align:center">Generato da LyftAI · SEO Audit</div></body></html>`
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
  const result = body.result
  if (!result || !result.url) return NextResponse.json({ error: 'result mancante' }, { status: 400 })

  const html = buildHtml(result)
  const { buf, error } = await renderPdf(html)
  if (!buf) {
    // fallback: ritorna l'HTML (apribile/stampabile dal browser) con header che segnala l'errore
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-PDF-Error': (error || 'unknown').slice(0, 120) } })
  }
  const host = (() => { try { return new URL(result.url).hostname.replace(/^www\./, '') } catch { return 'site' } })()
  const fname = `SEO_${host}_${new Date().toISOString().slice(0, 10)}.pdf`
  return new NextResponse(buf, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fname}"` },
  })
}
