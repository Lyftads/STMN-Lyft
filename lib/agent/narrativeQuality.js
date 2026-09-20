// Verifica di ONESTÀ prima di chiudere una sintesi discorsiva generata dall'AI
// (il racconto del periodo nel report PDF e nei report schedulati).
//
// A cosa serve. ACTION_QUALITY governa la forma dei CONSIGLI (azione → perché →
// come → impatto → monitoraggio). Questo blocco governa un'altra cosa: quali
// FATTI entrano nel racconto del periodo. Un modello che riassume una settimana
// commerciale sbanda sempre nello stesso modo — una causa sola invece di
// diverse, il merito attribuito alle azioni quando è stato un singolo giorno o
// una promozione, e i costi lasciati fuori quando il totale è positivo.
//
// Da dove viene. Sono quattro delle feature "core" di StoryScope (COLM 2026,
// arXiv 2604.03136): lo studio ha confrontato 61.608 racconti umani e di cinque
// modelli e ha trovato che l'AI tiene la catena causale più continua (4,20
// contro 3,92), attribuisce la risoluzione al protagonista molto più spesso
// (69% contro 46%) e racconta molto meno spesso un esito che costa qualcosa
// (Claude 6% contro 28% degli umani). Tradotto: il racconto di un periodo
// commerciale tende alla favola. Vedi la skill `storyscope`.
//
// ATTENZIONE, MISURATO DUE VOLTE — non allungare questo blocco e non renderlo
// più perentorio. Due prove indipendenti, stesso modello e stessi dati:
//  · scritto come regole di stile narrativo discorsive (1.990 car.) PEGGIORA la
//    copertura dei fatti scomodi (21 contro 26 su 48) e fa sparire il fatto più
//    importante del periodo di prova in 4 esecuzioni su 4;
//  · una variante più imperativa e più lunga (1.700 car., "falli tu, con la
//    divisione", "non scrivere mai che non è calcolabile") alza il MER a 8/8 ma
//    riporta i fatti scomodi a 22/32, cioè al livello del prompt senza blocco.
// La forma attuale (1.181 car.) tiene insieme le due cose: 27/32 sui fatti
// scomodi (il massimo misurato) e MER 7/8. Collaudo in docs/NARRATIVE_QUALITY.md:
// rifarlo prima di toccare questo testo, e guardare SEMPRE la non-regressione sui
// fatti scomodi, non solo il difetto che si sta correggendo.
export const NARRATIVE_QUALITY = `
PRIMA DI CHIUDERE, verifica di aver nominato con le cifre esatte: (a) la voce che è peggiorata di più nel periodo; (b) la spesa che ha reso meno di quanto è costata; (c) se la crescita (o il calo) viene da clienti nuovi o da clienti di ritorno; (d) se un solo giorno, un solo prodotto o una sola campagna spiega gran parte del totale. Se uno di questi non è nei dati, saltalo. Chiudi la sintesi sul fatto più importante del periodo, non su una proiezione o su una morale.
CONTI DA FARE SEMPRE, se i dati li permettono: MER = fatturato / spesa pubblicitaria totale (citalo accanto ai ROAS di piattaforma, mai i ROAS da soli); costo per cliente nuovo = spesa totale / clienti nuovi; costo per ordine = spesa totale / ordini. Confronta ognuno col periodo precedente.
DUE ERRORI DA NON FARE: (1) un guasto di tracciamento (pixel, tag, consenso) NON fa vendere di meno — rende il ricavo attribuito più basso e non confrontabile, mentre il fatturato reale non cambia: non attribuirgli mai un calo di vendite; (2) i ricavi attribuiti dai singoli canali si sovrappongono e NON si sommano — se la loro somma sfiora il fatturato reale, scrivilo invece di trattarli come contributi separati.`
