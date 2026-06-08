// Progetti/Board del Creative Studio (stile Luma). Tutte le scritture passano
// dall'admin client (service role) lato server.
import { getAdminSupabase } from '../supabase/server'

// Lista board dell'utente con copertina (ultime immagini) e conteggio.
export async function listBoards(userId) {
  const admin = getAdminSupabase()
  if (!admin) return []
  const { data: boards } = await admin.from('studio_boards')
    .select('id, title, created_at, updated_at')
    .eq('user_id', userId).order('updated_at', { ascending: false })
  if (!boards?.length) return []
  // Copertine: ultime 4 immagini per board (query unica, raggruppo lato server).
  const ids = boards.map(b => b.id)
  const { data: gens } = await admin.from('studio_generations')
    .select('board_id, url, type, created_at')
    .in('board_id', ids).eq('status', 'done').eq('type', 'image')
    .order('created_at', { ascending: false }).limit(400)
  const covers = {}, counts = {}
  for (const g of gens || []) {
    counts[g.board_id] = (counts[g.board_id] || 0) + 1
    if (!covers[g.board_id]) covers[g.board_id] = []
    if (covers[g.board_id].length < 4) covers[g.board_id].push(g.url)
  }
  return boards.map(b => ({ ...b, covers: covers[b.id] || [], count: counts[b.id] || 0 }))
}

export async function createBoard(userId, title) {
  const admin = getAdminSupabase()
  if (!admin) return null
  const { data } = await admin.from('studio_boards')
    .insert({ user_id: userId, title: (title || '').trim() || 'Senza titolo' })
    .select().maybeSingle()
  return data || null
}

export async function renameBoard(userId, id, title) {
  const admin = getAdminSupabase()
  if (!admin) return null
  const { data } = await admin.from('studio_boards')
    .update({ title: (title || '').trim() || 'Senza titolo', updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', userId).select().maybeSingle()
  return data || null
}

export async function deleteBoard(userId, id) {
  const admin = getAdminSupabase()
  if (!admin) return false
  const { error } = await admin.from('studio_boards').delete().eq('id', id).eq('user_id', userId)
  return !error
}

// Verifica che la board appartenga all'utente (per associare le generazioni).
export async function ownsBoard(userId, id) {
  if (!id) return false
  const admin = getAdminSupabase()
  if (!admin) return false
  const { data } = await admin.from('studio_boards').select('id').eq('id', id).eq('user_id', userId).maybeSingle()
  return !!data
}

// Aggiorna updated_at della board (quando ci si genera dentro).
export async function touchBoard(id) {
  const admin = getAdminSupabase()
  if (!admin || !id) return
  try { await admin.from('studio_boards').update({ updated_at: new Date().toISOString() }).eq('id', id) } catch {}
}
