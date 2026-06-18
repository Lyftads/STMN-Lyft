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
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY            // se presente → voce ElevenLabs (molto più umana)
// Voce EN naturale di default (Rachel). Cambiabile: Adam pNInz6obpgDQGcFmaJgB,
// Antoni ErXwobaYiN019PkySvjV, Josh TxGEqnHWrfWFTfGW9XjX.
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || (ELEVEN_KEY ? '21m00Tcm4TlvDq8ikWAM' : '')
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2'
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = process.env.HELP_BUCKET || 'help-videos'
const DRY = process.env.DRY === '1'
const SKIP_VERTICAL = process.env.HELP_SKIP_VERTICAL === '1' // salta i Reels (più veloce)

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
async function jfetch(url, opts, tries = 7) {
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
    const r = await jfetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': ELEVEN_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      // consegna naturale ed espressiva (umana), non piatta
      body: JSON.stringify({ text, model_id: ELEVEN_MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true } }),
    })
    if (r.ok) { fs.writeFileSync(outPath, Buffer.from(await r.arrayBuffer())); return }
    // quota/errore ElevenLabs → ripiego su OpenAI per questa frase (run non si blocca)
    console.error('  (ElevenLabs', r.status, '→ OpenAI per questa frase)')
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
  // deep-link ?tab=<id> → apre la sezione giusta in modo univoco (niente click
  // ambigui su etichette duplicate tipo "Lighthouse"/"Budget Advisor").
  const q = `?tab=${encodeURIComponent(article.tab)}`
  if (USE_DEMO) {
    await page.goto(`${BASE_URL}/demo${q}`, { waitUntil: 'networkidle' })
  } else {
    await loginIfNeeded(page)
    await page.goto(`${BASE_URL}/${q}`, { waitUntil: 'networkidle' })
  }
  await page.waitForTimeout(3200)
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

// Versione verticale 9:16 (1080x1920). Tenta con sottotitoli EN bruciati; se la
// masterizzazione fallisce, riprova senza (la verticale esce comunque).
function verticalizeImpl(id, mp4, vttPath) {
  const out = path.join(WORK, id, `${id}-vertical.mp4`)
  const subs = vttPath
    ? `,subtitles='${vttPath}':force_style='Alignment=2,FontName=DejaVu Sans,FontSize=14,Bold=1,PrimaryColour=&Hffffff&,OutlineColour=&H90000000&,BorderStyle=3,Outline=2,Shadow=0,MarginV=160'`
    : ''
  const vf = [
    '[0:v]split=2[v0][v1]',
    '[v0]scale=1080:-2[fg]',
    // bg sfocato leggero: stiro a 1080x1920 (la distorsione non si vede, è blur)
    '[v1]scale=1080:1920,boxblur=20:5,eq=brightness=-0.06[bg]',
    `[bg][fg]overlay=(W-w)/2:(H-h)/2${subs}[v]`,
  ].join(';')
  sh('ffmpeg', ['-y', '-i', mp4, '-filter_complex', vf, '-map', '[v]', '-map', '0:a',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out])
  return out
}
// 9:16 semplice e bulletproof: scala a larghezza 1080 e bordi scuri (no blur,
// no upscale pesante) → non può fallire per memoria/filtri.
function verticalizeSimple(id, mp4) {
  const out = path.join(WORK, id, `${id}-vertical.mp4`)
  sh('ffmpeg', ['-y', '-i', mp4, '-vf', 'scale=1080:-2,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:0x06060c,format=yuv420p',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out])
  return out
}

// Prova: blur+sottotitoli → blur → semplice. Garantisce sempre una verticale.
function verticalize(id, mp4, vttPath) {
  const tries = [
    ['blur+sottotitoli', () => verticalizeImpl(id, mp4, vttPath)],
    ['blur', () => verticalizeImpl(id, mp4, null)],
    ['semplice', () => verticalizeSimple(id, mp4)],
  ]
  for (const [label, fn] of tries) {
    try { return fn() } catch (e) { console.error(`  (verticale ${label} fallita: ${e.message})`) }
  }
  return null
}

