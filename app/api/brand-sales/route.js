export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'
import { getRange } from '../../../lib/metaRange'
import { swrSnapshot } from '../../../lib/cache/swr'
import { KOONGO_EXCLUDE, isKoongoOrder } from '../../../lib/shopify/koongo'
import { shopifyql } from '../../../lib/shopify/shopifyql'

// ============================================================================
//  Brand e categorie più venduti nel periodo.
//
//  Il BRAND è il vendor del prodotto su Shopify (GUESS, BORBONESE, FURLA…) e
//  ShopifyQL lo sa raggruppare da solo. La CATEGORIA invece non c'è dove
//  Shopify la cerca: `product_type` è vuoto su tutto il catalogo e la
//  categoria standard è "Uncategorized". Il negozio la tiene nei metafield
//  `pdp.categoria` (BORSE, ACCESSORI, SCARPE…) e `pdp.sub_categoria` (BORSE A
//  SPALLA, PORTAFOGLI…). Quindi: vendite per prodotto da ShopifyQL, e per ogni
//  prodotto venduto la sua categoria letta dai metafield.
//
//  Senza marketplace (Koongo), come il resto delle metriche del KPI Brain.
//
//  GET ?since=YYYY-MM-DD&until=YYYY-MM-DD   oppure   ?preset=last_30d
//      (anche preset=custom_<since>_<until>, il formato del Cervello)
// ============================================================================

