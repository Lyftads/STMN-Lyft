// ============================================================================
//  DEMO — i dati inventati della tab KPI Brain (Acme Store).
//
//  Stesse forme delle route vere, cosi' la demo disegna le stesse sezioni del
//  prodotto: «Dove comprano» (regioni e province), le fasce orarie, i pubblici
//  di Meta e di Google, i paesi con nuovi e di ritorno, le foto dei prodotti.
//  Numeri inventati e deterministici (nessun Math.random: la stessa domanda da'
//  sempre la stessa risposta), costruiti sui totali della demo — fatturato,
//  ordini, sessioni e spesa di /api/metrics — cosi' ogni sezione torna con le
//  schede in cima.
//
//  NON importa data.js (niente import circolari): quel che serve arriva nel
//  contesto `ctx` = { DEMO_PRODUCTS, pimg, ymd, iso, DAY, metrics, google? }.
//  `metrics` e' l'oggetto di demoMetrics() (o una funzione che lo restituisce);
//  `google` e' la risposta demo di /api/google (facoltativa: da li' la spesa
//  Google del periodo, altrimenti si stima dalla spesa Meta).
//
//  Brand e Drive to Store restano SPENTI: Acme vende un marchio solo e non ha
//  negozi fisici, e le route vere a un cliente cosi' non li mostrano.
// ============================================================================

export const KPI_BRAIN_PATHS = new Set([
  '/api/kpi-province',
  '/api/hourly-sales',
  '/api/meta-segments',
  '/api/google-segments',
  '/api/shopify-countries',
  '/api/product-images',
])

// ── Aiuti ────────────────────────────────────────────────────────────────────
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const quota = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null)

// Un numero fra 0 e 1 che dipende solo dal testo: la "casualita'" della demo.
function caso(s) {
  let h = 2166136261
  const t = String(s)
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 100000) / 100000
}
const vario = (chiave, ampiezza) => 1 + (caso(chiave) - 0.5) * 2 * ampiezza

// Divide un intero secondo i pesi, senza perdere unita' (resti piu' grandi).
function dividi(totale, pesi) {
  const T = Math.max(0, Math.round(Number(totale) || 0))
  const W = pesi.reduce((a, w) => a + Math.max(0, w || 0), 0)
  if (!T || !W) return pesi.map(() => 0)
  const grezzi = pesi.map(w => (Math.max(0, w || 0) / W) * T)
  const out = grezzi.map(Math.floor)
  const resto = T - out.reduce((a, b) => a + b, 0)
  const ordine = grezzi.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1])
  for (let k = 0; k < resto; k++) out[ordine[k % ordine.length][1]] += 1
  return out
}
// Lo stesso per gli euro, al centesimo: la somma torna esatta.
const dividiSoldi = (totale, pesi) => dividi(Math.round((Number(totale) || 0) * 100), pesi).map(c => c / 100)

function giorni(range) {
  const out = []
  const d = new Date(`${range.since}T00:00:00Z`), fine = new Date(`${range.until}T00:00:00Z`)
  for (let n = 0; d <= fine && n < 400; n++) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1) }
  return out
}
// Peso di un giorno: la domenica si vende di piu', il sabato di meno, e il mese sale un po'.
const PESO_SETTIMANA = [1.04, 0.98, 0.96, 1.0, 0.94, 0.88, 1.2] // lunedi' → domenica
function pesoGiorno(data, i, n, chiave = '') {
  const dow = (new Date(`${data}T00:00:00Z`).getUTCDay() + 6) % 7
  return PESO_SETTIMANA[dow] * (0.94 + (n > 1 ? i / (n - 1) : 0) * 0.12) * vario(data + chiave, 0.16)
}

// ── Contesto e periodo ───────────────────────────────────────────────────────
function contesto(ctx = {}) {
  const M = (typeof ctx.metrics === 'function' ? ctx.metrics() : ctx.metrics) || {}
  const G = (typeof ctx.google === 'function' ? ctx.google() : ctx.google) || null
  const DAY = ctx.DAY || 86400000
  const ymd = ctx.ymd || ((d) => new Date(d).toISOString().slice(0, 10))
  const iso = ctx.iso || ((d) => new Date(d).toISOString())
  const cur = M.kpiBrain?.range || { since: ymd(Date.now() - 28 * DAY), until: ymd(Date.now()) }
  const prev = M.kpiBrain?.previousRange || { since: ymd(Date.now() - 56 * DAY), until: ymd(Date.now() - 29 * DAY) }
  return { M, G, DAY, ymd, iso, cur, prev, catalogo: Array.isArray(ctx.DEMO_PRODUCTS) ? ctx.DEMO_PRODUCTS : [], pimg: typeof ctx.pimg === 'function' ? ctx.pimg : () => null, googleSpend: ctx.googleSpend }
}

const leggiParam = (search, k) => (search && typeof search.get === 'function' ? search.get(k) : null)

// Il periodo chiesto e i totali della demo per quel periodo.
function periodo(search, C) {
  let since = leggiParam(search, 'since'), until = leggiParam(search, 'until')
  const m = String(leggiParam(search, 'preset') || '').match(/^custom_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/)
  if ((!since || !until) && m) { since = m[1]; until = m[2] }
  if (!since || !until) { since = C.cur.since; until = C.cur.until }
  const range = { since, until }
  const precedente = since === C.prev.since && until === C.prev.until
  const corrente = since === C.cur.since && until === C.cur.until
  // Un periodo che non e' ne' il corrente ne' il precedente: i totali del corrente in proporzione ai giorni.
  const scala = corrente || precedente ? 1 : giorni(range).length / Math.max(1, giorni(C.cur).length)
  const S = (precedente ? C.M.shopifyPrevRange : C.M.shopifyRange) || {}
  const Mt = (precedente ? C.M.metaPrevRange : C.M.metaRange) || {}
  const meta = (Number(Mt.spend) || 0) * scala
  return {
    range, precedente, scala,
    fatturato: (Number(S.revenue) || 0) * scala,
    ordini: Math.round((Number(S.orders) || 0) * scala),
    nuovi: Math.round((Number(S.nc) || 0) * scala),
    sessioni: Math.round((Number(S.sessions) || 0) * scala),
    meta,
    impression: Math.round((Number(Mt.impressions) || 0) * scala),
    clic: Math.round((Number(Mt.clicks) || 0) * scala),
    google: spesaGoogle(C, range, precedente, scala, meta),
  }
}

