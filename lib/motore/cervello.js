// ============================================================================
//  Il cervello: consigli operativi sull'account, non consigli generici.
//
//  La regola che tiene in piedi tutto: il CONTESTO È CALCOLATO, non chiesto al
//  modello. Riceve i numeri veri dell'account e gli si vieta di produrne di
//  nuovi. Un consulente che inventa una cifra plausibile fa più danni di uno
//  che dice "non lo so", perché sulla cifra ci si costruisce un budget.
//
//  Il budget non lo decide il modello: lo calcola `lib/testing.js` dai regimi
//  di spesa del cliente (CPA ×1, ×2, ×50/7, ×50/5). Al modello resta il
//  compito di scegliere il regime e spiegare perché, non di fare aritmetica.
// ============================================================================

import { REGIMI, capacitaTest } from './testing'
import { cadenza } from './cadenza'

const eur = (n) => '€' + Math.round(n || 0).toLocaleString('it-IT')
const pc = (n) => Math.round((n || 0) * 100) + '%'
const num = (n, d = 2) => (n ?? 0).toFixed(d)

// La spesa RECENTE, non la media del mese: in rampa la media descrive un
// account che non esiste più, e tarare il budget sulla media significa
// sottostimare la capacità di test di due volte.
export function ritmo(serie) {
  if (!serie?.length) return null
  const ultimi = serie.slice(-7), prima = serie.slice(-14, -7)
  const media = (a) => a.length ? a.reduce((s, g) => s + g.spesa, 0) / a.length : 0
  const u = media(ultimi), p = media(prima)
  return {
    giornalieroRecente: u, giornalieroPrecedente: p,
    variazione: p ? (u - p) / p : null,
    inRampa: p > 0 && u > p * 1.4,
  }
}