const money = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0 }
const count = (v) => { const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : 0 }
const r1 = (n) => Math.round(n * 10) / 10
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function gql(query, variables) {
  const { storeUrl, adminToken } = getShopify()
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`https://${storeUrl}/admin/api/2026-04/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': adminToken || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    })
    const json = await res.json().catch(() => null)
    const errs = json?.errors || []
    const ts = json?.extensions?.cost?.throttleStatus
    const throttled = res.status === 429 || errs.some(e => /throttl/i.test(e?.message || '') || e?.extensions?.code === 'THROTTLED')
    if (throttled && attempt < 4) { await sleep(1000 * attempt); continue }
    if (!res.ok || errs.length) throw new Error(errs[0]?.message || `Shopify HTTP ${res.status}`)
    // Il bucket si svuota con le pagine di metafield: se e' quasi a zero si
    // aspetta un attimo prima della prossima, invece di farsi strozzare dopo.
    if (ts && ts.currentlyAvailable < 200) await sleep(1200)
    return json.data
  }
  throw new Error('Shopify: troppe richieste, riprova fra poco')
}

// Un errore di ShopifyQL NON deve diventare "nessuna vendita": si propaga.
// Dalla porta unica (lib/shopify/shopifyql.js): cache per interrogazione, passo al minuto,
// ultimo dato buono se Shopify rifiuta. Il vecchio ritento locale non riconosceva "Rate limited".
async function shopifyQL(q) {
  return shopifyql(q)
}

// Anagrafica per prodotto: categoria, sottocategoria, immagine. Cambia di rado
// e un anno di vendite tocca oltre mille prodotti: si tiene in memoria qualche
// ora, cosi' cambiare periodo non rilegge il catalogo da capo.
const META_TTL = 6 * 60 * 60 * 1000
const metaCache = new Map() // `${store}|${productId}` → { at, v }

// Le varianti arrivano come edges/node (forma usata da tutte le altre route
// del repo); si accetta anche nodes, cosi' il codice non si rompe se un giorno
// la query cambia forma.
function varianti(nodo) {
  if (Array.isArray(nodo?.variants?.nodes)) return nodo.variants.nodes
  return (nodo?.variants?.edges || []).map(e => e?.node).filter(Boolean)
}

// La prima grafia di metacampo che risponde. Nessuna = nessuna categoria, non un errore.
const primoValore = (nodo, chiavi) => {
  for (const k of chiavi) { const v = (nodo?.[k]?.value || '').trim(); if (v) return v.toUpperCase() }
  return null
}

const GENDER_ALIAS = { g1: 'pdp.gender', g2: 'pdp.genere', g3: 'custom.gender', g4: 'custom.genere' }

// Il valore puo' arrivare scritto in molti modi: si riporta a UOMO/DONNA/UNISEX
// e, se non lo riconosce, si tiene il testo originale invece di buttarlo.
function generoDi(nodo) {
  for (const alias of Object.keys(GENDER_ALIAS)) {
    const grezzo = (nodo?.[alias]?.value || '').trim()
    if (!grezzo) continue
    const v = grezzo.toLowerCase()
    let nome = grezzo.toUpperCase()
    if (/^(uomo|man|men|male|m|homme|hombre|herren)$/.test(v)) nome = 'UOMO'
    else if (/^(donna|woman|women|female|f|femme|mujer|damen)$/.test(v)) nome = 'DONNA'
    else if (/^(unisex|both)$/.test(v)) nome = 'UNISEX'
    else if (/(bambin|kid|child|junior)/.test(v)) nome = 'BAMBINO'
    return { gender: nome, genderKey: GENDER_ALIAS[alias] }
  }
  return { gender: null, genderKey: null }
}

// In saldo = almeno una variante ha il prezzo barrato piu' alto del prezzo.
// Lo sconto riportato e' il piu' profondo fra le varianti lette.
function saldoDi(listaVarianti) {
  let max = 0
  for (const v of listaVarianti) {
    const pieno = Number(v?.compareAtPrice || 0), ora = Number(v?.price || 0)
    if (pieno > ora && pieno > 0) max = Math.max(max, Math.round((1 - ora / pieno) * 100))
  }
  return { onSale: max > 0, discountPct: max || null }
}

// Prezzo di listino pieno del prodotto: il barrato se c'e', altrimenti il
// prezzo attuale piu' alto fra le varianti. Serve come riferimento per capire
// se una riga d'ordine e' stata venduta sotto il pieno.
function listinoPieno(listaVarianti) {
  let rif = 0
  for (const v of listaVarianti) {
    const barrato = Number(v?.compareAtPrice || 0), ora = Number(v?.price || 0)
    rif = Math.max(rif, barrato > 0 ? barrato : ora)
  }
  return rif || null
}

async function productMeta(ids) {
  const { storeUrl } = getShopify()
  const out = new Map()
  const missing = []
  for (const id of ids) {
    const hit = metaCache.get(`${storeUrl}|${id}`)
    if (hit && Date.now() - hit.at < META_TTL) out.set(id, hit.v)
    else missing.push(id)
  }
  // I metacampi delle categorie: sul fork erano solo `pdp.categoria` e `pdp.sub_categoria`, perche'
  // erano quelli di QUEL negozio. Qui i clienti sono tanti e ognuno chiama i suoi come vuole, quindi
  // si chiedono piu' grafie e vince la prima che risponde: chi non ne ha nessuna resta senza
  // categorie (e la quota di fatturato senza categoria viene dichiarata piu' sotto), non in errore.
  const Q = `query N($ids:[ID!]!){ nodes(ids:$ids){ ... on Product { id title handle vendor
    categoria: metafield(namespace:"pdp", key:"categoria"){ value }
    c2: metafield(namespace:"custom", key:"categoria"){ value }
    c3: metafield(namespace:"custom", key:"category"){ value }
    sub: metafield(namespace:"pdp", key:"sub_categoria"){ value }
    s2: metafield(namespace:"custom", key:"sub_categoria"){ value }
    s3: metafield(namespace:"custom", key:"subcategory"){ value }
    g1: metafield(namespace:"pdp", key:"gender"){ value }
    g2: metafield(namespace:"pdp", key:"genere"){ value }
    g3: metafield(namespace:"custom", key:"gender"){ value }
    g4: metafield(namespace:"custom", key:"genere"){ value }
    variants(first: 5) { edges { node { price compareAtPrice } } }
    featuredMedia { preview { image { url(transform:{ maxWidth: 200 }) } } } } } }`
  for (let i = 0; i < missing.length; i += 100) {
    const batch = missing.slice(i, i + 100)
    const data = await gql(Q, { ids: batch.map(id => `gid://shopify/Product/${id}`) })
    for (const n of data?.nodes || []) {
      if (!n?.id) continue
      const id = n.id.split('/').pop()
      const v = {
        title: n.title,
        handle: n.handle,
        vendor: (n.vendor || '').trim() || null,
        category: primoValore(n, ['categoria', 'c2', 'c3']),
        subCategory: primoValore(n, ['sub', 's2', 's3']),
        image: n.featuredMedia?.preview?.image?.url || null,
        ...saldoDi(varianti(n)),
        listPrice: listinoPieno(varianti(n)),
        ...generoDi(n),
      }
      metaCache.set(`${storeUrl}|${id}`, { at: Date.now(), v })
      out.set(id, v)
    }
  }
  if (metaCache.size > 20000) metaCache.clear()
  return out
}

