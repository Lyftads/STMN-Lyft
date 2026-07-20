#!/usr/bin/env node
// ── GTX step 1: esporta le conversazioni REALI del cervello in JSONL ────────
// Sorgente: agent_memories (le memorie-turno salvate da persistTurnMemory).
// Output: scripts/brain-eval/conversations.jsonl (una riga per turno).
// Uso:  SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/brain-eval/export-conversations.mjs [giorni]
// Poi: etichettare a mano un campione (colonna "label": good/bad + nota) →
// diventa il Ground Truth Set per tarare il judge (vedi judge.mjs).

import fs from 'node:fs'
import path from 'node:path'

const URL_ = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.error('Servono SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const days = parseInt(process.argv[2] || '30', 10)
const since = new Date(Date.now() - days * 86400e3).toISOString()

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const rows = await fetch(`${URL_}/rest/v1/agent_memories?select=agent_id,user_id,content,created_at&source=eq.auto&created_at=gte.${since}&order=created_at.desc&limit=1000`, { headers: H }).then(r => r.json())

const out = path.join(path.dirname(new URL(import.meta.url).pathname), 'conversations.jsonl')
const lines = (Array.isArray(rows) ? rows : [])
  .filter(r => typeof r.content === 'string' && r.content.length > 40)
  .map(r => JSON.stringify({ agent: r.agent_id, tenant: r.user_id, turn: r.content, at: r.created_at, label: null, note: null }))
fs.writeFileSync(out, lines.join('\n') + '\n')
console.log(`Esportati ${lines.length} turni (ultimi ${days}g) → ${out}`)
console.log('Etichettane un campione (label: "good"/"bad" + note), poi lancia judge.mjs.')
