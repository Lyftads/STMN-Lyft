export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'
import { shopifyql } from '../../../lib/shopify/shopifyql'
import { oggiNegozio, piuGiorni, periodoPrima, mezzanotteNegozio, FUSO_PREDEFINITO } from '../../../lib/periodi'
import { periodoDa } from '../../../lib/generale/periodo'

// ============================================================================
//  GLI ORDINI IN DIRETTA di un negozio, per lo schermo «Dashboard generale».
//
//  Due fonti, tenute separate di proposito:
//
//  · OGGI viene dalla LISTA DEGLI ORDINI (Admin API), che e' immediata: ogni ordine ha
//    numero, ora, importo e il punto sulla mappa (Shopify da' gia' latitudine e longitudine
//    dell'indirizzo di spedizione). Il fatturato di oggi e' la somma di questi ordini: cosi'
//    quando un ordine compare nella colonna, il numero grande sale ESATTAMENTE di quell'importo.
//    Differenza dichiarata con la Dashboard: la' «oggi» e' total_sales di ShopifyQL, che toglie
//    i resi registrati oggi; qui i resi di oggi non si vedono fino a domani.
//
//  · I GIORNI CHIUSI del periodo scelto (tutto cio' che viene prima di oggi) vengono da
//    ShopifyQL, total_sales in EUR: la stessa cifra della Dashboard e del report di Shopify.
//    Su un periodo che comprende oggi il totale e' «chiuso ufficiale + oggi in diretta»: mai
//    lo stesso giorno contato due volte.
//
//  TUTTI I CANALI, marketplace compresi (Koongo): scelta di Marino per questo schermo, 27 nov
//  2026 («inserisci anche Koongo, non e' un problema»). E' l'unico punto in cui il fatturato
//  di Anna Virgili e Dude comprende il marketplace: nelle loro Dashboard resta a parte, quindi
//  li' il numero e' piu' basso — non e' un errore. Di conseguenza anche il MER di questo
//  schermo e' calcolato sul fatturato intero.
//
//  Esce solo cio' che serve a disegnare: nessun nome, nessun indirizzo.
// ============================================================================

const FUSO = FUSO_PREDEFINITO
const PASSO_MIN = 10                 // la curva di oggi: un punto ogni 10 minuti
const PAGINE_MAX = 24                // 6.000 ordini in un giorno: oltre, la giornata si dichiara incompleta
const RIFAI_OGNI = 10 * 60_000       // ogni tanto si rilegge tutto: un ordine annullato dopo va tolto
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(n * 100) / 100

// Per negozio: gli ordini di oggi gia' letti. Fra una lettura completa e l'altra si chiedono
// solo quelli nuovi. La memoria e' dell'istanza: se manca si rilegge tutto, mai un dato a meta'.
const negozi = new Map()   // storeUrl → { giorno, ordini: Map(id → ordine), pienoAlle, ultimo, tronco }
const risposte = new Map() // «storeUrl|preset» → { alle, corpo }
const ufficiali = new Map()// «storeUrl|chiave» → { alle, dato }

// Shopify concede poche chiamate al secondo per negozio (2 o 4 secondo il piano) e le divide con
// tutto il resto dell'app: a un 429 si aspetta quanto dice lui e si riprova, invece di perdere la lettura.
async function pagina(url, adminToken) {
  let res
  for (let giro = 0; giro < 4; giro++) {
    res = await fetch(url, { headers: { 'X-Shopify-Access-Token': adminToken }, cache: 'no-store', signal: AbortSignal.timeout(20_000) })
    if (res.status !== 429) break
    await new Promise(r => setTimeout(r, Math.min(4000, (Number(res.headers.get('retry-after')) || 1) * 1000 + giro * 300)))
  }
  if (!res.ok) throw new Error(`Shopify ${res.status}`)
  const { orders = [] } = await res.json()
  const prossima = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') || '')?.[1] || null
  return { orders, prossima }
}

