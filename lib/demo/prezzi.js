// ============================================================================
//  DEMO — i dati inventati di due tab che nella demo restavano vuote:
//
//   · PREZZI (app/components/PrezziTab.jsx) → GET/POST /api/prezzi, /api/prezzi/mercato
//     Il nostro prezzo contro il prezzo di mercato di Google Merchant Center, il prezzo
//     suggerito da Google e i prezzi letti sui siti di altri negozi (nomi INVENTATI e
//     generici: nessun negozio o marchio reale).
//   · PERFORMANCE PRODOTTI GOOGLE (app/components/GoogleVerdictsTab.jsx)
//     → GET /api/google-product-verdicts?since&until, GET/POST .../soglie
//     I giudizi (da scalare / stand-by / da fermare / da verificare / dati insufficienti)
//     NON sono scritti a mano: nascono dagli stessi conti e dalle stesse regole della
//     route vera (app/api/google-product-verdicts/route.js), sui numeri inventati qui.
//     Cosi' ogni riga torna a mano e cambiando periodo i giudizi si spostano da soli.
//
//  Forme identiche alle route vere (lib/prezzi/motore.js → quadro(); route dei verdetti →
//  compute()). Numeri deterministici: nessun Math.random, la stessa domanda da' sempre la
//  stessa risposta; date relative a Date.now().
//
//  La spesa Google per prodotto nasce dalla spesa Google della demo (/api/google, giornaliera)
//  sommata sul periodo chiesto: il 60% va sui prodotti (Shopping + Performance Max, come nella
//  demo di Google Detail: 4.300 € su 7.170), il resto sono campagne Search/Display senza prodotto.
//
//  NON importa data.js (niente import circolari): quel che serve arriva nel contesto
//  ctx = { DEMO_PRODUCTS, pimg, ymd, iso, DAY, google }, dove `google` e' la risposta demo di
//  /api/google ({ daily: [{ date, spend }] }) o una funzione che la restituisce.
// ============================================================================

export const PREZZI_PATHS = new Set([
  '/api/prezzi',
  '/api/prezzi/mercato',
  '/api/google-product-verdicts',
  '/api/google-product-verdicts/soglie',
])

// ── Aiuti ────────────────────────────────────────────────────────────────────
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const DAY_MS = 86400000
const lingua = () => ((typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) || 'it').slice(0, 2)

// Le macro categorie arrivano dai DATI (metafield del catalogo): sono testo che si legge, quindi
// nella lingua della demo.
const CATEGORIE = {
  it: { abb: 'Abbigliamento', borse: 'Borse e zaini', scarpe: 'Calzature', acc: 'Accessori' },
  en: { abb: 'Apparel', borse: 'Bags & backpacks', scarpe: 'Footwear', acc: 'Accessories' },
  es: { abb: 'Ropa', borse: 'Bolsas y mochilas', scarpe: 'Calzado', acc: 'Accesorios' },
  fr: { abb: 'Vêtements', borse: 'Sacs et sacs à dos', scarpe: 'Chaussures', acc: 'Accessoires' },
  de: { abb: 'Bekleidung', borse: 'Taschen & Rucksäcke', scarpe: 'Schuhe', acc: 'Zubehör' },
}
// indice di DEMO_PRODUCTS → categoria
const CAT_DI = ['borse', 'abb', 'abb', 'borse', 'abb', 'abb', 'scarpe', 'acc', 'acc', 'abb', 'acc', 'acc']

// Marchi INVENTATI (nessun marchio reale). Il negozio d'esempio li rivende; il suo marchio
// proprio (Acme) non lo vende nessun altro, quindi resta senza confronto di prezzo.
const MARCHIO_DI = ['Altacima', 'Ventoblu', 'Ventoblu', 'Altacima', 'Passolungo', 'Ventoblu', 'Passolungo', 'Equilibra', 'Equilibra', 'Ventoblu', 'Equilibra', 'Equilibra']

// Aliquota IVA come in Performance prodotti della demo (demoProductPerformance): 10 ogni quarto prodotto.
const aliquotaDi = (pi) => (pi % 4 === 3 ? 10 : 22)
const senzaIva = (p, a) => p / (1 + a / 100)

// Stessi clic della demo di Prodotti Google (demoGoogleProducts, finestra 7 giorni).
const clicGP = (pi) => 20 + ((pi * 7) % 9) * 14

// EAN-13 inventato ma col controllo giusto, prefisso 200 (uso interno: non esiste in commercio).
function ean13(n) {
  const base = '200' + String(n).padStart(9, '0')
  let s = 0
  for (let i = 0; i < 12; i++) s += Number(base[i]) * (i % 2 ? 3 : 1)
  return base + ((10 - (s % 10)) % 10)
}

