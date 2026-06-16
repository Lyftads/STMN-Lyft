#!/usr/bin/env node
// Scarica TUTTI i video-guida dal bucket Supabase in una cartella locale.
// Uso:
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/help-video/download.mjs
//   OUT=./video node scripts/help-video/download.mjs        # cartella custom
//   WHAT=mp4,vtt node scripts/help-video/download.mjs       # anche i sottotitoli

import fs from 'node:fs'
import path from 'node:path'

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = process.env.HELP_BUCKET || 'help-videos'
const OUT = process.env.OUT || 'help-videos-download'
const WHAT = (process.env.WHAT || 'mp4').split(',').map(s => s.trim())

if (!URL || !KEY) { console.error('Mancano SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(URL, KEY)
fs.mkdirSync(OUT, { recursive: true })

const { data, error } = await sb.storage.from(BUCKET).list('', { limit: 1000 })
if (error) { console.error(error.message); process.exit(1) }

const files = (data || []).filter(f => WHAT.some(ext => f.name.endsWith('.' + ext)))
console.log(`Scarico ${files.length} file in ${OUT}/`)
for (const f of files) {
  const pub = sb.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl
  const r = await fetch(pub)
  if (!r.ok) { console.error('  ✗', f.name, r.status); continue }
  fs.writeFileSync(path.join(OUT, f.name), Buffer.from(await r.arrayBuffer()))
  console.log('  ✓', f.name)
}
console.log('Fatto.')
