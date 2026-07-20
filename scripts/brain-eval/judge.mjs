#!/usr/bin/env node
// ── GTX step 2: LLM-as-judge sulle conversazioni esportate ──────────────────
// Valuta ogni turno del cervello su una rubrica (lezione Sidekick: "your evals
// are your new spec"). Se il JSONL ha righe etichettate a mano (label good/bad)
// stampa anche l'accordo judge↔umano — quando è alto, il judge può girare da
// solo sulle conversazioni nuove per monitorare la qualità nel tempo.
// Uso: OPENAI_API_KEY=… node scripts/brain-eval/judge.mjs [max]

import fs from 'node:fs'
import path from 'node:path'

const KEY = process.env.OPENAI_API_KEY
if (!KEY) { console.error('Manca OPENAI_API_KEY'); process.exit(1) }
const dir = path.dirname(new URL(import.meta.url).pathname)
const src = path.join(dir, 'conversations.jsonl')
if (!fs.existsSync(src)) { console.error('Manca conversations.jsonl: lancia prima export-conversations.mjs'); process.exit(1) }
const max = parseInt(process.argv[2] || '50', 10)

const RUBRIC = `Valuta questo turno di conversazione di un assistente AI per e-commerce (l'assistente ha strumenti live sui dati reali del brand). Rispondi SOLO JSON: {"grounded": 0-2, "actionable": 0-2, "honest": 0-2, "tone": 0-2, "verdict": "good"|"bad", "why": "<max 20 parole>"}.
- grounded: cita numeri/nomi plausibilmente presi dai dati (2) o inventa/generalizza (0)
- actionable: dice cosa fare, come e quando (2) o resta vago (0)
- honest: ammette i dati mancanti invece di inventare (2) o finge di sapere (0)
- tone: da consulente umano, diretto (2) o robotico/prolisso (0)
verdict "bad" se grounded=0 o honest=0, altrimenti "good" se somma>=5.`

const lines = fs.readFileSync(src, 'utf8').split('\n').filter(Boolean).slice(0, max).map(l => JSON.parse(l))
const results = []
let agree = 0, labeled = 0

for (const [i, row] of lines.entries()) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, messages: [
      { role: 'system', content: RUBRIC },
      { role: 'user', content: String(row.turn).slice(0, 4000) },
    ] }),
  }).then(x => x.json()).catch(() => null)
  let j = null; try { j = JSON.parse(r?.choices?.[0]?.message?.content || '') } catch {}
  if (!j) continue
  results.push({ ...row, judge: j })
  if (row.label) { labeled++; if (row.label === j.verdict) agree++ }
  process.stdout.write(`\r${i + 1}/${lines.length} giudicati…`)
}

const out = path.join(dir, 'judged.jsonl')
fs.writeFileSync(out, results.map(r => JSON.stringify(r)).join('\n') + '\n')
const bad = results.filter(r => r.judge.verdict === 'bad')
console.log(`\n\n${results.length} turni → ${bad.length} "bad" (${Math.round(bad.length / Math.max(results.length, 1) * 100)}%) → ${out}`)
if (labeled) console.log(`Accordo judge↔umano sulle ${labeled} righe etichettate: ${Math.round(agree / labeled * 100)}%`)
for (const b of bad.slice(0, 8)) console.log(`  ✗ [${b.agent}] ${b.judge.why}`)
