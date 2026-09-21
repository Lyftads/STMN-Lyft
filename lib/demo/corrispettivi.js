// ============================================================================
//  DEMO — Registro corrispettivi (tab «Corrispettivi»), dati 100% inventati.
//
//  Stesse forme di app/api/corrispettivi/route.js (→ lib/fiscal/registro.js) e
//  di app/api/corrispettivi/giorno/route.js, cosi' la tab reale si riempie senza
//  sapere di essere in una demo. Numeri costruiti AL CENTESIMO perche' la tab li
//  ricontrolla: per ogni riga lordo = imponibile + IVA, e le due identita' della
//  quadratura (vendite + sconti + resi = netto; netto + spedizioni + IVA +
//  commissioni di reso = lordo) chiudono esatte.
//
//  Il fatturato del giorno nasce dalla serie settimanale della demo
//  (metrics().shopifyWeekly, la stessa della Dashboard: ~55-57 mila euro su 28
//  giorni) e si divide fra i paesi con le quote di /api/shopify-countries
//  (lib/demo/kpiBrain.js), piu' il Regno Unito come secondo paese extra-UE.
//
//  NON importa data.js: riceve dal chiamante ctx = { DEMO_PRODUCTS, ymd, iso, DAY, metrics }.
// ============================================================================

export const CORRISPETTIVI_PATHS = new Set([
  '/api/corrispettivi',
  '/api/corrispettivi/giorno',
  '/api/corrispettivi/export',
])

// ── Aiuti ────────────────────────────────────────────────────────────────────
const DAY_MS = 86400000
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const c2e = (c) => Math.round(c) / 100

// Un numero fra 0 e 1 che dipende solo dal testo: la "casualita'" della demo.
function caso(s) {
  let h = 2166136261
  const t = String(s)
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 100000) / 100000
}
const vario = (chiave, ampiezza) => 1 + (caso(chiave) - 0.5) * 2 * ampiezza

// Divide un intero secondo i pesi, senza perdere unita'.
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

const lingua = () => {
  try { return String((typeof document !== 'undefined' && document.documentElement.lang) || 'it').slice(0, 2) } catch { return 'it' }
}

const TESTI = {
  it: {
    giornoNonValido: 'Giorno non valido',
    nota: 'Ordini creati in questa data. Il registro segue la data di competenza del report, quindi i totali possono non coincidere.',
    export: "L'export XLSX non è disponibile nella demo: con il tuo negozio collegato scarichi il file per il commercialista.",
  },
  en: {
    giornoNonValido: 'Invalid day',
    nota: 'Orders created on this date. The register follows the report accounting date, so totals may not match.',
    export: 'XLSX export is not available in the demo: with your store connected you download the file for your accountant.',
  },
  es: {
    giornoNonValido: 'Día no válido',
    nota: 'Pedidos creados en esta fecha. El registro sigue la fecha contable del informe, por lo que los totales pueden no coincidir.',
    export: 'La exportación XLSX no está disponible en la demo: con tu tienda conectada descargas el archivo para tu asesor.',
  },
  fr: {
    giornoNonValido: 'Jour non valide',
    nota: 'Commandes créées à cette date. Le registre suit la date comptable du rapport, les totaux peuvent donc différer.',
    export: "L'export XLSX n'est pas disponible dans la démo : avec votre boutique connectée, vous téléchargez le fichier pour votre comptable.",
  },
  de: {
    giornoNonValido: 'Ungültiger Tag',
    nota: 'An diesem Datum erstellte Bestellungen. Das Register folgt dem Buchungsdatum des Berichts, daher können die Summen abweichen.',
    export: 'Der XLSX-Export ist in der Demo nicht verfügbar: mit verbundenem Shop lädst du die Datei für deinen Steuerberater herunter.',
  },
}
const testo = (k) => (TESTI[lingua()] || TESTI.it)[k] || TESTI.it[k]

