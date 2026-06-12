// Cache L2 condivisa su Supabase (cross-lambda): la prima richiesta calcola e
// salva lo snapshot, tutte le altre lo leggono in pochi ms anche da un'altra
// istanza serverless. Per-tenant (workspace_id). TTL passato dal chiamante.

import { getAdminSupabase } from '../supabase/server'

export async function getSnapshot(workspaceId, tab, maxAgeMs) {
  const admin = getAdminSupabase()
  if (!admin || !workspaceId) return null
  try {
    const { data } = await admin.from('tab_snapshots').select('payload, updated_at').eq('workspace_id', workspaceId).eq('tab', tab).maybeSingle()
    if (!data) return null
    if (maxAgeMs && Date.now() - new Date(data.updated_at).getTime() > maxAgeMs) return null
    return data.payload
  } catch { return null }
}

export async function setSnapshot(workspaceId, tab, payload) {
  const admin = getAdminSupabase()
  if (!admin || !workspaceId) return
  try {
    await admin.from('tab_snapshots').upsert({ workspace_id: workspaceId, tab, payload, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,tab' })
  } catch {}
}
