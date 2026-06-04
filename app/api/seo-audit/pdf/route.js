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

function genHead(title, sub) {
  return `<div class="hd"><div><div class="brand">LyftAI · SEO</div><div class="url">${esc(title)}</div><div class="date">${esc(sub || '')}${sub ? ' · ' : ''}${new Date().toLocaleString('it-IT')}</div></div></div>`
}
const chip = (t) => `<span class="chip">${esc(t)}</span>`

function kwHtml(d) {
  return wrap(`${genHead('Keyword: ' + (d.keyword || ''), 'Analisi keyword AI')}
    <table>
      <tr><td>Intent</td><td>${esc(d.intent)} — ${esc(d.intentNote || '')}</td></tr>
      <tr><td>Difficoltà</td><td>${esc(d.difficulty?.level)} — ${esc(d.difficulty?.note || '')}</td></tr>
      <tr><td>AI Overview</td><td>${d.aiOverview?.likely ? 'Probabile' : 'Improbabile'} — ${esc(d.aiOverview?.note || '')}</td></tr>
      ${d.volumeHint ? `<tr><td>Volume</td><td>${esc(d.volumeHint)}</td></tr>` : ''}
    </table>
    ${d.summary ? `<p>${esc(d.summary)}</p>` : ''}
    <h2>Keyword correlate</h2><div>${(d.related || []).map(r => chip(r.term)).join('')}</div>
    <h2>Domande (PAA)</h2>${(d.questions || []).map(q => `<div>• ${esc(q)}</div>`).join('')}
    <h2>Idee di contenuto</h2>${(d.contentIdeas || []).map(c => `<div><b>${esc(c.title)}</b> — ${esc(c.angle || '')}</div>`).join('')}`)
}
function editorHtml(d) {
  return wrap(`${genHead('Brief: ' + (d.keyword || ''), 'Editor contenuti')}
    <table><tr><td>Intent</td><td>${esc(d.searchIntent)}</td></tr><tr><td>Lunghezza</td><td>${d.recommendedWords || '—'} parole</td></tr></table>
    ${d.title ? `<h2>Title & Meta</h2><div><b>Title:</b> ${esc(d.title)}</div><div><b>Meta:</b> ${esc(d.metaDescription || '')}</div>` : ''}
    <h2>Struttura heading</h2>${(d.headings || []).map(h => `<div style="padding-left:${h.tag === 'H3' ? 18 : 0}px"><small>${esc(h.tag)}</small> ${esc(h.text)}</div>`).join('')}
    <h2>Entità da coprire</h2><div>${(d.entities || []).map(chip).join('')}</div>
    ${(d.faq || []).length ? `<h2>FAQ</h2>${d.faq.map(f => `<div style="padding:4px 0"><b>${esc(f.q)}</b><br>${esc(f.a)}</div>`).join('')}` : ''}
    ${d.schema ? `<h2>Schema</h2><div>${esc(d.schema)}</div>` : ''}
    ${(d.gaps || []).length ? `<h2>Gap / opportunità</h2>${d.gaps.map(g => `<div>• ${esc(g)}</div>`).join('')}` : ''}`)
}
function compHtml(d) {
  const rows = d.rows || []
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }
  const cols = rows.map(r => `<td><b>${esc(host(r.url))}${r.error ? ' (err)' : ''}</b></td>`).join('')
  const m = [
    ['Score', r => r.score], ['Title (lung.)', r => r.titleLen], ['Meta (lung.)', r => r.descLen], ['Parole', r => r.words],
    ['JSON-LD', r => r.jsonld ? '✓' : '×'], ['Hreflang', r => r.hreflang ? '✓' : '×'], ['OG image', r => r.og ? '✓' : '×'],
    ['Alt %', r => r.altCoverage == null ? '—' : r.altCoverage + '%'], ['Velocità', r => r.speedMs == null ? '—' : (r.speedMs / 1000).toFixed(1) + 's'], ['HTTPS', r => r.https ? '✓' : '×'],
  ]
  const tb = m.map(([l, fn]) => `<tr><td>${l}</td>${rows.map(r => `<td>${r.error ? '—' : esc(String(fn(r)))}</td>`).join('')}</tr>`).join('')
  return wrap(`${genHead('Confronto competitor on-page', '')}<table><tr class="th"><td></td>${cols}</tr>${tb}</table>`)
}
function aeoHtml(d) {
  return wrap(`${genHead('AI Visibility — ' + (d.brand || ''), 'Answer Engine Optimization')}
    <div class="score" style="color:${scoreCol(d.visibilityScore)};border-color:${scoreCol(d.visibilityScore)};display:inline-block"><div class="num">${d.visibilityScore}</div><div class="lbl">Visibility</div></div>
    ${d.summary ? `<p style="margin-top:12px">${esc(d.summary)}</p>` : ''}
    <h2>Risultati per prompt</h2>
    ${(d.results || []).map(r => `<div class="rec"><b style="color:${r.mentioned ? '#1a8f3c' : '#c8102e'}">${r.mentioned ? '✓ Citato' : '× Non citato'}</b> — ${esc(r.prompt)}<br><small>${esc(r.why || '')}</small>${r.howToImprove ? `<br><small>→ ${esc(r.howToImprove)}</small>` : ''}</div>`).join('')}`)
}
function gscHtml(d) {
  const q = (d.queries || []).slice(0, 40).map(x => `<tr><td>${esc(x.key)}</td><td>${x.clicks}</td><td>${x.impressions}</td><td>${(x.ctr * 100).toFixed(1)}%</td><td>${x.position.toFixed(1)}</td></tr>`).join('')
  const opp = (d.opportunities?.nearFirstPage || []).map(x => `<tr><td>${esc(x.key)}</td><td>${x.position.toFixed(1)}</td><td>${x.impressions}</td></tr>`).join('')
  const t = d.totals || {}
  return wrap(`${genHead('Search Console — ' + (d.site || ''), `Periodo ${d.range?.startDate || ''} → ${d.range?.endDate || ''}`)}
    <table><tr><td>Click</td><td>${t.clicks ?? '—'}</td></tr><tr><td>Impression</td><td>${t.impressions ?? '—'}</td></tr><tr><td>CTR medio</td><td>${((t.ctr || 0) * 100).toFixed(1)}%</td></tr><tr><td>Posizione media</td><td>${(t.position || 0).toFixed(1)}</td></tr></table>
    ${opp ? `<h2>Opportunità — quasi prima pagina (pos 11–20)</h2><table><tr class="th"><td>Query</td><td>Pos</td><td>Impr</td></tr>${opp}</table>` : ''}
    <h2>Top query</h2><table><tr class="th"><td>Query</td><td>Click</td><td>Impr</td><td>CTR</td><td>Pos</td></tr>${q}</table>`)
}

function buildHtmlByType(type, data) {
  switch (type) {
    case 'keyword': return kwHtml(data)
    case 'editor': return editorHtml(data)
    case 'competitor': return compHtml(data)
    case 'aeo': return aeoHtml(data)
    case 'gsc': return gscHtml(data)
    default: return buildHtml(data)
  }
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
  const type = body.type || null
  const data = body.data || body.result
  if (!data) return NextResponse.json({ error: 'dati mancanti' }, { status: 400 })

  const html = buildHtmlByType(type, data)
  const { buf, error } = await renderPdf(html)
  if (!buf) {
    // fallback: ritorna l'HTML (apribile/stampabile dal browser) con header che segnala l'errore
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-PDF-Error': (error || 'unknown').slice(0, 120) } })
  }
  const slug = (() => {
    try { return new URL(data.url).hostname.replace(/^www\./, '') } catch {}
    return (data.keyword || data.brand || data.site || 'seo').toString().replace(/[^a-z0-9]+/gi, '-').slice(0, 40)
  })()
  const fname = `SEO_${type || 'audit'}_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`
  return new NextResponse(buf, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fname}"` },
  })
}
