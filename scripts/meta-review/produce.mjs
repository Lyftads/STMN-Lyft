#!/usr/bin/env node
// Produzione screencast Meta App Review: prende la registrazione grezza (.mov),
// aggiunge voce inglese (ElevenLabs) + sottotitoli inglesi burned-in + intro/outro.
// Niente libass: i sottotitoli/intro sono renderizzati come PNG via Playwright e
// composti con ffmpeg (overlay/concat).
//
//   node --env-file=.env.local --env-file=.env scripts/meta-review/produce.mjs
//
// Env: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID (default = voce approvata).

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { chromium } from 'playwright'

const pexec = promisify(execFile)
const sh = (cmd, args, opts = {}) => pexec(cmd, args, { maxBuffer: 1 << 28, ...opts })

const HOME = os.homedir()
const SRC = process.env.SRC || path.join(HOME, 'Desktop', 'Registrazione schermo 2026-06-18 alle 14.23.53.mov')
const OUT_DIR = path.join(HOME, 'Desktop', 'meta-review-out')
const WORK = path.join(OUT_DIR, 'work')
fs.mkdirSync(WORK, { recursive: true })

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || '7jQ3jNk3Fcw65sWUmzun'
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2'
if (!ELEVEN_KEY) { console.error('Manca ELEVENLABS_API_KEY'); process.exit(1) }

const VW = 1912, VH = 992 // risoluzione registrazione

// ── Narrazione: anchor (s) = quando idealmente inizia rispetto al video ───────
// tts = testo letto (nomi permessi "a voce"); sub = testo a schermo (underscore).
const SEGMENTS = [
  { anchor: 0.5,
    tts: 'This is LyftAI, an analytics dashboard that helps merchants understand their Meta advertising performance. To pull a merchant\'s data, we first connect their Meta account.',
    sub: 'LyftAI is an analytics dashboard. To pull a merchant\'s Meta Ads data, we first connect their Meta account.' },
  { anchor: 13,
    tts: 'From the Integrations page, the merchant clicks Connect on the Meta integration. This starts the standard Meta Login flow.',
    sub: 'From Integrations, the merchant clicks Connect on Meta. This starts the standard Meta Login flow.' },
  { anchor: 30,
    tts: 'The user signs in with their Facebook account and reviews what they are sharing. By continuing, they grant our app three permissions: business management, to discover the ad accounts they manage; ads read, to read their campaigns and performance; and read insights, to read advertising metrics.',
    sub: 'The user signs in and grants three permissions: business_management (discover ad accounts), ads_read (read campaigns & performance), read_insights (read metrics).' },
  { anchor: 49,
    tts: 'Once authorized, the connection is established successfully.',
    sub: 'Once authorized, the connection is established successfully.' },
  { anchor: 57,
    tts: 'The app then asks which ad account to use. Thanks to business management, we list the ad accounts the user manages. The merchant selects an account and saves.',
    sub: 'Thanks to business_management, the app lists the ad accounts the user manages. The merchant selects one and saves.' },
  { anchor: 82,
    tts: 'Now the merchant\'s Meta Ads data is available. On the KPI page we show real spend, ROAS, impressions, reach and frequency, read using ads read and read insights.',
    sub: 'On the KPI page we show real spend, ROAS, impressions, reach and frequency — read using ads_read and read_insights.' },
  { anchor: 116,
    tts: 'Trends and proactive recommendations are generated from this advertising data to guide the merchant\'s decisions.',
    sub: 'Trends and proactive recommendations are generated from this advertising data.' },
  { anchor: 140,
    tts: 'On the Detail page, the merchant drills into each campaign, ad set, and individual ad to review performance, again powered by ads read.',
    sub: 'On the Detail page, the merchant drills into each campaign, ad set and ad — powered by ads_read.' },
  { anchor: 192,
    tts: 'That\'s the complete end to end flow. The user signs in with Meta, grants access, and we use these permissions only to display their own advertising analytics inside LyftAI. Thank you for reviewing.',
    sub: 'End-to-end flow: the user grants access, and we use these permissions only to display their own advertising analytics. Thank you for reviewing.' },
]

const sleep = ms => new Promise(r => setTimeout(r, ms))
async function jfetch(url, opts, tries = 6) {
  let err
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, opts); if (r.status >= 500 && i < tries - 1) { await sleep(1500 * (i + 1)); continue } return r }
    catch (e) { err = e; await sleep(1500 * (i + 1)) }
  }
  throw err
}

