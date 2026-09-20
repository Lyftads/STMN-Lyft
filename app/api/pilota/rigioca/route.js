export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { withTenantContext, getShopify, getTenantInfo } from '../../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../../lib/cache/swr'
import { ordineDaCanaleEscluso } from '../../../../lib/shopify/koongo'
import { canaliEsclusiCliente } from '../../../../lib/pilota/cliente'
import { oggiNegozio, piuGiorni, FUSO_PREDEFINITO } from '../../../../lib/periodi'

// ============================================================================
//  RIGIOCA LA GIORNATA — gli ordini di un giorno con l'ORA e il PUNTO sulla mappa, per farli
//  ricomparire uno a uno sul globo scorrendo il tempo (la macchina del tempo all'indietro).
//  Shopify da' gia' latitudine e longitudine dell'indirizzo di spedizione: niente geocodifica.
//  Esce solo cio' che serve a disegnare: minuto del giorno, coordinate arrotondate (~1 km),
//  citta', importo. Nessun nome, nessun indirizzo. Senza marketplace e senza annullati.
//
//  MULTI-CLIENTE:
//   · i marketplace da togliere sono quelli DICHIARATI dal cliente; senza elenco non si toglie
//     niente e si rigioca la giornata intera, che e' il caso normale;
//   · il fuso e' quello di ripiego di lib/periodi.js (Roma). In `companies` non c'e' ancora una
//     colonna col fuso del negozio: finche' non c'e', un cliente fuori Europa vedrebbe la sua
//     giornata sfasata. Non e' un errore che si vede — vedi le avvertenze del travaso.
// ============================================================================
const FUSO = FUSO_PREDEFINITO
const minutoDelGiorno = (iso) => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)); return Number(p.find(x => x.type === 'hour').value) * 60 + Number(p.find(x => x.type === 'minute').value) }

export async function GET(req) {
  return withTenantContext(req, async () => {
    const oggi = oggiNegozio(FUSO)
    const chiesto = new URL(req.url).searchParams.get('giorno') || oggi
    const giorno = /^\d{4}-\d{2}-\d{2}$/.test(chiesto) && chiesto <= oggi ? chiesto : oggi
    // Il GIORNO entra nella chiave della cache: `giorno` non e' fra i parametri che swrSnapshot
    // riconosce da solo (since/until/preset...), e senza questo due giornate diverse si
    // sovrascriverebbero a vicenda nello stesso snapshot.
    return swrSnapshot(req, { tab: `pilotaRigioca1:${giorno}`, ttlMs: giorno === oggi ? 2 * 60_000 : 12 * 3600_000, compute: async () => {
      const { storeUrl, adminToken } = getShopify()
      if (!storeUrl || !adminToken) return { ok: false, error: 'Shopify non collegato', __noCache: true }
      const canali = await canaliEsclusiCliente(getTenantInfo().userId)
      // un margine di un giorno ai lati e poi si filtra sul giorno del NEGOZIO (fuso di Roma)
      const da = `${piuGiorni(giorno, -1)}T20:00:00Z`, a = `${piuGiorni(giorno, 1)}T04:00:00Z`
      const url = `https://${storeUrl}/admin/api/2024-01/orders.json?status=any&created_at_min=${encodeURIComponent(da)}&created_at_max=${encodeURIComponent(a)}&limit=250&fields=id,created_at,total_price,cancelled_at,source_name,app_id,tags,shipping_address,billing_address`
      const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': adminToken }, cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      if (!res.ok) return { ok: false, error: `Shopify ${res.status}`, __noCache: true }
      const { orders = [] } = await res.json()
      const delGiorno = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date(iso)) === giorno
      const punti = []
      for (const o of orders) {
        if (o.cancelled_at || ordineDaCanaleEscluso(o, canali) || !delGiorno(o.created_at)) continue
        const ind = o.shipping_address || o.billing_address || {}
        const lat = Number(ind.latitude), lng = Number(ind.longitude)
        punti.push({ m: minutoDelGiorno(o.created_at), lat: Number.isFinite(lat) && lat ? +lat.toFixed(2) : null, lng: Number.isFinite(lng) && lng ? +lng.toFixed(2) : null, citta: ind.city || null, euro: Math.round(Number(o.total_price) || 0) })
      }
      punti.sort((x, y) => x.m - y.m)
      return { ok: true, giorno, oggi: giorno === oggi, punti, senzaPunto: punti.filter(p => p.lat == null).length }
    } })
  })
}
