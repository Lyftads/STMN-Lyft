export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { TRAIN_FAL, TRAIN_CREDITS } from '../../../../lib/studio/models'
import { getAuthUser, spendCredits, addCredits } from '../../../../lib/studio/credits'
import { uploadBuffer, persistMedia } from '../../../../lib/studio/persist'
import { createModel } from '../../../../lib/studio/trainedModels'
import { buildZip, dataUrlToBuffer } from '../../../../lib/studio/zip'

const FAL_KEY = process.env.FAL_KEY
const json = (d, s = 200) => NextResponse.json(d, { status: s })

// POST { name, kind, triggerWord?, images:[dataURL...] } → avvia il training LoRA.
export async function POST(req) {
  const user = await getAuthUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)
  if (!FAL_KEY) return json({ error: 'FAL_KEY non configurata su Vercel.' }, 500)

  let body
  try { body = await req.json() } catch { return json({ error: 'Body non valido' }, 400) }

  const name = (body?.name || '').trim()
  const kind = ['product', 'character', 'style'].includes(body?.kind) ? body.kind : 'character'
  const triggerWord = (body?.triggerWord || '').trim() || undefined
  const images = Array.isArray(body?.images) ? body.images.filter(Boolean) : []
  if (!name) return json({ error: 'Dai un nome al modello' }, 400)
  if (images.length < 3) return json({ error: 'Servono almeno 3 immagini' }, 400)
  if (images.length > 20) return json({ error: 'Massimo 20 immagini' }, 400)

  // 1) Crediti (atomico)
  const ref = `train_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const spend = await spendCredits(user.id, TRAIN_CREDITS, 'train', ref)
  if (!spend.ok) {
    if (spend.error === 'insufficient') return json({ error: 'insufficient_credits', balance: spend.balance, needed: TRAIN_CREDITS }, 402)
    return json({ error: 'Errore crediti: ' + (spend.error || 'sconosciuto') }, 500)
  }

  const fail = async (msg, code = 502) => {
    const balance = await addCredits(user.id, TRAIN_CREDITS, 'refund', ref, 'train')
    return json({ error: msg, balance }, code)
  }

  // 2) Zip delle immagini → Storage
  const files = []
  images.forEach((d, i) => { const r = dataUrlToBuffer(d); if (r) files.push({ name: `img_${i}.${r.ext}`, data: r.buf }) })
  if (files.length < 3) return fail('Immagini non valide')
  const zip = buildZip(files)
  const zipUrl = await uploadBuffer(user.id, zip, 'zip', 'application/zip')
  if (!zipUrl) return fail('Upload immagini fallito')

  // 3) Submit alla coda fal (training async)
  let statusUrl, responseUrl
  try {
    const res = await fetch(`https://queue.fal.run/${TRAIN_FAL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${FAL_KEY}` },
      body: JSON.stringify({ images_data_url: zipUrl, ...(triggerWord ? { trigger_word: triggerWord } : {}), steps: 1000, create_masks: true }),
      signal: AbortSignal.timeout(40000),
    })
    if (!res.ok) return fail(`Training ${res.status}: ${(await res.text()).slice(0, 180)}`)
    const d = await res.json()
    statusUrl = d.status_url; responseUrl = d.response_url
    if (!statusUrl || !responseUrl) return fail('Coda fal: risposta inattesa')
  } catch (e) { return fail(e.message) }

  // 4) Thumb (prima immagine) + riga modello in stato training
  const thumb = await persistMedia(user.id, images[0], 'image')
  const model = await createModel({
    user_id: user.id, name, kind, trigger_word: triggerWord || null,
    status: 'training', thumb_url: thumb, ref, credits: TRAIN_CREDITS,
    fal_status_url: statusUrl, fal_response_url: responseUrl,
  })

  return json({ model, balance: spend.balance, creditsSpent: TRAIN_CREDITS })
}
