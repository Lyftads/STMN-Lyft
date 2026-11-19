// ============================================================================
//  L'incrocio: la griglia fra due assi qualsiasi (angolo, formato, persona,
//  fase, prodotto), letta su un pubblico alla volta.
//
//  Un conto tende a spendere dove il pixel e' gia' a suo agio, non dove il costo
//  per ordine e' piu' basso: dieci varianti di un vincitore comprano dieci volte
//  le stesse persone, un angolo gia' dimostrato in un formato mai provato compra
//  gente nuova — ed e' il test piu' economico che esista, il messaggio converte
//  gia'. La griglia serve a vedere i BUCHI, che e' l'unica cosa che una
//  classifica ordinata per spesa non mostrera' mai.
//
//  Quattro stati per cella, e tenerli distinti e' tutto il punto:
//    - vuota     : mai provata, e' un'occasione e non un risultato
//    - magazzino : ha creativita' ma nessuna spesa nel periodo (pronte o vecchie)
//    - provata   : ha speso, non abbastanza per dire niente
//    - leggibile : qui il costo per ordine significa qualcosa
//  Colorare una cella da nove euro di spesa come se fosse un successo e' il modo
//  piu' rapido di mandare il budget dietro al rumore.
//
//  Sopra gli stati, due giudizi:
//    - FAI DI PIU' : leggibile e con costo per ordine vicino o sotto quello del
//                    conto SULLO STESSO PUBBLICO (il returning ha ROAS alto per
//                    costruzione: giudicare il nuovo col metro del totale spegne
//                    l'acquisizione mentre i numeri migliorano)
//    - PROVA       : mai provata, ma con un vincitore nella sua riga E uno nella
//                    sua colonna. "Riempi in orizzontale prima che in verticale".
//
//  NOTA DI IMPLEMENTAZIONE: la mappa delle celle e' annidata (riga -> colonna) e
//  non indicizzata da una chiave composta. Una versione precedente univa i due
//  nomi in una stringa e la rispezzava con uno split: il separatore scritto nel
//  file era finito byte NUL invece che spazio, lo split non separava piu' niente
//  e ogni cella risultava vuota. I conteggi restavano plausibili, quindi il
//  difetto non si vedeva. Senza chiave composta il problema non puo' tornare.
// ============================================================================

export const ASSI = {
  angolo:   { et: 'Angolo',   plurale: 'angoli',   di: c => c.angolo },
  formato:  { et: 'Formato',  plurale: 'formati',  di: c => c.format },
  persona:  { et: 'Persona',  plurale: 'persone',  di: c => c.persona },
  funnel:   { et: 'Fase',     plurale: 'fasi',     di: c => c.funnel },
  prodotto: { et: 'Prodotto', plurale: 'prodotti', di: c => c.prodotto },
}
export const PUBBLICI = ['tutti', 'new', 'engaged', 'returning']

// Quanto serve perche' il CPA di una cella regga il peso di una decisione: sei
// occasioni di comprare e almeno tre ordini davvero arrivati. Ancorato al CPA
// del conto (sul pubblico scelto), cosi' la soglia si muove col conto invece di
// restare un numero scritto a mano.
export const OCCASIONI_MINIME = 6
export const ORDINI_MINIMI = 3
// "Vicino o sopra il conto": un costo per ordine fino al 10% sopra la media
// e' ancora un posto dove insistere, non uno da abbandonare.
export const TOLLERANZA = 1.1
// Una riga (o colonna) che nel periodo non arriva alla soglia di lettura ne'
// all'1% della spesa e' rumore di nomenclatura (SMARTSHOPPER accanto a
// SMART-SHOPPER, CUOCO e CUOCHI...), non un asse: va contata, non mostrata.
// Resta in tabella solo se ha almeno tre creativita' PRONTE e mai lanciate,
// perche' quello e' un buco con il materiale gia' in magazzino.
export const MINIMO_PER_ASSE = 3
export const QUOTA_MINIMA_ASSE = 0.01
// Stati di una creativita' che non e' MAI andata in onda.
const MAI_LANCIATA = new Set(['draft', 'queued'])

