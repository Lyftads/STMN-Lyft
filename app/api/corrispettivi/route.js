export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { withTenantContext } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'
import { calcolaRegistro, periodoDelMese } from '../../../lib/fiscal/registro'

// ============================================================================
//  Registro corrispettivi e-commerce — un mese per volta.
//
//  Il calcolo sta in lib/fiscal/registro.js perche' lo usa anche l'export.
//
//  DUE SCELTE DICHIARATE, perche' sono decisioni e non dettagli tecnici:
//
//  1. Il registro include TUTTI i canali di vendita, marketplace compresi. Il
//     resto dell'app toglie i canali esclusi dal cliente (lib/team/tipoNegozio.js,
//     `canaliEsclusi`) dalle metriche di marketing, ma le vendite restano vendite
//     dell'azienda e nel registro fiscale ci vanno. Per questo qui NON si applica
//     nessun filtro di canale: il totale per canale resta solo informativo.
//
//  2. Il paese fiscale e' quello di SPEDIZIONE, con ripiego sulla FATTURAZIONE
//     quando manca: entrambe arrivano dalla stessa query ShopifyQL, quindi
//     resta una sola contabilita'. Le righe cosi' dedotte sono marcate. Solo
//     cio' che non ha nessuno dei due paesi resta in «Da verificare», e NON
//     viene ricostruito dagli ordini via Admin API: sarebbe un secondo metodo
//     di calcolo dentro lo stesso periodo.
//
//  GET ?mese=YYYY-MM
// ============================================================================

export async function GET(req) {
  return withTenantContext(req, async () => {
    const mese = new URL(req.url).searchParams.get('mese') || ''
    // Il MESE entra nella chiave di cache. swrSnapshot costruisce la chiave dai
    // parametri di "vista" che conosce (lib/cache/swr.js, KEY_PARAMS) e `mese`
    // non e' fra quelli: senza metterlo nel nome della voce, mesi diversi
    // collasserebbero sulla stessa riga di tab_snapshots e il registro di agosto
    // verrebbe servito per settembre. Normalizzato con la stessa funzione del
    // calcolo, perche' la richiesta puo' arrivare vuota (= mese corrente).
    const meseChiave = periodoDelMese(mese).mese
    return swrSnapshot(req, {
      tab: `corrispettivi@6:${meseChiave}`,
      ttlMs: 15 * 60 * 1000,
      compute: async () => {
        try { return await calcolaRegistro(mese) } catch (e) {
          return { ok: false, error: e?.message || 'Errore', __noCache: true }
        }
      },
    })
  })
}
