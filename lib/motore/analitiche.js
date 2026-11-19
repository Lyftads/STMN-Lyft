// ============================================================================
//  Le analitiche del mese.
//
//  Tutto quello che sta qui risponde a una domanda sola: dove sono finiti i
//  soldi e cosa ne è tornato. Le medie per asse (angolo, formato, fase,
//  prodotto) contano più delle singole creatività, perché su un account di
//  questa taglia nessuna creatività raggiunge da sola la significatività — ma
//  un angolo su dodici creatività sì.
//
//  Le derivate si RICALCOLANO dopo la somma: CTR, CPC, CPM e ROAS non si
//  sommano, e sommarli è il modo più rapido di ottenere numeri plausibili e
//  sbagliati.
// ============================================================================

export function vuoto() {
  return { spesa: 0, impressioni: 0, click: 0, acquisti: 0, valore: 0, n: 0 }
}

export function accumula(a, k) {
  a.spesa += +k.spend || 0
  a.impressioni += +k.impressions || 0
  a.click += +k.link_clicks || 0
  a.acquisti += +k.purchases || 0
  a.valore += +k.purchase_value || 0
  return a
}

export function derivate(a, spesaTotale = 0) {
  return {
    ...a,
    roas: a.spesa ? a.valore / a.spesa : 0,
    cpa:  a.acquisti ? a.spesa / a.acquisti : null,
    ctr:  a.impressioni ? (a.click / a.impressioni) * 100 : 0,
    cpc:  a.click ? a.spesa / a.click : null,
    cpm:  a.impressioni ? (a.spesa / a.impressioni) * 1000 : 0,
    quota: spesaTotale ? a.spesa / spesaTotale : 0,
  }
}

// Raggruppa i KPI per una chiave qualsiasi presa dalla creatività.
export function perAsse(kpi, perCreativa, chiave) {
  const g = new Map()
  for (const k of kpi) {
    const c = perCreativa.get(k.creative_id); if (!c) continue
    const v = chiave(c); if (!v) continue
    if (!g.has(v)) g.set(v, { chiave: v, ...vuoto(), creativita: new Set() })
    const a = g.get(v); accumula(a, k); a.creativita.add(k.creative_id)
  }
  const tot = [...g.values()].reduce((s, a) => s + a.spesa, 0)
  return [...g.values()]
    .map(a => ({ ...derivate(a, tot), n: a.creativita.size, creativita: undefined }))
    .sort((x, y) => y.spesa - x.spesa)
}

// ---------------------------------------------------------------------------
//  Gli insight. Sono REGOLE, non un modello: devono essere sempre gli stessi a
//  parità di dati, verificabili e discutibili. Un consiglio che cambia a ogni
//  richiesta non è un consiglio.
// ---------------------------------------------------------------------------
const eur = (n) => '€' + Math.round(n || 0).toLocaleString('it-IT')
const pc  = (n) => Math.round((n || 0) * 100) + '%'

