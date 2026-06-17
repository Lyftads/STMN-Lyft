#!/usr/bin/env node
// Traduce le guide del Centro Assistenza (lib/help/content.js, italiano) in
// en/es/fr/de via OpenAI → genera lib/help/content.translations.js.
// Incrementale: salta (locale+id) già tradotti. Retry su errori di rete.
//   OPENAI_API_KEY=… node scripts/help-translate.mjs
//   LOCALES=en,es node scripts/help-translate.mjs   # solo alcune lingue

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const KEY = process.env.OPENAI_API_KEY
if (!KEY) { console.error('Manca OPENAI_API_KEY'); process.exit(1) }
const LOCALES = (process.env.LOCALES || 'en,es,fr,de').split(',').map(s => s.trim())
const LANG = { en: 'English', es: 'Spanish', fr: 'French', de: 'German' }
const OUT = path.join(ROOT, 'lib/help/content.translations.js')

const sleep = ms => new Promise(r => setTimeout(r, ms))
async function jfetch(url, opts, tries = 7) {
  let err
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, opts); if (r.status >= 500 && i < tries - 1) { await sleep(1500 * (i + 1)); continue } return r }
    catch (e) { err = e; await sleep(1500 * (i + 1)) }
  }
  throw err
}

async function translateArticle(a, lang) {
  const payload = { title: a.title, summary: a.summary, sections: a.sections }
  const sys = `You translate a SaaS product help guide from Italian to ${lang}. Return ONLY valid JSON with the SAME structure and keys as the input. Translate ONLY the string values of: title, summary, and each section's "h", "p", and each item of "list". Keep proper nouns and technical terms in their standard form (do NOT translate): LyftAI, Shopify, Meta, Google, Klaviyo, GA4, Search Console, Stripe, RFM, ROAS, CLV, CAC, AOV, LTV, CPC, CTR, CPM, CPO, KPI, Bulk Operations, Reels, Performance Max, Shopping, Search, P&L, COGS, SKU. Natural, fluent, professional ${lang}.`
  const r = await jfetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.2, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify(payload) }] }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error('OpenAI: ' + (j.error?.message || r.status))
  const t = JSON.parse(j.choices[0].message.content)
  return { id: a.id, tab: a.tab, icon: a.icon, group: a.group, category: a.category, title: t.title || a.title, summary: t.summary || a.summary, sections: t.sections || a.sections }
}

function writeOut(trans) {
  const body = LOCALES.map(loc => {
    const arts = Object.values(trans[loc] || {})
    return `  ${JSON.stringify(loc)}: [\n${arts.map(a => '    ' + JSON.stringify(a)).join(',\n')}\n  ],`
  }).join('\n')
  fs.writeFileSync(OUT, `// ── Traduzioni guide Centro Assistenza (generato da scripts/help-translate.mjs) ──\nexport const HELP_TRANSLATIONS = {\n${body}\n}\n`)
}

async function main() {
  const { HELP_ARTICLES } = await import(pathToFileURL(path.join(ROOT, 'lib/help/content.js')))
  let trans = {}
  try { trans = (await import(pathToFileURL(OUT) + `?t=${Date.now()}`)).HELP_TRANSLATIONS || {} } catch {}
  // normalizza in mappe id→articolo
  const map = {}
  for (const loc of LOCALES) { map[loc] = {}; for (const a of (trans[loc] || [])) map[loc][a.id] = a }

  for (const loc of LOCALES) {
    const lang = LANG[loc] || loc
    for (const a of HELP_ARTICLES) {
      if (map[loc][a.id]) continue
      try {
        map[loc][a.id] = await translateArticle(a, lang)
        writeOut(map) // incrementale
        console.log(`✓ ${loc}/${a.id}`)
      } catch (e) { console.error(`✗ ${loc}/${a.id}: ${e.message}`) }
    }
  }
  console.log('Fatto.')
}
main().catch(e => { console.error(e); process.exit(1) })
