export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { withTenantContext, getShopify, getGoogle, getTenantInfo, getEffectiveTenantId } from '../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { tipoNegozio } from '../../../lib/team/tipoNegozio'
import { swrSnapshot } from '../../../lib/cache/swr'
import { getRange } from '../../../lib/metaRange'
import { conSoloAcquisti, CAMPO_CATEGORIA } from '../../../lib/ads/googleAcquisti'
import { shopifyql } from '../../../lib/shopify/shopifyql'
import { soglieValide, improntaSoglie } from '../../../lib/ads/soglieVerdetti'
import { aliquoteProdotti, aliquotaDi } from '../../../lib/fiscal/aliquote'
import { leggiImpostazioni } from '../../../lib/impostazioni'

// ============================================================================
//  Prodotti Google: verdetti SCALA / STAND-BY / UCCIDI, riconciliati con le
//  vendite vere di Shopify.
//
//  Il punto della tab non e' mostrare il ROAS di Google — quello c'e' gia' in
//  "Prodotti Google". E' rispondere a "di chi mi posso fidare": Google
//  attribuisce una conversione al CLICK (con finestre e modelli di
//  attribuzione), Shopify registra l'ordine INCASSATO. Divergono sempre un po';
//  quando divergono troppo, il verdetto si sospende invece di consigliare.
//
//  Tre guardie, tutte pensate per NON dare consigli sbagliati:
//   1. SOGLIA DI SPESA — sotto, nessun verdetto: due click non sono un segnale.
//   2. COPERTURA DELL'ABBINAMENTO — se l'ID articolo Google non si aggancia a
//      un prodotto Shopify, il confronto direbbe "Google 10, Shopify 0" e il
//      verdetto sarebbe UCCIDI per un difetto di join, non per i dati.
//   3. SCARTO DI RICONCILIAZIONE — oltre una certa distanza fra valore
//      attribuito e fatturato reale, il dato si marca da verificare.
//
//  Le soglie NON sono inventate: nascono dal margine reale del conto economico
//  (ROAS di pareggio = 1 / margine). Se il margine non e' disponibile
//  (costi prodotto non inseriti) la tab lo dichiara e non emette verdetti:
//  meglio nessun consiglio che un consiglio fondato su un margine immaginario.
//
//  GET ?since=YYYY-MM-DD&until=YYYY-MM-DD  oppure  ?preset=last_30d
//
//  MULTI-CLIENTE. Tre cose che nel modulo d'origine erano costanti di UN negozio
//  qui sono scelte del cliente, e da vuote non filtrano niente:
//   · i canali di vendita da tenere fuori (i marketplace) → companies.canali_esclusi
//   · l'aliquota IVA da scorporare → fra le soglie, per workspace
//   · il metafield da cui nascono le macro categorie → impostazione del workspace
// ============================================================================

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const money = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0 }
const count = (v) => { const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(n * 100) / 100
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Sopra/sotto il pareggio di questa quota si decide. Non sono numeri "di
// mercato": sono la distanza dal TUO punto di pareggio. Le soglie sono SCELTE
// del cliente, non verita': i valori di partenza stanno in lib/ads/soglieVerdetti.js
// e si regolano dalla tab, per workspace.
//  · banda               quanto sotto il pareggio si tollera prima di fermare un
//    prodotto. NON e' piu' una banda simmetrica: sopra il pareggio si scala,
//    perche' le garanzie vere (ROAS minimo e scorte) sono retrocessioni a valle.
//  · rapportoPrezzoSpesa soglia di giudizio proporzionata al prodotto: si giudica
//    quando la spesa supera un quarto del prezzo di vendita. Una soglia fissa
//    tratterebbe allo stesso modo un portafoglio da 20 euro e una borsa da 400.
//  · sogliaRipiego       per i prodotti di cui non conosciamo il prezzo (non
//    abbinati): senza, resterebbero senza alcun criterio.
//  · scortaMinima        sotto questa giacenza non si scala: e' una regola di
//    magazzino, non di performance. Il prodotto resta buono, ma non c'e' merce.
//  · roasMinimo          sotto questo ROAS non si scala nemmeno col magazzino pieno.
//  · scartoMax           oltre questo scarto fra Google e Shopify il dato non e'
//    abbastanza solido per decidere.

function resolveRange(sp) {
  const since = sp.get('since'), until = sp.get('until')
  if (since && until) return { since, until }
  const preset = sp.get('preset') || 'last_30d'
  const m = preset.match(/^custom_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/)
  if (m) return { since: m[1], until: m[2] }
  return getRange(preset, sp)
}

// ── I canali di vendita che QUESTO cliente tiene fuori dai conti ────────────
// Nel modulo d'origine era una costante: i marketplace di quel negozio. Qui e'
// una dichiarazione del cliente (companies.canali_esclusi, vedi
// lib/team/tipoNegozio.js e supabase/tipo_negozio.sql). Elenco vuoto = NESSUN
// filtro, che e' il comportamento giusto per chi vende solo dal suo sito:
// escludere un canale che non ha vorrebbe dire escludere tutto il fatturato.
async function canaliEsclusiDi(workspaceId) {
  if (!workspaceId) return []
  try {
    const admin = getAdminSupabase()
    if (!admin) return []
    const { data } = await admin.from('companies').select('canali_esclusi').eq('user_id', workspaceId).maybeSingle()
    return tipoNegozio(data || {}).canaliEsclusi
  } catch { return [] }
}

// Clausola ShopifyQL, stringa vuota quando non c'e' niente da escludere.
// Un nome con un apice dentro si scarta invece di finire nella query: ShopifyQL
// non ha un escape affidabile e una query rotta tornerebbe come "nessuna vendita".
const clausolaCanali = (canali) => (canali || [])
  .filter(c => c && !String(c).includes("'"))
  .map(c => `sales_channel != '${String(c).trim()}'`).join(' AND ')

// L'Admin API non espone il canale di vendita: si guarda l'app che ha creato
// l'ordine, con i tag come conferma (stessa lettura di lib/shopify/koongo.js,
// ma sui nomi dichiarati dal cliente invece che su una costante).
function daCanaleEscluso(order, canali) {
  if (!order || !canali?.length) return false
  const app = String(order.app?.name || order.app_name || order.source_name || '').toLowerCase()
  const tags = Array.isArray(order.tags) ? order.tags : String(order.tags || '').split(',')
  return canali.some(c => {
    // Su ShopifyQL il canale ha il nome lungo ("Koongo: Sell on Marketplaces"),
    // l'app quello corto: si confronta sulla parte prima dei due punti.
    const corto = String(c || '').split(':')[0].trim().toLowerCase()
    if (!corto) return false
    if (app.includes(corto)) return true
    return tags.some(t => String(t).trim().toLowerCase() === corto)
  })
}

// ── Il metafield da cui nascono le macro categorie ──────────────────────────
// E' una convenzione del catalogo di ogni negozio (nel modulo d'origine era
// "pdp.categoria"). Si legge dall'impostazione del workspace: vuota = nessuna
// categoria, la fascia dei filtri non compare e la tabella non cambia.
function metafieldDi(v) {
  const s = String(v || '').trim()
  const i = s.indexOf('.')
  if (i <= 0 || i === s.length - 1) return null
  const ns = s.slice(0, i), key = s.slice(i + 1)
  // Il valore finisce dentro una query GraphQL: un apice li' dentro la romperebbe.
  if (!/^[A-Za-z0-9_-]+$/.test(ns) || !/^[A-Za-z0-9_-]+$/.test(key)) return null
  return { ns, key }
}

// ── Google: prodotti con costo, conversioni, valore ─────────────────────────
// metrics.orders esiste nella documentazione per le viste shopping ma non e'
// detto che l'account lo esponga: si tenta, e se l'account lo rifiuta si
// ripiega sulle metriche gia' provate invece di far cadere la tab.
// Periodo precedente di PARI lunghezza, che finisce il giorno prima: e' il
// solo confronto onesto: 30 giorni contro 30, non contro un mese di calendario.
function periodoPrecedente(range) {
  const iso = (t) => new Date(t).toISOString().slice(0, 10)
  const da = Date.parse(`${range.since}T00:00:00Z`)
  const a = Date.parse(`${range.until}T00:00:00Z`)
  if (!Number.isFinite(da) || !Number.isFinite(a) || a < da) return null
  const giorni = Math.round((a - da) / 86400000) + 1
  const fine = da - 86400000
  return { since: iso(fine - (giorni - 1) * 86400000), until: iso(fine) }
}

async function googleProdotti(range) {
  const g = getGoogle() || {}
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const customerId = (g.adsCustomerId || '').replace(/-/g, '')
  const mcc = (g.adsMccId || '').replace(/-/g, '')
  const { refreshToken, clientId, clientSecret } = g
  if (!devToken || !customerId || !refreshToken || !clientId || !clientSecret) {
    return { rows: [], error: 'Google non configurato' }
  }

  const tokRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  })
  const tok = await tokRes.json().catch(() => ({}))
  if (!tok.access_token) return { rows: [], error: 'OAuth Google fallito' }

  const headers = { Authorization: `Bearer ${tok.access_token}`, 'developer-token': devToken, 'Content-Type': 'application/json' }
  if (mcc) headers['login-customer-id'] = mcc

  // Spesa e clic da una lettura, gli ACQUISTI da una gemella: le conversioni
  // di Google comprendevano anche le aggiunte al carrello (googleAcquisti.js).
  const base = 'segments.product_item_id, segments.product_title, metrics.clicks, metrics.cost_micros'
  const baseAcquisti = `segments.product_item_id, ${CAMPO_CATEGORIA}, metrics.conversions, metrics.conversions_value`
  const where = `FROM shopping_performance_view WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`

  const esegui = async (select, soloAcquisti = false) => {
    const testo = soloAcquisti ? conSoloAcquisti(`SELECT ${select} ${where}`) : `SELECT ${select} ${where}`
    const res = await fetch(`https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`, {
      method: 'POST', headers, cache: 'no-store', body: JSON.stringify({ query: testo }),
    })
    if (!res.ok) return { ok: false, testo: (await res.text().catch(() => '')).slice(0, 200) }
    return { ok: true, dati: await res.json() }
  }

  const out = await esegui(base)
  if (!out.ok) return { rows: [], error: `Google Ads: ${out.testo}` }
  // Gli ordini veri esistono solo con i dati di carrello: se Google li
  // rifiuta si resta con le conversioni d'acquisto.
  let ordiniVeri = true
  let acq = await esegui(`${baseAcquisti}, metrics.orders`, true)
  if (!acq.ok) {
    ordiniVeri = false
    acq = await esegui(baseAcquisti, true)
    if (!acq.ok) return { rows: [], error: `Google Ads: ${acq.testo}` }
  }

  const agg = new Map()
  for (const chunk of (Array.isArray(out.dati) ? out.dati : [])) {
    for (const row of (chunk.results || [])) {
      const seg = row.segments || {}, m = row.metrics || {}
      const id = String(seg.productItemId ?? seg.product_item_id ?? '')
      if (!id) continue
      const p = agg.get(id) || { itemId: id, title: seg.productTitle ?? seg.product_title ?? '', clicks: 0, cost: 0, conversions: 0, convValue: 0, orders: 0 }
      p.clicks += num(m.clicks)
      p.cost += num(m.costMicros ?? m.cost_micros) / 1e6
      agg.set(id, p)
    }
  }
  for (const chunk of (Array.isArray(acq.dati) ? acq.dati : [])) {
    for (const row of (chunk.results || [])) {
      const seg = row.segments || {}, m = row.metrics || {}
      const p = agg.get(String(seg.productItemId ?? seg.product_item_id ?? ''))
      if (!p) continue
      p.conversions += num(m.conversions)
      p.convValue += num(m.conversionsValue ?? m.conversions_value)
      p.orders += num(m.orders)
    }
  }
  return { rows: [...agg.values()], ordiniVeri, error: null }
}

