export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getGoogle, getMeta } from '../../../lib/tenant/credentials'
import { getRange } from '../../../lib/metaRange'
import { swrSnapshot } from '../../../lib/cache/swr'
import { clausolaSenzaCanali } from '../../../lib/shopify/koongo'
import { negozioDelCliente, etichettaDi } from '../../../lib/team/canaliCliente'
import { regioneDiProvincia, regioneCanonica } from '../../../lib/geo/regioniItalia'
import { metaEscludiEtichetta, campagnaDaEscludere } from '../../../lib/ads/driveToStore'
import { shopifyql } from '../../../lib/shopify/shopifyql'

// ============================================================================
//  DOVE COMPRANO — province e comuni, dai dettagli degli ordini.
//
//  PERCHE' DAGLI ORDINI E NON DA ANALYTICS. Google Analytics le province
//  italiane non le ha: espone la REGIONE (Lombardia, Lazio) e la CITTA', con
//  circa un quinto delle sessioni a "(not set)". L'ordine invece porta
//  l'indirizzo completo, quindi provincia e comune sono un dato, non una
//  stima.
//
//  DAI TOTALI DI SHOPIFY, NON SFOGLIANDO GLI ORDINI (21 set 2026). Prima si
//  leggevano gli ordini uno per uno, 60 alla volta, per al massimo 40 pagine:
//  2.400 ordini, a partire dal PIU' VECCHIO. Su Saracino, 1 luglio – 21
//  settembre, la tabella si fermava ai primi 2.400 (242.539 €) mentre il
//  riquadro in alto diceva 906.570 €, e il MER per regione usciva 1,36 invece
//  di 5,17 perche' la spesa era quella di tutto il periodo. Il segnale
//  `troncato` c'era, ma la pagina non lo mostrava. Ora vendite, ordini, nuovi
//  e di ritorno, resi, comuni, marchi e prodotti per provincia vengono da
//  ShopifyQL (`FROM sales ... GROUP BY shipping_region`), con le STESSE misure
//  del fatturato in alto (total_sales: resi gia' tolti; senza i canali esclusi
//  del cliente): esatti per qualunque numero di ordini, e in pochi secondi.
//
//  IL RIPIEGO CHE RECUPERA UN TERZO DEL FATTURATO. Verificato sul negozio: su
//  trenta giorni, 60 ordini per 6.571 € arrivano SENZA provincia di
//  spedizione — piu' di Roma, che e' la prima. Sono i clienti che scrivono i
//  propri dati nell'indirizzo di FATTURAZIONE e lasciano vuota la spedizione,
//  lo stesso caso gia' incontrato nel registro dei corrispettivi. Quindi:
//  provincia di spedizione, e dove manca quella di fatturazione. Quel che
//  resta senza nessuna delle due si dichiara, non si nasconde.
//
//  NUOVI E DI RITORNO: `orders_first_time` / `orders_returning` di ShopifyQL,
//  la stessa classificazione di Shopify che usano i riquadri in alto
//  (/api/shopify-countries): i due numeri devono combaciare.
//
//  MARKETPLACE FUORI: un ordine Koongo non nasce da una sessione sul sito e
//  non ha una provincia che significhi qualcosa per la pubblicita'.
//
//  GET ?since=YYYY-MM-DD&until=YYYY-MM-DD  oppure  ?preset=last_30d
// ============================================================================

const ORE = 60 * 60 * 1000
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const attendi = (ms) => new Promise(r => setTimeout(r, ms))

// Google scrive all'inglese le citta' italiane piu' note. Senza questa tabella
// Milano e Roma resterebbero senza sessioni proprio dove ce ne sono di piu'.
const NOMI_INGLESI = {
  milan: 'Milano', rome: 'Roma', turin: 'Torino', naples: 'Napoli',
  florence: 'Firenze', venice: 'Venezia', genoa: 'Genova', padua: 'Padova',
  syracuse: 'Siracusa', mantua: 'Mantova', leghorn: 'Livorno', bolzano: 'Bolzano',
}
const normalizza = (s) => String(s || '').trim().toLowerCase().replace(/[’`]/g, "'")
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
const comuneCanonico = (s) => {
  const n = normalizza(s)
  return NOMI_INGLESI[n] ? normalizza(NOMI_INGLESI[n]) : n
}

async function gql(query, variables, tentativo = 1) {
  const { storeUrl, adminToken } = getShopify()
  const res = await fetch(`https://${storeUrl}/admin/api/2026-04/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': adminToken || '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  const json = await res.json().catch(() => null)
  const errs = json?.errors || []
  const strozzato = res.status === 429 || errs.some(e => /throttl|rate limit/i.test(e?.message || ''))
  if (strozzato && tentativo < 5) { await attendi(1500 * tentativo); return gql(query, variables, tentativo + 1) }
  // Un errore non deve diventare "nessun ordine": si propaga.
  if (!res.ok || errs.length) throw new Error(errs[0]?.message || `Shopify HTTP ${res.status}`)
  return json?.data
}

// Il genere sta in uno di quattro metacampi, a seconda di quando e' stato
// caricato il prodotto: si prende il primo che risponde.
const ALIAS_GENERE = ['g1', 'g2', 'g3', 'g4']
function genereDi(nodo) {
  for (const alias of ALIAS_GENERE) {
    let grezzo = (nodo?.[alias]?.value || '').trim()
    // Su questo negozio il metacampo e' una LISTA ('["WOMAN"]'), non un testo:
    // senza aprirla usciva la parentesi quadra in pagina.
    if (grezzo.startsWith('[')) {
      try { const l = JSON.parse(grezzo); grezzo = String((Array.isArray(l) ? l : [l]).find(x => String(x || '').trim()) || '').trim() } catch {}
    }
    if (!grezzo) continue
    const v = grezzo.toLowerCase()
    if (/^(uomo|man|men|male|m|homme|hombre|herren)$/.test(v)) return 'UOMO'
    if (/^(donna|woman|women|female|f|femme|mujer|damen)$/.test(v)) return 'DONNA'
    if (/^(unisex|both)$/.test(v)) return 'UNISEX'
    if (/(bambin|kid|child|junior)/.test(v)) return 'BAMBINO'
    return grezzo.toUpperCase()
  }
  return null
}

// Categoria, titolo, immagine e genere dei prodotti venduti. La categoria non
// sta dove Shopify la cerca (product_type e' vuoto su tutto il catalogo): la
// tiene il negozio nel metacampo pdp.categoria.
async function datiProdotti(idProdotti) {
  const out = new Map()
  const ids = [...idProdotti]
  const Q = `query N($ids:[ID!]!){ nodes(ids:$ids){ ... on Product { id title handle
    productType
    categoria: metafield(namespace:"pdp", key:"categoria"){ value }
    g1: metafield(namespace:"pdp", key:"gender"){ value }
    g2: metafield(namespace:"pdp", key:"genere"){ value }
    g3: metafield(namespace:"custom", key:"gender"){ value }
    g4: metafield(namespace:"custom", key:"genere"){ value }
    featuredMedia { preview { image { url(transform:{ maxWidth: 160 }) } } } } } }`
  for (let i = 0; i < ids.length; i += 100) {
    const data = await gql(Q, { ids: ids.slice(i, i + 100) })
    for (const n of data?.nodes || []) {
      if (!n?.id) continue
      out.set(n.id, {
        titolo: n.title || null,
        handle: n.handle || null,
        immagine: n.featuredMedia?.preview?.image?.url || null,
        // Il metacampo pdp.categoria e' di un solo negozio: gli altri tengono la categoria dove la
        // mette Shopify (Tipo di prodotto). Senza nessuno dei due: SENZA CATEGORIA, come prima.
        categoria: (n.categoria?.value || n.productType || '').trim().toUpperCase() || null,
        genere: genereDi(n),
      })
    }
  }
  return out
}

async function tokenGoogle() {
  const g = getGoogle()
  if (!g?.clientId || !g?.refreshToken) return null
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: g.clientId, client_secret: g.clientSecret || '',
      refresh_token: g.refreshToken, grant_type: 'refresh_token',
    }),
  })
  return (await res.json().catch(() => null))?.access_token || null
}

