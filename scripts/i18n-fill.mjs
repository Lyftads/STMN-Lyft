#!/usr/bin/env node
// Popola i 5 dizionari da un batch di chiavi nuove. Input: scripts/i18n-batch.json
// formato { "key": "Testo italiano", ... }. Genera en/es/fr/de via OpenAI e
// accoda a lib/i18n/dictionaries/{it,en,es,fr,de}.js (salta chiavi già presenti).
//   node --env-file=.env.local scripts/i18n-fill.mjs
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const KEY = process.env.OPENAI_API_KEY
if (!KEY) { console.error('Manca OPENAI_API_KEY'); process.exit(1) }
const DICT = (l) => path.join(ROOT, 'lib/i18n/dictionaries', l + '.js')
const LANGS = { en: 'English', es: 'Spanish', fr: 'French', de: 'German' }

const batch = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/i18n-batch.json'), 'utf8'))
const keys = Object.keys(batch)
if (!keys.length) { console.log('Batch vuoto'); process.exit(0) }

const sleep = ms => new Promise(r => setTimeout(r, ms))
async function jfetch(url, opts, tries = 6) {
  let err
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, opts); if (r.status >= 500 && i < tries - 1) { await sleep(1500 * (i + 1)); continue } return r }
    catch (e) { err = e; await sleep(1500 * (i + 1)) }
  }
  throw err
}

async function translateAll(lang) {
  const sys = `You translate short UI strings of a SaaS marketing-analytics app from Italian to ${lang}. Input is a JSON object {key: italianText}. Return ONLY a JSON object with the SAME keys and the translated values. Keep it concise and natural for a UI. Preserve: emoji, leading/trailing symbols (↗ ↩ ✅ — · + …), {placeholders}, and these terms unchanged: LyftAI, Shopify, Meta, Google, Klaviyo, GA4, Search Console, Stripe, ROAS, CAC, LTV, AOV, CPC, CTR, CPM, KPI, ROI, PDF, CSV, SKU, P&L, COGS, Reels, email.`
  const r = await jfetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.2, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify(batch) }] }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error('OpenAI: ' + (j.error?.message || r.status))
  return JSON.parse(j.choices[0].message.content)
}

function hasKey(file, key) {
  const txt = fs.readFileSync(file, 'utf8')
  return new RegExp(`['"]${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*:`).test(txt)
}

function appendKeys(file, mapObj) {
  let txt = fs.readFileSync(file, 'utf8')
  const lastBrace = txt.lastIndexOf('}')
  const block = Object.entries(mapObj)
    .filter(([k]) => !hasKey(file, k))
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join('\n')
  if (!block) return 0
  txt = txt.slice(0, lastBrace) + block + '\n' + txt.slice(lastBrace)
  fs.writeFileSync(file, txt)
  return block.split('\n').length
}

async function main() {
  // it = sorgente
  console.log(`Batch: ${keys.length} chiavi`)
  const n0 = appendKeys(DICT('it'), batch)
  console.log(`it: +${n0}`)
  for (const [loc, lang] of Object.entries(LANGS)) {
    const tr = await translateAll(lang)
    const n = appendKeys(DICT(loc), tr)
    console.log(`${loc}: +${n}`)
  }
  console.log('Fatto.')
}
main().catch(e => { console.error(e); process.exit(1) })