// Logo in base64 per le card HTML (intro/outro) renderizzate dal browser.
let LOGO_B64 = ''
try { LOGO_B64 = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'public/icon-512.png')).toString('base64') } catch {}
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// Intro premium "stile Apple": fondo profondo, due glow che derivano, logo che
// entra da sfocato a nitido, NOME con reveal blur→nitido + scala che si assesta
// e riempimento a gradiente, accento luminoso, uscita morbida con micro-zoom.
function introHtml(name, W, H, D) {
  const p = H > W
  const lw = Math.round(Math.min(W, H) * (p ? 0.26 : 0.145))
  const fz = Math.round(Math.min(W, H) * (p ? 0.10 : 0.092))
  const lineW = Math.round(Math.min(W, H) * 0.16)
  const small = Math.round(Math.min(W, H) * 0.028)
  const EZ = 'cubic-bezier(.16,1,.3,1)' // easing morbido stile Apple
  return `<!doctype html><html><head><meta charset="utf8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#000;font-family:-apple-system,'SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.stage{position:relative;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${p ? 40 : 26}px;
 background:radial-gradient(1300px 1000px at 50% 16%,#101220 0%,#070810 52%,#000 100%);
 animation:fin .6s ease both, fout .6s cubic-bezier(.5,0,1,1) ${(D - 0.6).toFixed(2)}s both}
.aura{position:absolute;inset:-25%;
 background:radial-gradient(540px 540px at 38% 40%,rgba(123,91,255,.34),transparent 60%),radial-gradient(480px 480px at 66% 62%,rgba(34,211,238,.20),transparent 60%);
 filter:blur(26px);animation:drift 9s ease-in-out infinite alternate}
.logo{width:${lw}px;opacity:0;transform:scale(.84);filter:drop-shadow(0 0 64px rgba(123,91,255,.55)) blur(7px);
 animation:logoIn 1.15s ${EZ} .15s both;position:relative}
.name{position:relative;font-weight:700;letter-spacing:-1.5px;font-size:${fz}px;line-height:1.02;text-align:center;padding:0 8%;
 background:linear-gradient(180deg,#fff 0%,#cfe0ff 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;
 text-shadow:0 0 44px rgba(123,91,255,.40);opacity:0;transform:scale(1.12);filter:blur(16px);animation:nameIn 1.2s ${EZ} .55s both}
.line{height:4px;width:0;border-radius:3px;background:linear-gradient(90deg,#7b5bff,#22d3ee);box-shadow:0 0 20px #22d3ee;animation:grow .8s ${EZ} 1.05s both;position:relative}
.brand{font-weight:600;letter-spacing:6px;text-transform:uppercase;font-size:${small}px;color:#22d3ee;opacity:0;transform:translateY(10px);animation:up .8s ${EZ} 1.2s both;position:relative}
@keyframes logoIn{to{opacity:1;transform:scale(1);filter:drop-shadow(0 0 44px rgba(123,91,255,.5)) blur(0)}}
@keyframes nameIn{to{opacity:1;transform:scale(1);filter:blur(0)}}
@keyframes grow{to{width:${lineW}px}}
@keyframes up{to{opacity:1;transform:translateY(0)}}
@keyframes drift{to{transform:translate(6%,4%) scale(1.08)}}
@keyframes fin{from{opacity:0}to{opacity:1}}@keyframes fout{to{opacity:0;transform:scale(1.04)}}
</style></head><body><div class="stage"><div class="aura"></div>
<img class="logo" src="${LOGO_B64}"><div class="name">${esc(name)}</div><div class="line"></div><div class="brand">LyftAI</div>
</div></body></html>`
}

function outroHtml(W, H, D) {
  const p = H > W
  const lw = Math.round(Math.min(W, H) * (p ? 0.28 : 0.16))
  const fz = Math.round(Math.min(W, H) * (p ? 0.07 : 0.06))
  const small = Math.round(Math.min(W, H) * 0.026)
  return `<!doctype html><html><head><meta charset="utf8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#06060c;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.stage{position:relative;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${p ? 36 : 24}px;
 background:radial-gradient(1000px 700px at 50% 45%,rgba(123,91,255,.18),transparent 60%),#06060c;animation:fin .5s ease both,fout .5s ease ${(D - 0.5).toFixed(2)}s both}
.glow{position:absolute;width:50%;height:50%;border-radius:50%;filter:blur(130px);background:#7b5bff;opacity:.34}
.logo{width:${lw}px;opacity:0;transform:scale(.8);filter:drop-shadow(0 0 46px rgba(123,91,255,.7));animation:pop .8s cubic-bezier(.2,.8,.2,1) .1s both;position:relative}
.cta{color:#fff;font-weight:800;font-size:${fz}px;opacity:0;transform:translateY(18px);text-shadow:0 0 30px rgba(34,211,238,.5);animation:rise .7s ease .5s both;position:relative}
.cta b{color:#22d3ee}
.sub{color:#9aa3b2;font-weight:600;letter-spacing:2px;font-size:${small}px;opacity:0;animation:rise .6s ease .8s both;position:relative}
@keyframes pop{to{opacity:1;transform:scale(1)}}@keyframes rise{to{opacity:1;transform:translateY(0)}}
@keyframes fin{from{opacity:0}to{opacity:1}}@keyframes fout{to{opacity:0}}
</style></head><body><div class="stage"><div class="glow"></div>
<img class="logo" src="${LOGO_B64}"><div class="cta">Try <b>LyftAI</b> free</div><div class="sub">lyftai.io</div>
</div></body></html>`
}