const nuovo = () => ({ spesa: 0, impressioni: 0, click: 0, ordini: 0, valore: 0, con: new Set(), tutte: new Set(), pronte: 0 })

function somma(v, k) {
  v.spesa += +k.spend || 0
  v.impressioni += +k.impressions || 0
  v.click += +k.link_clicks || 0
  v.ordini += +k.purchases || 0
  v.valore += +k.purchase_value || 0
  v.con.add(k.creative_id)
}

// Le derivate si RICALCOLANO dopo la somma: CTR, CPC, CPM e ROAS non si
// sommano, e sommarli e' il modo piu' rapido di ottenere numeri plausibili e
// sbagliati.
function chiudi(v, totale, soglia, rif) {
  const n = v.tutte.size
  const cpa = v.ordini ? v.spesa / v.ordini : null
  const leggibile = v.spesa >= soglia && v.ordini >= ORDINI_MINIMI
  const stato = n === 0 ? 'vuota' : v.spesa <= 0 ? 'magazzino' : leggibile ? 'leggibile' : 'provata'
  return {
    n, nSpese: v.con.size, pronte: v.pronte, maiLanciata: n > 0 && v.pronte === n,
    spesa: v.spesa, impressioni: v.impressioni, click: v.click, ordini: v.ordini, valore: v.valore,
    roas: v.spesa ? v.valore / v.spesa : 0,
    cpa,
    ctr: v.impressioni ? (v.click / v.impressioni) * 100 : 0,
    cpc: v.click ? v.spesa / v.click : null,
    cpm: v.impressioni ? (v.spesa / v.impressioni) * 1000 : 0,
    quota: totale ? v.spesa / totale : 0,
    leggibile, stato,
    faiDiPiu: leggibile && cpa != null && rif.cpa > 0 && cpa <= rif.cpa * TOLLERANZA,
    creativita: [...v.tutte],
  }
}

