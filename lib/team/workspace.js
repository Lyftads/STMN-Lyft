import { getAdminSupabase } from '../supabase/server'
import { getCurrentUserId, getEffectiveTenantId } from '../tenant/credentials'

// Risolve il workspace (= owner user_id) e il contesto-membro dell'utente loggato.
// Lo usano i moduli Team/Task/Chat/Performance/Inventario/Actions per scoprire
// SU QUALE workspace operare.
//
// - Owner sul proprio workspace: workspace = proprio user_id, ruolo admin.
// - Agency switchata su un cliente (cookie active_workspace): workspace = quel
//   cliente, ruolo admin → Team/Task/Chat/Performance mostrano i dati del CLIENTE,
//   non quelli dell'owner (STMN). getEffectiveTenantId fa la verifica anti-leak.
// - Membro attivo di un workspace altrui: workspace = owner_user_id dalla riga
//   team_members, ruoli dalla stessa riga.
//
// Best-effort: se la tabella non esiste o il DB non è disponibile, degrada a
// "owner del proprio workspace" senza rompere nulla.
export async function resolveWorkspace() {
  const userId = await getCurrentUserId()
  if (!userId) return null

  // Tenant EFFETTIVO: rispetta active_workspace (agency switchata su un cliente).
  // PRIMA si usava sempre userId (= owner) → tutte le route Team/Performance/
  // Inventario/Actions leggevano i dati dell'owner anche dentro un workspace
  // cliente (leak STMN). Vedi stesso fix in lib/cache/swr.js.
  let effectiveId = userId
  try { effectiveId = (await getEffectiveTenantId()) || userId } catch {}

  const ownerCtx = {
    userId,
    workspaceId: effectiveId,
    roles: ['admin'],
    isAdmin: true,
    memberId: null,
  }

  // Agency dentro un workspace cliente (effectiveId ≠ proprio uid): opera come
  // admin di QUEL workspace. NON guardare team_members dell'agency (punterebbe al
  // suo workspace = il leak che stiamo chiudendo).
  if (effectiveId !== userId) return ownerCtx

  const admin = getAdminSupabase()
  if (!admin) return ownerCtx

  try {
    const { data: m } = await admin
      .from('team_members')
      .select('id, workspace_id, roles, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (m && m.workspace_id) {
      const roles = Array.isArray(m.roles) ? m.roles : []
      const isOwner = m.workspace_id === userId
      return {
        userId,
        workspaceId: m.workspace_id,
        roles,
        isAdmin: isOwner || roles.includes('admin'),
        memberId: m.id,
      }
    }
  } catch {
    // tabella assente o errore → owner del proprio workspace
  }

  return ownerCtx
}
