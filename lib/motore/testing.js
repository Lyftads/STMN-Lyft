// ============================================================================
//  Quante creatività ha senso lanciare, dato il budget.
//
//  Regola del cliente. I quattro regimi di spesa in test, per creatività:
//    CPA × 1      LENTO       esce dall'apprendimento in ~50 giorni
//    CPA × 2      SOFT        ~25 giorni
//    CPA × 50/7   SPINTO      50 conversioni in 7 giorni
//    CPA × 50/5   SUPER PUSH  50 conversioni in 5 giorni
//
//  Il senso: 50 conversioni è la soglia con cui Meta esce dalla fase di
//  apprendimento. Il moltiplicatore dice in quanti giorni ci si arriva.
//
//  La conseguenza operativa è la sola che conta: se il budget non basta a
//  far girare le creatività che produciamo, testarle non significa niente e
//  produrne altre è tempo sprecato. Il numero di creatività da fare SI CALCOLA
//  dal budget, non si decide.
// ============================================================================

export const REGIMI = [
  { id: 'lento',      nome: 'Lento',      mult: 1,      giorniAppr: 50 },
  { id: 'soft',       nome: 'Soft',       mult: 2,      giorniAppr: 25 },
  { id: 'spinto',     nome: 'Spinto',     mult: 50 / 7, giorniAppr: 7 },
  { id: 'super-push', nome: 'Super push', mult: 50 / 5, giorniAppr: 5 },
]

// Quante creatività il budget regge davvero, per ciascun regime.
export function capacitaTest({ budgetGiornaliero, cpaTarget }) {
  if (!budgetGiornaliero || !cpaTarget) return null
  return REGIMI.map(r => {
    const perCreativita = cpaTarget * r.mult
    const quante = Math.floor(budgetGiornaliero / perCreativita)
    return {
      ...r,
      spesaPerCreativita: +perCreativita.toFixed(2),
      creativitaSostenibili: quante,
      // Sotto 1 il regime non è praticabile: il budget non basta nemmeno per
      // una creatività, e lanciarne comunque significa non far girare niente.
      praticabile: quante >= 1,
    }
  })
}

// Il regime consigliato: il più veloce che il budget regge tenendo almeno il
// numero minimo di creatività in test. Testare 1 sola creatività non è un test:
// non c'è nulla con cui confrontarla.
export function regimeConsigliato({ budgetGiornaliero, cpaTarget, minimoCreativita = 3 }) {
  const c = capacitaTest({ budgetGiornaliero, cpaTarget })
  if (!c) return null
  const ok = c.filter(r => r.creativitaSostenibili >= minimoCreativita)
  if (ok.length) {
    const scelto = ok.sort((a, b) => b.mult - a.mult)[0]
    return { ...scelto, verdetto: 'ok' }
  }
  // Nessun regime regge il minimo: si dice quale budget servirebbe, invece di
  // far finta che si possa testare lo stesso.
  const lento = c[0]
  return {
    ...lento, verdetto: 'budget insufficiente',
    creativitaSostenibili: lento.creativitaSostenibili,
    budgetNecessario: +(cpaTarget * 1 * minimoCreativita).toFixed(2),
    nota: `Con €${budgetGiornaliero}/giorno e un CPA di €${cpaTarget} si reggono `
      + `${lento.creativitaSostenibili} creatività anche nel regime più lento. `
      + `Per tenerne ${minimoCreativita} in test servono almeno `
      + `€${(cpaTarget * minimoCreativita).toFixed(0)}/giorno: sotto quella soglia `
      + `le creatività non girano e il test non dice nulla.`,
  }
}