async function ordiniDiOggi(storeUrl, adminToken, oggi) {
  let m = negozi.get(storeUrl)
  const daCapo = !m || m.giorno !== oggi || Date.now() - m.pienoAlle > RIFAI_OGNI
  if (daCapo) m = { giorno: oggi, ordini: new Map(), pienoAlle: Date.now(), ultimo: 0, tronco: false }
  const da = daCapo ? mezzanotteNegozio(oggi, FUSO) : new Date(m.ultimo - 2 * 60_000)
  const campi = 'id,name,created_at,total_price,currency,cancelled_at,test,shipping_address,billing_address'
  let url = `https://${storeUrl}/admin/api/2024-01/orders.json?status=any&created_at_min=${encodeURIComponent(da.toISOString())}&limit=250&fields=${campi}`
  let giri = 0
  while (url) {
    if (++giri > PAGINE_MAX) { m.tronco = true; break }
    const { orders, prossima } = await pagina(url, adminToken)
    for (const o of orders) {
      const t = Date.parse(o.created_at)
      if (!Number.isFinite(t)) continue
      if (o.cancelled_at || o.test) { m.ordini.delete(o.id); continue }
      const ind = o.shipping_address || o.billing_address || {}
      const lat = Number(ind.latitude), lng = Number(ind.longitude)
      m.ordini.set(o.id, {
        id: String(o.id), n: o.name || '', t, e: r2(num(o.total_price)), v: o.currency || 'EUR',
        c: ind.city || null, p: ind.country_code || null,
        la: Number.isFinite(lat) && lat ? +lat.toFixed(2) : null, ln: Number.isFinite(lng) && lng ? +lng.toFixed(2) : null,
      })
      if (t > m.ultimo) m.ultimo = t
    }
    url = prossima
  }
  if (!m.ultimo) m.ultimo = mezzanotteNegozio(oggi, FUSO).getTime()
  negozi.set(storeUrl, m)
  return m
}

// La sede del negozio (l'indirizzo che ha su Shopify): e' il punto in cui arrivano i flussi degli
// ordini sul globo. Si chiede una volta per negozio; se Shopify non la da', niente flussi per lui.
const sedi = new Map()
async function sedeNegozio(storeUrl, adminToken) {
  if (sedi.has(storeUrl)) return sedi.get(storeUrl)
  let sede = null
  try {
    const r = await fetch(`https://${storeUrl}/admin/api/2024-01/shop.json?fields=latitude,longitude,city`, { headers: { 'X-Shopify-Access-Token': adminToken }, cache: 'no-store', signal: AbortSignal.timeout(8_000) })
    if (!r.ok) return null   // un errore non si ricorda: si riprova al prossimo giro
    const n = (await r.json().catch(() => null))?.shop
    const lat = Number(n?.latitude), lng = Number(n?.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)) sede = { lat: +lat.toFixed(2), lng: +lng.toFixed(2), citta: n.city || null }
  } catch { return null }
  sedi.set(storeUrl, sede)
  return sede
}

// Una risposta ufficiale (ShopifyQL) si tiene qualche minuto: i giorni chiusi non cambiano,
// e lo schermo chiede ogni 20 secondi.
async function tenuto(chiave, vitaMs, calcola) {
  const hit = ufficiali.get(chiave)
  if (hit && Date.now() - hit.alle < vitaMs) return hit.dato
  const dato = await calcola()
  ufficiali.set(chiave, { alle: Date.now(), dato })
  if (ufficiali.size > 400) ufficiali.delete(ufficiali.keys().next().value)
  return dato
}

async function totaleUfficiale(storeUrl, since, until) {
  return tenuto(`${storeUrl}|tot|${since}|${until}`, 10 * 60_000, async () => {
    const righe = await shopifyql(`FROM sales SHOW total_sales, orders SINCE ${since} UNTIL ${until} WITH CURRENCY 'EUR'`)
    const r = (righe || [])[0] || {}
    return { since, until, fatturato: r2(num(r.total_sales)), ordini: Math.round(num(r.orders)) }
  })
}

