export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getAuthUser } from '../../../../lib/studio/credits'
import { persistMedia, saveGeneration } from '../../../../lib/studio/persist'

// POST { dataUrl, format } → salva una composizione (ad finita) su Storage e
// nella board. Nessun credito: la composizione è gratuita (canvas lato client).
export async function POST(req) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }
  const dataUrl = body?.dataUrl
  if (!dataUrl || !dataUrl.startsWith('data:')) return NextResponse.json({ error: 'Immagine mancante' }, { status: 400 })

  const url = await persistMedia(user.id, dataUrl, 'image')
  const format = body?.format || 'square'
  await saveGeneration({
    user_id: user.id, type: 'image', status: 'done', url,
    model: 'ad', model_name: 'Ad', prompt: body?.label || 'ad', format, source: 'compose', credits: 0,
  })
  return NextResponse.json({ image: { url }, format })
}
