// ============================================================================
//  Che tipo di negozio e' questo cliente — e quali funzioni ha senso mostrargli.
//
//  Marino, 20 set 2026, su Saracino1925: «e' un brand che vende solo i suoi prodotti, quindi non ha
//  senso neanche analizzare gli stessi SKU online perche' nessuno li ha».
//
//  Tre domande diverse, non una (vedi supabase/tipo_negozio.sql):
//    multimarca     -> "Brand piu' venduti" e "Prezzi" (confronto coi concorrenti)
//    canaliEsclusi  -> il fatturato dei marketplace a parte, fuori dai conti di efficienza
//    negoziFisici   -> le campagne che portano gente in negozio, fuori da ROAS e MER
//
//  CHI DECIDE. Lo stesso schema del gate sugli ordini (lib/team/orderTiers.js): il cliente lo
//  dichiara, il prodotto lo verifica. Ma con la precedenza ROVESCIATA, e per una ragione precisa:
//  li' il verificato vince perche' il cliente ha interesse a dichiarare meno ordini di quanti ne
//  fa; qui non ha nessun interesse a mentire, e la misura e' sfocata — un monomarca puo' avere tre
//  "marchi" per via di una gift card e di un refuso a catalogo. Quindi il DICHIARATO vince, e il
//  dedotto serve solo quando non e' stato dichiarato niente.
// ============================================================================

// La soglia oltre la quale un solo marchio "e' il negozio". Sopra il 90% del fatturato, i marchi
// residui sono quasi sempre gift card, spedizioni e refusi: monomarca.
const QUOTA_MONOMARCA = 0.90
// Sotto questa quota, e con abbastanza marchi diversi, e' un rivenditore vero.
const QUOTA_MULTIMARCA = 0.70
const MARCHI_MULTIMARCA = 5

// Le righe che non sono un marchio: vanno tolte prima di contare, o si sbaglia di uno.
const NON_E_UN_MARCHIO = /^(\s*|shipping|spedizion\w*|gift ?card|buono regalo|rettifi\w*|adjust\w*)$/i

// Dalle vendite per marchio a un indizio sul tipo di negozio.
// `righe` = [{ marchio, fatturato }], come le restituisce /api/brand-sales.
// Non decide da solo: quando il quadro e' ambiguo lascia null e la domanda si gira al cliente.
export function indizioTipoNegozio(righe = []) {
  const validi = (righe || [])
    .map(r => ({ marchio: String(r.marchio ?? r.vendor ?? r.brand ?? '').trim(), fatturato: Number(r.fatturato ?? r.revenue ?? 0) || 0 }))
    .filter(r => r.marchio && !NON_E_UN_MARCHIO.test(r.marchio) && r.fatturato > 0)
    .sort((a, b) => b.fatturato - a.fatturato)

  const marchi = validi.length
  const totale = validi.reduce((t, r) => t + r.fatturato, 0)
  if (!marchi || totale <= 0) return { multimarca: null, marchi: 0, quotaPrimo: null, perche: 'nessuna vendita per marchio nel periodo' }

  const quotaPrimo = Math.round((validi[0].fatturato / totale) * 1000) / 1000
  if (marchi === 1) return { multimarca: false, marchi, quotaPrimo, perche: 'un marchio solo ha venduto' }
  if (quotaPrimo >= QUOTA_MONOMARCA) return { multimarca: false, marchi, quotaPrimo, perche: `«${validi[0].marchio}» fa il ${Math.round(quotaPrimo * 100)}% del fatturato` }
  if (marchi >= MARCHI_MULTIMARCA && quotaPrimo < QUOTA_MULTIMARCA) return { multimarca: true, marchi, quotaPrimo, perche: `${marchi} marchi hanno venduto e il primo fa il ${Math.round(quotaPrimo * 100)}%` }
  return { multimarca: null, marchi, quotaPrimo, perche: `${marchi} marchi, il primo al ${Math.round(quotaPrimo * 100)}%: troppo incerto per decidere da soli` }
}

