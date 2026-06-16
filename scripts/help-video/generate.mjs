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
const LOGIN_EMAIL = process.env.HELP_LOGIN_EMAIL || ''       // login reale (dati veri) se non usi /demo
const LOGIN_PASSWORD = process.env.HELP_LOGIN_PASSWORD || ''
const TTS_MODEL = process.env.HELP_TTS_MODEL || 'tts-1-hd'   // hd = più naturale di tts-1
const TTS_VOICE = process.env.HELP_TTS_VOICE || 'nova'       // OpenAI: nova/shimmer più calde; alloy/echo/fable/onyx
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY            // se presente con voice id → voce ElevenLabs (più umana)
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || ''   // una voce EN del tuo account ElevenLabs
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
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
// fetch con retry: gestisce 'fetch failed'/5xx transitori (rete container instabile)
async function jfetch(url, opts, tries = 4) {
  let err
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, opts)
      if (r.status >= 500 && i < tries - 1) { await sleep(1500 * (i + 1)); continue }
      return r
    } catch (e) { err = e; await sleep(1500 * (i + 1)) }
  }
  throw err
}
function sh(bin, args) { return execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString() }
function ffprobeDuration(file) {
  const out = sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file])
  return parseFloat(out.trim()) || 0
}
function fmtVttTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = (s % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`
}

// ── 1) Narrazione EN ancorata agli elementi a schermo ──────────────────────────
// Riceve la lista dei testi davvero presenti nella pagina (anchors) e scrive una
// narrazione in cui OGNI frase è legata a un anchor: così il video scrolla su
// quell'elemento mentre la voce ne parla.
async function makeScriptSynced(article, anchors) {
  const guide = [
    `Tab: ${article.title}`, `Summary: ${article.summary}`,
    ...(article.sections || []).map(s => `${s.h}: ${s.p || (s.list || []).join(' ')}`),
  ].join('\n')
  const anchorList = anchors.length ? anchors.map(a => `- ${a}`).join('\n') : '(none)'
  const sys = [
    'You write friendly, clear English voiceover scripts for a SaaS product walkthrough video, SYNCED to on-screen elements.',
    'You are given the guide content AND a list of EXACT text labels currently visible on the page (the "anchors").',
    'LENGTH: the spoken script must last AT LEAST 40-45 seconds (≥ ~115 words). Going longer is perfectly fine — never make it shorter than ~40 seconds. Use 8-12 sentences (more if the tab has many useful anchors to cover).',
    'Be genuinely descriptive: for each anchored element say WHAT it shows AND WHY it is useful or how to read it — not just its name. Give it room to breathe, do not rush.',
    'TONE: warm, conversational, human — like a friendly colleague giving a quick tour, NOT a formal manual. Use contractions (you\'ll, it\'s, here\'s, that\'s), light connective phrases (so, and, basically, just), and natural rhythm. Avoid stiff/robotic phrasing.',
    'For EACH sentence pick the single on-page anchor it talks about, so the video scrolls there while you speak.',
    'Rules: sentence 1 is a one-sentence intro of what the tab is for, with anchor "". If there are many anchors, cover only the most important ones to stay within the time budget (do NOT list every single one). "a" MUST be copied EXACTLY from the anchors list, or "" for the intro. Order sentences to follow the anchors top-to-bottom. No numbering, no markdown.',
    'Output ONLY JSON: {"lines":[{"t":"sentence","a":"exact anchor or empty"}]}',
  ].join(' ')
  const r = await jfetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.4, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sys }, { role: 'user', content: `GUIDE:\n${guide}\n\nANCHORS (exact on-page texts):\n${anchorList}` }] }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error('OpenAI script: ' + (j.error?.message || r.status))
  const parsed = JSON.parse(j.choices[0].message.content)
  const lines = (parsed.lines || []).filter(x => x && x.t)
  return lines.map(x => ({ t: String(x.t), a: anchors.includes(x.a) ? x.a : '' }))
}

// ── 2) TTS frase per frase + 3) VTT ────────────────────────────────────────────
async function ttsLine(text, outPath) {
  // ElevenLabs se key + voice id presenti (voce più naturale), altrimenti OpenAI tts-1.
  if (ELEVEN_KEY && ELEVEN_VOICE) {
    const r = await jfetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}`, {
      method: 'POST', headers: { 'xi-api-key': ELEVEN_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      // stability bassa + style → consegna più espressiva e umana, meno piatta
      body: JSON.stringify({ text, model_id: ELEVEN_MODEL, voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true } }),
    })
    if (!r.ok) throw new Error('ElevenLabs TTS: ' + r.status + ' ' + (await r.text()).slice(0, 120))
    fs.writeFileSync(outPath, Buffer.from(await r.arrayBuffer()))
    return
  }
  const r = await jfetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: TTS_MODEL, voice: TTS_VOICE, input: text, response_format: 'mp3' }),
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
  return { audio, vttPath, duration: t, durs }
}