function prodotti(ctx) {
  const P = (ctx && ctx.DEMO_PRODUCTS) || []
  return P.map(([title, price, cost, color], pi) => ({ pi, title, price, cost, color }))
}
const immagine = (ctx, pi) => (ctx && typeof ctx.pimg === 'function' ? ctx.pimg(pi) : null)
const giornoIso = (ctx, t) => (ctx && typeof ctx.ymd === 'function' ? ctx.ymd(t) : new Date(t).toISOString().slice(0, 10))
const istante = (ctx, t) => (ctx && typeof ctx.iso === 'function' ? ctx.iso(t) : new Date(t).toISOString())

// ============================================================================
//  PREZZI
// ============================================================================

// Altri negozi (nomi generici inventati). `prodotti` = articoli nel loro catalogo pubblico.
const NEGOZI = [
  { dominio: 'SportShop Online', prodotti: 2140, ore: 3.2 },
  { dominio: 'Negozio A', prodotti: 860, ore: 3.3 },
  { dominio: 'Outlet Fitness', prodotti: 1310, ore: 3.4 },
  { dominio: 'Casa dello Sport', prodotti: 3920, ore: 3.5 },
  { dominio: 'Atletica Store', prodotti: 640, ore: 3.6 },
]

// Una riga per variante. m = prezzo di mercato Google (null = Google non ce l'ha),
// sug = suggerito da Google, eff = [clic, impressioni, conversioni previste, efficacia],
// off = offerte degli altri negozi [negozio, prezzo, livello, disponibile, pieno],
// pieno = prezzo pieno (barrato) se siamo in sconto, g = giacenza, quota = quota del traffico del prodotto.
const RIGHE_PREZZI = [
  { pi: 0, v: 'Nero', g: 34, m: 72.5, sug: 74.9, eff: [0.14, 0.11, 0.09, 'HIGH'], off: [[1, 71.9, 'esatto'], [0, 74.5, 'esatto'], [2, 69.9, 'modello'], [3, 76.9, 'esatto']] },
  { pi: 1, v: 'M', g: 58, pieno: 29.9, m: 24.8, off: [[0, 24.9, 'esatto'], [3, 26.5, 'esatto']], quota: 0.6 },
  { pi: 1, v: 'L', g: 41, pieno: 29.9, m: 24.9, off: [[0, 24.9, 'esatto'], [3, 26.5, 'esatto']], quota: 0.4 },
  { pi: 2, v: 'S', g: 27, m: 25.4, sug: 24.5, eff: [-0.03, -0.02, 0.02, 'LOW'], off: [[1, 25.9, 'esatto'], [4, 24.9, 'esatto'], [2, 21.9, 'modello', false]] },
  { pi: 3, v: 'Blu', g: 12, m: 89.9, sug: 92.9, eff: [0.18, 0.15, 0.12, 'HIGH'], off: [[0, 89.9, 'esatto'], [3, 94.5, 'esatto', true, 109], [2, 84.9, 'modello']] },
  { pi: 4, v: 'Unica', g: 140, m: 19.9, off: [[1, 19.9, 'esatto'], [4, 18.9, 'esatto']] },
  { pi: 5, v: 'Grigio', g: 23, m: 64.9, sug: 66.9, eff: [0.09, 0.07, 0.06, 'MEDIUM'], off: [[0, 64.9, 'esatto'], [3, 66.5, 'esatto'], [1, 59.9, 'modello']] },
  { pi: 6, v: '42', g: 9, pieno: 139, m: 124.5, off: [[0, 124.9, 'esatto'], [3, 129, 'esatto'], [2, 119.5, 'esatto', false]], quota: 0.55 },
  { pi: 6, v: '44', g: 7, pieno: 139, m: 125.9, off: [[0, 124.9, 'esatto'], [3, 129, 'esatto']], quota: 0.45 },
  { pi: 7, v: 'Viola', g: 31, m: 31.9, sug: 32.9, eff: [0.11, 0.08, 0.07, 'MEDIUM'], off: [[1, 31.5, 'esatto'], [4, 32.9, 'esatto']] },
  { pi: 8, v: 'Verde', g: 66, m: 22.5, sug: 23.4, eff: [0.16, 0.12, 0.1, 'HIGH'], off: [[0, 22.9, 'esatto'], [1, 21.9, 'esatto'], [2, 22.5, 'modello'], [4, 23.9, 'esatto']] },
  { pi: 9, v: 'Nero', g: 45, m: null, sug: 17.9, eff: [0.07, 0.05, 0.04, 'LOW'], off: [[3, 17.5, 'esatto'], [0, 18.9, 'modello']] },
  { pi: 10, v: 'Unica', g: 88, m: 13.5, off: [[4, 13.9, 'esatto'], [1, 12.9, 'modello']] },
  { pi: 11, v: 'M', g: 19, m: 14.9, sug: 15.4, eff: [0.21, 0.17, 0.13, 'HIGH'], off: [[1, 14.5, 'esatto'], [0, 14.9, 'esatto'], [3, 15.9, 'esatto']] },
]

