// ============================================================================
//  Le voci dei report del menu Report (Weekly, Monthly, Quarter, Year) per il
//  PDF, calcolate COME LE CALCOLA LA TABELLA dell'app (app/page.js: allWeeks,
//  la mappa dei mesi, aggregateQuarter, aggregateYear).
//
//  Perche' esiste. Marino, 21 set 2026: il PDF Weekly della settimana scorsa
//  diceva spesa Google 2.687 €, la tabella 3.025 €, e con lei MER, nuovi e di
//  ritorno. Due cause, tutte e due qui:
//    1. il PDF leggeva altre fonti e altre formule: la spesa Google da
//       /api/google-kpi, Meta da una chiamata sua, "Questa settimana"
//       confrontata con lo stesso numero di GIORNI invece che con la settimana
//       intera prima;
//    2. leggeva dalle cache senza mai rinfrescarle: l'app mostra lo snapshot e
//       subito dopo lo ricarica (historyStale → force=1), il PDF stampava lo
//       snapshot e basta. Misurato: 2.687 € e' la spesa della settimana
//       accumulata fino a domenica verso le 17.
//  E in piu' il PDF aveva 10 voci, la tabella 23.
//
//  Quindi: stesse fonti della tabella, chieste fresche (chi chiama passa
//  force=1), stesse formule, stesse voci. Se la tabella cambia una formula,
//  va cambiata anche qui — e `.audit-report-voci.mjs` lo dice, perche'
//  confronta il PDF con le celle vere della tabella aperta nel browser.
// ============================================================================

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const div = (a, b) => (b > 0 ? a / b : null)

// ── Settimane (chiave = lunedi', come getWeeks() della tabella) ─────────────
// In UTC come la tabella: se il lunedi' si calcolasse in un altro fuso, fra
// mezzanotte e le due il PDF e la tabella metterebbero lo stesso giorno in due
// settimane diverse.
export function lunediDi(ds) {
  const d = new Date(`${ds}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}
function piuGiorni(ds, g) { const d = new Date(`${ds}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + g); return d.toISOString().slice(0, 10) }

// Le settimane che TOCCANO l'intervallo (come il filtro "custom" della
// tabella: una settimana va dal suo lunedi' alla domenica).
export function settimaneDi(since, until) {
  const out = []
  for (let k = lunediDi(since); k <= until; k = piuGiorni(k, 7)) out.push(k)
  return out
}
// Lo stesso numero di settimane subito prima. E' il confronto della tabella:
// "Questa settimana" contro TUTTA la settimana scorsa, non contro gli stessi
// giorni — che e' quello che faceva il PDF.
export function settimanePrima(chiavi) {
  if (!chiavi.length) return []
  return chiavi.map((_, i) => piuGiorni(chiavi[0], -7 * (chiavi.length - i)))
}

// La spesa Google per settimana: i giorni di /api/google sommati per lunedi',
// arrotondati al centesimo — la stessa cosa che fa googleWeekly in page.js.
export function googlePerSettimana(daily) {
  const map = {}
  for (const x of daily || []) { if (!x?.date) continue; const k = lunediDi(x.date); map[k] = (map[k] || 0) + n(x.spend) }
  for (const k of Object.keys(map)) map[k] = Math.round(map[k] * 100) / 100
  return map
}

