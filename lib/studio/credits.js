// Helper crediti server-side. Usano l'admin client (service role) per
// invocare le RPC atomiche spend_credits / add_credits.
// Mai esporre l'admin client al browser.
import { getServerSupabase, getAdminSupabase } from '../supabase/server'

// Utente loggato corrente (auth). Ritorna { id, email } o null.
export async function getAuthUser() {
  try {
    const sb = getServerSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return null
    return { id: user.id, email: user.email }
  } catch {
    return null
  }
}

export async function getBalance(userId) {
  const admin = getAdminSupabase()
  if (!admin || !userId) return 0
  const { data } = await admin.from('ai_credits').select('balance').eq('user_id', userId).maybeSingle()
  return data?.balance ?? 0
}

export async function getHistory(userId, limit = 25) {
  const admin = getAdminSupabase()
  if (!admin || !userId) return []
  const { data } = await admin
    .from('credit_transactions')
    .select('id, delta, reason, model, balance_after, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

// Scala in modo atomico. Ritorna { ok, balance } — ok=false se insufficienti.
export async function spendCredits(userId, amount, model, ref) {
  const admin = getAdminSupabase()
  if (!admin || !userId) return { ok: false, balance: 0, error: 'no_admin' }
  const { data, error } = await admin.rpc('spend_credits', {
    p_user: userId, p_amount: amount, p_model: model || null, p_ref: ref || null,
  })
  if (error) return { ok: false, balance: 0, error: error.message }
  if (data === -1) return { ok: false, balance: await getBalance(userId), error: 'insufficient' }
  return { ok: true, balance: data }
}

// Accredita (rimborso/grant/acquisto). Ritorna nuovo saldo.
export async function addCredits(userId, amount, reason = 'grant', ref = null, model = null) {
  const admin = getAdminSupabase()
  if (!admin || !userId) return 0
  const { data, error } = await admin.rpc('add_credits', {
    p_user: userId, p_amount: amount, p_reason: reason, p_ref: ref, p_model: model,
  })
  if (error) return await getBalance(userId)
  return data
}
