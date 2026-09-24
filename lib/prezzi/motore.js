// ============================================================================
//  PREZZI DEI CONCORRENTI — il motore.
//
//  Fonte 1 (gratis): i concorrenti su Shopify. Ogni negozio Shopify pubblica il suo catalogo
//  (/products.json: marchio, SKU, prezzo, prezzo pieno, disponibilita'). Lo si legge con garbo
//  (una pagina alla volta, 250 prodotti), lo si abbina ai nostri articoli sul CODICE DEL
//  PRODUTTORE (lib/prezzi/abbina.js) e si tengono solo gli abbinamenti, non il catalogo altrui.
//  Fonte 2 (in arrivo): il prezzo di mercato di Google Merchant Center.
//
//  Dove sta: tab_snapshots — `impostazioni:concorrenti` (l'elenco dei domini, deciso dall'utente),
//  `prezzi:nostri` (i nostri articoli attivi), `prezzi:<dominio>` (gli abbinamenti per concorrente).
// ============================================================================
import { assertPublicUrl } from '../security/ssrf'
import { getSnapshotStale, setSnapshot } from '../cache/snapshot'
import { leggiImpostazioni, scriviImpostazioni } from '../impostazioni'
import { preparaConcorrente, abbina } from './abbina'
import { configurato as merchantConfigurato, prezziDiMercato } from './merchant'
import { fetchVariantsForCost } from '../cost/shopifySync'
import { loadLatestLanded } from '../cost/landed'
import { aliquoteProdotti, aliquotaDi, senzaIva } from '../fiscal/aliquote'
import { soglieValide } from '../ads/soglieVerdetti'

const UA = 'Mozilla/5.0 (compatible; LyftAI-prezzi/1.0)'
// Non c'e' piu' un'aliquota unica: ogni prodotto ha la sua (lib/fiscal/aliquote.js).
// Qui c'era `const IVA = 1.22`: sull'olio di Saracino al 4% il margine usciva piu'
// basso del 18%, abbastanza da dire «a questo prezzo non puoi vendere» su un
// prodotto che guadagna.
const PAGINE_MAX = 60           // 15.000 prodotti per concorrente
export const CONCORRENTI_MAX = 12
const pausa = (ms) => new Promise(r => setTimeout(r, ms))

export function puliscDominio(testo) {
  const s = String(testo || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s) && s.length <= 120 ? s : null
}

async function pagina(dominio, n) {
  const url = await assertPublicUrl(`https://${dominio}/products.json?limit=250&page=${n}`)
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (!(res.headers.get('content-type') || '').includes('json')) throw new Error('non è un catalogo Shopify')
  const j = await res.json()
  if (!Array.isArray(j?.products)) throw new Error('non è un catalogo Shopify')
  return j.products
}

// Il dominio e' davvero un negozio Shopify col catalogo pubblico? (si controlla PRIMA di salvarlo)
export async function verificaShopify(dominio) {
  let p
  try { p = await pagina(dominio, 1) }
  catch (e) { const m = String(e?.message || e); throw new Error(/consentito|interno|DNS/i.test(m) ? m : `${dominio} non espone un catalogo Shopify leggibile (${m}). Funziona solo coi negozi su Shopify.`) }
  return { ok: true, esempio: p[0]?.title || null, marchi: [...new Set(p.map(x => x.vendor).filter(Boolean))].slice(0, 8) }
}

export async function leggiCatalogo(dominio) {
  const tutti = []
  for (let n = 1; n <= PAGINE_MAX; n++) {
    const p = await pagina(dominio, n)
    tutti.push(...p)
    if (p.length < 250) break
    await pausa(350)
  }
  return tutti
}

// I NOSTRI articoli attivi: SKU, prezzo, marchio, foto (Admin REST a cursore).
export async function nostriArticoli(store, token) {
  const righe = []
  let url = `https://${store}/admin/api/2024-01/products.json?status=active&limit=250&fields=id,title,vendor,handle,image,variants`
  for (let n = 0; url && n < 40; n++) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': token }, cache: 'no-store', signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`Shopify ${res.status}`)
    const j = await res.json()
    for (const p of (j.products || [])) for (const v of (p.variants || [])) if (v.sku) righe.push({ sku: v.sku, variantId: String(v.id), ean: v.barcode || null, prezzo: Number(v.price) || null, pieno: Number(v.compare_at_price) || null, titolo: p.title, marchio: p.vendor, immagine: p.image?.src || null, productId: p.id, giacenza: v.inventory_quantity ?? null })
    const prossima = (res.headers.get('link') || '').match(/<([^>]+)>;\s*rel="next"/)
    url = prossima ? prossima[1] : null
  }
  return righe
}

