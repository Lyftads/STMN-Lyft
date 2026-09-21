// ============================================================================
//  L'aliquota IVA di OGNI prodotto, letta da Shopify.
//
//  Marino, 21 set 2026: «nel calcolo dell'Iva devi prendere il dato da
//  Shopify. In Saracino ci sono diverse aliquote come al 10%, al 4%, al 22% in
//  base ai prodotti. Non puoi mettere sempre al 22%.»
//
//  Prima il margine si calcolava dividendo il prezzo per 1,22. Su un olio al 4%
//  da 100 EUR dava 81,97 EUR di netto invece di 96,15: -18% su OGNI margine,
//  abbastanza da far sembrare in perdita un prodotto che guadagna.
//
//  ── DA DOVE SI LEGGE, e perche' non da ShopifyQL ─────────────────────────
//  La prima idea era imposta / netto per prodotto (ShopifyQL, una query). L'ho
//  misurata e l'ho scartata: quel rapporto e' l'IVA MEDIAMENTE INCASSATA, che
//  mescola le vendite normali con quelle esenti o estere. Su Anna Virgili, dove
//  le borse sono TUTTE al 22%, dava 93 prodotti «allo 0%» e una coda a 9%, 14%:
//  erano le vendite marketplace (l'IVA la versa il marketplace) e gli ordini
//  manuali. Su Saracino l'olio usciva al 3%, 2%, 1%.
//
//  La verita' e' su OGNI riga d'ordine: `tax_lines[].rate`, l'aliquota che
//  Shopify ha applicato — 0,04, 0,10, 0,22. Letta su 1.000 ordini di Saracino:
//    10 Litri olio          4% x 474   (piu' 7%, 9%, 5,5%: spedizioni in altri
//                                        paesi UE con la loro aliquota ridotta)
//    Taralli pugliesi       10% x 32
//  L'aliquota del prodotto e' quindi la PIU' FREQUENTE sulle sue righe vendute
//  nel paese del negozio. Una moda, non una media: le vendite estere o esenti
//  sono l'eccezione e non devono spostare il numero, mentre in una media lo
//  spostano sempre un po'.
//
//  NIENTE TABELLA DI ALIQUOTE LEGALI: e' Shopify a dire 4 o 10, per qualunque
//  paese. Un cliente svizzero avra' 2,6 / 8,1, uno tedesco 7 / 19, senza che
//  qui cambi una riga.
//
//  RIPIEGO, sempre DICHIARATO in `fonte`:
//    1. il prodotto ha righe vendute -> la sua aliquota         ('prodotto')
//    2. non ha venduto nel periodo   -> quella piu' frequente del
//       negozio intero                                         ('negozio')
//       (Saracino: 4. Gia' da sola chiude quasi tutto l'errore.)
//    3. nessuna vendita letta        -> quella del chiamante, cioe'
//       l'aliquota regolabile del workspace                    ('ripiego')
// ============================================================================
import { getShopify, getTenantInfo } from '../tenant/credentials'
import { getSnapshot, setSnapshot } from '../cache/snapshot'

// Quattro mesi bastano: le aliquote cambiano raramente, e servono abbastanza
// righe per prodotto da vedere la moda, non tutto lo storico.
const GIORNI = 120
// Il periodo si legge in FINESTRE PARALLELE, ognuna con poche pagine. Letto in
// fila, pagina dopo pagina, Saracino ha impiegato 145 secondi (40 pagine, 9.121
// righe): la tab Verdetti ha 38 secondi di tempo, alla prima apertura sarebbe
// andata in timeout. La moda non ha bisogno di tutte le righe — sul primo
// migliaio d'ordini l'olio era gia' 4% x 474 — ma di righe SPARSE nel periodo,
// cosi' anche un prodotto che vende a ondate compare. 6 finestre x 2 pagine x
// 250 = fino a 3.000 ordini, nel tempo di due pagine.
const FINESTRE = 6
const PAGINE_PER_FINESTRA = 2
// Scaricare gli ordini costa: la risposta si tiene un giorno, per workspace.
const VITA_MS = 24 * 3600 * 1000
const CHIAVE = 'aliquoteProdotti'

const pausa = (ms) => new Promise(r => setTimeout(r, ms))
async function prendi(url, token) {
  for (let t = 0; t < 6; t++) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': token }, cache: 'no-store' })
    if (res.status === 429 || res.status === 430) { await pausa((Number(res.headers.get('Retry-After')) || 2) * 1000); continue }
    return res
  }
  return null
}

// L'aliquota di una riga, in per cento a un decimale. Piu' tax_lines si SOMMANO:
// in alcuni paesi l'imposta e' composta (statale + locale).
const aliquotaRiga = (li) => {
  const tl = Array.isArray(li?.tax_lines) ? li.tax_lines : []
  if (!tl.length) return null
  return Math.round(tl.reduce((s, t) => s + (Number(t.rate) || 0), 0) * 1000) / 10
}

// La piu' frequente fra le aliquote POSITIVE; zero solo se tutte le righe sono
// a zero (un prodotto davvero esente). Cosi' un cliente business esente non
// trascina a 0 un prodotto che per tutti gli altri e' al 22.
function moda(conteggi) {
  let migliore = null, n = -1, soloZero = true
  for (const [a, c] of conteggi) {
    if (a > 0) { soloZero = false; if (c > n) { n = c; migliore = a } }
  }
  if (migliore != null) return migliore
  return soloZero && conteggi.size ? 0 : null
}

