export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 180

import { NextResponse } from 'next/server'
import { TRYON_CREDITS, TRYON_FAL } from '../../../../lib/studio/models'
import { getAuthUser, spendCredits, addCredits } from '../../../../lib/studio/credits'
import { persistMedia, saveGeneration } from '../../../../lib/studio/persist'

const FAL_KEY = process.env.FAL_KEY
const json = (d, s = 200) => NextResponse.json(d, { status: s })

// POST { modelImage, garmentImage, category } — prodotto indossato su un modello
// (FASHN virtual try-on). modelImage = foto persona, garmentImage = prodotto/capo.
export async function POST(req) {
  const user = await getAuthUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)
  if (!FAL_KEY) return json({ error: 'FAL_KEY non configurata su Vercel.' }, 500)

  let body
  try { body = await req.json() } catch { return json({ error: 'Body non valido' }, 400) }
  const modelImage = (body?.modelImage || '').trim()
  const garmentImage = (body?.garmentImage || '').trim()
  if (!modelImage || !garmentImage) return json({ error: 'Servono la foto del modello e quella del prodotto' }, 400)

  const cost = TRYON_CREDITS
  const ref = `tryon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const spend = await spendCredits(user.id, cost, 'tryon', ref)
  if (!spend.ok) {
    if (spend.error === 'insufficient') return json({ error: 'insufficient_credits', balance: spend.balance, needed: cost }, 402)
    return json({ error: 'Errore crediti: ' + (spend.error || 'sconosciuto') }, 500)
  }

  let resultUrl = null, errMsg = null
  try {
    const res = await fetch(`https://fal.run/${TRYON_FAL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${FAL_KEY}` },
      body: JSON.stringify({ model_image: modelImage, garment_image: garmentImage, category: body?.category || 'auto', mode: 'quality' }),
      signal: AbortSignal.timeout(150000),
    })
    if (!res.ok) errMsg = `Try-on ${res.status}: ${(await res.text()).slice(0, 180)}`
    else {
      const d = await res.json()
      resultUrl = d.images?.[0]?.url || d.image?.url || null
      if (!resultUrl) errMsg = 'Nessun risultato'
    }
  } catch (e) { errMsg = e.message }

  if (!resultUrl) {
    const balance = await addCredits(user.id, cost, 'refund', ref, 'tryon')
    return json({ error: errMsg || 'Try-on fallito', balance }, 502)
  }

  const url = await persistMedia(user.id, resultUrl, 'image')
  await saveGeneration({ user_id: user.id, type: 'image', status: 'done', url, model: 'tryon', model_name: 'Try-On', prompt: 'virtual try-on', format: 'portrait', source: 'tryon', ref, credits: cost })
  return json({ image: { url }, balance: spend.balance, creditsSpent: cost })
}