// La mappa comune → provincia, imparata da TUTTO lo storico degli ordini.
//
// Perche' non basta il periodo scelto: attribuendo le sessioni solo ai comuni
// che hanno ordinato in QUESTI giorni, chi ha guardato senza comprare sparisce
// dal denominatore e il tasso di conversione viene gonfiato proprio dove le
// vendite sono poche. Su tre anni di ordini la mappa copre quasi tutti i
// comuni da cui arriva traffico, e il conto torna onesto.
//
// Si usa ShopifyQL perche' qui serve solo l'accoppiata comune-provincia:
// aggregata, una chiamata, nessuna pagina di ordini da sfogliare.
// Una mappa PER NEGOZIO: prima era una sola per tutta la funzione, e quella imparata dagli
// ordini di un cliente veniva riusata per il cliente dopo, fino a 7 giorni.
const mappaCache = new Map()
async function mappaComuni() {
  const chiaveNegozio = getShopify()?.storeUrl || '-'
  const gia = mappaCache.get(chiaveNegozio)
  if (gia && Date.now() - gia.at < 7 * 24 * ORE) return gia.v
  const oggi = new Date()
  // Due anni: tre facevano rifiutare l'interrogazione, e una mappa vuota
  // non si distingue da "nessuna sessione attribuibile".
  const da = new Date(oggi.getTime() - 730 * 86400000).toISOString().slice(0, 10)
  const a = oggi.toISOString().slice(0, 10)
  const mappa = new Map()
  const guai = []
  const leggi = async (citta, regione) => {
    const q = `FROM sales SHOW total_sales GROUP BY ${citta}, ${regione} SINCE ${da} UNTIL ${a} LIMIT 5000`
    try {
      // Porta unica. E' una tabella di corrispondenze su due anni: cambia pochissimo, vive un giorno.
      const righe = await shopifyql(q, { ttlMs: 24 * 3_600_000 })
      if (!righe.length) { guai.push(`${citta}: nessuna riga`); return }
      for (const riga of righe) {
        const v = [riga[citta], riga[regione]], iC = 0, iR = 1
        const comune = String(v[iC] ?? '').trim(), prov = String(v[iR] ?? '').trim()
        if (!comune || !prov || comune === 'null' || prov === 'null') continue
        const k = comuneCanonico(comune)
        if (!mappa.has(k)) mappa.set(k, prov)
      }
    } catch (e) { guai.push(`${citta}: ${String(e.message).slice(0, 90)}`) }
  }
  await leggi('shipping_city', 'shipping_region')
  await attendi(1200)
  await leggi('billing_city', 'billing_region')
  const v = { mappa, guai, comuniNoti: mappa.size, finestra: { da, a } }
  // Una mappa vuota non si mette in cache: sarebbe un guasto congelato per
  // una settimana.
  if (mappa.size > 0) { if (mappaCache.size >= 50) mappaCache.delete(mappaCache.keys().next().value); mappaCache.set(chiaveNegozio, { at: Date.now(), v }) }
  return v
}

// ── Le sessioni vengono da SHOPIFY, non da Analytics ───────────────────────
// Prima si leggevano da GA4, e i conti non tornavano con quello che si vede
// nel pannello di Shopify: sugli stessi trenta giorni GA4 contava 89 mila
// sessioni per la sola Italia, Shopify 78 mila in tutto il mondo. Sono due
// contatori diversi (GA4 e' piu' largo), e tutto il resto del prodotto —
// tasso di conversione compreso — usa quello di Shopify. Ora anche qui.
// Shopify conosce paese, regione e citta' della sessione; la provincia no:
// la citta' si collega alla provincia grazie agli ordini, come prima.
async function sessioniShopify(range, gruppi) {
  const q = `FROM sessions SHOW sessions WHERE session_country = 'Italy' GROUP BY ${gruppi} SINCE ${range.since} UNTIL ${range.until} ORDER BY sessions DESC LIMIT 5000`
  return shopifyql(q)   // porta unica: cache per interrogazione, passo, ultimo dato buono
}
const vuoto = (v) => v == null || v === '' || v === 'null'

