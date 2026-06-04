// Logica di audit SEO on-page riusabile (single-page + multipagina).
// Nessuna dipendenza esterna: parsing via regex.

const UA = 'Mozilla/5.0 (compatible; LyftAI-SEO/1.0; +https://lyftai.io)'

export function normalizeUrl(raw) {
  let u = (raw || '').trim()
  if (!u) return null
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  try { return new URL(u).toString() } catch { return null }
}

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
function visibleText(html) {
  const body = (html.match(/<body[\s\S]*?<\/body>/i) || [html])[0]
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---- keyword analysis ----------------------------------------------------
const STOP = new Set(('a abbiamo ad agli ai al alla alle allo anche avere c che chi ci co col come con cui da dai dal dalla dalle dallo degli dei del della delle dello di do e ed gli ha hai hanno ho i il in io la le li lo loro ma me mi ne nei nel nella nelle nello no noi non o per più poco qual quando quanto quella quelle quelli quello questa queste questi questo se sei senza si sia siamo solo sono su sua sue sui sul sulla sulle suo te ti tra tu tua tue tuo un una uno vi voi tutti tutto già sempre dove ' +
  'the a an and are as at be by for from has have he in is it its of on or that to was were will with you your this these those we our us i my me they their them not no all can do if so up out about into over after your yours ' +
  'home shop cart prodotti prodotto carrello cerca menu accedi account euro spedizione gratuita').split(/\s+/))

function tokenize(text) {
  return text.toLowerCase().match(/[a-zàèéìòóùç0-9]{3,}/gi) || []
}
function ngrams(tokens, n) {
  const out = []
  for (let i = 0; i + n <= tokens.length; i++) {
    const slice = tokens.slice(i, i + n)
    if (slice.some(t => STOP.has(t))) continue
    out.push(slice.join(' '))
  }
  return out
}
function topFreq(arr, limit) {
  const m = new Map()
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1)
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }))
}

function analyzeKeywords(text, targetKeyword) {
  const tokens = tokenize(text)
  const total = tokens.length || 1
  const content = tokens.filter(t => !STOP.has(t))
  const unigrams = topFreq(content, 12).map(k => ({ ...k, density: +((k.count / total) * 100).toFixed(2) }))
  const bigrams = topFreq(ngrams(tokens, 2), 8).map(k => ({ ...k, density: +((k.count / total) * 100).toFixed(2) }))
  const trigrams = topFreq(ngrams(tokens, 3), 5).map(k => ({ ...k, density: +((k.count / total) * 100).toFixed(2) }))

  let target = null
  if (targetKeyword && targetKeyword.trim()) {
    const kw = targetKeyword.trim().toLowerCase()
    const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const count = (text.toLowerCase().match(re) || []).length
    target = { keyword: targetKeyword.trim(), count, density: +((count * kw.split(/\s+/).length / total) * 100).toFixed(2) }
  }
  return { totalWords: total, unigrams, bigrams, trigrams, target }
}

