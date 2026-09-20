// ============================================================================
//  Impostazioni per workspace, senza migrazioni.
//
//  Su questo progetto le SQL si eseguono a mano dall'editor di Supabase: una
//  funzione che ha bisogno di una colonna nuova non esiste finche' qualcuno non la
//  crea. Le impostazioni piccole stanno percio' in `tab_snapshots` — (workspace, tab)
//  → jsonb, che si svuota solo cancellando l'account — sotto il prefisso
//  `impostazioni:`. Non e' cache: non ha scadenza e nessuno la sovrascrive.
//
//  MULTI-CLIENTE: la chiave e' il workspace, quindi due clienti non si vedono mai
//  le impostazioni a vicenda. Senza workspace (cron anonimo, utente non loggato)
//  si ritornano i valori di partenza invece di rompere: "non configurato" e'
//  sempre meglio dei numeri di qualcun altro.
// ============================================================================
import { getSnapshotStale, setSnapshot } from './cache/snapshot'

export async function leggiImpostazioni(workspaceId, nome, predefinite = {}) {
  if (!workspaceId) return { ...predefinite }
  const r = await getSnapshotStale(workspaceId, `impostazioni:${nome}`)
  return { ...predefinite, ...(r?.payload && typeof r.payload === 'object' ? r.payload : {}) }
}

export async function scriviImpostazioni(workspaceId, nome, valori) {
  if (!workspaceId) throw new Error('workspace mancante')
  await setSnapshot(workspaceId, `impostazioni:${nome}`, valori)
}
