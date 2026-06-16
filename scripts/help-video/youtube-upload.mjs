#!/usr/bin/env node
// Carica i video-guida sul tuo canale YouTube (YouTube Data API v3).
//
// Workflow consigliato:
//   1) node scripts/help-video/download.mjs           # scarica i mp4 in ./help-videos-download
//   2) node scripts/help-video/youtube-upload.mjs      # li carica su YouTube
//
// Prerequisiti:
//   npm i googleapis
//   Variabili: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN (vedi README)
//   SRC=./help-videos-download (default), PRIVACY=unlisted|private|public
//
// ⚠️ Quota YouTube: ogni upload costa ~1600 unità, la quota giornaliera di
//    default è 10.000 → ~6 video/giorno. Per 46 video o chiedi l'aumento quota
//    nella Google Cloud Console, o spalmi su più giorni (lo script salta quelli
//    già caricati grazie al file .yt-uploaded.json).

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SRC = process.env.SRC || 'help-videos-download'
const PRIVACY = process.env.PRIVACY || 'unlisted'
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const STATE = path.join(SRC, '.yt-uploaded.json')

const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) {
  console.error('Mancano YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN (vedi README)')
  process.exit(1)
}

const { google } = await import('googleapis')
const { HELP_ARTICLES } = await import(pathToFileURL(path.join(ROOT, 'lib/help/content.js')))
const artById = Object.fromEntries(HELP_ARTICLES.map(a => [a.id, a]))

const oauth = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET)
oauth.setCredentials({ refresh_token: YT_REFRESH_TOKEN })
const yt = google.youtube({ version: 'v3', auth: oauth })

let done = {}
try { done = JSON.parse(fs.readFileSync(STATE, 'utf8')) } catch {}

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.mp4') && !f.endsWith('-vertical.mp4'))
console.log(`Trovati ${files.length} video. Carico (privacy: ${PRIVACY})…`)

const CTA = '\n\n👉 Try LyftAI free: https://lyftai.io\n\n#ecommerce #Shopify #analytics #marketing #LyftAI'

// WebVTT → SRT (YouTube accetta SRT in modo affidabile).
function vttToSrt(vtt) {
  const lines = vtt.replace(/\r/g, '').split('\n')
  let i = 0, n = 1; const out = []
  while (i < lines.length) {
    if (/-->/.test(lines[i])) {
      const time = lines[i].replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, '$1,$2')
      const text = []; i++
      while (i < lines.length && lines[i].trim() !== '') { text.push(lines[i]); i++ }
      out.push(`${n++}\n${time}\n${text.join('\n')}\n`)
    } else i++
  }
  return out.join('\n')
}

// Titolo + descrizione in INGLESE (AI) con call-to-action.
async function metaFor(a, id) {
  const fb = { title: `${a?.title || id} — LyftAI Tutorial`, description: `A quick guide to ${a?.title || id} in LyftAI.${CTA}` }
  if (!process.env.OPENAI_API_KEY || !a) return fb
  try {
    const guide = [a.title, a.summary, ...(a.sections || []).map(s => `${s.h}: ${s.p || (s.list || []).join(' ')}`)].join('\n')
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.6, response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: 'You write YouTube metadata in ENGLISH for a SaaS (e-commerce analytics) product tutorial video. Output JSON {"title":"...","description":"..."}. Title <= 70 chars, clear and catchy. Description: 2-3 short paragraphs explaining what this section does and its value, friendly tone. No hashtags or links (added separately).' },
        { role: 'user', content: guide },
      ] }),
    })
    const j = await r.json()
    if (!r.ok) return fb
    const m = JSON.parse(j.choices[0].message.content)
    return { title: (m.title || fb.title).slice(0, 95), description: (m.description || '') + CTA }
  } catch { return fb }
}

for (const file of files) {
  const id = file.replace(/\.mp4$/, '')
  if (done[id]) { console.log('  ⏭  già caricato:', id); continue }
  const a = artById[id]
  const { title, description } = await metaFor(a, id)
  try {
    const res = await yt.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: { title, description, tags: ['LyftAI', 'tutorial', id], categoryId: '28' },
        status: { privacyStatus: PRIVACY, selfDeclaredMadeForKids: false },
      },
      media: { body: fs.createReadStream(path.join(SRC, file)) },
    })
    const url = `https://youtu.be/${res.data.id}`
    done[id] = url
    fs.writeFileSync(STATE, JSON.stringify(done, null, 2))
    console.log('  ✓', id, '→', url)
    // Sottotitoli EN: carica il .vtt come traccia (convertito in SRT)
    const vtt = path.join(SRC, `${id}.en.vtt`)
    if (fs.existsSync(vtt)) {
      try {
        const srt = vttToSrt(fs.readFileSync(vtt, 'utf8'))
        const srtPath = path.join(SRC, `${id}.en.srt`)
        fs.writeFileSync(srtPath, srt)
        await yt.captions.insert({
          part: ['snippet'],
          requestBody: { snippet: { videoId: res.data.id, language: 'en', name: 'English', isDraft: false } },
          media: { body: fs.createReadStream(srtPath) },
        })
        console.log('    + sottotitoli EN')
      } catch (e) { console.error('    (sottotitoli skip:', e?.errors?.[0]?.reason || e.message, ')') }
    }
  } catch (e) {
    const msg = e?.errors?.[0]?.reason || e.message
    console.error('  ✗', id, msg)
    if (/quota/i.test(msg)) { console.error('  Quota esaurita per oggi: rilancia domani, riprende da dove era.'); break }
  }
}
console.log('Fatto. Mappa id→URL in', STATE)