// ---- fetch + audit di una singola pagina ---------------------------------
export async function auditPage(rawUrl, { targetKeyword } = {}) {
  const target = normalizeUrl(rawUrl)
  if (!target) return { url: rawUrl, error: 'URL non valido.' }

  const origin = new URL(target).origin
  const t0 = Date.now()
  let html = '', status = 0, finalUrl = target
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    const res = await fetch(target, { headers: { 'User-Agent': UA, 'Accept-Language': 'it-IT,it;q=0.9' }, redirect: 'follow', signal: ctrl.signal })
    clearTimeout(timer)
    status = res.status
    finalUrl = res.url || target
    html = await res.text()
  } catch (e) {
    return { url: target, error: e.name === 'AbortError' ? 'Timeout (>15s).' : (e.message || 'Errore di rete') }
  }
  const loadMs = Date.now() - t0

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
  const host = new URL(finalUrl).hostname
  for (const href of links) {
    if (/^(#|mailto:|tel:|javascript:)/i.test(href)) continue
    try { (new URL(href, finalUrl).hostname === host) ? internal++ : external++ } catch {}
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

  const text = visibleText(html)
  const words = text ? text.split(' ').length : 0
  const keywords = analyzeKeywords(text, targetKeyword)

  // robots.txt + sitemap (best-effort)
  let robotsOk = false, robotsHasSitemap = false, sitemapOk = false
  try {
    const r = await fetch(origin + '/robots.txt', { headers: { 'User-Agent': UA } })
    if (r.ok) { robotsOk = true; robotsHasSitemap = /sitemap:/i.test(await r.text()) }
  } catch {}
  try { sitemapOk = (await fetch(origin + '/sitemap.xml', { method: 'HEAD', headers: { 'User-Agent': UA } })).ok } catch {}

  const C = (id, label, st, detail, group, value) => ({ id, label, status: st, detail, group, value })
  const checks = [
    C('title', 'Title tag', !title ? 'fail' : (title.length < 30 || title.length > 60 ? 'warn' : 'pass'),
      !title ? 'Manca il <title>.' : `${title.length} caratteri (ideale 30–60).`, 'Essenziali', title),
    C('desc', 'Meta description', !desc ? 'fail' : (desc.length < 70 || desc.length > 160 ? 'warn' : 'pass'),
      !desc ? 'Manca la meta description.' : `${desc.length} caratteri (ideale 70–160).`, 'Essenziali', desc),
    C('h1', 'H1 unico', h1s.length === 1 ? 'pass' : (h1s.length === 0 ? 'fail' : 'warn'), `${h1s.length} tag H1 (ideale 1).`, 'Essenziali', h1s[0] || ''),
    C('headings', 'Struttura heading', h2s.length > 0 ? 'pass' : 'warn', `${h2s.length} H2.`, 'Essenziali'),
    C('canonical', 'Canonical', canonical ? 'pass' : 'warn', canonical || 'Nessun canonical.', 'Essenziali', canonical),
    C('robots', 'Indicizzabile', /noindex/i.test(robots) ? 'fail' : 'pass', /noindex/i.test(robots) ? '⚠ noindex attivo!' : 'Nessun noindex.', 'Essenziali', robots),
    C('lang', 'Attributo lang', lang ? 'pass' : 'warn', lang ? `lang="${lang}"` : 'Manca lang.', 'Essenziali', lang),
    C('ogTitle', 'Open Graph title', ogTitle ? 'pass' : 'warn', ogTitle || 'Manca og:title.', 'Social/Sharing', ogTitle),
    C('ogDesc', 'Open Graph description', ogDesc ? 'pass' : 'warn', ogDesc || 'Manca og:description.', 'Social/Sharing'),
    C('ogImage', 'Open Graph image', ogImage ? 'pass' : 'warn', ogImage ? 'Presente' : 'Manca og:image.', 'Social/Sharing', ogImage),
    C('twitter', 'Twitter Card', twCard ? 'pass' : 'warn', twCard ? `card: ${twCard}` : 'Manca twitter:card.', 'Social/Sharing'),
    C('jsonld', 'Dati strutturati', jsonldTypes.length ? 'pass' : 'warn', jsonldTypes.length ? `Tipi: ${[...new Set(jsonldTypes)].join(', ')}` : 'Nessun JSON-LD.', 'Strutturati'),
    C('words', 'Quantità contenuto', words >= 300 ? 'pass' : 'warn', `~${words} parole${words < 300 ? ' (sottile)' : ''}.`, 'Contenuto', words),
    C('alt', 'Alt text immagini', altCoverage >= 90 ? 'pass' : (altCoverage >= 50 ? 'warn' : 'fail'), `${imgWithAlt}/${imgTags.length} con alt (${altCoverage}%).`, 'Contenuto', altCoverage),
    C('links', 'Link interni', internal >= 3 ? 'pass' : 'warn', `${internal} interni · ${external} esterni.`, 'Contenuto'),
    C('hreflang', 'Hreflang (multilingua)', hreflangs.length ? 'pass' : 'warn', hreflangs.length ? `${hreflangs.length} varianti` : 'Nessun hreflang.', 'Contenuto'),
    C('https', 'HTTPS', finalUrl.startsWith('https://') ? 'pass' : 'fail', finalUrl.startsWith('https://') ? 'Sicuro.' : 'Non HTTPS.', 'Tecnici'),
    C('viewport', 'Mobile viewport', viewport ? 'pass' : 'fail', viewport ? 'Configurato.' : 'Manca viewport.', 'Tecnici'),
    C('charset', 'Charset', charset ? 'pass' : 'warn', charset ? 'Dichiarato.' : 'Manca charset.', 'Tecnici'),
    C('status', 'Stato HTTP', status >= 200 && status < 300 ? 'pass' : (status >= 300 && status < 400 ? 'warn' : 'fail'), `HTTP ${status}`, 'Tecnici', status),
    C('speed', 'Tempo risposta', loadMs < 1500 ? 'pass' : (loadMs < 3500 ? 'warn' : 'fail'), `${(loadMs / 1000).toFixed(1)}s HTML.`, 'Tecnici', loadMs),
    C('robotsTxt', 'robots.txt', robotsOk ? 'pass' : 'warn', robotsOk ? 'Presente.' : 'Assente.', 'Tecnici'),
    C('sitemap', 'Sitemap XML', (sitemapOk || robotsHasSitemap) ? 'pass' : 'warn', (sitemapOk || robotsHasSitemap) ? 'Trovata.' : 'Assente.', 'Tecnici'),
  ]

  // target keyword → check dedicato
  if (keywords.target) {
    const k = keywords.target
    const inTitle = title.toLowerCase().includes(k.keyword.toLowerCase())
    const inH1 = (h1s[0] || '').toLowerCase().includes(k.keyword.toLowerCase())
    const inDesc = desc.toLowerCase().includes(k.keyword.toLowerCase())
    const inUrl = finalUrl.toLowerCase().includes(k.keyword.toLowerCase().replace(/\s+/g, '-'))
    const places = [inTitle && 'title', inH1 && 'H1', inDesc && 'description', inUrl && 'URL'].filter(Boolean)
    const good = inTitle && inH1 && k.density >= 0.5 && k.density <= 3.5
    checks.unshift(C('targetKw', `Keyword target: "${k.keyword}"`,
      good ? 'pass' : (places.length >= 2 ? 'warn' : 'fail'),
      `${k.count} occorrenze · densità ${k.density}% · in: ${places.join(', ') || 'da nessuna parte'}.`, 'Essenziali', k.density))
  }

  const pass = checks.filter(c => c.status === 'pass').length
  const warn = checks.filter(c => c.status === 'warn').length
  const fail = checks.filter(c => c.status === 'fail').length
  const score = Math.max(0, Math.round(((pass + warn * 0.5) / checks.length) * 100 - fail * 4))
  const scoreLabel = score >= 85 ? 'Eccellente' : score >= 70 ? 'Buono' : score >= 50 ? 'Da migliorare' : 'Critico'

  return {
    url: finalUrl, score, scoreLabel,
    summary: { pass, warn, fail, total: checks.length },
    checks, keywords,
    meta: { title, description: desc, words, loadMs, status },
  }
}

// ---- scoperta URL del sito (sitemap → fallback link interni) -------------
export async function discoverUrls(rawUrl, limit = 10) {
  const base = normalizeUrl(rawUrl)
  if (!base) return []
  const origin = new URL(base).origin
  const host = new URL(base).hostname
  const found = new Set([base])

  const parseSitemap = async (sm, depth = 0) => {
    if (depth > 1 || found.size >= limit * 3) return
    try {
      const r = await fetch(sm, { headers: { 'User-Agent': UA } })
      if (!r.ok) return
      const xml = await r.text()
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m => m[1].trim())
      const isIndex = /<sitemapindex/i.test(xml)
      if (isIndex) {
        for (const child of locs.slice(0, 5)) await parseSitemap(child, depth + 1)
      } else {
        for (const loc of locs) { try { if (new URL(loc).hostname === host) found.add(loc) } catch {} }
      }
    } catch {}
  }

  // 1) sitemap referenziata in robots.txt
  try {
    const r = await fetch(origin + '/robots.txt', { headers: { 'User-Agent': UA } })
    if (r.ok) {
      const txt = await r.text()
      for (const m of txt.matchAll(/sitemap:\s*(\S+)/gi)) await parseSitemap(m[1].trim())
    }
  } catch {}
  // 2) sitemap.xml standard
  if (found.size <= 1) await parseSitemap(origin + '/sitemap.xml')
  // 3) fallback: link interni dalla home
  if (found.size <= 1) {
    try {
      const r = await fetch(base, { headers: { 'User-Agent': UA } })
      const html = await r.text()
      for (const m of html.matchAll(/<a\b[^>]*?href=["']([^"']+)["']/gi)) {
        try { const u = new URL(m[1], base); if (u.hostname === host && !/\.(png|jpg|jpeg|gif|svg|pdf|css|js)$/i.test(u.pathname)) found.add(u.origin + u.pathname) } catch {}
        if (found.size >= limit) break
      }
    } catch {}
  }
  return [...found].slice(0, limit)
}
