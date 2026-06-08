// Modelli AI addestrati (LoRA). Scritture via admin client (service role).
import { getAdminSupabase } from '../supabase/server'

export async function listModels(userId) {
  const admin = getAdminSupabase()
  if (!admin) return []
  const { data } = await admin.from('studio_models')
    .select('id, name, kind, trigger_word, status, lora_url, thumb_url, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false })
  return data || []
}

export async function createModel(row) {
  const admin = getAdminSupabase()
  if (!admin) return null
  const { data } = await admin.from('studio_models').insert(row).select().maybeSingle()
  return data || null
}

export async function getModel(id, userId) {
  const admin = getAdminSupabase()
  if (!admin) return null
  const { data } = await admin.from('studio_models').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
  return data || null
}

export async function updateModel(id, patch) {
  const admin = getAdminSupabase()
  if (!admin) return null
  const { data } = await admin.from('studio_models').update(patch).eq('id', id).select().maybeSingle()
  return data || null
}

export async function deleteModel(userId, id) {
  const admin = getAdminSupabase()
  if (!admin) return false
  const { error } = await admin.from('studio_models').delete().eq('id', id).eq('user_id', userId)
  return !error
}

// Conferma che la LoRA appartiene all'utente ed è pronta (per l'inferenza).
export async function getReadyLora(userId, id) {
  if (!id) return null
  const m = await getModel(id, userId)
  return m && m.status === 'ready' && m.lora_url ? m : null
}