// ── Shopify: catalogo con COSTO e IMMAGINE per prodotto ────────────────────
// Letto qui e non da /api/product-costs, per due motivi verificati: quella
// route non espone nessun id prodotto (solo title/handle, inagganciabile) e
// legge `products(first: 100, sortKey: BEST_SELLING)` senza paginazione, cioe'
// i primi cento per vendite. Su un catalogo di migliaia di articoli lasciava
// senza costo (e senza immagine) tutto il resto.

// Quanti pezzi stanno dentro l'incasso che Google si attribuisce.
const pezziDiGoogle = (g, prezzoMedio) => {
  if (!(g?.convValue > 0)) return 0
  const n = prezzoMedio > 0 ? g.convValue / prezzoMedio : g.conversions
  return Math.round(n * 10) / 10
}

function voceCatalogo(out, n) {
  const varianti = (n.variants?.edges || []).map(({ node: v }) => ({
    price: Number(v.price) || 0,
    cost: v.inventoryItem?.unitCost?.amount != null ? Number(v.inventoryItem.unitCost.amount) : null,
  }))
  const conCosto = varianti.find(v => v.cost != null && v.cost > 0) || varianti[0] || {}
  // GOTCHA Shopify: la giacenza vale come informazione solo se l'articolo
  // traccia le scorte. Quando non le traccia, totalInventory arriva null:
  // in quel caso non si retrocede nulla, invece di leggere uno zero che
  // non significa esaurito.
  const tracciato = n.totalInventory != null
  out.set(String(n.legacyResourceId), {
    title: n.title,
    stato: n.status || null,
    vendor: (n.vendor || '').trim() || null,
    skus: (n.variants?.edges || []).map(e => e.node?.sku).filter(Boolean),
    image: n.featuredImage?.url || null,
    // Stessa fonte e stessa normalizzazione delle vendite per marchio, o lo
    // stesso prodotto finirebbe in due categorie diverse a seconda della tab.
    categoria: (n.categoria?.value || '').trim().toUpperCase() || null,
    price: conCosto.price || 0,
    cost: conCosto.cost != null ? conCosto.cost : null,
    giacenza: n.totalInventory != null ? Number(n.totalInventory) : null,
    tracciato,
  })
}