function quadroPrezzi(ctx) {
  const now = Date.now()
  const P = prodotti(ctx)
  const letto = istante(ctx, now - 3 * 3600_000 - 22 * 60_000)
  const lettoMercato = istante(ctx, now - 3 * 3600_000 - 20 * 60_000)
  const giorno = (n) => giornoIso(ctx, now - n * DAY_MS)
  const periodi = Object.fromEntries([7, 30, 90].map(n => [n, { since: giorno(n), until: giorno(1) }]))

  // stato di ogni negozio: letto fra 3 e 4 ore fa, articoli in comune = quelli trovati qui sotto
  const inComune = NEGOZI.map(() => ({ abbinati: 0, esatti: 0 }))
  for (const r of RIGHE_PREZZI) for (const [k, , liv] of r.off) { inComune[k].abbinati++; if (liv === 'esatto') inComune[k].esatti++ }
  const concorrenti = NEGOZI.map((n, k) => ({ dominio: n.dominio, ok: true, letto: istante(ctx, now - n.ore * 3600_000), errore: null, prodotti: n.prodotti, abbinati: inComune[k].abbinati, esatti: inComune[k].esatti }))

  const righe = []
  RIGHE_PREZZI.forEach((d, k) => {
    const p = P[d.pi]
    if (!p) return
    const prezzo = p.price
    const costo = p.cost
    const aliquotaIva = aliquotaDi(d.pi)
    const pct = (rif) => (prezzo > 0 && rif > 0 ? +(((prezzo - rif) / rif) * 100).toFixed(1) : null)
    const margineA = (x) => (costo != null && x > 0 ? +(senzaIva(x, aliquotaIva) - costo).toFixed(2) : null)
    const margine = margineA(prezzo)
    const offerte = d.off.map(([n, pr, livello, disponibile = true, pieno = null]) => ({
      dominio: NEGOZI[n].dominio, livello, prezzo: pr, pieno, disponibile, url: '#',
    }))
    let minimo = null
    if (offerte.length) {
      const esatte = offerte.filter(o => o.livello === 'esatto'), base = esatte.length ? esatte : offerte
      const valide = base.filter(o => o.disponibile !== false)
      minimo = (valide.length ? valide : base).reduce((m, o) => (o.prezzo < m.prezzo ? o : m))
    }
    // traffico Google (annunci + schede gratuite): parte dai clic della demo di Prodotti Google
    const q = d.quota ?? 1
    const base7 = clicGP(d.pi) * 1.25 * q
    const perImpr = 55 + d.pi * 4
    const traffico = {
      7: { clic: Math.round(base7), impressioni: Math.round(base7 * perImpr) },
      30: { clic: Math.round(base7 * 4.4), impressioni: Math.round(base7 * 4.4 * perImpr * 1.04) },
      90: { clic: Math.round(base7 * 12.6), impressioni: Math.round(base7 * 12.6 * perImpr * 1.07) },
    }
    const [effettoClic, effettoImpressioni, effettoConversioni, efficacia] = d.eff || [null, null, null, null]
    righe.push({
      sku: `ACME-${d.pi}${k}-${String(d.v).toUpperCase().replace(/\s+/g, '')}`,
      variantId: String(45000000 + d.pi * 100 + k),
      ean: ean13(8800 + d.pi * 10 + k),
      prezzo, pieno: d.pieno || null,
      titolo: p.title, marchio: MARCHIO_DI[d.pi] || 'Acme',
      immagine: immagine(ctx, d.pi), productId: 7000000 + d.pi,
      giacenza: d.g, costo,
      offerte, minimo, scarto: minimo ? pct(minimo.prezzo) : null,
      aliquotaIva, fonteIva: 'prodotto',
      margine, marginePct: margine != null ? +((margine / senzaIva(prezzo, aliquotaIva)) * 100).toFixed(1) : null,
      clic: traffico[30].clic, impressioni: traffico[30].impressioni, traffico,
      mercato: {
        prezzo: d.m ?? null, scarto: d.m != null ? pct(d.m) : null, margine: d.m != null ? margineA(d.m) : null,
        suggerito: d.sug ?? null, scartoSuggerito: d.sug ? pct(d.sug) : null, margineSuggerito: d.sug ? margineA(d.sug) : null,
        effettoClic, effettoImpressioni, effettoConversioni, efficacia,
      },
    })
  })

  // stesso ordine della route: prima dove il mercato dice che siamo cari
  const peso = (r) => Math.max(r.mercato?.scarto ?? r.mercato?.scartoSuggerito ?? -999, r.minimo?.livello === 'esatto' ? (r.scarto ?? -999) : -999, r.minimo ? (r.scarto ?? -999) - 1000 : -999)
  righe.sort((x, y) => peso(y) - peso(x))
  const rif = (r) => r.mercato?.scarto ?? r.mercato?.scartoSuggerito ?? r.scarto
  const conScarto = righe.filter(r => rif(r) != null)
  const marchi = new Map()
  for (const r of conScarto) {
    const m = marchi.get(r.marchio) || { marchio: r.marchio, articoli: 0, somma: 0, piuCari: 0, clic: 0, impressioni: 0, t: { 7: 0, 30: 0, 90: 0 } }
    m.articoli++; m.somma += rif(r); if (rif(r) > 1) m.piuCari++; m.clic += r.clic || 0; m.impressioni += r.impressioni || 0
    for (const n of [7, 30, 90]) m.t[n] += r.traffico?.[n]?.clic || 0
    marchi.set(r.marchio, m)
  }
  const perMarchio = [...marchi.values()].map(m => ({ marchio: m.marchio, articoli: m.articoli, piuCari: m.piuCari, clic: m.clic, impressioni: m.impressioni, clicPer: m.t, scartoMedio: +(m.somma / m.articoli).toFixed(1) })).sort((x, y) => y.articoli - x.articoli)
  // senza confronto: il marchio proprio (nessun altro lo vende) e qualche articolo appena caricato
  const senzaConfronto = [{ marchio: 'Acme', articoli: 26 }, { marchio: 'Equilibra', articoli: 4 }, { marchio: 'Passolungo', articoli: 3 }, { marchio: 'Ventoblu', articoli: 2 }]
  const articoliNostri = righe.length + senzaConfronto.reduce((a, x) => a + x.articoli, 0)

  return {
    ok: true,
    senzaConfronto, concorrenti, articoliNostri, letto, righe, perMarchio,
    mercato: {
      configurato: true, letto: lettoMercato, periodi,
      articoli: righe.length + 9,   // Google conosce anche articoli che non hanno confronto
      conMercato: righe.filter(r => r.mercato?.prezzo != null).length,
      conSuggerito: righe.filter(r => r.mercato?.suggerito != null).length,
    },
    sintesi: {
      confrontati: righe.length,
      piuCari: conScarto.filter(r => rif(r) > 1).length,
      allineati: conScarto.filter(r => Math.abs(rif(r)) <= 1).length,
      piuEconomici: conScarto.filter(r => rif(r) < -1).length,
    },
  }
}

