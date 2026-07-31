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

  const admin = getAdminSupabase()
  if (!admin) return effectiveId === userId ? ownerCtx : null

  // effectiveId ≠ proprio uid: può essere (a) agency switchata su un cliente
  // → admin di QUEL workspace, oppure (b) MEMBRO invitato risolto al workspace
  // del proprietario → ruoli REALI dalla riga team_members. Prima i due casi
  // erano confusi e ogni membro ereditava admin (escalation: inviti, promozioni,
  // canali privati). Fix audit 31 lug.
  if (effectiveId !== userId) {
    try {
      const { data: ag } = await admin
        .from('agency_clients')
        .select('id')
        .eq('agency_user_id', userId)
        .eq('client_user_id', effectiveId)
        .maybeSingle()
      if (ag) return ownerCtx // agency verificata → admin del workspace cliente

      const { data: m } = await admin
        .from('team_members')
        .select('id, workspace_id, roles, status')
        .eq('user_id', userId)
        .eq('workspace_id', effectiveId)
        .eq('status', 'active')
        .maybeSingle()
      if (m) {
        const roles = Array.isArray(m.roles) ? m.roles : []
        return { userId, workspaceId: effectiveId, roles, isAdmin: roles.includes('admin'), memberId: m.id }
      }
    } catch {}
    // né agency né membro verificabile → nessun privilegio (fail-closed)
    return { userId, workspaceId: effectiveId, roles: [], isAdmin: false, memberId: null }
  }

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


// Collaboratore = admin/owner OPPURE membro con un ruolo operativo reale.
// I GUEST (esterni invitati solo in LyftTalk) restano sempre esclusi.
// Usato per i permessi di team che NON sono amministrativi: creare canali,
// programmare la call settimanale, approvare/eseguire azioni.
export function isCollaborator(ws) {
  if (!ws) return false
  if (ws.isAdmin) return true
  const roles = Array.isArray(ws.roles) ? ws.roles : []
  if (!roles.length) return false
  return !roles.every(r => r === 'guest')
}
