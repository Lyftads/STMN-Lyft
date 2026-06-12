// Costi landed (override manuale del costo per variante). Append-only con
// effective_from: il costo "corrente" è la riga più recente per variante.
// Usato come COGS da Inventario e Performance prodotti (sostituisce il costo
// Shopify quando esiste un override).

import { getAdminSupabase } from '../supabase/server'

// Map variant_id -> landed_cost (più recente). Vuota se tabella assente / niente override.
export async function loadLatestLanded(workspaceId) {
  const admin = getAdminSupabase()
  if (!admin || !workspaceId) return new Map()
  try {
    const { data } = await admin
      .from('product_landed_cost')
      .select('variant_id, landed_cost, effective_from, created_at')
      .eq('workspace_id', workspaceId)
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false })
    const m = new Map()
    for (const r of (data || [])) { const v = String(r.variant_id); if (!m.has(v)) m.set(v, Number(r.landed_cost)) }
    return m
  } catch { return new Map() }
}