// ── Saldi dagli ORDINI ───────────────────────────────────────────────────────
// Il listino di oggi non sa cosa e' successo un mese fa. L'ordine si': conserva
// il prezzo pagato in quel momento e gli sconti applicati. Qui si legge quello.
//
// Due segnali, in OR: uno sconto registrato sulla riga (codice o automatico,
// discount_allocations copre anche quelli a livello ordine) oppure un prezzo
// unitario sotto il listino pieno del prodotto (il caso dei saldi fatti
// riprezzando la variante, dove Shopify non registra nessuno sconto).
//
// I campi source_name/tags/app_id servono a isKoongoOrder: senza, i saldi
// conterebbero i marketplace mentre il resto della sezione brand li esclude.
const ORDER_FIELDS = 'id,created_at,taxes_included,line_items,refunds,cancelled_at,source_name,tags,app_id'

async function shopFetch(url, token) {
  for (let tentativo = 0; tentativo < 6; tentativo++) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': token }, cache: 'no-store' })
    if (res.status === 429 || res.status === 430) {
      await sleep((Number(res.headers.get('Retry-After')) || 2) * 1000)
      continue
    }
    return res
  }
  return null
}

// Errore di permesso: senza read_all_orders Shopify rifiuta gli ordini oltre
// i 60 giorni. Va riconosciuto, non confuso con un periodo senza vendite.
function permessoNegato(res, corpo) {
  if (!res) return false
  if (res.status === 403) return true
  return /read_all_orders|requires merchant approval/i.test(String(corpo || ''))
}

async function paginaFinestra(store, token, sinceISO, untilISO, onOrder, budget) {
  let url = `https://${store}/admin/api/2024-01/orders.json?status=any&financial_status=paid` +
    `&created_at_min=${encodeURIComponent(sinceISO)}&created_at_max=${encodeURIComponent(untilISO)}` +
    `&limit=250&fields=${ORDER_FIELDS}`
  for (let pagina = 0; pagina < 200 && url; pagina++) {
    if (Date.now() > budget.scadenza) { budget.parziale = true; return }
    const res = await shopFetch(url, token)
    if (!res) { budget.parziale = true; return }
    if (!res.ok) {
      const corpo = await res.text().catch(() => '')
      if (permessoNegato(res, corpo)) { budget.negato = true; return }
      budget.parziale = true; return
    }
    const data = await res.json().catch(() => null)
    for (const o of (data?.orders || [])) {
      const t = Date.parse(o?.created_at || '')
      if (Number.isFinite(t) && (budget.piuVecchio == null || t < budget.piuVecchio)) budget.piuVecchio = t
      budget.ricevuti++
      onOrder(o)
    }
    const link = res.headers.get('Link') || res.headers.get('link') || ''
    const m = /<([^>]+)>;\s*rel="next"/.exec(link)
    url = m ? m[1] : null
  }
}