async function leggiDaShopify() {
  const { storeUrl, adminToken } = getShopify()
  if (!storeUrl || !adminToken) return null
  // Per prodotto e per paese di spedizione: il paese «di casa» si decide dopo,
  // guardando dove va la maggior parte delle righe.
  const perProdotto = new Map()   // productId -> Map(paese -> Map(aliquota -> righe))
  const perPaese = new Map()      // paese -> righe
  let righe = 0
  const conta = (o) => {
    const paese = String(o.shipping_address?.country_code || o.billing_address?.country_code || '').toUpperCase() || '??'
    for (const li of (o.line_items || [])) {
      if (li.gift_card || li.product_id == null) continue
      const a = aliquotaRiga(li)
      if (a == null) continue
      righe++
      perPaese.set(paese, (perPaese.get(paese) || 0) + 1)
      const pid = String(li.product_id)
      if (!perProdotto.has(pid)) perProdotto.set(pid, new Map())
      const pp = perProdotto.get(pid)
      if (!pp.has(paese)) pp.set(paese, new Map())
      const m = pp.get(paese); m.set(a, (m.get(a) || 0) + 1)
    }
  }
  const ora = Date.now(), passo = (GIORNI * 86400000) / FINESTRE
  const finestra = async (i) => {
    const dal = new Date(ora - (i + 1) * passo).toISOString(), al = new Date(ora - i * passo).toISOString()
    let url = `https://${storeUrl}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${encodeURIComponent(dal)}&created_at_max=${encodeURIComponent(al)}&limit=250&fields=line_items,shipping_address,billing_address`
    for (let p = 0; url && p < PAGINE_PER_FINESTRA; p++) {
      const res = await prendi(url, adminToken)
      if (!res?.ok) break
      const j = await res.json().catch(() => null)
      // JavaScript e' a un filo solo: le scritture nelle mappe avvengono fra un
      // await e l'altro, quindi le finestre parallele non si pestano i piedi.
      for (const o of (j?.orders || [])) conta(o)
      const next = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') || '')
      url = next ? next[1] : null
    }
  }
  await Promise.all(Array.from({ length: FINESTRE }, (_, i) => finestra(i)))
  if (!righe) return { aliquote: {}, predefinita: null, paese: null, righe: 0 }

  // Il paese di casa: dove va la maggior parte delle righe. Per un negozio
  // italiano e' l'Italia; per uno che vende soprattutto all'estero sara' quello.
  const paese = [...perPaese].sort((a, b) => b[1] - a[1])[0][0]

  const aliquote = {}
  const delNegozio = new Map()
  for (const [pid, paesi] of perProdotto) {
    // SOLO le righe spedite nel paese di casa. Un prodotto venduto soltanto
    // all'estero nel periodo prenderebbe l'aliquota di li': misurato su Anna
    // Virgili, borse che in Italia sono al 22 uscivano al 20 (Francia), 21
    // (Spagna), 23 (Irlanda), 27 (Ungheria). Per il margine sul mercato di casa
    // un'aliquota estera non dice niente: quel prodotto resta senza aliquota
    // propria e ripiega su quella del negozio — DICHIARATO come ripiego, non
    // spacciato per una misura.
    const base = paesi.get(paese)
    const a = base ? moda(base) : null
    if (a != null) aliquote[pid] = a
    for (const [x, c] of (paesi.get(paese) || [])) delNegozio.set(x, (delNegozio.get(x) || 0) + c)
  }
  return { aliquote, predefinita: moda(delNegozio), paese, righe }
}

// → { perProdotto: Map<productId, aliquota%>, predefinita: aliquota% | null, paese, righe }
// `aliquota%` e' un numero come 4 o 22 (per cento), non 0,04.
export async function aliquoteProdotti() {
  const ws = getTenantInfo()?.userId || null
  let dato = ws ? (await getSnapshot(ws, CHIAVE, VITA_MS).catch(() => null)) : null
  if (!dato?.aliquote) {
    dato = await leggiDaShopify().catch(() => null)
    // Si conserva solo una lettura riuscita e con righe: un negozio senza ordini
    // nel periodo non deve fissare per un giorno «nessuna aliquota».
    if (ws && dato?.righe) setSnapshot(ws, CHIAVE, dato).catch(() => {})
  }
  const aliquote = dato?.aliquote || {}
  return {
    perProdotto: new Map(Object.entries(aliquote).map(([k, v]) => [k, Number(v)])),
    predefinita: dato?.predefinita ?? null,
    paese: dato?.paese ?? null,
    righe: dato?.righe ?? 0,
  }
}

// L'aliquota di UN prodotto, con la catena di ripiego. `tabella` e' quello che
// restituisce aliquoteProdotti(); `ripiego` e' in per cento (es. 22).
export function aliquotaDi(productId, tabella, ripiego) {
  const propria = productId != null ? tabella?.perProdotto?.get(String(productId)) : undefined
  if (propria != null) return { aliquota: propria, fonte: 'prodotto' }
  if (tabella?.predefinita != null) return { aliquota: tabella.predefinita, fonte: 'negozio' }
  return { aliquota: Number(ripiego) || 0, fonte: 'ripiego' }
}

// Il netto da un prezzo IVA compresa. Aliquota in per cento.
export const senzaIva = (prezzoLordo, aliquota) => prezzoLordo / (1 + (Number(aliquota) || 0) / 100)
