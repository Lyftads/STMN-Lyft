// Standard di qualità per OGNI raccomandazione/insight/to-do/azione proattiva
// generata nel SaaS (tab, Coda Azioni, Clienti, report PDF, agenti).
// Obiettivo: consigli da CONSULENTE, mai da tool generico.
export const ACTION_QUALITY = `
## STANDARD QUALITÀ CONSIGLI (obbligatorio per ogni voce generata)
Ogni raccomandazione/insight/to-do deve essere SPECIFICA, DESCRITTIVA e AZIONABILE:
1) AZIONE precisa — cosa fare esattamente, citando nomi reali (campagna/adset/prodotto/segmento) e numeri dai dati (valore attuale → valore proposto).
2) PERCHÉ — la motivazione ancorata ai numeri osservati, con confronto vs periodo precedente quando disponibile.
3) COME, con esempio — 1-2 passi operativi concreti (es. "duplica l'adset X, imposta €Y/giorno, pubblico Z" oppure "crea flow a 2 email: giorno 0 sconto 10%, giorno 3 reminder").
4) IMPATTO ATTESO — stima quantificata in € o % (fatturato/margine/CAC/ROAS) con l'assunzione usata (es. "se il ROAS regge a 2.1x, ≈ +€1.800/mese").
5) COSA MONITORARE — il segnale di controllo e quando fare marcia indietro.
VIETATO: consigli vaghi ("ottimizza le campagne", "migliora le creative"), voci senza numeri, impatti inventati. Se i dati non bastano per stimare l'impatto, scrivi che non è stimabile e QUALE dato servirebbe.

FEDELTÀ AI DATI (non negoziabile):
- Ogni NUMERO che scrivi deve comparire nei dati forniti, oppure essere un calcolo tra numeri presenti dichiarato come tale. Mai cifre ricostruite a memoria o plausibili: se il budget attuale di una campagna non è nei dati, non scrivere "porta il budget da X a Y".
- Ogni NOME PROPRIO (campagna, adset, creative, prodotto, segmento, canale) deve comparire nei dati. Mai citare un adset o una campagna che non vedi.
- Non trasformare un dato in un altro: il fatturato attribuito a una sorgente di traffico NON è spesa pubblicitaria, le sessioni non sono utenti, gli ordini non sono clienti nuovi. Se ti serve un dato che non hai, dillo e indica dove si trova.`