// I nostri articoli COL COSTO: quello di Shopify, sostituito dal costo "landed" dove l'utente l'ha
// inserito (la stessa regola di Inventario e Performance prodotti). Serve al margine: sapere che si
// e' sopra il mercato non basta, bisogna sapere quanto margine resta scendendo a quel prezzo.
export async function nostriConCosti(ws, store, token) {
  const [articoli, costi, landed] = await Promise.all([
    nostriArticoli(store, token),
    fetchVariantsForCost(store, token).catch(() => ({ products: [] })),
    loadLatestLanded(ws).catch(() => new Map()),
  ])
  const costo = new Map()
  for (const p of (costi.products || [])) for (const v of p.variants) if (v.shopifyCost != null) costo.set(v.variant_id, v.shopifyCost)
  for (const [v, c] of landed) if (c != null) costo.set(v, c)
  for (const a of articoli) { const c = costo.get(a.variantId); a.costo = c != null && c > 0 ? +Number(c).toFixed(2) : null }
  return articoli
}

export const leggiConcorrenti = (ws) => leggiImpostazioni(ws, 'concorrenti', { domini: [] })
export const scriviConcorrenti = (ws, domini) => scriviImpostazioni(ws, 'concorrenti', { domini })

// Una passata su un concorrente: legge, abbina, salva SOLO gli abbinamenti e due conti.
export async function passata(ws, dominio, miei) {
  const t0 = Date.now()
  try {
    const catalogo = await leggiCatalogo(dominio)
    const trovati = abbina(miei, preparaConcorrente(catalogo))
    const esito = { ok: true, dominio, letto: new Date().toISOString(), prodotti: catalogo.length, abbinati: trovati.length, esatti: trovati.filter(x => x.livello === 'esatto').length, ms: Date.now() - t0, offerte: trovati }
    await setSnapshot(ws, `prezzi:${dominio}`, esito)
    return esito
  } catch (e) {
    // una lettura fallita NON cancella l'ultima buona: si annota l'errore accanto
    const prima = (await getSnapshotStale(ws, `prezzi:${dominio}`))?.payload
    const esito = { ...(prima || { dominio, offerte: [] }), ok: false, errore: String(e?.message || e).slice(0, 140), provato: new Date().toISOString() }
    await setSnapshot(ws, `prezzi:${dominio}`, esito)
    return esito
  }
}

export async function passataCompleta(ws, store, token) {
  const { domini } = await leggiConcorrenti(ws)
  const miei = await nostriConCosti(ws, store, token)
  await setSnapshot(ws, 'prezzi:nostri', { letto: new Date().toISOString(), articoli: miei })
  const esiti = []
  for (let k = 0; k < domini.length; k += 3) esiti.push(...await Promise.all(domini.slice(k, k + 3).map(d => passata(ws, d.dominio, miei))))
  // Il prezzo di mercato di Google (se l'accesso c'e'): una lettura fallita non cancella l'ultima buona.
  let mercato = null
  if (merchantConfigurato()) {
    try { const m = await prezziDiMercato(); await setSnapshot(ws, 'prezzi:mercato', { letto: new Date().toISOString(), periodi: m.periodi, righe: m.righe }); mercato = { ok: true, righe: m.righe.length } }
    catch (e) { mercato = { ok: false, errore: String(e?.message || e).slice(0, 200) } }
  }
  return { articoli: miei.length, mercato, esiti: esiti.map(({ offerte, ...r }) => r) }
}

