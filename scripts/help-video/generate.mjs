#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  Pipeline automatica dei video-guida per tab (Centro Assistenza).
//
//  Per ogni tab:
//   1) NARRAZIONE  → genera uno script EN dalla guida (lib/help/content.js) via OpenAI
//   2) VOCE        → TTS frase per frase (OpenAI tts-1) → clip mp3 + durate
//   3) SOTTOTITOLI → costruisce un .vtt EN sincronizzato dalle durate delle frasi
//   4) REGISTRA    → Playwright apre la tab e fa uno "walkthrough" mentre registra (webm)
//   5) MONTA       → ffmpeg unisce video + voce, taglia alla durata audio, estrae poster
//   6) CARICA      → upload mp4/vtt/jpg su Supabase Storage + aggiorna lib/help/videos.js
//
//  NON gira su Vercel: eseguilo in locale o sul worker (serve ffmpeg + browser).
//  Vedi README.md in questa cartella per setup ed env.
//
//  Uso:
//    node scripts/help-video/generate.mjs            # tutte le tab del manifest articoli
//    node scripts/help-video/generate.mjs dashboard clienti   # solo alcune
//    DRY=1 node scripts/help-video/generate.mjs dashboard     # solo narrazione+voce+vtt (no record/upload)
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')

// ── Env ──────────────────────────────────────────────────────────────────────
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const BASE_URL = process.env.HELP_BASE_URL || 'http://localhost:3000'
const AUTH_STATE = process.env.HELP_AUTH_STORAGE || ''        // path a storageState Playwright (sessione loggata)
const USE_DEMO = process.env.HELP_USE_DEMO === '1'            // usa /demo (dati finti, no login)
const TTS_VOICE = process.env.HELP_TTS_VOICE || 'alloy'      // OpenAI: alloy|echo|fable|onyx|nova|shimmer
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY            // se presente con voice id → voce ElevenLabs
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || ''   // es. una voce EN del tuo account ElevenLabs
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2'
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = process.env.HELP_BUCKET || 'help-videos'
const DRY = process.env.DRY === '1'

if (!OPENAI_API_KEY) { console.error('Manca OPENAI_API_KEY'); process.exit(1) }

// Etichette nav (IT, come in VendroShell) per cliccare la tab giusta nel recorder.
const TAB_LABELS = {
  onboarding: 'Onboarding', dashboard: 'Dashboard', inventory: 'Inventario',
  productPerformance: 'Performance prodotti', productCosts: 'Costi prodotto', kpiBrain: 'KPI Brain',
  attribution: 'Attribuzione', ltvCohorts: 'LTV & Coorti', clienti: 'Clienti', klaviyo: 'Klaviyo',
  tasks: 'Progetti & Task', timeTracking: 'Lyftimer', chat: 'LyftTalk', team: 'Squadra AI',
  performanceAgent: 'Performance Agent', creativeStudio: 'Creative Studio', actionQueue: 'Coda Azioni',
  cro: 'CRO', webScanner: 'AI Website Scanner', seoAudit: 'SEO Audit', competitorIntel: 'Competitor Intel',
  priceComparison: 'Prezzi vs Competitor', creativeIntel: 'Creative Intel',
  creative: 'Creative', metaDetail: 'Meta Detail', metaKpi: 'Meta KPI', lighthouse: 'Lighthouse',
  creativeFatigue: 'Creative Fatigue', budgetAdvisor: 'Budget Advisor',
  googleDetail: 'Google Detail', googleProducts: 'Prodotti', googleKpi: 'Google KPI',
  googleLighthouse: 'Lighthouse', googleBudgetAdvisor: 'Budget Advisor',
  pnl: 'Conto Economico', scheduledReports: 'Scheduled', weekly: 'Weekly', simulator: 'Simulatore',
  integrations: 'Integrazioni', brandIdentity: 'Brand Identity', settings: 'Settings',
}

const WORK = path.join(os.tmpdir(), 'help-video')
fs.mkdirSync(WORK, { recursive: true })