async function saldiDagliOrdini(range, meta, scadenza) {
  const { storeUrl: store, adminToken: token } = getShopify()
  if (!store || !token) return null
  const budget = { scadenza, parziale: false, negato: false, piuVecchio: null, ricevuti: 0 }
  const perBrand = new Map()
  const perProdotto = new Map()

  const onOrder = (o) => {
    if (isKoongoOrder(o)) return
    if (o.cancelled_at) return

    // Resi RIGA PER RIGA. Il fatturato del brand arriva da ShopifyQL
    // (total_sales / net_items_sold), che e' gia' al netto dei resi: se qui
    // contassi i pezzi resi come venduti, la stessa riga mostrerebbe due
    // universi diversi. metrics/route.js somma gli importi delle transazioni
    // di rimborso, che va bene per un totale ma non dice QUALE riga e'
    // tornata indietro: per attribuire i pezzi a pieno o scontato serve
    // refund_line_items, che arriva dentro refunds.
    const resePerRiga = new Map()
    for (const r of (o.refunds || [])) {
      for (const rl of (r.refund_line_items || [])) {
        const idRiga = rl?.line_item_id != null ? String(rl.line_item_id) : null
        if (!idRiga) continue
        resePerRiga.set(idRiga, (resePerRiga.get(idRiga) || 0) + count(rl.quantity))
      }
    }

    for (const li of (o.line_items || [])) {
      if (li.gift_card) continue
      const pid = li.product_id != null ? String(li.product_id) : null
      if (!pid) continue
      const m = meta.get(pid) || {}
      const brand = (li.vendor || m.vendor || '').trim()
      if (!brand) continue
      const qtyVenduta = count(li.quantity)
      if (qtyVenduta <= 0) continue
      const qtyResa = resePerRiga.get(String(li.id)) || 0
      const qty = qtyVenduta - qtyResa
      if (qty <= 0) continue // riga resa per intero: non e' un pezzo venduto
      // Sconto e tasse stanno sulla riga INTERA: vanno scalati sulla parte
      // rimasta, altrimenti un reso parziale gonfierebbe lo sconto per pezzo.
      const quotaRimasta = qty / qtyVenduta
      const allocs = Array.isArray(li.discount_allocations)
        ? li.discount_allocations.reduce((s2, a) => s2 + money(a.amount), 0) : 0
      const sconto = (allocs > 0 ? allocs : money(li.total_discount)) * quotaRimasta
      const tasse = (o.taxes_included && Array.isArray(li.tax_lines)
        ? li.tax_lines.reduce((s2, tl) => s2 + money(tl.price), 0) : 0) * quotaRimasta
      const unitario = money(li.price)
      const ricavo = unitario * qty - sconto - tasse
      const rif = m.listPrice || null
      // Sconto registrato, oppure venduto sotto il listino pieno.
      // Un reso non cambia il prezzo a cui la riga fu venduta: la
      // classificazione resta sul prezzo unitario, non sugli importi scalati.
      const scontata = (allocs > 0 ? allocs : money(li.total_discount)) > 0.009 || (rif && unitario < rif - 0.01)
      const pctRiga = rif && unitario < rif ? Math.round((1 - unitario / rif) * 100) : null

      if (!perBrand.has(brand)) perBrand.set(brand, { saleUnits: 0, fullUnits: 0, saleRevenue: 0, fullRevenue: 0 })
      const b = perBrand.get(brand)
      if (scontata) { b.saleUnits += qty; b.saleRevenue += ricavo }
      else { b.fullUnits += qty; b.fullRevenue += ricavo }

      const chiave = `${brand}|${pid}|${scontata ? 's' : 'f'}`
      if (!perProdotto.has(chiave)) {
        perProdotto.set(chiave, {
          productId: pid, brand, onSale: scontata,
          title: m.title || li.title || '—', image: m.image || null,
          units: 0, revenue: 0, discountPct: null,
        })
      }
      const pr = perProdotto.get(chiave)
      pr.units += qty; pr.revenue += ricavo
      if (pctRiga != null) pr.discountPct = Math.max(pr.discountPct || 0, pctRiga)
    }
  }

  const inizio = new Date(`${range.since}T00:00:00Z`).getTime()
  const fine = new Date(`${range.until}T23:59:59Z`).getTime()
  const giorni = Math.max(1, (fine - inizio) / 86400000)
  const FINESTRE = Math.min(6, Math.max(1, Math.ceil(giorni / 10)))
  const ampiezza = (fine - inizio) / FINESTRE
  const finestre = []
  for (let i = 0; i < FINESTRE; i++) {
    const da = inizio + i * ampiezza + (i > 0 ? 1000 : 0)
    const a = (i === FINESTRE - 1) ? fine : inizio + (i + 1) * ampiezza
    finestre.push([new Date(da).toISOString(), new Date(a).toISOString()])
  }
  await Promise.all(finestre.map(([d, a]) => paginaFinestra(store, token, d, a, onOrder, budget)))

  // Copertura parziale = numeri che sembrano giusti e non lo sono: si scarta
  // tutto e si torna al listino per l'INTERO periodo, dichiarandolo.
  // Senza read_all_orders Shopify NON da' errore: risponde 200 e semplicemente
  // non consegna gli ordini oltre i 60 giorni. Fidarsi del codice di stato
  // significherebbe dichiarare "calcolato sugli ordini" su un periodo coperto
  // solo in parte. Percio' la copertura si misura sui dati ricevuti, e solo
  // quando il periodo si spinge oltre quella finestra — cosi' un periodo
  // recente ma senza vendite non viene scambiato per un troncamento.
  const inizioRichiesto = new Date(`${range.since}T00:00:00Z`).getTime()
  if (inizioRichiesto < fine - 59 * 86400000) {
    const nessunOrdine = budget.ricevuti === 0
    const mancaLInizio = budget.piuVecchio != null && budget.piuVecchio > inizioRichiesto + 2 * 86400000
    if (nessunOrdine || mancaLInizio) return { negato: true }
  }

  if (budget.negato) return { negato: true }
  if (budget.parziale) return { parziale: true }
  return { perBrand, prodotti: [...perProdotto.values()] }
}