const CAMPI_CATALOGO_BASE = `legacyResourceId title vendor status totalInventory featuredImage { url }
        variants(first: 5) { edges { node { sku price inventoryItem { unitCost { amount } } } } }`
// Senza impostazione il metafield non si chiede nemmeno: una query in meno e
// `categoria` resta null, cioe' "nessuna categoria", non "categoria vuota".
const campiCatalogo = (mf) => mf
  ? `${CAMPI_CATALOGO_BASE}
        categoria: metafield(namespace:"${mf.ns}", key:"${mf.key}"){ value }`
  : CAMPI_CATALOGO_BASE

// I prodotti che la lettura a pagine non ha portato: su molti negozi un
// prodotto sotto le tre giacenze passa in bozza da solo, e un catalogo con
// migliaia di bozze puo' superare il tetto delle pagine. Si chiedono per id,
// qualunque sia lo stato: il costo c'e' anche se il prodotto oggi non e' in vendita.
async function completaCatalogo(out, ids, mf) {
  const { storeUrl, adminToken } = getShopify()
  if (!storeUrl || !adminToken) return 0
  const lista = [...new Set(ids)].filter(id => id && !out.has(String(id)))
  for (let i = 0; i < lista.length; i += 50) {
    const pezzo = lista.slice(i, i + 50).map(id => `"gid://shopify/Product/${id}"`).join(',')
    try {
      const res = await fetch(`https://${storeUrl}/admin/api/2024-04/graphql.json`, {
        method: 'POST', cache: 'no-store',
        headers: { 'X-Shopify-Access-Token': adminToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `{ nodes(ids: [${pezzo}]) { ... on Product { ${campiCatalogo(mf)} } } }` }),
      })
      const j = await res.json().catch(() => null)
      for (const n of (j?.data?.nodes || [])) if (n?.legacyResourceId) voceCatalogo(out, n)
    } catch { /* un pezzo fallito non ferma gli altri */ }
  }
  return lista.length
}