// ── Paesi ────────────────────────────────────────────────────────────────────
// iso, nome come lo scrive ShopifyQL, quota del lordo (come /api/shopify-countries,
// con il Regno Unito preso all'Italia), AOV relativo, aliquota ordinaria, spedizione a pagamento.
const PAESI = [
  ['IT', 'Italy', 0.687, 1.0, 22, 490],
  ['DE', 'Germany', 0.085, 1.12, 19, 990],
  ['FR', 'France', 0.07, 1.08, 20, 990],
  ['CH', 'Switzerland', 0.045, 1.34, 0, 1490],
  ['ES', 'Spain', 0.04, 0.94, 21, 990],
  ['AT', 'Austria', 0.025, 1.1, 20, 990],
  ['NL', 'Netherlands', 0.02, 1.05, 21, 990],
  ['BE', 'Belgium', 0.015, 1.02, 21, 990],
  ['GB', 'United Kingdom', 0.008, 1.2, 0, 1490],
  ['PT', 'Portugal', 0.005, 0.9, 23, 990],
]
const UE = new Set(['IT', 'DE', 'FR', 'ES', 'AT', 'NL', 'BE', 'PT'])
const perimetroDi = (iso) => (!iso ? 'SENZA_PAESE' : iso === 'IT' ? 'ITALIA' : UE.has(iso) ? 'OSS' : 'EXTRA_UE')

const NOMI_IT = {
  IT: 'Italia', DE: 'Germania', FR: 'Francia', CH: 'Svizzera', ES: 'Spagna', AT: 'Austria',
  NL: 'Paesi Bassi', BE: 'Belgio', GB: 'Regno Unito', PT: 'Portogallo',
}
function nomePaese(iso, lang) {
  if (!iso) return 'Paese mancante'
  if (lang !== 'it') {
    try {
      const n = new Intl.DisplayNames([lang], { type: 'region' }).of(iso)
      if (n && n !== iso) return n
    } catch {}
  }
  return NOMI_IT[iso] || iso
}

// ── Periodo (copia di periodoDelMese di lib/fiscal/registro.js) ────────────
function periodoDelMese(mese) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(mese || ''))
  const oggi = new Date()
  const anno = m ? Number(m[1]) : oggi.getFullYear()
  const numero = m ? Number(m[2]) : oggi.getMonth() + 1
  const primo = new Date(Date.UTC(anno, numero - 1, 1))
  const ultimo = new Date(Date.UTC(anno, numero, 0))
  const iso = (d) => d.toISOString().slice(0, 10)
  const oggiISO = iso(oggi)
  const fine = iso(ultimo) > oggiISO ? oggiISO : iso(ultimo)
  return {
    mese: `${anno}-${String(numero).padStart(2, '0')}`,
    since: iso(primo),
    until: fine,
    completo: iso(ultimo) <= oggiISO,
    giorniMese: ultimo.getUTCDate(),
  }
}
function giorni(since, until) {
  const out = []
  const d = new Date(`${since}T00:00:00Z`), fine = new Date(`${until}T00:00:00Z`)
  for (let n = 0; d <= fine && n < 40; n++) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1) }
  return out
}