// Spesa Google del periodo: dalla serie giornaliera della demo se c'e', cosi' torna con la Dashboard.
function spesaGoogle(C, range, precedente, scala, meta) {
  const serie = Array.isArray(C.G?.daily) ? C.G.daily : null
  if (serie) {
    const s = serie.filter(x => x.date >= range.since && x.date <= range.until).reduce((a, x) => a + (Number(x.spend) || 0), 0)
    if (s > 0) return r2(s)
  }
  if (!precedente && Number(C.googleSpend) > 0) return r2(Number(C.googleSpend) * scala)
  return r2(meta * 0.454)
}
function periodoPrima(range) {
  const n = giorni(range).length
  const a = new Date(`${range.since}T00:00:00Z`); a.setUTCDate(a.getUTCDate() - 1)
  const da = new Date(a); da.setUTCDate(da.getUTCDate() - (n - 1))
  return { since: da.toISOString().slice(0, 10), until: a.toISOString().slice(0, 10) }
}

// ============================================================================
//  /api/shopify-countries — paesi di fatturazione, con nuovi e di ritorno
// ============================================================================
// codice, nome come lo scrive Shopify, quota del fatturato ora / prima, AOV relativo, quota ordini di nuovi clienti
const PAESI = [
  ['IT', 'Italy', 0.695, 0.715, 1.0, 0.6],
  ['DE', 'Germany', 0.085, 0.08, 1.12, 0.71],
  ['FR', 'France', 0.07, 0.066, 1.08, 0.69],
  ['CH', 'Switzerland', 0.045, 0.041, 1.34, 0.66],
  ['ES', 'Spain', 0.04, 0.046, 0.94, 0.73],
  ['AT', 'Austria', 0.025, 0.022, 1.1, 0.68],
  ['NL', 'Netherlands', 0.02, 0.018, 1.05, 0.75],
  ['BE', 'Belgium', 0.015, 0.012, 1.02, 0.77],
  ['PT', 'Portugal', 0.005, 0, 0.9, 1.0], // nuovo nel periodo: in pagina compare come NEW
]

function paesiRighe(P) {
  const quote = PAESI.map(x => (P.precedente ? x[3] : x[2]))
  const fatt = dividiSoldi(P.fatturato, quote)
  const ord = dividi(P.ordini, PAESI.map((x, i) => (quote[i] > 0 ? quote[i] / x[4] : 0)))
  const nuoviPeso = PAESI.map((x, i) => ord[i] * x[5] * vario(x[0] + (P.precedente ? 'p' : 'c'), 0.05))
  const nuovi = dividi(Math.min(P.nuovi, P.ordini), nuoviPeso).map((n, i) => Math.min(n, ord[i]))
  const out = []
  PAESI.forEach((x, i) => {
    if (!fatt[i] && !ord[i]) return
    const ncRevenue = ord[i] > 0 ? r2(fatt[i] * (nuovi[i] / ord[i]) * 0.96) : 0
    out.push({
      country: x[1], country_code: x[0],
      revenue: fatt[i], orders: ord[i],
      ncOrders: nuovi[i], rcOrders: ord[i] - nuovi[i],
      ncRevenue, rcRevenue: r2(fatt[i] - ncRevenue),
    })
  })
  return out.sort((a, b) => b.revenue - a.revenue)
}

function demoPaesi(search, C) {
  const P = periodo(search, C)
  const righe = paesiRighe(P)
  if (leggiParam(search, 'breakdown') === 'daily') {
    const codice = String(leggiParam(search, 'country') || '').toUpperCase() || null
    const scelte = codice ? righe.filter(r => r.country_code === codice) : righe
    const somma = (k) => scelte.reduce((a, r) => a + (r[k] || 0), 0)
    const tot = { revenue: somma('revenue'), orders: somma('orders'), ncOrders: somma('ncOrders'), ncRevenue: somma('ncRevenue') }
    const gg = giorni(P.range)
    const ordG = dividi(tot.orders, gg.map((d, i) => pesoGiorno(d, i, gg.length, codice || 'tutti')))
    const fatG = dividiSoldi(tot.revenue, ordG.map((o, i) => o * vario(gg[i] + 'aov' + (codice || ''), 0.12)))
    const quotaNuovi = tot.orders > 0 ? tot.ncOrders / tot.orders : 0
    const quotaFattNuovi = tot.revenue > 0 ? tot.ncRevenue / tot.revenue : 0
    const daily = gg.map((date, i) => {
      const ncOrders = Math.min(ordG[i], Math.round(ordG[i] * quotaNuovi))
      const ncRevenue = r2(fatG[i] * quotaFattNuovi)
      return { date, revenue: fatG[i], orders: ordG[i], ncOrders, rcOrders: ordG[i] - ncOrders, ncRevenue, rcRevenue: r2(fatG[i] - ncRevenue) }
    })
    return { since: P.range.since, until: P.range.until, country: codice, daily, updatedAt: C.iso(Date.now()) }
  }
  return {
    since: P.range.since, until: P.range.until,
    total: { revenue: r2(righe.reduce((a, r) => a + r.revenue, 0)), orders: righe.reduce((a, r) => a + r.orders, 0) },
    countries: righe,
    updatedAt: C.iso(Date.now()),
  }
}