function resolveRange(sp) {
  const since = sp.get('since'), until = sp.get('until')
  if (since && until) return { since, until }
  const preset = sp.get('preset') || 'last_30d'
  const m = preset.match(/^custom_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/)
  if (m) return { since: m[1], until: m[2] }
  return getRange(preset, sp)
}

function previousOf(range) {
  const d0 = new Date(`${range.since}T00:00:00Z`), d1 = new Date(`${range.until}T00:00:00Z`)
  const len = Math.round((d1 - d0) / 86400000) + 1
  const until = new Date(d0.getTime() - 86400000)
  const since = new Date(until.getTime() - (len - 1) * 86400000)
  return { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) }
}

// NOTA sul suffisso @N nei nomi tab qui sotto: la chiave di cache e'
// `tab:periodo` e NON contiene la forma del payload. Aggiungendo campi alla
// risposta, gli snapshot salvati prima restano validi fino a 24 ore e i campi
// nuovi arrivano al client semplicemente assenti — senza errori. Quando cambia
// la FORMA della risposta, alzare il numero.
const W = `WHERE ${KOONGO_EXCLUDE}`

async function compute(range, prevRange) {
  // In fila, non in parallelo: Shopify strozza le raffiche di ShopifyQL.
  const brandRows = await shopifyQL(`FROM sales SHOW total_sales, orders, net_items_sold ${W} GROUP BY product_vendor SINCE ${range.since} UNTIL ${range.until} ORDER BY total_sales DESC LIMIT 300`)
  const productRows = await shopifyQL(`FROM sales SHOW total_sales, net_items_sold ${W} GROUP BY product_id, product_vendor SINCE ${range.since} UNTIL ${range.until} ORDER BY total_sales DESC LIMIT 5000`)
  const prevRows = await shopifyQL(`FROM sales SHOW total_sales, orders ${W} GROUP BY product_vendor SINCE ${prevRange.since} UNTIL ${prevRange.until} ORDER BY total_sales DESC LIMIT 300`)

  // La riga senza vendor e' spedizione/rettifiche non legate a un prodotto:
  // non e' un brand e non entra nelle quote.
  const brands = brandRows.filter(r => r.product_vendor).map(r => ({
    brand: String(r.product_vendor).trim(),
    revenue: money(r.total_sales), orders: count(r.orders), units: count(r.net_items_sold),
  }))
  const totalRevenue = brands.reduce((s, b) => s + b.revenue, 0)
  const prevByBrand = new Map(prevRows.filter(r => r.product_vendor).map(r => [String(r.product_vendor).trim(), money(r.total_sales)]))

  const ids = [...new Set(productRows.map(r => r.product_id).filter(Boolean).map(String))]
  const meta = await productMeta(ids)

  // Prezzo pagato DAVVERO nel periodo: il listino di oggi non sa cosa e'
  // successo un mese fa. Budget di 35s perche' il resto della route (tre query
  // ShopifyQL + lotti metafield) stia dentro maxDuration = 60.
  const daOrdini = await saldiDagliOrdini(range, meta, Date.now() + 35000).catch(() => null)
  const ordiniOk = !!(daOrdini && daOrdini.perBrand)
  const metodoSaldi = ordiniOk ? 'orders' : 'catalog'
  const ripiegoSaldi = ordiniOk ? null : (daOrdini?.negato ? 'scope' : daOrdini?.parziale ? 'timeout' : null)

  const byBrand = new Map() // brand → { cats: Map(cat → { revenue, units, subs: Map }), products: [] }
  const allCats = new Map()
  const allProducts = []
  let categorised = 0, productRevenue = 0
  let saleUnitsTot = 0, fullUnitsTot = 0, saleRevenueTot = 0, fullRevenueTot = 0
  const allGenders = new Map()
  let genderedRevenue = 0, genderKeyUsata = null
  for (const r of productRows) {
    if (!r.product_id || !r.product_vendor) continue
    const brand = String(r.product_vendor).trim()
    const m = meta.get(String(r.product_id)) || {}
    const revenue = money(r.total_sales), units = count(r.net_items_sold)
    productRevenue += revenue
    if (m.category) categorised += revenue
    const cat = m.category || null
    const sub = m.subCategory || null
    if (!byBrand.has(brand)) byBrand.set(brand, { cats: new Map(), products: [], genders: new Map(), saleUnits: 0, fullUnits: 0, saleRevenue: 0, fullRevenue: 0 })
    const b = byBrand.get(brand)
    if (!b.cats.has(cat)) b.cats.set(cat, { revenue: 0, units: 0, subs: new Map() })
    const c = b.cats.get(cat)
    c.revenue += revenue; c.units += units
    if (!c.subs.has(sub)) c.subs.set(sub, { revenue: 0, units: 0 })
    c.subs.get(sub).revenue += revenue; c.subs.get(sub).units += units
    if (m.gender) {
      if (!b.genders.has(m.gender)) b.genders.set(m.gender, { revenue: 0, units: 0 })
      const g = b.genders.get(m.gender)
      g.revenue += revenue; g.units += units
      genderedRevenue += revenue
      if (m.genderKey) genderKeyUsata = m.genderKey
      if (!allGenders.has(m.gender)) allGenders.set(m.gender, { revenue: 0, units: 0 })
      const ag = allGenders.get(m.gender)
      ag.revenue += revenue; ag.units += units
    }
    const inSaldo = !!m.onSale
    if (inSaldo) { b.saleUnits += units; b.saleRevenue += revenue; saleUnitsTot += units; saleRevenueTot += revenue }
    else { b.fullUnits += units; b.fullRevenue += revenue; fullUnitsTot += units; fullRevenueTot += revenue }
    const item = { productId: String(r.product_id), title: m.title || '—', brand, category: cat, subCategory: sub, image: m.image || null, revenue, units, onSale: inSaldo, discountPct: m.discountPct || null }
    b.products.push(item)
    allProducts.push(item)
    if (!allCats.has(cat)) allCats.set(cat, { revenue: 0, units: 0 })
    allCats.get(cat).revenue += revenue; allCats.get(cat).units += units
  }

  const sortRev = (a, b) => b.revenue - a.revenue
  const outBrands = brands.map(b => {
    const agg = byBrand.get(b.brand)
    const catTotal = agg ? [...agg.cats.values()].reduce((s, c) => s + c.revenue, 0) : 0
    const prev = prevByBrand.get(b.brand) || 0
    return {
      ...b,
      share: totalRevenue > 0 ? r1((b.revenue / totalRevenue) * 100) : 0,
      prevRevenue: prev,
      deltaPct: prev > 0 ? r1(((b.revenue - prev) / prev) * 100) : null,
      categories: agg ? [...agg.cats.entries()].map(([name, c]) => ({
        name, revenue: money(c.revenue), units: c.units,
        share: catTotal > 0 ? r1((c.revenue / catTotal) * 100) : 0,
        subCategories: [...c.subs.entries()].map(([sn, s]) => ({
          name: sn, revenue: money(s.revenue), units: s.units,
          share: c.revenue > 0 ? r1((s.revenue / c.revenue) * 100) : 0,
        })).sort(sortRev),
      })).sort(sortRev) : [],
      topProducts: agg ? agg.products.sort(sortRev).slice(0, 6) : [],
      genders: agg ? [...agg.genders.entries()].map(([name, g]) => ({
        name, revenue: money(g.revenue), units: g.units,
        share: b.revenue > 0 ? r1((g.revenue / b.revenue) * 100) : 0,
      })).sort(sortRev) : [],
      ...(() => {
        // Dagli ordini prendo SOLO la divisione pieno/scontato: il fatturato
        // del brand resta quello di ShopifyQL, altrimenti la stessa riga
        // mostrerebbe due totali calcolati su basi diverse.
        const vuoto = { saleUnits: 0, fullUnits: 0, saleRevenue: 0, fullRevenue: 0 }
        const o = ordiniOk ? (daOrdini.perBrand.get(b.brand) || vuoto) : null
        const su = o ? o.saleUnits : (agg ? agg.saleUnits : 0)
        const fu = o ? o.fullUnits : (agg ? agg.fullUnits : 0)
        const sr = o ? o.saleRevenue : (agg ? agg.saleRevenue : 0)
        const fr = o ? o.fullRevenue : (agg ? agg.fullRevenue : 0)
        const lista = ordiniOk
          ? daOrdini.prodotti.filter(x => x.brand === b.brand)
          : (agg ? agg.products : [])
        return {
          saleUnits: su, fullUnits: fu,
          saleRevenue: money(sr), fullRevenue: money(fr),
          salePct: (su + fu) > 0 ? r1((su / (su + fu)) * 100) : 0,
          saleProducts: lista.filter(p => p.onSale).sort(sortRev).slice(0, 25),
          fullProducts: lista.filter(p => !p.onSale).sort(sortRev).slice(0, 25),
        }
      })(),
    }
  })

  return {
    ok: true,
    range, previousRange: prevRange,
    marketplaceExcluded: true,
    totals: {
      revenue: money(totalRevenue),
      orders: brands.reduce((s, b) => s + b.orders, 0),
      units: brands.reduce((s, b) => s + b.units, 0),
      brands: brands.length,
      saleUnits: ordiniOk ? [...daOrdini.perBrand.values()].reduce((x, o) => x + o.saleUnits, 0) : saleUnitsTot,
      fullUnits: ordiniOk ? [...daOrdini.perBrand.values()].reduce((x, o) => x + o.fullUnits, 0) : fullUnitsTot,
      saleRevenue: money(ordiniOk ? [...daOrdini.perBrand.values()].reduce((x, o) => x + o.saleRevenue, 0) : saleRevenueTot),
      fullRevenue: money(ordiniOk ? [...daOrdini.perBrand.values()].reduce((x, o) => x + o.fullRevenue, 0) : fullRevenueTot),
    },
    // Quota del fatturato dei prodotti che ha una categoria nei metafield:
    // se scende, le quote per categoria vanno lette con cautela.
    // Quale metodo ha prodotto la divisione pieno/scontato, e perche'.
    saleMethod: metodoSaldi,
    saleFallback: ripiegoSaldi,
    categoryCoveragePct: productRevenue > 0 ? r1((categorised / productRevenue) * 100) : null,
    // Se la copertura e' 0 il metafield del genere ha un altro nome: si vede,
    // invece di mostrare una sezione vuota che sembra un problema di dati.
    genderCoveragePct: productRevenue > 0 ? r1((genderedRevenue / productRevenue) * 100) : null,
    genderKey: genderKeyUsata,
    genders: [...allGenders.entries()].map(([name, g]) => ({
      name, revenue: money(g.revenue), units: g.units,
      share: productRevenue > 0 ? r1((g.revenue / productRevenue) * 100) : 0,
    })).sort((a, b) => b.revenue - a.revenue),
    brands: outBrands,
    categories: [...allCats.entries()].map(([name, c]) => ({
      name, revenue: money(c.revenue), units: c.units,
      share: productRevenue > 0 ? r1((c.revenue / productRevenue) * 100) : 0,
    })).sort(sortRev),
    topProducts: allProducts.sort(sortRev).slice(0, 20),
    updatedAt: new Date().toISOString(),
  }
}