async function ffprobeDuration(file) {
  const { stdout } = await sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file])
  return parseFloat(stdout.trim())
}

async function tts(text, outFile) {
  if (fs.existsSync(outFile)) return
  const r = await jfetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVEN_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: ELEVEN_MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true } }),
  })
  if (!r.ok) throw new Error('ElevenLabs ' + r.status + ' ' + (await r.text()).slice(0, 200))
  const buf = Buffer.from(await r.arrayBuffer())
  fs.writeFileSync(outFile, buf)
}

// ── Render PNG (sottotitolo o intro/outro) via browser ───────────────────────
async function renderPng(html, file, w, h, transparent = true) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.screenshot({ path: file, omitBackground: transparent })
  await browser.close()
}

const subHtml = (text) => `<!doctype html><html><head><meta charset="utf8"><style>
  html,body{margin:0;width:${VW}px;height:200px;background:transparent;
    font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;}
  .wrap{position:absolute;left:0;right:0;bottom:18px;display:flex;justify-content:center;}
  .cap{max-width:1400px;margin:0 40px;padding:14px 26px;border-radius:14px;
    background:rgba(8,8,14,0.82);color:#fff;font-size:30px;line-height:1.34;font-weight:600;
    text-align:center;letter-spacing:0.2px;box-shadow:0 8px 30px rgba(0,0,0,0.5);
    -webkit-font-smoothing:antialiased;}
  .cap b{color:#7db1ff;font-weight:800;}
</style></head><body><div class="wrap"><div class="cap">${text}</div></div></body></html>`

// Evidenzia i nomi permesso in azzurro nei sottotitoli.
const hi = (t) => t.replace(/(business_management|ads_read|read_insights)/g, '<b>$1</b>')

const introHtml = `<!doctype html><html><head><meta charset="utf8"><style>
  html,body{margin:0;width:${VW}px;height:${VH}px;background:#05060a;overflow:hidden;
    font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;}
  .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:radial-gradient(1200px 700px at 50% 40%, rgba(41,109,255,0.18), transparent 60%),#05060a;}
  .logo{font-size:64px;font-weight:900;letter-spacing:-1px;
    background:linear-gradient(90deg,#fff,#7db1ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
  .sub{margin-top:18px;color:#9fb4d8;font-size:30px;font-weight:600;letter-spacing:.4px;}
  .line{margin-top:34px;width:120px;height:4px;border-radius:3px;background:linear-gradient(90deg,#296dff,#7db1ff);}
</style></head><body><div class="c">
  <div class="logo">LyftAI</div>
  <div class="sub">Meta Ads Integration — Permissions Use Case</div>
  <div class="line"></div>
</div></body></html>`

const outroHtml = `<!doctype html><html><head><meta charset="utf8"><style>
  html,body{margin:0;width:${VW}px;height:${VH}px;background:#05060a;overflow:hidden;
    font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;}
  .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:radial-gradient(1200px 700px at 50% 50%, rgba(41,109,255,0.16), transparent 60%),#05060a;}
  .logo{font-size:60px;font-weight:900;background:linear-gradient(90deg,#fff,#7db1ff);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;}
  .sub{margin-top:16px;color:#9fb4d8;font-size:26px;font-weight:600;}
</style></head><body><div class="c">
  <div class="logo">LyftAI</div>
  <div class="sub">Thank you for reviewing</div>
</div></body></html>`