// ============================================================================
//  /api/kpi-province — «Dove comprano»: regioni con la spesa, province e comuni
// ============================================================================
//  Per regione: conv = conversione relativa (sopra 1 converte meglio della media),
//  spesa = euro spesi per euro venduto relativo (sopra 1 rende meno), meta = quota
//  Meta della spesa. Le province hanno un peso sul fatturato e i loro comuni.
//  Con questi valori la tabella mostra sia pillole rosse (sotto il 70% della
//  media) sia blu (sopra il 130%): Marche, Abruzzo e Trentino rendono, Sicilia,
//  Calabria e Molise no. Il Molise spende e non vende: e' la riga che si guarda.
const REGIONI = [
  ['Lombardia', 0.95, 1.4, 0.66, [
    ['Milano', 9.5, ['Milano', 'Sesto San Giovanni', 'Rho', 'Legnano', 'Cinisello Balsamo']],
    ['Brescia', 2.4, ['Brescia', 'Desenzano del Garda', 'Montichiari']],
    ['Bergamo', 2.2, ['Bergamo', 'Treviglio', 'Seriate']],
    ['Monza e Brianza', 1.9, ['Monza', 'Seregno', 'Desio']],
    ['Varese', 1.6, ['Varese', 'Busto Arsizio', 'Gallarate']],
    ['Como', 1.2, ['Como', 'Cantù', 'Erba']],
  ]],
  ['Lazio', 0.86, 1.75, 0.7, [
    ['Roma', 10.5, ['Roma', 'Fiumicino', 'Guidonia Montecelio', 'Tivoli', 'Pomezia']],
    ['Latina', 1.1, ['Latina', 'Aprilia', 'Terracina']],
    ['Frosinone', 0.7, ['Frosinone', 'Cassino']],
    ['Viterbo', 0.5, ['Viterbo', 'Civita Castellana']],
  ]],
  ['Veneto', 1.05, 1.02, 0.67, [
    ['Verona', 2.1, ['Verona', 'Villafranca di Verona', 'San Giovanni Lupatoto']],
    ['Padova', 2.0, ['Padova', 'Cittadella', 'Abano Terme']],
    ['Treviso', 1.7, ['Treviso', 'Castelfranco Veneto', 'Conegliano']],
    ['Venezia', 1.6, ['Venezia', 'Chioggia', 'San Donà di Piave']],
    ['Vicenza', 1.5, ['Vicenza', 'Bassano del Grappa', 'Schio']],
  ]],
  ['Campania', 0.6, 1.3, 0.72, [
    ['Napoli', 4.6, ['Napoli', 'Pozzuoli', 'Torre del Greco', 'Casoria']],
    ['Salerno', 1.5, ['Salerno', 'Battipaglia', "Cava de' Tirreni"]],
    ['Caserta', 1.0, ['Caserta', 'Aversa']],
    ['Avellino', 0.5, ['Avellino', 'Ariano Irpino']],
  ]],
  ['Emilia-Romagna', 1.1, 0.98, 0.65, [
    ['Bologna', 2.6, ['Bologna', 'Imola', 'Casalecchio di Reno']],
    ['Modena', 1.5, ['Modena', 'Carpi', 'Sassuolo']],
    ['Parma', 1.2, ['Parma', 'Fidenza']],
    ['Reggio Emilia', 1.1, ['Reggio Emilia', 'Scandiano']],
    ['Rimini', 1.0, ['Rimini', 'Riccione']],
  ]],
  ['Piemonte', 1.0, 1.0, 0.69, [
    ['Torino', 4.2, ['Torino', 'Moncalieri', 'Collegno', 'Rivoli']],
    ['Cuneo', 1.0, ['Cuneo', 'Alba', 'Bra']],
    ['Novara', 0.8, ['Novara', 'Borgomanero']],
    ['Alessandria', 0.7, ['Alessandria', 'Casale Monferrato']],
  ]],
  ['Toscana', 1.0, 0.95, 0.68, [
    ['Firenze', 3.1, ['Firenze', 'Scandicci', 'Sesto Fiorentino', 'Empoli']],
    ['Pisa', 1.0, ['Pisa', 'Pontedera']],
    ['Lucca', 0.9, ['Lucca', 'Viareggio']],
    ['Livorno', 0.7, ['Livorno', 'Piombino']],
    ['Arezzo', 0.7, ['Arezzo', 'Montevarchi']],
  ]],
  ['Sicilia', 0.55, 1.9, 0.74, [
    ['Palermo', 2.2, ['Palermo', 'Bagheria', 'Monreale']],
    ['Catania', 2.0, ['Catania', 'Acireale', 'Misterbianco']],
    ['Messina', 1.0, ['Messina', 'Milazzo']],
    ['Siracusa', 0.7, ['Siracusa', 'Augusta']],
  ]],
  ['Puglia', 0.82, 1.1, 0.7, [
    ['Bari', 2.4, ['Bari', 'Altamura', 'Molfetta', 'Monopoli']],
    ['Lecce', 1.3, ['Lecce', 'Nardò', 'Gallipoli']],
    ['Taranto', 0.8, ['Taranto', 'Martina Franca']],
    ['Foggia', 0.7, ['Foggia', 'San Severo']],
  ]],
  ['Marche', 1.6, 0.5, 0.64, [
    ['Ancona', 2.2, ['Ancona', 'Senigallia', 'Jesi']],
    ['Pesaro e Urbino', 1.8, ['Pesaro', 'Fano', 'Urbino']],
    ['Macerata', 1.4, ['Macerata', 'Civitanova Marche']],
  ]],
  ['Liguria', 0.95, 1.05, 0.67, [
    ['Genova', 2.0, ['Genova', 'Chiavari', 'Rapallo']],
    ['Savona', 0.7, ['Savona', 'Albenga']],
    ['La Spezia', 0.6, ['La Spezia', 'Sarzana']],
  ]],
  ['Abruzzo', 1.5, 0.55, 0.63, [
    ['Pescara', 1.2, ['Pescara', 'Montesilvano']],
    ['Chieti', 1.0, ['Chieti', 'Lanciano', 'Vasto']],
    ["L'Aquila", 0.6, ["L'Aquila", 'Avezzano']],
  ]],
  ['Trentino-Alto Adige', 1.4, 0.72, 0.62, [
    ['Trento', 1.3, ['Trento', 'Rovereto', 'Riva del Garda']],
    ['Bolzano', 1.1, ['Bolzano', 'Merano', 'Bressanone']],
  ]],
  ['Sardegna', 0.78, 1.2, 0.73, [
    ['Cagliari', 1.1, ['Cagliari', "Quartu Sant'Elena"]],
    ['Sassari', 0.9, ['Sassari', 'Olbia', 'Alghero']],
  ]],
  ['Friuli-Venezia Giulia', 1.2, 0.85, 0.66, [
    ['Udine', 0.9, ['Udine', 'Codroipo']],
    ['Trieste', 0.7, ['Trieste', 'Muggia']],
  ]],
  ['Umbria', 1.1, 1.0, 0.68, [
    ['Perugia', 1.1, ['Perugia', 'Foligno', 'Città di Castello']],
    ['Terni', 0.4, ['Terni', 'Orvieto']],
  ]],
  ['Calabria', 0.52, 1.55, 0.75, [
    ['Cosenza', 0.6, ['Cosenza', 'Rende', 'Corigliano-Rossano']],
    ['Reggio Calabria', 0.5, ['Reggio Calabria', 'Palmi']],
  ]],
]
// Spende e non vende: compare fra le regioni solo per la spesa (come nella route vera).
const REGIONE_SENZA_VENDITE = { regione: 'Molise', provincia: 'Campobasso', quotaSpesa: 0.009, quotaSessioni: 0.005, meta: 0.8 }

const CAMPAGNE_META = [['Prospecting Broad', 0.38], ['Advantage+ Shop', 0.24], ['Retargeting 7d', 0.18], ['Lookalike 3%', 0.12], ['Catalog DPA', 0.08]]
const CAMPAGNE_GOOGLE = [['Shopping - Tutti i prodotti', 0.42], ['PMax - Performance Max', 0.33], ['Brand Search', 0.15], ['Search - Generico Fitness', 0.1]]
const META_FUORI = [['Bavaria', 0.3], ['Canton of Ticino', 0.24], ['Île-de-France', 0.19], ['Catalonia', 0.15], ['Vienna', 0.12]]
const GOOGLE_FUORI = [['Bavaria (DE)', 0.36], ['Ticino (CH)', 0.28], ['Île-de-France (FR)', 0.21], ['Vienna (AT)', 0.15]]