// ── Util ─────────────────────────────────────────────────────────────────────
function sh(bin, args) { return execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString() }
function ffprobeDuration(file) {
  const out = sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file])
  return parseFloat(out.trim()) || 0
}
function fmtVttTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = (s % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`
}

// ── 1) Narrazione EN dalla guida ──────────────────────────────────────────────
async function makeScript(article) {
  const ctx = [
    `Tab: ${article.title}`, `Summary: ${article.summary}`,
    ...(article.sections || []).map(s => `${s.h}: ${s.p || (s.list || []).join(' ')}`),
  ].join('\n')
  const sys = 'You write concise, friendly English voiceover scripts for SaaS product walkthrough videos. Output ONLY a JSON array of 6-9 short narration sentences (max ~16 words each), no numbering, no markdown. The whole script should read in about 60-80 seconds. Sentence 1 is a one-line intro of what the tab is. The rest walk through what the user sees and can do, in a natural spoken tone.'
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.5, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sys + ' Wrap the array in {"lines": [...]}.' }, { role: 'user', content: ctx }] }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error('OpenAI script: ' + (j.error?.message || r.status))
  const parsed = JSON.parse(j.choices[0].message.content)
  const lines = Array.isArray(parsed) ? parsed : (parsed.lines || parsed.script || [])
  return lines.filter(Boolean).map(String)
}

// ── 2) TTS frase per frase + 3) VTT ────────────────────────────────────────────
async function ttsLine(text, outPath) {
  // ElevenLabs se key + voice id presenti (voce più naturale), altrimenti OpenAI tts-1.
  if (ELEVEN_KEY && ELEVEN_VOICE) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}`, {
      method: 'POST', headers: { 'xi-api-key': ELEVEN_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: ELEVEN_MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    })
    if (!r.ok) throw new Error('ElevenLabs TTS: ' + r.status + ' ' + (await r.text()).slice(0, 120))
    fs.writeFileSync(outPath, Buffer.from(await r.arrayBuffer()))
    return
  }
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', voice: TTS_VOICE, input: text, response_format: 'mp3' }),
  })
  if (!r.ok) throw new Error('OpenAI TTS: ' + r.status)
  fs.writeFileSync(outPath, Buffer.from(await r.arrayBuffer()))
}

async function buildAudioAndVtt(id, lines) {
  const dir = path.join(WORK, id); fs.mkdirSync(dir, { recursive: true })
  const clips = []; const durs = []
  for (let i = 0; i < lines.length; i++) {
    const clip = path.join(dir, `l${i}.mp3`)
    await ttsLine(lines[i], clip)
    clips.push(clip); durs.push(ffprobeDuration(clip))
  }
  // concat audio
  const listFile = path.join(dir, 'list.txt')
  fs.writeFileSync(listFile, clips.map(c => `file '${c}'`).join('\n'))
  const audio = path.join(dir, 'voice.mp3')
  sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', audio])
  // VTT dalle durate cumulate
  let t = 0; let vtt = 'WEBVTT\n\n'
  for (let i = 0; i < lines.length; i++) {
    const start = t, end = t + durs[i]; t = end
    vtt += `${fmtVttTime(start)} --> ${fmtVttTime(end)}\n${lines[i]}\n\n`
  }
  const vttPath = path.join(dir, 'subs.en.vtt'); fs.writeFileSync(vttPath, vtt)
  return { audio, vttPath, duration: t }
}

// ── 4) Registrazione walkthrough ───────────────────────────────────────────────
async function recordTab(article, durationSec) {
  const { chromium } = await import('playwright')
  const dir = path.join(WORK, article.id, 'rec'); fs.mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir, size: { width: 1280, height: 720 } },
    ...(AUTH_STATE && fs.existsSync(AUTH_STATE) ? { storageState: AUTH_STATE } : {}),
  })
  const page = await ctx.newPage()
  await page.goto(USE_DEMO ? `${BASE_URL}/demo` : BASE_URL, { waitUntil: 'networkidle' })
  // naviga alla tab cliccando la voce di nav
  const label = TAB_LABELS[article.tab]
  if (label) {
    try { await page.getByText(label, { exact: true }).first().click({ timeout: 8000 }); } catch {}
  }
  await page.waitForTimeout(2500)
  // walkthrough: scroll lento del contenuto per la durata della narrazione
  const ms = Math.max(8000, Math.round(durationSec * 1000))
  const steps = Math.max(8, Math.round(ms / 600))
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, 260)
    await page.waitForTimeout(Math.round(ms / steps))
  }
  await page.waitForTimeout(800)
  const video = page.video()
  await ctx.close(); await browser.close()
  const webm = await video.path()
  return webm
}

