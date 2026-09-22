export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { withTenantContext, getMeta, getGoogle, getShopify } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'
import { shopifyql } from '../../../lib/shopify/shopifyql'
import { FUSO_PREDEFINITO } from '../../../lib/periodi'

// ============================================================================
//  Oggi contro IERI ALLA STESSA ORA.
//
//  Marino, 21 set 2026: «Se inserisci Oggi, ti fa il paragone con tutta la
//  giornata di ieri, quindi risultano tutti i dati in negativo». Alle quattro del
//  pomeriggio il fatturato e' per forza «in calo» e la spesa «in risparmio». Qui
//  ieri si ferma alla stessa ora: le ore gia' chiuse per intero, quella in corso
//  in proporzione ai minuti passati (l'unica stima, dichiarata).
//
//  Viene dal fork (lyft-av), dove questa route esiste dal 19 set. La Dashboard
//  del SaaS — arrivata dal fork — la CHIAMAVA gia', ma qui la route non c'era:
//  riceveva un 404, non aveva dati e tornava in silenzio al confronto con la
//  giornata intera. Nessun errore da nessuna parte.
//
//  STESSE DEFINIZIONI DELLA DASHBOARD, non quelle del fork. Il fork toglie il
//  marketplace e le campagne Drive to Store perche' la SUA Dashboard le toglie.
//  Qui /api/metrics conta tutti i canali (total_sales, EUR), tutti gli account
//  Meta e tutte le campagne, e /api/google tutte le campagne Google: se questa
//  route escludesse qualcosa, su Anna Virgili «oggi» comprenderebbe Koongo e
//  «ieri alla stessa ora» no, e oggi sembrerebbe in crescita per un conto
//  fatto con due regole diverse. SE LA DASHBOARD CAMBIA DEFINIZIONE, QUESTA
//  ROUTE DEVE CAMBIARE CON LEI.
//
//  IL FUSO e' quello del negozio (shop.json), non Roma scritto nel codice:
//  ShopifyQL raggruppa le ore nel fuso del negozio, e «l'ora di adesso» deve
//  essere contata nello stesso. Meta e Google danno le ore nel fuso del loro
//  account: per i clienti di oggi e' lo stesso; se un giorno non lo fosse, le
//  ore della spesa scivolerebbero di quanto differiscono i due fusi.
// ============================================================================

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(n * 100) / 100
const vuota = () => Array.from({ length: 24 }, () => 0)
const ieriDi = (iso) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) }

// Il fuso del negozio, chiesto a Shopify UNA volta per negozio (come in corrispettivi/giorno).
const fusi = new Map()
async function fusoNegozio() {
  const { storeUrl, adminToken } = getShopify()
  if (!storeUrl || !adminToken) return FUSO_PREDEFINITO
  if (fusi.has(storeUrl)) return fusi.get(storeUrl)
  let iana = null
  try {
    const r = await fetch(`https://${storeUrl}/admin/api/2026-04/shop.json?fields=iana_timezone`, {
      headers: { 'X-Shopify-Access-Token': adminToken }, cache: 'no-store', signal: AbortSignal.timeout(8_000),
    })
    if (r.ok) iana = (await r.json().catch(() => null))?.shop?.iana_timezone || null
  } catch {}
  // Il ripiego si conserva solo se Shopify ha risposto senza fuso: un errore di rete
  // non deve fissare Roma per sempre su un negozio che sta altrove.
  if (iana) fusi.set(storeUrl, iana)
  return iana || FUSO_PREDEFINITO
}

function adesso(fuso) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]))
  return { oggi: `${p.year}-${p.month}-${p.day}`, ora: Number(p.hour), minuti: Number(p.minute) }
}

// Somma una serie oraria { 'YYYY-MM-DD': [24 valori] } fino all'ora data: le ore chiuse
// per intero, quella in corso per la sua quota di minuti.
function finoA(ore, ora, minuti) {
  if (!ore) return null
  let s = 0
  for (let h = 0; h < ora; h++) s += ore[h] || 0
  return s + (ore[ora] || 0) * (minuti / 60)
}