// Categoria e genere del catalogo demo (il catalogo non li porta: si deducono dal nome).
function categoriaDi(nome) {
  const n = String(nome).toLowerCase()
  if (/zaino|borsone/.test(n)) return 'BORSE E ZAINI'
  if (/scarpe/.test(n)) return 'CALZATURE'
  if (/t-shirt|leggings|felpa|calzini|cappellino/.test(n)) return 'ABBIGLIAMENTO'
  return 'ACCESSORI'
}
function genereDi(nome) {
  const n = String(nome).toLowerCase()
  if (/leggings|yoga/.test(n)) return 'DONNA'
  if (/t-shirt|guanti/.test(n)) return 'UOMO'
  return 'UNISEX'
}

function prodottiDi(chiave, fatturato, ordini, C) {
  const cat = C.catalogo
  if (!cat.length || !(fatturato > 0)) return []
  const pesi = cat.map((p, i) => (1 / (i + 1.6)) * vario(chiave + p[0], 0.45))
  const scelti = pesi.map((w, i) => [w, i]).sort((a, b) => b[0] - a[0])
    .slice(0, Math.max(1, Math.min(12, Math.round(ordini * 1.1))))
  const fatt = dividiSoldi(fatturato, scelti.map(x => x[0]))
  return scelti.map(([, i], k) => {
    const [titolo, prezzo] = cat[i]
    return {
      titolo, immagine: C.pimg(i), categoria: categoriaDi(titolo), genere: genereDi(titolo),
      fatturato: fatt[k], pezzi: Math.max(1, Math.round(fatt[k] / (Number(prezzo) || 30))),
    }
  }).filter(x => x.fatturato > 0).sort((a, b) => b.fatturato - a.fatturato)
}
function perChiave(prodotti, campo) {
  const m = new Map()
  for (const p of prodotti) m.set(p[campo], (m.get(p[campo]) || 0) + p.fatturato)
  return [...m.entries()].map(([k, v]) => ({ [campo]: k, fatturato: r2(v) })).sort((a, b) => b.fatturato - a.fatturato)
}
const marchiDi = (prodotti) => (prodotti.length ? [{ marchio: 'Acme Store', fatturato: r2(prodotti.reduce((a, p) => a + p.fatturato, 0)), pezzi: prodotti.reduce((a, p) => a + p.pezzi, 0) }] : [])

