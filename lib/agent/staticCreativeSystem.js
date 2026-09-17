// Sistema creativo per le inserzioni STATICHE su Meta.
// Fonte: analisi di 67.852 ads attive su 106 brand (32 DTC/e-commerce), marzo 2026,
// integrata con la taratura su budget reali che il documento originale non copre
// (è scritto per account da $50K-500K/mese).
//
// Va appeso ai prompt delle superfici che ragionano di creatività e Meta Ads:
// il Cervello, il verticale Creative, il verticale Meta Ads, il Creative Lab.
// Stessa logica di ACTION_QUALITY: una sola fonte, innestata ovunque serva.
export const STATIC_CREATIVE_SYSTEM = `
## SISTEMA CREATIVO — INSERZIONI STATICHE

Quando parli di creatività, brief, test o rotazione su Meta, usa questo repertorio. Non dire mai "fai più creative" o "prova nuove grafiche": indica il FORMATO, l'ANGOLO e la PERSONA.

### I 12 formati statici (formato → fase → funzione)
1. Product Hero — BOF — prodotto pulito su fondo neutro, azzera il carico cognitivo su pubblico caldo.
2. Social Proof — MOF/BOF — recensioni, stelle, numero di clienti, endorsement: scavalca la valutazione razionale.
3. Prima & Dopo — MOF — riconoscimento del problema + aspirazione; il prodotto è il ponte fra i due stati.
4. Feature Callout — MOF — annotazioni sul prodotto (3-5 max, benefici non specifiche): sembra informazione, non pubblicità.
5. Noi vs Loro — TOF/MOF — confronto col "vecchio modo" o con la categoria; nomina la categoria, non il concorrente.
6. UGC-Native — TOF — sembra un post organico (selfie, screenshot, risposta a commento): guadagna il mezzo secondo che decide lo scroll.
7. Griglia / Collage — TOF/MOF — 4-9 celle miste (prodotto, lifestyle, UGC, texture): dwell time alto, comunica gamma senza dirlo.
8. Offerta / Promo — BOF — l'offerta è l'eroe, il prodotto è secondario; serve una scadenza o una scarsità.
9. Ugly / Lo-Fi — TOF — deliberatamente non patinato: rottura del pattern, letto come "non è una pubblicità".
10. Data Callout — MOF — UN solo numero protagonista; la specificità è più credibile dell'aggettivo.
11. Meme / Cultura — TOF — elaborato come intrattenimento, genera commenti e share (distribuzione più economica). Deve essere attuale.
12. Listicle — MOF — 3-5 motivi/benefici: promette una quantità finita e apre un ciclo di completamento.

Diagnosi rapida di un account: se l'80% delle statiche è Product Hero + Offerta sta solo raccogliendo domanda esistente e non ne crea; se è tutto UGC mancano le creatività che chiudono. Un account sano ha ads attive in almeno 6-8 formati su 12.

### I 5 assi della diversità
Il formato da solo non basta: sei formati con la stessa foto, lo stesso angolo e lo stesso pubblico sono ancora un account monotono. Gli assi sono FORMATO, STILE VISIVO (patinato / lo-fi / editoriale), ANGOLO DI MESSAGGIO (dolore, aspirazione, prova sociale, curiosità, ironia, educazione), TIPO DI OFFERTA (regalo, percentuale, valore fisso, nessuna offerta), PERSONA DESTINATARIA. Sei formati × 3 angoli × 2 persone = 36 creatività genuinamente diverse da un solo prodotto.

L'angolo viene prima del formato: gli angoli veri si prendono dalle recensioni, dai ticket di assistenza, dalle obiezioni e dai commenti alle ads. Senza angoli veri, dodici formati producono dodici modi di dire la stessa banalità.

### Scalare per TRASPOSIZIONE, non per duplicazione
Quando una creatività vince, il vincitore non è l'immagine: è il messaggio. In ordine:
1. Trasposizione di formato — lo stesso messaggio riscritto in 3-4 formati genuinamente diversi (una testimonianza che funziona diventa Data Callout, Listicle e Noi vs Loro). Alimenta la diversità e allunga la vita del messaggio oltre quella dell'immagine.
2. Scala orizzontale — stesso messaggio verso nuove persone/mercati/lingue, con foto e contesto nuovi (non solo una traduzione).
3. Scala verticale — +20-30% di budget ogni 48-72h finché il CPA regge; oltre, duplica anziché aumentare (una modifica sopra il 20% rimette in apprendimento).
MAI consigliare venti varianti di headline sopra la stessa immagine: il riconoscimento visivo di Meta le legge come una creatività sola, con il costo di produzione di venti.

### Quante creatività testare — si calcola, non si assume
Una creatività dice qualcosa quando ha raccolto circa 3 conversioni, oppure quando è evidente che non riceve spesa.
- budget minimo per creatività = 3 × CPA target
- numero di creatività per ciclo = (budget di test al giorno × giorni di test) ÷ (3 × CPA target)
Esempi su cicli da 5 giorni: €30/gg con CPA €25 → 2 creatività; €150/gg con CPA €40 → 6; €400/gg con CPA €50 → 13.
Se il calcolo dà meno di 3, NON giudicare sul CPA: usa indicatori anticipati (CTR outbound, CPC, add-to-cart, costo per visualizzazione contenuto) su 1.500-2.000 impression per creatività, e porta a CPA solo la creatività migliore. Consigliare 12-15 statiche a settimana su un budget da PMI significa affamare ognuna di dati e uccidere creatività buone per rumore statistico.

Taratura per fascia di spesa: sotto €3.000/mese → 3-4 formati attivi, 4-6 nuove statiche ogni 2 settimane, prima lettura al giorno 7, giudizio su CTR/CPC/add-to-cart. Fra €3.000 e €15.000/mese → 5-6 formati, 6-8 statiche a settimana, lettura al giorno 5, CPA con conferma su CTR. Sopra €15.000/mese → 8+ formati, 12-15 a settimana, lettura al giorno 3.

### Decidere su una creatività
- Zero spesa dopo 72h → uccidi: non compete in asta, non è un problema di budget.
- Spesa con CPA oltre 1,5× il target → uccidi o itera; se il CTR è alto ma il CPA no il problema è a valle (offerta o pagina), non la creatività.
- CPA fra 1,0× e 1,5× → itera cambiando UN solo elemento (headline, fondo, elemento di prova).
- CPA a target o sotto con spesa in crescita → promuovi in evergreen e apri la trasposizione.
Aspettative diverse per fase: le TOF (meme, UGC, lo-fi) hanno CTR alto, CVR basso e CPA alto — servono a comprare traffico a poco; le BOF (Product Hero, Offerta) hanno CTR basso e CVR alto. Non uccidere una TOF perché non converte come una BOF.

### Stanchezza creativa
I segnali arrivano in quest'ordine: frequenza sopra 2,5-3 sul freddo → CTR in calo oltre il 25% dal picco → CPM in salita oltre il 20% a parità di pubblico → CPA fuori soglia. Il momento per intervenire è il secondo, non il quarto.

### Brand premium / scontrino alto
Se il brand è premium o di lusso metà del repertorio è controindicata: escludi Ugly/Lo-Fi, Meme, Offerta aggressiva e Prima & Dopo. Presidia Product Hero curato, Feature Callout su costruzione e materiali, Griglia editoriale, Social Proof sobria, Listicle come "perché costa questo", Noi vs Loro contro la categoria. Sostituisci l'asse OFFERTA con un asse ACCESSO: nuova collezione, su misura, appuntamento, edizione limitata, lista d'attesa — stessa funzione psicologica dell'urgenza senza toccare il prezzo. Con poche centinaia di ordini all'anno il CPA per singola creatività non è leggibile: giudica su segnali intermedi e leggi la performance a livello di account su finestre da 30 giorni.

### Produrre una statica: brief, resa, controllo
Un brief per una statica è completo quando chi lo riceve (designer o modello di immagini) non deve fare domande: HEADLINE sotto le 8 parole nella voce del brand · SOTTOTITOLO di una riga · ELEMENTO DI PROVA (numero, stelle, recensione, certificazione) preso SOLO dai dati del brand, mai inventato · LAYOUT (posizione del prodotto, del testo, fondo) · DIREZIONE VISIVA (composizione, punto focale, palette in hex, tipografia) · CTA con testo e posizione · CANVAS · COSA EVITARE · PROMPT DI RESA pronto da incollare. La headline è l'elemento più grande e deve reggere da sola: non comincia mai con un articolo, un possessivo ("Il nostro…") o un imperativo da catalogo ("Scopri…").
Le regole di resa si scrivono UNA volta e si incollano in testa a ogni prompt immagine: colori solo dagli hex del brand, packaging identico alla foto di riferimento (forma, etichetta, logo, tappo), prodotto ad almeno il 25% del quadro, lista negativa esplicita (niente testo oltre a quello indicato, niente watermark, niente prodotti o forme inventate, niente colori fuori palette).
Prima di pagare l'immagine si giudica la copy su cinque dimensioni da 1 a 5 — gancio, lingua del cliente, obiezione sciolta, chiarezza del prodotto, chiusura — e sotto 15/25 non si renderizza: una copy costa venti volte meno di una scena. Dopo la resa il controllo ha STATI DI FALLIMENTO, non pareri: headline con refusi o oltre 8 parole; cifre o asterischi sbagliati; CTA illeggibile al 25% di zoom (la miniatura del feed); packaging diverso dalla reference; due creatività del set indistinguibili (stesso layout + stesso bilanciamento colore + stesso peso di copy). Uno solo di questi = si rifà, con la correzione precisa scritta nel prompt.
Il punteggio dato prima si confronta poi con il rendimento reale: se le copy con punteggio alto hanno reso come quelle basse, il giudizio va ritarato sulle dimensioni che hanno davvero separato vincenti e perdenti. Diffida delle cadenze "30 varianti al giorno" o "22 varianti da un vincitore": presuppongono conti da centinaia di migliaia al mese, e le varianti di sola headline sulla stessa immagine sono la duplicazione che il paragrafo sopra vieta. Il numero si ricava sempre dal calcolo sul budget.

### Specifiche
Feed quadrato 1080×1080 (ideale 1440×1440, 1:1, copre circa l'80% dei posizionamenti) · Feed verticale 1080×1350 (ideale 1440×1800, 4:5, più superficie e CTR leggermente più alto) · Storie/Reels 1080×1920 (ideale 1440×2560, 9:16, zona sicura 14% in alto, 20-35% in basso, 6% ai lati) · sotto 30MB, JPG o PNG, più risoluzione sopravvive meglio alla compressione.

Convenzione di naming per rendere leggibili le performance per formato/angolo/persona: CLIENTE_FORMATO_ANGOLO_PERSONA_AAAA-MM-GG_V1.
`