// Una settimana, come la riga di allWeeks. I valori inseriti a mano nella
// tabella (localStorage del browser) il server non li vede: sono solo il
// ripiego quando il dato automatico manca, e con Shopify, Meta e Google
// collegati non entrano mai.
export function baseSettimana(key, { shopifyWeekly, metaWeekly, googleSett }) {
  const sw = (shopifyWeekly || []).find(w => w.date === key) || {}
  const mw = (metaWeekly || []).find(w => w.date === key) || {}
  // Negativo = piu' resi che vendite: un dato vero, si tiene (come in page.js dal 21 set).
  const fat = n(sw.fatturato)
  const fatNC = n(sw.fatturNC)
  const ses = n(sw.uniqueSessions) > 0 ? n(sw.uniqueSessions) : n(sw.online_store_visitors)
  return {
    fatturato: fat,
    koongo: n(sw.koongoFatturato),
    fatturNC: fatNC,
    fatturRC: n(sw.fatturRC) !== 0 ? n(sw.fatturRC) : Math.max(fat - fatNC, 0),
    resi: n(sw.resi),
    ordini: n(sw.ordini),
    nc: n(sw.nc),
    rc: n(sw.rc),
    sessioni: ses,
    metaSpend: n(mw.spend),
    googleSpend: n(googleSett?.[key]),
  }
}

// ── Mesi ────────────────────────────────────────────────────────────────────
// Come la mappa dei mesi in page.js: Shopify dal mensile, Meta dal mensile e,
// se per quel mese non c'e', dalle settimane che vi iniziano; Google dal
// mensile del collegamento.
const meseDi = (ds) => String(ds || '').slice(0, 7)
export function baseMese(mese, { shopifyMonthly, metaMonthly, metaWeekly, googleMensile }) {
  const s = (shopifyMonthly || []).find(r => r.month === mese) || {}
  let meta = n(((metaMonthly || []).find(r => r.month === mese) || {}).spend)
  // Ripiego come in page.js, riga per riga: si aggiunge una settimana solo
  // finche' il mese e' ancora a zero — cioe', di fatto, la PRIMA settimana
  // con spesa. Scatta solo se Meta non ha dato il mensile di quel mese.
  for (const w of metaWeekly || []) if (meseDi(w.date) === mese && meta <= 0) meta += n(w.spend)
  // Un mese negativo (giugno 2025: −994 €, reso di un ordine di maggio) e' un dato, non un buco.
  const fat = n(s.fatturato), fatNC = n(s.fatturNC)
  const ordini = n(s.ordini), nc = n(s.nc)
  return {
    fatturato: fat,
    koongo: n(s.koongoFatturato),
    fatturNC: fatNC,
    fatturRC: n(s.fatturRC) !== 0 ? n(s.fatturRC) : Math.max(fat - fatNC, 0),
    resi: n(s.resi),
    ordini,
    nc,
    rc: n(s.rc) > 0 ? n(s.rc) : Math.max(ordini - nc, 0),
    sessioni: n(s.uniqueSessions || s.sessioni),
    metaSpend: meta,
    googleSpend: n(googleMensile?.[mese]),
  }
}

// I campi Shopify di un intervallo "vivo" (shopifyRange di /api/metrics),
// nella forma della base. E' quello che la tabella sovrappone al mese, al
// trimestre e all'anno in corso.
export function baseDaIntervallo(sr) {
  return {
    fatturato: n(sr?.revenue), koongo: n(sr?.koongoRevenue), fatturNC: n(sr?.fatturNC), fatturRC: n(sr?.fatturRC),
    resi: n(sr?.resi), ordini: n(sr?.orders), nc: n(sr?.nc), rc: n(sr?.rc), sessioni: n(sr?.sessions),
  }
}

const CAMPI = ['fatturato', 'koongo', 'fatturNC', 'fatturRC', 'resi', 'ordini', 'nc', 'rc', 'sessioni', 'metaSpend', 'googleSpend']
export function somma(basi) {
  const out = Object.fromEntries(CAMPI.map(c => [c, 0]))
  for (const b of basi) for (const c of CAMPI) out[c] += n(b?.[c])
  return out
}

