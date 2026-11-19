// ============================================================================
//  Le creativita' APRIPISTA: quelle che portano pubblico nuovo dentro il conto
//  e lasciano che siano altre a chiudere la vendita.
//
//  Il problema, posto dal cliente il 3 settembre 2026: certe creativita'
//  spendono molto e convertono poco, quindi hanno un costo per ordine alto e il
//  motore direbbe di spegnerle. Ma sono quelle che fanno convertire le altre:
//  spente loro, cala anche il resto, e il conto peggiora nel complesso.
//
//  La base di conoscenza lo conferma e gli da' un nome — attribuzione
//  incrementale. Testualmente: "Incremental attribution helps identify ads that
//  truly drive new sales, preventing over-attribution to ads that merely assist
//  in closing sales that would happen anyway". E' lo stesso fatto visto
//  dall'altra parte: se le chiuditrici prendono credito in eccesso, le apripista
//  ne prendono troppo poco.
//
//  QUELLO CHE QUESTO FILE NON FA, ed e' importante: non dice quali creativita'
//  sono apripista. Con dati a ultimo clic quella domanda NON e' rispondibile —
//  il percorso multi-touch non ce l'abbiamo, e fingere di dedurlo sarebbe
//  inventare. Dice una cosa piu' modesta e vera: questa creativita' porta una
//  fetta grossa del tuo pubblico nuovo, quindi spegnerla alla cieca e' un
//  rischio, e prima va verificato con uno spegnimento controllato.
//
//  Vale come il guardrail sulla spesa a vuoto: messo prima che serva.
// ============================================================================

// Sopra questa quota delle impression sul pubblico nuovo, una creativita' non
// e' piu' "una delle tante": e' un pezzo della copertura del conto, e toglierlo
// cambia cosa vede il resto dell'account.
export const QUOTA_APRIPISTA = 0.08

// Serve comunque che il pubblico nuovo pesi qualcosa nel conto: in un account
// che gira quasi tutto sul caldo la quota di impression sul nuovo sarebbe alta
// per tutti e la protezione scatterebbe sempre.
export const QUOTA_NUOVO_ACCOUNT_MINIMA = 0.3

export function quoteNuovo(segRighe, vivo = () => true) {
  const per = new Map()
  let impNuovo = 0, spNuovo = 0, spTot = 0
  for (const s of segRighe || []) {
    const sp = +s.spend || 0
    spTot += sp
    if (s.segment !== 'new') continue
    if (!vivo(s.creative_id)) continue
    const v = per.get(s.creative_id) || { impressioni: 0, spesa: 0 }
    v.impressioni += +s.impressions || 0
    v.spesa += sp
    per.set(s.creative_id, v)
    impNuovo += +s.impressions || 0
    spNuovo += sp
  }
  const quota = new Map()
  for (const [id, v] of per) {
    quota.set(id, { ...v, quota: impNuovo ? v.impressioni / impNuovo : 0 })
  }
  return { quota, impNuovo, quotaNuovoAccount: spTot ? spNuovo / spTot : 0 }
}

// La mano che trattiene, versione "copertura". Si applica DOPO il verdetto e
// dopo la regola sulla spesa minima, come quella: il giudizio di merito resta
// quello che e', e questa dice solo che eseguirlo alla cieca costa caro.
export function trattieniApripista(f, q, quotaNuovoAccount) {
  if (f.key !== 'kill') return f
  if (!q || q.quota < QUOTA_APRIPISTA) return f
  if (quotaNuovoAccount < QUOTA_NUOVO_ACCOUNT_MINIMA) return f
  const pc = (x) => Math.round(x * 100) + '%'
  return {
    key: 'apripista', label: 'APRIPISTA', cls: 'b-hold',
    perche: `Il verdetto sarebbe SPEGNI, ma questa creativita' porta il ${pc(q.quota)} di tutte `
      + `le impression che il conto fa su pubblico nuovo. Con dati a ultimo clic non si puo' `
      + `sapere quante delle vendite chiuse da altre creativita' partano da qui: spegnerla puo' `
      + `far calare anche il resto. Prima di spegnerla fai uno SPEGNIMENTO CONTROLLATO — mettila `
      + `in pausa e guarda per sette giorni il costo per ordine e il ROAS DELL'ACCOUNT, non i suoi. `
      + `Se il conto non peggiora, spegnila davvero.`,
  }
}