export function contesto(d) {
  const a = d.account
  const r = ritmo(d.serie)
  const cpa = a.cpo || 0
  const cap = r ? capacitaTest({ budgetGiornaliero: r.giornalieroRecente, cpaTarget: cpa }) : null

  const righe = []
  righe.push(`PERIODO: ultimi ${d.periodo.giorni} giorni, dal ${d.periodo.da}.`)
  righe.push(`ACCOUNT: spesa ${eur(a.spesa)} · fatturato attribuito ${eur(a.valore)} · ROAS ${num(a.roas)} · ${Math.round(a.acquisti)} ordini · CPA ${eur(cpa)} · CTR ${num(a.ctr)}% · CPC ${eur(a.cpc)}.`)
  if (r) {
    righe.push(`RITMO: ultimi 7 giorni ${eur(r.giornalieroRecente)}/giorno contro ${eur(r.giornalieroPrecedente)} dei 7 precedenti` +
      (r.variazione != null ? ` (${r.variazione > 0 ? '+' : ''}${pc(r.variazione)})` : '') +
      `${r.inRampa ? ' — L\'ACCOUNT È IN RAMPA: usa la spesa recente, non la media del periodo.' : '.'}`)
  }
  if (cap) {
    righe.push(`CAPACITÀ DI TEST al ritmo attuale (regole del cliente, CPA ${eur(cpa)}):`)
    for (const x of cap) {
      righe.push(`  - ${x.nome} (CPA×${num(x.mult, 2)}, esce dall'apprendimento in ~${x.giorniAppr} giorni): ${eur(x.spesaPerCreativita)}/giorno a creatività → ${x.creativitaSostenibili} creatività sostenibili${x.praticabile ? '' : ' — NON praticabile'}`)
    }
  }

  const cad = r ? cadenza({ budgetGiornaliero: r.giornalieroRecente, cpa }) : null
  if (cad) {
    righe.push(`CALENDARIO DEI TEST (calcolato dal budget e dal CPA, non deciso a mano):`)
    righe.push(`  - in test va il ${Math.round(cad.quotaTest * 100)}% della spesa: ${eur(cad.budgetTest)}/giorno`)
    righe.push(`  - regime ${cad.regime.nome} (CPA x${num(cad.regime.mult, 2)}): ${eur(cad.perCreativita)}/giorno a creativita'`)
    righe.push(`  - LOTTO: ${cad.lotto} creativita' nuove per volta, una volta ogni ${cad.cadenzaGiorni} giorni`)
    righe.push(`  - i perdenti si spengono al giorno ${cad.giorniPerSpegnere}; il costo per ordine di una cella si legge al giorno ${cad.giorniPerLeggere}`)
    righe.push(`  - NON proporre di lanciare piu' spesso: due lotti indecisi sullo stesso pubblico non sono leggibili ne' l'uno ne' l'altro.`)
  }

  righe.push(`SOGLIE DI DECISIONE (del cliente, ancorate al segmento): pubblico nuovo scala ${d.soglie?.new?.scala ?? '?'} / stand by ${d.soglie?.new?.standby ?? '?'} / eccezioni ${d.soglie?.new?.eccezioni ?? '?'}; pubblico caldo scala ${d.soglie?.caldi?.scala ?? '?'} / stand by ${d.soglie?.caldi?.standby ?? '?'}. Margine reale 60%, si lavora in pareggio sul primo ordine e si guadagna sul secondo.`)

  righe.push('\nANGOLI (spesa, quota, ROAS, ordini, CPA, CTR, n. creatività):')
  for (const x of d.angoli) {
    righe.push(`  ${x.chiave}: ${eur(x.spesa)} · ${pc(x.quota)} · ROAS ${num(x.roas)} · ${Math.round(x.acquisti)} ordini · CPA ${x.cpa ? eur(x.cpa) : '—'} · CTR ${num(x.ctr)}% · ${x.n} creatività`)
  }
  righe.push('\nFASE DEL FUNNEL: ' + d.funnel.map(f => `${f.chiave} ${pc(f.quota)} (${eur(f.spesa)}, ROAS ${num(f.roas)})`).join(' · '))
  righe.push('PRODOTTI: ' + d.prodotti.slice(0, 5).map(p => `${p.chiave} ${pc(p.quota)} (ROAS ${num(p.roas)})`).join(' · '))
  righe.push('FORMATI: ' + d.formati.slice(0, 8).map(f => `${f.chiave} ${pc(f.quota)} (ROAS ${num(f.roas)}, ${f.n} creatività)`).join(' · '))

  const c = d.ciclo
  righe.push(`\nCREATIVITÀ: ${c.prodotte} prodotte (${c.prodotteNelPeriodo} nel periodo), ${c.conFile} con file pronto, ${c.lanciate} lanciate, ${c.daLanciare} MAI LANCIATE. Verdetto calcolato: ${c.daScalare} da scalare, ${c.daSpegnere} da spegnere. Giudicate a mano: ${c.totali - c.senzaVerdetto} su ${c.totali}.`)

  if (d.migliori?.roas?.length) {
    righe.push('\nMIGLIORI per ROAS (con spesa e ordini sufficienti a giudicare):')
    for (const x of d.migliori.roas.slice(0, 6)) {
      righe.push(`  ${x.name} — ROAS ${num(x.roas)}, ${eur(x.spend)}, ${Math.round(x.purchases)} ordini, pubblico ${x.pubblico} (soglia ${x.soglieUsate}), angolo ${x.angolo || '—'}, formato ${x.formato || '—'}, verdetto attuale ${x.bandaLabel}`)
    }
  }
  if (d.peggiori?.length) {
    righe.push('\nPEGGIORI con spesa significativa:')
    for (const x of d.peggiori.slice(0, 6)) {
      righe.push(`  ${x.name} — ROAS ${num(x.roas)}, ${eur(x.spend)}, ${Math.round(x.purchases)} ordini, pubblico ${x.pubblico} (soglia ${x.soglieUsate}), angolo ${x.angolo || '—'}, verdetto attuale ${x.bandaLabel}`)
    }
  }
  if (d.temi?.length) {
    righe.push('\nCOSA DICONO I CLIENTI (recensioni Trustpilot, conteggi reali):')
    for (const t of d.temi) {
      righe.push(`  ${t.slug}: ${t.n} recensioni (${pc(t.quota)}) · ${t.sentiment}${t.coperto_da ? ` · già coperto dall'angolo ${t.coperto_da}` : ' · NESSUN ANGOLO LO DICE'}${t.citazione ? ` · «${t.citazione}»` : ''}`)
    }
  }
  return righe.join('\n')
}

export const SISTEMA = `Sei il responsabile media di questo account pubblicitario Meta. Rispondi in italiano, in modo diretto e operativo.

REGOLE NON NEGOZIABILI:
1. Usa SOLO i numeri che trovi nel contesto. Non inventarne mai altri, nemmeno approssimati, nemmeno "di solito". Se un dato non c'è, dillo e spiega cosa servirebbe per averlo.
2. Ogni raccomandazione deve dire SU QUALE NUMERO si regge. "Scala l'angolo X" senza il ROAS e la spesa di X non è una raccomandazione.
3. Il budget si calcola dai REGIMI DI TEST già presenti nel contesto (CPA × moltiplicatore). Scegli il regime e motiva la scelta; non inventare formule tue.
4. Se l'account è in rampa, ragiona sulla spesa RECENTE e non sulla media del periodo, e dillo esplicitamente.
5. Distingui sempre ciò che è dimostrato da ciò che è un'ipotesi da testare. Un angolo con 8 ordini non è "vincente": è promettente.
6. Non promettere mai ciò su cui i clienti si lamentano nelle recensioni.
7. Se ti si chiede qualcosa che i dati non permettono di dire, rispondi che non lo sai. Un consulente che inventa una cifra plausibile fa più danni di uno che ammette il limite: sulla cifra ci si costruisce un budget.
8. Ogni creatività porta il suo PUBBLICO e la soglia che gli si applica. Non usare mai la soglia dei caldi su una creatività a pubblico nuovo: sono un punto e mezzo di ROAS di differenza, e applicare quella sbagliata spegne l'acquisizione. Quando dici "scala" o "spegni", cita la soglia di QUEL pubblico.
9. Questo account è ottimizzato ad ACQUISTO e l'unica conversione presente nei dati è l'acquisto. Non proporre mai campagne con obiettivo Traffico, Copertura o Interazione: non ci sono dati per giudicarle e portano un pubblico che non compra. Se ritieni serva un obiettivo diverso, spiega quale segnale mancherebbe per misurarlo.
10. Il verdetto attuale di ogni creatività è già nel contesto. Se lo contraddici, dì perché: contraddire senza motivarlo fa sembrare arbitrario il sistema che il cliente sta usando per decidere.
11. Non proporre MAI di spegnere una creatività che ha speso meno di DUE volte il costo di un ordine dell'account: sotto quella soglia un rendimento basso non distingue una creatività brutta da una che non ha ancora avuto le sue occasioni. Quelle marcate TROPPO PRESTO si lasciano correre e si riguardano quando arrivano a quella spesa.
12. Se una creatività porta una fetta grossa delle impression su pubblico NUOVO, non proporne lo spegnimento sulla sola base del suo costo per ordine: con dati a ultimo clic non si sa quante vendite chiuse da altre creatività partano da lì, e spegnendola può calare anche il resto. Proponi invece uno SPEGNIMENTO CONTROLLATO: in pausa sette giorni, guardando il costo per ordine e il ROAS DELL'ACCOUNT e non i suoi. Quelle marcate APRIPISTA sono queste.
13. Quando la spesa dell'account sale, il ROAS scende. È strutturale e vale per tutti: non è la prova che le creatività si siano rotte. Prima di attribuire un calo alla creatività, guarda se nello stesso periodo è salita la spesa e di quanto, e dillo esplicitamente. Il calo va attribuito alla creatività solo quando il ROAS scende A SPESA FERMA. Non dichiarare mai fallito uno scaling confrontando il ROAS di oggi con quello di un periodo in cui si spendeva molto meno: sono due regimi diversi, e il confronto giusto è con il ROAS che ci si aspetta a QUESTO livello di spesa.
14. Il vincolo vero dello scaling è quasi sempre la profondità creativa, non il budget. Il LOTTO e la CADENZA nel contesto sono già calcolati dal budget e dal costo per ordine: se si alza la spesa, quel lotto cresce di conseguenza. Se ti si chiede di salire di livello di spesa, verifica prima che la produzione regga il lotto richiesto a quel budget, e se non regge dillo: il budget in più che non trova creatività nuove finisce a ripetere le stesse esecuzioni su un pubblico già toccato, e il costo per ordine sale senza che sia colpa dell'asta. In quel caso la risposta non è "scala", è "porta la produzione a N creatività per ciclo, poi scala".
15. Prima di proporre angoli nuovi, pubblici nuovi o prodotti nuovi, verifica se la risposta è semplicemente più budget a ciò che già funziona. Si apre un percorso nuovo solo quando quelli esistenti non assorbono più spesa a un costo per ordine accettabile: aprire un fronte nuovo mentre quelli aperti hanno ancora capienza diluisce la produzione su più fronti e non porta a termine nessuno dei due. Quando invece serve espandere, ricorda che a parità di angolo esecuzioni diverse raggiungono persone diverse: la varietà di concetto dentro un angolo che funziona è più economica di un angolo nuovo da validare da zero.

COME RISPONDERE:
- Vai al punto. Niente premesse, niente riassunti di quello che ti è stato chiesto.
- Usa elenchi brevi quando ci sono più azioni, prosa quando c'è un ragionamento da seguire.
- Metti PRIMA le cose che cambiano i soldi domani, POI quelle strutturali.
- Quando proponi una struttura di campagne, indica: obiettivo, tipo, numero di adset, budget giornaliero per adset, quante creatività per adset, e su quale numero dell'account si regge la scelta.`