// Registra un HTML col browser per `sec` secondi → webm.
async function recordHtml(html, W, H, sec) {
  const { chromium } = await import('playwright')
  const dir = fs.mkdtempSync(path.join(WORK, 'clip-'))
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir, size: { width: W, height: H } } })
  const page = await ctx.newPage()
  await page.setContent(html, { waitUntil: 'load' })
  await page.waitForTimeout(Math.round(sec * 1000))
  const video = page.video()
  await ctx.close(); await browser.close()
  return await video.path()
}

// webm → mp4 (durata D). Audio: sigla sintetizzata (jingle) o silenzio.
function clipToMp4(webm, W, H, D, outPath, jingle) {
  const a = jingle
    ? `sine=f=392:d=${D}[n1];sine=f=523.25:d=${D}[n2];sine=f=659.25:d=${D}[n3];[n1][n2][n3]amix=inputs=3,volume=0.14,afade=t=in:st=0:d=0.08,afade=t=out:st=${(D - 0.9).toFixed(2)}:d=0.9[ch];sine=f=98:d=0.7,volume=0.5,afade=t=out:st=0.06:d=0.6[bm];[ch][bm]amix=inputs=2:duration=first:dropout_transition=0,aresample=44100[a]`
    : `anullsrc=r=44100:cl=stereo:d=${D}[a]`
  const vf = `[0:v]trim=0:${D},setpts=PTS-STARTPTS,scale=${W}:${H},fps=30,format=yuv420p,setsar=1[v]`
  sh('ffmpeg', ['-y', '-i', webm, '-filter_complex', `${vf};${a}`, '-map', '[v]', '-map', '[a]', '-t', String(D),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outPath])
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

// Avvolge un video con intro (HTML animato col nome) + outro (CTA), registrate
// dal browser. Best-effort: se qualcosa fallisce ritorna il video originale.
async function brandWrap(name, mp4, W, H, outPath) {
  if (!LOGO_B64) return mp4
  try {
    const base = outPath.replace(/\.mp4$/, '')
    const DI = 4.0, DO = 2.8
    const intro = clipToMp4(await recordHtml(introHtml(name, W, H, DI), W, H, DI + 0.4), W, H, DI, `${base}.intro.mp4`, true)
    const outro = clipToMp4(await recordHtml(outroHtml(W, H, DO), W, H, DO + 0.4), W, H, DO, `${base}.outro.mp4`, false)
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
  let targets = HELP_ARTICLES.filter(a => only.length ? only.includes(a.id) : true)
  // resume: se rilancio dopo un crash, salto i tab già nel manifest (file locale)
  if (!only.length) {
    const skip = targets.filter(a => manifest[a.id])
    if (skip.length) { console.log(`(resume: salto ${skip.length} già fatti)`); targets = targets.filter(a => !manifest[a.id]) }
  }
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
      const content = files.mp4 // contenuto pre-brand
      try { files.mp4 = await brandWrap(a.title, content, 1280, 720, path.join(dir, `${a.id}.final.mp4`)) }
      catch (e) { console.error('  (brand H skip:', e.message, ')') }
      // verticale per Reels: best-effort, non blocca l'orizzontale (skippabile)
      if (!SKIP_VERTICAL) try {
        const vert = verticalize(a.id, content, vttPath)
        if (vert) files.vertical = await brandWrap(a.title, vert, 1080, 1920, path.join(dir, `${a.id}.vfinal.mp4`))
        else console.error('  (verticale non prodotta)')
      } catch (e) { console.error('  (verticale skip:', e.message, ')') }
      console.log('  montato + intro/outro', files.vertical ? '+ verticale' : '(senza verticale)')
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
