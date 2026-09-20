// ============================================================================
//  LE IMPOSTAZIONI DEL CLIENTE che il pilota deve rispettare.
//
//  Sul fork il negozio era uno solo e certe cose stavano scritte nel codice: il canale dei
//  marketplace («Koongo: Sell on Marketplaces») era una costante, e ogni conto lo toglieva
//  sempre. Qui i negozi sono tanti: quel nome e' la convenzione di UN cliente, e applicarlo a
//  tutti vorrebbe dire o non togliere niente (nel migliore dei casi) o togliere a caso il
//  fatturato di un canale che si chiama per caso allo stesso modo.
//
//  REGOLA: l'elenco si legge dal cliente (companies.canali_esclusi, vedi lib/team/tipoNegozio.js
//  e supabase/tipo_negozio.sql) e, se e' vuoto, NON si filtra niente. Vuoto non e' un guasto:
//  e' la risposta giusta per chi non vende sui marketplace, cioe' quasi tutti.
//
//  Se la migrazione non e' ancora passata, Supabase manda l'intera select in errore: si torna
//  "tutto spento", che e' lo stesso ripiego di /api/integrations/status. Nessuno perde una
//  funzione che oggi non ha.
// ============================================================================
import { getAdminSupabase } from '../supabase/server'
import { tipoNegozio } from '../team/tipoNegozio'

// Cache cortissima per non rifare la stessa lettura a ogni chiamata interna dello stesso giro
// (il pilota tocca la riga due volte: traiettoria e rigioca). Per workspace, mai condivisa.
const memoria = new Map()
const VITA = 60_000

export async function impostazioniCliente(ws) {
  if (!ws) return tipoNegozio({})
  const hit = memoria.get(ws)
  if (hit && hit.fino > Date.now()) return hit.dato
  let dato = tipoNegozio({})
  try {
    const admin = getAdminSupabase()
    if (admin) {
      const { data } = await admin
        .from('companies')
        .select('multimarca, marchi_rilevati, quota_primo_marchio, canali_esclusi, negozi_fisici, etichetta_negozi_fisici')
        .eq('user_id', ws)
        .maybeSingle()
      dato = tipoNegozio(data || {})
    }
  } catch { /* colonne non ancora create, o DB muto: resta "tutto spento" */ }
  memoria.set(ws, { dato, fino: Date.now() + VITA })
  return dato
}

// Solo i canali da escludere: e' quello che serve quasi sempre.
export async function canaliEsclusiCliente(ws) {
  return (await impostazioniCliente(ws)).canaliEsclusi || []
}