// Andamento giornaliero di UN brand, per il pop-up di dettaglio. I giorni senza
// vendite restano nella serie a zero: un buco nel grafico sembrerebbe un dato
// mancante, invece e' un giorno in cui quel brand non ha venduto.
async function computeDaily(range, brand) {
  // Un apice nel nome (es. GAUDI') romperebbe la stringa ShopifyQL: in quel caso
  // si raggruppa anche per vendor e si filtra qui, invece di indovinare l'escape.
  const rows = /'/.test(brand)
    ? (await shopifyQL(`FROM sales SHOW total_sales, orders ${W} GROUP BY day, product_vendor SINCE ${range.since} UNTIL ${range.until} ORDER BY day ASC LIMIT 20000`))
        .filter(r => String(r.product_vendor || '').trim() === brand)
    : await shopifyQL(`FROM sales SHOW total_sales, orders ${W} AND product_vendor = '${brand}' GROUP BY day SINCE ${range.since} UNTIL ${range.until} ORDER BY day ASC`)
  const byDay = new Map(rows.map(r => [String(r.day).slice(0, 10), { revenue: money(r.total_sales), orders: count(r.orders) }]))
  const daily = []
  for (let d = new Date(`${range.since}T00:00:00Z`); d <= new Date(`${range.until}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10)
    daily.push({ date: key, ...(byDay.get(key) || { revenue: 0, orders: 0 }) })
  }
  return { ok: true, brand, range, daily, updatedAt: new Date().toISOString() }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { storeUrl, adminToken } = getShopify()
    if (!storeUrl || !adminToken) return NextResponse.json({ ok: false, configured: false, error: 'Shopify non collegato' })
    const { searchParams } = new URL(req.url)
    const range = resolveRange(searchParams)
    if (!range?.since || !range?.until) return NextResponse.json({ ok: false, error: 'Periodo non valido' }, { status: 400 })
    const prevRange = previousOf(range)
    const brand = (searchParams.get('brand') || '').trim()
    if (brand && searchParams.get('breakdown') === 'daily') {
      return swrSnapshot(req, { tab: 'brandSalesDaily@2', ttlMs: 30 * 60 * 1000, compute: async () => {
        try { return await computeDaily(range, brand) }
        catch (e) { return { ok: false, error: e?.message || 'Errore Shopify', brand, __noCache: true } }
      } })
    }
    return swrSnapshot(req, { tab: 'brandSales@4', ttlMs: 30 * 60 * 1000, compute: async () => {
      try {
        return await compute(range, prevRange)
      } catch (e) {
        return { ok: false, error: e?.message || 'Errore Shopify', range, __noCache: true }
      }
    } })
  })
}
