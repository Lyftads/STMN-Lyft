export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { UPSCALE_FAL, getUpscaleOption, RELIGHT_FAL, RELIGHT_CREDITS } from '../../../../lib/studio/models'
import { getAuthUser, spendCredits, addCredits } from '../../../../lib/studio/credits'
import { persistMedia, saveGeneration } from '../../../../lib/studio/persist'

const FAL_KEY = process.env.FAL_KEY
const json = (d, s = 200) => NextResponse.json(d, { status: s })

// POST { imageUrl, mode:'upscale'|'relight', scale?, prompt?, srcFormat? }
// upscale → Clarity Upscaler (Magnific-style): 2×/4× con dettaglio creativo
// relight → IC-Light v2 (Magnific Relight): riacciende la scena via prompt/Studio
export async function POST(req) {
  const user = await getAuthUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)
  if (!FAL_KEY) return json({ error: 'FAL_KEY non configurata su Vercel.' }, 500)

  let body
  try { body = await req.json() } catch { return json({ error: 'Body non valido' }, 400) }

  const imageUrl = (body?.imageUrl || '').trim()
  if (!imageUrl) return json({ error: 'Immagine mancante' }, 400)
  const mode = body?.mode === 'relight' ? 'relight' : 'upscale'
  const prompt = (body?.prompt || '').trim()
  if (mode === 'relight' && !prompt) return json({ error: 'Descrivi la luce o scegli uno Studio' }, 400)

  const opt = mode === 'upscale' ? getUpscaleOption(body?.scale) : null
  const cost = mode === 'upscale' ? opt.credits : RELIGHT_CREDITS

  const ref = `${mode}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const spend = await spendCredits(user.id, cost, mode, ref)
  if (!spend.ok) {
    if (spend.error === 'insufficient') return json({ error: 'insufficient_credits', balance: spend.balance, needed: cost }, 402)
    return json({ error: 'Errore crediti: ' + (spend.error || 'sconosciuto') }, 500)
  }

  const endpoint = mode === 'upscale' ? UPSCALE_FAL : RELIGHT_FAL
  const reqBody = mode === 'upscale'
    ? { image_url: imageUrl, upscale_factor: opt.scale, prompt: prompt || 'masterpiece, best quality, highly detailed, sharp focus, fine texture', creativity: 0.35, resemblance: 0.6 }
    : { image_url: imageUrl, prompt, enable_hr_fix: true }

  let resultUrl = null, errMsg = null
  try {
    const res = await fetch(`https://fal.run/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${FAL_KEY}` },
      body: JSON.stringify(reqBody),
      signal: AbortSignal.timeout(280000),
    })
    if (!res.ok) errMsg = `${mode} ${res.status}: ${(await res.text()).slice(0, 180)}`
    else {
      const d = await res.json()
      resultUrl = d.images?.[0]?.url || d.image?.url || null
      if (!resultUrl) errMsg = 'Nessuna immagine prodotta'
    }
  } catch (e) { errMsg = e.message }

  if (!resultUrl) {
    const balance = await addCredits(user.id, cost, 'refund', ref, mode)
    return json({ error: errMsg || 'Operazione fallita', balance }, 502)
  }

  const url = await persistMedia(user.id, resultUrl, 'image')
  const fmt = body?.srcFormat || 'square'
  await saveGeneration({
    user_id: user.id, type: 'image', status: 'done', url,
    model: mode, model_name: mode === 'upscale' ? `Upscale ${opt.label}` : 'Relight',
    prompt: prompt || (mode === 'upscale' ? `upscale ${opt.label}` : 'relight'),
    format: fmt, source: mode, ref, credits: cost,
  })

  return json({ image: { url }, format: fmt, balance: spend.balance, creditsSpent: cost })
}
