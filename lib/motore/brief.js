import { NOMI_FORMATI, FORMATI } from './formati'

// ============================================================================
//  Generatore di BRIEF — decide COSA produrre, partendo dai numeri.
//
//  Nessun brief nasce da un'intuizione: ognuno è la conseguenza di qualcosa di
//  misurato sull'account, e porta con sé il perché con i numeri dentro.
//  Se il dato non basta, il brief NON viene emesso: si dichiara l'ignoto.
// ============================================================================

// Soglie di evidenza. Sotto i 25 acquisti un ROAS non è una prova: è un indizio.
const ACQ_AFFIDABILE = 25
const ACQ_DEBOLE = 8

export function evidenza(acquisti) {
  if (acquisti >= ACQ_AFFIDABILE) return 'affidabile'
  if (acquisti >= ACQ_DEBOLE) return 'debole'
  return 'insufficiente'
}

// Aggrega la spesa per un asse qualsiasi (angolo, formato, funnel, persona).
export function perAsse(creativita, kpi, chiave) {
  const byId = new Map(creativita.map(c => [c.id, c]))
  const g = {}
  for (const k of kpi) {
    const c = byId.get(k.creative_id); if (!c) continue
    const v = chiave(c); if (!v) continue
    const a = g[v] || (g[v] = { spesa: 0, acquisti: 0, valore: 0, creativita: new Set() })
    a.spesa += +k.spend || 0; a.acquisti += +k.purchases || 0; a.valore += +k.purchase_value || 0
    a.creativita.add(c.id)
  }
  for (const v of Object.values(g)) {
    v.roas = v.spesa ? v.valore / v.spesa : 0
    v.n = v.creativita.size
    v.evidenza = evidenza(v.acquisti)
    delete v.creativita
  }
  return g
}

const ordina = (g) => Object.entries(g).sort((a, b) => b[1].spesa - a[1].spesa)
const quota = (g, tot) => tot ? g.spesa / tot : 0

// ---------------------------------------------------------------------------
//  Le cinque ragioni per cui vale la pena produrre qualcosa.
//  Ognuna guarda un buco diverso: senza, si finisce a rifare ciò che già va.
// ---------------------------------------------------------------------------
// Soglia di rinnovo sulla frequenza. La letteratura mette la stanchezza a 3;
// qui si parte a 2,5 perché fra il brief e la creatività pronta passa almeno
// un giorno, e a 3 si è già in ritardo.
export const FREQ_RINNOVO = 2.5

