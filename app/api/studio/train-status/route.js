export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getAuthUser, getBalance, addCredits } from '../../../../lib/studio/credits'
import { getModel, updateModel } from '../../../../lib/studio/trainedModels'

const FAL_KEY = process.env.FAL_KEY
const json = (d, s = 200) => NextResponse.json(d, { status: s })

// GET /api/studio/train-status?id=MODEL_ID — polling dello stato del training.
export async function GET(req) {
  const user = await getAuthUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return json({ error: 'id mancante' }, 400)

  const m = await getModel(id, user.id)
  if (!m) return json({ error: 'Modello non trovato' }, 404)
  if (m.status === 'ready') return json({ status: 'ready', loraUrl: m.lora_url })
  if (m.status === 'failed') return json({ status: 'failed', balance: await getBalance(user.id) })
  if (!FAL_KEY || !m.fal_status_url) return json({ status: 'training' })

  try {
    const sr = await fetch(m.fal_status_url, { headers: { Authorization: `Key ${FAL_KEY}` }, signal: AbortSignal.timeout(20000) })
    const sd = await sr.json().catch(() => ({}))
    const st = (sd.status || '').toUpperCase()

    if (st === 'COMPLETED') {
      const rr = await fetch(m.fal_response_url, { headers: { Authorization: `Key ${FAL_KEY}` }, signal: AbortSignal.timeout(30000) })
      const rd = await rr.json().catch(() => ({}))
      const loraUrl = rd.diffusers_lora_file?.url || rd.lora_file?.url || rd.lora?.url || null
      if (!loraUrl) {
        await updateModel(id, { status: 'failed' })
        await addCredits(user.id, m.credits || 0, 'refund', m.ref, 'train')
        return json({ status: 'failed', balance: await getBalance(user.id) })
      }
      await updateModel(id, { status: 'ready', lora_url: loraUrl })
      return json({ status: 'ready', loraUrl })
    }

    if (st === 'IN_QUEUE' || st === 'IN_PROGRESS') return json({ status: 'training' })

    await updateModel(id, { status: 'failed' })
    await addCredits(user.id, m.credits || 0, 'refund', m.ref, 'train')
    return json({ status: 'failed', balance: await getBalance(user.id) })
  } catch {
    return json({ status: 'training' })
  }
}