// `kpi`: righe giornaliere (ce_kpi_daily o ce_kpi_segment_daily di UN segmento).
// `rif`: il conto del conto sullo stesso pubblico { cpa, roas, spesa }.
export function incrocio({ kpi, perCreativa, righe = 'angolo', colonne = 'formato', rif }) {
  const R = ASSI[righe], C = ASSI[colonne]
  const soglia = OCCASIONI_MINIME * (rif?.cpa || 0)
  const perRiga = new Map(), perColonna = new Map(), celle = new Map()
  const dentro = (m, k) => { if (!m.has(k)) m.set(k, nuovo()); return m.get(k) }
  const cella = (r, c) => { if (!celle.has(r)) celle.set(r, new Map()); return dentro(celle.get(r), c) }

  for (const k of kpi) {
    const cr = perCreativa.get(k.creative_id); if (!cr) continue
    const r = R.di(cr), c = C.di(cr)
    if (r) somma(dentro(perRiga, r), k)
    if (c) somma(dentro(perColonna, c), k)
    if (r && c) somma(cella(r, c), k)
  }
  // Righe, colonne e celle esistono anche SENZA spesa: l'asse mai spesato e' il
  // caso piu' interessante, e una cella con tre creativita' pronte e mai
  // lanciate non e' vuota — trattarla come tale farebbe riprodurre roba che sta
  // gia' in magazzino.
  const senza = { righe: 0, colonne: 0 }
  for (const cr of perCreativa.values()) {
    const r = R.di(cr), c = C.di(cr)
    if (!r) senza.righe++
    if (!c) senza.colonne++
    const pronta = MAI_LANCIATA.has(cr.status) ? 1 : 0
    if (r) { const v = dentro(perRiga, r); v.tutte.add(cr.id); v.pronte += pronta }
    if (c) { const v = dentro(perColonna, c); v.tutte.add(cr.id); v.pronte += pronta }
    if (r && c) { const v = cella(r, c); v.tutte.add(cr.id); v.pronte += pronta }
  }

  const totale = [...perRiga.values()].reduce((s, v) => s + v.spesa, 0)
  const mostra = (v) => v.spesa >= soglia || (totale > 0 && v.spesa / totale >= QUOTA_MINIMA_ASSE) || v.pronte >= MINIMO_PER_ASSE
  const ordina = (m) => [...m]
    .map(([chiave, v]) => ({ chiave, ...chiudi(v, totale, soglia, rif) }))
    .sort((a, b) => b.spesa - a.spesa || b.n - a.n)
  const tutteRighe = ordina(perRiga), tutteColonne = ordina(perColonna)
  const rr = tutteRighe.filter(x => mostra(perRiga.get(x.chiave)))
  const cc = tutteColonne.filter(x => mostra(perColonna.get(x.chiave)))
  const minori = {
    righe: tutteRighe.filter(x => !mostra(perRiga.get(x.chiave))).map(x => ({ chiave: x.chiave, n: x.n })),
    colonne: tutteColonne.filter(x => !mostra(perColonna.get(x.chiave))).map(x => ({ chiave: x.chiave, n: x.n })),
  }

  const mappa = {}
  const conto = { possibili: rr.length * cc.length, provate: 0, leggibili: 0, vuote: 0, faiDiPiu: 0, prova: 0 }
  for (const r of rr) {
    mappa[r.chiave] = {}
    for (const c of cc) {
      const v = celle.get(r.chiave)?.get(c.chiave)
      const x = v ? chiudi(v, totale, soglia, rif) : chiudi(nuovo(), totale, soglia, rif)
      x.riga = r.chiave; x.colonna = c.chiave
      mappa[r.chiave][c.chiave] = x
      if (x.stato === 'vuota') conto.vuote++
      if (x.spesa > 0) conto.provate++
      if (x.leggibile) conto.leggibili++
      if (x.faiDiPiu) conto.faiDiPiu++
    }
  }

  // Il vincitore di ogni riga e di ogni colonna: la cella "fai di piu'" che ha
  // speso di piu'. E' lui il vicino che giustifica il test accanto.
  const vincitore = (lista) => lista.filter(x => x.faiDiPiu).sort((a, b) => b.spesa - a.spesa)[0] || null
  const vinceRiga = {}, vinceColonna = {}
  for (const r of rr) vinceRiga[r.chiave] = vincitore(cc.map(c => mappa[r.chiave][c.chiave]))
  for (const c of cc) vinceColonna[c.chiave] = vincitore(rr.map(r => mappa[r.chiave][c.chiave]))

  const faiDiPiu = [], provaPoi = []
  for (const r of rr) for (const c of cc) {
    const x = mappa[r.chiave][c.chiave]
    if (x.faiDiPiu) faiDiPiu.push(x)
    const maiInOnda = x.stato === 'vuota' || x.maiLanciata
    const vr = vinceRiga[r.chiave], vc = vinceColonna[c.chiave]
    if (maiInOnda && vr && vc) {
      // La promessa della coppia e' la media dei ROAS dei due vicini. Non e'
      // una previsione: e' un ordine di priorita' fra i buchi.
      x.prova = {
        accanto: [{ riga: vr.riga, colonna: vr.colonna, roas: vr.roas }, { riga: vc.riga, colonna: vc.colonna, roas: vc.roas }],
        promessa: (vr.roas + vc.roas) / 2,
      }
      conto.prova++
      provaPoi.push(x)
    }
  }
  faiDiPiu.sort((a, b) => b.spesa - a.spesa)
  provaPoi.sort((a, b) => b.prova.promessa - a.prova.promessa)

  const tot = nuovo()
  for (const v of perRiga.values()) { tot.spesa += v.spesa; tot.impressioni += v.impressioni; tot.click += v.click; tot.ordini += v.ordini; tot.valore += v.valore; v.tutte.forEach(id => tot.tutte.add(id)); v.con.forEach(id => tot.con.add(id)) }

  return {
    assi: { righe, colonne, etRighe: R.et, etColonne: C.et, pluraleRighe: R.plurale, pluraleColonne: C.plurale },
    righe: rr, colonne: cc, celle: mappa,
    totale: chiudi(tot, totale, soglia, rif),
    conto, soglia: { spesa: soglia, ordini: ORDINI_MINIMI }, rif, minori, senza,
    liste: {
      faiDiPiu: faiDiPiu.map(x => ({ riga: x.riga, colonna: x.colonna, quota: x.quota, roas: x.roas, cpa: x.cpa, spesa: x.spesa, ordini: x.ordini })),
      provaPoi: provaPoi.slice(0, 8).map(x => ({ riga: x.riga, colonna: x.colonna, accanto: x.prova.accanto, promessa: x.prova.promessa, pronte: x.pronte })),
    },
  }
}