export function generaBrief({ creativita, kpi, prodotti = [], brand = null, maxBrief = 12, temi = [] }) {
  // Vietati davvero: non si producono mai.
  const esclusi = new Set(brand?.formati_esclusi || [])
  // Sospetti ma non dimostrati: si producono, con una quota piccola. Un formato
  // "fuori posizionamento" è un'ipotesi finché non lo si è misurato — e la
  // quota bassa è il modo di verificarla senza rischiare il brand.
  const sperimentali = new Set(brand?.formati_sperimentali || [])
  const quotaSper = brand?.quota_sperimentale ?? 0.05
  const angoli  = perAsse(creativita, kpi, c => c.angolo)
  const formati = perAsse(creativita, kpi, c => c.format)
  const funnel  = perAsse(creativita, kpi, c => c.funnel)
  const persone = perAsse(creativita, kpi, c => c.persona)
  const spesaTot = Object.values(angoli).reduce((s, a) => s + a.spesa, 0)
  const roasMedio = spesaTot
    ? Object.values(angoli).reduce((s, a) => s + a.valore, 0) / spesaTot : 0

  const brief = []
  // Tetto sui brief sperimentali: almeno 1 se la quota lo consente, mai più
  // della percentuale fissata. Serve a garantire che si testi qualcosa, senza
  // che l'esplorazione si mangi la produzione che porta risultati.
  const maxSper = Math.max(1, Math.round(maxBrief * quotaSper))
  let nSper = 0
  const agg = (b) => {
    if (b.formato && esclusi.has(b.formato)) return
    if (b.formato && sperimentali.has(b.formato)) {
      if (nSper >= maxSper) return
      nSper++
      b.sperimentale = true
      b.quotaBudget = quotaSper
      b.motivo += ` Formato sperimentale per questo brand: si testa con una quota massima del ${(quotaSper * 100).toFixed(0)}% del budget, per capire se l'ipotesi che non funzioni regge davvero.`
    }
    if (brief.length < maxBrief) brief.push(b)
  }

  // 1) AMPLIFICA — rende sopra la media ma prende poca spesa.
  //    È la riallocazione più ovvia e la più spesso ignorata.
  for (const [nome, a] of ordina(angoli)) {
    if (a.evidenza !== 'affidabile') continue
    if (a.roas > roasMedio * 1.08 && quota(a, spesaTot) < 0.22) {
      agg({ tipo: 'amplifica', angolo: nome, priorita: (a.roas / roasMedio) * (1 - quota(a, spesaTot)),
        motivo: `ROAS ${a.roas.toFixed(2)} contro una media di ${roasMedio.toFixed(2)}, ma assorbe solo il ${(quota(a, spesaTot) * 100).toFixed(1)}% della spesa su ${a.acquisti} acquisti. C'è margine per produrne di più.` })
    }
  }

  // 1-bis) RINNOVA — la creatività che VINCE ma si sta consumando.
  //
  //   La frequenza è l'unico indicatore ANTICIPATO che abbiamo: dice che lo
  //   stesso pubblico sta rivedendo la stessa immagine, e il calo di
  //   rendimento arriva dopo, non insieme. Aspettare che il ROAS scenda
  //   significa accorgersene quando i soldi sono già stati spesi male.
  //
  //   Si interviene a 2,5 e non a 3 perché produrre una variante richiede
  //   almeno un giorno: a 3 la stanchezza morde già, e si arriva tardi.
  for (const c of creativita) {
    const f = +c.frequenza || 0
    if (f < FREQ_RINNOVO) continue
    const suo = kpi.filter(k => k.creative_id === c.id)
    const sp = suo.reduce((t, k) => t + (+k.spend || 0), 0)
    const val = suo.reduce((t, k) => t + (+k.purchase_value || 0), 0)
    const acq = suo.reduce((t, k) => t + (+k.purchases || 0), 0)
    const roas = sp ? val / sp : 0
    // Solo su quelle che rendono: rinnovare una creatività che non funziona
    // non è rinnovare, è insistere.
    if (roas < roasMedio || acq < 3) continue
    agg({ tipo: 'rinnova', angolo: c.angolo, formato: c.format, funnel: c.funnel,
      persona: c.persona, priorita: 1.5 + (f - FREQ_RINNOVO),
      motivo: `Frequenza ${f.toFixed(2)} con ROAS ${roas.toFixed(2)} su ${Math.round(acq)} acquisti: `
        + `sta ancora rendendo ma lo stesso pubblico l'ha già vista troppe volte. `
        + `Una variante ora arriva prima del calo, non dopo.` })
  }

  // 1-ter) DALLE RECENSIONI — quello che i clienti dicono e che nessuna
  //   creatività dice.
  //
  //   È la ragione più forte fra tutte, ed è per questo che sta in cima: un
  //   tema ripetuto in decine di recensioni è un angolo GIÀ validato dal
  //   mercato, non un'ipotesi da testare. Gli altri brief moltiplicano quello
  //   che già facciamo; questo porta dentro qualcosa che non stiamo dicendo.
  //
  //   I temi negativi non arrivano qui: un problema non è un angolo, e
  //   promettere ciò su cui si sta sbagliando peggiora le cose.
  // Al massimo DUE per tornata. Senza tetto le recensioni prendevano otto
  // brief su dodici e soffocavano le altre ragioni: portare dentro un angolo
  // nuovo è prezioso, riempire tutta la produzione con angoli mai testati è
  // un'altra cosa.
  const daRecensioni = [...temi]
    .filter(t => t.angolo && t.sentiment !== 'negativo' && !t.coperto_da)
    .filter(t => (t.quota || 0) >= 0.05)
    .sort((a, b) => (b.n || 0) - (a.n || 0))
    .slice(0, 2)
  for (const t of daRecensioni) {
    if (angoli[t.angolo]) continue                       // già in produzione
    const quota = Math.round((t.quota || 0) * 100)
    agg({ tipo: 'dalle-recensioni', angolo: t.angolo, priorita: 2 + (t.quota || 0) * 2,
      motivo: `Il ${quota}% delle recensioni parla di questo (${t.n} su ${t.totale || '?'}) e nessuna creatività lo dice. `
        + `Un cliente lo mette così: «${t.citazione}».` })
  }

  // 2) TRASPONI — l'angolo che funziona, in un formato che per quell'angolo
  //    non è mai stato provato. È il cuore del sistema: si moltiplica il
  //    MESSAGGIO, non l'immagine.
  const combo = new Set(creativita.filter(c => c.angolo && c.format).map(c => `${c.angolo}|${c.format}`))
  const formatiBuoni = ordina(formati)
    .filter(([, f]) => f.evidenza === 'affidabile' && f.roas >= roasMedio).map(([n]) => n)
  for (const [nome, a] of ordina(angoli)) {
    if (a.evidenza !== 'affidabile' || a.roas < roasMedio) continue
    for (const f of formatiBuoni) {
      if (combo.has(`${nome}|${f}`)) continue
      agg({ tipo: 'trasponi', angolo: nome, formato: f, priorita: a.roas / roasMedio,
        motivo: `L'angolo ${nome} regge (ROAS ${a.roas.toFixed(2)} su ${a.acquisti} acquisti) ma non è mai stato provato in formato ${f}, che sull'account rende ${formati[f].roas.toFixed(2)}.` })
      break   // un formato nuovo alla volta per angolo: non si satura tutto insieme
    }
  }

  // 3) COPRI IL BUCO — la fase di funnel scoperta.
  const totFunnel = Object.values(funnel).reduce((s, f) => s + f.spesa, 0)
  for (const [nome, f] of Object.entries(funnel)) {
    if (quota(f, totFunnel) >= 0.22) continue
    const formatiFase = FORMATI.filter(x => x[1].includes(nome.replace('TOFU','TOF').replace('MOFU','MOF').replace('BOFU','BOF')))
    const scelto = formatiFase.find(x => !formati[x[0]] || formati[x[0]].evidenza !== 'affidabile') || formatiFase[0]
    if (!scelto) continue
    agg({ tipo: 'copri-funnel', funnel: nome, formato: scelto[0], priorita: 1.4,
      motivo: `${nome} riceve solo il ${(quota(f, totFunnel) * 100).toFixed(1)}% della spesa: il funnel è scoperto in mezzo. ${scelto[0]} è un formato nativo di questa fase e qui non è presidiato.` })
  }

  // 4) ESPLORA — mai testato davvero. Non è "cattivo": è ignoto, e la
  //    differenza conta perché uno si scarta e l'altro si prova.
  for (const f of NOMI_FORMATI) {
    const d = formati[f]
    if (d && d.evidenza !== 'insufficiente') continue
    agg({ tipo: 'esplora', formato: f, priorita: 0.75,
      motivo: d
        ? `${f} ha solo ${d.acquisti} acquisti su €${d.spesa.toFixed(0)}: non è stato bocciato, non è stato provato.`
        : `${f} non è mai stato usato su questo account.` })
  }

  // 5) PERSONA SOTTO-SFRUTTATA — rende più della dominante ma quasi non riceve spesa.
  const totP = Object.values(persone).reduce((s, p) => s + p.spesa, 0)
  const dominante = ordina(persone)[0]
  for (const [nome, p] of ordina(persone)) {
    if (nome === dominante?.[0] || p.evidenza === 'insufficiente') continue
    if (p.roas > (dominante?.[1]?.roas || 0) * 1.05 && quota(p, totP) < 0.2) {
      agg({ tipo: 'persona', persona: nome, priorita: p.roas / (dominante[1].roas || 1),
        motivo: `${nome} rende ${p.roas.toFixed(2)} contro ${dominante[1].roas.toFixed(2)} di ${dominante[0]}, che però assorbe il ${(quota(dominante[1], totP) * 100).toFixed(0)}% della spesa. Vale parlarle di più.` })
    }
  }

  return {
    contesto: { spesaTot, roasMedio, angoli, formati, funnel, persone,
      vincoli: brand ? { esclusi: [...esclusi], sperimentali: [...sperimentali],
        quotaSperimentale: quotaSper, vietati: brand.termini_vietati || [] } : null },
    brief: brief.sort((a, b) => b.priorita - a.priorita),
  }
}