// ============================================================================
//  PERFORMANCE PRODOTTI GOOGLE (verdetti)
// ============================================================================

const SOGLIE_PREDEFINITE = { banda: 0.30, rapportoPrezzoSpesa: 4, sogliaRipiego: 25, scortaMinima: 10, roasMinimo: 4, scartoMax: 0.45, iva: 22 }
const LIMITI_SOGLIE = { banda: [0, 0.9], rapportoPrezzoSpesa: [1, 20], sogliaRipiego: [1, 500], scortaMinima: [0, 200], roasMinimo: [0, 30], scartoMax: [0.05, 1], iva: [0, 50] }
const QUOTA_PRODOTTI = 0.6   // Shopping + PMax sul totale Google (vedi intestazione)

const COLORI = ['Sabbia', 'Blu Notte', 'Verde Salvia', 'Bordeaux', 'Bianco', 'Nero']

// Un profilo per prodotto pubblicizzato. w = quota della spesa sui prodotti, roas = venduto
// Google ÷ spesa, shop = venduto Shopify ÷ venduto Google (Shopify conta TUTTI i canali, quindi di
// solito e' sopra 1; 0 = su Shopify non ha venduto niente), g = giacenza, col = linea colore
// (prodotto a parte nel catalogo), prec = andamento del periodo prima (moltiplica il ROAS).
// Il giudizio NON e' qui: lo decidono le regole della route, sotto.
const PROFILI = [
  // da scalare: guadagno, ROAS alto, magazzino pieno
  { pi: 6, w: 0.14, roas: 5.6, shop: 1.9, g: 64, prec: 0.92 },
  { pi: 0, w: 0.10, roas: 4.8, shop: 2.1, g: 88, prec: 0.85 },
  { pi: 5, w: 0.08, roas: 4.4, shop: 1.7, g: 53, prec: 1.08 },
  { pi: 2, col: 5, w: 0.043, roas: 5.2, shop: 2.4, g: 120, prec: 0.9 },
  { pi: 8, w: 0.035, roas: 6.1, shop: 2.6, g: 140, prec: 0.95 },
  // stand-by
  { pi: 3, w: 0.07, roas: 3.1, shop: 1.6, g: 41, prec: 1.12 },        // ROAS sotto 4
  { pi: 7, w: 0.037, roas: 2.9, shop: 1.8, g: 36, prec: 0.96 },        // ROAS sotto 4
  { pi: 1, w: 0.05, roas: 4.9, shop: 2.2, g: 6, prec: 0.9 },          // meno di 10 pezzi
  { pi: 9, w: 0.03, roas: 4.5, shop: 1.4, g: 12, prec: 1.0 },         // scorte che non reggono un altro periodo
  { pi: 4, w: 0.0008, roas: 8, shop: 3, g: 210, prec: 1.2 },          // poca spesa ma vende in utile
  // da fermare
  { pi: 11, w: 0.045, roas: 1.3, shop: 1.5, g: 58, prec: 1.25 },      // vende in perdita
  { pi: 5, col: 3, w: 0.033, roas: 1.1, shop: 1.2, g: 4, prec: 1.1, bozza: true },
  { pi: 10, w: 0.022, roas: 0, shop: 0, g: 75, prec: 0 },             // spesa senza nessuna vendita
  { pi: 0, col: 0, w: 0.032, roas: 0, shop: 0, g: 22, prec: 0.5 },
  { pi: 3, col: 2, w: 0.027, roas: 0, shop: 0.9, shopFisso: 1, g: 17, prec: 0.6 }, // spesa senza ordini Google
  // da verificare
  { pi: 2, col: 1, w: 0.04, roas: 4.1, shop: 0.3, g: 48, prec: 1.0 }, // Google si attribuisce molto piu' di Shopify
  { pi: 1, col: 4, w: 0.029, roas: 3.5, shop: 1.5, g: 30, prec: 1.0, senzaCosto: true },
  { pi: 9, col: 5, w: 0.025, roas: 3.2, shop: 1, g: null, prec: 1.0, nonAbbinato: true },
  { pi: 6, col: 4, w: 0.02, roas: 3.8, shop: 0.4, g: 14, prec: 0.9 },
  // dati insufficienti: spesa sotto un quarto del prezzo, nessun ordine
  { pi: 7, col: 2, w: 0.0012, roas: 0, shop: 0, g: 26, prec: 0 },
  { pi: 8, col: 5, w: 0.0009, roas: 0, shop: 0, g: 44, prec: 0 },
  { pi: 11, col: 3, w: 0.0006, roas: 0, shop: 0, g: 31, prec: 0 },
  { pi: 10, col: 1, w: 0.0004, roas: 0, shop: 0, g: 52, prec: 0 },
  { pi: 4, col: 0, w: 0.0005, roas: 0, shop: 0, g: 96, prec: 0 },
]