// ---------------------------------------------------------------------------
//  La frase in cima. E' una REGOLA, non un modello: a parita' di dati deve
//  uscire sempre uguale, verificabile e discutibile.
// ---------------------------------------------------------------------------
const num = (n, d = 2) => (n || 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d })
const eur = (n) => '€' + Math.round(n || 0).toLocaleString('it-IT')
const pc = (n) => Math.round((n || 0) * 100) + '%'
const nome = (x) => `${x.riga} × ${x.colonna}`
const elenco = (l) => l.length <= 1 ? l.join('') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]

function fraseProva(g, verbo) {
  const per = new Map()
  for (const p of g.liste.provaPoi) { if (!per.has(p.riga)) per.set(p.riga, []); per.get(p.riga).push(p.colonna) }
  const pezzi = [...per].slice(0, 4).map(([r, cols]) => `${r} ${verbo} ${elenco(cols.slice(0, 3))}`)
  return pezzi.length ? `Prova ${elenco(pezzi)}.` : ''
}

export function frase(g, gFormati = null) {
  const f = g.liste.faiDiPiu
  const parti = []
  if (!f.length) {
    const top = g.righe.length && g.colonne.length
      ? Object.values(g.celle).flatMap(r => Object.values(r)).sort((a, b) => b.spesa - a.spesa)[0] : null
    parti.push(`Nessun incrocio ${g.assi.etRighe.toLowerCase()} × ${g.assi.etColonne.toLowerCase()} ha abbastanza spesa per dire qualcosa: servono ${eur(g.soglia.spesa)} e ${g.soglia.ordini} ordini per cella.`)
    if (top?.spesa > 0) parti.push(`${nome(top)} prende la quota più grande (${pc(top.quota)}) a ROAS ${num(top.roas)}.`)
  } else {
    const [primo, ...altri] = f
    parti.push(`${nome(primo)} guida con il ${pc(primo.quota)} della spesa a ROAS ${num(primo.roas)}.`)
    const seguito = altri.slice(0, 4)
    if (seguito.length === 1) parti.push(`${nome(seguito[0])} rende ${num(seguito[0].roas)}.`)
    else if (seguito.length > 1) {
      const r = seguito.map(x => x.roas)
      parti.push(`${elenco(seguito.map(nome))} rendono fra ${num(Math.min(...r), 1)} e ${num(Math.max(...r), 1)}.`)
    }
    const p = fraseProva(g, 'con')
    parti.push(p || 'Nessun buco accanto ai vincitori.')
  }
  if (gFormati?.liste?.provaPoi?.length) {
    const p = fraseProva(gFormati, 'in')
    if (p) parti.push('Sui formati: ' + p.charAt(0).toLowerCase() + p.slice(1))
  }
  return parti.join(' ')
}
