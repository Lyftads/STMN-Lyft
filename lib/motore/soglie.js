// ============================================================================
//  Soglie di decisione — una PER SEGMENTO, non una per tutti.
//
//  Marino ha calibrato la scala 3,50 / 2,90 / 2,30 sul dato blended. Ma i dati
//  reali di Saracino mostrano che i segmenti vivono su piani diversi:
//    new 2,78 · engaged 5,10 · returning 6,61   (account 3,72)
//  Applicare 3,50 a tutti spegnerebbe quasi tutta l'acquisizione e terrebbe il
//  retargeting, che ha ROAS alto perché ricicla clienti già comprati: i numeri
//  migliorano per qualche settimana e poi il funnel si prosciuga.
//
//  Quindi la scala si ANCORA alla base del segmento: le stesse distanze
//  relative volute da Marino, riferite al livello su cui quel pubblico gira.
//
//  Spesa SENZA segmento (Advantage+/TROAS/MaxValue: Meta non restituisce
//  user_segment_key) → si usa la soglia di returning/engaged. È la scelta
//  conservativa: quelle campagne pescano in prevalenza pubblico caldo.
// ============================================================================

export const SCALA_BASE = { scala: 3.5, standby: 2.9, eccezioni: 2.3 }

// Segmenti trattati come "caldi": condividono la soglia più alta.
export const CALDI = ['returning', 'engaged']

// Soglie del segmento = scala base × (base del segmento ÷ base dell'account).
export function soglieSegmento(baseSegmento, baseAccount) {
  if (!baseSegmento || !baseAccount) return { ...SCALA_BASE, ancorata: false }
  const k = baseSegmento / baseAccount
  return {
    scala:     +(SCALA_BASE.scala * k).toFixed(2),
    standby:   +(SCALA_BASE.standby * k).toFixed(2),
    eccezioni: +(SCALA_BASE.eccezioni * k).toFixed(2),
    ancorata: true,
  }
}

// A quale soglia risponde una creatività, dato il suo pubblico dominante.
// 'mixed' e sconosciuto ricadono sulla soglia dei caldi (conservativa).
export function segmentoDiRiferimento(audienceType) {
  if (audienceType === 'new') return 'new'
  if (CALDI.includes(audienceType)) return 'caldi'
  return 'caldi'
}

export function fascia(roas, soglie) {
  if (roas >= soglie.scala)     return { key: 'scala',     label: 'SCALA',    cls: 'b-scale' }
  if (roas >= soglie.standby)   return { key: 'standby',   label: 'STAND BY', cls: 'b-hold' }
  if (roas >= soglie.eccezioni) return { key: 'eccezioni', label: 'ECCEZIONI',cls: 'b-exc' }
  return { key: 'kill', label: 'SPEGNI', cls: 'b-kill' }
}

// ============================================================================
//  Creatività a pubblico MISTO — perché non basta la soglia dei caldi.
//
//  'mixed' non vuol dire "caldo": vuol dire che Meta HA restituito il
//  breakdown e dentro c'erano entrambi. Farlo ricadere sulla soglia del
//  retargeting penalizzava sistematicamente le inserzioni che acquisiscono —
//  su Saracino sono 56 creatività su 134, il 42% dell'account.
//
//  Il difetto vero però non era la soglia: era giudicare il numero FUSO invece
//  delle sue parti. Un 4,29 può essere metà spesa su pubblico nuovo a 1,32 con
//  due acquisti caldi a ROAS 27 che reggono la media: sembra buono e non
//  acquisisce. Quindi si giudica la QUOTA SU PUBBLICO NUOVO, che è la parte che
//  dice se l'inserzione porta clienti.
// ============================================================================

export const QUOTA_NUOVO_MINIMA   = 0.25  // sotto, di fatto lavora sul caldo
export const ACQUISTI_MINIMI_NUOVO = 3    // sotto, il ROAS della metà nuova è rumore