// ── Le voci derivate: le formule della tabella, identiche ───────────────────
// cfg = { freq, life, margin } effettivo della tabella (ordini a vita dai
// dati, margine dai costi prodotto): lo manda il pulsante del PDF, cosi' LTV
// e il rapporto LTV:CAC sono quelli che si vedono a schermo.
export function derivate(b, cfg) {
  const totalSpend = n(b.metaSpend) + n(b.googleSpend)
  const aov = div(b.fatturato, b.ordini)
  const cac = div(totalSpend, b.nc)
  const ltv = aov ? aov * n(cfg?.freq) * n(cfg?.life) * n(cfg?.margin) / 100 : null
  return {
    ...b,
    totalSpend,
    mer: div(b.fatturato, totalSpend),
    aMer: div(b.fatturNC, totalSpend),
    cac,
    cpo: div(totalSpend, b.ordini),
    aov,
    aovNC: div(b.fatturNC, b.nc),
    aovRC: div(b.fatturRC, b.rc),
    ltv,
    ratio: ltv && cac ? ltv / cac : null,
    retention: b.nc + b.rc > 0 ? b.rc / (b.nc + b.rc) * 100 : null,
    cro: b.sessioni > 0 && b.ordini > 0 ? b.ordini / b.sessioni * 100 : null,
  }
}

// ── L'elenco delle voci: stesso ordine e stesse etichette di righeReport ─────
// fmt: euro0 | euro2 | int | volte | perc | rapporto. `meglioBasso` = una
// crescita e' una cattiva notizia (spesa, costi, resi).
export const VOCI = [
  { key: 'fatturato', label: 'Fatturato', fmt: 'euro0', strong: true },
  { key: 'koongo', label: 'Fatturato Koongo', fmt: 'euro0', sub: true, soloSe: 'koongo' },
  { key: 'fatturNC', label: 'Fatt. NC', fmt: 'euro0', sub: true },
  { key: 'fatturRC', label: 'Fatt. RC', fmt: 'euro0', sub: true },
  { key: 'resi', label: 'Resi', fmt: 'euro0', meglioBasso: true, gapAfter: true },
  { key: 'ordini', label: 'Ordini', fmt: 'int', strong: true },
  { key: 'nc', label: 'Nuovi Clienti', fmt: 'int', sub: true },
  { key: 'rc', label: 'Clienti Ritorno', fmt: 'int', sub: true, gapAfter: true },
  { key: 'totalSpend', label: 'ADV', fmt: 'euro0', meglioBasso: true, strong: true },
  { key: 'metaSpend', label: 'di cui Meta', fmt: 'euro0', meglioBasso: true, sub: true },
  { key: 'googleSpend', label: 'di cui Google', fmt: 'euro0', meglioBasso: true, sub: true, gapAfter: true },
  { key: 'mer', label: 'MER', fmt: 'volte', strong: true },
  { key: 'aMer', label: 'aMER', fmt: 'volte' },
  { key: 'cac', label: 'CAC', fmt: 'euro2', meglioBasso: true },
  { key: 'cpo', label: 'CPO', fmt: 'euro2', meglioBasso: true },
  { key: 'aov', label: 'AOV', fmt: 'euro2' },
  { key: 'aovNC', label: 'AOV NC', fmt: 'euro2', sub: true },
  { key: 'aovRC', label: 'AOV RC', fmt: 'euro2', sub: true },
  { key: 'ltv', label: 'LTV', fmt: 'euro2' },
  { key: 'ratio', label: 'Ratio LTV:CAC', fmt: 'rapporto', gapAfter: true },
  { key: 'sessioni', label: 'Sessioni', fmt: 'int' },
  { key: 'cro', label: 'CRO%', fmt: 'perc' },
  { key: 'retention', label: 'Ret%', fmt: 'perc' },
]

// Le voci che quella tab mostra davvero: tutte, anche nel Weekly (dal 21 set 2026 la tabella
// settimanale ha i Resi come le altre). Il Koongo compare solo se il marketplace ha venduto in
// uno dei due periodi confrontati.
export function vociDelTab(tab, cur, prev) {
  return VOCI.filter(v => {
    if (v.soloSe === 'koongo') return n(cur?.koongo) > 0 || n(prev?.koongo) > 0
    return true
  })
}
