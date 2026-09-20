export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { withTenantContext } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'
import { shopifyql } from '../../../lib/shopify/shopifyql'
import { oggiNegozio } from '../../../lib/periodi'

// ============================================================================
//  Sessioni per sede NEL PERIODO scelto sulla Dashboard.
//  Prima la scheda "Sessioni per sede" mostrava solo chi e' sul sito ADESSO, qualunque periodo si
//  scegliesse (Marino, 19 set: "se cambio il timeframe non cambiano"). Ora legge Shopify Analytics
//  sullo stesso intervallo degli altri riquadri. Dove Shopify non conosce la citta' resta il paese.
// ============================================================================
const DATA = /^\d{4}-\d{2}-\d{2}$/
export async function GET(req) {
  return withTenantContext(req, async () => {
    const p = new URL(req.url).searchParams, oggi = oggiNegozio()
    const since = DATA.test(p.get('since') || '') ? p.get('since') : oggi, until = DATA.test(p.get('until') || '') ? p.get('until') : oggi
    return swrSnapshot(req, { tab: 'sessioniSedi1', ttlMs: until >= oggi ? 5 * 60_000 : 6 * 3600_000, compute: async () => {
      try {
        const righe = await shopifyql(`FROM sessions SHOW sessions GROUP BY session_country, session_city SINCE ${since} UNTIL ${until} ORDER BY sessions DESC LIMIT 12`)
        const sedi = (Array.isArray(righe) ? righe : righe?.rows || []).map(r => ({ country: r.session_country || null, city: r.session_city || null, sessions: Math.round(Number(r.sessions) || 0) })).filter(s => s.sessions > 0 && (s.country || s.city))
        return { ok: true, since, until, sedi }
      } catch (e) { return { ok: false, error: e.message, sedi: [], __noCache: true } }
    } })
  })
}