// La risposta definitiva, dalla riga di `companies`. Il dichiarato vince; il dedotto riempie il
// vuoto. Se non si sa niente: SPENTO — vedi il perche' in supabase/tipo_negozio.sql.
export function tipoNegozio(company = {}) {
  const dichiarato = typeof company.multimarca === 'boolean' ? company.multimarca : null
  const dedotto = indizioDaColonne(company)
  const multimarca = dichiarato != null ? dichiarato : (dedotto != null ? dedotto : false)
  const canali = Array.isArray(company.canali_esclusi) ? company.canali_esclusi.filter(c => typeof c === 'string' && c.trim()) : []
  return {
    multimarca,
    // da dove viene la risposta: serve a dirlo nell'interfaccia invece di far comparire le cose
    fonte: dichiarato != null ? 'dichiarato' : (dedotto != null ? 'dedotto' : 'predefinito'),
    // stesso `+null === 0` di indizioDaColonne: qui faceva dire «0 marchi
    // rilevati» a un cliente su cui non e' mai stata fatta una misura.
    marchi: numeroVero(company.marchi_rilevati),
    canaliEsclusi: canali,
    negoziFisici: company.negozi_fisici === true,
    etichettaNegoziFisici: (company.etichetta_negozi_fisici || '').trim() || null,
  }
}

// `+null` fa 0, e Number.isFinite(0) e' vero: una colonna MAI misurata veniva
// letta come «zero marchi», che passa il controllo `marchi <= 1` e risponde
// «monomarca, DEDOTTO dai dati». La risposta finale non cambiava (spento resta
// spento), ma `fonte` diceva il falso — e fonte esiste apposta per dire
// nell'interfaccia da dove viene la risposta invece di far comparire le cose.
// Un cliente di cui non si sa niente deve risultare «predefinito», non
// «dedotto»: sono due cose diverse da dire, e una delle due non e' vera.
const numeroVero = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(+v)) ? null : +v

function indizioDaColonne(company) {
  const marchi = numeroVero(company.marchi_rilevati)
  const quota = numeroVero(company.quota_primo_marchio)
  if (marchi == null) return null
  if (marchi <= 1) return false
  if (quota != null && quota >= QUOTA_MONOMARCA) return false
  if (marchi >= MARCHI_MULTIMARCA && quota != null && quota < QUOTA_MULTIMARCA) return true
  return null
}

// Le tab che esistono solo per chi vende marchi di altri.
export const TAB_SOLO_MULTIMARCA = ['prezzi']

// ============================================================================
//  Toglie dal menu le tab che a QUESTO cliente non servono.
//
//  E' un filtro diverso da allowedTabsFor() di roleTabs.js, e i due non vanno
//  confusi: quello dice CHI puo' entrare (ruoli, e le tab che l'Admin ha
//  nascosto ai membri) e per un Admin risponde null = tutto; questo dice COSA
//  ESISTE per questo negozio, e vale anche per l'Admin — anzi soprattutto,
//  perche' il proprietario di un monomarca e' il primo a non doverle vedere.
//
//  Senza questo filtro «Prezzi» compariva a tutti: la route e' protetta e i
//  dati di nessuno uscivano, ma il cliente apriva una tab che gli rispondeva
//  che nessun concorrente vende i suoi articoli. Marino, su Saracino1925:
//  «non ha senso neanche analizzare gli stessi SKU online perche' nessuno li
//  ha».
//
//  E' un PREDICATO, non un filtro su un insieme, apposta: il filtro dei ruoli
//  usa null per dire «tutte», e una funzione che debba restituire ora un Set e
//  ora null finisce per essere usata male. Cosi' invece i due si compongono
//  senza ambiguita':
//      items.filter(it => (!allowedTabs || allowedTabs.has(it.id))
//                         && !tabNascostaAlNegozio(it.id, negozio))
//
//  NEL DUBBIO SI MOSTRA: `negozio` a null vuol dire che la risposta non e'
//  ancora arrivata. Nascondere una tab a chi ne ha diritto, anche solo per un
//  istante a ogni caricamento, si vede e preoccupa; mostrarla per quell'istante
//  a chi non le serve no. E' il contrario del ripiego delle route, dove nel
//  dubbio si spegne — li' pero' in gioco ci sono i dati, qui solo una voce di
//  menu, e i dati restano protetti dalla route comunque.
// ============================================================================
export function tabNascostaAlNegozio(tabId, negozio) {
  if (!negozio) return false
  if (negozio.multimarca === true) return false
  return TAB_SOLO_MULTIMARCA.includes(tabId)
}
