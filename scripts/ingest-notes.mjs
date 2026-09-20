#!/usr/bin/env node
// ============================================================================
//  Ingestion di note KNOWLEDGE gia' distillate a mano (JSON) in knowledge_base.
//
//  Serve quando la distillazione automatica di ingest-knowledge.mjs non e'
//  desiderabile: fonte gia' letta e sintetizzata, oppure trascrizione ottenuta
//  fuori dalla pipeline. Salta scaricamento, Whisper e distillazione: genera
//  solo gli embedding e inserisce.
//
//  Stesse convenzioni di ingest-knowledge.mjs: note ANONIME (nessun nome di
//  persone, canali, corsi) e idempotenza su source_ref (un rilancio sostituisce
//  le note precedenti della stessa fonte invece di duplicarle).
//
//  USO: node scripts/ingest-notes.mjs scripts/kb/<file>.json
// ============================================================================

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const OPENAI = process.env.OPENAI_API_KEY
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const ATTRIB = /\b(in questo video|il docente|il corso|youtuber|canale youtube|community)\b/i

async function embed(text) {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: String(text).slice(0, 8000) }),
  })
  if (!r.ok) throw new Error(`embed ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return (await r.json()).data?.[0]?.embedding || null
}

const file = process.argv[2]
if (!file) { console.error('Uso: node scripts/ingest-notes.mjs <file.json>'); process.exit(1) }
const { topic, source = 'youtube', source_ref: sourceRef, importance = 5, notes } = JSON.parse(fs.readFileSync(file, 'utf8'))
if (!Array.isArray(notes) || !notes.length) { console.error('Nessuna nota nel file.'); process.exit(1) }

const sospette = notes.filter(n => ATTRIB.test(n))
if (sospette.length) { console.error(`✗ ${sospette.length} note contengono attribuzioni alla fonte. Riscrivile anonime.`); process.exit(1) }

if (sourceRef) {
  const { error } = await sb.from('knowledge_base').delete().eq('source_ref', sourceRef)
  if (error) console.warn('pulizia precedenti:', error.message)
  else console.log(`· ripulite le note precedenti di ${sourceRef}`)
}

let n = 0
for (const raw of notes) {
  const content = String(raw).trim()
  if (content.length < 25) continue
  try {
    const embedding = await embed(content)
    const { error } = await sb.from('knowledge_base').insert({ content, topic, source, source_ref: sourceRef, importance, embedding })
    if (error) { console.warn('insert:', error.message); continue }
    n++; process.stdout.write(`\r· inserite ${n}/${notes.length}`)
  } catch (e) { console.warn('\nnota saltata:', e.message) }
}
console.log(`\n✓ ${n} note inserite (topic: ${topic}, fonte: ${sourceRef})`)
