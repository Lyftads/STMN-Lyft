export const dynamic = 'force-dynamic'
export const maxDuration = 60
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'
import { oggiNegozio } from '../../../lib/periodi'
import { venditePeriodo, cogsPeriodo, feeRealiPeriodo, mixPagamenti } from '../../../lib/conto/fonti'

// ============================================================================
//  Le cifre di Shopify per l'utile netto di un periodo di giorni.
//
//  GET ?since=YYYY-MM-DD&until=YYYY-MM-DD[&mode=mix]
//
//  Qui ci sono SOLO i dati: vendite, costo dei prodotti, commissioni vere. Il
//  conto (lib/conto/utile.js) lo fa chi chiama, con le impostazioni dei costi
//  e la spesa pubblicitaria che ha gia' in mano. Due ragioni:
//   · la spesa e' la stessa cifra che la pagina mostra accanto — letta due
//     volte potrebbe non coincidere;
//   · le impostazioni dei costi si cambiano dal Conto economico, e una risposta
//     in cache col conto gia' fatto resterebbe vecchia per mezz'ora.
//  `mode=mix` aggiunge il riparto dei metodi di pagamento (serve solo a chi ha
//  commissioni da stimare: vedi serveIlMix).
// ============================================================================

const DATA = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req) {
  return withTenantContext(req, async () => {
    const sp = new URL(req.url).searchParams
    const since = sp.get('since'), until = sp.get('until')
    if (!DATA.test(since || '') || !DATA.test(until || '') || until < since) {
      return NextResponse.json({ ok: false, error: 'Periodo non valido' }, { status: 400 })
    }
    const { storeUrl, adminToken } = getShopify()
    if (!storeUrl || !adminToken) return NextResponse.json({ ok: true, configured: false })

    const range = { since, until }
    const conMix = sp.get('mode') === 'mix'
    // Un periodo che arriva a oggi si muove: vive cinque minuti, come le altre cifre di oggi.
    const aperto = until >= oggiNegozio()

    return swrSnapshot(req, { tab: 'utileNetto@1', ttlMs: aperto ? 5 * 60_000 : 30 * 60_000, compute: async () => {
      try {
        // In fila, non in parallelo: ShopifyQL strozza le raffiche.
        const vendite = await venditePeriodo(range)
        const costo = await cogsPeriodo(range)
        const [feeReale, gatewayMix] = await Promise.all([feeRealiPeriodo(range), conMix ? mixPagamenti() : null])

        // Ripiego sul costo dei prodotti solo se Shopify non l'ha saputo dire in nessuna forma.
        let cogsRatio = null
        if (costo.cogs == null) {
          try {
            const cookie = req.headers.get('cookie') || ''
            const pc = await fetch(`${new URL(req.url).origin}/api/product-costs`, { cache: 'no-store', headers: cookie ? { cookie } : {} }).then(r => r.json())
            const margine = pc?.summary?.avgMargin ?? pc?.avgMargin
            if (margine != null) cogsRatio = Math.round((1 - margine / 100) * 100) / 100
          } catch {}
        }

        const { stale: venditeVecchie, ...v } = vendite
        const corpo = {
          ok: true, configured: true, range,
          vendite: v, cogs: costo.cogs, cogsRatio, feeReale, gatewayMix,
          updatedAt: new Date().toISOString(),
        }
        // Ultimo dato buono al posto di quello fresco: si mostra, ma non si conserva
        // e il client lo richiede da solo.
        if (venditeVecchie || costo.stale) return { ...corpo, datiParziali: true, __noCache: true }
        return corpo
      } catch (err) {
        return { __noCache: true, ok: false, error: err?.message || 'Errore' }
      }
    } })
  })
}
