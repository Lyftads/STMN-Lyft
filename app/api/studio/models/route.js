export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAuthUser } from '../../../../lib/studio/credits'
import { listModels, deleteModel } from '../../../../lib/studio/trainedModels'

const json = (d, s = 200) => NextResponse.json(d, { status: s })

// GET /api/studio/models → modelli AI addestrati dell'utente
export async function GET() {
  const user = await getAuthUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)
  return json({ models: await listModels(user.id) })
}

// DELETE /api/studio/models { id }
export async function DELETE(req) {
  const user = await getAuthUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)
  let body; try { body = await req.json() } catch { body = {} }
  if (!body?.id) return json({ error: 'id mancante' }, 400)
  const ok = await deleteModel(user.id, body.id)
  return ok ? json({ ok: true }) : json({ error: 'Impossibile eliminare' }, 500)
}