// Selettore dei "punti di riferimento" della pagina (titoli, etichette card,
// header tabella) usati sia per gli anchor sia per lo scroll mirato.
const ANCHOR_SEL = 'h1,h2,h3,h4,th,[class*="label"],[class*="Label"]'

// Login reale (una volta per contesto browser) se ci sono le credenziali.
async function loginIfNeeded(page) {
  if (USE_DEMO || !LOGIN_EMAIL || !LOGIN_PASSWORD) return
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    const email = page.locator('input[type="email"], input[name="email"]').first()
    if (await email.count()) {
      await email.fill(LOGIN_EMAIL)
      await page.locator('input[type="password"]').first().fill(LOGIN_PASSWORD)
      const btn = page.getByRole('button', { name: /accedi|login|sign in|entra/i }).first()
      if (await btn.count()) await btn.click(); else await page.keyboard.press('Enter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)
    }
  } catch {}
}

async function gotoTab(page, article) {
  if (USE_DEMO) {
    await page.goto(`${BASE_URL}/demo`, { waitUntil: 'networkidle' })
  } else {
    await loginIfNeeded(page)
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  }
  const label = TAB_LABELS[article.tab]
  if (label) { try { await page.getByText(label, { exact: true }).first().click({ timeout: 8000 }) } catch {} }
  await page.waitForTimeout(3000)
}

// Pre-pass (senza registrazione): estrae i testi visibili da usare come anchor.
async function getAnchors(article) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...(AUTH_STATE && fs.existsSync(AUTH_STATE) ? { storageState: AUTH_STATE } : {}) })
  const page = await ctx.newPage()
  let anchors = []
  try {
    await gotoTab(page, article)
    anchors = await page.evaluate((sel) => {
      const seen = new Set(); const out = []
      for (const el of document.querySelectorAll(sel)) {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
        if (t.length < 2 || t.length > 42 || seen.has(t)) continue
        const r = el.getBoundingClientRect()
        if (r.width < 8 || r.height < 8) continue
        seen.add(t); out.push(t)
        if (out.length >= 40) break
      }
      return out
    }, ANCHOR_SEL)
  } catch {}
  await ctx.close(); await browser.close()
  return anchors
}

// ── 4) Registrazione coreografata: scrolla su ogni anchor mentre parla la voce ──
async function recordChoreographed(article, plan, durs) {
  const { chromium } = await import('playwright')
  const dir = path.join(WORK, article.id, 'rec'); fs.mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir, size: { width: 1280, height: 720 } },
    ...(AUTH_STATE && fs.existsSync(AUTH_STATE) ? { storageState: AUTH_STATE } : {}),
  })
  const page = await ctx.newPage()
  const t0 = Date.now()
  await gotoTab(page, article)
  await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = 0; else window.scrollTo(0, 0) })
  await page.waitForTimeout(500)
  const offset = (Date.now() - t0) / 1000 // i secondi iniziali (nav+load) da tagliare nel montaggio
  const anyAnchor = plan.some(p => p.a)
  for (let i = 0; i < plan.length; i++) {
    const hold = Math.max(1300, Math.round((durs[i] || 2) * 1000))
    const a = plan[i].a
    if (a) {
      await page.evaluate(({ txt, sel }) => {
        const els = [...document.querySelectorAll(sel)]
        const norm = (e) => (e.textContent || '').replace(/\s+/g, ' ').trim()
        const el = els.find(e => norm(e) === txt) || els.find(e => norm(e).includes(txt))
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, { txt: a, sel: ANCHOR_SEL })
    } else if (!anyAnchor) {
      await page.mouse.wheel(0, 320) // fallback: scroll proporzionale se nessun anchor
    }
    await page.waitForTimeout(hold)
  }
  await page.waitForTimeout(500)
  const video = page.video()
  await ctx.close(); await browser.close()
  const webm = await video.path()
  return { webm, offset }
}