// Ieri ora per ora, nel fuso del negozio (ShopifyQL da' le ore come istanti UTC).
async function ieriAOre(storeUrl, ieri) {
  return tenuto(`${storeUrl}|ore|${ieri}`, 30 * 60_000, async () => {
    const righe = await shopifyql(`FROM sales SHOW total_sales, orders GROUP BY hour SINCE ${ieri} UNTIL ${ieri} ORDER BY hour ASC LIMIT 200 WITH CURRENCY 'EUR'`)
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    const euro = Array.from({ length: 24 }, () => 0), ordini = Array.from({ length: 24 }, () => 0)
    for (const r of (righe || [])) {
      const t = String(r.hour || '')
      let giorno, ora
      if (/(Z|[+-]\d{2}:?\d{2})$/.test(t)) {
        const p = Object.fromEntries(f.formatToParts(new Date(Date.parse(t))).map(x => [x.type, x.value]))
        giorno = `${p.year}-${p.month}-${p.day}`; ora = Number(p.hour)
      } else { const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2})/.exec(t); if (!m) continue; giorno = m[1]; ora = Number(m[2]) }
      if (giorno !== ieri || !(ora >= 0 && ora < 24)) continue
      euro[ora] += num(r.total_sales); ordini[ora] += num(r.orders)
    }
    return { euro: euro.map(r2), ordini }
  })
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { storeUrl, adminToken } = getShopify()
    if (!storeUrl || !adminToken) return NextResponse.json({ ok: false, error: 'Shopify non collegato' }, { status: 200, headers: { 'cache-control': 'no-store' } })
    const preset = new URL(req.url).searchParams.get('preset') || 'today'
    const chiave = `${storeUrl}|${preset}`
    const pronta = risposte.get(chiave)
    if (pronta && Date.now() - pronta.alle < 12_000) return NextResponse.json(pronta.corpo, { headers: { 'cache-control': 'no-store' } })

    try {
      const oggi = oggiNegozio(FUSO), ieri = piuGiorni(oggi, -1)
      const mezzanotte = mezzanotteNegozio(oggi, FUSO).getTime()
      const adesso = Date.now()

      // ── oggi, dagli ordini ────────────────────────────────────────────────
      const m = await ordiniDiOggi(storeUrl, adminToken, oggi)
      const tutti = [...m.ordini.values()].filter(o => o.t >= mezzanotte).sort((a, b) => b.t - a.t)
      const validi = tutti
      const passi = Math.max(1, Math.ceil((adesso - mezzanotte) / (PASSO_MIN * 60_000)))
      const curva = Array.from({ length: passi + 1 }, () => 0)
      let fatturato = 0
      for (const o of validi) {
        fatturato += o.e
        const i = Math.min(passi, Math.max(1, Math.ceil((o.t - mezzanotte) / (PASSO_MIN * 60_000))))
        curva[i] += o.e
      }
      for (let i = 1; i < curva.length; i++) curva[i] = r2(curva[i] + curva[i - 1])
      const griglia = new Map()
      for (const o of tutti) {
        if (o.la == null || o.ln == null) continue
        const k = `${o.la.toFixed(1)}|${o.ln.toFixed(1)}`
        const g = griglia.get(k) || { lat: +o.la.toFixed(1), lng: +o.ln.toFixed(1), n: 0 }
        g.n++; griglia.set(k, g)
      }

      // ── ieri (per il confronto alla stessa ora) e il periodo scelto, ufficiali ──
      const periodo = periodoDa(preset, oggi)
      const conOggi = periodo.until >= oggi
      const fineChiusa = conOggi ? ieri : periodo.until
      const prima = periodoPrima(periodo)
      const [sede, ore, chiuso, primaTot] = await Promise.all([
        sedeNegozio(storeUrl, adminToken),
        ieriAOre(storeUrl, ieri).catch(() => null),
        periodo.since <= fineChiusa ? totaleUfficiale(storeUrl, periodo.since, fineChiusa).catch(e => ({ errore: String(e?.message || e).slice(0, 80) })) : null,
        // «Oggi» si confronta con ieri alla stessa ora (sotto), non con la giornata intera
        prima && !(periodo.since === oggi) ? totaleUfficiale(storeUrl, prima.since, prima.until).catch(() => null) : null,
      ])
      let ieriOut = null
      if (ore) {
        const d = new Date(adesso)
        const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]))
        const h = Number(p.hour), mm = Number(p.minute)
        const cum = [0]; for (let i = 0; i < 24; i++) cum.push(r2(cum[i] + ore.euro[i]))
        const fino = (serie) => { let s = 0; for (let i = 0; i < h; i++) s += serie[i]; return s + serie[h] * (mm / 60) }
        ieriOut = { curva: cum, totale: cum[24], allaStessaOra: { fatturato: r2(fino(ore.euro)), ordini: Math.round(fino(ore.ordini)) } }
      }

      const corpo = {
        ok: true, oggi, ieri, alle: adesso, mezzanotte, passoMin: PASSO_MIN,
        periodo, conOggi, sede,
        vivo: { fatturato: r2(fatturato), ordini: validi.length, curva, incompleto: !!m.tronco },
        ultimi: tutti.slice(0, 40),
        luoghi: [...griglia.values()].sort((a, b) => b.n - a.n).slice(0, 400),
        ieriOre: ieriOut,
        chiuso: chiuso && !chiuso.errore ? chiuso : null, chiusoErrore: chiuso?.errore || null,
        prima: primaTot,
      }
      risposte.set(chiave, { alle: Date.now(), corpo })
      if (risposte.size > 300) risposte.delete(risposte.keys().next().value)
      return NextResponse.json(corpo, { headers: { 'cache-control': 'no-store' } })
    } catch (e) {
      return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 120) }, { status: 200, headers: { 'cache-control': 'no-store' } })
    }
  })
}