// La tabella della tab Prezzi: i nostri articoli con, per ognuno, le offerte trovate.
export async function quadro(ws) {
  const { domini } = await leggiConcorrenti(ws)
  const nostri = (await getSnapshotStale(ws, 'prezzi:nostri'))?.payload
  const perSku = new Map()
  const stato = []
  for (const d of domini) {
    const s = (await getSnapshotStale(ws, `prezzi:${d.dominio}`))?.payload
    stato.push({ dominio: d.dominio, ok: s?.ok ?? null, letto: s?.letto || null, errore: s?.ok === false ? s.errore : null, prodotti: s?.prodotti ?? null, abbinati: s?.abbinati ?? null, esatti: s?.esatti ?? null })
    for (const o of (s?.offerte || [])) { if (!perSku.has(o.sku)) perSku.set(o.sku, []); perSku.get(o.sku).push({ dominio: d.dominio, livello: o.livello, prezzo: o.prezzo, pieno: o.pieno, disponibile: o.disponibile, url: `https://${d.dominio}/products/${o.handle}` }) }
  }
  const mercatoSalvato = (await getSnapshotStale(ws, 'prezzi:mercato'))?.payload
  // L'aliquota di ogni prodotto dalle righe d'ordine di Shopify. Ultimo ripiego:
  // quella regolabile del workspace (la stessa dei Verdetti Google), non un 22
  // scritto qui — cosi' un cliente tedesco senza vendite lette parte dal suo 19.
  const tabellaIva = await aliquoteProdotti().catch(() => null)
  const ripiegoIva = soglieValide(await leggiImpostazioni(ws, 'googleVerdetti', {}).catch(() => ({}))).iva
  const perVariante = new Map((mercatoSalvato?.righe || []).filter(r => r.variantId).map(r => [r.variantId, r]))
  const righe = []
  for (const a of (nostri?.articoli || [])) {
    const offerte = perSku.get(a.sku) || []
    const g = a.variantId ? perVariante.get(a.variantId) : null
    if (!offerte.length && !g) continue
    // Il confronto di prezzo vale SOLO sullo stesso colore (Marino, 24 set 2026). Un altro colore
    // dello stesso modello, in molti marchi, e' un prodotto di un'altra stagione in saldo: prima
    // finiva nel confronto e diceva «sei piu' caro del 67%» su un articolo nuovo. Ora quell'offerta
    // si vede lo stesso, ma a parte, e non entra ne' nello scarto ne' nei conti della tabella.
    const piuBasso = (voci) => { const valide = voci.filter(o => o.disponibile !== false); return (valide.length ? valide : voci).reduce((m, o) => (o.prezzo < m.prezzo ? o : m)) }
    const esatte = offerte.filter(o => o.livello === 'esatto')
    const altriColori = offerte.filter(o => o.livello !== 'esatto')
    const minimo = esatte.length ? piuBasso(esatte) : null
    const altroColore = altriColori.length ? piuBasso(altriColori) : null
    const pct = (rif) => (a.prezzo > 0 && rif > 0 ? +(((a.prezzo - rif) / rif) * 100).toFixed(1) : null)
    // margine: il prezzo e' IVA compresa, il costo no. L'aliquota e' quella del
    // PRODOTTO (olio al 4, taralli al 10, gadget al 22), non una sola per tutti.
    const { aliquota: aliquotaIva, fonte: fonteIva } = aliquotaDi(a.productId, tabellaIva, ripiegoIva)
    const margineA = (prezzo) => (a.costo != null && prezzo > 0 ? +(senzaIva(prezzo, aliquotaIva) - a.costo).toFixed(2) : null)
    const margine = margineA(a.prezzo)
    righe.push({ ...a, offerte, minimo, scarto: minimo ? pct(minimo.prezzo) : null,
      altroColore, scartoAltroColore: altroColore ? pct(altroColore.prezzo) : null,
      aliquotaIva, fonteIva,
      margine, marginePct: margine != null && a.prezzo > 0 ? +((margine / senzaIva(a.prezzo, aliquotaIva)) * 100).toFixed(1) : null,
      // Google conosce l'articolo ma nel report del traffico non c'e': in 30 giorni non ha avuto ne'
      // impressioni ne' clic (il report elenca solo chi ne ha avute). E' uno zero vero, non un dato mancante.
      clic: g ? (g.clic ?? 0) : null, impressioni: g ? (g.impressioni ?? 0) : null,
      traffico: g ? Object.fromEntries([7, 30, 90].map(n => [n, g.traffico?.[n] || (n === 30 && g.clic != null ? { clic: g.clic, impressioni: g.impressioni || 0 } : { clic: 0, impressioni: 0 })])) : null,
      mercato: g ? { prezzo: g.mercato ?? null, scarto: g.mercato != null ? pct(g.mercato) : null, margine: g.mercato != null ? margineA(g.mercato) : null,
        suggerito: g.suggerito ?? null, scartoSuggerito: g.suggerito ? pct(g.suggerito) : null, margineSuggerito: g.suggerito ? margineA(g.suggerito) : null,
        effettoClic: g.effettoClic ?? null, effettoImpressioni: g.effettoImpressioni ?? null, effettoConversioni: g.effettoConversioni ?? null, efficacia: g.efficacia ?? null } : null })
  }
  // l'ordine: prima dove il MERCATO dice che siamo cari, poi gli abbinamenti esatti coi concorrenti
  const peso = (r) => Math.max(r.mercato?.scarto ?? r.mercato?.scartoSuggerito ?? -999, r.minimo?.livello === 'esatto' ? (r.scarto ?? -999) : -999, r.minimo ? (r.scarto ?? -999) - 1000 : -999)
  righe.sort((x, y) => peso(y) - peso(x))
  // lo scarto che conta: sul prezzo di mercato; dove manca, sul prezzo suggerito; poi sulla casa madre
  const rif = (r) => r.mercato?.scarto ?? r.mercato?.scartoSuggerito ?? r.scarto
  const conScarto = righe.filter(r => rif(r) != null)
  // per marchio: quanti articoli confrontati e lo scarto medio
  const marchi = new Map()
  for (const r of conScarto) { const m = marchi.get(r.marchio) || { marchio: r.marchio, articoli: 0, somma: 0, piuCari: 0, clic: 0, impressioni: 0, t: { 7: 0, 30: 0, 90: 0 } }; m.articoli++; m.somma += rif(r); if (rif(r) > 1) m.piuCari++; m.clic += r.clic || 0; m.impressioni += r.impressioni || 0; for (const n of [7, 30, 90]) m.t[n] += r.traffico?.[n]?.clic || 0; marchi.set(r.marchio, m) }
  const perMarchio = [...marchi.values()].map(m => ({ marchio: m.marchio, articoli: m.articoli, piuCari: m.piuCari, clic: m.clic, impressioni: m.impressioni, clicPer: m.t, scartoMedio: +(m.somma / m.articoli).toFixed(1) })).sort((x, y) => y.articoli - x.articoli)
  // i marchi che su Google non vende NESSUN altro (nessun prezzo di mercato su nessun articolo, e
  // almeno 10 articoli): e' il marchio proprio. Li' il prezzo di mercato non puo' esistere.
  const conteggio = new Map()
  for (const r of righe) { const c = conteggio.get(r.marchio) || { tot: 0, mercato: 0 }; c.tot++; if (r.mercato?.prezzo != null) c.mercato++; conteggio.set(r.marchio, c) }
  const soloNostri = new Set([...conteggio].filter(([, c]) => c.tot >= 10 && c.mercato === 0).map(([m]) => m))
  for (const r of righe) if (soloNostri.has(r.marchio)) r.soloNoi = true
  // chi resta SENZA confronto, per marchio: Google da' il prezzo di mercato solo dove altri negozi
  // pubblicizzano lo stesso EAN (il marchio proprio, per definizione, non ce l'ha nessun altro)
  const confrontati = new Set(righe.map(r => r.sku)), senza = new Map()
  for (const a of (nostri?.articoli || [])) if (!confrontati.has(a.sku)) senza.set(a.marchio, (senza.get(a.marchio) || 0) + 1)
  const senzaConfronto = [...senza].map(([marchio, articoli]) => ({ marchio, articoli })).sort((x, y) => y.articoli - x.articoli)
  return { senzaConfronto, concorrenti: stato, articoliNostri: nostri?.articoli?.length || 0, letto: nostri?.letto || null, righe, perMarchio,
    mercato: { configurato: merchantConfigurato(), letto: mercatoSalvato?.letto || null, periodi: mercatoSalvato?.periodi || null, articoli: perVariante.size, conMercato: righe.filter(r => r.mercato?.prezzo != null).length, conSuggerito: righe.filter(r => r.mercato?.suggerito != null).length },
    sintesi: { confrontati: righe.length, piuCari: conScarto.filter(r => rif(r) > 1).length, allineati: conScarto.filter(r => Math.abs(rif(r)) <= 1).length, piuEconomici: conScarto.filter(r => rif(r) < -1).length } }
}
