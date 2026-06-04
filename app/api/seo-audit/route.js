export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const UA = 'Mozilla/5.0 (compatible; LyftAI-SEO/1.0; +https://lyftai.io)'

function normalizeUrl(raw) {
  let u = (raw || '').trim()
  if (!u) return null
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  try { return new URL(u).toString() } catch { return null }
}

// ---- estrattori regex (no parser pesanti) -------------------------------
function metaContent(html, key, attr = 'name') {
  const re1 = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*?content=["']([^"']*)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?${attr}=["']${key}["']`, 'i')
  return (html.match(re1) || html.match(re2) || [])[1] || null
}
function tagText(html, tag) {
  const out = []
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  let m
  while ((m = re.exec(html))) out.push(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
  return out
}
function visibleWordCount(html) {
  const body = (html.match(/<body[\s\S]*?<\/body>/i) || [html])[0]
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text ? text.split(' ').length : 0
}

export async function POST(request) {
  let body = {}
  try { body = await request.json() } catch {}
  const target = normalizeUrl(body.url)
  if (!target) return NextResponse.json({ error: 'URL non valido.' }, { status: 400 })

  const origin = new URL(target).origin
  const t0 = Date.now()
  let html = '', status = 0, finalUrl = target, fetchErr = null
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 20000)
    const res = await fetch(target, { headers: { 'User-Agent': UA, 'Accept-Language': 'it-IT,it;q=0.9' }, redirect: 'follow', signal: ctrl.signal })
    clearTimeout(timer)
    status = res.status
    finalUrl = res.url || target
    html = await res.text()
  } catch (e) {
    fetchErr = e.name === 'AbortError' ? 'Timeout caricamento pagina (>20s).' : (e.message || 'Errore di rete')
  }
  const loadMs = Date.now() - t0
  if (fetchErr) return NextResponse.json({ error: fetchErr }, { status: 200 })

  // ---- estrazione segnali --------------------------------------------------
  const title = tagText(html, 'title')[0] || ''
  const desc = metaContent(html, 'description') || ''
  const h1s = tagText(html, 'h1')
  const h2s = tagText(html, 'h2')
  const canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]*?href=["']([^"']+)["']/i) || [])[1] || null
  const robots = metaContent(html, 'robots') || ''
  const lang = (html.match(/<html[^>]+lang=["']([^"']+)["']/i) || [])[1] || null
  const viewport = metaContent(html, 'viewport')
  const charset = /<meta[^>]+charset=/i.test(html)
  const ogTitle = metaContent(html, 'og:title', 'property')
  const ogDesc = metaContent(html, 'og:description', 'property')
  const ogImage = metaContent(html, 'og:image', 'property')
  const twCard = metaContent(html, 'twitter:card')
  const hreflangs = [...html.matchAll(/<link[^>]+rel=["']alternate["'][^>]*?hreflang=["']([^"']+)["']/gi)].map(m => m[1])

  const imgTags = html.match(/<img\b[^>]*>/gi) || []
  const imgWithAlt = imgTags.filter(t => /\balt=["'][^"']*["']/i.test(t) && !/\balt=["']\s*["']/i.test(t)).length
  const altCoverage = imgTags.length ? Math.round((imgWithAlt / imgTags.length) * 100) : 100

  const links = [...html.matchAll(/<a\b[^>]*?href=["']([^"']+)["']/gi)].map(m => m[1])
  let internal = 0, external = 0
  for (const href of links) {
    if (/^(#|mailto:|tel:|javascript:)/i.test(href)) continue
    try {
      const h = new URL(href, finalUrl).hostname
      if (h === new URL(finalUrl).hostname) internal++; else external++
    } catch {}
  }

  const jsonldBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1])
  const jsonldTypes = []
  for (const b of jsonldBlocks) {
    try {
      const j = JSON.parse(b.trim())
      const arr = Array.isArray(j) ? j : (j['@graph'] || [j])
      for (const node of arr) if (node && node['@type']) jsonldTypes.push(Array.isArray(node['@type']) ? node['@type'].join('/') : node['@type'])
    } catch {}
  }
  const words = visibleWordCount(html)

  // robots.txt + sitemap
  let robotsTxt = { ok: false, hasSitemap: false }
  let sitemapOk = false
  try {
    const r = await fetch(origin + '/robots.txt', { headers: { 'User-Agent': UA } })
    if (r.ok) {
      const txt = await r.text()
      robotsTxt.ok = true
      robotsTxt.hasSitemap = /sitemap:/i.test(txt)
    }
  } catch {}
  try {
    const s = await fetch(origin + '/sitemap.xml', { method: 'HEAD', headers: { 'User-Agent': UA } })
    sitemapOk = s.ok
  } catch {}

  // ---- checks --------------------------------------------------------------
  const C = (id, label, status, detail, group, value) => ({ id, label, status, detail, group, value })
  const checks = [
    // Essenziali
    C('title', 'Title tag', !title ? 'fail' : (title.length < 30 || title.length > 60 ? 'warn' : 'pass'),
      !title ? 'Manca il <title>.' : `${title.length} caratteri (ideale 30–60).`, 'Essenziali', title),
    C('desc', 'Meta description', !desc ? 'fail' : (desc.length < 70 || desc.length > 160 ? 'warn' : 'pass'),
      !desc ? 'Manca la meta description.' : `${desc.length} caratteri (ideale 70–160).`, 'Essenziali', desc),
    C('h1', 'H1 unico', h1s.length === 1 ? 'pass' : (h1s.length === 0 ? 'fail' : 'warn'),
      `${h1s.length} tag H1 trovati (ideale 1).`, 'Essenziali', h1s[0] || ''),
    C('headings', 'Struttura heading', h2s.length > 0 ? 'pass' : 'warn',
      `${h2s.length} H2 trovati.`, 'Essenziali'),
    C('canonical', 'Canonical', canonical ? 'pass' : 'warn',
      canonical ? canonical : 'Nessun rel="canonical" (rischio contenuti duplicati).', 'Essenziali', canonical),
    C('robots', 'Indicizzabile', /noindex/i.test(robots) ? 'fail' : 'pass',
      /noindex/i.test(robots) ? '⚠ La pagina ha noindex: NON verrà indicizzata!' : 'Nessun noindex.', 'Essenziali', robots),
    C('lang', 'Attributo lang', lang ? 'pass' : 'warn', lang ? `lang="${lang}"` : 'Manca lang su <html>.', 'Essenziali', lang),
    // Social
    C('ogTitle', 'Open Graph title', ogTitle ? 'pass' : 'warn', ogTitle || 'Manca og:title.', 'Social/Sharing', ogTitle),
    C('ogDesc', 'Open Graph description', ogDesc ? 'pass' : 'warn', ogDesc || 'Manca og:description.', 'Social/Sharing'),
    C('ogImage', 'Open Graph image', ogImage ? 'pass' : 'warn', ogImage ? 'Presente' : 'Manca og:image (anteprima social povera).', 'Social/Sharing', ogImage),
    C('twitter', 'Twitter Card', twCard ? 'pass' : 'warn', twCard ? `card: ${twCard}` : 'Manca twitter:card.', 'Social/Sharing'),
    // Strutturati
    C('jsonld', 'Dati strutturati (JSON-LD)', jsonldTypes.length ? 'pass' : 'warn',
      jsonldTypes.length ? `Tipi: ${[...new Set(jsonldTypes)].join(', ')}` : 'Nessun JSON-LD (no rich results su Google).', 'Strutturati'),
    // Contenuto
    C('words', 'Quantità contenuto', words >= 300 ? 'pass' : 'warn', `~${words} parole${words < 300 ? ' (contenuto sottile)' : ''}.`, 'Contenuto', words),
    C('alt', 'Alt text immagini', altCoverage >= 90 ? 'pass' : (altCoverage >= 50 ? 'warn' : 'fail'),
      `${imgWithAlt}/${imgTags.length} immagini con alt (${altCoverage}%).`, 'Contenuto', altCoverage),
    C('links', 'Link interni', internal >= 3 ? 'pass' : 'warn', `${internal} interni · ${external} esterni.`, 'Contenuto'),
    C('hreflang', 'Hreflang (multilingua)', hreflangs.length ? 'pass' : 'warn',
      hreflangs.length ? `${hreflangs.length} varianti: ${[...new Set(hreflangs)].slice(0, 6).join(', ')}` : 'Nessun hreflang (consigliato per store multilingua).', 'Contenuto'),
    // Tecnici
    C('https', 'HTTPS', finalUrl.startsWith('https://') ? 'pass' : 'fail', finalUrl.startsWith('https://') ? 'Sicuro.' : 'Sito non in HTTPS.', 'Tecnici'),
    C('viewport', 'Mobile viewport', viewport ? 'pass' : 'fail', viewport ? 'Configurato.' : 'Manca meta viewport (non mobile-friendly).', 'Tecnici'),
    C('charset', 'Charset', charset ? 'pass' : 'warn', charset ? 'Dichiarato.' : 'Manca meta charset.', 'Tecnici'),
    C('status', 'Stato HTTP', status >= 200 && status < 300 ? 'pass' : (status >= 300 && status < 400 ? 'warn' : 'fail'),
      `HTTP ${status}`, 'Tecnici', status),
    C('speed', 'Tempo risposta', loadMs < 1500 ? 'pass' : (loadMs < 3500 ? 'warn' : 'fail'), `${(loadMs / 1000).toFixed(1)}s per scaricare l'HTML.`, 'Tecnici', loadMs),
    C('robotsTxt', 'robots.txt', robotsTxt.ok ? 'pass' : 'warn', robotsTxt.ok ? 'Presente.' : 'Nessun robots.txt.', 'Tecnici'),
    C('sitemap', 'Sitemap XML', (sitemapOk || robotsTxt.hasSitemap) ? 'pass' : 'warn',
      (sitemapOk || robotsTxt.hasSitemap) ? 'Trovata.' : 'Nessuna sitemap.xml (né referenziata in robots.txt).', 'Tecnici'),
  ]

  const pass = checks.filter(c => c.status === 'pass').length
  const warn = checks.filter(c => c.status === 'warn').length
  const fail = checks.filter(c => c.status === 'fail').length
  // score pesato: fail pesa doppio
  const score = Math.max(0, Math.round(((pass + warn * 0.5) / checks.length) * 100 - fail * 4))
  const scoreLabel = score >= 85 ? 'Eccellente' : score >= 70 ? 'Buono' : score >= 50 ? 'Da migliorare' : 'Critico'

  // ---- consigli AI (best-effort) ------------------------------------------
  let recommendations = []
  if (process.env.OPENAI_API_KEY) {
    try {
      const issues = checks.filter(c => c.status !== 'pass').map(c => `${c.label}: ${c.detail}`).join('\n')
      const r = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.4,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Sei un consulente SEO senior per e-commerce. Rispondi in italiano. Dato l\'elenco dei problemi SEO on-page di una pagina, restituisci JSON {"recommendations":[{"priority":"alta|media|bassa","title":"...","action":"azione concreta in 1 frase"}]}. Massimo 6, ordinate per impatto. Concrete e specifiche, niente fuffa.' },
            { role: 'user', content: `URL: ${finalUrl}\nTitle: "${title}"\n\nProblemi rilevati:\n${issues || 'nessuno'}` },
          ],
        }),
      })
      if (r.ok) {
        const j = await r.json()
        const parsed = JSON.parse(j.choices?.[0]?.message?.content || '{}')
        recommendations = parsed.recommendations || []
      }
    } catch {}
  }

  return NextResponse.json({
    url: finalUrl, score, scoreLabel,
    summary: { pass, warn, fail, total: checks.length },
    checks, recommendations,
    meta: { title, description: desc, words, loadMs, status },
    updatedAt: new Date().toISOString(),
  })
}
