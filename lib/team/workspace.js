import { getAdminSupabase } from '../supabase/server'
import { getCurrentUserId } from '../tenant/credentials'

// Risolve il workspace (= owner user_id) e il contesto-membro dell'utente loggato.
// ISOLATO dal resolver tenant globale (lib/tenant/credentials): lo usa SOLO il
// modulo Team/Task, così non tocca le route dati esistenti.
//
// - Owner (unico caso oggi in produzione): workspace = proprio user_id, ruolo admin.
// - Membro attivo di un workspace altrui (esisterà dalla Fase 2): workspace =
//   owner_user_id dalla sua riga team_members, ruoli dalla stessa riga.
//
// Best-effort: se la tabella non esiste o il DB non è disponibile, degrada a
// "owner del proprio workspace" senza rompere nulla.
export async function resolveWorkspace() {
  const userId = await getCurrentUserId()
  if (!userId) return null

  // Fallback: utente senza riga team_members → è l'owner del proprio workspace
  // (caso unico in produzione oggi; la sua riga 'admin' viene creata al primo
  // accesso al modulo Team da /api/team-members).
  const ownerCtx = {
    userId,
    workspaceId: userId,
    roles: ['admin'],
    isAdmin: true,
    memberId: null,
  }

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