function demoProvince(search, C) {
  const P = periodo(search, C)
  const it = paesiRighe(P).find(r => r.country_code === 'IT') || { revenue: 0, orders: 0, ncOrders: 0 }
  const tag = P.precedente ? 'p' : 'c'

  // Gli ordini italiani senza nessuna provincia si dichiarano a parte, come nella route vera.
  const senzaProvincia = Math.min(it.orders, 4)
  const fattSenzaProv = it.orders > 0 ? r2((it.revenue / it.orders) * senzaProvincia * 0.93) : 0
  const ordProv = it.orders - senzaProvincia
  const fattProv = Math.max(0, it.revenue - fattSenzaProv)
  const quotaNuoviIT = it.orders > 0 ? it.ncOrders / it.orders : 0.6

  // ── Province: ordini e fatturato dai pesi ──────────────────────────────────
  const elenco = []
  for (const [regione, , , , province] of REGIONI) for (const [provincia, peso, comuni] of province) elenco.push({ regione, provincia, peso, comuni })
  const fattP = dividiSoldi(fattProv, elenco.map(x => x.peso))
  const ordP = dividi(ordProv, elenco.map(x => x.peso / vario(x.provincia + 'aov', 0.12)))

  const province = elenco.map((x, i) => {
    const ordini = ordP[i], fatturato = fattP[i]
    const qn = Math.min(0.9, Math.max(0.35, quotaNuoviIT * vario(x.provincia + 'nuovi' + tag, 0.18)))
    const nuovi = Math.min(ordini, Math.round(ordini * qn))
    const fatturatoNuovi = r2(Math.min(fatturato, fatturato * (ordini > 0 ? nuovi / ordini : 0) * vario(x.provincia + 'fn', 0.05)))
    // I comuni: il capoluogo per primo, poi gli altri; quelli senza ordini non compaiono.
    const pesiC = x.comuni.map((c, k) => (k === 0 ? 1 : 0.5 / k) * vario(c + tag, 0.3))
    const ordC = dividi(ordini, pesiC)
    const fattC = dividiSoldi(fatturato, ordC.map((o, k) => o * vario(x.comuni[k] + 'aov', 0.1)))
    const comuni = x.comuni.map((comune, k) => ({ comune, ordini: ordC[k], fatturato: fattC[k] }))
      .filter(c => c.ordini > 0).sort((a, b) => b.fatturato - a.fatturato)
    const prodotti = prodottiDi(x.provincia + tag, fatturato, ordini, C)
    return {
      regione: x.regione, provincia: x.provincia,
      ordini, fatturato,
      aov: ordini > 0 ? r2(fatturato / ordini) : null,
      nuovi, ritorno: ordini - nuovi,
      quotaNuovi: ordini > 0 ? Math.round((nuovi / ordini) * 1000) / 10 : null,
      fatturatoNuovi, fatturatoRitorno: r2(fatturato - fatturatoNuovi),
      resi: r2(fatturato * 0.012 * vario(x.provincia + 'resi', 0.8)),
      sessioni: null, cro: null,
      comuni, marchi: marchiDi(prodotti),
      categorie: perChiave(prodotti, 'categoria'), generi: perChiave(prodotti, 'genere'),
      prodotti: prodotti.slice(0, 12),
    }
  })

  // ── Sessioni: esatte per regione, attribuite alle province tramite i comuni ──
  const sessItalia = Math.round(P.sessioni * 0.72)
  const sessSenzaRegione = Math.round(sessItalia * 0.026)
  const sessRegioni = sessItalia - sessSenzaRegione
  const perRegione = REGIONI.map(([regione, conv]) => {
    const righe = province.filter(p => p.regione === regione)
    return { regione, conv, righe, ordini: righe.reduce((a, p) => a + p.ordini, 0) }
  })
  const sessMolise = Math.round(sessRegioni * REGIONE_SENZA_VENDITE.quotaSessioni)
  const sessR = dividi(sessRegioni - sessMolise, perRegione.map(r => (r.ordini || 0.5) / r.conv * vario(r.regione + 'sess' + tag, 0.04)))
  // Copertura dei comuni: circa otto sessioni su dieci trovano la loro provincia.
  let attribuite = 0
  perRegione.forEach((r, i) => {
    const sp = dividi(Math.round(sessR[i] * 0.8), r.righe.map(p => (p.ordini || 0.3) * vario(p.provincia + 'sess', 0.18)))
    r.righe.forEach((p, k) => {
      p.sessioni = sp[k] || null
      p.cro = p.sessioni > 0 ? Math.round((p.ordini / p.sessioni) * 10000) / 100 : null
      attribuite += sp[k] || 0
    })
  })
  const sessCampobasso = Math.round(sessMolise * 0.8)
  attribuite += sessCampobasso

  // ── Spesa per regione: Meta e Google, con quel che resta fuori dall'Italia ──
  const metaIT = r2(P.meta * 0.87), googleIT = r2(P.google * 0.9)
  const fattR = perRegione.map(r => r.righe.reduce((a, p) => a + p.fatturato, 0))
  const totFattR = fattR.reduce((a, b) => a + b, 0) || 1
  const pesoSpesa = REGIONI.map(([regione, , spesa], i) => fattR[i] * spesa * vario(regione + 'spesa' + tag, 0.05))
  const pesoMolise = REGIONE_SENZA_VENDITE.quotaSpesa * pesoSpesa.reduce((a, b) => a + b, 0)
  const tutti = [...pesoSpesa, pesoMolise]
  const quoteMeta = [...REGIONI.map(r => r[3] * vario(r[0] + 'meta' + tag, 0.06)), REGIONE_SENZA_VENDITE.meta]
  const metaR = dividiSoldi(metaIT, tutti.map((w, i) => w * quoteMeta[i]))
  const googleR = dividiSoldi(googleIT, tutti.map((w, i) => w * (1 - quoteMeta[i])))

  const campagne = (chiave, spesaMeta, spesaGoogle) => {
    const m = dividiSoldi(spesaMeta, CAMPAGNE_META.map(([n, w]) => w * vario(chiave + n, 0.3)))
    const g = dividiSoldi(spesaGoogle, CAMPAGNE_GOOGLE.map(([n, w]) => w * vario(chiave + n, 0.3)))
    return [
      ...CAMPAGNE_META.map(([campagna], k) => ({ piattaforma: 'Meta', campagna, spesa: m[k] })),
      ...CAMPAGNE_GOOGLE.map(([campagna], k) => ({ piattaforma: 'Google', campagna, spesa: g[k] })),
    ].filter(c => c.spesa > 0).sort((a, b) => b.spesa - a.spesa)
  }

  const regioni = perRegione.map((r, i) => {
    const ordini = r.ordini, fatturato = r2(fattR[i])
    const nuovi = r.righe.reduce((a, p) => a + p.nuovi, 0)
    const spesaMeta = metaR[i], spesaGoogle = googleR[i], spesa = r2(spesaMeta + spesaGoogle)
    const prodotti = new Map()
    for (const p of r.righe) for (const x of p.prodotti) {
      const g = prodotti.get(x.titolo) || { ...x, fatturato: 0, pezzi: 0 }
      g.fatturato += x.fatturato; g.pezzi += x.pezzi
      prodotti.set(x.titolo, g)
    }
    const elencoP = [...prodotti.values()].map(x => ({ ...x, fatturato: r2(x.fatturato) })).sort((a, b) => b.fatturato - a.fatturato)
    const somma = (lista, campo) => {
      const m = new Map()
      for (const p of r.righe) for (const x of p[lista]) m.set(x[campo], (m.get(x[campo]) || 0) + x.fatturato)
      return [...m.entries()].map(([k, v]) => ({ [campo]: k, fatturato: r2(v) })).sort((a, b) => b.fatturato - a.fatturato)
    }
    return {
      regione: r.regione, provincia: r.regione,
      ordini, fatturato,
      aov: ordini > 0 ? r2(fatturato / ordini) : null,
      nuovi, ritorno: ordini - nuovi,
      quotaNuovi: ordini > 0 ? Math.round((nuovi / ordini) * 1000) / 10 : null,
      fatturatoRitorno: r2(r.righe.reduce((a, p) => a + p.fatturatoRitorno, 0)),
      sessioni: sessR[i],
      cro: sessR[i] > 0 ? Math.round((ordini / sessR[i]) * 10000) / 100 : null,
      spesaMeta, spesaGoogle, spesa,
      mer: spesa > 0 ? r2(fatturato / spesa) : null,
      cpo: spesa > 0 && ordini > 0 ? r2(spesa / ordini) : null,
      comuni: r.righe.filter(p => p.ordini > 0).map(p => ({ comune: p.provincia, ordini: p.ordini, fatturato: p.fatturato })).sort((a, b) => b.fatturato - a.fatturato),
      marchi: marchiDi(elencoP),
      categorie: somma('categorie', 'categoria'),
      generi: somma('generi', 'genere'),
      prodotti: elencoP.slice(0, 12),
      campagne: campagne(r.regione + tag, spesaMeta, spesaGoogle),
    }
  })
  // La regione che spende senza vendere.
  {
    const i = REGIONI.length
    const spesaMeta = metaR[i], spesaGoogle = googleR[i], spesa = r2(spesaMeta + spesaGoogle)
    regioni.push({
      regione: REGIONE_SENZA_VENDITE.regione, provincia: REGIONE_SENZA_VENDITE.regione,
      ordini: 0, fatturato: 0, aov: null, nuovi: 0, ritorno: 0, quotaNuovi: null, fatturatoRitorno: 0,
      sessioni: sessMolise, cro: sessMolise > 0 ? 0 : null,
      spesaMeta, spesaGoogle, spesa, mer: spesa > 0 ? 0 : null, cpo: null,
      comuni: [], marchi: [], categorie: [], generi: [], prodotti: [],
      campagne: campagne(REGIONE_SENZA_VENDITE.regione + tag, spesaMeta, spesaGoogle),
    })
  }
  const totSpesa = regioni.reduce((a, r) => a + (r.spesa || 0), 0)
  const totFatt = regioni.reduce((a, r) => a + r.fatturato, 0)
  for (const r of regioni) {
    r.quotaSpesa = totSpesa > 0 && r.spesa != null ? quota(r.spesa, totSpesa) : null
    r.quotaFatturato = totFatt > 0 ? quota(r.fatturato, totFatt) : null
  }
  regioni.sort((a, b) => (b.spesa ?? 0) - (a.spesa ?? 0))

  // Le province: fuori il campo `regione` (la route vera non lo ha), dentro quella
  // con sole sessioni, come fa la route quando una provincia guarda senza comprare.
  const righeProvince = province.map(({ regione, ...p }) => p)
  righeProvince.push({
    provincia: REGIONE_SENZA_VENDITE.provincia, ordini: 0, fatturato: 0, aov: null, nuovi: 0, ritorno: 0, quotaNuovi: null,
    fatturatoNuovi: 0, fatturatoRitorno: 0, resi: 0, sessioni: sessCampobasso || null, cro: sessCampobasso > 0 ? 0 : null,
    comuni: [], marchi: [], categorie: [], generi: [], prodotti: [],
  })
  righeProvince.sort((a, b) => b.fatturato - a.fatturato)

  const fuoriLista = (tot, voci) => {
    const v = dividiSoldi(tot, voci.map(x => x[1]))
    return voci.map(([nome], k) => ({ nome, valore: v[k] })).filter(x => x.valore > 0).sort((a, b) => b.valore - a.valore).slice(0, 8)
  }
  const senzaCitta = Math.round(sessItalia * 0.061)
  const tuttiOrdini = paesiRighe(P).reduce((a, r) => a + r.orders, 0)

  return {
    ok: true,
    range: P.range,
    regioni,
    spesaRegioni: {
      meta: { totale: r2(P.meta), fuoriItalia: fuoriLista(r2(P.meta - metaIT), META_FUORI) },
      google: { totale: r2(P.google), fuoriItalia: fuoriLista(r2(P.google - googleIT), GOOGLE_FUORI) },
      sessioni: { totale: sessItalia, nonAssegnate: sessSenzaRegione > 0 ? [{ nome: 'regione non rilevata', valore: sessSenzaRegione }] : [] },
      merMedio: totSpesa > 0 ? r2(totFatt / totSpesa) : null,
      provinceSenzaRegione: [],
    },
    province: righeProvince,
    totali: {
      province: righeProvince.length,
      ordini: righeProvince.reduce((a, r) => a + r.ordini, 0),
      fatturato: r2(righeProvince.reduce((a, r) => a + r.fatturato, 0)),
      comuni: righeProvince.reduce((a, r) => a + r.comuni.length, 0),
    },
    fuori: {
      ordiniTotali: tuttiOrdini,
      fatturatoTotale: r2(P.fatturato),
      senzaProvincia,
      fatturatoSenzaProvincia: fattSenzaProv,
      recuperatiDallaFatturazione: Math.min(ordProv, 9),
      estero: Math.max(0, tuttiOrdini - it.orders),
      marketplace: 0,
      troncato: false,
    },
    analytics: {
      sessioniItalia: sessItalia,
      sessioniSenzaCitta: senzaCitta,
      sessioniAttribuite: attribuite,
      sessioniDiComuniMaiOrdinanti: Math.max(0, sessItalia - senzaCitta - attribuite),
      comuniNotiDagliOrdini: 1240,
      mappaFinestra: { da: C.ymd(Date.now() - 730 * C.DAY), a: C.ymd(Date.now()) },
      mappaGuai: null,
      copertura: sessItalia > 0 ? Math.round((attribuite / sessItalia) * 1000) / 10 : null,
      nota: 'Sessioni di Shopify (le stesse del pannello Shopify), solo Italia. Shopify non conosce le province: le sessioni si attaccano al comune, e il comune si collega alla provincia grazie agli ordini. Le citta\' senza nessun ordine restano fuori.',
    },
  }
}

