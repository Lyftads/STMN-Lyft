export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getVideoModel } from '../../../../lib/studio/models'
import { getAuthUser, spendCredits, addCredits } from '../../../../lib/studio/credits'
import { buildStudioContext } from '../../../../lib/studio/context'
import { createPendingVideo } from '../../../../lib/studio/persist'

const OPENAI_KEY = process.env.OPENAI_API_KEY
const FAL_KEY = process.env.FAL_KEY
const json = (d, s = 200) => NextResponse.json(d, { status: s })

async function enhanceVideoPrompt(userPrompt, fromImage, contextBlock, style) {
  if (!OPENAI_KEY) return userPrompt
  try {
    const ctx = contextBlock ? `\n\nCLIENT CONTEXT (brand/products/what converts):\n${contextBlock}` : ''
    const st = style ? `\nStyle: ${style}` : ''
    const sys = fromImage
      ? 'You write motion prompts for image-to-video models. Given the user request, output ONE concise English prompt describing the MOTION, camera movement and atmosphere to animate the given still image. No preamble.'
      : 'You write prompts for text-to-video models. Output ONE concise, vivid English prompt: subject, action/motion, camera movement, lighting, mood. Keep brand/product faithful. No preamble.'
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: sys }, { role: 'user', content: `${userPrompt}${st}${ctx}` }], temperature: 0.7, max_tokens: 200 }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return userPrompt
    const d = await res.json()
    return d.choices?.[0]?.message?.content?.trim() || userPrompt
  } catch { return userPrompt }
}

const aspectFor = (fmt) => fmt === 'vertical' ? '9:16' : fmt === 'landscape' ? '16:9' : '1:1'

// Submit alla CODA fal (async). Ritorna gli URL di polling o un errore.
async function submitVideoFal(endpoint, prompt, aspect, imageUrl) {
  if (!FAL_KEY) return { error: 'FAL_KEY non configurata su Vercel.' }
  const body = { prompt, aspect_ratio: aspect, ...(imageUrl ? { image_url: imageUrl } : {}) }
  try {
    const res = await fetch(`https://queue.fal.run/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${FAL_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(40000),
    })
    if (!res.ok) {
      const t = await res.text()
      return { error: `Video ${res.status}: ${t.slice(0, 200)}` }
    }
    const d = await res.json()
    if (!d.status_url || !d.response_url) return { error: 'Coda fal: risposta inattesa' }
    return { statusUrl: d.status_url, responseUrl: d.response_url }
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

  // 1) Scala i crediti (atomico)
  const ref = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const spend = await spendCredits(user.id, cost, model.id, ref)
  if (!spend.ok) {
    if (spend.error === 'insufficient') return json({ error: 'insufficient_credits', balance: spend.balance, needed: cost }, 402)
    return json({ error: 'Errore crediti: ' + (spend.error || 'sconosciuto') }, 500)
  }

  // 2) Potenzia il prompt (grounded) e submit alla coda
  let prompt = rawPrompt
  if (rawPrompt && body?.enhance !== false) {
    const origin = req.headers.get('origin') || (req.headers.get('host') ? `https://${req.headers.get('host')}` : '')
    const cookie = req.headers.get('cookie') || ''
    let contextBlock = ''
    try { contextBlock = (await buildStudioContext({ origin, cookie })).contextBlock } catch {}
    prompt = await enhanceVideoPrompt(rawPrompt, mode === 'image', contextBlock, body?.style)
  }

  const sub = await submitVideoFal(endpoint, prompt || 'cinematic motion', aspect, mode === 'image' ? imageUrl : null)
  if (sub.error) {
    const balance = await addCredits(user.id, cost, 'refund', ref, model.id)
    return json({ error: sub.error, balance }, 502)
  }

  // 3) Crea la generazione in stato pending (il client farà polling)
  const gen = await createPendingVideo({
    user_id: user.id, model: model.id, model_name: model.name, prompt,
    format: body?.format || 'square', source: mode, ref, credits: cost,
    fal_status_url: sub.statusUrl, fal_response_url: sub.responseUrl,
  })

  return json({
    generationId: gen?.id || null,
    status: 'pending',
    model: model.id, modelName: model.name,
    format: body?.format || 'square', mode,
    creditsSpent: cost, balance: spend.balance,
  })
}