// ShopifyQL restituisce le ore come ISTANTI IN UTC: «2026-09-19T22:00:00Z» e' la mezzanotte
// del 20 a Roma. Leggerle alla lettera (data e ora dalla stringa) spostava tutto di due ore
// d'estate e di una d'inverno: «ieri alle 11:50» sommava in realta' ieri fino alle 13:50, e
// gli ordini fra mezzanotte e le due finivano sul giorno prima e venivano scartati (su
// Saracino, 20 set: 2 ordini e 148,50 EUR — esattamente lo scarto col totale della
// Dashboard). Meta e Google danno invece l'ora LOCALE dell'account: vendite e spesa erano
// anche disallineate fra loro. Qui l'istante si riporta nel fuso del negozio. Una stringa
// senza fuso (se un giorno Shopify la mandasse cosi') si prende com'e': e' gia' locale.
function oraNelFuso(fuso) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
  return (valore) => {
    const t = String(valore || '')
    if (!/(Z|[+-]\d{2}:?\d{2})$/.test(t)) {
      const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2})/.exec(t)
      return m ? [m[1], Number(m[2])] : null
    }
    const ms = Date.parse(t)
    if (!Number.isFinite(ms)) return null
    const p = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value]))
    return [`${p.year}-${p.month}-${p.day}`, Number(p.hour)]
  }
}

async function shopifyAOre(ieri, oggi, fuso) {
  // In fila e non in parallelo: ShopifyQL sta a ~30 richieste al minuto per negozio.
  const vendite = await shopifyql(`FROM sales SHOW total_sales, orders, orders_first_time, orders_returning GROUP BY hour SINCE ${ieri} UNTIL ${oggi} ORDER BY hour ASC LIMIT 1000`, { ttlMs: 10 * 60_000 })
  const sess = await shopifyql(`FROM sessions SHOW sessions GROUP BY hour SINCE ${ieri} UNTIL ${oggi} ORDER BY hour ASC LIMIT 200`, { ttlMs: 10 * 60_000 })
  const serie = () => ({ [ieri]: vuota(), [oggi]: vuota() })
  const out = { venduto: serie(), ordini: serie(), nuovi: serie(), abituali: serie(), sessioni: serie() }
  const locale = oraNelFuso(fuso)
  const dove = (r) => { const d = locale(r.hour); return d && out.venduto[d[0]] && d[1] >= 0 && d[1] < 24 ? d : null }
  for (const r of (vendite || [])) {
    const d = dove(r); if (!d) continue
    out.venduto[d[0]][d[1]] += num(r.total_sales); out.ordini[d[0]][d[1]] += num(r.orders)
    out.nuovi[d[0]][d[1]] += num(r.orders_first_time); out.abituali[d[0]][d[1]] += num(r.orders_returning)
  }
  for (const r of (sess || [])) { const d = dove(r); if (d) out.sessioni[d[0]][d[1]] += num(r.sessions) }
  return out
}

async function metaAOre(ieri, oggi) {
  const m = getMeta()
  if (!m?.accessToken || !m?.adAccountId) return null
  const serie = () => ({ [ieri]: vuota(), [oggi]: vuota() })
  const spesa = serie(), impressioni = serie(), clic = serie()
  // Tutti gli account collegati, come /api/metrics: un cliente puo' averne piu' d'uno
  // (meta_account_id separati da virgola). Contarne uno solo darebbe mezza spesa.
  const conti = String(m.adAccountId).split(',').map(s => s.trim()).filter(Boolean)
  for (const conto of conti) {
    const act = conto.startsWith('act_') ? conto : `act_${conto}`
    let url = `https://graph.facebook.com/${m.graphVersion || 'v20.0'}/${act}/insights?level=account&fields=spend,impressions,inline_link_clicks&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone&time_increment=1&time_range=${encodeURIComponent(JSON.stringify({ since: ieri, until: oggi }))}&limit=500&access_token=${encodeURIComponent(m.accessToken)}`
    for (let giri = 0; url && giri < 8; giri++) {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      const j = await res.json().catch(() => null)
      if (!res.ok || j?.error) throw new Error(`Meta: ${j?.error?.message || res.status}`)
      for (const r of (j?.data || [])) {
        const h = Number(String(r.hourly_stats_aggregated_by_advertiser_time_zone || '').slice(0, 2))
        if (spesa[r.date_start] && h >= 0 && h < 24) { spesa[r.date_start][h] += num(r.spend); impressioni[r.date_start][h] += num(r.impressions); clic[r.date_start][h] += num(r.inline_link_clicks) }
      }
      url = j?.paging?.next || null
    }
  }
  return { spesa, impressioni, clic }
}