// ============================================================================
//  /api/hourly-sales — fasce orarie migliori per giorno (0 = lunedi')
// ============================================================================
const BANDS = [
  { key: '00-06', from: 0, to: 6 }, { key: '06-09', from: 6, to: 9 }, { key: '09-12', from: 9, to: 12 },
  { key: '12-15', from: 12, to: 15 }, { key: '15-18', from: 15, to: 18 }, { key: '18-21', from: 18, to: 21 },
  { key: '21-24', from: 21, to: 24 },
]
const MIN_SESSIONS_CRO = 40
const VISITE_ORA = [0.9, 0.5, 0.3, 0.2, 0.2, 0.3, 0.8, 1.6, 2.4, 3.0, 3.3, 3.5, 4.2, 4.4, 3.8, 3.6, 3.7, 4.0, 4.6, 5.0, 5.6, 5.9, 4.8, 2.6]
const CONV_ORA = [0.6, 0.55, 0.5, 0.5, 0.5, 0.6, 0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.12, 1.1, 1.0, 0.98, 1.0, 1.05, 1.12, 1.2, 1.28, 1.24, 1.1, 0.9]
const VISITE_GIORNO = [1.05, 1.0, 0.98, 1.0, 0.92, 0.85, 1.15]
const CONV_GIORNO = [1.0, 1.02, 0.98, 1.05, 0.95, 0.9, 1.15]
// Ogni giorno ha il suo carattere, cosi' la fascia migliore non e' la stessa per tutti.
function spinta(dow, h) {
  if (dow === 5) return h >= 10 && h < 15 ? 1.45 : h >= 18 ? 0.8 : 1 // sabato: di giorno
  if (dow === 6) return h >= 18 && h < 22 ? 1.25 : 1                // domenica: la sera
  if (dow === 2) return h >= 12 && h < 15 ? 1.35 : 1                // mercoledi': pausa pranzo
  if (dow === 0) return h >= 7 && h < 10 ? 1.3 : 1                  // lunedi': la mattina presto
  return 1
}
// La conversione non ha sempre il picco delle visite: il lunedi' converte la mattina, il sabato
// a pranzo, il giovedi' a tarda sera.
function spintaConv(dow, h) {
  if (dow === 0) return h >= 6 && h < 12 ? 1.45 : 1
  if (dow === 5) return h >= 12 && h < 15 ? 1.4 : 1
  if (dow === 3) return h >= 21 ? 1.35 : 1
  return 1
}

