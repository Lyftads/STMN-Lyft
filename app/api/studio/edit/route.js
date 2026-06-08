export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 180

import { NextResponse } from 'next/server'
import { EDIT_CREDITS, EDIT_FAL } from '../../../../lib/studio/models'
import { getAuthUser, spendCredits, addCredits } from '../../../../lib/studio/credits'
import { persistMedia, saveGeneration } from '../../../../lib/studio/persist'
import { ownsBoard, touchBoard } from '../../../../lib/studio/boards'

const FAL_KEY = process.env.FAL_KEY
const json = (d, s = 200) => NextResponse.json(d, { status: s })
const aspectFor = (f) => f === 'vertical' ? '9:16' : f === 'landscape' ? '16:9' : '1:1'

// POST { imageUrl, mode:'edit'|'reframe', instruction?, format? }
// edit  → FLUX Kontext (immagine + istruzione testuale)
// reframe → cambia il formato mantenendo il soggetto (outpaint)
export async function POST(req) {
  const user = await getAuthUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)
  if (!FAL_KEY) return json({ error: 'FAL_KEY non configurata su Vercel.' }, 500)

  let body
  try { body = await req.json() } catch { return json({ error: 'Body non valido' }, 400) }

  const imageUrl = (body?.imageUrl || '').trim()
  if (!imageUrl) return json({ error: 'Immagine mancante' }, 400)
  const mode = body?.mode === 'reframe' ? 'reframe' : 'edit'
  const instruction = (body?.instruction || '').trim()
  if (mode === 'edit' && !instruction) return json({ error: 'Descrivi la modifica' }, 400)

  const cost = EDIT_CREDITS
  const ref = `edit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const spend = await spendCredits(user.id, cost, mode, ref)
  if (!spend.ok) {
    if (spend.error === 'insufficient') return json({ error: 'insufficient_credits', balance: spend.balance, needed: cost }, 402)
    return json({ error: 'Errore crediti: ' + (spend.error || 'sconosciuto') }, 500)
  }

  const endpoint = mode === 'reframe' ? EDIT_FAL.reframe : EDIT_FAL.edit
  const reqBody = mode === 'reframe'
    ? { image_url: imageUrl, aspect_ratio: aspectFor(body?.format) }
    : { prompt: instruction, image_url: imageUrl }

  let resultUrl = null, errMsg = null
  try {
    const res = await fetch(`https://fal.run/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${FAL_KEY}` },
      body: JSON.stringify(reqBody),
      signal: AbortSignal.timeout(150000),
    })
    if (!res.ok) errMsg = `Edit ${res.status}: ${(await res.text()).slice(0, 180)}`
    else {
      const d = await res.json()
      resultUrl = d.images?.[0]?.url || d.image?.url || null
      if (!resultUrl) errMsg = 'Nessuna immagine modificata'
    }
  } catch (e) { errMsg = e.message }

  if (!resultUrl) {
    const balance = await addCredits(user.id, cost, 'refund', ref, mode)
    return json({ error: errMsg || 'Modifica fallita', balance }, 502)
  }

  const boardId = (body?.boardId && await ownsBoard(user.id, body.boardId)) ? body.boardId : null
  const url = await persistMedia(user.id, resultUrl, 'image')
  const fmt = mode === 'reframe' ? (body?.format || 'square') : (body?.srcFormat || 'square')
  await saveGeneration({
    user_id: user.id, type: 'image', status: 'done', url,
    model: mode, model_name: mode === 'reframe' ? 'Reframe' : 'Edit',
    prompt: instruction || `reframe ${fmt}`, format: fmt, source: 'edit', ref, credits: cost, board_id: boardId,
  })
  if (boardId) await touchBoard(boardId)

  return json({ image: { url }, format: fmt, balance: spend.balance, creditsSpent: cost })
}
