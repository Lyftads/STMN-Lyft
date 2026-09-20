// ============================================================================
//  I canali di vendita che questo cliente tiene fuori dai conti di efficienza.
//
//  Sul fork era una costante: il canale dei marketplace di QUEL negozio, scritto nel codice. In un
//  SaaS non puo' esserlo — ogni negozio ha i suoi canali, e chi non vende su nessun marketplace non
//  deve subire nessun filtro.
//
//  REGOLA: elenco vuoto = NESSUNA esclusione. E' anche il ripiego quando la colonna non esiste
//  ancora (migrazione non eseguita) o la lettura fallisce: meglio contare tutto, come si e' sempre
//  fatto, che togliere righe di nascosto.
//
//  Si legge una volta per richiesta e si passa in giro: non e' un dato che cambia mentre si calcola.
// ============================================================================
import { getTenantInfo } from '../tenant/credentials'
import { getAdminSupabase } from '../supabase/server'
import { tipoNegozio } from './tipoNegozio'

export async function canaliEsclusiDelCliente() {
  try {
    const ws = getTenantInfo()?.userId
    if (!ws) return []
    const { data } = await getAdminSupabase()
      .from('companies')
      .select('multimarca, marchi_rilevati, quota_primo_marchio, canali_esclusi, negozi_fisici, etichetta_negozi_fisici')
      .eq('user_id', ws)
      .maybeSingle()
    return tipoNegozio(data || {}).canaliEsclusi
  } catch {
    return []
  }
}