// Sessioni per COMUNE. Quel che non si riesce ad attribuire si conta e si
// dichiara: sessioni senza citta', e citta' da cui nessuno ha mai ordinato.
async function sessioniPerComune(range) {
  try {
    const righe = await sessioniShopify(range, 'session_region, session_city')
    const perComune = new Map()
    let totali = 0, nonDette = 0
    for (const r of righe) {
      const s = Math.round(num(r.sessions))
      totali += s
      if (vuoto(r.session_city)) { nonDette += s; continue }
      // "Province of Macerata": Shopify a volte da' la provincia al posto
      // della citta'. Il capoluogo porta alla stessa provincia.
      const nome = String(r.session_city).replace(/^Province of\s+/i, '').replace(/^Metropolitan City of\s+/i, '')
      const k = comuneCanonico(nome)
      perComune.set(k, (perComune.get(k) || 0) + s)
    }
    return { perComune, totali, nonDette }
  } catch { return null }
}

// ════════════════════════════════════════════════════════════════════════
//  QUANTO SI SPENDE, REGIONE PER REGIONE.
//
//  La spesa pubblicitaria esiste per REGIONE, non per provincia: Meta non
//  scende sotto la regione. Per questo il confronto spesa-vendite si fa li',
//  sommando le province. In cambio, a quel livello anche le sessioni di
//  Analytics sono ESATTE (la regione e' una sua dimensione), senza passare
//  dalla mappa dei comuni.
//
//  Si prende tutta la spesa del periodo, non solo delle campagne accese oggi:
//  una campagna spenta ieri ha comunque speso, e toglierla farebbe sembrare
//  piu' efficiente la regione dove girava.
//
//  Ogni fonte fallisce per conto suo e lo DICE: una regione senza spesa Meta
//  perche' Meta ha risposto errore non e' una regione dove non si spende.
// ════════════════════════════════════════════════════════════════════════
async function spesaMetaPerRegione(range, etichetta = null) {
  try {
    const m = getMeta()
    if (!m?.accessToken || !m?.adAccountId) return { errore: 'Meta non collegato' }
    const GRAPH = m.graphVersion || 'v20.0'
    const conti = String(m.adAccountId).split(',').map(x => x.trim().replace(/["']/g, '')).filter(Boolean)
      .map(x => x.startsWith('act_') ? x : `act_${x}`)
    const perRegione = new Map(), sconosciute = new Map()
    let totale = 0
    for (const acc of conti) {
      let url = new URL(`https://graph.facebook.com/${GRAPH}/${acc}/insights`)
      url.searchParams.set('level', 'campaign')
      url.searchParams.set('fields', 'campaign_name,spend')
      url.searchParams.set('breakdowns', 'region')
      // Fuori le campagne dei negozi fisici (portano a un negozio, non al sito), ma SOLO per chi li
      // ha dichiarati, con la LORO parola (lib/team/canaliCliente.js). Prima si toglieva a tutti
      // "drivetostore", la parola di un solo cliente. Senza etichetta non si toglie niente.
      const filtri = metaEscludiEtichetta(etichetta)
      if (filtri.length) url.searchParams.set('filtering', JSON.stringify(filtri))
      url.searchParams.set('time_range', JSON.stringify({ since: range.since, until: range.until }))
      url.searchParams.set('limit', '500')
      url.searchParams.set('access_token', m.accessToken)
      // Si seguono TUTTE le pagine (prima: al massimo 10 da 500 righe campagna×regione, poi la
      // spesa per regione restava sottostimata senza dirlo). Il tetto e' solo una sicura: se lo
      // si raggiunge, la spesa per regione si dichiara incompleta invece di sembrare giusta.
      let prossima = url.toString(), giri = 0
      while (prossima && giri < 200) {
        const res = await fetch(prossima, { cache: 'no-store', signal: AbortSignal.timeout(25000) })
        const j = await res.json().catch(() => ({}))
        if (j?.error) return { errore: `Meta: ${String(j.error.message || '').slice(0, 120)}` }
        for (const riga of (j.data || [])) {
          const spesa = num(riga.spend)
          if (spesa <= 0) continue
          // La rete sotto il filtro di Meta, per qualunque altra grafia del nome.
          if (campagnaDaEscludere(riga.campaign_name, etichetta)) continue
          totale += spesa
          const reg = regioneCanonica(riga.region)
          if (!reg) { sconosciute.set(riga.region, (sconosciute.get(riga.region) || 0) + spesa); continue }
          if (!perRegione.has(reg)) perRegione.set(reg, { spesa: 0, campagne: new Map() })
          const r = perRegione.get(reg)
          r.spesa += spesa
          r.campagne.set(riga.campaign_name, (r.campagne.get(riga.campaign_name) || 0) + spesa)
        }
        prossima = j?.paging?.next || null
        giri += 1
      }
      if (prossima) return { errore: 'Meta: troppe righe per regione, spesa incompleta' }
    }
    return { perRegione, totale, sconosciute }
  } catch (e) { return { errore: `Meta: ${String(e.message).slice(0, 120)}` } }
}

async function spesaGooglePerRegione(range) {
  try {
    const g = getGoogle()
    const DEV = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    const CID = (g?.adsCustomerId || '').replace(/-/g, ''), MCC = (g?.adsMccId || '').replace(/-/g, '')
    if (!DEV || !CID || !g?.refreshToken) return { errore: 'Google Ads non collegato' }
    const token = await tokenGoogle()
    if (!token) return { errore: 'Google: accesso non riuscito' }
    const { GoogleAdsServiceClient } = await import('google-ads-node')
    const grpc = await import('@grpc/grpc-js')
    const client = new GoogleAdsServiceClient({ sslCreds: grpc.credentials.createSsl(), servicePath: 'googleads.googleapis.com', port: 443 })
    const opts = { otherArgs: { headers: { authorization: `Bearer ${token}`, 'developer-token': DEV, ...(MCC ? { 'login-customer-id': MCC } : {}) } } }

    // Dove si trovava chi ha visto l'annuncio. Verificato: copre il 99,5% della
    // spesa, PMax e Shopping compresi.
    const [righe] = await client.search({ customer_id: CID, query:
      `SELECT campaign.name, segments.geo_target_region, metrics.cost_micros FROM user_location_view WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'` }, opts)
    const perCodice = new Map()
    let totale = 0
    for (const riga of (righe || [])) {
      const spesa = num(riga?.metrics?.costMicros ?? riga?.metrics?.cost_micros) / 1e6
      if (spesa <= 0) continue
      totale += spesa
      const codice = riga?.segments?.geoTargetRegion ?? riga?.segments?.geo_target_region ?? null
      const nome = riga?.campaign?.name || '—'
      const k = codice || '(nessuna)'
      if (!perCodice.has(k)) perCodice.set(k, { spesa: 0, campagne: new Map() })
      const r = perCodice.get(k)
      r.spesa += spesa
      r.campagne.set(nome, (r.campagne.get(nome) || 0) + spesa)
    }
    // Le viste danno un codice: il nome va chiesto a parte.
    const codici = [...perCodice.keys()].filter(c => c.startsWith('geoTargetConstants/'))
    const nomi = new Map()
    for (let i = 0; i < codici.length; i += 200) {
      const [resp] = await client.search({ customer_id: CID, query:
        `SELECT geo_target_constant.resource_name, geo_target_constant.name, geo_target_constant.country_code FROM geo_target_constant WHERE geo_target_constant.resource_name IN (${codici.slice(i, i + 200).map(c => `'${c}'`).join(',')})` }, opts)
      for (const r of (resp || [])) {
        const k = r.geoTargetConstant || r.geo_target_constant
        nomi.set(k.resourceName || k.resource_name, { nome: k.name, paese: k.countryCode || k.country_code })
      }
    }
    const perRegione = new Map(), sconosciute = new Map()
    for (const [codice, v] of perCodice.entries()) {
      const info = nomi.get(codice)
      // A volte Google mette una PROVINCIA dove ci si aspetta la regione
      // ("Province of Monza and Brianza", "Metropolitan City of Cagliari"):
      // si risale alla regione dalla provincia invece di scartare la spesa.
      const comeProvincia = (nome) => regioneDiProvincia(String(nome || '')
        .replace(/^(Province of|Metropolitan City of|Free municipal consortium of|Provincia di|Citta metropolitana di|Città metropolitana di)\s+/i, '')
        .replace(/\band\b/gi, 'e'))
      const reg = info?.paese === 'IT' ? (regioneCanonica(info.nome) || comeProvincia(info.nome)) : null
      if (!reg) { const et = info ? `${info.nome} (${info.paese})` : codice; sconosciute.set(et, (sconosciute.get(et) || 0) + v.spesa); continue }
      if (!perRegione.has(reg)) perRegione.set(reg, { spesa: 0, campagne: new Map() })
      const r = perRegione.get(reg)
      r.spesa += v.spesa
      for (const [c, sp] of v.campagne.entries()) r.campagne.set(c, (r.campagne.get(c) || 0) + sp)
    }
    return { perRegione, totale, sconosciute }
  } catch (e) { return { errore: `Google: ${String(e.message).slice(0, 120)}` } }
}

// Sessioni per REGIONE: la regione e' una dimensione di Shopify, quindi qui
// il dato e' esatto. Restano fuori solo le sessioni di cui Shopify non
// conosce la regione, contate a parte.
async function sessioniPerRegione(range) {
  try {
    const righe = await sessioniShopify(range, 'session_region')
    const perRegione = new Map(), sconosciute = new Map()
    let totale = 0
    for (const r of righe) {
      const sess = Math.round(num(r.sessions))
      totale += sess
      const nome = vuoto(r.session_region) ? '' : String(r.session_region)
      const reg = regioneCanonica(nome)
      if (!reg) { const k = nome || 'regione non rilevata'; sconosciute.set(k, (sconosciute.get(k) || 0) + sess); continue }
      perRegione.set(reg, (perRegione.get(reg) || 0) + sess)
    }
    return { perRegione, totale, sconosciute }
  } catch (e) { return { errore: `Sessioni Shopify: ${String(e.message).slice(0, 120)}` } }
}

const ITALIA = /^(italy|italia|it)$/i
async function mercatoDelNegozio() {
  const oggi = new Date()
  const da = new Date(oggi.getTime() - 90 * 86400000).toISOString().slice(0, 10)
  const a = oggi.toISOString().slice(0, 10)
  try {
    const righe = await shopifyql(`FROM sales SHOW orders GROUP BY shipping_country SINCE ${da} UNTIL ${a} ORDER BY orders DESC LIMIT 100`, { ttlMs: 24 * 3_600_000 })
    const paesi = (righe || [])
      .map(r => ({ paese: String(r.shipping_country ?? '').trim(), ordini: num(r.orders) }))
      .filter(r => r.ordini > 0 && !vuoto(r.paese))
    const tot = paesi.reduce((s, r) => s + r.ordini, 0)
    if (tot > 0) {
      const primo = paesi.reduce((x, r) => (r.ordini > x.ordini ? r : x))
      const it = paesi.filter(r => ITALIA.test(r.paese)).reduce((s, r) => s + r.ordini, 0)
      return { italia: ITALIA.test(primo.paese), fonte: 'ordini', paese: primo.paese, quotaItalia: Math.round((it / tot) * 1000) / 10 }
    }
  } catch {}
  try {
    const d = await gql('query { shop { billingAddress { countryCodeV2 } } }', {})
    const paese = d?.shop?.billingAddress?.countryCodeV2 || null
    if (paese) return { italia: paese === 'IT', fonte: 'negozio', paese, quotaItalia: null }
  } catch {}
  return { italia: true, fonte: 'sconosciuto', paese: null, quotaItalia: null }
}

// La risposta senza niente dentro, con la stessa forma di quella piena: la
// pagina la legge come "nessuna provincia" e non disegna la sezione.
function rispostaVuota(range, motivo, mercato = null) {
  return {
    ok: true, motivo, mercato, range,
    regioni: [],
    spesaRegioni: {
      meta: { totale: 0, fuoriItalia: [] }, google: { totale: 0, fuoriItalia: [] },
      sessioni: { totale: 0, nonAssegnate: [] }, merMedio: null, provinceSenzaRegione: [],
    },
    province: [],
    totali: { province: 0, ordini: 0, fatturato: 0, comuni: 0 },
    fuori: {
      ordiniTotali: 0, fatturatoTotale: 0, senzaProvincia: 0, fatturatoSenzaProvincia: 0,
      recuperatiDallaFatturazione: 0, estero: 0, marketplace: 0, troncato: false,
    },
    analytics: { nota: motivo === 'nessunShopify' ? 'Shopify non collegato.' : 'Il mercato principale del negozio non e\' l\'Italia: province e regioni italiane non si calcolano.' },
  }
}

function resolveRange(sp) {
  const since = sp.get('since'), until = sp.get('until')
  if (since && until) return { since, until }
  const preset = sp.get('preset') || 'last_30d'
  const m = preset.match(/^custom_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/)
  if (m) return { since: m[1], until: m[2] }
  return getRange(preset, sp)
}

async function calcola(range, canaliCliente = [], etichetta = null) {
  // Partono subito: girano mentre si sfogliano gli ordini, non dopo.
  const inArrivo = Promise.all([spesaMetaPerRegione(range, etichetta), spesaGooglePerRegione(range), sessioniPerRegione(range)])
  const province = new Map()   // nome provincia → aggregato
  const idProdotti = new Set()
  let ordiniTotali = 0, fatturatoTotale = 0
  let senzaProvincia = 0, fatturatoSenzaProvincia = 0
  let daFatturazione = 0, estero = 0
  let troncato = false, vecchi = false

  const nuovaProvincia = (nome) => ({
    provincia: nome, ordini: 0, fatturato: 0, resi: 0,
    nuovi: 0, ritorno: 0, fatturatoNuovi: 0, fatturatoRitorno: 0,
    comuni: new Map(), marchi: new Map(), prodotti: new Map(),
  })

  // Le interrogazioni: tutte dalla porta unica, tutte senza i canali esclusi del cliente.
  const canali = clausolaSenzaCanali(canaliCliente)
  const dove = (extra) => { const c = [extra, canali].filter(Boolean).join(' AND '); return c ? `WHERE ${c}` : '' }
  const periodo = `SINCE ${range.since} UNTIL ${range.until}`
  const LIMITE = 20000
  const chiedi = async (q) => {
    const righe = await shopifyql(q)
    if (righe?.stale) vecchi = true
    if (righe.length >= LIMITE) troncato = true
    return righe
  }
  const IT = "shipping_country = 'Italy'"
  const [totali, perComune, perMarchio, perProdotto] = [
    // Paese e provincia di spedizione e di fatturazione: la seconda e' il ripiego
    // di chi scrive i propri dati solo nell'indirizzo di fatturazione.
    await chiedi(`FROM sales SHOW total_sales, orders, orders_first_time, orders_returning, total_sales_first_time, total_sales_returning, returns ${dove('')} GROUP BY shipping_country, shipping_region, billing_country, billing_region ${periodo} ORDER BY total_sales DESC LIMIT ${LIMITE}`),
    await chiedi(`FROM sales SHOW total_sales, orders ${dove(IT)} GROUP BY shipping_region, shipping_city ${periodo} ORDER BY total_sales DESC LIMIT ${LIMITE}`),
    await chiedi(`FROM sales SHOW total_sales, net_items_sold ${dove(IT)} GROUP BY shipping_region, product_vendor ${periodo} ORDER BY total_sales DESC LIMIT ${LIMITE}`),
    await chiedi(`FROM sales SHOW total_sales, net_items_sold ${dove(IT)} GROUP BY shipping_region, product_id ${periodo} ORDER BY total_sales DESC LIMIT ${LIMITE}`),
  ]

  for (const r of totali) {
    const ordini = Math.round(num(r.orders))
    const vendite = num(r.total_sales)          // resi gia' tolti, come il riquadro in alto
    const reso = Math.abs(num(r.returns))
    ordiniTotali += ordini
    fatturatoTotale += vendite
    const paese = !vuoto(r.shipping_country) ? String(r.shipping_country) : (!vuoto(r.billing_country) ? String(r.billing_country) : null)
    if (paese && paese !== 'Italy') { estero += ordini; continue }
    // Il ripiego: la spedizione prima, poi la fatturazione.
    const daSpedizione = vuoto(r.shipping_region) ? '' : String(r.shipping_region).trim()
    const nomeProv = daSpedizione || (vuoto(r.billing_region) ? '' : String(r.billing_region).trim())
    if (!daSpedizione && nomeProv) daFatturazione += ordini
    if (!nomeProv) { senzaProvincia += ordini; fatturatoSenzaProvincia += vendite; continue }
    if (!province.has(nomeProv)) province.set(nomeProv, nuovaProvincia(nomeProv))
    const p = province.get(nomeProv)
    p.ordini += ordini
    // `fatturato` resta il LORDO dei resi e `resi` a parte: piu' sotto netto = fatturato − resi,
    // cioe' esattamente total_sales.
    p.fatturato += vendite + reso
    p.resi += reso
    p.nuovi += Math.round(num(r.orders_first_time))
    p.ritorno += Math.round(num(r.orders_returning))
    p.fatturatoNuovi += num(r.total_sales_first_time)
    p.fatturatoRitorno += num(r.total_sales_returning)
  }

  // Comuni, marchi e prodotti: per provincia di SPEDIZIONE (il ripiego sulla fatturazione vale
  // per i totali qui sopra; per il dettaglio resterebbe fuori solo quel poco).
  const diProvincia = (r) => (vuoto(r.shipping_region) ? null : province.get(String(r.shipping_region).trim())) || null
  for (const r of perComune) {
    const p = diProvincia(r); if (!p || vuoto(r.shipping_city)) continue
    const k = String(r.shipping_city).trim()
    const c = p.comuni.get(k) || { comune: k, ordini: 0, fatturato: 0 }
    c.ordini += Math.round(num(r.orders)); c.fatturato += num(r.total_sales)
    p.comuni.set(k, c)
  }
  for (const r of perMarchio) {
    const p = diProvincia(r); if (!p || vuoto(r.product_vendor)) continue
    const marchio = String(r.product_vendor).trim()
    const m = p.marchi.get(marchio) || { marchio, fatturato: 0, pezzi: 0 }
    m.fatturato += num(r.total_sales); m.pezzi += Math.round(num(r.net_items_sold))
    p.marchi.set(marchio, m)
  }
  for (const r of perProdotto) {
    const p = diProvincia(r); if (!p || vuoto(r.product_id)) continue
    const id = `gid://shopify/Product/${String(r.product_id).replace(/\D/g, '')}`
    idProdotti.add(id)
    const g = p.prodotti.get(id) || { id, fatturato: 0, pezzi: 0 }
    g.fatturato += num(r.total_sales); g.pezzi += Math.round(num(r.net_items_sold))
    p.prodotti.set(id, g)
  }

  // Categorie, generi e prodotti: dai prodotti venduti ai loro metacampi, in
  // blocco, una volta sola per tutte le province.
  const meta = await datiProdotti(idProdotti)
  for (const p of province.values()) {
    const perCat = new Map(), perGenere = new Map()
    const elenco = []
    for (const v of p.prodotti.values()) {
      const m = meta.get(v.id) || {}
      perCat.set(m.categoria || 'SENZA CATEGORIA', (perCat.get(m.categoria || 'SENZA CATEGORIA') || 0) + v.fatturato)
      // Un prodotto senza genere non diventa "unisex": resta non dichiarato.
      if (m.genere) perGenere.set(m.genere, (perGenere.get(m.genere) || 0) + v.fatturato)
      else perGenere.set('NON DICHIARATO', (perGenere.get('NON DICHIARATO') || 0) + v.fatturato)
      elenco.push({
        titolo: m.titolo || v.id.split('/').pop(),
        immagine: m.immagine || null,
        categoria: m.categoria || null,
        genere: m.genere || null,
        fatturato: r2(v.fatturato), pezzi: v.pezzi,
      })
    }
    p.categorie = perCat
    p.generi = perGenere
    p.elencoProdotti = elenco.sort((a, b) => b.fatturato - a.fatturato)
  }

  // Le sessioni si attaccano ai comuni che conosciamo dagli ordini di SEMPRE,
  // non solo da quelli del periodo: altrimenti chi guarda e non compra esce
  // dal denominatore e il tasso di conversione sale dove non dovrebbe.
  await attendi(1300)
  const ga = await sessioniPerComune(range)
  let sessioniAttribuite = 0, sessioniNonAssegnate = 0
  let mappaInfo = null
  if (ga) {
    mappaInfo = await mappaComuni()
    const perProvincia = new Map()
    for (const [comune, sess] of ga.perComune.entries()) {
      const prov = mappaInfo.mappa.get(comune)
      if (!prov) { sessioniNonAssegnate += sess; continue }
      perProvincia.set(prov, (perProvincia.get(prov) || 0) + sess)
      sessioniAttribuite += sess
    }
    for (const p of province.values()) p.sessioni = perProvincia.get(p.provincia) || null
    // Una provincia puo' avere sessioni e nessun ordine: e' un'informazione,
    // non un vuoto da saltare.
    for (const [prov, sess] of perProvincia.entries()) {
      if (province.has(prov)) continue
      const vuota = nuovaProvincia(prov)
      vuota.sessioni = sess
      province.set(prov, vuota)
    }
  }

  const righe = [...province.values()].map(p => {
    const netto = p.fatturato - p.resi
    return {
      provincia: p.provincia,
      ordini: p.ordini,
      fatturato: r2(netto),
      aov: p.ordini > 0 ? r2(netto / p.ordini) : null,
      nuovi: p.nuovi,
      ritorno: p.ritorno,
      quotaNuovi: p.ordini > 0 ? Math.round((p.nuovi / p.ordini) * 1000) / 10 : null,
      fatturatoNuovi: r2(p.fatturatoNuovi),
      fatturatoRitorno: r2(p.fatturatoRitorno),
      resi: r2(p.resi),
      sessioni: p.sessioni ?? null,
      // Il tasso si calcola solo dove ci sono sessioni attribuite: senza,
      // dividere per zero darebbe una provincia "perfetta" che non lo e'.
      cro: p.sessioni > 0 ? Math.round((p.ordini / p.sessioni) * 10000) / 100 : null,
      comuni: [...p.comuni.values()].sort((a, b) => b.fatturato - a.fatturato)
        .map(c => ({ ...c, fatturato: r2(c.fatturato) })),
      marchi: [...p.marchi.values()].sort((a, b) => b.fatturato - a.fatturato)
        .map(m => ({ ...m, fatturato: r2(m.fatturato) })),
      categorie: [...(p.categorie || new Map()).entries()].map(([categoria, fatturato]) => ({ categoria, fatturato: r2(fatturato) }))
        .sort((a, b) => b.fatturato - a.fatturato),
      generi: [...(p.generi || new Map()).entries()].map(([genere, fatturato]) => ({ genere, fatturato: r2(fatturato) }))
        .sort((a, b) => b.fatturato - a.fatturato),
      prodotti: (p.elencoProdotti || []).slice(0, 12),
    }
  }).sort((a, b) => b.fatturato - a.fatturato)

  // ── Le regioni: province sommate, con spesa e sessioni a fianco ─────────
  const [metaSpesa, googleSpesa, sessReg] = await inArrivo
  const regioni = new Map()
  const nuovaRegione = (nome) => ({
    regione: nome, ordini: 0, lordo: 0, resi: 0, nuovi: 0, ritorno: 0, fatturatoRitorno: 0,
    province: [], marchi: new Map(), categorie: new Map(), generi: new Map(), prodotti: new Map(),
  })
  const provinceSenzaRegione = []
  for (const p of province.values()) {
    if (p.ordini === 0) continue
    const nomeReg = regioneDiProvincia(p.provincia)
    if (!nomeReg) { provinceSenzaRegione.push({ provincia: p.provincia, ordini: p.ordini, fatturato: r2(p.fatturato - p.resi) }); continue }
    if (!regioni.has(nomeReg)) regioni.set(nomeReg, nuovaRegione(nomeReg))
    const r = regioni.get(nomeReg)
    r.ordini += p.ordini; r.lordo += p.fatturato; r.resi += p.resi
    r.nuovi += p.nuovi; r.ritorno += p.ritorno; r.fatturatoRitorno += p.fatturatoRitorno
    r.province.push({ comune: p.provincia, ordini: p.ordini, fatturato: r2(p.fatturato - p.resi) })
    for (const m of p.marchi.values()) {
      const g = r.marchi.get(m.marchio) || { marchio: m.marchio, fatturato: 0, pezzi: 0 }
      g.fatturato += m.fatturato; g.pezzi += m.pezzi; r.marchi.set(m.marchio, g)
    }
    for (const [k, v] of (p.categorie || new Map()).entries()) r.categorie.set(k, (r.categorie.get(k) || 0) + v)
    for (const [k, v] of (p.generi || new Map()).entries()) r.generi.set(k, (r.generi.get(k) || 0) + v)
    for (const pr of (p.elencoProdotti || [])) {
      const g = r.prodotti.get(pr.titolo) || { ...pr, fatturato: 0, pezzi: 0 }
      g.fatturato += pr.fatturato; g.pezzi += pr.pezzi; r.prodotti.set(pr.titolo, g)
    }
  }
  // Una regione dove si spende e non si vende deve comparire: e' la riga che
  // piu' interessa a chi decide dove tagliare.
  for (const fonte of [metaSpesa, googleSpesa]) {
    for (const nome of (fonte?.perRegione?.keys?.() || [])) if (!regioni.has(nome)) regioni.set(nome, nuovaRegione(nome))
  }
  const campagneDi = (fonte, nome, piattaforma) => [...(fonte?.perRegione?.get(nome)?.campagne?.entries?.() || [])]
    .map(([campagna, spesa]) => ({ piattaforma, campagna, spesa: r2(spesa) }))
  const righeRegioni = [...regioni.values()].map(r => {
    const netto = r.lordo - r.resi
    const spesaMeta = metaSpesa?.perRegione?.get(r.regione)?.spesa ?? (metaSpesa?.errore ? null : 0)
    const spesaGoogle = googleSpesa?.perRegione?.get(r.regione)?.spesa ?? (googleSpesa?.errore ? null : 0)
    // Se una delle due fonti e' in errore il totale NON si calcola: sommare
    // quello che c'e' lo farebbe sembrare un totale, e non lo e'.
    const spesa = (spesaMeta == null || spesaGoogle == null) ? null : spesaMeta + spesaGoogle
    const sessioni = sessReg?.perRegione?.get(r.regione) ?? null
    return {
      regione: r.regione,
      provincia: r.regione,           // stessa forma delle righe provincia: il pop-up e' uno solo
      ordini: r.ordini,
      fatturato: r2(netto),
      aov: r.ordini > 0 ? r2(netto / r.ordini) : null,
      nuovi: r.nuovi, ritorno: r.ritorno,
      quotaNuovi: r.ordini > 0 ? Math.round((r.nuovi / r.ordini) * 1000) / 10 : null,
      fatturatoRitorno: r2(r.fatturatoRitorno),
      sessioni,
      cro: sessioni > 0 ? Math.round((r.ordini / sessioni) * 10000) / 100 : null,
      spesaMeta: spesaMeta == null ? null : r2(spesaMeta),
      spesaGoogle: spesaGoogle == null ? null : r2(spesaGoogle),
      spesa: spesa == null ? null : r2(spesa),
      // Fatturato per euro speso, e quanto costa un ordine: i due numeri su
      // cui si decide se una regione merita il suo budget.
      mer: spesa > 0 ? r2(netto / spesa) : null,
      cpo: spesa > 0 && r.ordini > 0 ? r2(spesa / r.ordini) : null,
      comuni: r.province.sort((a, b) => b.fatturato - a.fatturato),
      marchi: [...r.marchi.values()].sort((a, b) => b.fatturato - a.fatturato).map(m => ({ ...m, fatturato: r2(m.fatturato) })),
      categorie: [...r.categorie.entries()].map(([categoria, fatturato]) => ({ categoria, fatturato: r2(fatturato) })).sort((a, b) => b.fatturato - a.fatturato),
      generi: [...r.generi.entries()].map(([genere, fatturato]) => ({ genere, fatturato: r2(fatturato) })).sort((a, b) => b.fatturato - a.fatturato),
      prodotti: [...r.prodotti.values()].sort((a, b) => b.fatturato - a.fatturato).slice(0, 12).map(x => ({ ...x, fatturato: r2(x.fatturato) })),
      campagne: [...campagneDi(metaSpesa, r.regione, 'Meta'), ...campagneDi(googleSpesa, r.regione, 'Google')].sort((a, b) => b.spesa - a.spesa),
    }
  }).sort((a, b) => (b.spesa ?? 0) - (a.spesa ?? 0))

  const totSpesa = righeRegioni.reduce((a, r) => a + (r.spesa || 0), 0)
  const totFatt = righeRegioni.reduce((a, r) => a + r.fatturato, 0)
  for (const r of righeRegioni) {
    r.quotaSpesa = totSpesa > 0 && r.spesa != null ? Math.round((r.spesa / totSpesa) * 1000) / 10 : null
    r.quotaFatturato = totFatt > 0 ? Math.round((r.fatturato / totFatt) * 1000) / 10 : null
  }
  const elenco = (m) => [...(m?.entries?.() || [])].map(([k, v]) => ({ nome: k, valore: r2(v) })).sort((a, b) => b.valore - a.valore).slice(0, 8)

  return {
    ok: true,
    range,
    regioni: righeRegioni,
    spesaRegioni: {
      meta: metaSpesa?.errore ? { errore: metaSpesa.errore } : { totale: r2(metaSpesa?.totale), fuoriItalia: elenco(metaSpesa?.sconosciute) },
      google: googleSpesa?.errore ? { errore: googleSpesa.errore } : { totale: r2(googleSpesa?.totale), fuoriItalia: elenco(googleSpesa?.sconosciute) },
      sessioni: sessReg?.errore ? { errore: sessReg.errore } : { totale: sessReg?.totale, nonAssegnate: elenco(sessReg?.sconosciute) },
      merMedio: totSpesa > 0 ? r2(totFatt / totSpesa) : null,
      provinceSenzaRegione,
    },
    province: righe,
    totali: {
      province: righe.length,
      ordini: righe.reduce((s, r) => s + r.ordini, 0),
      fatturato: r2(righe.reduce((s, r) => s + r.fatturato, 0)),
      comuni: righe.reduce((s, r) => s + r.comuni.length, 0),
    },
    // Tutto cio' che NON e' finito nelle province, detto invece che taciuto.
    fuori: {
      ordiniTotali,
      fatturatoTotale: r2(fatturatoTotale),
      senzaProvincia,
      fatturatoSenzaProvincia: r2(fatturatoSenzaProvincia),
      recuperatiDallaFatturazione: daFatturazione,
      estero,
      troncato,
      datiVecchi: vecchi,
    },
    analytics: ga ? {
      sessioniItalia: ga.totali,
      sessioniSenzaCitta: ga.nonDette,
      sessioniAttribuite,
      sessioniDiComuniMaiOrdinanti: sessioniNonAssegnate,
      comuniNotiDagliOrdini: mappaInfo?.comuniNoti ?? 0,
      mappaFinestra: mappaInfo?.finestra || null,
      mappaGuai: mappaInfo?.guai?.length ? mappaInfo.guai : null,
      copertura: ga.totali > 0 ? Math.round((sessioniAttribuite / ga.totali) * 1000) / 10 : null,
      nota: 'Sessioni di Shopify (le stesse del pannello Shopify), solo Italia. Shopify non conosce le province: le sessioni si attaccano al comune, e il comune si collega alla provincia grazie agli ordini. Le citta\' senza nessun ordine restano fuori.',
    } : { nota: 'Sessioni Shopify non leggibili: ordini e fatturato per provincia restano completi, sessioni e tasso di conversione no.' },
  }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const sp = new URL(req.url).searchParams
    const range = resolveRange(sp)
    if (!range?.since || !range?.until) {
      return NextResponse.json({ ok: false, error: 'Periodo non valido' }, { status: 400 })
    }
    // Senza Shopify non c'e' niente da leggere: lo si dice subito, invece di chiamare
    // https://undefined e mostrare "fetch failed".
    const { storeUrl, adminToken } = getShopify() || {}
    if (!storeUrl || !adminToken) return NextResponse.json(rispostaVuota(range, 'nessunShopify'))
    // @2: etichetta dei negozi fisici per cliente, categoria dal tipo di prodotto, controllo del mercato.
    return swrSnapshot(req, { tab: 'kpiProvinceTotali@2', ttlMs: 6 * ORE, compute: async () => {
      try {
        // Un negozio che vende soprattutto fuori dall'Italia: province e regioni italiane non si
        // calcolano, e non si chiamano Shopify, Meta e Google per niente.
        const mercato = await mercatoDelNegozio()
        if (!mercato.italia) return rispostaVuota(range, 'fuoriItalia', mercato)
        const negozio = await negozioDelCliente()
        const out = { ...(await calcola(range, negozio.canaliEsclusi, etichettaDi(negozio))), mercato }
        // Un pezzo mancato per un inciampo esterno (limite di Shopify o di Meta, rete) NON si
        // conserva: prima la risposta con l'errore dentro restava in cache 6 ORE e veniva
        // riservita a tutti — per questo "Rate limited" sembrava capitare cosi' spesso.
        // "Non collegato" invece e' uno stato, non un inciampo: quello si puo' conservare.
        const inciampi = ['meta', 'google', 'sessioni'].filter(k => { const e = out?.spesaRegioni?.[k]?.errore; return e && !/non collegat/i.test(e) })
        // Shopify ha dato l'ultimo dato buono invece di quello nuovo: si mostra, ma non si conserva.
        if (out?.fuori?.datiVecchi) inciampi.push('shopify')
        return inciampi.length ? { ...out, inRitardo: inciampi, __noCache: true } : out
      }
      catch (e) { return { ok: false, error: e?.message || 'Errore Shopify', range, __noCache: true } }
    } })
  })
}