// Nomenclatura: CLIENTE_PRODOTTO_FORMATO_ANGOLO_PERSONA_RATIO_Vn
//
// Il pezzo PRODOTTO deve dire quale prodotto è, per esteso. Lo slug ricavato
// dal titolo Shopify non lo diceva: quattro prodotti diversi uscivano come
// "10-LITRI-OLIO", "10-LITRI-OLIO-2", "10-LITRI-OLIO-3" e "10-LITRI-1", e dal
// nome del file era impossibile capire quale fosse. Il nome breve lo detta il
// cliente (ce_products.nome_breve), non un troncamento automatico.
export function siglaProdotto(prodotto) {
  const breve = prodotto?.nome_breve || prodotto?.name || prodotto?.slug
  return pezzo(breve)
}

// Un pezzo del nome e' UNA parola: dentro non ci vanno separatori. L'underscore
// separa i pezzi, e se comparisse anche dentro non si capirebbe piu' dove
// finisce il prodotto e dove comincia l'angolo — con i trattini in mezzo il
// nome diventava una fila di parole tutte uguali a distanza d'occhio.
const pezzo = (x) => String(x || '').toUpperCase().replace(/[^A-Z0-9]+/g, '')

// SAR_2BAGINBOXDA5LITRIANGELINO_ORIGINE_GOURMET_9x16_V3
//
// Il FORMATO visivo non c'e': non serviva a chi legge il nome — l'angolo e il
// prodotto dicono gia' di cosa si tratta — e allungava ogni riga di un pezzo
// che nessuno guardava.
// L'ANGOLO invece c'e' sempre: e' la cosa su cui si decide, e senza si finiva
// col numero della cartella d'origine al suo posto.
export function nomina({ cliente, prodotto, angolo, persona, ratio, versione = 1 }) {
  return [
    pezzo(cliente) || 'NA',
    pezzo(prodotto) || 'NA',
    pezzo(angolo) || 'SENZAANGOLO',
    pezzo(persona),           // manca su parecchie importate: si omette, non si scrive NA
    ratio,
    `V${versione}`,
  ].filter(Boolean).join('_')
}
