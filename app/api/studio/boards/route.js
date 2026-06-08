export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAuthUser } from '../../../../lib/studio/credits'
import { listBoards, createBoard, renameBoard, deleteBoard } from '../../../../lib/studio/boards'

const json = (d, s = 200) => NextResponse.json(d, { status: s })

// GET /api/studio/boards → lista progetti dell'utente (con copertine)
export async function GET() {
  const user = await getAuthUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)
  return json({ boards: await listBoards(user.id) })
}

// POST /api/studio/boards { title } → crea progetto
export async function POST(req) {
  const user = await getAuthUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)
  let body; try { body = await req.json() } catch { body = {} }
  const board = await createBoard(user.id, body?.title)
  if (!board) return json({ error: 'Impossibile creare il progetto' }, 500)
  return json({ board })
}

// PATCH /api/studio/boards { id, title } → rinomina
export async function PATCH(req) {
  const user = await getAuthUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)
  let body; try { body = await req.json() } catch { body = {} }
  if (!body?.id) return json({ error: 'id mancante' }, 400)
  const board = await renameBoard(user.id, body.id, body.title)
  if (!board) return json({ error: 'Impossibile rinominare' }, 500)
  return json({ board })
}

// DELETE /api/studio/boards { id } → elimina (cascade sulle generazioni)
export async function DELETE(req) {
  const user = await getAuthUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)
  let body; try { body = await req.json() } catch { body = {} }
  if (!body?.id) return json({ error: 'id mancante' }, 400)
  const ok = await deleteBoard(user.id, body.id)
  return ok ? json({ ok: true }) : json({ error: 'Impossibile eliminare' }, 500)
}
