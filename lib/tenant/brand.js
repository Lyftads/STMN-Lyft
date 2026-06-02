import { getServerSupabase, getAdminSupabase } from '../supabase/server'

// ============================================================================
//  Brand Identity helper — leggi companies.brand_identity per route che
//  vogliono personalizzare comportamento per-tenant (system prompt agent,
//  competitor list, creative tools).
//
//  IMPORTANTE: separato da credentials.js perche' brand identity non e'
//  gated dal flag LYFT_MULTI_TENANT — e' funzionalita' per-user che deve
//  sempre essere disponibile (anche per il tenant beta STMN). Defensivo
//  on Supabase errors → ritorna null → caller fallback su default
//  hardcoded.
// ============================================================================

const cache = new Map() // userId → { value, expiresAt }
const TTL_MS = 5 * 60_000

async function currentUserId() {
  try {
    const sb = getServerSupabase()
    const { data: { user } } = await sb.auth.getUser()
    return user?.id || null
  } catch {
    return null
  }
}

// Ritorna l'oggetto brand_identity completo per l'utente corrente, oppure
// null se non autenticato / errore DB.
export async function getBrandIdentity() {
  const userId = await currentUserId()
  if (!userId) return null

  const hit = cache.get(userId)
  if (hit && hit.expiresAt > Date.now()) return hit.value

  const admin = getAdminSupabase()
  if (!admin) return null

  try {
    const { data, error } = await admin
      .from('companies')
      .select('brand_identity, company_name')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      console.log('[brand] fetch error:', error.message)
      cache.set(userId, { value: null, expiresAt: Date.now() + TTL_MS })
      return null
    }
    const value = {
      companyName: data?.company_name || null,
      ...((data?.brand_identity && typeof data.brand_identity === 'object') ? data.brand_identity : {}),
    }
    cache.set(userId, { value, expiresAt: Date.now() + TTL_MS })
    return value
  } catch (e) {
    console.log('[brand] fetch threw:', e?.message || e)
    cache.set(userId, { value: null, expiresAt: Date.now() + TTL_MS })
    return null
  }
}

// Estrae i competitor configurati dall'utente, ritorna array vuoto se
// nessuno e' stato configurato. Caller decide se usare questi o cadere
// su default hardcoded.
export async function getUserCompetitors() {
  const brand = await getBrandIdentity()
  const list = brand?.competitors
  if (!Array.isArray(list) || list.length === 0) return []
  return list
    .filter(c => c && typeof c === 'object' && (c.name || c.website))
    .map(c => ({
      id: (c.id || c.name || c.website || 'competitor').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40),
      name: c.name || '',
      website: c.website || '',
      instagram: c.instagram || '',
      facebook: c.facebook || '',
      pageId: c.pageId || '',
    }))
}
