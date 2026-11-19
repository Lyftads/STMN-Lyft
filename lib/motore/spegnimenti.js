// ============================================================================
//  Cosa succede al CONTO dopo che si spegne una creativita'.
//
//  Serve a rispondere alla domanda che i dati a ultimo clic non sanno
//  rispondere: quella creativita' con il costo per ordine alto stava reggendo le
//  altre? Il modo per saperlo non e' guardare lei, e' guardare il conto prima e
//  dopo averla spenta. E' l'holdout che la base di conoscenza consiglia,
//  applicato alla singola creativita'.
//
//  LA TRAPPOLA, ed e' il motivo per cui questo file esiste invece di due righe
//  di sottrazione. Sul conto Saracino il confronto ingenuo dava questo:
//
//     28 ago, spenta una creativita' che aveva speso ZERO euro
//     -> costo per ordine del conto +25,4%
//
//  Una creativita' che non ha speso niente non puo' aver causato niente. In quei
//  giorni il conto stava passando da 1.100 a 2.100 euro al giorno, e il costo
//  per ordine sale quando si scala. Il prima/dopo, da solo, misura la rampa e la
//  chiama effetto dello spegnimento: numeri veri, conclusione falsa.
//
//  Quindi una lettura vale solo se reggono TRE condizioni, e quando non reggono
//  si dice perche' invece di dare un numero che sembra una risposta.
// ============================================================================

// Quanto deve aver speso, perche' spegnere qualcosa che non spendeva non puo'
// spostare niente.
export const SPESA_MINIMA_LETTURA = 2      // volte il costo per ordine
// Quanto puo' essere cambiato il ritmo del conto fra prima e dopo: oltre, la
// differenza e' della rampa e non dello spegnimento.
export const DERIVA_MASSIMA = 0.15
export const GIORNI_FINESTRA = 7

const giorno = (d) => d.toISOString().slice(0, 10)
const spostaGiorni = (g, n) => giorno(new Date(new Date(g).getTime() + n * 86400000))

export function effettoSpegnimenti({ creativita, kpi, cpaAccount, finestra = GIORNI_FINESTRA }) {
  // Il conto giorno per giorno.
  const perGiorno = new Map()
  const spesaDi = new Map()
  for (const k of kpi || []) {
    const g = perGiorno.get(k.day) || { spesa: 0, ordini: 0, valore: 0 }
    g.spesa += +k.spend || 0; g.ordini += +k.purchases || 0; g.valore += +k.purchase_value || 0
    perGiorno.set(k.day, g)
    spesaDi.set(k.creative_id, (spesaDi.get(k.creative_id) || 0) + (+k.spend || 0))
  }
  const giorniNoti = [...perGiorno.keys()].sort()
  if (!giorniNoti.length) return { letture: [], scartate: [] }
  const ultimoNoto = giorniNoti[giorniNoti.length - 1]

  const fascia = (da, a) => {
    let spesa = 0, ordini = 0, valore = 0, n = 0
    for (const g of giorniNoti) {
      if (g < da || g > a) continue
      const x = perGiorno.get(g)
      spesa += x.spesa; ordini += x.ordini; valore += x.valore; n++
    }
    return { spesa, ordini, valore, giorni: n, alGiorno: n ? spesa / n : 0, cpa: ordini ? spesa / ordini : null, roas: spesa ? valore / spesa : null }
  }

  // Raggruppate per giorno di spegnimento: se se ne spengono cinque insieme,
  // l'effetto sul conto non e' di nessuna delle cinque in particolare.
  const perData = new Map()
  for (const c of creativita || []) {
    if (c.status !== 'spenta' || !c.spenta_il) continue
    const g = String(c.spenta_il).slice(0, 10)
    if (!perData.has(g)) perData.set(g, [])
    perData.get(g).push(c)
  }

  const letture = [], scartate = []
  for (const [g, gruppo] of [...perData].sort()) {
    const nomi = gruppo.map(c => c.name)
    if (gruppo.length > 1) {
      scartate.push({ data: g, quante: gruppo.length, motivo: `${gruppo.length} creativita' spente lo stesso giorno: l'effetto sul conto non e' attribuibile a nessuna` })
      continue
    }
    const c = gruppo[0]
    const spesa = spesaDi.get(c.id) || 0
    if (cpaAccount && spesa < SPESA_MINIMA_LETTURA * cpaAccount) {
      scartate.push({ data: g, nome: c.name, motivo: `aveva speso solo ${Math.round(spesa)} euro: spegnere qualcosa che non spendeva non puo' spostare il conto` })
      continue
    }
    const prima = fascia(spostaGiorni(g, -finestra), g)
    const dopo = fascia(spostaGiorni(g, 1), spostaGiorni(g, finestra))
    if (dopo.giorni < finestra) {
      scartate.push({ data: g, nome: c.name, motivo: `sono passati solo ${dopo.giorni} giorni dei ${finestra} che servono` })
      continue
    }
    if (!prima.cpa || !dopo.cpa) {
      scartate.push({ data: g, nome: c.name, motivo: 'senza ordini in una delle due finestre non c\'e\' un costo per ordine da confrontare' })
      continue
    }
    // La deriva: se il conto ha cambiato ritmo, la differenza e' sua.
    const deriva = prima.alGiorno ? (dopo.alGiorno - prima.alGiorno) / prima.alGiorno : 0
    const voce = {
      data: g, nome: c.name, spesaCreativita: spesa,
      prima, dopo,
      variazioneCpa: (dopo.cpa - prima.cpa) / prima.cpa,
      variazioneRoas: prima.roas ? (dopo.roas - prima.roas) / prima.roas : null,
      deriva,
    }
    if (Math.abs(deriva) > DERIVA_MASSIMA) {
      scartate.push({ ...voce, motivo: `il conto e' passato da ${Math.round(prima.alGiorno)} a ${Math.round(dopo.alGiorno)} euro al giorno (${deriva > 0 ? '+' : ''}${Math.round(deriva * 100)}%): la differenza e' del cambio di ritmo, non dello spegnimento` })
      continue
    }
    letture.push(voce)
  }
  return { letture, scartate, ultimoNoto }
}
