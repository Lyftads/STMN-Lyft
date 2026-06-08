export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getAuthUser, getBalance } from '../../../../lib/studio/credits'
import { getGeneration, completeVideo, failVideoAndRefund, persistMedia } from '../../../../lib/studio/persist'

const FAL_KEY = process.env.FAL_KEY
const json = (d, s = 200) => NextResponse.json(d, { status: s })

// GET /api/studio/video-status?id=GEN_ID — polling dello stato di un video.
// Stati: pending | done (con url) | failed (crediti rimborsati).
export async function GET(req) {
  const user = await getAuthUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return json({ error: 'id mancante' }, 400)

  const gen = await getGeneration(id, user.id)
  if (!gen) return json({ error: 'Generazione non trovata' }, 404)
  if (gen.status === 'done') return json({ status: 'done', url: gen.url })
  if (gen.status === 'failed') return json({ status: 'failed', balance: await getBalance(user.id) })

  // pending → interroga la coda fal
  if (!FAL_KEY || !gen.fal_status_url) return json({ status: 'pending' })
  try {
    const sr = await fetch(gen.fal_status_url, { headers: { Authorization: `Key ${FAL_KEY}` }, signal: AbortSignal.timeout(20000) })
    const sd = await sr.json().catch(() => ({}))
    const st = (sd.status || '').toUpperCase()

    if (st === 'COMPLETED') {
      const rr = await fetch(gen.fal_response_url, { headers: { Authorization: `Key ${FAL_KEY}` }, signal: AbortSignal.timeout(30000) })
      const rd = await rr.json().catch(() => ({}))
      const src = rd.video?.url || rd.video_url || rd.output?.video?.url || rd.videos?.[0]?.url || null
      if (!src) {
        await failVideoAndRefund(id, user.id)
        return json({ status: 'failed', balance: await getBalance(user.id) })
      }
      const url = await persistMedia(user.id, src, 'video')
      await completeVideo(id, url)
      return json({ status: 'done', url })
    }

    if (st === 'IN_QUEUE' || st === 'IN_PROGRESS') return json({ status: 'pending' })

    // qualsiasi altro stato = errore
    await failVideoAndRefund(id, user.id)
    return json({ status: 'failed', balance: await getBalance(user.id) })
  } catch {
    // errore transitorio di rete → riprova al prossimo poll
    return json({ status: 'pending' })
  }
}
