#!/usr/bin/env node
// ============================================================================
//  Ingestion KNOWLEDGE globale per gli agent LyftAI.
//
//  Estrae il contenuto di video YouTube e delle lezioni del corso Circle,
//  lo DISTILLA in note di metodo/framework ANONIME (nessun nome di persone,
//  canali, corsi), genera gli embedding e le salva in `knowledge_base`.
//  Da lì il recall semantico (buildAgentContext) le inietta in TUTTI gli agent.
//
//  ⚠️ USO TRASFORMATIVO: si memorizzano concetti/metodi, NON trascrizioni
//  verbatim. Assicurati di avere il diritto d'uso dei contenuti.
//
//  PREREQUISITI (già installati): ffmpeg, yt-dlp, playwright (chromium).
//  ENV richieste (in .env.local o .env):
//    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
//    CIRCLE_EMAIL, CIRCLE_PASSWORD, CIRCLE_FIRST_LESSON_URL
//
//  USO:
//    node scripts/ingest-knowledge.mjs course --test          # 1 lezione di prova
//    node scripts/ingest-knowledge.mjs course --start 1 --limit 10
//    node scripts/ingest-knowledge.mjs course                 # tutte (127)
//    node scripts/ingest-knowledge.mjs youtube <url> <url> ...
//    node scripts/ingest-knowledge.mjs youtube --file urls.txt
// ============================================================================

import dotenv from 'dotenv'
import fs from 'node:fs'
// Carica .env.local (Next) e .env, senza sovrascrivere variabili già presenti.
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'

const exec = promisify(execFile)
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lyft-kb-'))
const log = (...a) => console.log('·', ...a)
const warn = (...a) => console.warn('⚠', ...a)

// ── env ────────────────────────────────────────────────────────────────────
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
if (!SB_URL || !SB_KEY) { console.error('Mancano NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
if (!OPENAI) { console.error('Manca OPENAI_API_KEY'); process.exit(1) }
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } })

// ── OpenAI: embedding, whisper, distill ──────────────────────────────────────
async function embed(text) {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: String(text).slice(0, 8000) }),
  })
  if (!r.ok) throw new Error(`embed ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return (await r.json()).data?.[0]?.embedding || null
}

async function whisper(audioPath) {
  const fd = new FormData()
  fd.append('file', new Blob([fs.readFileSync(audioPath)]), path.basename(audioPath))
  fd.append('model', 'whisper-1')
  fd.append('response_format', 'text')
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI}` }, body: fd,
  })
  if (!r.ok) throw new Error(`whisper ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return (await r.text()).trim()
}

const DISTILL_SYSTEM = `Sei un senior advertising/marketing strategist. Ti do la trascrizione (o gli appunti) di una lezione.
Estrai TUTTA la conoscenza operativa in note atomiche, riutilizzabili come METODO da un AI advisor: framework, regole, criteri di decisione, checklist, soglie/benchmark, numeri, step procedurali, esempi operativi, errori comuni e come evitarli.
ESAUSTIVITÀ (requisito #1): NON riassumere e NON tralasciare NULLA di utile. Se la lezione spiega 10 cose, voglio 10+ note. Cattura ogni concetto distinto, ogni numero/soglia citato, ogni passaggio. Meglio troppe note che perderne una. Quante ne servono (tipicamente 12-40 per lezione densa).
ALTRE REGOLE FERREE:
- ANONIMIZZA TUTTO: NON includere MAI nomi di persone, brand del docente, canali YouTube, nomi di corsi/community, o riferimenti tipo "in questo video", "il docente dice". Scrivi i principi come verità di metodo.
- NIENTE trascrizione verbatim: riformula in concetti/azioni. Ogni nota atomica e autosufficiente (comprensibile da sola, fuori contesto).
- Densa e concreta: numeri, soglie, step. Niente fuffa, niente preamboli, niente meta-commenti.
- Italiano.
Rispondi SOLO con JSON: {"topic":"<slug-macro-argomento, es. meta-scaling | creative-testing | budget-allocation | targeting | funnel | copywriting>","notes":["nota 1","nota 2", ...]}.`

async function distillChunk(rawText) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL, temperature: 0.2, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: DISTILL_SYSTEM },
        { role: 'user', content: rawText },
      ],
    }),
  })
  if (!r.ok) throw new Error(`distill ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = JSON.parse((await r.json()).choices?.[0]?.message?.content || '{}')
  return { topic: j.topic || null, notes: Array.isArray(j.notes) ? j.notes.filter(Boolean) : [] }
}

// Distillazione ESAUSTIVA: per non perdere nulla sui video lunghi, spezzo la
// trascrizione in finestre (~14k char, con overlap) e distillo ognuna, unendo
// le note. Dedup leggero per evitare ripetizioni tra finestre adiacenti.
async function distill(rawText) {
  const text = String(rawText)
  const WIN = 14000, OVER = 1000
  const chunks = []
  if (text.length <= WIN) chunks.push(text)
  else for (let i = 0; i < text.length; i += (WIN - OVER)) chunks.push(text.slice(i, i + WIN))
  let topic = null
  const all = []
  for (const c of chunks) {
    const { topic: t, notes } = await distillChunk(c)
    if (!topic && t) topic = t
    all.push(...notes)
  }
  // dedup: scarta note quasi identiche (stesso inizio normalizzato)
  const seen = new Set(); const notes = []
  for (const no of all) {
    const k = String(no).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)
    if (seen.has(k)) continue; seen.add(k); notes.push(no)
  }
  return { topic, notes }
}