// ── 5) Montaggio ────────────────────────────────────────────────────────────────
function mux(id, webm, audio, durationSec) {
  const dir = path.join(WORK, id)
  const mp4 = path.join(dir, `${id}.mp4`)
  // video + audio, output tagliato alla durata della voce (-shortest), riencode pulito
  sh('ffmpeg', ['-y', '-i', webm, '-i', audio,
    '-map', '0:v:0', '-map', '1:a:0', '-t', String(durationSec.toFixed(2)),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', mp4])
  const poster = path.join(dir, `${id}.jpg`)
  sh('ffmpeg', ['-y', '-ss', '1', '-i', mp4, '-frames:v', '1', '-q:v', '3', poster])
  return { mp4, poster }
}

// ── 6) Upload + manifest ──────────────────────────────────────────────────────
async function upload(id, files, vttPath, durationSec) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Mancano SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY per l\'upload')
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
  try { await sb.storage.createBucket(BUCKET, { public: true }) } catch {}
  const put = async (local, name, type) => {
    const buf = fs.readFileSync(local)
    const { error } = await sb.storage.from(BUCKET).upload(name, buf, { contentType: type, upsert: true })
    if (error) throw error
    return sb.storage.from(BUCKET).getPublicUrl(name).data.publicUrl
  }
  const src = await put(files.mp4, `${id}.mp4`, 'video/mp4')
  const captions = await put(vttPath, `${id}.en.vtt`, 'text/vtt')
  const poster = await put(files.poster, `${id}.jpg`, 'image/jpeg')
  const m = Math.floor(durationSec / 60), s = Math.round(durationSec % 60)
  return { src, captions, poster, duration: `${m}:${String(s).padStart(2, '0')}` }
}

function writeManifest(entries) {
  const file = path.join(ROOT, 'lib/help/videos.js')
  const body = Object.entries(entries).map(([id, v]) =>
    `  ${JSON.stringify(id)}: ${JSON.stringify(v)},`).join('\n')
  const content = `// ── Manifest dei video-guida per tab (rigenerato da scripts/help-video) ──
export const HELP_VIDEOS = {
${body}
}

export function getHelpVideo(id) {
  return HELP_VIDEOS[id] || null
}
`
  fs.writeFileSync(file, content)
  console.log('✓ manifest aggiornato:', file)
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const { HELP_ARTICLES } = await import(pathToFileURL(path.join(ROOT, 'lib/help/content.js')))
  let manifest = {}
  try { manifest = (await import(pathToFileURL(path.join(ROOT, 'lib/help/videos.js')) + `?t=${Date.now()}`)).HELP_VIDEOS || {} } catch {}

  const only = process.argv.slice(2)
  const targets = HELP_ARTICLES.filter(a => only.length ? only.includes(a.id) : true)
  console.log(`Genero ${targets.length} video…`)

  for (const a of targets) {
    try {
      console.log(`\n▶ ${a.id}`)
      const lines = await makeScript(a); console.log('  script:', lines.length, 'frasi')
      const { audio, vttPath, duration } = await buildAudioAndVtt(a.id, lines); console.log('  voce:', duration.toFixed(1), 's')
      if (DRY) { console.log('  DRY → stop (audio+vtt in', path.join(WORK, a.id), ')'); continue }
      const webm = await recordTab(a, duration); console.log('  registrato')
      const files = mux(a.id, webm, audio, duration); console.log('  montato')
      const entry = await upload(a.id, files, vttPath, duration); console.log('  caricato:', entry.src)
      manifest[a.id] = entry
      writeManifest(manifest) // salva incrementale: se si interrompe, i fatti restano
    } catch (e) {
      console.error(`  ✗ ${a.id}:`, e.message)
    }
  }
  console.log('\nFatto.')
  // Su Railway il file è effimero: stampo il manifest da copiare nei log e
  // incollare in lib/help/videos.js del repo (gli asset sono già su Supabase).
  console.log('\n────────── COPIA IN lib/help/videos.js ──────────')
  console.log('export const HELP_VIDEOS = ' + JSON.stringify(manifest, null, 2))
  console.log('export function getHelpVideo(id){return HELP_VIDEOS[id]||null}')
  console.log('──────────────────────────────────────────────────')
}

main().catch(e => { console.error(e); process.exit(1) })