// ── 5) Montaggio ────────────────────────────────────────────────────────────────
function mux(id, webm, offset, audio, durationSec) {
  const dir = path.join(WORK, id)
  const mp4 = path.join(dir, `${id}.mp4`)
  // taglia i secondi iniziali di nav/load (-ss offset), poi video+voce, durata = voce
  sh('ffmpeg', ['-y', '-ss', String(Math.max(0, offset).toFixed(2)), '-i', webm, '-i', audio,
    '-map', '0:v:0', '-map', '1:a:0', '-t', String(durationSec.toFixed(2)),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', mp4])
  const poster = path.join(dir, `${id}.jpg`)
  sh('ffmpeg', ['-y', '-ss', '1', '-i', mp4, '-frames:v', '1', '-q:v', '3', poster])
  return { mp4, poster }
}

// Versione verticale 9:16 (1080x1920) per Reels/IG/TikTok: il 16:9 al centro su
// sfondo sfocato di sé stesso + sottotitoli EN "bruciati" (leggibili anche muto).
function verticalize(id, mp4, vttPath) {
  const out = path.join(WORK, id, `${id}-vertical.mp4`)
  const style = "Alignment=2,FontName=Arial,FontSize=15,Bold=1,PrimaryColour=&Hffffff&,OutlineColour=&H90000000&,BorderStyle=3,Outline=2,Shadow=0,MarginV=150"
  const vf = [
    '[0:v]scale=1080:-2[fg]',
    '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=22:6,eq=brightness=-0.06[bg]',
    `[bg][fg]overlay=(W-w)/2:(H-h)/2,subtitles='${vttPath}':force_style='${style}'[v]`,
  ].join(';')
  sh('ffmpeg', ['-y', '-i', mp4, '-filter_complex', vf, '-map', '[v]', '-map', '0:a',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out])
  return out
}

const LOGO = () => path.join(ROOT, 'public/icon-512.png')
const FONT = process.env.HELP_FONT || '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
const dt = (s) => String(s).replace(/[\\:'%]/g, ' ').replace(/\s+/g, ' ').trim()

// Intro 3.6s dinamica/futuristica: fondo scuro, glow viola in movimento, logo
// in dissolvenza e il NOME della tab che appare con glow. Ferma lo scroll.
function makeIntro(name, W, H, outPath) {
  const D = 3.6, portrait = H > W
  const LW = Math.round(Math.min(W, H) * (portrait ? 0.30 : 0.20))
  const FS = Math.round(Math.min(W, H) * (portrait ? 0.072 : 0.085))
  const gMove = Math.round(W * 0.16), gMoveY = Math.round(H * 0.06)
  const f = [
    `color=c=0x07070d:s=${W}x${H}:r=30:d=${D},format=rgba[bg]`,
    `color=c=0x7b5bff:s=640x640:r=30:d=${D},format=rgba,boxblur=90:24,colorchannelmixer=aa=0.34[glow]`,
    `[bg][glow]overlay=x='(W-w)/2+${gMove}*sin(t*1.3)':y='(H-h)/2-${Math.round(H * 0.1)}+${gMoveY}*cos(t*1.7)'[bgg]`,
    `[0:v]scale=${LW}:-1,format=rgba,fade=t=in:st=0.1:d=0.55:alpha=1[lg]`,
    `[bgg][lg]overlay=(W-w)/2:(H*0.32)-h/2[wl]`,
    `[wl]drawtext=fontfile='${FONT}':text='${dt(name)}':fontcolor=white:fontsize=${FS}:shadowcolor=0x7b5bff@0.9:shadowx=0:shadowy=0:x=(w-text_w)/2:y=(h*0.56)-text_h/2:alpha='if(lt(t,0.55),0,min(1,(t-0.55)/0.5))'[nm]`,
    `[nm]drawtext=fontfile='${FONT}':text='LyftAI':fontcolor=0x22d3ee:fontsize=${Math.round(FS * 0.42)}:x=(w-text_w)/2:y=(h*0.66):alpha='if(lt(t,0.9),0,min(1,(t-0.9)/0.5))'[br]`,
    `[br]fade=t=out:st=${(D - 0.45).toFixed(2)}:d=0.45,format=yuv420p[v]`,
    // ── Sigla (sound-logo): accordo brillante + boom basso, dissolvenza ──
    `sine=f=392:d=${D}[n1]`,
    `sine=f=523.25:d=${D}[n2]`,
    `sine=f=659.25:d=${D}[n3]`,
    `[n1][n2][n3]amix=inputs=3,volume=0.15,afade=t=in:st=0:d=0.08,afade=t=out:st=${(D - 0.9).toFixed(2)}:d=0.9[chord]`,
    `sine=f=98:d=0.7,volume=0.5,afade=t=out:st=0.06:d=0.6[boom]`,
    `[chord][boom]amix=inputs=2:duration=first:dropout_transition=0,aresample=44100[a]`,
  ].join(';')
  sh('ffmpeg', ['-y', '-i', LOGO(), '-filter_complex', f, '-map', '[v]', '-map', '[a]',
    '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', '-b:a', '128k', outPath])
  return outPath
}

// Outro 2.8s: logo + call-to-action verso il sito.
function makeOutro(W, H, outPath) {
  const D = 2.8, portrait = H > W
  const LW = Math.round(Math.min(W, H) * (portrait ? 0.30 : 0.20))
  const FS = Math.round(Math.min(W, H) * (portrait ? 0.06 : 0.06))
  const f = [
    `color=c=0x07070d:s=${W}x${H}:r=30:d=${D},format=rgba[bg]`,
    `color=c=0x7b5bff:s=640x640:r=30:d=${D},format=rgba,boxblur=90:24,colorchannelmixer=aa=0.30[glow]`,
    `[bg][glow]overlay=(W-w)/2:(H-h)/2-${Math.round(H * 0.08)}[bgg]`,
    `[0:v]scale=${LW}:-1,format=rgba,fade=t=in:st=0.1:d=0.5:alpha=1[lg]`,
    `[bgg][lg]overlay=(W-w)/2:(H*0.40)-h/2[wl]`,
    `[wl]drawtext=fontfile='${FONT}':text='lyftai.io':fontcolor=0x22d3ee:fontsize=${FS}:x=(w-text_w)/2:y=(h*0.60):alpha='if(lt(t,0.4),0,min(1,(t-0.4)/0.5))'[cta]`,
    `[cta]fade=t=out:st=${(D - 0.45).toFixed(2)}:d=0.45,format=yuv420p[v]`,
    `anullsrc=r=44100:cl=stereo:d=${D}[a]`,
  ].join(';')
  sh('ffmpeg', ['-y', '-i', LOGO(), '-filter_complex', f, '-map', '[v]', '-map', '[a]',
    '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', '-b:a', '128k', outPath])
  return outPath
}

// Concatena intro + main + outro, normalizzando tutto a WxH/30fps.
function joinClips(clips, W, H, outPath) {
  const inputs = clips.flatMap(c => ['-i', c])
  const norm = clips.map((_, i) => `[${i}:v]scale=${W}:${H},fps=30,format=yuv420p,setsar=1[v${i}];[${i}:a]aformat=sample_rates=44100:channel_layouts=stereo[a${i}]`).join(';')
  const lab = clips.map((_, i) => `[v${i}][a${i}]`).join('')
  const f = `${norm};${lab}concat=n=${clips.length}:v=1:a=1[v][a]`
  sh('ffmpeg', ['-y', ...inputs, '-filter_complex', f, '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outPath])
  return outPath
}

// Avvolge un video con intro (col nome) + outro (CTA). Best-effort: se ffmpeg
// fallisce (font/filtri) ritorna il video originale, così non blocca la pipeline.
function brandWrap(name, mp4, W, H, outPath) {
  if (!fs.existsSync(LOGO())) return mp4
  try {
    const base = outPath.replace(/\.mp4$/, '')
    const intro = makeIntro(name, W, H, `${base}.intro.mp4`)
    const outro = makeOutro(W, H, `${base}.outro.mp4`)
    return joinClips([intro, mp4, outro], W, H, outPath)
  } catch (e) { console.error('  (brand skip:', e.message, ')'); return mp4 }
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
  let vertical = null
  if (files.vertical && fs.existsSync(files.vertical)) vertical = await put(files.vertical, `${id}-vertical.mp4`, 'video/mp4')
  const m = Math.floor(durationSec / 60), s = Math.round(durationSec % 60)
  return { src, captions, poster, ...(vertical ? { vertical } : {}), duration: `${m}:${String(s).padStart(2, '0')}` }
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
      const anchors = await getAnchors(a); console.log('  anchor:', anchors.length)
      const plan = await makeScriptSynced(a, anchors); console.log('  script:', plan.length, 'frasi (', plan.filter(p => p.a).length, 'ancorate )')
      const lines = plan.map(p => p.t)
      const { audio, vttPath, duration, durs } = await buildAudioAndVtt(a.id, lines); console.log('  voce:', duration.toFixed(1), 's')
      if (DRY) { console.log('  DRY → stop (audio+vtt in', path.join(WORK, a.id), ')'); continue }
      const { webm, offset } = await recordChoreographed(a, plan, durs); console.log('  registrato')
      const files = mux(a.id, webm, offset, audio, duration) // poster da qui (pre-brand)
      const dir = path.join(WORK, a.id)
      const finalH = brandWrap(a.title, files.mp4, 1280, 720, path.join(dir, `${a.id}.final.mp4`))
      const vert = verticalize(a.id, files.mp4, vttPath)
      const finalV = brandWrap(a.title, vert, 1080, 1920, path.join(dir, `${a.id}.vfinal.mp4`))
      files.mp4 = finalH; files.vertical = finalV
      console.log('  montato + intro/outro + verticale')
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