// Filtro di sicurezza: scarta note che (per errore del modello) contengono
// pattern di attribuzione tipici. Best-effort.
const ATTRIB = /\b(in questo video|il docente|il corso|youtuber|canale youtube|community)\b/i
function clean(note) { return ATTRIB.test(note) ? note.replace(ATTRIB, '').trim() : note }

async function saveNotes(notes, { topic, source, sourceRef, importance = 5 }) {
  // Idempotenza: se rilancio la stessa lezione/video, rimpiazzo le sue note
  // (cancello le precedenti con lo stesso source_ref) invece di duplicarle.
  if (sourceRef) { try { await sb.from('knowledge_base').delete().eq('source_ref', sourceRef) } catch {} }
  let n = 0
  for (const raw of notes) {
    const content = clean(String(raw).trim())
    if (content.length < 25) continue
    try {
      const embedding = await embed(content)
      const { error } = await sb.from('knowledge_base').insert({ content, topic, source, source_ref: sourceRef, importance, embedding })
      if (error) { warn('insert:', error.message); continue }
      n++
    } catch (e) { warn('save note:', e.message) }
  }
  return n
}

// ── audio helpers ────────────────────────────────────────────────────────────
// Estrae audio mono 16kHz mp3 da un input (m3u8/url/file). Ritorna lista di
// chunk (split a 18 min per stare sotto i 25MB di Whisper).
async function toAudioChunks(input, tag) {
  const full = path.join(TMP, `${tag}.mp3`)
  await exec('ffmpeg', ['-y', '-i', input, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k', full], { maxBuffer: 1 << 26 })
  const stat = fs.statSync(full)
  if (stat.size <= 24 * 1024 * 1024) return [full]
  // split in segmenti da 18 minuti
  const pat = path.join(TMP, `${tag}-%03d.mp3`)
  await exec('ffmpeg', ['-y', '-i', full, '-f', 'segment', '-segment_time', '1080', '-c', 'copy', pat], { maxBuffer: 1 << 26 })
  return fs.readdirSync(TMP).filter(f => f.startsWith(`${tag}-`) && f.endsWith('.mp3')).sort().map(f => path.join(TMP, f))
}

async function transcribeInput(input, tag) {
  const chunks = await toAudioChunks(input, tag)
  let out = ''
  for (const c of chunks) { out += '\n' + await whisper(c) }
  return out.trim()
}

// ── YouTube ──────────────────────────────────────────────────────────────────
async function ytSubtitles(url, tag) {
  // prova sottotitoli (manuali o auto) in IT/EN via yt-dlp
  const base = path.join(TMP, tag)
  try {
    await exec('yt-dlp', ['--skip-download', '--write-auto-subs', '--write-subs',
      '--sub-langs', 'it,en,it-IT,en-US', '--sub-format', 'vtt', '-o', base, url], { maxBuffer: 1 << 26 })
  } catch {}
  const vtt = fs.readdirSync(TMP).find(f => f.startsWith(path.basename(tag)) && f.endsWith('.vtt'))
  if (!vtt) return null
  const raw = fs.readFileSync(path.join(TMP, vtt), 'utf8')
  // pulisci VTT → testo
  const text = raw.split('\n').filter(l => l && !l.includes('-->') && !/^\d+$/.test(l) && l !== 'WEBVTT')
    .join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return text.length > 100 ? text : null
}

async function ytAudio(url, tag) {
  const out = path.join(TMP, `${tag}.m4a`)
  await exec('yt-dlp', ['-f', 'bestaudio', '-x', '--audio-format', 'm4a', '-o', out, url], { maxBuffer: 1 << 26 })
  return out
}

async function ingestYouTube(urls) {
  let total = 0
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]; const tag = `yt${i}`
    log(`[YT ${i + 1}/${urls.length}] ${url}`)
    try {
      let text = await ytSubtitles(url, tag)
      if (text) log('  sottotitoli ok'); else { log('  niente sub → audio+Whisper'); text = await transcribeInput(await ytAudio(url, tag), tag) }
      if (!text || text.length < 80) { warn('  testo insufficiente, skip'); continue }
      const { topic, notes } = await distill(text)
      const n = await saveNotes(notes, { topic, source: 'youtube', sourceRef: `yt:${i}` })
      log(`  ✓ ${n} note (topic: ${topic})`); total += n
    } catch (e) { warn('  errore:', e.message) }
  }
  log(`Totale note YouTube: ${total}`)
}

