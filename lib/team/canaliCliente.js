// ============================================================================
//  Che negozio e' questo cliente, letto una volta per richiesta dalle route.
//
//  I canali di vendita che tiene fuori dai conti di efficienza. Sul fork era una costante: il
//  canale dei marketplace di QUEL negozio, scritto nel codice. In un SaaS non puo' esserlo — ogni
//  negozio ha i suoi canali, e chi non vende su nessun marketplace non deve subire nessun filtro.
//
//  REGOLA: elenco vuoto = NESSUNA esclusione. E' anche il ripiego quando la colonna non esiste
//  ancora (migrazione non eseguita) o la lettura fallisce: meglio contare tutto, come si e' sempre
//  fatto, che togliere righe di nascosto.
//
//  L'etichetta delle campagne dei negozi fisici (Drive to Store) segue la stessa regola: esiste
//  solo per chi ha dichiarato negozi fisici. Senza, nessuna campagna si toglie dai conti — vedi
//  lib/ads/driveToStore.js.
//
//  Si legge una volta per richiesta e si passa in giro: non e' un dato che cambia mentre si calcola.
// ============================================================================
import { getTenantInfo } from '../tenant/credentials'
import { getAdminSupabase } from '../supabase/server'
import { tipoNegozio } from './tipoNegozio'

// Il profilo del negozio del tenant corrente. In errore (o senza workspace) torna il profilo
// "tutto spento" di tipoNegozio({}): nessun canale escluso, nessun negozio fisico.
export async function negozioDelCliente() {
  try {
    const ws = getTenantInfo()?.userId
    if (!ws) return tipoNegozio({})
    const { data } = await getAdminSupabase()
      .from('companies')
      .select('multimarca, marchi_rilevati, quota_primo_marchio, canali_esclusi, negozi_fisici, etichetta_negozi_fisici')
      .eq('user_id', ws)
      .maybeSingle()
    return tipoNegozio(data || {})
  } catch {
    return tipoNegozio({})
  }
}

export async function canaliEsclusiDelCliente() {
  return (await negozioDelCliente()).canaliEsclusi
}

// La parola che riconosce le campagne dei negozi fisici nel nome, oppure null.
// null = il cliente non ha negozi fisici: non si esclude NESSUNA campagna.
export function etichettaDi(negozio) {
  if (!negozio?.negoziFisici) return null
  return negozio.etichettaNegoziFisici || 'drive to store'
}

export async function etichettaDelCliente() {
  return etichettaDi(await negozioDelCliente())
}