function demoFasceOrarie(search, C) {
  const P = periodo(search, C)
  const celle = []
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
    const v = VISITE_ORA[h] * VISITE_GIORNO[d] * spinta(d, h) * vario(`${d}-${h}-v`, 0.08)
    const c = CONV_ORA[h] * CONV_GIORNO[d] * spintaConv(d, h) * vario(`${d}-${h}-c`, 0.1)
    celle.push({ d, h, v, c })
  }
  const sess = dividi(P.sessioni, celle.map(x => x.v))
  const ord = dividi(P.ordini, celle.map((x, i) => sess[i] * x.c))
  const fatt = dividiSoldi(P.fatturato, celle.map((x, i) => ord[i] * vario(`${x.d}-${x.h}-aov`, 0.12)))
  const cro = (conv, s) => (s > 0 ? r2((conv / s) * 100) : null)
  const griglia = Array.from({ length: 7 }, () => [])
  celle.forEach((x, i) => griglia[x.d].push({ hour: x.h, sessions: sess[i], orders: ord[i], revenue: fatt[i], convSessions: ord[i] * 0.97 }))

  const occ = [0, 0, 0, 0, 0, 0, 0]
  for (const g of giorni(P.range)) occ[(new Date(`${g}T00:00:00Z`).getUTCDay() + 6) % 7] += 1

  const days = griglia.map((ore, dow) => {
    const bands = BANDS.map(b => {
      const fetta = ore.slice(b.from, b.to)
      const sessions = fetta.reduce((s, x) => s + x.sessions, 0)
      const orders = fetta.reduce((s, x) => s + x.orders, 0)
      const revenue = fetta.reduce((s, x) => s + x.revenue, 0)
      const conv = fetta.reduce((s, x) => s + x.convSessions, 0)
      return { band: b.key, from: b.from, to: b.to, sessions, orders, revenue: r2(revenue), cro: cro(conv, sessions) }
    })
    const tot = bands.reduce((a, b) => ({ sessions: a.sessions + b.sessions, orders: a.orders + b.orders, revenue: a.revenue + b.revenue }), { sessions: 0, orders: 0, revenue: 0 })
    const conv = ore.reduce((s, x) => s + x.convSessions, 0)
    const top = (k, pool = bands) => (pool.length ? pool.reduce((a, b) => ((b[k] ?? -1) > (a[k] ?? -1) ? b : a)) : null)
    const croPool = bands.filter(b => b.sessions >= MIN_SESSIONS_CRO && b.cro != null)
    const bestOrders = top('orders')
    return {
      dow,
      occurrences: occ[dow],
      totals: { sessions: tot.sessions, orders: tot.orders, revenue: r2(tot.revenue), cro: cro(conv, tot.sessions) },
      bands,
      best: {
        orders: bestOrders && bestOrders.orders > 0 ? bestOrders.band : null,
        sessions: (top('sessions')?.sessions || 0) > 0 ? top('sessions').band : null,
        cro: croPool.length ? top('cro', croPool).band : null,
      },
      hours: ore.map(x => ({ hour: x.hour, sessions: x.sessions, orders: x.orders, revenue: r2(x.revenue), cro: cro(x.convSessions, x.sessions) })),
    }
  })
  const all = days.reduce((a, d) => ({ sessions: a.sessions + d.totals.sessions, orders: a.orders + d.totals.orders, revenue: a.revenue + d.totals.revenue }), { sessions: 0, orders: 0, revenue: 0 })
  return {
    ok: true, range: P.range, bands: BANDS.map(b => b.key), minSessionsForCro: MIN_SESSIONS_CRO,
    marketplaceExcluded: true, timezone: 'shop',
    totals: { ...all, revenue: r2(all.revenue) },
    days,
    updatedAt: C.iso(Date.now()),
  }
}

// ============================================================================
//  /api/meta-segments — CAC per pubblico (solo il livello account: gli altri
//  livelli, per campagna e per inserzione, restano quelli di prima)
// ============================================================================
const SEG_LABEL = { new: 'Nuovo pubblico', returning: 'Clienti esistenti', engaged: 'Pubblico che ha interagito', unknown: 'Sconosciuto' }
// quota spesa, CPA, AOV, quota impression, frequenza, CTR link (%)
const SEGMENTI = {
  new: [0.58, 21.4, 71, 0.66, 1.6, 1.7],
  engaged: [0.16, 16.8, 69, 0.14, 2.4, 2.6],
  returning: [0.19, 11.6, 83, 0.12, 3.1, 3.2],
  unknown: [0.07, 37.5, 64, 0.08, 1.9, 1.1],
}
// Nel periodo prima i nuovi costavano un po' di piu', gli esistenti un po' di meno.
const CPA_PRIMA = { new: 23.6, engaged: 16.1, returning: 11.2, unknown: 41.0 }

function finalizza(a, date) {
  const cpo = a.purchases > 0 ? r2(a.spend / a.purchases) : null
  return {
    ...(date ? { date } : {}),
    spend: r2(a.spend), revenue: r2(a.revenue),
    roas: a.spend > 0 ? r2(a.revenue / a.spend) : 0,
    purchases: Math.round(a.purchases),
    cpo, cac: cpo, cpa: cpo,
    impressions: Math.round(a.impressions), reach: Math.round(a.reach), link_clicks: Math.round(a.link_clicks),
    cpc_link: a.link_clicks > 0 ? r2(a.spend / a.link_clicks) : null,
    ctr_link: a.impressions > 0 ? r2((a.link_clicks / a.impressions) * 100) : null,
    cpm: a.impressions > 0 ? r2((a.spend / a.impressions) * 1000) : null,
    frequency: a.reach > 0 ? r2(a.impressions / a.reach) : null,
  }
}
function segmentiTotali(spesa, impression, cpa) {
  const out = {}
  const spese = dividiSoldi(spesa, Object.values(SEGMENTI).map(s => s[0]))
  const impr = dividi(impression, Object.values(SEGMENTI).map(s => s[3]))
  Object.entries(SEGMENTI).forEach(([k, [, cpaOra, aov, , freq, ctr]], i) => {
    const purchases = Math.round(spese[i] / (cpa?.[k] || cpaOra))
    out[k] = {
      spend: spese[i], purchases, revenue: r2(purchases * aov),
      impressions: impr[i], reach: Math.round(impr[i] / freq), link_clicks: Math.round(impr[i] * ctr / 100),
    }
  })
  return out
}

function demoSegmentiMeta(search, C) {
  const livello = leggiParam(search, 'level')
  if (livello && livello !== 'account') return undefined
  const P = periodo(search, C)
  const prevRange = P.precedente ? periodoPrima(P.range) : (P.scala === 1 ? C.prev : periodoPrima(P.range))
  const ora = segmentiTotali(P.meta, P.impression, null)
  const Pp = periodo(new URLSearchParams(`since=${prevRange.since}&until=${prevRange.until}`), C)
  const prima = segmentiTotali(Pp.meta, Pp.impression, CPA_PRIMA)

  const gg = giorni(P.range)
  const segments = {}
  for (const k of Object.keys(SEGMENTI)) {
    const t = ora[k]
    const pesi = gg.map((d, i) => pesoGiorno(d, i, gg.length, 'meta' + k))
    const spese = dividiSoldi(t.spend, pesi)
    const acquisti = dividi(t.purchases, pesi.map((w, i) => w * vario(gg[i] + k + 'acq', 0.25)))
    const impr = dividi(t.impressions, pesi)
    const clic = dividi(t.link_clicks, pesi)
    const reach = dividi(t.reach, pesi)
    const aov = t.purchases > 0 ? t.revenue / t.purchases : 0
    const daily = gg.map((date, i) => finalizza({ spend: spese[i], purchases: acquisti[i], revenue: acquisti[i] * aov * vario(date + k, 0.08), impressions: impr[i], reach: reach[i], link_clicks: clic[i] }, date))
    segments[k] = { label: SEG_LABEL[k], ...finalizza(t), totals: finalizza(t), prevTotals: finalizza(prima[k]), daily }
  }
  return {
    ok: true, configured: true, preset: leggiParam(search, 'preset') || 'custom', range: P.range, prevRange,
    segments,
    cacNew: segments.new?.cpo ?? null,
    updatedAt: C.iso(Date.now()),
  }
}