export function insight({ angoli, funnel, prodotti, ciclo, account, righe }) {
  const out = []
  const roasMedio = account.roas || 0

  // 1) angoli che rendono sopra la media ma ricevono poco
  for (const a of angoli) {
    if (a.acquisti < 10 || a.roas <= roasMedio * 1.1 || a.quota >= 0.2) continue
    out.push({ tipo: 'occasione', titolo: `L'angolo ${a.chiave} rende ${a.roas.toFixed(2)} ma assorbe il ${pc(a.quota)}`,
      testo: `Contro una media di ${roasMedio.toFixed(2)} su ${a.acquisti} acquisti. Vale produrne di più.` })
  }
  // 2) angoli che assorbono molto e rendono poco
  for (const a of angoli) {
    if (a.quota < 0.15 || a.roas >= roasMedio * 0.9) continue
    out.push({ tipo: 'allarme', titolo: `${a.chiave} assorbe il ${pc(a.quota)} della spesa con ROAS ${a.roas.toFixed(2)}`,
      testo: `Sotto la media di ${roasMedio.toFixed(2)}. Sono ${eur(a.spesa)}: il primo posto dove tagliare.` })
  }
  // 3) fase di funnel scoperta
  const totF = funnel.reduce((s, f) => s + f.spesa, 0)
  for (const f of funnel) {
    if (f.quota >= 0.12 || !totF) continue
    out.push({ tipo: 'buco', titolo: `${f.chiave} riceve solo il ${pc(f.quota)} della spesa`,
      testo: `Il funnel è scoperto in questa fase: chi ci passa non trova niente.` })
  }
  // 4) concentrazione su un solo prodotto
  const p0 = prodotti[0]
  if (p0 && p0.quota > 0.6) {
    out.push({ tipo: 'rischio', titolo: `Il ${pc(p0.quota)} della spesa è su un solo prodotto`,
      testo: `${p0.chiave}. Una concentrazione così rende l'account fragile: un problema su quel prodotto ferma tutto.` })
  }
  // 5) prodotte e mai lanciate
  if (ciclo.prodotte && ciclo.daLanciare / ciclo.prodotte > 0.4) {
    out.push({ tipo: 'todo', titolo: `${ciclo.daLanciare} creatività prodotte e mai lanciate`,
      testo: `Sono il ${pc(ciclo.daLanciare / ciclo.prodotte)} di quelle prodotte. Produrre senza caricare non cambia i numeri.` })
  }
  // 6) spesa su creatività da spegnere
  const daSpegnere = righe.filter(r => r.bandaLabel === 'SPEGNI')
  const spesaKill = daSpegnere.reduce((s, r) => s + (r.spend || 0), 0)
  if (account.spesa && spesaKill / account.spesa > 0.05) {
    out.push({ tipo: 'todo', titolo: `${eur(spesaKill)} su creatività da spegnere`,
      testo: `${daSpegnere.length} creatività sotto la soglia del loro pubblico: è il ${pc(spesaKill / account.spesa)} della spesa.` })
  }
  // 7) creatività senza verdetto ma con spesa
  const senza = righe.filter(r => !r.giudizio && (r.spend || 0) > (account.cpo || 0) * 3)
  if (senza.length >= 5) {
    out.push({ tipo: 'todo', titolo: `${senza.length} creatività con spesa e senza verdetto`,
      testo: `Hanno speso più di tre volte il costo di un ordine e nessuno ha ancora detto se tenerle.` })
  }
  return out
}

// ============================================================================
//  Lo spaccato per pubblico su un asse (angolo, prodotto, funnel...).
//
//  Serve a leggere un ROAS per quello che e'. Un angolo che gira quasi tutto
//  sul returning avra' sempre numeri belli, perche' quella gente sarebbe
//  tornata comunque: il ROAS medio dice quanto ha raccolto, non quanto sa
//  acquisire. Due angoli con lo stesso ROAS ma quote di pubblico nuovo diverse
//  non sono la stessa cosa, e sommandoli sembrano identici.
// ============================================================================
export const PUBBLICI = ['new', 'engaged', 'returning', 'unknown']

export function pubbliciPerAsse(segRows, perCreativa, chiave) {
  const g = new Map()
  for (const s of segRows || []) {
    const c = perCreativa.get(s.creative_id); if (!c) continue
    const v = chiave(c); if (!v) continue
    if (!g.has(v)) g.set(v, Object.fromEntries(PUBBLICI.map(k => [k, { spesa: 0, valore: 0, ordini: 0 }])))
    const p = g.get(v)[s.segment]; if (!p) continue
    p.spesa += +s.spend || 0; p.valore += +s.purchase_value || 0; p.ordini += +s.purchases || 0
  }
  const out = new Map()
  for (const [v, p] of g) {
    const tot = PUBBLICI.reduce((n, k) => n + p[k].spesa, 0)
    if (!tot) continue
    out.set(v, Object.fromEntries(PUBBLICI
      .filter(k => p[k].spesa > 0 || p[k].ordini > 0)
      .map(k => [k, {
        ...p[k],
        roas: p[k].spesa ? p[k].valore / p[k].spesa : 0,
        cpo: p[k].ordini ? p[k].spesa / p[k].ordini : 0,
        quota: p[k].spesa / tot,
      }])))
  }
  return out
}
