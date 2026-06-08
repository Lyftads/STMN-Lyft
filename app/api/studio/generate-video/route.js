export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getVideoModel } from '../../../../lib/studio/models'
import { getAuthUser, spendCredits, addCredits } from '../../../../lib/studio/credits'
import { buildStudioContext } from '../../../../lib/studio/context'

const OPENAI_KEY = process.env.OPENAI_API_KEY
const FAL_KEY = process.env.FAL_KEY
const json = (d, s = 200) => NextResponse.json(d, { status: s })

// Potenzia la descrizione in un prompt VIDEO (soggetto + movimento + camera).
async function enhanceVideoPrompt(userPrompt, fromImage, contextBlock) {
  if (!OPENAI_KEY) return userPrompt
  try {
    const ctx = contextBlock ? `\n\nCLIENT CONTEXT (brand/products/what converts):\n${contextBlock}` : ''
    const sys = fromImage
      ? 'You write motion prompts for image-to-video models. Given the user request, output ONE concise English prompt describing the MOTION, camera movement and atmosphere to animate the given still image. No preamble.'
      : 'You write prompts for text-to-video models. Output ONE concise, vivid English prompt: subject, action/motion, camera movement, lighting, mood. Keep brand/product faithful. No preamble.'
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: `${userPrompt}${ctx}` },
        ],
        temperature: 0.7, max_tokens: 200,
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return userPrompt
    const d = await res.json()
    return d.choices?.[0]?.message?.content?.trim() || userPrompt
  } catch { return userPrompt }
}

function aspectFor(fmt) {
  return fmt === 'vertical' ? '9:16' : fmt === 'landscape' ? '16:9' : '1:1'
}

async function genVideoFal(endpoint, prompt, aspect, imageUrl) {
  if (!FAL_KEY) return { error: 'FAL_KEY non configurata su Vercel.' }
  const body = { prompt, aspect_ratio: aspect, ...(imageUrl ? { image_url: imageUrl } : {}) }
  try {
    const res = await fetch(`https://fal.run/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${FAL_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(290000),
    })
    if (!res.ok) {
      const t = await res.text()
      return { error: `Video ${res.status}: ${t.slice(0, 200)}` }
    }
    const d = await res.json()
    const url = d.video?.url || d.video_url || d.output?.video?.url || d.videos?.[0]?.url || null
    return url ? { url } : { error: 'Nessun video restituito' }
  } catch (e) { return { error: e.message } }
}

export async function POST(req) {
  const user = await getAuthUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)

  let body
  try { body = await req.json() } catch { return json({ error: 'Body non valido' }, 400) }

  const mode = body?.mode === 'image' ? 'image' : 'text'
  const rawPrompt = (body?.prompt || '').trim()
  const imageUrl = (body?.imageUrl || '').trim()

  if (mode === 'image' && !imageUrl) return json({ error: 'Serve un\'immagine di partenza' }, 400)
  if (mode === 'text' && !rawPrompt) return json({ error: 'Descrivi il video da generare' }, 400)

  const model = getVideoModel(body?.model) || getVideoModel('luma-ray2-flash')
  const endpoint = mode === 'image' ? model.i2v : model.t2v
  const aspect = aspectFor(body?.format)
  const cost = model.credits

  // 1) Scala i crediti (atomico) PRIMA di generare
  const ref = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const spend = await spendCredits(user.id, cost, model.id, ref)
  if (!spend.ok) {
    if (spend.error === 'insufficient') return json({ error: 'insufficient_credits', balance: spend.balance, needed: cost }, 402)
    return json({ error: 'Errore crediti: ' + (spend.error || 'sconosciuto') }, 500)
  }

  // 2) Potenzia il prompt (grounded sul cliente) e genera
  let prompt = rawPrompt
  if (rawPrompt && body?.enhance !== false) {
    const origin = req.headers.get('origin') || (req.headers.get('host') ? `https://${req.headers.get('host')}` : '')
    const cookie = req.headers.get('cookie') || ''
    let contextBlock = ''
    try { contextBlock = (await buildStudioContext({ origin, cookie })).contextBlock } catch {}
    prompt = await enhanceVideoPrompt(rawPrompt, mode === 'image', contextBlock)
  }

  const result = await genVideoFal(endpoint, prompt || 'cinematic motion', aspect, mode === 'image' ? imageUrl : null)

  // 3) Rimborso se fallisce
  if (result.error || !result.url) {
    const balance = await addCredits(user.id, cost, 'refund', ref, model.id)
    return json({ error: result.error || 'Generazione video fallita', balance }, 502)
  }

  return json({
    video: { url: result.url },
    prompt, mode,
    model: model.id, modelName: model.name,
    format: body?.format || 'square',
    creditsSpent: cost,
    balance: spend.balance,
    generatedAt: new Date().toISOString(),
  })
}