async function main() {
  const srcDur = await ffprobeDuration(SRC)
  console.log(`Sorgente: ${srcDur.toFixed(1)}s @ ${VW}x${VH}`)

  // 1) TTS per segmento + durate
  console.log('— TTS ElevenLabs…')
  const segs = []
  for (let i = 0; i < SEGMENTS.length; i++) {
    const s = SEGMENTS[i]
    const mp3 = path.join(WORK, `voice_${i}.mp3`)
    await tts(s.tts, mp3)
    const d = await ffprobeDuration(mp3)
    segs.push({ ...s, mp3, dur: d })
    console.log(`  seg ${i}: ${d.toFixed(2)}s`)
  }

  // 2) Posiziona i segmenti senza sovrapposizione audio (start ≥ anchor e ≥ fine prec.)
  const GAP = 0.5
  let prevEnd = 0
  for (const s of segs) {
    s.start = Math.max(s.anchor, prevEnd + GAP)
    s.end = s.start + s.dur
    prevEnd = s.end
  }
  const lastEnd = segs[segs.length - 1].end
  console.log(`Ultimo segmento finisce a ${lastEnd.toFixed(1)}s (video ${srcDur.toFixed(1)}s)`)

  // 3) Traccia voce unica (adelay + amix) lunga quanto il video
  console.log('— Monto traccia voce…')
  const voiceWav = path.join(WORK, 'voice.wav')
  {
    const inputs = segs.flatMap(s => ['-i', s.mp3])
    const filt = segs.map((s, i) => `[${i}:a]adelay=${Math.round(s.start * 1000)}|${Math.round(s.start * 1000)}[a${i}]`).join(';')
    const mixIn = segs.map((_, i) => `[a${i}]`).join('')
    const fc = `${filt};${mixIn}amix=inputs=${segs.length}:normalize=0[mix]`
    await sh('ffmpeg', ['-y', ...inputs, '-filter_complex', fc, '-map', '[mix]',
      '-t', String(srcDur), '-ar', '44100', '-ac', '2', voiceWav])
  }

  // 4) Render PNG sottotitoli (uno per segmento)
  console.log('— Render sottotitoli (browser)…')
  for (let i = 0; i < segs.length; i++) {
    const png = path.join(WORK, `sub_${i}.png`)
    if (!fs.existsSync(png)) await renderPng(subHtml(hi(segs[i].sub)), png, VW, 200)
    segs[i].png = png
  }

  // 5) Overlay sottotitoli sul video + audio voce → core.mp4
  console.log('— Overlay sottotitoli + audio…')
  const core = path.join(WORK, 'core.mp4')
  {
    const inputs = ['-i', SRC, ...segs.flatMap(s => ['-i', s.png]), '-i', voiceWav]
    const subBase = segs.length + 1 // indice input voiceWav è dopo i png; png partono da 1
    // catena overlay: [0:v][1]overlay...[v1]; [v1][2]overlay...[v2] ...
    let chain = ''
    let cur = '0:v'
    segs.forEach((s, i) => {
      const next = `v${i + 1}`
      chain += `[${cur}][${i + 1}:v]overlay=x=0:y=${VH - 200}:enable='between(t,${s.start.toFixed(2)},${s.end.toFixed(2)})'[${next}];`
      cur = next
    })
    chain = chain.replace(/;$/, '')
    await sh('ffmpeg', ['-y', ...inputs, '-filter_complex', chain,
      '-map', `[${cur}]`, '-map', `${subBase}:a`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-r', '30', core])
    console.log('  core.mp4 ok')
  }

  // 6) Intro (3.5s) + Outro (2.5s) come clip video, poi concat
  console.log('— Intro/Outro…')
  const introPng = path.join(WORK, 'intro.png')
  const outroPng = path.join(WORK, 'outro.png')
  if (!fs.existsSync(introPng)) await renderPng(introHtml, introPng, VW, VH, false)
  if (!fs.existsSync(outroPng)) await renderPng(outroHtml, outroPng, VW, VH, false)
  const introMp4 = path.join(WORK, 'intro.mp4')
  const outroMp4 = path.join(WORK, 'outro.mp4')
  const cardToMp4 = async (png, secs, out, fadeIn) => {
    await sh('ffmpeg', ['-y', '-loop', '1', '-i', png, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-t', String(secs), '-vf', `scale=${VW}:${VH},format=yuv420p,fade=t=in:st=0:d=0.4${fadeIn ? '' : ''}`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-shortest', out])
  }
  await cardToMp4(introPng, 3.5, introMp4, true)
  await cardToMp4(outroPng, 2.5, outroMp4, true)

  console.log('— Concat finale…')
  const listFile = path.join(WORK, 'concat.txt')
  fs.writeFileSync(listFile, [introMp4, core, outroMp4].map(f => `file '${f}'`).join('\n'))
  const final = path.join(OUT_DIR, 'LyftAI_Meta_App_Review.mp4')
  // re-encode in concat (clip con parametri identici → safe)
  await sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-r', '30', final])

  const fd = await ffprobeDuration(final)
  console.log(`\n✅ FATTO: ${final}\n   durata ${fd.toFixed(1)}s`)
}

main().catch(e => { console.error(e); process.exit(1) })
