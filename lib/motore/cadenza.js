import { regimeConsigliato } from './testing'
import { SPESA_MINIMA_KILL } from './soglie'
import { OCCASIONI_MINIME } from './incrocio'

// ============================================================================
//  Ogni quanto si lancia un lotto nuovo, e quando lo si giudica.
//
//  Il problema che risolve: il motore produceva ogni notte, a prescindere. Con
//  quarantasei creativita' contemporaneamente "in attesa" non si capisce piu'
//  cosa sta rendendo cosa — e in un account che deve scalare e' esattamente la
//  cecita' che non ci si puo' permettere.
//
//  Le tre date non si decidono, si CALCOLANO da numeri che esistono gia':
//
//    quanto costa tenere in vita una creativita' → dai regimi di lib/testing
//    quando la si puo' spegnere                  → 2x il CPA (lib/soglie)
//    quando la si puo' leggere davvero           → 6x il CPA (lib/incrocio)
//    mai prima di                                → 7 giorni
//
//  E la cadenza segue: si lancia un lotto nuovo quando il precedente e'
//  giudicabile, non prima. Non e' una preferenza — e' il momento in cui il
//  budget dei perdenti si libera, ed e' quello che paga il lotto successivo.
//  Lanciare piu' spesso vuol dire avere due lotti indecisi che si contendono
//  lo stesso pubblico, e nessuno dei due leggibile.
// ============================================================================

// Lo stesso minimo della board: sotto, una creativita' non ha fallito, deve
// ancora cominciare.
export const GIORNI_MINIMI_TEST = 7

// Quanta parte della spesa va in test. E' l'unico numero qui dentro che non si
// ricava da altri: e' una scelta, quindi viaggia esplicita e si puo' cambiare,
// invece di stare nascosta dentro un calcolo.
export const QUOTA_TEST = 0.25

// Sotto le tre creativita' non e' un test: non c'e' niente con cui confrontare.
export const MINIMO_IN_TEST = 3

export function cadenza({ budgetGiornaliero, cpa, quotaTest = QUOTA_TEST, minimo = MINIMO_IN_TEST }) {
  if (!budgetGiornaliero || !cpa) return null

  const budgetTest = budgetGiornaliero * quotaTest
  const regime = regimeConsigliato({ budgetGiornaliero: budgetTest, cpaTarget: cpa, minimoCreativita: minimo })
  const perCreativita = cpa * regime.mult
  const lotto = Math.max(0, Math.floor(budgetTest / perCreativita))

  // Giorni per accumulare N volte il CPA, al ritmo di spesa del regime. Mai
  // prima del minimo: una creativita' che ha speso in fretta non per questo e'
  // stata vista da abbastanza gente diversa.
  const giorniPer = (volte) => Math.max(GIORNI_MINIMI_TEST, Math.ceil((volte * cpa) / perCreativita))
  const giorniPerSpegnere = giorniPer(SPESA_MINIMA_KILL)
  const giorniPerLeggere = giorniPer(OCCASIONI_MINIME)

  return {
    quotaTest, budgetGiornaliero, budgetTest, cpa,
    regime: { id: regime.id, nome: regime.nome, mult: regime.mult, verdetto: regime.verdetto, nota: regime.nota },
    perCreativita,
    lotto,
    // Le due date che servono a lavorare.
    giorniPerSpegnere,        // qui si spengono i perdenti e si libera il budget
    giorniPerLeggere,         // qui il costo per ordine della cella significa qualcosa
    cadenzaGiorni: giorniPerSpegnere,
    // Quante immagini deve produrre il motore per un lotto: due formati a testa.
    immaginiPerLotto: lotto * 2,
    sostenibile: regime.verdetto === 'ok' && lotto >= minimo,
  }
}

// Se sia il momento di produrre, e perche' no quando non lo e'.
//
// L'orologio parte dal LANCIO, non da quando il motore ha scritto la riga: una
// creativita' che sta in magazzino non spende niente e non sta imparando
// niente, quindi far partire da li' i sette giorni misurerebbe il nulla.
//
// E prima ancora della data conta il magazzino: se ci sono gia' abbastanza
// creativita' pronte e mai lanciate, il collo di bottiglia non e' la
// produzione. Fabbricarne altre non fa girare quelle che ci sono.
export function tempoDiProdurre(c, ultimoLancio, adesso, { pronteNonLanciate = 0 } = {}) {
  if (!c) return { produci: false, motivo: 'cadenza non calcolabile: manca il budget o il CPA' }
  if (!c.sostenibile) {
    return { produci: false, motivo: c.regime.nota
      || `il budget di test (${Math.round(c.budgetTest)} al giorno) non regge ${MINIMO_IN_TEST} creativita' in parallelo: produrne altre non le farebbe girare` }
  }
  if (pronteNonLanciate >= c.lotto) {
    return {
      produci: false, pronteNonLanciate,
      motivo: `ci sono gia' ${pronteNonLanciate} creativita' pronte e mai lanciate, un lotto ne vuole ${c.lotto}: `
        + `il collo di bottiglia e' il lancio, non la produzione`,
    }
  }
  const mancanti = c.lotto - pronteNonLanciate
  if (!ultimoLancio) return { produci: true, motivo: 'nessun lancio precedente', quante: mancanti, pronteNonLanciate }
  const giorni = Math.floor((adesso - new Date(ultimoLancio).getTime()) / 86400000)
  if (giorni < c.cadenzaGiorni) {
    return {
      produci: false, giorniDallUltimo: giorni, pronteNonLanciate,
      motivo: `l'ultimo lotto e' stato lanciato ${giorni} giorni fa e diventa giudicabile a ${c.cadenzaGiorni}: `
        + `lanciarne un altro adesso vuol dire due lotti indecisi sullo stesso pubblico, e nessuno dei due leggibile`,
    }
  }
  return { produci: true, giorniDallUltimo: giorni, quante: mancanti, pronteNonLanciate }
}
