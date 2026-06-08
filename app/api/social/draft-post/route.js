export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { resolveWorkspace } from '../../../../lib/team/workspace'
import { aiLangSystemMessage } from '../../../../lib/i18n/aiLang'
import { buildBrandContext } from '../../../../lib/tenant/brand'
import { buildKnowledgeBlock } from '../../../../lib/tenant/agentMemory'

// Fase 3 (social organico): trasforma un brief in una bozza di post per
// Instagram o TikTok, coerente col brand. Non pubblica: restituisce la bozza,
// che l'utente accoda nella Coda Azioni (type=create_post) per l'approvazione.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const PLATFORMS = ['instagram', 'tiktok']
const POST_TYPES = ['post', 'reel', 'story', 'carousel']

const TYPE_HINT = {
  post: 'Formato: post statico (1 immagine/video). Caption completa.',
  reel: "Formato: REEL/video verticale. L'hook è la prima scena/frase nei primi 2 secondi; suggerisci un mini-script per scene nella caption se utile.",
  story: 'Formato: STORY verticale effimera. Testo molto breve e diretto, 1 frase + CTA con sticker/swipe-up.',
  carousel: 'Formato: CAROSELLO multi-slide. Nella caption proponi 3-6 slide numerate (Slide 1, Slide 2…) con il testo di ciascuna, più la caption finale.',
}

function systemPrompt(platform, postType) {
  const p = platform === 'tiktok' ? 'TikTok' : 'Instagram'
  const typeHint = TYPE_HINT[postType] || TYPE_HINT.post
  return `Sei un social media manager esperto di ${p} per brand DTC. Trasforma il brief in una bozza di ${postType} ${p} pronta, coerente col brand.
${typeHint}
Rispondi SOLO con JSON con ESATTAMENTE queste chiavi:
{
  "platform": "${platform}",
  "hook": "prima riga/scena che ferma lo scroll",
  "caption": "caption completa pronta da pubblicare",
  "hashtags": ["#tag1","#tag2", ...],   // 5-12 hashtag pertinenti, senza spazi
  "cta": "call to action finale",
  "format": "es. Reel, Carosello, Foto singola, Video"
}
Scrivi hook/caption/cta NELLA LINGUA DELL'UTENTE. Niente testo fuori dal JSON.`
}

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY non configurata.' }, { status: 500 })

  let b = {}
  try { b = await req.json() } catch {}
  const prompt = String(b.prompt || '').trim()
  const platform = PLATFORMS.includes(b.platform) ? b.platform : 'instagram'
  const postType = POST_TYPES.includes(b.postType) ? b.postType : 'post'
  if (!prompt) return NextResponse.json({ ok: false, error: 'Brief mancante' }, { status: 400 })

  let brand = ''
  try { brand = await buildBrandContext() } catch {}

  try {
    const langMsg = aiLangSystemMessage(b.locale)
    const kb = await buildKnowledgeBlock(`contenuto social ${platform} ${postType} copywriting marketing: ${prompt}`.slice(0, 500))
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(platform, postType) },
          ...(kb ? [{ role: 'system', content: kb }] : []),
          ...(langMsg ? [langMsg] : []),
          ...(brand ? [{ role: 'system', content: `BRAND:\n${String(brand).slice(0, 2000)}` }] : []),
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(28000),
    })
    const j = await r.json()
    if (!r.ok) return NextResponse.json({ ok: false, error: j?.error?.message || `HTTP ${r.status}` }, { status: 502 })
    let d = {}
    try { d = JSON.parse(j.choices?.[0]?.message?.content || '{}') } catch {}
    const tags = Array.isArray(d.hashtags) ? d.hashtags.map(x => String(x).replace(/^#?/, '#').replace(/\s+/g, '')).slice(0, 12) : []
    const out = {
      platform,
      postType,
      hook: String(d.hook || '').slice(0, 200),
      caption: String(d.caption || '').slice(0, 2000),
      hashtags: tags,
      cta: String(d.cta || '').slice(0, 160),
      format: String(d.format || 'Reel').slice(0, 40),
    }
    return NextResponse.json({ ok: true, draft: out })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