// Spesa Google della demo sommata sul periodo; fuori dalla serie si usa la media giornaliera.
function spesaGoogle(ctx, since, until) {
  let g = ctx && ctx.google
  try { if (typeof g === 'function') g = g() } catch { g = null }
  const daily = (g && Array.isArray(g.daily)) ? g.daily : []
  const giorni = Math.max(1, Math.round((Date.parse(until) - Date.parse(since)) / DAY_MS) + 1)
  if (!daily.length) return 172 * giorni
  const media = daily.reduce((a, x) => a + (Number(x.spend) || 0), 0) / daily.length
  let tot = 0, contati = 0
  for (const x of daily) if (x.date >= since && x.date <= until) { tot += Number(x.spend) || 0; contati++ }
  // i giorni del periodo che la serie non copre (troppo indietro, o oggi non ancora chiuso)
  return tot + Math.max(0, giorni - contati) * media
}

const pezziDiGoogle = (convValue, conversions, prezzoMedio) => {
  if (!(convValue > 0)) return 0
  const n = prezzoMedio > 0 ? convValue / prezzoMedio : conversions
  return Math.round(n * 10) / 10
}

function verdetti(ctx, search) {
  const now = Date.now()
  const leggiParam = (k) => (search && typeof search.get === 'function' ? search.get(k) : null)
  const oggi = giornoIso(ctx, now)
  let since = leggiParam('since') || giornoIso(ctx, now - 30 * DAY_MS)
  let until = leggiParam('until') || oggi
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) since = giornoIso(ctx, now - 30 * DAY_MS)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) until = oggi
  if (until > oggi) until = oggi
  if (since > until) since = until
  const giorni = Math.round((Date.parse(until) - Date.parse(since)) / DAY_MS) + 1
  const precUntil = giornoIso(ctx, Date.parse(since) - DAY_MS)
  const precSince = giornoIso(ctx, Date.parse(since) - giorni * DAY_MS)
  const range = { since, until }, rangePrec = { since: precSince, until: precUntil }

  const S = { ...SOGLIE_PREDEFINITE }
  const P = prodotti(ctx)
  const L = CATEGORIE[lingua()] || CATEGORIE.it
  const pesoTot = PROFILI.reduce((a, x) => a + x.w, 0)
  const spesaProdotti = spesaGoogle(ctx, since, until) * QUOTA_PRODOTTI
  const spesaProdottiPrec = spesaGoogle(ctx, precSince, precUntil) * QUOTA_PRODOTTI
  // Shopify da' gli ordini solo degli ultimi 60 giorni (come la route vera)
  const ordiniCoperti = Date.parse(since) >= now - 60 * DAY_MS

  let senzaVenditeReali = 0, abbinati = 0, conCosto = 0, conCategoria = 0
  const righe = PROFILI.map((d, k) => {
    const p = P[d.pi]
    if (!p) return null
    const colore = d.col != null ? COLORI[d.col] : null
    const title = colore ? `${p.title} ${colore}` : p.title
    const ivaProdotto = aliquotaDi(d.pi)
    const productId = d.nonAbbinato ? null : (colore ? `p${d.pi}c${d.col}` : `p${d.pi}`)
    const nVar = 2 + ((d.pi + k) % 3)
    const baseId = colore ? 8100000 + d.pi * 10 + d.col : 8000000 + d.pi
    const itemId = colore ? `shopify_it_${baseId}_${4400000 + k * 10}` : `shopify_it_${8000000 + d.pi}_${4300000 + d.pi}`
    const itemIds = [itemId, ...Array.from({ length: nVar - 1 }, (_, s) => `shopify_it_${baseId}_${(colore ? 4400000 + k * 10 : 4300000 + d.pi * 10) + s + 1}`)]

    // Google
    const cost = r2((spesaProdotti * d.w) / pesoTot)
    const convValue = r2(cost * d.roas)
    const conversions = r2(convValue / (p.price * 0.97))
    const clicks = Math.round(cost / (0.42 + ((d.pi * 3 + k) % 5) * 0.06))
    // Shopify (tutti i canali)
    let shopRevenue = null, units = null, ordiniVeri = null
    if (!d.nonAbbinato) {
      shopRevenue = d.shopFisso != null ? r2(p.price * 0.95 * Math.max(1, Math.round(giorni / 10))) : r2(convValue * d.shop)
      if (shopRevenue > 0) {
        units = Math.max(1, Math.round(shopRevenue / (p.price * 0.95)))
        ordiniVeri = ordiniCoperti ? Math.max(1, Math.round(units * 0.92)) : null
      } else { shopRevenue = 0; ordiniVeri = ordiniCoperti ? 0 : null }
    }
    const v = shopRevenue > 0 ? { revenue: shopRevenue, units } : null
    const venditeStato = !productId ? 'nonAbbinato' : (v ? 'ok' : 'zero')
    if (venditeStato === 'zero' && convValue > 0) senzaVenditeReali++
    const ordiniStato = !productId ? 'nonAbbinato' : ordiniVeri != null ? (ordiniVeri > 0 ? 'ok' : 'zero') : 'nonCoperto'

    // catalogo
    const cat = d.nonAbbinato ? null : { price: p.price, cost: d.senzaCosto ? null : p.cost, giacenza: d.g, tracciato: true, categoria: L[CAT_DI[d.pi]] || null, vendor: MARCHIO_DI[d.pi] || 'Acme', stato: d.bozza ? 'DRAFT' : 'ACTIVE', skus: Array.from({ length: nVar }, (_, s) => `ACME-${d.pi}${colore ? d.col : ''}${s}`) }
    if (productId) abbinati++
    if (cat?.cost != null) conCosto++
    if (cat?.categoria) conCategoria++

    // ── i conti della route vera ──
    const roas = cost > 0 ? r2(convValue / cost) : null
    const cpa = conversions >= 1 ? r2(cost / conversions) : null
    const ricavoNetto = r2(convValue / (1 + ivaProdotto / 100))
    const prezzoMedio = (v?.units > 0 && v.revenue > 0) ? r2(v.revenue / v.units) : (cat?.price > 0 ? cat.price : null)
    const pezzi = pezziDiGoogle(convValue, conversions, prezzoMedio)
    const costoUnitario = cat?.cost != null ? cat.cost : null
    const cogs = costoUnitario != null ? r2(costoUnitario * pezzi) : null
    const margineNetto = cogs != null ? r2(ricavoNetto - cogs - cost) : null
    const profittoLordo = cogs != null ? r2(ricavoNetto - cogs) : null
    const poas = (profittoLordo != null && cost > 0) ? r2(profittoLordo / cost) : null
    const scarto = (shopRevenue != null && convValue > 0) ? Math.max(0, r2((convValue - shopRevenue) / convValue)) : null

    // periodo prima
    let prec = null
    if (d.prec != null) {
      const costP = r2((spesaProdottiPrec * d.w * (0.88 + ((k * 7) % 5) * 0.05)) / pesoTot)
      const cvP = r2(costP * d.roas * d.prec)
      const convP = r2(cvP / (p.price * 0.97))
      const ricavoNettoP = r2(cvP / (1 + ivaProdotto / 100))
      const shopP = d.nonAbbinato ? null : r2(Math.max(0, d.shopFisso != null ? p.price * 0.95 : cvP * d.shop))
      const unitsP = shopP > 0 ? Math.max(1, Math.round(shopP / (p.price * 0.95))) : 0
      const prezzoMedioP = shopP > 0 ? r2(shopP / unitsP) : prezzoMedio
      const pezziP = pezziDiGoogle(cvP, convP, prezzoMedioP)
      const cogsP = costoUnitario != null ? r2(costoUnitario * pezziP) : null
      const profittoP = cogsP != null ? r2(ricavoNettoP - cogsP) : null
      prec = {
        cost: costP, conversions: convP, orders: Math.round(convP), convValue: cvP,
        roas: costP > 0 ? r2(cvP / costP) : null, cpa: convP >= 1 ? r2(costP / convP) : null,
        cogs: cogsP, profittoLordo: profittoP, margineNetto: profittoP != null ? r2(profittoP - costP) : null,
        poas: (profittoP != null && costP > 0) ? r2(profittoP / costP) : null,
        shopifyRevenue: shopP, shopifyOrders: productId ? (shopP > 0 ? Math.max(1, Math.round(unitsP * 0.92)) : 0) : null,
      }
    }

    // ── le regole del giudizio della route vera ──
    const nessunaVendita = conversions === 0 && (shopRevenue == null || shopRevenue <= 0)
    const prezzo = cat?.price > 0 ? cat.price : null
    const sogliaSpesa = prezzo != null ? r2(prezzo / S.rapportoPrezzoSpesa) : S.sogliaRipiego
    let verdetto = 'standby', motivo = null
    if (cost >= sogliaSpesa && nessunaVendita) { verdetto = 'uccidi'; motivo = 'spesaSenzaVendite' }
    else if (!productId) { verdetto = 'daVerificare'; motivo = 'nonAbbinato' }
    else if (!ordiniCoperti && shopRevenue == null) { verdetto = 'daVerificare'; motivo = 'copertura' }
    else if (cost < sogliaSpesa) {
      const almenoUnOrdine = conversions >= 1 || (ordiniVeri != null && ordiniVeri >= 1)
      if (almenoUnOrdine && margineNetto != null && margineNetto > 0 && scarto != null && scarto > S.scartoMax) { verdetto = 'daVerificare'; motivo = 'scarto' }
      else if (almenoUnOrdine && margineNetto != null && margineNetto > 0) { verdetto = 'standby'; motivo = 'poco' }
      else { verdetto = 'insufficiente'; motivo = 'spesaBassa' }
    }
    else if (costoUnitario == null) { verdetto = 'daVerificare'; motivo = 'costoAssente' }
    else if (venditeStato !== 'ok' && venditeStato !== 'zero') { verdetto = 'daVerificare'; motivo = 'venditeNonLette' }
    else if (scarto != null && Math.abs(scarto) > S.scartoMax) { verdetto = 'daVerificare'; motivo = 'scarto' }
    else if (poas != null && poas > 1) verdetto = 'scala'
    else if (poas == null || poas < 1 - S.banda) { verdetto = 'uccidi'; motivo = 'poasSottoPareggio' }
    else { verdetto = 'standby'; motivo = 'sottoPareggio' }

    const giacenza = cat?.giacenza ?? null
    const pezziUsciti = v?.units > 0 ? v.units : pezzi
    const copertura = (giacenza != null && pezziUsciti > 0) ? r2(giacenza / pezziUsciti) : null
    if (verdetto === 'scala' && cat?.tracciato && giacenza != null) {
      if (giacenza < S.scortaMinima) { verdetto = 'standby'; motivo = 'scorteMinime' }
      else if (copertura != null && copertura < 1) { verdetto = 'standby'; motivo = 'scorteBasse' }
    }
    if (verdetto === 'scala' && (roas == null || roas < S.roasMinimo)) { verdetto = 'standby'; motivo = 'roasBasso' }
    const almenoUnaVendita = conversions >= 1 || cost >= sogliaSpesa
    // (Unica differenza dalla route: qui 'spesaSenzaVendite' resta tale. Nella route questa regola
    // la sovrascrive con 'spesaSenzaOrdiniGoogle', che parla di vendite da altri canali anche
    // quando su Shopify non ce n'e' nessuna.)
    if (verdetto !== 'daVerificare' && motivo !== 'spesaSenzaVendite' && margineNetto != null && margineNetto < 0 && almenoUnaVendita) {
      verdetto = 'uccidi'; motivo = conversions >= 1 ? 'margineNegativo' : 'spesaSenzaOrdiniGoogle'
    }
    if (cost >= sogliaSpesa && poas != null && poas < 0) { verdetto = 'uccidi'; motivo = 'poasNegativo' }

    return {
      itemId, itemIds, productId,
      categoria: cat?.categoria || null,
      vendor: cat?.vendor || null,
      stato: cat?.stato && cat.stato !== 'ACTIVE' ? cat.stato : null,
      skus: cat?.skus || [],
      giacenza, copertura,
      title,
      image: immagine(ctx, d.pi),
      cost, prezzo, sogliaSpesa, clicks,
      conversions, orders: Math.round(conversions), convValue,
      ricavoNetto, iva: r2(convValue - ricavoNetto), aliquotaIva: ivaProdotto, fonteIva: 'prodotto',
      pezzi, prezzoMedio, costoUnitario, cogs, margineNetto, profittoLordo, poas, roas, cpa,
      shopifyRevenue: shopRevenue, shopifyUnits: v ? v.units : null, shopifyOrders: ordiniVeri,
      venditeStato, ordiniStato, prec, scarto, verdetto, motivo,
    }
  }).filter(Boolean).sort((a, b) => b.cost - a.cost)

  const perVerdetto = (x) => righe.filter(r => r.verdetto === x).length
  const costoTot = righe.reduce((a, r) => a + r.cost, 0)
  const cvTot = righe.reduce((a, r) => a + r.convValue, 0)
  const convTot = righe.reduce((a, r) => a + r.conversions, 0)
  return {
    ok: true,
    range, rangePrec,
    soglie: {
      banda: S.banda, scartoMax: S.scartoMax, rapportoPrezzoSpesa: S.rapportoPrezzoSpesa, sogliaRipiego: S.sogliaRipiego,
      scortaMinima: S.scortaMinima, roasMinimo: S.roasMinimo, iva: S.iva,
      ivaDaShopify: true, ivaPredefinitaNegozio: 22, poasPareggio: 1, disponibili: true,
    },
    qualita: {
      prodottiGoogle: righe.length,
      articoliGoogle: righe.reduce((a, r) => a + r.itemIds.length, 0),
      abbinati, conCosto, conCategoria,
      coperturaAbbinamentoPct: righe.length > 0 ? Math.round((abbinati / righe.length) * 100) : null,
      ordiniShopifyCompleti: ordiniCoperti,
      ordiniGoogleReali: true,
      venditeErrore: null, catalogoErrore: null, venditeTroncate: false,
      canaliEsclusi: [], senzaVenditeReali,
      confrontoDisponibile: true, confrontoOrdiniReali: ordiniCoperti,
    },
    totali: {
      cost: r2(costoTot), convValue: r2(cvTot), conversions: r2(convTot),
      roas: costoTot > 0 ? r2(cvTot / costoTot) : null,
      cpaMedia: convTot > 0 ? r2(costoTot / convTot) : null,
    },
    gruppi: { scala: perVerdetto('scala'), standby: perVerdetto('standby'), uccidi: perVerdetto('uccidi'), daVerificare: perVerdetto('daVerificare'), insufficiente: perVerdetto('insufficiente') },
    righe,
    updatedAt: istante(ctx, now - 4 * 60_000),
  }
}

// ============================================================================
//  ROUTER
// ============================================================================
export function demoPrezzi(p, search, method = 'GET', ctx = {}) {
  const m = String(method || 'GET').toUpperCase()
  // POST /api/prezzi (aggiungi / togli / rileggi un sito): la demo non riceve il corpo della
  // richiesta, quindi risponde col quadro di sempre — la tab resta piena e non va in errore.
  if (p === '/api/prezzi') return quadroPrezzi(ctx)
  if (p === '/api/prezzi/mercato') {
    if (m === 'POST') return { ok: true, registrato: true }
    const q = quadroPrezzi(ctx)
    return { ok: true, configurato: true, righe: q.mercato.articoli, conSuggerito: q.mercato.conSuggerito, conTraffico: q.righe.length, periodi: q.mercato.periodi }
  }
  if (p === '/api/google-product-verdicts') return verdetti(ctx, search)
  if (p === '/api/google-product-verdicts/soglie') {
    return m === 'POST' ? { ok: true, soglie: { ...SOGLIE_PREDEFINITE } } : { ok: true, soglie: { ...SOGLIE_PREDEFINITE }, predefinite: SOGLIE_PREDEFINITE, limiti: LIMITI_SOGLIE }
  }
  return undefined
}