// ── Circle (corso) ───────────────────────────────────────────────────────────
async function ingestCourse({ test, start, limit }) {
  const { chromium } = await import('playwright')
  const EMAIL = process.env.CIRCLE_EMAIL, PASS = process.env.CIRCLE_PASSWORD
  const FIRST = process.env.CIRCLE_FIRST_LESSON_URL
  if (!EMAIL || !PASS || !FIRST) { console.error('Mancano CIRCLE_EMAIL / CIRCLE_PASSWORD / CIRCLE_FIRST_LESSON_URL'); process.exit(1) }

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  const origin = new URL(FIRST).origin

  // goto resiliente: ritenta sui buchi di rete (DNS/timeout) invece di morire.
  async function gotoRetry(u, tries = 6) {
    for (let i = 1; i <= tries; i++) {
      try { await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 35000 }); return true }
      catch (e) {
        warn(`  rete (${i}/${tries}): ${e.message.split('\n')[0].slice(0, 80)} — ritento tra 8s`)
        await page.waitForTimeout(8000)
      }
    }
    return false
  }

  // login Circle (2 step). Riusabile per il re-login su scadenza sessione.
  async function doLogin() {
    await gotoRetry(`${origin}/users/sign_in`)
    await page.waitForTimeout(1500)
    try { await page.getByText(/Accedi con e-?mail/i).click({ timeout: 8000 }) } catch {}
    await page.waitForSelector('#user_email', { timeout: 15000 })
    await page.fill('#user_email', EMAIL)
    await page.fill('#user_password', PASS)
    await Promise.all([
      page.waitForLoadState('networkidle').catch(() => {}),
      page.getByRole('button', { name: /^Accedi$/i }).click().catch(() => page.click('button[type="submit"]')),
    ])
    await page.waitForTimeout(2000)
    return !/sign_in/.test(page.url())
  }

  log('Login Circle…')
  if (await doLogin()) log('Login ok.'); else warn('Login forse fallito — controlla email/password.')

  let url = FIRST
  let idx = 0, saved = 0
  const startAt = start || 1
  const maxN = test ? 1 : (limit || 9999)
  let processed = 0

  while (url && processed < maxN) {
    idx++
    // cattura m3u8 dalla rete
    let m3u8 = null
    const onReq = (req) => { const u = req.url(); if (!m3u8 && /\.m3u8(\?|$)/i.test(u)) m3u8 = u }
    page.on('request', onReq)

    const ok = await gotoRetry(url)
    if (!ok) { warn(`  lezione non caricata dopo i retry, salto: ${url}`); page.off('request', onReq); break }
    // resilienza: se la sessione è scaduta (redirect a sign_in), re-login e ritorno alla lezione
    if (/sign_in/.test(page.url())) {
      warn('  sessione scaduta → re-login')
      await doLogin()
      await gotoRetry(url)
    }
    // numero lezione + titolo + descrizione
    const meta = await page.evaluate(() => {
      const t = document.body.innerText
      const m = t.match(/(?:Lesson|Lezione)\s+(\d+)\s+(?:of|di)\s+(\d+)/i)
      const h = document.querySelector('h1, h2')?.innerText?.trim() || ''
      return { n: m ? +m[1] : null, total: m ? +m[2] : null, title: h, bodyText: t.slice(0, 4000) }
    }).catch(() => ({ n: null, total: null, title: '', bodyText: '' }))

    if (meta.n && meta.n < startAt) {
      log(`[lez ${meta.n}] < start ${startAt}, salto`)
    } else {
      processed++
      log(`[lez ${meta.n || idx}/${meta.total || '?'}] ${meta.title}`)
      // avvia il player per forzare il caricamento del manifest
      try { await page.click('video, .vjs-big-play-button, button[aria-label*="play" i]', { timeout: 3000 }) } catch {}
      await page.waitForTimeout(3500)

      let text = ''
      // descrizione testuale della lezione (sempre, è breve)
      const desc = await page.evaluate(() => {
        const v = document.querySelector('video')
        const after = v ? v.closest('div')?.parentElement?.innerText : ''
        return (after || '').slice(0, 2000)
      }).catch(() => '')
      if (desc) text += desc + '\n\n'

      if (m3u8) {
        log('  m3u8 trovato → audio+Whisper')
        try { text += await transcribeInput(m3u8, `c${idx}`) } catch (e) { warn('  transcribe:', e.message) }
      } else {
        warn('  nessun m3u8 catturato (DRM o player diverso). Uso solo la descrizione.')
      }

      if (text.trim().length >= 80) {
        try {
          const { topic, notes } = await distill(text)
          const n = await saveNotes(notes, { topic, source: 'course', sourceRef: `lez:${meta.n || idx}` })
          log(`  ✓ ${n} note (topic: ${topic})`); saved += n
        } catch (e) { warn('  distill:', e.message) }
      } else { warn('  testo insufficiente, skip') }
    }

    page.off('request', onReq)

    // vai alla prossima lezione (freccia →) — leggo l'href se è un link, altrimenti click
    const nextUrl = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a')].find(x => /lessons\/\d+/.test(x.getAttribute('href') || '') && (x.getAttribute('aria-label')?.match(/next|successiv/i)))
      return a ? a.href : null
    }).catch(() => null)
    if (nextUrl && nextUrl !== url) { url = nextUrl; continue }
    // fallback: click sul pulsante next
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('a,button')]
      const nx = btns.find(b => (b.getAttribute('aria-label')||'').match(/next|successiv/i) || b.textContent.trim() === '→')
      if (nx) { nx.click(); return true } return false
    }).catch(() => false)
    if (!clicked) { log('Fine lezioni.'); break }
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    await page.waitForTimeout(800)
    const newUrl = page.url()
    if (newUrl === url) { log('Nessun avanzamento, stop.'); break }
    url = newUrl
  }

  await browser.close()
  log(`Totale note corso: ${saved}`)
}

// ── main ─────────────────────────────────────────────────────────────────────
const [, , cmd, ...rest] = process.argv
function flag(name) { return rest.includes(`--${name}`) }
function opt(name, def) { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : def }

;(async () => {
  try {
    if (cmd === 'youtube') {
      let urls = rest.filter(a => /^https?:\/\//.test(a))
      const file = opt('file')
      if (file) urls = urls.concat(fs.readFileSync(file, 'utf8').split('\n').map(s => s.trim()).filter(s => /^https?:\/\//.test(s)))
      if (!urls.length) { console.error('Nessun URL. Passa gli URL o --file urls.txt'); process.exit(1) }
      await ingestYouTube(urls)
    } else if (cmd === 'course') {
      await ingestCourse({ test: flag('test'), start: Number(opt('start')) || null, limit: Number(opt('limit')) || null })
    } else {
      console.log('Uso: node scripts/ingest-knowledge.mjs <course|youtube> [opzioni]')
    }
  } catch (e) {
    console.error('FATAL:', e.message)
    process.exit(1)
  } finally {
    try { fs.rmSync(TMP, { recursive: true, force: true }) } catch {}
  }
})()