async function catalogoShopify(mf) {
  const { storeUrl, adminToken } = getShopify()
  const out = new Map()
  if (!storeUrl || !adminToken) return out
  let cursor = null
  for (let pagina = 0; pagina < 30; pagina++) {
    const after = cursor ? `, after: "${cursor}"` : ''
    const q = `{ products(first: 200${after}) { pageInfo { hasNextPage endCursor }
      edges { node { ${campiCatalogo(mf)} } } } }`
    const res = await fetch(`https://${storeUrl}/admin/api/2024-04/graphql.json`, {
      method: 'POST', cache: 'no-store',
      headers: { 'X-Shopify-Access-Token': adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    })
    if (!res.ok) { out.errore = `Shopify HTTP ${res.status}`; break }
    const j = await res.json().catch(() => null)
    // Shopify risponde 200 anche quando la query e' sbagliata: l'errore sta
    // nel corpo. Senza questo controllo la mappa resta vuota in silenzio e la
    // tabella perde meta' delle colonne senza dire perche'.
    if (j?.errors?.length) { out.errore = String(j.errors[0]?.message || 'GraphQL').slice(0, 160); break }
    const conn = j?.data?.products
    for (const { node: n } of (conn?.edges || [])) voceCatalogo(out, n)
    if (!conn?.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
  }
  return out
}

// ── Shopify: fatturato e pezzi per prodotto (tutto il periodo, via ShopifyQL)
async function shopifyVendite(range, canali) {
  const { storeUrl, adminToken } = getShopify()
  if (!storeUrl || !adminToken) return { mappa: new Map(), errore: 'Shopify non configurato' }
  // Parser IDENTICO a quello provato sulle vendite per marchio. Chiedere
  // `rowData`, campo che NON esiste, faceva rispondere Shopify con un errore
  // GraphQL: data tornava nullo e la funzione restituiva una mappa vuota
  // in silenzio — "query rotta" e "nessuna vendita" erano indistinguibili.
  const dove = clausolaCanali(canali)
  const ql = `FROM sales SHOW total_sales, net_items_sold${dove ? ` WHERE ${dove}` : ''} GROUP BY product_id, product_vendor SINCE ${range.since} UNTIL ${range.until} ORDER BY total_sales DESC LIMIT 5000`
  // Porta unica (cache per interrogazione, passo, ultimo dato buono). L'errore resta DICHIARATO:
  // una mappa vuota senza `errore` vorrebbe dire "nessuna vendita", che e' un'altra cosa.
  let righe
  try { righe = await shopifyql(ql) }
  catch (e) { return { mappa: new Map(), errore: String(e.message || 'Shopify non risponde').slice(0, 160) } }
  const out = new Map()
  for (const r of righe) {
    const id = r.product_id != null ? String(r.product_id) : ''
    if (!id) continue
    const acc = out.get(id) || { revenue: 0, units: 0 }
    acc.revenue = r2(acc.revenue + money(r.total_sales))
    acc.units += count(r.net_items_sold)
    out.set(id, acc)
  }
  // Se l'elenco tocca il tetto, i prodotti fuori non hanno zero vendite:
  // sono solo assenti. Dichiararlo evita di disegnare zeri inventati.
  return { mappa: out, errore: null, troncato: righe.length >= 5000 }
}

// ── Shopify: ORDINI DISTINTI per prodotto (righe d'ordine) ──────────────────
// ShopifyQL non da' gli ordini per prodotto: esistono solo raggruppati per
// brand. Vanno contati dalle righe, tenendo un insieme di id ordine per
// prodotto — un ordine con tre pezzi dello stesso prodotto resta UN ordine.
// Vale il limite dei 60 giorni senza read_all_orders: Shopify non da' errore,
// risponde 200 e omette gli ordini piu' vecchi, quindi la copertura si misura
// sui dati e non sul codice di stato.
async function shopifyOrdiniPerProdotto(range, scadenza, canali) {
  const { storeUrl: store, adminToken: token } = getShopify()
  if (!store || !token) return { mappa: new Map(), coperto: false }

  const perProdotto = new Map()
  let piuVecchio = null, ricevuti = 0, interrotto = false

  const onOrder = (o) => {
    if (daCanaleEscluso(o, canali) || o.cancelled_at) return
    const resi = new Map()
    for (const r of (o.refunds || [])) {
      for (const rl of (r.refund_line_items || [])) {
        const id = rl?.line_item_id != null ? String(rl.line_item_id) : null
        if (id) resi.set(id, (resi.get(id) || 0) + count(rl.quantity))
      }
    }
    for (const li of (o.line_items || [])) {
      const pid = li.product_id != null ? String(li.product_id) : null
      if (!pid || li.gift_card) continue
      const venduta = count(li.quantity) - (resi.get(String(li.id)) || 0)
      if (venduta <= 0) continue // riga resa per intero: non e' una vendita
      if (!perProdotto.has(pid)) perProdotto.set(pid, new Set())
      perProdotto.get(pid).add(String(o.id))
    }
  }

  const finestra = async (daISO, aISO) => {
    let url = `https://${store}/admin/api/2024-01/orders.json?status=any&financial_status=paid` +
      `&created_at_min=${encodeURIComponent(daISO)}&created_at_max=${encodeURIComponent(aISO)}` +
      `&limit=250&fields=id,created_at,line_items,refunds,cancelled_at,source_name,tags,app_id`
    for (let p = 0; p < 200 && url; p++) {
      if (Date.now() > scadenza) { interrotto = true; return }
      const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': token }, cache: 'no-store' })
      if (res.status === 429) { await sleep((Number(res.headers.get('Retry-After')) || 2) * 1000); continue }
      if (!res.ok) { interrotto = true; return }
      const data = await res.json().catch(() => null)
      for (const o of (data?.orders || [])) {
        const t = Date.parse(o?.created_at || '')
        if (Number.isFinite(t) && (piuVecchio == null || t < piuVecchio)) piuVecchio = t
        ricevuti++
        onOrder(o)
      }
      const link = res.headers.get('Link') || res.headers.get('link') || ''
      const m = /<([^>]+)>;\s*rel="next"/.exec(link)
      url = m ? m[1] : null
    }
  }

  const inizio = new Date(`${range.since}T00:00:00Z`).getTime()
  const fine = new Date(`${range.until}T23:59:59Z`).getTime()
  const giorni = Math.max(1, (fine - inizio) / 86400000)
  const FINESTRE = Math.min(6, Math.max(1, Math.ceil(giorni / 10)))
  const ampiezza = (fine - inizio) / FINESTRE
  const blocchi = []
  for (let i = 0; i < FINESTRE; i++) {
    const da = inizio + i * ampiezza + (i > 0 ? 1000 : 0)
    const a = (i === FINESTRE - 1) ? fine : inizio + (i + 1) * ampiezza
    blocchi.push([new Date(da).toISOString(), new Date(a).toISOString()])
  }
  await Promise.all(blocchi.map(([d, a]) => finestra(d, a)))

  // Copertura misurata sui DATI: oltre la finestra dei 60 giorni, se l'ordine
  // piu' vecchio ricevuto e' molto dopo l'inizio richiesto, manca un pezzo.
  let coperto = !interrotto
  if (inizio < fine - 59 * 86400000) {
    if (ricevuti === 0 || (piuVecchio != null && piuVecchio > inizio + 2 * 86400000)) coperto = false
  }
  const mappa = new Map()
  for (const [pid, insieme] of perProdotto) mappa.set(pid, insieme.size)
  return { mappa, coperto }
}

async function compute(req, range, S, { mf, canali }) {
  const origin = new URL(req.url).origin
  const cookie = req.headers.get('cookie') || ''
  const scadenza = Date.now() + 38000
  // L'aliquota del workspace (regolabile nelle soglie) non e' piu' L'aliquota:
  // e' l'ULTIMO ripiego. Con una sola aliquota per negozio, l'olio di Saracino
  // al 4% veniva scorporato al 22 e ogni margine usciva piu' basso del 18%.
  // Ora ogni prodotto ha la sua, letta dalle righe d'ordine di Shopify
  // (lib/fiscal/aliquote.js); il valore delle soglie si usa solo per un
  // negozio senza vendite tassate lette.
  const IVA = S.iva
  const tabellaIva = await aliquoteProdotti().catch(() => null)

  // 1. Google (gia' abbinato a Shopify dalla route sorella, che risolve
  //    l'ID articolo shopify_it_<id> in productId e porta titolo e immagine).
  const [gp, prodotti] = await Promise.all([
    googleProdotti(range),
    fetch(`${origin}/api/google-products?since=${range.since}&until=${range.until}`, {
      // Chi chiama puo' essere una persona (cookie) o un CRON (precaricamento, collaudo): senza
      // inoltrare anche le intestazioni del cron la chiamata interna veniva rifiutata, l'abbinamento
      // articolo→prodotto tornava VUOTO e migliaia di articoli "non abbinati" finivano in cache sotto
      // l'indirizzo che la tab apre ogni mattina (scoperto il 19 set dal collaudo stesso).
      // `x-lyft-workspace` e' anche cio' che tiene il cron sul cliente GIUSTO: senza,
      // la chiamata interna ripartirebbe dalle credenziali d'ambiente.
      cache: 'no-store', headers: cookie ? { cookie } : {
        'x-internal-cron': req.headers.get('x-internal-cron') || (req.headers.get('authorization') || '').replace(/^Bearer /, ''),
        'x-lyft-workspace': req.headers.get('x-lyft-workspace') || '',
      },
    }).then(r => r.json()).catch(() => null),
  ])
  if (gp.error) return { ok: false, error: gp.error, __noCache: true }

  const perItem = new Map()
  for (const r of (prodotti?.rows || [])) perItem.set(String(r.itemId), r)
  // L'abbinamento non letto NON e' "nessun prodotto abbinato": si dichiara e non si conserva.
  if (gp.rows.length > 20 && perItem.size === 0) {
    return { ok: false, error: `Abbinamento articoli→prodotti non letto (${String(prodotti?.error || 'nessuna risposta').slice(0, 80)})`, __noCache: true }
  }

  // 2. Shopify: fatturato/pezzi (tutto il periodo) e ordini (limite 60 giorni)
  const [venditeRes, ordini, catalogo] = await Promise.all([
    shopifyVendite(range, canali),
    shopifyOrdiniPerProdotto(range, scadenza, canali),
    catalogoShopify(mf),
  ])
  const vendite = venditeRes.mappa
  await completaCatalogo(catalogo, (prodotti?.rows || []).map(r => r.productId), mf)

  // 2-bis. Stesso periodo, spostato indietro: serve a dire se ogni numero sta
  // migliorando o peggiorando. Le due letture leggere si fanno sempre.
  const rangePrec = periodoPrecedente(range)
  const [gpPrec, venditePrecRes] = rangePrec ? await Promise.all([
    googleProdotti(rangePrec).catch(() => ({ rows: [], error: 'prec' })),
    shopifyVendite(rangePrec, canali).catch(() => ({ mappa: new Map(), errore: 'prec' })),
  ]) : [{ rows: [] }, { mappa: new Map(), errore: 'nessun periodo precedente' }]
  const gPrecPerItem = new Map()
  for (const r of (gpPrec?.rows || [])) gPrecPerItem.set(String(r.itemId), r)
  const venditePrec = venditePrecRes.mappa

  // Gli ordini per prodotto sono la lettura piu' pesante della route. Il
  // confronto si fa solo se resta tempo: meglio nessuna variazione che una
  // variazione calcolata su un conteggio interrotto a meta'.
  let ordiniPrec = { mappa: new Map(), coperto: false }
  if (rangePrec && Date.now() < scadenza - 16000) {
    ordiniPrec = await shopifyOrdiniPerProdotto(rangePrec, scadenza, canali).catch(() => ({ mappa: new Map(), coperto: false }))
  }

  // 3. Margine reale -> ROAS di pareggio. Niente margine, niente soglie.
  // Il margine non arriva da /api/product-costs (nessun id prodotto e solo i
  // primi 100 articoli): ogni riga usa il costo del PROPRIO prodotto, letto
  // dal catalogo completo. Il pareggio non e' un ROAS medio: e' POAS = 1,
  // cioe' il punto in cui il profitto copre esattamente la spesa.

  // CPA di riferimento: quanto costa oggi in media acquisire una conversione.
  const costoTot = gp.rows.reduce((s, r) => s + r.cost, 0)
  const convTot = gp.rows.reduce((s, r) => s + r.conversions, 0)
  const cpaMedia = convTot > 0 ? costoTot / convTot : null

  // Soglia di spreco: con un catalogo ampio il budget deve poter ruotare.
  // Un prodotto che ha bruciato questa cifra senza portare NESSUNA vendita
  // toglie spazio a tutti gli altri. Verificata su ENTRAMBE le fonti: se
  // Google vede zero ma Shopify mostra fatturato, il prodotto vende ed e'
  // l'attribuzione a essere cieca — fermarlo sarebbe il consiglio sbagliato.

  let abbinati = 0, conCosto = 0, senzaVenditeReali = 0, conCategoria = 0
  // UNA RIGA PER PRODOTTO, non per articolo del feed. Google ragiona per articolo (una
  // variante = un articolo: shopify_<paese>_<prodotto>_<variante>), Shopify e il magazzino
  // per prodotto. Con una riga per variante (84 prodotti su 260 righe, verificato):
  //  · ogni riga ripeteva TUTTO il venduto Shopify del prodotto, e il totale in fondo alla
  //    tabella lo sommava piu' volte (fino a 7.050 € in piu');
  //  · lo stesso prodotto aveva giudizi diversi fra le sue righe ("da fermare" e insieme
  //    "dati insufficienti");
  //  · la spesa divisa fra le varianti non superava mai la soglia, e il prodotto restava
  //    senza giudizio per sempre.
  // Gli articoli non abbinati restano una riga ciascuno.
  const unisci = (elenco) => {
    const mappa = new Map()
    for (const g of elenco) {
      const pid = perItem.get(String(g.itemId))?.productId
      const k = pid ? `p:${pid}` : `i:${g.itemId}`
      const a = mappa.get(k)
      if (!a) { mappa.set(k, { ...g, itemIds: [g.itemId], _piuSpeso: g.cost }); continue }
      a.itemIds.push(g.itemId)
      // a rappresentare il prodotto resta l'articolo che ha speso di piu'
      if (g.cost > a._piuSpeso) { a._piuSpeso = g.cost; a.itemId = g.itemId; a.title = g.title }
      a.clicks += g.clicks; a.cost += g.cost; a.conversions += g.conversions; a.convValue += g.convValue; a.orders += g.orders
    }
    return mappa
  }
  const googlePerProdotto = unisci(gp.rows)
  const googlePrecPerProdotto = unisci(gpPrec?.rows || [])

  const righe = [...googlePerProdotto.entries()].map(([chiaveProdotto, g]) => {
    const match = perItem.get(String(g.itemId))
    const productId = match?.productId || null
    const { aliquota: ivaProdotto, fonte: fonteIva } = aliquotaDi(productId, tabellaIva, IVA)
    if (productId) abbinati++
    const cat = productId ? catalogo.get(productId) : null
    if (cat?.cost != null) conCosto++
    if (cat?.categoria) conCategoria++
    const v = productId ? vendite.get(productId) : null
    // "Non abbinato", "non letto" e "zero vendite vere" finivano tutti e tre
    // in un null, disegnato come una lineetta: chi guarda non puo' sapere se
    // il prodotto non ha venduto o se non lo abbiamo misurato.
    const venditeStato = !productId ? 'nonAbbinato'
      : venditeRes.errore ? 'nonLetto'
      : v ? 'ok'
      : venditeRes.troncato ? 'nonLetto'
      : 'zero'
    if (venditeStato === 'zero' && g.convValue > 0) senzaVenditeReali++
    // Gli ordini hanno un limite loro: oltre i 60 giorni, o se la lettura e'
    // stata interrotta dal tempo massimo, la mappa e' parziale e uno zero
    // sarebbe una bugia diversa dalle altre.
    const ordiniConteggio = productId ? (ordini.mappa.get(productId) ?? null) : null
    const ordiniStato = !productId ? 'nonAbbinato'
      : ordiniConteggio != null ? 'ok'
      : ordini.coperto ? 'zero'
      : 'nonCoperto'
    const ordiniVeri = ordiniConteggio != null ? ordiniConteggio
      : (ordiniStato === 'zero' ? 0 : null)

    const roas = g.cost > 0 ? r2(g.convValue / g.cost) : null
    // CPA solo con ALMENO UN ORDINE INTERO. Google attribuisce frazioni di ordine (un ordine
    // diviso fra piu' prodotti o piu' clic): con 0,03 ordini e 23 € di spesa usciva "CPA 813 €",
    // una divisione giusta e un numero senza senso. Sotto l'ordine intero il CPA non esiste.
    const cpa = g.conversions >= 1 ? r2(g.cost / g.conversions) : null
    const shopRevenue = v ? v.revenue : (venditeStato === 'zero' ? 0 : null)

    // IVA scorporata PRIMA di qualunque conto di margine: il valore che
    // Google riporta e' lordo, il costo prodotto no. L'aliquota e' del cliente
    // (soglie, per workspace): a 0 lo scorporo non si fa.
    const ricavoNetto = r2(g.convValue / (1 + ivaProdotto / 100))
    // Pezzi su cui applicare il costo: quelli che GOOGLE ha venduto, non tutti
    // quelli usciti dal negozio. Prima si prendevano i pezzi di Shopify, che
    // contano anche le vendite di Meta, email e ricerca: il costo di tre borse
    // veniva tolto dall'incasso di due, e un prodotto in guadagno finiva in
    // perdita. Si ricavano dall'incasso di Google diviso il prezzo medio a cui
    // il prodotto si e' venduto davvero; senza vendite su Shopify vale il
    // prezzo di listino, e in mancanza anche di quello le conversioni.
    // Un decimale: l'attribuzione di Google e' frazionaria, e il costo si
    // calcola sul numero MOSTRATO, cosi' chi rifa' il conto a mano lo ritrova.
    const prezzoMedio = (v?.units > 0 && v.revenue > 0) ? r2(v.revenue / v.units)
      : (cat?.price > 0 ? cat.price : null)
    const pezzi = pezziDiGoogle(g, prezzoMedio)
    const costoUnitario = cat?.cost != null ? cat.cost : null
    const cogs = costoUnitario != null ? r2(costoUnitario * pezzi) : null
    const margineNetto = cogs != null ? r2(ricavoNetto - cogs - g.cost) : null
    // POAS: quanto profitto lordo torna per ogni euro speso. Pareggio a 1.
    const profittoLordo = cogs != null ? r2(ricavoNetto - cogs) : null
    const poas = (profittoLordo != null && g.cost > 0) ? r2(profittoLordo / g.cost) : null

    // Lo scarto serve a scoprire Google che si attribuisce PIU' di quanto Shopify ha incassato.
    // Se ne vede MENO e' normale (Shopify conta tutti i canali) e non e' uno scarto: dividere
    // per un incasso minuscolo dava "-3.361%" e sospendeva il giudizio senza motivo.
    const scarto = (shopRevenue != null && g.convValue > 0)
      ? Math.max(0, r2((g.convValue - shopRevenue) / g.convValue))
      : null

    // Il costo unitario del periodo precedente e' quello di OGGI: Shopify non
    // conserva lo storico del costo. Regge il confronto fra due periodi, non
    // e' una ricostruzione contabile del passato.
    const gPrec = googlePrecPerProdotto.get(chiaveProdotto) || null
    const vPrec = productId ? venditePrec.get(productId) : null
    const prec = gPrec ? (() => {
      const ricavoNettoP = r2(gPrec.convValue / (1 + ivaProdotto / 100))
      const prezzoMedioP = (vPrec?.units > 0 && vPrec.revenue > 0) ? r2(vPrec.revenue / vPrec.units) : prezzoMedio
      const pezziP = pezziDiGoogle(gPrec, prezzoMedioP)
      const cogsP = costoUnitario != null ? r2(costoUnitario * pezziP) : null
      const profittoP = cogsP != null ? r2(ricavoNettoP - cogsP) : null
      return {
        cost: r2(gPrec.cost),
        conversions: r2(gPrec.conversions),
        orders: gp.ordiniVeri ? Math.round(gPrec.orders) : null,
        convValue: r2(gPrec.convValue),
        roas: gPrec.cost > 0 ? r2(gPrec.convValue / gPrec.cost) : null,
        cpa: gPrec.conversions >= 1 ? r2(gPrec.cost / gPrec.conversions) : null,
        cogs: cogsP,
        profittoLordo: profittoP,
        margineNetto: profittoP != null ? r2(profittoP - gPrec.cost) : null,
        poas: (profittoP != null && gPrec.cost > 0) ? r2(profittoP / gPrec.cost) : null,
        shopifyRevenue: vPrec ? vPrec.revenue : (venditePrecRes.errore ? null : 0),
        shopifyOrders: (productId && ordiniPrec.coperto) ? (ordiniPrec.mappa.get(productId) ?? 0) : null,
      }
    })() : null

    // `<= 0`: un RESO lascia il venduto Shopify negativo (−7,50 €), e con `=== 0` contava come
    // "ha venduto" — la regola dello spreco non scattava mai per quel prodotto.
    const nessunaVendita = g.conversions === 0 && (shopRevenue == null || shopRevenue <= 0)

    // Un quarto del prezzo di vendita: oltre questa spesa il prodotto ha
    // avuto la sua occasione e si puo' giudicare.
    const prezzo = cat?.price > 0 ? cat.price : null
    const sogliaSpesa = prezzo != null ? r2(prezzo / S.rapportoPrezzoSpesa) : S.sogliaRipiego

    let verdetto = 'standby', motivo = null
    // La regola dello spreco viene PRIMA della soglia dati: un prodotto che
    // brucia budget a vuoto va fermato anche se i dati sono pochi.
    if (g.cost >= sogliaSpesa && nessunaVendita) { verdetto = 'uccidi'; motivo = 'spesaSenzaVendite' }
    else if (!productId) { verdetto = 'daVerificare'; motivo = 'nonAbbinato' }
    else if (!ordini.coperto && shopRevenue == null) { verdetto = 'daVerificare'; motivo = 'copertura' }
    else if (g.cost < sogliaSpesa) {
      // Con almeno una vendita e margine positivo il segnale esiste: e'
      // poco, ma non e' assenza di dati.
      const almenoUnOrdine = g.conversions >= 1 || (ordiniVeri != null && ordiniVeri >= 1)
      // "Vale tenerlo d'occhio" e' un giudizio, e si fonda sul venduto che Google si attribuisce:
      // se Shopify non lo conferma (scarto oltre il limite) va sospeso come tutti gli altri. Prima
      // questo ramo veniva PRIMA del controllo dello scarto: 23 prodotti risultavano "con vendite e
      // margine positivo" mentre su Shopify non avevano venduto niente (Google attribuisce l'ordine
      // al prodotto CLICCATO, non a quello comprato).
      if (almenoUnOrdine && margineNetto != null && margineNetto > 0 && scarto != null && scarto > S.scartoMax) { verdetto = 'daVerificare'; motivo = 'scarto' }
      else if (almenoUnOrdine && margineNetto != null && margineNetto > 0) { verdetto = 'standby'; motivo = 'poco' }
      else { verdetto = 'insufficiente'; motivo = 'spesaBassa' }
    }
    else if (costoUnitario == null) { verdetto = 'daVerificare'; motivo = 'costoAssente' }
    else if (venditeStato !== 'ok' && venditeStato !== 'zero') { verdetto = 'daVerificare'; motivo = 'venditeNonLette' }
    else if (scarto != null && Math.abs(scarto) > S.scartoMax) { verdetto = 'daVerificare'; motivo = 'scarto' }
    // Il giudizio nasce dal PROFITTO, non dal ricavo: pareggio a POAS 1.
    // Prima per scalare serviva POAS 1,30: un prodotto in profitto, con ROAS
    // alto e magazzino pieno, finiva in stand-by e la riga non diceva perche'
    // (il verdetto restava quello iniziale, senza motivo). Ora il confine e'
    // il pareggio, e OGNI ramo lascia un motivo.
    else if (poas != null && poas > 1) verdetto = 'scala'
    else if (poas == null || poas < 1 - S.banda) { verdetto = 'uccidi'; motivo = 'poasSottoPareggio' }
    else { verdetto = 'standby'; motivo = 'sottoPareggio' }

    // Scalare un prodotto che sta per finire e' un consiglio che si
    // autodistrugge: la copertura confronta la giacenza con i pezzi venduti
    // nel periodo. Sotto 1 non reggeresti un altro periodo uguale.
    const giacenza = cat?.giacenza ?? null
    // Il magazzino si svuota con TUTTE le vendite, non solo quelle di Google.
    const pezziUsciti = v?.units > 0 ? v.units : pezzi
    const copertura = (giacenza != null && pezziUsciti > 0) ? r2(giacenza / pezziUsciti) : null
    // Due situazioni diverse, due motivi diversi: "non ho merce" e "ne ho,
    // ma non abbastanza per reggere il ritmo". Entrambe fermano lo scaling.
    if (verdetto === 'scala' && cat?.tracciato && giacenza != null) {
      if (giacenza < S.scortaMinima) { verdetto = 'standby'; motivo = 'scorteMinime' }
      else if (copertura != null && copertura < 1) { verdetto = 'standby'; motivo = 'scorteBasse' }
    }
    // Magazzino a posto ma ritorno troppo basso: non si scala comunque.
    if (verdetto === 'scala' && (roas == null || roas < S.roasMinimo)) {
      verdetto = 'standby'; motivo = 'roasBasso'
    }

    // Se il margine netto e' negativo il prodotto si vende IN PERDITA: non
    // puo' restare in attesa per un ROAS alto o per qualche ordine. Vale
    // dopo ogni altra promozione o retrocessione, tranne dove i dati non
    // sono attendibili (daVerificare): li' anche il margine non lo e'.
    // "In perdita" vale se GOOGLE ha venduto qualcosa, o se la spesa ha gia'
    // passato la soglia. Prima bastava un ordine qualunque su Shopify: un
    // prodotto con trenta centesimi di spesa e una vendita arrivata da Meta
    // finiva fra quelli da fermare, con un margine negativo di trenta centesimi.
    // "Ha venduto" = almeno un ordine intero, non un incasso qualunque: 5,72 € attribuiti su una
    // borsa da 198 € sono il 3% di un ordine, e bastavano a dire "venduto in perdita nonostante
    // gli ordini" con 23 € di spesa, sotto la soglia. Sotto l'ordine intero decide la spesa.
    // (NON gli ordini di Shopify: sono di tutti i canali, e una vendita arrivata da Meta rimetteva
    // fra i "da fermare" centinaia di prodotti — provato: 30 → 260.)
    const almenoUnaVendita = g.conversions >= 1 || g.cost >= sogliaSpesa
    if (verdetto !== 'daVerificare' && margineNetto != null && margineNetto < 0 && almenoUnaVendita) {
      // Due storie diverse, due frasi diverse. "Venduto in perdita nonostante gli ordini" e'
      // vero solo se Google un ordine intero se l'e' attribuito; se no (14 casi su 23, verificato)
      // la verita' e' un'altra: Google ha speso oltre la soglia senza portare un ordine, e il
      // prodotto vende da altri canali.
      verdetto = 'uccidi'; motivo = g.conversions >= 1 ? 'margineNegativo' : 'spesaSenzaOrdiniGoogle'
    }

    // POAS negativo = si vende SOTTO il costo del prodotto: e' un fatto
    // economico certo, non un dubbio sui dati. Sopra la soglia di spesa
    // vince su tutto, compreso "da verificare": uno scarto alto fra Google
    // e Shopify e' un dubbio sull'ATTRIBUZIONE, non sul fatto che ci perdi.
    if (g.cost >= sogliaSpesa && poas != null && poas < 0) {
      verdetto = 'uccidi'; motivo = 'poasNegativo'
    }

    return {
      itemId: g.itemId,
      // tutti gli articoli del feed che stanno in questa riga (le varianti pubblicizzate)
      itemIds: g.itemIds,
      productId,
      categoria: cat?.categoria || null,
      vendor: cat?.vendor || null,
      // Solo se NON e' in vendita: su molti negozi chi scende sotto le tre
      // giacenze passa in bozza da solo, e la riga deve dirlo.
      stato: cat?.stato && cat.stato !== 'ACTIVE' ? cat.stato : null,
      skus: cat?.skus || [],
      giacenza,
      copertura,
      title: cat?.title || match?.title || g.title || g.itemId,
      // Immagine dal catalogo completo: prima mancava per i prodotti che il
      // catalogo parziale non copriva.
      image: cat?.image || match?.image || null,
      cost: r2(g.cost),
      prezzo,
      sogliaSpesa,
      clicks: g.clicks,
      conversions: r2(g.conversions),
      orders: gp.ordiniVeri ? Math.round(g.orders) : null,
      convValue: r2(g.convValue),
      ricavoNetto,
      iva: r2(g.convValue - ricavoNetto),
      // l'aliquota usata per QUESTO prodotto, e da dove viene: 'prodotto' (letta
      // dalle sue righe d'ordine), 'negozio' (la piu' frequente del negozio,
      // perche' lui non ha venduto nel periodo), 'ripiego' (quella delle soglie).
      aliquotaIva: ivaProdotto,
      fonteIva,
      pezzi,
      prezzoMedio,
      costoUnitario,
      cogs,
      margineNetto,
      profittoLordo,
      poas,
      roas, cpa,
      shopifyRevenue: shopRevenue,
      shopifyUnits: v ? v.units : null,
      shopifyOrders: ordiniVeri,
      venditeStato,
      ordiniStato,
      prec,
      scarto,
      verdetto, motivo,
    }
  }).sort((a, b) => b.cost - a.cost)

  const perVerdetto = (v) => righe.filter(r => r.verdetto === v)
  return {
    ok: true,
    // Una lettura di Shopify fallita non si congela in cache: alla prossima
    // apertura si riprova, invece di mostrare l'errore per dieci minuti.
    ...(venditeRes.errore ? { __noCache: true } : {}),
    range,
    rangePrec,
    // Tutto cio' che rende il verdetto interpretabile viaggia col dato.
    soglie: {
      banda: S.banda,
      scartoMax: S.scartoMax,
      rapportoPrezzoSpesa: S.rapportoPrezzoSpesa,
      sogliaRipiego: S.sogliaRipiego,
      scortaMinima: S.scortaMinima,
      roasMinimo: S.roasMinimo,
      // Resta l'aliquota delle soglie, ma ora e' solo il ripiego: quella vera e'
      // su ogni riga (aliquotaIva). `ivaDaShopify` dice se le righe d'ordine sono
      // state lette davvero, cosi' la tab non spaccia il ripiego per una misura.
      iva: IVA,
      ivaDaShopify: (tabellaIva?.righe || 0) > 0,
      ivaPredefinitaNegozio: tabellaIva?.predefinita ?? null,
      poasPareggio: 1,
      // Se e' null, la tab NON deve mostrare verdetti come se fossero fondati.
      // Il verdetto e' possibile dove c'e' il costo del prodotto.
      disponibili: true,
    },
    qualita: {
      // Senza queste due, i verdetti non vanno letti: dicono quanta parte del
      // confronto e' affidabile.
      prodottiGoogle: righe.length,
      articoliGoogle: gp.rows.length,
      abbinati,
      conCosto,
      conCategoria,
      coperturaAbbinamentoPct: righe.length > 0 ? Math.round((abbinati / righe.length) * 100) : null,
      ordiniShopifyCompleti: ordini.coperto,
      ordiniGoogleReali: gp.ordiniVeri,
      venditeErrore: venditeRes.errore,
      catalogoErrore: catalogo.errore || null,
      venditeTroncate: venditeRes.troncato || false,
      // Quali canali di vendita sono rimasti fuori dal confronto: elenco vuoto
      // = nessun filtro. Serve a spiegare uno scarto, non a decorare.
      canaliEsclusi: canali,
      // Quanti prodotti Google dichiara di aver venduto senza che Shopify
      // registri un euro: e' il numero che spiega i verdetti sospesi.
      senzaVenditeReali,
      // Se il confronto non c'e', la tab non deve disegnare variazioni.
      confrontoDisponibile: gPrecPerItem.size > 0,
      confrontoOrdiniReali: ordiniPrec.coperto,
    },
    totali: {
      cost: r2(costoTot),
      convValue: r2(gp.rows.reduce((s, r) => s + r.convValue, 0)),
      conversions: r2(convTot),
      roas: costoTot > 0 ? r2(gp.rows.reduce((s, r) => s + r.convValue, 0) / costoTot) : null,
      cpaMedia: cpaMedia != null ? r2(cpaMedia) : null,
    },
    // Solo i CONTEGGI: prima qui viaggiava una seconda copia di ogni riga (meta' del carico,
    // ~2 MB su 4) che nessun componente leggeva — i gruppi la tab li fa da `righe`.
    gruppi: {
      scala: perVerdetto('scala').length,
      standby: perVerdetto('standby').length,
      uccidi: perVerdetto('uccidi').length,
      daVerificare: perVerdetto('daVerificare').length,
      insufficiente: perVerdetto('insufficiente').length,
    },
    righe,
    updatedAt: new Date().toISOString(),
  }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const range = resolveRange(new URL(req.url).searchParams)
    // Il workspace si risolve come in tutto il resto del prodotto: prima il
    // tenant EFFETTIVO (rispetta lo switch dell'agency, stessa chiave che usa
    // swrSnapshot), poi l'identita' del contesto — l'unica che esiste per un
    // cron o per una call, dove i cookie non ci sono. Mai un workspace fisso.
    let ws = null
    try { ws = await getEffectiveTenantId() } catch {}
    if (!ws) ws = getTenantInfo().userId || null

    const grezze = await leggiImpostazioni(ws, 'googleVerdetti', {})
    // Le soglie del workspace entrano nella chiave di cache: cambiarle deve cambiare i giudizi
    // SUBITO, non alla scadenza della cache. Vale anche per i canali esclusi e per il metafield
    // delle categorie: cambiano i numeri, quindi non possono condividere la stessa chiave.
    const S = soglieValide(grezze)
    const mf = metafieldDi(grezze.metafieldCategoria)
    const canali = await canaliEsclusiDi(ws)
    // Solo un'impronta dei canali: i nomi interi allungherebbero la chiave senza
    // aggiungere niente (la chiave e' gia' per workspace, non si confondono clienti).
    const improntaCanali = canali.join('+').slice(0, 40)

    return swrSnapshot(req, {
      // @27 (21 set 2026): l'IVA si scorpora per PRODOTTO, dalle righe d'ordine di
      // Shopify, non piu' con l'aliquota unica delle soglie. Senza alzare la
      // versione la cache condivisa (locale e produzione) avrebbe continuato a
      // servire i margini calcolati al 22% anche per l'olio al 4%.
      tab: `googleVerdicts@27:${improntaSoglie(S)}:${improntaCanali}${mf ? `:${mf.ns}.${mf.key}` : ''}`,
      // 10 minuti: la tab si ri-controlla da sola mentre e' aperta, quindi la
      // finestra breve fa partire prima il rinfresco in background. Sotto non
      // ha senso: i dati Google arrivano con il loro ritardo.
      ttlMs: 10 * 60 * 1000,
      compute: async () => {
        try { return await compute(req, range, S, { mf, canali }) } catch (e) {
          return { ok: false, error: e?.message || 'Errore', __noCache: true }
        }
      },
    })
  })
}