async function googleAOre(ieri, oggi) {
  const g = getGoogle()
  const DEV = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const CID = (g?.adsCustomerId || '').replace(/-/g, ''), MCC = (g?.adsMccId || '').replace(/-/g, '')
  if (!DEV || !CID || !g?.refreshToken || !g?.clientId) return null
  const tk = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: g.clientId, client_secret: g.clientSecret || '', refresh_token: g.refreshToken, grant_type: 'refresh_token' }),
  }).then(r => r.json()).catch(() => null)
  if (!tk?.access_token) throw new Error('Google: accesso non riuscito')
  const { GoogleAdsServiceClient } = await import('google-ads-node')
  const grpc = await import('@grpc/grpc-js')
  const client = new GoogleAdsServiceClient({ sslCreds: grpc.credentials.createSsl(), servicePath: 'googleads.googleapis.com', port: 443 })
  const opts = { otherArgs: { headers: { authorization: `Bearer ${tk.access_token}`, 'developer-token': DEV, ...(MCC ? { 'login-customer-id': MCC } : {}) } } }
  const [righe] = await client.search({ customer_id: CID, query:
    `SELECT segments.date, segments.hour, metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${ieri}' AND '${oggi}'` }, opts)
  const spesa = { [ieri]: vuota(), [oggi]: vuota() }
  for (const r of (righe || [])) {
    const d = r?.segments?.date, h = Number(r?.segments?.hour)
    if (spesa[d] && h >= 0 && h < 24) spesa[d][h] += num(r?.metrics?.costMicros ?? r?.metrics?.cost_micros) / 1e6
  }
  return spesa
}

export async function GET(req) {
  return withTenantContext(req, async () => swrSnapshot(req, { tab: 'oggiVsIeri@3', ttlMs: 10 * 60_000, giornaliero: true, compute: async () => {
    const fuso = await fusoNegozio()
    const { oggi, ora, minuti } = adesso(fuso)
    const ieri = ieriDi(oggi)
    const [sh, me, go] = await Promise.allSettled([shopifyAOre(ieri, oggi, fuso), metaAOre(ieri, oggi), googleAOre(ieri, oggi)])
    const errori = [sh, me, go].filter(x => x.status === 'rejected').map(x => String(x.reason?.message || x.reason).slice(0, 100))
    const s = sh.status === 'fulfilled' ? sh.value : null
    const m = me.status === 'fulfilled' ? me.value : null
    const g = go.status === 'fulfilled' ? go.value : null
    // Senza Shopify il confronto non ha senso: meglio nessun dato (la Dashboard torna al
    // confronto di prima) che un «ieri» fatto di soli zeri, che farebbe sembrare tutto in crescita.
    if (!s) return { ok: false, error: errori[0] || 'Shopify non collegato', __noCache: true }
    const a = (serie, giorno, h = ora, mm = minuti) => (serie ? finoA(serie[giorno], h, mm) : null)
    const arr = (v) => (v == null ? null : r2(v)), int = (v) => (v == null ? null : Math.round(v))
    const quadro = (giorno, h, mm) => {
      const fat = a(s.venduto, giorno, h, mm), spM = a(m?.spesa, giorno, h, mm), spG = a(g, giorno, h, mm)
      // La spesa totale vale solo se l'hanno data TUTTE le piattaforme collegate: meta' spesa = MER doppio.
      const spesa = (me.status === 'fulfilled' && go.status === 'fulfilled') ? (spM || 0) + (spG || 0) : null
      return {
        fatturato: arr(fat), ordini: int(a(s.ordini, giorno, h, mm)), nuovi: int(a(s.nuovi, giorno, h, mm)), abituali: int(a(s.abituali, giorno, h, mm)),
        sessioni: int(a(s.sessioni, giorno, h, mm)),
        spesaMeta: arr(spM), spesaGoogle: arr(spG), spesa: arr(spesa),
        impressioni: int(a(m?.impressioni, giorno, h, mm)), clic: int(a(m?.clic, giorno, h, mm)),
        mer: fat != null && spesa > 0 ? r2(fat / spesa) : null,
      }
    }
    const out = {
      ok: true, fuso, oggi, ieri, ora, minuti, alle: `${String(ora).padStart(2, '0')}:${String(minuti).padStart(2, '0')}`,
      ieriAllaStessaOra: quadro(ieri, ora, minuti),
      // per controllo: gli stessi conti sulle giornate intere (devono coincidere con la Dashboard)
      oggiFinora: quadro(oggi, 24, 0), ieriIntero: quadro(ieri, 24, 0),
      // Sessioni e clic la Dashboard li conta con una definizione sua (visitatori, clic in uscita):
      // per quelli non si passa il NUMERO ma la QUOTA di giornata trascorsa ieri a quest'ora, da
      // applicare al valore di ieri che la Dashboard gia' conosce.
      quote: {
        sessioni: (() => { const t = a(s.sessioni, ieri, 24, 0); return t > 0 ? a(s.sessioni, ieri) / t : null })(),
        clic: (() => { const t = a(m?.clic, ieri, 24, 0); return t > 0 ? a(m?.clic, ieri) / t : null })(),
        impressioni: (() => { const t = a(m?.impressioni, ieri, 24, 0); return t > 0 ? a(m?.impressioni, ieri) / t : null })(),
      },
    }
    return errori.length ? { ...out, errori, __noCache: true } : out
  } }))
}