// ============================================================================
//  /api/google-segments — nuovi e di ritorno su Google (CAC nuovi = spesa ÷ conv. nuovi)
// ============================================================================
function demoSegmentiGoogle(search, C) {
  const P = periodo(search, C)
  const prevRange = P.precedente ? periodoPrima(P.range) : (P.scala === 1 ? C.prev : periodoPrima(P.range))
  const Pp = periodo(new URLSearchParams(`since=${prevRange.since}&until=${prevRange.until}`), C)
  const spesa = P.google
  const nuovi = Math.max(1, Math.round(spesa / 24.6))
  const ritorno = Math.round(nuovi * 0.44), ignoti = Math.round(nuovi * 0.06)
  const seg = (conv, aov) => { const value = r2(conv * aov); return { conversions: conv, value, roas: spesa > 0 ? r2(value / spesa) : 0 } }
  const nuoviPrima = Math.max(1, Math.round(Pp.google / 26.3))

  const gg = giorni(P.range)
  const serie = Array.isArray(C.G?.daily) ? new Map(C.G.daily.map(x => [x.date, Number(x.spend) || 0])) : null
  const pesi = gg.map((d, i) => pesoGiorno(d, i, gg.length, 'google'))
  const spesaG = serie && gg.some(d => serie.get(d) > 0) ? gg.map(d => serie.get(d) || 0) : dividiSoldi(spesa, pesi)
  const convG = dividi(nuovi, spesaG.map((s, i) => s * vario(gg[i] + 'gconv', 0.3)))
  const daily = gg.map((date, i) => ({ date, cac: convG[i] > 0 ? r2(spesaG[i] / convG[i]) : null }))

  return {
    ok: true, configured: true, available: true, preset: leggiParam(search, 'preset') || 'custom', range: P.range,
    totalSpend: r2(spesa),
    segments: { new: seg(nuovi, 72), returning: seg(ritorno, 86), unknown: seg(ignoti, 60) },
    cacNew: r2(spesa / nuovi),
    cacNewPrev: r2(Pp.google / nuoviPrima),
    daily,
    updatedAt: C.iso(Date.now()),
  }
}

// ============================================================================
//  /api/product-images — titolo → foto, con le stesse varianti di scrittura della route
// ============================================================================
function demoFotoProdotti(C) {
  const mappa = {}
  const metti = (titolo, url) => {
    if (!titolo || !url) return
    const pulito = titolo.replace(/["'"]/g, '').trim()
    mappa[titolo] = url; mappa[titolo.toLowerCase()] = url
    mappa[pulito] = url; mappa[pulito.toLowerCase()] = url
  }
  C.catalogo.forEach((p, i) => metti(p[0], C.pimg(i)))
  const top = Array.isArray(C.M.shopifyTopProducts) ? C.M.shopifyTopProducts : []
  top.forEach((p, i) => metti(p.title || p.label || p.name, C.pimg(i % Math.max(1, C.catalogo.length))))
  return mappa
}

// ============================================================================
//  Vendite per giorno della settimana: da 30 righe per data alle 7 righe della
//  route vera (lunedi' per primo, stessi nomi e stessi campi), riportate ai
//  totali del periodo cosi' tornano con le schede di KPI Brain.
// ============================================================================
const GIORNI_IT = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
export function giorniSettimana(metrics) {
  const righe = Array.isArray(metrics?.shopifyDayBreakdown) ? metrics.shopifyDayBreakdown : []
  const data = (r) => String(r?.date || r?.day || '')
  // Gia' per giorno della settimana: si lascia com'e'.
  if (!righe.length || !righe.every(r => /^\d{4}-\d{2}-\d{2}/.test(data(r)))) return righe
  const fatt = [0, 0, 0, 0, 0, 0, 0], ord = [0, 0, 0, 0, 0, 0, 0]
  for (const r of righe) {
    const dow = (new Date(`${data(r).slice(0, 10)}T00:00:00Z`).getUTCDay() + 6) % 7
    fatt[dow] += Number(r.revenue ?? r.value) || 0
    ord[dow] += Number(r.orders) || 0
  }
  const totF = Number(metrics?.shopifyRange?.revenue) || 0, totO = Number(metrics?.shopifyRange?.orders) || 0
  const f = totF > 0 ? dividiSoldi(totF, fatt) : fatt.map(r2)
  const o = totO > 0 ? dividi(totO, ord) : ord
  return GIORNI_IT.map((nome, i) => ({ day: nome, label: nome, revenue: f[i], value: f[i], orders: o[i] }))
}

// ============================================================================
//  Le singole risposte (per chi le vuole chiamare a mano) e lo smistatore.
// ============================================================================
export const demoKpiProvince = (search, ctx) => demoProvince(search, contesto(ctx))
export const demoHourlySales = (search, ctx) => demoFasceOrarie(search, contesto(ctx))
export const demoMetaSegments = (search, ctx) => demoSegmentiMeta(search, contesto(ctx))
export const demoGoogleSegments = (search, ctx) => demoSegmentiGoogle(search, contesto(ctx))
export const demoShopifyCountries = (search, ctx) => demoPaesi(search, contesto(ctx))
export const demoProductImages = (search, ctx) => demoFotoProdotti(contesto(ctx))

export function demoKpiBrain(p, search, method = 'GET', ctx = {}) {
  const percorso = String(p || '').replace(/\/$/, '')
  if (!KPI_BRAIN_PATHS.has(percorso) || String(method || 'GET').toUpperCase() !== 'GET') return undefined
  const C = contesto(ctx)
  switch (percorso) {
    case '/api/kpi-province': return demoProvince(search, C)
    case '/api/hourly-sales': return demoFasceOrarie(search, C)
    case '/api/meta-segments': return demoSegmentiMeta(search, C)
    case '/api/google-segments': return demoSegmentiGoogle(search, C)
    case '/api/shopify-countries': return demoPaesi(search, C)
    case '/api/product-images': return demoFotoProdotti(C)
    default: return undefined
  }
}
