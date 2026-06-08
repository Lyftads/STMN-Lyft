// One-off: genera le anteprime fotografiche degli Studios (stile Kive) con
// gpt-image-1 e le salva come asset statici in public/studios/<id>.webp.
// Uso: node scripts/gen-studio-previews.mjs [--force] [--only id1,id2]
import fs from 'node:fs'
import path from 'node:path'
import { STUDIO_PRESETS } from '../lib/studio/models.js'

// carica OPENAI_API_KEY da .env.local
const envRaw = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const KEY = (envRaw.match(/^OPENAI_API_KEY=(.+)$/m) || [])[1]?.trim()
if (!KEY) { console.error('OPENAI_API_KEY mancante in .env.local'); process.exit(1) }

const OUT = new URL('../public/studios/', import.meta.url)
fs.mkdirSync(OUT, { recursive: true })

const args = process.argv.slice(2)
const force = args.includes('--force')
const onlyArg = (args.find(a => a.startsWith('--only=')) || '').split('=')[1]
const only = onlyArg ? new Set(onlyArg.split(',')) : null

const QUALITY = 'a high-end editorial fashion/commercial photograph, photorealistic, professional lighting, tack-sharp, fine detail, natural skin texture, premium magazine finish, no text, no watermark'

async function genOne(s) {
  const file = path.join(OUT.pathname, `${s.id}.webp`)
  if (!force && fs.existsSync(file)) { console.log('skip', s.id); return }
  const prompt = `${s.prompt}. ${QUALITY}. Vertical 3:4 composition.`
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: 'gpt-image-1', prompt, n: 1, size: '1024x1536',
      quality: 'medium', output_format: 'webp', output_compression: 80,
    }),
  })
  if (!res.ok) { console.error('FAIL', s.id, res.status, (await res.text()).slice(0, 160)); return false }
  const d = await res.json()
  const b64 = d.data?.[0]?.b64_json
  if (!b64) { console.error('NO IMG', s.id); return false }
  fs.writeFileSync(file, Buffer.from(b64, 'base64'))
  const kb = Math.round(fs.statSync(file).size / 1024)
  console.log('ok  ', s.id, `${kb}KB`)
  return true
}

// pool di concorrenza
const list = STUDIO_PRESETS.filter(s => !only || only.has(s.id))
let i = 0
async function worker() { while (i < list.length) { const s = list[i++]; try { await genOne(s) } catch (e) { console.error('ERR', s.id, e.message) } } }
await Promise.all([worker(), worker(), worker(), worker()])
console.log('DONE', list.length, 'studios')