// mix = { new:{spend,value,purchases}, caldo:{...} } aggregato per creatività.
// Ritorna la fascia più il perché, che va mostrato: un verdetto che cambia il
// budget senza dire su quale numero si regge non è verificabile.
export function fasciaMista(mix, roasFuso, soglieNew, soglieCaldi) {
  const sN = mix.new.spend, sC = mix.caldo.spend, tot = sN + sC
  const quota = tot ? sN / tot : 0

  // Quasi tutta la spesa sul caldo: è un'inserzione di retargeting, e la
  // soglia del retargeting è quella giusta.
  if (quota < QUOTA_NUOVO_MINIMA) {
    return { ...fascia(roasFuso, soglieCaldi), base: 'caldi',
      perche: `il ${Math.round(quota * 100)}% della spesa è su pubblico nuovo: di fatto lavora sul caldo` }
  }

  // Sappiamo il mix ma la metà nuova ha troppo pochi acquisti per essere
  // letta: si usa una soglia PESATA sul mix reale. È l'unica cosa onesta —
  // né la soglia del nuovo né quella del caldo descrivono questa inserzione.
  const pesata = {
    scala:     +(soglieNew.scala     * quota + soglieCaldi.scala     * (1 - quota)).toFixed(2),
    standby:   +(soglieNew.standby   * quota + soglieCaldi.standby   * (1 - quota)).toFixed(2),
    eccezioni: +(soglieNew.eccezioni * quota + soglieCaldi.eccezioni * (1 - quota)).toFixed(2),
  }
  if (mix.new.purchases < ACQUISTI_MINIMI_NUOVO) {
    const f = fascia(roasFuso, pesata)
    // NON si scala su prove che non si possono leggere. Scalare vuol dire
    // versarci sopra budget, e qui non sappiamo se l'inserzione acquisisce: il
    // totale può essere retto da due acquisti caldi su spiccioli di spesa.
    // Verso il basso invece la soglia pesata vale: se non paga nemmeno fusa,
    // non c'è mezza metrica che la salvi.
    if (f.key === 'scala') {
      return { key:'standby', label:'STAND BY', cls:'b-hold', base:'pesata',
        perche: `il totale ${roasFuso.toFixed(2)} regge, ma con ${mix.new.purchases} acquisti sulla quota nuova non si sa se acquisisce: non si scala al buio` }
    }
    return { ...f, base: 'pesata',
      perche: `${mix.new.purchases} acquisti sulla quota nuova: troppo pochi per leggerla, giudicata sulla soglia pesata ${pesata.scala}` }
  }

  // Il caso pieno: si giudica la quota nuova sulla soglia del nuovo.
  const roasNuovo = sN ? mix.new.value / sN : 0
  const f = fascia(roasNuovo, soglieNew)
  // Un'inserzione che non acquisisce ma che nel complesso sta ancora pagando
  // si FERMA, non si spegne: spegnerla butterebbe via anche la parte che rende.
  if (f.key === 'kill' && roasFuso >= pesata.standby) {
    return { key:'standby', label:'STAND BY', cls:'b-hold', base:'nuovo',
      perche: `ROAS ${roasNuovo.toFixed(2)} sul pubblico nuovo (soglia ${soglieNew.scala}): non acquisisce, ma il totale ${roasFuso.toFixed(2)} paga ancora` }
  }
  return { ...f, base: 'nuovo',
    perche: `ROAS ${roasNuovo.toFixed(2)} sul ${Math.round(quota * 100)}% di spesa su pubblico nuovo, contro la soglia ${soglieNew.scala}` }
}

// ============================================================================
//  Non si spegne niente che non abbia speso abbastanza da poter fallire.
//
//  Regola del cliente (1 set 2026): prima di spegnere si guarda anche la SPESA,
//  e la creativita' deve aver speso almeno DUE volte il costo di un ordine.
//
//  Il perche' e' statistico: sotto quella soglia un ROAS basso non distingue
//  una creativita' brutta da una che semplicemente non ha ancora avuto la sua
//  occasione. Con un CPA di 25 euro, una creativita' che ne ha spesi 30 senza
//  ordini ha fatto poco piu' di un tentativo: spegnerla e' tirare una monetina.
//  A 50 ne ha fatti due, e due tentativi a vuoto iniziano a essere un fatto.
//
//  Il riferimento e' il costo per ordine dell'ACCOUNT, lo stesso su cui gia'
//  si misura la spesa a vuoto: usarne due diversi vorrebbe dire due verita' nel
//  medesimo cruscotto.
// ============================================================================
export const SPESA_MINIMA_KILL = 2   // volte il costo di un ordine

// Senza un CPA di riferimento (account senza ordini) la regola non si puo'
// applicare: non si inventa una soglia, si lascia passare il giudizio.
export function spesaSufficientePerSpegnere(spesa, cpa) {
  return !(cpa > 0) || (spesa || 0) >= SPESA_MINIMA_KILL * cpa
}

// Si applica DOPO il giudizio, non dentro: il verdetto di merito resta quello
// che e', e questa e' la mano che trattiene. Cosi' la ragione per cui non si
// spegne resta leggibile, invece di sparire dentro una soglia.
export function trattieni(f, spesa, cpa) {
  if (f.key !== 'kill' || spesaSufficientePerSpegnere(spesa, cpa)) return f
  const eur = (n) => '€' + Math.round(n || 0).toLocaleString('it-IT')
  return {
    key: 'presto', label: 'TROPPO PRESTO', cls: 'b-none',
    perche: `Il verdetto sarebbe SPEGNI, ma ha speso ${eur(spesa)}: sotto le due volte `
      + `il costo di un ordine (${eur(SPESA_MINIMA_KILL * cpa)}) non ha ancora avuto `
      + `le occasioni per fallire davvero. Si riguarda quando arriva a ${eur(SPESA_MINIMA_KILL * cpa)}.`,
  }
}