// ── Fatturato di un giorno dalla serie settimanale della demo ──────────────
const PESO_SETTIMANA = [1.04, 0.98, 0.96, 1.0, 0.94, 0.88, 1.2] // lunedi' → domenica
const SOMMA_PESI = PESO_SETTIMANA.reduce((a, b) => a + b, 0)
const lunediDi = (giorno) => {
  const d = new Date(`${giorno}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

function settimane(ctx) {
  const M = (typeof ctx?.metrics === 'function' ? ctx.metrics() : ctx?.metrics) || {}
  const serie = Array.isArray(M.shopifyWeekly) ? M.shopifyWeekly : []
  const mappa = new Map(serie.map(w => [String(w.date || w.weekStart || w.week).slice(0, 10), Number(w.fatturato) || 0]))
  const prima = serie.length ? String(serie[0].date || serie[0].weekStart).slice(0, 10) : null
  const primoValore = serie.length ? Number(serie[0].fatturato) || 6200 : 6200
  const ultimo = serie.length ? Number(serie[serie.length - 1].fatturato) || 14000 : 14000
  return (lunedi) => {
    if (mappa.has(lunedi)) return mappa.get(lunedi)
    if (prima && lunedi < prima) {
      // Prima della serie: il negozio cresceva di ~540 euro a settimana; mai sotto 4.200.
      const n = Math.round((Date.parse(prima) - Date.parse(lunedi)) / (7 * DAY_MS))
      return Math.max(4200, primoValore - n * 540) * vario(lunedi + 'w', 0.08)
    }
    return ultimo
  }
}

function lordoDelGiorno(giorno, fattSettimana) {
  const dow = (new Date(`${giorno}T00:00:00Z`).getUTCDay() + 6) % 7
  let euro = (fattSettimana(lunediDi(giorno)) / SOMMA_PESI) * PESO_SETTIMANA[dow] * vario(giorno + 'g', 0.14)
  // Oggi: solo le ore gia' passate (ora di Roma, circa).
  const oggi = new Date().toISOString().slice(0, 10)
  if (giorno === oggi) {
    const ore = ((Date.now() + 2 * 3600000) % DAY_MS) / DAY_MS
    euro *= Math.max(0.08, Math.min(1, ore))
  }
  return Math.round(euro * 100) // centesimi
}

// ── Una riga del registro (giorno × paese), al centesimo ───────────────────
function rigaRegistro(giorno, paese, lordoC, lang) {
  const [iso, nomeEn, , aovRel, aliquotaOrd, spedC] = paese
  const k = giorno + iso
  const perimetro = perimetroDi(iso)
  const ordini = Math.max(1, Math.round(lordoC / (7200 * aovRel * vario(k + 'a', 0.1))))

  // IVA come la registra Shopify. Italia: abbigliamento/attrezzatura al 22%, una parte
  // di integratori al 10% — l'aliquota effettiva della riga viene fuori dai numeri.
  let ivaC
  if (iso === 'IT') {
    const quota10 = 0.06 + caso(k + 'dieci') * 0.16
    const a10 = Math.round(lordoC * quota10)
    ivaC = Math.round((lordoC - a10) * 22 / 122 + a10 * 10 / 110)
  } else {
    ivaC = Math.round(lordoC * aliquotaOrd / (100 + aliquotaOrd))
  }
  const imponibileC = lordoC - ivaC
  const aliquota = imponibileC > 0 ? Math.round((ivaC / imponibileC) * 1000) / 10 : 0

  // Spedizioni pagate: in Italia sopra i 49 euro e' gratis, all'estero si paga piu' spesso.
  const quotaPagate = iso === 'IT' ? 0.28 : perimetro === 'OSS' ? 0.5 : 0.9
  let spedizioniC = Math.round(ordini * quotaPagate * vario(k + 's', 0.3)) * spedC
  if (spedizioniC > lordoC * 0.15) spedizioniC = Math.round(lordoC * 0.15 / 10) * 10

  // Resi: ~2% degli ordini (come buildWeeks), sul giorno del rimborso.
  let resiN = 0
  for (let j = 0; j < ordini; j++) if (caso(k + 'r' + j) < 0.021) resiN++
  const netUnit = (lordoC - ivaC - spedizioniC) / ordini
  const resiC = resiN ? -Math.round(resiN * netUnit * vario(k + 'rv', 0.25)) : 0
  const commissioniResoC = resiN && caso(k + 'fee') < 0.45 ? 490 * resiN : 0

  const nettoC = lordoC - spedizioniC - ivaC - commissioniResoC
  const scontiC = -Math.round((nettoC - resiC) * (0.06 + caso(k + 'sc') * 0.05))
  const venditeC = nettoC - scontiC - resiC

  const daFatturazione = caso(k + 'bill') < 0.035
  return {
    giorno,
    iso,
    paese: nomePaese(iso, lang),
    paeseOriginale: nomeEn,
    daFatturazione,
    perimetro,
    aliquota,
    fonteIva: 'shopify',
    aliquotaOrdinaria: aliquotaOrd,
    lordo: c2e(lordoC),
    imponibile: c2e(imponibileC),
    iva: c2e(ivaC),
    vendite: c2e(venditeC),
    sconti: c2e(scontiC),
    resi: c2e(resiC),
    netto: c2e(nettoC),
    spedizioni: c2e(spedizioniC),
    ivaShopify: c2e(ivaC),
    commissioniReso: c2e(commissioniResoC),
    ordini,
    // Solo per il dettaglio ordini del giorno (la route vera non lo manda: innocuo).
    _resiN: resiN,
  }
}

function righeDelGiorno(giorno, fattSettimana, lang) {
  const totaleC = lordoDelGiorno(giorno, fattSettimana)
  const righe = []
  let restoC = totaleC
  for (const p of PAESI.slice(1)) {
    const [iso, , quota, aovRel] = p
    const atteso = totaleC * quota * vario(giorno + iso + 'q', 0.35)
    const ordiniAttesi = atteso / (7200 * aovRel)
    let c = 0
    if (ordiniAttesi >= 1) c = Math.round(atteso)
    else if (caso(giorno + iso + 'c') < ordiniAttesi) c = Math.round(7200 * aovRel * vario(giorno + iso + 'u', 0.3) * 100) / 100
    c = Math.round(c)
    if (c > 0 && c < restoC * 0.6) { righe.push(rigaRegistro(giorno, p, c, lang)); restoC -= c }
  }
  if (restoC > 0) righe.unshift(rigaRegistro(giorno, PAESI[0], restoC, lang))
  return righe
}

// ── Gift card del mese ───────────────────────────────────────────────────────
function numeroOrdine(giorno, k) {
  const n = Math.round((Date.parse(`${giorno}T00:00:00Z`) - Date.parse('2023-01-01T00:00:00Z')) / DAY_MS)
  return `#${1000 + n * 27 + k}`
}

function giftCardDelMese(periodo, elencoGiorni, lang) {
  const movimenti = []
  if (elencoGiorni.length) {
    const ge = elencoGiorni[Math.floor(caso(periodo.mese + 'ge') * elencoGiorni.length)]
    const importoE = [50, 75, 100, 150][Math.floor(caso(periodo.mese + 'gei') * 4)]
    movimenti.push({ giorno: ge, tipo: 'emissione', importo: importoE, ordine: numeroOrdine(ge, 3), iso: 'IT', daFatturazione: false })
    if (elencoGiorni.length > 3 && caso(periodo.mese + 'gr') < 0.85) {
      let gr = elencoGiorni[Math.floor(caso(periodo.mese + 'grg') * elencoGiorni.length)]
      if (gr === ge) gr = elencoGiorni[(elencoGiorni.indexOf(ge) + 2) % elencoGiorni.length]
      // Mai lo stesso importo dell'emissione: la rettifica del mese resta visibile.
      const importoR = [25, 40, 50, 60][Math.floor(caso(periodo.mese + 'gri') * 4)]
      const isoR = caso(periodo.mese + 'grp') < 0.75 ? 'IT' : 'DE'
      movimenti.push({ giorno: gr, tipo: 'riscatto', importo: importoR, ordine: numeroOrdine(gr, 11), iso: isoR, daFatturazione: false })
    }
  }
  const ALI = { IT: 22, DE: 19 }
  for (const m of movimenti) {
    m.segno = m.tipo === 'riscatto' ? -1 : 1
    m.perimetro = perimetroDi(m.iso)
    m.aliquota = ALI[m.iso] ?? 22
    m.paese = nomePaese(m.iso, lang)
    const imp = Math.round((m.importo / (1 + m.aliquota / 100)) * 100) / 100
    const iva = r2(m.importo - imp)
    m.imponibile = r2(imp * m.segno)
    m.iva = r2(iva * m.segno)
    m.effetto = r2(m.importo * m.segno)
  }
  movimenti.sort((a, b) => a.giorno.localeCompare(b.giorno))
  const per = (tipo) => r2(movimenti.filter(m => m.tipo === tipo).reduce((a, m) => a + m.importo, 0))
  const gruppi = new Map()
  for (const m of movimenti) {
    if (!gruppi.has(m.perimetro)) gruppi.set(m.perimetro, { perimetro: m.perimetro, rettifica: 0, imponibile: 0, iva: 0 })
    const g = gruppi.get(m.perimetro)
    g.rettifica = r2(g.rettifica + m.effetto)
    g.imponibile = r2(g.imponibile + m.imponibile)
    g.iva = r2(g.iva + m.iva)
  }
  return {
    leggibili: true,
    riscattiLeggibili: true,
    troncato: false,
    emesse: per('emissione'), riscatti: per('riscatto'), accrediti: per('accredito'),
    rettifica: r2(movimenti.reduce((a, m) => a + m.effetto, 0)),
    nonAttribuiti: 0,
    movimenti,
    perPerimetro: [...gruppi.values()].sort((a, b) => Math.abs(b.rettifica) - Math.abs(a.rettifica)),
  }
}

// ── Il registro del mese (stessa forma di calcolaRegistro) ─────────────────
function registro(mese, ctx) {
  const lang = lingua()
  const periodo = periodoDelMese(mese)
  const fattSettimana = settimane(ctx)
  const elencoGiorni = periodo.since <= periodo.until ? giorni(periodo.since, periodo.until) : []

  const righe = []
  for (const g of elencoGiorni) for (const r of righeDelGiorno(g, fattSettimana, lang)) righe.push(r)
  const righePubbliche = righe.map(({ _resiN, ...r }) => r)
  const gift = giftCardDelMese(periodo, elencoGiorni, lang)

  const sommaSu = (elenco) => elenco.reduce((a, r) => ({
    lordo: r2(a.lordo + r.lordo),
    imponibile: r.imponibile == null ? a.imponibile : r2(a.imponibile + r.imponibile),
    iva: r.iva == null ? a.iva : r2(a.iva + r.iva),
    vendite: r2(a.vendite + r.vendite),
    sconti: r2(a.sconti + r.sconti),
    resi: r2(a.resi + r.resi),
    netto: r2(a.netto + r.netto),
    spedizioni: r2(a.spedizioni + r.spedizioni),
    ivaShopify: r2(a.ivaShopify + r.ivaShopify),
    commissioniReso: r2(a.commissioniReso + r.commissioniReso),
    ordini: a.ordini + r.ordini,
    lordoSenzaImponibile: r.imponibile == null ? r2(a.lordoSenzaImponibile + r.lordo) : a.lordoSenzaImponibile,
  }), {
    lordo: 0, imponibile: 0, iva: 0, vendite: 0, sconti: 0, resi: 0,
    netto: 0, spedizioni: 0, ivaShopify: 0, commissioniReso: 0, ordini: 0, lordoSenzaImponibile: 0,
  })
  const raggruppa = (chiave) => {
    const m = new Map()
    for (const r of righePubbliche) {
      const k = chiave(r)
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(r)
    }
    return m
  }

  const perPerimetro = [...raggruppa(r => r.perimetro).entries()].map(([id, elenco]) => ({
    perimetro: id, ...sommaSu(elenco), paesi: new Set(elenco.map(r => r.iso || '—')).size,
  })).sort((a, b) => b.lordo - a.lordo)

  const perPaese = [...raggruppa(r => r.iso || '__senza').entries()].map(([k, elenco]) => {
    const t = sommaSu(elenco)
    return {
      iso: k === '__senza' ? null : k,
      paese: elenco[0].paese,
      perimetro: elenco[0].perimetro,
      aliquota: t.imponibile > 0 ? Math.round((t.iva / t.imponibile) * 1000) / 10 : null,
      ...t,
    }
  }).sort((a, b) => b.lordo - a.lordo)

  const perGiorno = [...raggruppa(r => r.giorno).entries()].map(([giorno, elenco]) => ({
    giorno, ...sommaSu(elenco), paesi: elenco.length,
  })).sort((a, b) => a.giorno.localeCompare(b.giorno))

  const totali = sommaSu(righePubbliche)

  const TOLLERANZA = 0.02
  const scartoNetto = r2(totali.vendite + totali.sconti + totali.resi - totali.netto)
  const scartoTotale = r2(totali.netto + totali.spedizioni + totali.ivaShopify + totali.commissioniReso - totali.lordo)
  const quadratura = {
    tolleranza: TOLLERANZA,
    nettoAtteso: r2(totali.vendite + totali.sconti + totali.resi),
    nettoRilevato: totali.netto,
    scartoNetto,
    nettoOk: Math.abs(scartoNetto) <= TOLLERANZA,
    totaleAtteso: r2(totali.netto + totali.spedizioni + totali.ivaShopify + totali.commissioniReso),
    totaleRilevato: totali.lordo,
    scartoTotale,
    totaleOk: Math.abs(scartoTotale) <= TOLLERANZA,
  }

  const rettificaValida = true
  const corrispettivoFiscale = r2(totali.lordo + gift.rettifica)
  const perPerimetroFiscale = perPerimetro.map(p => {
    const g = gift.perPerimetro.find(x => x.perimetro === p.perimetro) || null
    return {
      ...p,
      rettificaGift: g ? g.rettifica : 0,
      corrispettivo: r2(p.lordo + (g ? g.rettifica : 0)),
      imponibileFiscale: r2(p.imponibile + (g ? g.imponibile : 0)),
      ivaFiscale: r2(p.iva + (g ? g.iva : 0)),
    }
  })
  for (const g of gift.perPerimetro) {
    if (perPerimetroFiscale.some(p => p.perimetro === g.perimetro)) continue
    perPerimetroFiscale.push({
      perimetro: g.perimetro, lordo: 0, imponibile: 0, iva: 0, ordini: 0, paesi: 0,
      vendite: 0, sconti: 0, resi: 0, netto: 0, spedizioni: 0, ivaShopify: 0,
      commissioniReso: 0, lordoSenzaImponibile: 0,
      rettificaGift: g.rettifica, corrispettivo: g.rettifica,
      imponibileFiscale: g.imponibile, ivaFiscale: g.iva,
    })
  }
  perPerimetroFiscale.sort((a, b) => b.corrispettivo - a.corrispettivo)

  // Canali: informativi (la tab non li mostra), sommano al lordo e agli ordini.
  const lordoC = Math.round(totali.lordo * 100)
  const quoteCanali = [0.86, 0.07, 0.05, 0.02]
  const lordiCanali = dividi(lordoC, quoteCanali)
  const ordiniCanali = dividi(totali.ordini, quoteCanali)
  const canali = ['Online Store', 'Instagram', 'Facebook', 'Point of Sale']
    .map((canale, i) => ({ canale, lordo: c2e(lordiCanali[i]), ordini: ordiniCanali[i] }))
    .filter(c => c.lordo > 0)

  const lordoDaFatturazione = r2(righePubbliche.filter(r => r.daFatturazione).reduce((a, r) => a + r.lordo, 0))

  return {
    ok: true,
    periodo,
    totali,
    quadratura,
    perPerimetro,
    perPaese,
    perGiorno,
    righe: righePubbliche,
    canali,
    gift,
    corrispettivoFiscale,
    rettificaValida,
    perPerimetroFiscale,
    qualita: {
      lordoSenzaPaese: 0,
      quotaSenzaPaesePct: 0,
      ordiniSenzaPaese: 0,
      lordoDaFatturazione,
      quotaDaFatturazionePct: totali.lordo > 0 ? Math.round((lordoDaFatturazione / totali.lordo) * 1000) / 10 : 0,
      paesiSenzaAliquota: 0,
      giftCardLeggibili: true,
      giftCardRiscattiLeggibili: true,
      ordiniStoriciCompleti: true,
      permessiLetti: 14,
      meseCompleto: periodo.completo,
    },
    updatedAt: new Date(Date.now() - 4 * 60000).toISOString(),
    // Interno: per il dettaglio del giorno (non letto dalla tab).
    _righe: righe,
  }
}

// ── Ordini di un giorno (stessa forma di /api/corrispettivi/giorno) ─────────
function ordiniDelGiorno(giorno, ctx) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno)) return { ok: false, error: testo('giornoNonValido') }
  const R = registroInMemoria(giorno.slice(0, 7), ctx)
  const righe = (R._righe || []).filter(r => r.giorno === giorno)
  const ordini = []
  let k = 0
  for (const r of righe) {
    const n = r.ordini
    const pesi = Array.from({ length: n }, (_, j) => vario(giorno + r.iso + 'o' + j, 0.45))
    const totali = dividi(Math.round(r.lordo * 100), pesi)
    const ive = dividi(Math.round(r.iva * 100), totali)
    const sped = dividi(Math.round(r.spedizioni * 100), totali)
    // I resi della riga cadono su ordini di questo giorno: rimborso IVA compresa.
    const conReso = new Set()
    for (let j = 0; j < (r._resiN || 0) && j < n; j++) conReso.add(Math.floor(caso(giorno + r.iso + 'rr' + j) * n))
    const perReso = conReso.size ? Math.round((-r.resi * (1 + (r.aliquota || 0) / 100) * 100) / conReso.size) : 0
    for (let j = 0; j < n; j++) {
      const id = String(5600000000000 + Math.round(Date.parse(`${giorno}T00:00:00Z`) / 1000) + k)
      ordini.push({
        id,
        numero: '',
        ora: '',
        paese: r.iso,
        paeseDaSpedizione: !r.daFatturazione,
        lordo: c2e(totali[j]),
        totale: c2e(totali[j]),
        iva: c2e(ive[j]),
        imponibile: c2e(totali[j] - ive[j]),
        spedizione: c2e(sped[j]),
        sconti: c2e(Math.round(totali[j] * 0.08)),
        rimborsato: conReso.has(j) ? c2e(perReso) : 0,
        stato: conReso.has(j) ? 'partially_refunded' : 'paid',
        link: undefined,
      })
      k++
    }
  }
  // Orari: dalle 7 a mezzanotte, piu' fitti la sera; oggi, solo fino a ora.
  const oggi = new Date().toISOString().slice(0, 10)
  const oraMax = giorno === oggi ? Math.max(1, Math.floor(((Date.now() + 2 * 3600000) % DAY_MS) / 60000)) : 1439
  const minuti = ordini.map((_, i) => {
    const u = caso(giorno + 't' + i)
    const inizio = oraMax > 480 ? 420 : 0
    const m = Math.floor(inizio + Math.pow(u, 0.8) * (oraMax - inizio))
    return Math.min(oraMax, m)
  }).sort((a, b) => a - b)
  // Paesi mescolati, poi orari crescenti e numeri d'ordine progressivi.
  ordini.sort((a, b) => caso(a.id) - caso(b.id))
  ordini.forEach((o, i) => {
    o.ora = `${String(Math.floor(minuti[i] / 60)).padStart(2, '0')}:${String(minuti[i] % 60).padStart(2, '0')}`
    o.numero = numeroOrdine(giorno, i)
  })

  const somma = (f) => r2(ordini.reduce((s, o) => s + o[f], 0))
  return {
    ok: true,
    giorno,
    ordini,
    totale: somma('totale'),
    imponibile: somma('imponibile'),
    iva: somma('iva'),
    rimborsato: somma('rimborsato'),
    senzaPaeseSpedizione: ordini.filter(o => !o.paeseDaSpedizione).length,
    oltreLaFinestra: false,
    fuso: 'Europe/Rome',
    nota: testo('nota'),
  }
}

// ── Smistatore ───────────────────────────────────────────────────────────────
const cache = new Map()
function registroInMemoria(mese, ctx) {
  const chiave = `${periodoDelMese(mese).mese}|${lingua()}|${new Date().toISOString().slice(0, 13)}`
  if (!cache.has(chiave)) {
    if (cache.size > 24) cache.clear()
    cache.set(chiave, registro(mese, ctx))
  }
  return cache.get(chiave)
}

const leggiParam = (search, k) => (search && typeof search.get === 'function' ? search.get(k) : null)

export function demoCorrispettivi(p, search, method = 'GET', ctx = {}) {
  if (p === '/api/corrispettivi') {
    const { _righe, ...pubblico } = registroInMemoria(leggiParam(search, 'mese') || '', ctx)
    return pubblico
  }
  if (p === '/api/corrispettivi/giorno') {
    return ordiniDelGiorno(String(leggiParam(search, 'giorno') || '').slice(0, 10), ctx)
  }
  if (p === '/api/corrispettivi/export') {
    return { ok: false, demo: true, error: testo('export') }
  }
  return undefined
}
