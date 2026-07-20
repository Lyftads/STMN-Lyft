// ── Contenuti del Centro Assistenza (guide per ogni tab) ────────────────────
// Sorgente unica delle guide. Ogni articolo è collegato a una tab (campo `tab`)
// così dal pop-up si può aprire direttamente la sezione. Contenuto in italiano
// (lingua principale dell'app); la traduzione integrale degli articoli è un
// follow-up — la UI del Centro è già multilingua.
//
// Struttura sezione: { h: 'Titolo', p: 'paragrafo' } oppure { h, list: [...] }.
// Le voci di `list` sono frasi complete e discorsive, non etichette secche.

export const HELP_CATEGORIES = ['gettingStarted', 'features', 'advanced']

const A = (o) => o

export const HELP_ARTICLES = [
  // ── COMMERCE ──────────────────────────────────────────────────────────
  A({ id: 'onboarding', tab: 'onboarding', icon: 'rocket', group: 'Commerce', category: 'gettingStarted',
    title: 'Onboarding', summary: 'La procedura guidata che collega le tue fonti dati e accende l\'intera piattaforma in pochi minuti.',
    sections: [
      { h: 'Cos\'è e perché conta', p: 'L\'Onboarding è il punto di partenza di LyftAI: è qui che colleghi le fonti da cui la piattaforma legge tutto. Una volta connessi Shopify, Meta, Google e Klaviyo, ogni altra tab smette di essere "vuota" e inizia a popolarsi automaticamente con i tuoi dati reali. È un investimento di cinque minuti che sblocca settimane di analisi: senza queste connessioni, moduli come Dashboard, Clienti o KPI Brain non hanno nulla da mostrare, perché non esistono dati da elaborare.' },
      { h: 'Cosa colleghi, nel dettaglio', list: [
        'Shopify è la fonte base e va collegata per prima: porta dentro ordini, prodotti, clienti, livelli di inventario e i report di vendita. È ciò che alimenta Dashboard, Inventario, Performance prodotti, Costi prodotto, Clienti e LTV.',
        'Meta Ads si collega via OAuth e porta campagne, gruppi di inserzioni, creatività, spesa, ROAS e i segmenti di pubblico usati per il CAC.',
        'Google Ads + GA4 portano le campagne search/shopping/PMax, le conversioni, il valore e i dati realtime dei visitatori che vedi nel globo della Dashboard.',
        'Klaviyo è opzionale ma consigliato: porta i ricavi e le performance di email e SMS, e si lega alle campagne che generi nella tab Clienti.',
      ] },
      { h: 'Come si fa, passo per passo', list: [
        'Apri Shopify e nella configurazione dell\'app assegna gli scope di sola LETTURA: read_orders, read_products, read_customers, read_inventory, read_reports, read_discounts, read_fulfillments. Sono permessi di lettura: LyftAI non modifica mai il tuo store.',
        'Torna in Onboarding e completa la connessione Shopify: quando è a posto la riga diventa verde.',
        'Collega Meta e Google con il login OAuth. Autorizzi una sola volta e la connessione resta attiva; assicurati di selezionare l\'account pubblicitario corretto se ne hai più di uno.',
        'Aggiungi Klaviyo se fai email marketing, incollando la API key richiesta.',
        'Verifica che tutte le righe siano verdi: a quel punto la piattaforma è pienamente operativa.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Parti sempre da Shopify: è la connessione che sblocca il maggior numero di tab, quindi ti dà subito il valore più alto.',
        'Usa un account con permessi da amministratore sui canali ads, altrimenti l\'OAuth potrebbe non concedere tutti i dati e alcune metriche resteranno vuote.',
        'Se mesi dopo una tab smette di mostrare dati, il primo posto da controllare è qui: spesso un canale ha perso l\'autorizzazione (password cambiata, permessi revocati) e basta riconnetterlo.',
      ] },
      { h: 'Domande frequenti', list: [
        'LyftAI può modificare il mio store? No. Tutti gli scope richiesti sono di sola lettura: la piattaforma legge i dati ma non crea, modifica o cancella nulla su Shopify.',
        'Devo per forza collegare tutto? No. Puoi collegare solo ciò che usi: se non fai Google Ads, salta Google. Le tab che dipendono da canali non collegati semplicemente non compaiono o restano vuote.',
        'Quanto tempo serve perché arrivino i dati? Shopify è quasi immediato; per gli ads i primi dati arrivano in genere entro pochi minuti dalla connessione.',
      ] },
    ] }),
  A({ id: 'dashboard', tab: 'dashboard', icon: 'grid', group: 'Commerce', category: 'gettingStarted',
    title: 'Dashboard', summary: 'La fotografia quotidiana del business: vendite, ordini, clienti e pubblicità in un solo colpo d\'occhio.',
    sections: [
      { h: 'Cos\'è e quando usarla', p: 'La Dashboard è il quadro di sintesi che riassume i numeri chiave del periodo selezionato. È pensata per essere la prima cosa che apri ogni mattina: ti dice in trenta secondi "come sta andando" — quanto stai vendendo, se gli ordini crescono, quanto stai spendendo in pubblicità e con che ritorno. Non è il posto per le analisi profonde (per quelle ci sono le tab specializzate), ma è il termometro quotidiano che ti dice se c\'è qualcosa di urgente da approfondire.' },
      { h: 'Cosa mostra', list: [
        'I KPI di vendita del periodo: ricavi totali, numero di ordini e scontrino medio (AOV), così capisci subito volume e valore medio.',
        'La distinzione tra nuovi clienti e clienti di ritorno, con i rispettivi resi: è il primo segnale della salute della tua base clienti.',
        'La spesa pubblicitaria e il ROAS su Meta e Google, per sapere se gli investimenti stanno rendendo nel periodo.',
        'Un globo 3D che mostra i visitatori del sito in tempo reale, alimentato dai dati realtime di GA4: utile per vedere "il polso" del traffico mentre lanci una campagna o una promo.',
      ] },
      { h: 'Come funziona', list: [
        'Il time frame in alto a destra comanda tutto: cambiandolo, ricavi, ordini, spesa e ROAS si ricalcolano sul periodo scelto. Confronta sempre col periodo precedente per leggere il trend, non solo il valore assoluto.',
        'Ogni numero ha una fonte precisa: vendite e resi da Shopify, pubblicità da Meta e Google, traffico realtime da GA4. Se una card è vuota, di solito è il canale corrispondente a non essere collegato.',
        'Per scelta di design le card colorano solo le variazioni percentuali (verde se migliora, rosso se peggiora) mentre i valori restano bianchi: così l\'occhio va subito sul trend senza essere distratto.',
        'I dati sono in cache per aprirsi all\'istante e si aggiornano in background, quindi quello che vedi è recente ma potrebbe rinfrescarsi pochi secondi dopo l\'apertura.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Usala come check rapido, non come strumento d\'analisi: se un numero ti insospettisce, aprilo nella tab dedicata (KPI Brain per il marketing, Performance prodotti per i margini, Clienti per la retention).',
        'Guarda sempre il rapporto nuovi/ritorno: un business sano non vive solo di acquisizione, e questo è il primo posto dove te ne accorgi.',
        'Se il ROAS scende ma le vendite tengono, non farti prendere dal panico: incrocia con Attribuzione e LTV prima di tagliare budget.',
      ] },
      { h: 'Risoluzione problemi', list: [
        'I resi di nuovi/ritorno restano a zero: quasi sempre è un problema di connessione Shopify, perché quel dato arriva dal breakdown degli ordini per tipo cliente. Riconnetti Shopify e ricontrolla.',
        'Il globo è vuoto: serve GA4 collegato e traffico realtime attivo sul sito in quel momento; di notte o con poco traffico può essere normale vederlo spoglio.',
      ] },
    ] }),
  A({ id: 'inventory', tab: 'inventory', icon: 'box', group: 'Commerce', category: 'features',
    title: 'Inventario', summary: 'Intelligence sullo stock per taglia e SKU: quando vai in stockout, quali taglie sono "rotte" e quante vendite stai perdendo in euro.',
    sections: [
      { h: 'Cos\'è e perché è diverso da un magazzino normale', p: 'L\'Inventario non è una semplice lista delle giacenze: è uno strumento di intelligence che prende lo stock di Shopify a livello di singola variante (la taglia, il colore, lo SKU) e lo trasforma in decisioni. Ti dice quando finirai un prodotto in base a quanto vende davvero di recente, quali curve taglie hanno buchi che ti fanno perdere vendite, e soprattutto ordina tutto per impatto economico: non per "quante unità mancano", ma per quanti euro rischi di lasciare sul tavolo. È ispirato agli strumenti di stock intelligence dei grandi brand ma pensato per il tuo catalogo.' },
      { h: 'Cosa ti mostra', list: [
        'I giorni-a-stockout per ogni variante, calcolati con una velocità di vendita pesata sui giorni recenti: così un prodotto che ha accelerato nelle ultime settimane viene segnalato prima, anche se la media storica era lenta.',
        'Le "taglie rotte" (broken sizes): prodotti dove mancano una o due taglie centrali della curva, situazione che spesso uccide le vendite dell\'intero articolo perché il cliente non trova la sua misura.',
        'Il valore dell\'inventario a costo (COGS) e la quantità totale a magazzino, per capire quanto capitale hai immobilizzato.',
        'Le vendite perse stimate in euro per gli articoli già esauriti: il numero che traduce lo stockout in soldi mancati e ti aiuta a dare priorità ai riassortimenti.',
        'Una matrice taglie per prodotto, ideale per apparel e accessori, con le celle colorate in base al rischio (rosso critico, ambra attenzione, verde ok).',
      ] },
      { h: 'Come funziona il calcolo', list: [
        'La velocità di vendita è "pesata sul recente": le ultime settimane contano più dei mesi passati, perché riflettono la domanda attuale e la stagionalità in corso.',
        'La priorità non è data dai giorni residui ma dagli euro a rischio: un best seller con 10 giorni di stock pesa più di un prodotto lento con 3 giorni, perché ti fa perdere molto di più.',
        'I costi (COGS) per il valore di magazzino e per le stime di margine arrivano dalla tab Costi prodotto: se non li hai impostati, alcuni numeri restano parziali o assenti.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Riassortisci seguendo l\'ordine degli euro a rischio, non l\'istinto: lo strumento è costruito apposta per evitare di riordinare il prodotto sbagliato.',
        'Controlla regolarmente le taglie rotte: spesso basta rimettere in stock una o due misure per "resuscitare" un prodotto che sembrava in calo.',
        'Tieni i costi landed aggiornati nella tab Costi prodotto, altrimenti le vendite perse e i margini saranno stime imprecise.',
      ] },
    ] }),
  A({ id: 'productPerformance', tab: 'productPerformance', icon: 'chart-bar', group: 'Commerce', category: 'features',
    title: 'Performance prodotti', summary: 'Un vero conto economico per singolo prodotto: ricavo netto, COGS, pubblicità allocata, margine operativo e ROAS.',
    sections: [
      { h: 'Cos\'è e perché ti serve', p: 'Il fatturato di un prodotto ti dice solo metà della storia. Performance prodotti costruisce un P&L per ogni articolo del catalogo: parte dal ricavo netto, sottrae il costo del venduto e — la parte che pochi strumenti fanno — alloca anche la spesa pubblicitaria, così vedi il margine operativo reale. È lo strumento che ti svela quali prodotti ti fanno davvero guadagnare e quali, pur vendendo tanto, bruciano marginalità in advertising senza lasciarti nulla.' },
      { h: 'Cosa contiene ogni riga prodotto', list: [
        'Il ricavo netto e il COGS, da cui nasce il margine lordo dell\'articolo.',
        'La quota di spesa ADS (Meta + Google) attribuita a quel prodotto, che pesa sul margine operativo finale.',
        'Il margine operativo, cioè quanto resta davvero dopo costi del prodotto e pubblicità: è il numero che conta per le decisioni.',
        'Il ROAS per prodotto e la variazione Δ rispetto al periodo precedente, per vedere chi sta migliorando e chi peggiorando.',
      ] },
      { h: 'Come vengono allocati gli ADS', list: [
        'In modalità stima, la spesa pubblicitaria si distribuisce sui prodotti in proporzione al ricavo che generano: semplice e immediato, ma approssimato.',
        'In modalità precisa, mappando le campagne ai prodotti, ogni euro di spesa va sul prodotto giusto: richiede un po\' di setup ma rende il margine operativo molto più affidabile.',
        'Il calcolo è focalizzato sul B2C diretto: esclude spedizione e marketplace esterni per non sporcare il quadro.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Investi un po\' di tempo nella mappatura campagna→prodotto: trasforma una stima in un dato su cui puoi davvero decidere il budget.',
        'Non innamorarti dei best seller per fatturato: controlla il margine operativo, perché alcuni vendono tanto ma lasciano pochissimo dopo gli ADS.',
        'I prodotti con margine operativo costantemente negativo vanno ripensati: prezzo, costo d\'acquisto o spesa pubblicitaria — qualcosa non torna.',
      ] },
    ] }),
  A({ id: 'productCosts', tab: 'productCosts', icon: 'money', group: 'Commerce', category: 'features',
    title: 'Costi prodotto', summary: 'L\'editor del costo "landed" per variante: è la base che rende affidabili margini, P&L e LTV in tutta la piattaforma.',
    sections: [
      { h: 'Cos\'è e perché è il fondamento di tutto', p: 'Costi prodotto è la tab dove imposti quanto ti costa davvero ogni variante "a terra" (landed cost): non solo il prezzo d\'acquisto, ma anche dazi e spedizione in entrata. Sembra una tab tecnica e secondaria, ma è il fondamento di mezza piattaforma: ogni volta che vedi un margine, una vendita persa o un LTV Netto, dietro c\'è il numero che imposti qui. Costi sbagliati o mancanti significano margini sbagliati ovunque.' },
      { h: 'Cosa ti permette di fare', list: [
        'Impostare il costo landed di ogni variante, con uno storico inline che conserva ogni modifica e la sua data.',
        'Lasciare che il sistema sincronizzi automaticamente i cambi di costo da Shopify, sia all\'apertura della tab sia con un job notturno, così non devi inserire tutto a mano.',
        'Forzare un override manuale quando il costo che arriva da Shopify non è completo o non considera dazi e logistica.',
      ] },
      { h: 'Come funziona lo storico', list: [
        'Ogni salvataggio non sovrascrive il valore precedente: crea una nuova riga con una data di validità. Così gli ordini di marzo usano il costo di marzo e quelli di oggi il costo di oggi.',
        'Il costo "corrente" è semplicemente quello con la data più recente.',
        'Questi valori alimentano i COGS dell\'Inventario, il margine di Performance prodotti, le vendite perse e l\'LTV Netto: aggiornarli qui migliora tutto il resto.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Aggiorna i costi ogni volta che cambi fornitore o che variano i prezzi d\'acquisto: bastano pochi minuti e mantengono affidabile l\'intera piattaforma.',
        'Includi sempre dazi e spedizione in entrata nel landed cost: è la differenza tra un margine "sulla carta" e il margine reale che incassi.',
      ] },
    ] }),
  A({ id: 'kpiBrain', tab: 'kpiBrain', icon: 'chart-line', group: 'Commerce', category: 'features',
    title: 'KPI Brain', summary: 'Tutti i KPI di marketing cross-canale in un cervello unico, con sparkline, variazioni rispetto al periodo precedente e CAC per segmento.',
    sections: [
      { h: 'Cos\'è', p: 'KPI Brain è la centrale di controllo del marketing: raccoglie in un\'unica vista i KPI di Shopify, Meta e Google, ognuno con il confronto rispetto allo stesso periodo precedente. Invece di saltare tra tre piattaforme diverse, qui vedi tutto insieme e capisci al volo cosa sta migliorando e cosa peggiorando. È il punto da cui parti per la diagnosi prima di scendere nel dettaglio per singolo canale.' },
      { h: 'Cosa trovi', list: [
        'Card KPI separate per Shopify (vendite, ordini, AOV), Meta Ads e Google Ads (spesa, ROAS, conversioni e altro).',
        'Il CAC dei nuovi clienti per canale, costruito sui segmenti di pubblico di Meta e su Google, per capire quanto ti costa davvero acquisire.',
        'Sparkline e variazione percentuale rispetto allo stesso periodo precedente su ogni metrica, così leggi il trend e non solo il numero isolato.',
        'Pannelli dedicati al CAC per segmento, che ti dicono quali pubblici ti portano clienti nuovi al costo più basso.',
      ] },
      { h: 'Come funziona', list: [
        'Tutto è legato al time frame in alto: cambiandolo, ogni KPI e ogni confronto si ricalcolano sul periodo scelto.',
        'I dati sono in cache (SWR) per aperture istantanee, con un refresh in background che li mantiene aggiornati.',
        'Una precisazione onesta sul CAC: su Meta è esatto perché la piattaforma fornisce il breakdown nativo per segmento; su Google è parziale, perché Google segmenta solo le conversioni e non il costo. Tienilo a mente quando confronti i due canali.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Comincia sempre da qui la tua analisi settimanale: ti dà la mappa generale prima di entrare in Meta KPI o Google KPI per il dettaglio.',
        'Usa il CAC per segmento per decidere dove spingere l\'acquisizione: spostare budget verso i segmenti a CAC più basso è spesso la leva più rapida.',
      ] },
    ] }),
  A({ id: 'attribution', tab: 'attribution', icon: 'target', group: 'Commerce', category: 'advanced',
    title: 'Attribuzione', summary: 'Capisci quali canali generano davvero le vendite mettendo a confronto spesa e ricavi per fonte.',
    sections: [
      { h: 'Cos\'è e cosa risolve', p: 'Ogni canale rivendica il merito delle stesse vendite: Meta dice che è merito suo, Google pure, e intanto l\'email e l\'organico fanno la loro parte in silenzio. L\'Attribuzione mette a confronto spesa e ricavi per fonte nello stesso periodo, così ti fai un\'idea più equilibrata di chi sta davvero contribuendo, invece di fidarti ciecamente del numero che ogni piattaforma si auto-assegna.' },
      { h: 'Cosa mostra', list: [
        'Il confronto tra i canali principali — Meta, Google, organico, email — nello stesso intervallo di tempo.',
        'Vendite, spesa e ROAS per ciascuna fonte, per vedere chi rende e chi solo costa.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Non guardarla mai da sola: incrociala con KPI Brain e con LTV, perché un canale può avere un ROAS immediato basso ma portare clienti che valgono molto nel tempo.',
        'Trattala come una bussola, non come una verità assoluta: nessun modello di attribuzione è perfetto, serve a orientare le decisioni di budget, non a chiuderle.',
      ] },
    ] }),
  A({ id: 'ltvCohorts', tab: 'ltvCohorts', icon: 'layers', group: 'Commerce', category: 'features',
    title: 'LTV & Coorti', summary: 'Il valore dei clienti nel tempo per coorte d\'acquisizione, con LTV lordo e netto, CAC e il rapporto LTV:CAC.',
    sections: [
      { h: 'Cos\'è e perché è strategica', p: 'LTV & Coorti raggruppa i clienti per il mese in cui hanno fatto il primo acquisto (la "coorte") e segue come si comportano nel tempo: quanti ricomprano, quanti ordini fanno, quanto valgono. È la tab che risponde alla domanda più importante per un e-commerce sano: "l\'acquisizione che sto pagando si ripaga davvero nel tempo?". Senza questa lettura rischi di scalare un business che sembra crescere ma perde soldi a ogni cliente.' },
      { h: 'Cosa contiene', list: [
        'L\'LTV Lordo (il ricavo lifetime medio per cliente) e l\'LTV Netto, che applica il margine reale e quindi dice quanto quel cliente vale davvero a margine.',
        'Il CAC (spesa pubblicitaria diviso nuovi clienti) e il rapporto LTV:CAC, il numero che ti dice in una cifra se il modello è sostenibile.',
        'Per ogni coorte: repeat rate, ordini per cliente e il tempo che intercorre fino al secondo ordine.',
        'I totali: clienti acquisiti, clienti che hanno comprato una sola volta e fatturato complessivo delle coorti.',
        'Un controllo del margine lordo, che puoi impostare a mano o lasciare calcolare automaticamente dai Costi prodotto.',
      ] },
      { h: 'Come funziona', list: [
        'Usa gli aggregati lifetime di Shopify, quindi vede lo storico completo dei clienti e non è soggetta al limite dei 60 giorni delle API ordini.',
        'L\'LTV Netto diventa "reale" solo se hai impostato i Costi prodotto: in caso contrario applica una stima di margine che puoi correggere a mano.',
        'Puoi ampliare la finestra d\'analisi (6, 12, 18 o 24 mesi) per vedere come maturano le coorti più vecchie.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Punta a un rapporto LTV:CAC di almeno 3: se sei sotto, o l\'acquisizione costa troppo o il margine è troppo basso, e scalare peggiorerebbe le cose.',
        'Imposta i Costi prodotto per passare da LTV Netto stimato a reale: cambia completamente l\'affidabilità delle decisioni.',
        'Lavora sul "tempo al secondo ordine": accorciarlo è una delle leve più potenti che esistano sull\'LTV, perché anticipa e aumenta il valore di ogni coorte.',
      ] },
    ] }),
  A({ id: 'clienti', tab: 'clienti', icon: 'users', group: 'Commerce', category: 'features',
    title: 'Clienti', summary: 'Segmentazione RFM automatica dei clienti, analytics nel tempo, insight AI e campagne pronte in un click via Klaviyo.',
    sections: [
      { h: 'Cos\'è', p: 'La tab Clienti è il vero "layer d\'azione" sui tuoi clienti. Non si limita a mostrarti dei numeri: prende l\'intera base clienti, la divide automaticamente per ciclo di vita usando il modello RFM (recency, frequency, monetary) e ti mette in mano lo strumento per agire — campagne mirate generate dall\'AI nel tono del tuo brand. In pratica unisce l\'analisi di uno strumento di retention con l\'esecuzione di un copywriter, in un\'unica schermata.' },
      { h: 'I sei segmenti e cosa significano', list: [
        'Nuovi: hanno fatto il primo ordine di recente. Vanno accolti e accompagnati verso il secondo acquisto.',
        'Potenziali fedeli: stanno comprando più volte di recente, sono in crescita. Vanno consolidati prima che si raffreddino.',
        'Fedeli: ordinano spesso e con regolarità. Sono il cuore del business e vanno premiati, non dati per scontati.',
        'Fedeli a rischio: erano clienti affezionati ma hanno smesso di ordinare da un po\'. Sono il segmento a maggior valore recuperabile: agire qui rende moltissimo.',
        'Stanno per dormire: il primo ordine è di qualche tempo fa e si stanno raffreddando. Una spinta tempestiva può riattivarli.',
        'Dormienti: hanno comprato molto tempo fa e sono inattivi. Richiedono un\'offerta forte di win-back.',
      ] },
      { h: 'Le tre viste', list: [
        'Panoramica: i KPI principali (clienti totali, CLV, ordini per cliente, giorni tra gli ordini, scontrino medio) con lo split tra nuovi e di ritorno, più la tabella con le metriche di ogni segmento.',
        'Analytics: i grafici nel tempo in stile dashboard di retention — clienti, tasso di retention, valore cliente (CLV), distribuzione per segmento e variazioni settimana su settimana.',
        'Insight: la Squadra AI legge i tuoi dati e ti restituisce una sintesi in linguaggio naturale più raccomandazioni proattive, ognuna con priorità, motivazione, impatto e azione diretta.',
      ] },
      { h: 'Come funziona', list: [
        'I dati arrivano tramite Shopify Bulk Operations: significa che la piattaforma legge TUTTI i tuoi clienti in un colpo solo, senza limiti di paginazione e senza i rallentamenti che avevano gli altri metodi, anche se hai centinaia di migliaia di clienti.',
        'Cliccando su un segmento si apre l\'elenco dei suoi clienti, con una barra di ricerca per nome o email.',
        'Il pulsante "Crea campagna" genera oggetto, anteprima e corpo dell\'email nel tono del tuo brand, pronti da copiare e incollare in Klaviyo: l\'invio resta sempre una tua scelta.',
        'Il pulsante "Ricostruisci storico" rigioca gli ordini passati per popolare immediatamente i grafici nel tempo, senza dover aspettare che lo storico si accumuli settimana dopo settimana.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Concentra l\'energia sui segmenti a maggior valore recuperabile — Fedeli a rischio e Dormienti — perché lì ogni cliente recuperato vale molto e lo strumento te lo quantifica.',
        'Usa la vista Insight come punto di partenza operativo: ti dice non solo cosa succede ma cosa fare prima e perché.',
        'Tratta i due estremi del ciclo come leve sull\'LTV: premia i Fedeli per farli durare e accompagna i Nuovi al secondo acquisto per non perderli.',
      ] },
      { h: 'Domande frequenti', list: [
        'Le email vengono inviate in automatico? No. LyftAI genera il copy e ti dà gli indirizzi del segmento, ma l\'invio lo fai tu da Klaviyo: mantieni sempre il controllo.',
        'Perché alcuni grafici sono vuoti? Perché lo storico si costruisce nel tempo. Premi "Ricostruisci storico" per generarlo subito dagli ordini passati.',
        'Come vengono decisi i segmenti? In base a quanto di recente un cliente ha ordinato e a quante volte ha ordinato. Sono soglie ragionevoli e standard del modello RFM.',
      ] },
    ] }),
  A({ id: 'klaviyo', tab: 'klaviyo', icon: 'mail', group: 'Commerce', category: 'features',
    title: 'Klaviyo', summary: 'Le performance di email e SMS marketing e i flussi automatici che generano ricavo, portati dentro LyftAI.',
    sections: [
      { h: 'Cos\'è', p: 'Questa tab collega il tuo account Klaviyo e ne porta dentro LyftAI le metriche: quanto fattura il canale email/SMS, come vanno le singole campagne e — spesso la parte più importante — quanto rendono i flussi automatici. Ti permette di tenere il polso del canale che, in un e-commerce maturo, è di solito il più redditizio in rapporto al costo.' },
      { h: 'Cosa mostra', list: [
        'I ricavi generati da email e SMS e la loro quota sul fatturato totale, per capire quanto pesa davvero il canale.',
        'Le performance di campagne e flussi automatici — benvenuto, carrello abbandonato, post-acquisto, win-back — uno per uno.',
        'L\'andamento del canale nel tempo, per vedere se sta crescendo o perdendo terreno.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Incolla qui i segmenti che generi nella tab Clienti: il flusso naturale è "segmenta in Clienti → crea il copy con l\'AI → invia da Klaviyo a quel segmento".',
        'Controlla che tutti i flussi automatici siano attivi: sono la parte di email marketing che lavora per te 24 ore su 24 e spesso vale più delle campagne manuali.',
      ] },
    ] }),

  // ── PRODUCTIVITY AI ───────────────────────────────────────────────────
  A({ id: 'tasks', tab: 'tasks', icon: 'kanban', group: 'Productivity AI', category: 'features',
    title: 'Progetti & Task', summary: 'Una board Kanban multi-utente per organizzare il lavoro del team, con ruoli, assegnazioni e accessi dedicati.',
    sections: [
      { h: 'Cos\'è', p: 'Progetti & Task è il gestionale operativo del team dentro LyftAI: una board Kanban dove le attività si muovono tra colonne, si assegnano alle persone e avanzano sotto gli occhi di tutti. L\'idea è non dover uscire dalla piattaforma per coordinare il lavoro che nasce proprio dai dati e dalle raccomandazioni che vedi nelle altre tab.' },
      { h: 'Cosa include', list: [
        'Una board Kanban con colonne e schede che trascini da uno stato all\'altro man mano che il lavoro avanza.',
        'La gestione multi-utente con ruoli e login reali tramite invito via email, così ognuno vede e fa ciò che gli compete.',
        'L\'assegnazione di un responsabile a ogni scheda e il monitoraggio dello stato di avanzamento.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Trasforma in task le raccomandazioni che arrivano dagli Insight dei Clienti e dalla Coda Azioni: è il modo per non lasciare che i suggerimenti restino lettera morta.',
        'Tieni il flusso semplice (Da fare / In corso / Fatto): le board troppo elaborate vengono abbandonate.',
      ] },
    ] }),
  A({ id: 'timeTracking', tab: 'timeTracking', icon: 'clock', group: 'Productivity AI', category: 'features',
    title: 'Lyftimer', summary: 'Un time-tracker professionale con timer live, timesheet e totali per persona e per progetto.',
    sections: [
      { h: 'Cos\'è', p: 'Lyftimer ti permette di tracciare quanto tempo dedichi a ciascun progetto e attività, con un timer che parte in tempo reale e dei riepiloghi che trasformano le ore in informazione utile. Serve a rispondere a una domanda che spesso si ignora: quanto mi costa davvero, in tempo, mandare avanti questo cliente o questo progetto?' },
      { h: 'Cosa include', list: [
        'Un timer live a cui agganci progetto, task e una breve descrizione di cosa stai facendo.',
        'Un timesheet che raccoglie le sessioni e calcola i totali per persona e per progetto.',
        'Lo storico delle ore, utile per consuntivi e per valutare la redditività del lavoro.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Avvia il timer all\'inizio dell\'attività, non a fine giornata ricostruendo a memoria: i dati a memoria sono sempre sbagliati.',
        'Collega le ore ai progetti giusti per misurare la marginalità reale: un cliente che fattura tanto ma assorbe ore infinite può essere meno redditizio di uno piccolo ed efficiente.',
      ] },
    ] }),
  A({ id: 'chat', tab: 'chat', icon: 'chat', group: 'Productivity AI', category: 'features',
    title: 'LyftTalk', summary: 'La chat dove parli direttamente con i tuoi dati e con la Squadra AI: domande, strategie e brainstorming.',
    sections: [
      { h: 'Cos\'è', p: 'LyftTalk è l\'assistente conversazionale di LyftAI. A differenza di un chatbot generico, qui l\'AI legge i tuoi dati reali: puoi chiedere "perché le vendite sono calate questa settimana?" e ottenere una risposta basata sui tuoi numeri, non su frasi fatte. È anche il luogo dove vivono gli agenti della Squadra AI, che puoi interpellare per nome.' },
      { h: 'Cosa include', list: [
        'Una chat con un consulente AI che ha accesso ai tuoi dati live e risponde sui numeri concreti.',
        'L\'accesso agli agenti specializzati della Squadra AI, che chiami semplicemente nominandoli.',
        'Risposte ancorate alla tua realtà, pensate per essere azionabili e non generiche.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Una delle domande più utili è "cosa faresti questa settimana?": ti costringe l\'AI a darti priorità concrete invece di analisi astratte.',
        'Più contesto fornisci nella domanda, più la risposta è precisa: specifica periodo, canale o prodotto quando puoi.',
      ] },
    ] }),
  A({ id: 'team', tab: 'team', icon: 'users', group: 'Productivity AI', category: 'advanced',
    title: 'Squadra AI', summary: 'Un team di otto agenti tra C-suite e specialisti, ognuno con il proprio ruolo, competenza e personalità.',
    sections: [
      { h: 'Cos\'è', p: 'La Squadra AI è come avere un piccolo team di consulenti sempre disponibile: c\'è chi ragiona da CEO, chi da head of performance, chi da copywriter, chi da creativo, chi da analista. Ognuno risponde nel proprio ruolo e con il proprio tono, e c\'è una gerarchia con un capo che coordina. Ti permette di guardare lo stesso problema da angolazioni diverse senza convocare riunioni.' },
      { h: 'Cosa include', list: [
        'Agenti specializzati con competenze e modi di esprimersi distinti, così le risposte non sono tutte uguali.',
        'Una gerarchia con una figura che coordina gli altri quando serve una visione d\'insieme.',
        'La possibilità di chiamarli per nome dentro LyftTalk per attivare quello giusto.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Indirizza la domanda all\'agente competente: il copy a chi fa copy, il budget a chi fa performance. Ottieni risposte molto più mirate.',
        'Usa più agenti sullo stesso tema quando devi prendere una decisione importante: i punti di vista diversi fanno emergere rischi che da soli non vedresti.',
      ] },
    ] }),
  A({ id: 'performanceAgent', tab: 'performanceAgent', icon: 'sparkle', group: 'Productivity AI', category: 'advanced',
    title: 'Performance Agent', summary: 'L\'agente che analizza le performance cross-canale e propone azioni concrete, con motivazione e impatto atteso.',
    sections: [
      { h: 'Cos\'è', p: 'Il Performance Agent è un analista automatico: passa in rassegna i tuoi dati di performance su tutti i canali e ti restituisce non un grafico, ma una lista di cose da fare. Per ogni suggerimento ti spiega perché lo propone e che impatto può avere, così non devi indovinare le priorità da solo.' },
      { h: 'Cosa include', list: [
        'Un\'analisi che attraversa i canali invece di fermarsi a uno solo, perché i problemi spesso nascono dall\'interazione tra ads, sito e prodotto.',
        'Raccomandazioni azionabili ordinate per priorità, così sai da dove partire.',
        'La spiegazione del perché di ogni azione e una stima dell\'impatto, per decidere con cognizione.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Manda le raccomandazioni nella Coda Azioni per approvarle ed eseguirle in modo ordinato.',
        'Esegui poche azioni per volta e misurane l\'effetto prima di passare alle successive: così capisci cosa funziona davvero.',
      ] },
    ] }),
  A({ id: 'creativeStudio', tab: 'creativeStudio', icon: 'sparkle', group: 'Productivity AI', category: 'features',
    title: 'Creative Studio', summary: 'Una board generativa chat-driven per creare immagini e creatività (video e UGC in arrivo) con il contesto del tuo brand.',
    sections: [
      { h: 'Cos\'è', p: 'Creative Studio è lo studio creativo AI di LyftAI: generi immagini e asset partendo dal contesto del tuo brand, organizzando il lavoro in ambienti (Studios) e usando una suite di editing. L\'obiettivo è produrre creatività on-brand senza uscire dalla piattaforma e senza ripartire ogni volta da zero.' },
      { h: 'Cosa include', list: [
        'Generazione di immagini con più modelli, arricchita dal contesto del cliente per output coerenti.',
        'Studios e ambienti dedicati, più una suite di editing avanzata per rifinire i risultati.',
        'Progetti e board in stile moodboard dove raccogli e organizzi le creatività.',
        'Un sistema di crediti gestito via Stripe per le generazioni.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Compila bene il Brand Identity prima di generare: il modello attinge da lì per restare nel tuo stile, e la differenza nei risultati è enorme.',
        'Parti da brief chiari — soggetto, mood, formato, eventuali riferimenti — perché un prompt vago produce immagini generiche.',
      ] },
    ] }),
  A({ id: 'actionQueue', tab: 'actionQueue', icon: 'bolt', group: 'Productivity AI', category: 'advanced',
    title: 'Coda Azioni', summary: 'Il centro di controllo dove approvi, modifichi o scarti le azioni proposte dall\'AI prima che vengano eseguite.',
    sections: [
      { h: 'Cos\'è', p: 'La Coda Azioni è il ponte tra "l\'AI ha capito cosa fare" e "qualcosa è stato fatto". Tutte le azioni che i moduli intelligenti propongono finiscono qui, in attesa della tua decisione: tu approvi, modifichi o scarti, e niente viene eseguito senza il tuo via libera. È la garanzia che l\'automazione resti sotto controllo umano.' },
      { h: 'Cosa include', list: [
        'L\'elenco delle azioni proposte, ordinate per priorità così affronti prima quelle che contano.',
        'Un meccanismo di approvazione ed esecuzione tracciato, per sapere sempre cosa è stato fatto e quando.',
        'Lo stato di ogni azione — in attesa, eseguita o scartata — per non perdere il filo.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Rivedi la coda con regolarità: gli insight migliori non valgono nulla se le azioni restano ferme qui.',
        'Usala con serenità: per costruzione nulla parte senza la tua approvazione, quindi puoi sperimentare senza rischi.',
      ] },
    ] }),

  // ── INTELLIGENCE WEBSITE ──────────────────────────────────────────────
  A({ id: 'cro', tab: 'cro', icon: 'funnel', group: 'Intelligence Website', category: 'features',
    title: 'CRO', summary: 'Il funnel di conversione del sito, giorno-preciso, costruito da GA4 e Shopify, con nuovi vs ritornanti e confronto col periodo.',
    sections: [
      { h: 'Cos\'è', p: 'La CRO (Conversion Rate Optimization) analizza come il traffico del sito si trasforma in vendite. La differenza chiave è che il funnel qui è reale, costruito sui dati di GA4 e Shopify per il periodo che scegli, non una stima moltiplicata a tavolino. Questo ti permette di vedere con precisione in quale passaggio perdi i visitatori e dove conviene intervenire.' },
      { h: 'Cosa mostra', list: [
        'Il funnel di conversione reale, costruito incrociando GA4 e Shopify, passo per passo.',
        'La distinzione tra visitatori nuovi e ritornanti, che convertono in modo molto diverso e vanno letti separatamente.',
        'Il confronto con il periodo precedente, per capire se stai migliorando o peggiorando.',
        'La possibilità di scegliere date arbitrarie (da/a) per analizzare esattamente l\'intervallo che ti interessa.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Individua lo step del funnel con il calo più ripido e concentra lì i test: è dove un piccolo miglioramento percentuale porta il maggior numero di vendite in più.',
        'Analizza nuovi e ritornanti separatamente: ottimizzare per chi già ti conosce è diverso dal conquistare chi arriva per la prima volta.',
      ] },
    ] }),
  A({ id: 'webScanner', tab: 'webScanner', icon: 'scan', group: 'Intelligence Website', category: 'features',
    title: 'AI Website Scanner', summary: 'Una scansione AI del sito che segnala problemi tecnici, di UX e di conversione, con suggerimenti pratici.',
    sections: [
      { h: 'Cos\'è', p: 'Lo Scanner passa al setaccio le pagine del tuo sito con l\'AI e ti restituisce una lista ragionata di criticità e opportunità: cose che rallentano, confondono o frenano la conversione, ognuna con un suggerimento concreto su come sistemarla. È come avere un consulente di UX e CRO che fa un primo giro del tuo sito al posto tuo.' },
      { h: 'Cosa include', list: [
        'Una scansione on-page con segnalazioni ordinate per priorità, così sai cosa guardare prima.',
        'Suggerimenti di ottimizzazione pratici, non generici, pensati per essere messi in opera.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Affronta per prime le segnalazioni ad alto impatto e basso sforzo: sono i "quick win" che migliorano i numeri subito.',
      ] },
    ] }),
  A({ id: 'seoAudit', tab: 'seoAudit', icon: 'search', group: 'Intelligence Website', category: 'features',
    title: 'SEO Audit', summary: 'La suite SEO completa: audit on-page e multipagina, Keyword AI, Editor, AEO, analisi competitor ed export PDF.',
    sections: [
      { h: 'Cos\'è', p: 'La SEO Audit è la cassetta degli attrezzi per la ricerca organica. Non è un singolo report, ma una suite: fai l\'audit tecnico e on-page, scopri keyword con l\'AI, lavori i contenuti nell\'Editor, controlli l\'AEO (ottimizzazione per le risposte dei motori AI) e analizzi i competitor. Tutto in un posto, con lo storico salvato per misurare i progressi.' },
      { h: 'Cosa include', list: [
        'Un audit on-page e multipagina con lo storico conservato, così confronti com\'era il sito prima e dopo i tuoi interventi.',
        'La Keyword AI per scoprire e prioritizzare le parole chiave, un Editor per lavorare i contenuti e una sezione AEO per l\'ottimizzazione verso i motori basati su AI.',
        'L\'analisi dei competitor per capire dove ti superano nella ricerca.',
        'L\'integrazione con Google Search Console per portare dentro i dati reali di ricerca (query e posizioni).',
        'L\'export PDF dell\'audit nella lingua del cliente, utile per condividerlo o archiviarlo.',
      ] },
      { h: 'Come funziona', list: [
        'Collega la Search Console dal pulsante dedicato: senza, lavori su analisi on-page; con, aggiungi i dati reali di come ti trovano gli utenti.',
        'I volumi di ricerca e i backlink avanzati richiedono fonti dati a pagamento: alcune metriche più spinte dipendono da quelle.',
        'Lo storico degli audit resta salvato, quindi puoi rifare l\'audit tra un mese e vedere nero su bianco cosa è migliorato.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Segui l\'ordine naturale: prima l\'audit per capire lo stato, poi l\'Editor per lavorare le keyword a maggior potenziale.',
        'Rifai l\'audit periodicamente: la SEO è un lavoro di accumulo e il valore si vede nel confronto nel tempo, non in un singolo scatto.',
      ] },
    ] }),
  A({ id: 'competitorIntel', tab: 'competitorIntel', icon: 'target', group: 'Intelligence Website', category: 'advanced',
    title: 'Competitor Intel', summary: 'Tieni d\'occhio i competitor raccogliendo le loro creatività dall\'Ad Library, il catalogo e i segnali di mercato.',
    sections: [
      { h: 'Cos\'è', p: 'Competitor Intel ti fa spiare (legalmente) la concorrenza: raccoglie le creatività pubblicitarie che i competitor hanno attive nell\'Ad Library e altre informazioni utili, così sai cosa stanno comunicando, con quali offerte e con che frequenza. È materiale prezioso per non restare indietro e per trovare angoli che il mercato sta già premiando.' },
      { h: 'Cosa include', list: [
        'Le creatività dall\'Ad Library dei competitor, salvate in una cache durevole così non devi riscaricarle ogni volta.',
        'Il catalogo e i segnali competitivi che aiutano a leggere le mosse della concorrenza.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Usa le creatività come ispirazione e non come modello da copiare: l\'obiettivo è capire il pattern, non replicare l\'annuncio.',
        'Cerca le ripetizioni: un angolo, un formato o un\'offerta che più competitor usano da tempo quasi certamente funziona, ed è un test che puoi fare anche tu.',
      ] },
    ] }),
  A({ id: 'priceComparison', tab: 'priceComparison', icon: 'scale', group: 'Intelligence Website', category: 'advanced',
    title: 'Prezzi vs Competitor', summary: 'Confronta il posizionamento di prezzo dei tuoi prodotti con quello dei concorrenti.',
    sections: [
      { h: 'Cos\'è', p: 'Questa tab mette i tuoi prezzi a fianco di quelli dei competitor per dirti, prodotto per prodotto o categoria per categoria, se sei caro, allineato o conveniente. Serve a prendere decisioni di pricing con i dati invece che a sensazione, evitando sia di lasciare margine sul tavolo sia di farti tagliare fuori da un prezzo troppo alto.' },
      { h: 'Cosa include', list: [
        'Il confronto dei prezzi per prodotto e per categoria.',
        'Una lettura del tuo posizionamento competitivo complessivo.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Non inseguire automaticamente il prezzo più basso: valuta il valore percepito e soprattutto il margine, perché vincere sul prezzo ma perdere marginalità è una vittoria di Pirro.',
      ] },
    ] }),
  A({ id: 'creativeIntel', tab: 'creativeIntel', icon: 'eye', group: 'Intelligence Website', category: 'advanced',
    title: 'Creative Intel', summary: 'Intelligence sulle creatività che funzionano nel mercato: angoli, hook e formati vincenti.',
    sections: [
      { h: 'Cos\'è', p: 'Creative Intel analizza le creatività pubblicitarie per estrarne i pattern che contano: quali angoli di comunicazione, quali hook iniziali e quali formati stanno catturando l\'attenzione nel tuo mercato. Ti dà la materia prima per i tuoi prossimi test creativi, partendo da ciò che già dimostra di funzionare invece che dal foglio bianco.' },
      { h: 'Cosa include', list: [
        'L\'analisi di creatività e angoli di comunicazione ricorrenti.',
        'Spunti concreti da trasformare nei tuoi prossimi test su Meta.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Trasforma ogni spunto in un test reale e poi misura: l\'ispirazione vale solo se la metti alla prova sui tuoi numeri.',
      ] },
    ] }),

  // ── META ──────────────────────────────────────────────────────────────
  A({ id: 'creative', tab: 'creative', icon: 'image', group: 'Meta', category: 'features',
    title: 'Creative (Meta)', summary: 'La libreria delle creatività Meta attive, ciascuna affiancata alle sue performance reali.',
    sections: [
      { h: 'Cos\'è e a cosa serve', p: 'Su Meta, oggi, è la creatività a fare la maggior parte del lavoro: con il targeting sempre più automatizzato, la differenza tra una campagna che rende e una che brucia budget sta quasi sempre nell\'immagine, nel video e nel messaggio. La tab Creative mette tutte le tue creatività attive una accanto all\'altra con i loro numeri, così smetti di chiederti "quale sta funzionando?" e lo vedi nero su bianco. È il punto di partenza di ogni ottimizzazione creativa.' },
      { h: 'Cosa mostra', list: [
        'L\'anteprima visiva di ogni creatività, così riconosci subito l\'asset senza dover decifrare nomi e codici.',
        'Le metriche chiave accanto a ciascuna: CTR (quanto cattura), ROAS (quanto rende), spesa (quanto sta assorbendo).',
        'L\'ordinamento per performance, per portare in cima le vincenti o, al contrario, far emergere quelle che stanno sprecando budget.',
      ] },
      { h: 'Come leggere i numeri insieme', list: [
        'CTR alto ma ROAS basso: la creatività attira il clic ma poi qualcosa non converte (offerta, landing page, pubblico sbagliato). Il problema spesso non è la creatività in sé.',
        'CTR basso ma ROAS buono: intercetta poche persone ma quelle giuste; potrebbe valere la pena testarne varianti per allargare la portata mantenendo la qualità.',
        'Spesa alta con ROAS basso: è il caso più urgente, perché stai pagando molto per poco. È la prima creatività da rivedere o mettere in pausa.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Incrocia questa vista con Creative Fatigue: qui vedi cosa rende poco, lì capisci cosa sta rendendo sempre meno perché si è "bruciato" per troppa esposizione.',
        'Non scalare mai una sola creatività vincente: confrontane diverse e cerca il pattern comune (l\'angolo, l\'hook, il formato), perché è quello che potrai replicare con nuove creatività.',
        'Giudica una creatività solo con spesa sufficiente alle spalle: poche decine di euro non bastano a dire se funziona, i numeri sono ancora troppo ballerini.',
      ] },
      { h: 'Domande frequenti', list: [
        'Perché due creatività con lo stesso ROAS valgono diversamente? Perché conta anche il volume: una che regge ROAS buono su spesa alta è molto più preziosa di una che lo regge su spesa minima e potrebbe crollare appena la scali.',
        'Devo mettere in pausa subito le peggiori? Non di riflesso: prima verifica che il problema sia la creatività e non la landing o l\'offerta, altrimenti cambi asset e il risultato non migliora.',
      ] },
    ] }),
  A({ id: 'metaDetail', tab: 'metaDetail', icon: 'list', group: 'Meta', category: 'features',
    title: 'Meta Detail', summary: 'Il dettaglio campagna per campagna delle tue inserzioni Meta, con tutti i KPI e il drill-down per segmento di pubblico.',
    sections: [
      { h: 'Cos\'è', p: 'Meta Detail è la vista analitica a livello di campagna del tuo account Meta: una tabella completa con tutti i KPI, ordinabile e filtrabile, più la possibilità di "aprire" ogni campagna per vedere come si comporta sui diversi segmenti di pubblico (Nuovo, Esistenti, Interagito, Sconosciuto). La domanda a cui risponde non è solo "quanto rende questa campagna?", ma "a chi sta rendendo?" — ed è proprio questa seconda informazione che di solito cambia le decisioni.' },
      { h: 'Cosa contiene', list: [
        'Una tabella con tutte le campagne e i loro KPI (spesa, acquisti, ROAS, CPC, CTR, CPM, frequenza e altro), allineati nelle stesse colonne per confrontarle a colpo d\'occhio.',
        'Filtri per stato (attive, in pausa…) e ordinamento per qualsiasi metrica, per isolare in fretta ciò che ti interessa.',
        'Il drill-down per segmento di pubblico, che espande la campagna mostrando i suoi numeri divisi per tipo di audience.',
      ] },
      { h: 'Come funziona il drill segmenti', list: [
        'Il dettaglio per segmento si attiva con un toggle esplicito e fa la chiamata API solo in quel momento: è una scelta voluta per non sprecare richieste e non rischiare i limiti orari di Meta finché non ti servono davvero quei dati.',
        'Una volta aperto, vedi sotto ogni campagna le righe per Nuovo, Esistenti, Interagito e Sconosciuto: è la stessa visualizzazione che hai dentro Meta, ma integrata con il resto della piattaforma.',
        'Come tutto il modulo Meta, ogni numero segue il time frame selezionato in alto.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Attiva il drill segmenti solo sulle campagne che stai analizzando davvero, per restare leggero sulle richieste API ed evitare throttling.',
        'Guarda con attenzione il segmento "Nuovo": è lì che si misura la capacità reale di una campagna di portarti clienti freschi, non solo di rivendere a chi già ti conosce. Una campagna che brilla solo sugli "Esistenti" sta in realtà cannibalizzando vendite che avresti fatto comunque.',
        'Confronta CPM e frequenza tra campagne simili: differenze marcate spesso spiegano perché una rende e l\'altra no, al di là della creatività.',
      ] },
    ] }),
  A({ id: 'metaKpi', tab: 'metaKpi', icon: 'gauge', group: 'Meta', category: 'features',
    title: 'Meta KPI', summary: 'I KPI medi dell\'account Meta, anche divisi per segmento di pubblico, con card e grafici che si adattano alla selezione.',
    sections: [
      { h: 'Cos\'è', p: 'Meta KPI è la vista d\'insieme delle performance Meta a livello di account: invece di scendere campagna per campagna, qui leggi le medie complessive. La marcia in più sono le tab per segmento di pubblico: selezionando un segmento, tutte le card e tutti i grafici si riadattano per mostrarti come si comporta quel pubblico specifico. È lo strumento per capire dove l\'account funziona e dove no senza perdersi nei dettagli.' },
      { h: 'Le metriche, spiegate', list: [
        'CAC (costo di acquisizione cliente): quanto spendi in media per acquisire un cliente nuovo. È il numero che dice se l\'acquisizione è sostenibile, da leggere insieme all\'LTV.',
        'CPO / costo per acquisto: quanto ti costa generare un acquisto, a prescindere che il cliente sia nuovo o di ritorno.',
        'ROAS: ricavo generato per ogni euro speso. È l\'indicatore di efficienza più immediato, ma va sempre incrociato col margine reale.',
        'CPC e CTR: quanto paghi per clic e quanto spesso le persone cliccano. Insieme dicono se la creatività e il targeting stanno catturando l\'attenzione.',
        'CPM: costo per mille impression, cioè quanto costa "comprare attenzione" su quel pubblico. Un CPM in salita segnala competizione o pubblico saturo.',
        'Frequenza: quante volte in media la stessa persona vede le tue inserzioni. Quando sale troppo, il pubblico si stanca e i risultati calano.',
      ] },
      { h: 'Come funziona', list: [
        'Le tab per segmento — Tutti, Nuovo, Esistenti, Interagito, Sconosciuto — ridisegnano l\'intera schermata: card e grafici si ricalcolano sul pubblico scelto.',
        'Tutto è legato al time frame in alto, così confronti periodi diversi cambiando solo il selettore.',
        'I grafici mostrano l\'andamento e le variazioni, non solo lo scatto del momento: è il modo giusto per distinguere un trend da un singolo giorno storto.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Confronta il CAC tra i segmenti: spostare attenzione e budget verso il pubblico che ti porta clienti nuovi al costo più basso è una delle leve più rapide sul rendimento complessivo.',
        'Tieni d\'occhio la frequenza: quando supera valori elevati è il segnale che stai saturando il pubblico e serve aria fresca, sotto forma di nuove creatività o di un\'audience più ampia.',
        'Non guardare il ROAS isolato: un ROAS alto sul segmento "Esistenti" può nascondere che stai semplicemente rivendendo a chi avrebbe comprato lo stesso.',
      ] },
      { h: 'Domande frequenti', list: [
        'Qual è un buon ROAS? Dipende interamente dal tuo margine: con margini alti puoi essere profittevole anche con ROAS più bassi, con margini sottili ti serve un ROAS alto. Per questo va letto insieme a Performance prodotti e LTV.',
        'Cosa sono i segmenti di pubblico? Sono le categorie con cui Meta classifica chi vede le tue ads: persone nuove, clienti esistenti, chi ha già interagito col brand e chi non è classificabile. Ti dicono se stai acquisendo o rivendendo.',
      ] },
    ] }),
  A({ id: 'lighthouse', tab: 'lighthouse', icon: 'warning', group: 'Meta', category: 'advanced',
    title: 'Lighthouse (Meta)', summary: 'Il sistema di allerta che porta in superficie problemi e opportunità delle campagne Meta, già spiegati e prioritizzati.',
    sections: [
      { h: 'Cos\'è', p: 'Lighthouse è il "faro" sul tuo account Meta: invece di costringerti a scovare i problemi scorrendo tabelle infinite, li individua per te e te li presenta già pronti, ciascuno con una spiegazione di cosa non va e di come intervenire. È pensato per chi non ha tempo di fare l\'audit manuale ogni giorno ma non vuole lasciare che i problemi costino soldi in silenzio.' },
      { h: 'Che tipo di segnalazioni trovi', list: [
        'Campagne o creatività che stanno spendendo senza rendere, da rivedere o mettere in pausa.',
        'Segnali di affaticamento e saturazione del pubblico (frequenza elevata, CPM in salita) che anticipano un calo.',
        'Squilibri di budget, dove i soldi non sono dove rendono di più.',
        'Opportunità, non solo problemi: ad esempio elementi che stanno andando bene e meriterebbero più spinta.',
      ] },
      { h: 'Come usarlo', list: [
        'Ogni alert ha una descrizione chiara del problema e un\'indicazione concreta su come intervenire, così non resti con "c\'è qualcosa che non va" senza sapere cosa fare.',
        'Gli alert sono ordinati per impatto: i primi della lista sono quelli che ti fanno risparmiare o guadagnare di più.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Trattalo come un controllo periodico fisso (ad esempio ogni lunedì): risolvere con costanza gli alert tiene l\'account in salute molto meglio di grandi interventi sporadici fatti quando ormai il danno è grande.',
        'Non agire su tutto in un colpo solo: parti dai primi alert, applica, e rivaluta — così capisci l\'effetto di ogni intervento.',
      ] },
    ] }),
  A({ id: 'creativeFatigue', tab: 'creativeFatigue', icon: 'pulse', group: 'Meta', category: 'advanced',
    title: 'Creative Fatigue', summary: 'Rileva quando una creatività si è "bruciata" per troppa esposizione e va sostituita, prima che trascini giù i risultati.',
    sections: [
      { h: 'Cos\'è e perché succede', p: 'Ogni creatività ha un ciclo di vita: all\'inizio cattura ed è efficiente, poi il pubblico la vede troppe volte, smette di reagire e le performance scivolano. È un fenomeno fisiologico, non un errore. Il problema è accorgersene tardi, quando la creatività ormai costa cara e rende poco. Creative Fatigue rileva i segnali dell\'affaticamento e te li mostra in tempo, così intervieni prima che il calo contagi l\'intera campagna.' },
      { h: 'I segnali che misura', list: [
        'La frequenza in salita: la stessa persona vede l\'inserzione sempre più spesso, segno che il pubblico utile si sta esaurendo.',
        'Il CTR in discesa: a parità di tutto, le persone cliccano meno, perché la creatività non sorprende più.',
        'L\'andamento nel tempo di questi indicatori, per distinguere un brutto giorno isolato da un declino strutturale.',
      ] },
      { h: 'Come leggerla e cosa fare', list: [
        'Il campanello d\'allarme classico è la combinazione di frequenza in salita e CTR in discesa nello stesso periodo: presi insieme, dicono che la creatività è arrivata a fine corsa.',
        'Quando una creatività mostra fatica, la soluzione non è alzare il budget (peggiorerebbe), ma introdurre asset nuovi o variare l\'angolo di comunicazione.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Tieni sempre due o tre creatività fresche pronte da mettere in rotazione, così la sostituzione non ti coglie impreparato e non lasci buchi nelle campagne.',
        'Non buttare le creatività affaticate: spesso, dopo un periodo di riposo, una variazione dello stesso concetto torna a funzionare con un pubblico parzialmente rinnovato.',
        'Ruota gli angoli, non solo le immagini: cambiare la grafica ma ripetere lo stesso messaggio affatica comunque il pubblico.',
      ] },
    ] }),
  A({ id: 'budgetAdvisor', tab: 'budgetAdvisor', icon: 'wallet', group: 'Meta', category: 'advanced',
    title: 'Budget Advisor (Meta)', summary: 'Ti dice dove spostare il budget tra le campagne Meta per massimizzare il ritorno, con indicazioni di scale up e down.',
    sections: [
      { h: 'Cos\'è', p: 'Budget Advisor guarda le performance delle tue campagne Meta e risponde alla domanda più ricorrente di chi gestisce ads: "dove conviene spostare i soldi?". Ti indica quali campagne meritano più budget perché stanno rendendo e quali andrebbero ridimensionate perché stanno solo bruciando spesa. È l\'aiuto che trasforma l\'allocazione del budget da intuizione a decisione basata sui dati.' },
      { h: 'Cosa propone', list: [
        'Raccomandazioni di allocazione del budget tra le campagne, basate sul rendimento reale di ciascuna.',
        'Indicazioni concrete di scale up (aumentare) per le campagne che performano e di scale down (ridurre o mettere in pausa) per quelle che sprecano.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Muovi il budget in modo graduale: aumenti troppo bruschi possono rimandare le campagne in fase di apprendimento, peggiorando temporaneamente i risultati prima di migliorarli.',
        'Prima di scalare una campagna verifica che il suo buon ROAS regga su volumi crescenti: alcune performano benissimo a budget basso e si sgonfiano appena le spingi.',
        'Leggi i suggerimenti insieme a Performance prodotti: aumentare il budget su una campagna con ROAS alto ma su prodotti a basso margine può rendere meno di quanto sembri.',
      ] },
    ] }),

  // ── GOOGLE ────────────────────────────────────────────────────────────
  A({ id: 'googleDetail', tab: 'googleDetail', icon: 'list', group: 'Google', category: 'features',
    title: 'Google Detail', summary: 'Il dettaglio campagna per campagna del tuo account Google Ads, con spesa, conversioni, valore e ROAS nel periodo scelto.',
    sections: [
      { h: 'Cos\'è', p: 'Google Detail è la vista analitica a livello di campagna del tuo account Google Ads: la tabella completa con spesa, conversioni, valore generato e ROAS per ciascuna campagna, nel periodo che selezioni. È il gemello di Meta Detail per il mondo Google e serve a capire quali campagne — search, shopping o Performance Max — stanno davvero tirando e quali stanno solo consumando budget.' },
      { h: 'I tipi di campagna che vedi', list: [
        'Search: annunci di testo che intercettano chi cerca attivamente; di solito convertono bene perché l\'intenzione d\'acquisto è alta.',
        'Shopping: gli annunci con foto e prezzo dei prodotti; il rendimento dipende molto dalla qualità del feed e dai prezzi.',
        'Performance Max: campagne automatiche che girano su tutti i canali Google; potenti ma "scatole nere", per questo è utile guardarne i numeri reali qui.',
      ] },
      { h: 'Cosa contiene la tabella', list: [
        'Spesa, conversioni, valore delle conversioni e ROAS per ogni campagna, allineati per il confronto immediato.',
        'La segmentazione per data, per leggere l\'andamento nel tempo e non solo il totale del periodo.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Confronta sempre il ROAS con il margine reale dei prodotti spinti: una campagna con ROAS alto su articoli a basso margine può rendere meno di una con ROAS più modesto su prodotti redditizi.',
        'Tieni d\'occhio le Performance Max: sono comode ma tendono a prendersi il merito di conversioni che sarebbero arrivate comunque (brand, retargeting); incrociale con i numeri di Shopping e Search.',
      ] },
    ] }),
  A({ id: 'googleProducts', tab: 'googleProducts', icon: 'bag', group: 'Google', category: 'features',
    title: 'Prodotti (Google)', summary: 'Le performance dei singoli prodotti nelle campagne Shopping e Performance Max, per capire chi spende e chi converte.',
    sections: [
      { h: 'Cos\'è e perché è cruciale', p: 'Questa tab scende al livello del prodotto nelle campagne Google e ti mostra quali articoli del feed stanno spendendo budget e quali stanno convertendo. È una vista fondamentale perché in Shopping e Performance Max vale quasi sempre la regola di Pareto: pochi prodotti si mangiano gran parte della spesa, e non sono necessariamente quelli che rendono. Senza questa lettura, rischi di pagare per spingere articoli che non ti fanno guadagnare.' },
      { h: 'Cosa mostra', list: [
        'La spesa e il ritorno per ciascun prodotto del feed, così vedi dove vanno davvero i soldi.',
        'L\'evidenza dei prodotti "trainanti" (spingono i risultati) e di quelli "dispersivi" (consumano budget senza convertire).',
      ] },
      { h: 'Consigli e best practice', list: [
        'Individua i prodotti che assorbono spesa senza convertire ed escludili o riducine la priorità nel feed: è uno dei modi più rapidi per alzare il ROAS complessivo di Shopping.',
        'Non guardare solo il ROAS del prodotto: incrocialo col margine. Un articolo con ROAS medio ma margine alto può valere più di un best seller con ROAS alto ma margine risicato.',
        'Cura il feed (titoli, immagini, prezzi): in Shopping è il feed, più ancora delle impostazioni di campagna, a decidere quali prodotti funzionano.',
      ] },
    ] }),
  A({ id: 'googleKpi', tab: 'googleKpi', icon: 'gauge', group: 'Google', category: 'features',
    title: 'Google KPI', summary: 'La vista d\'insieme delle performance dell\'account Google Ads, con le metriche aggregate legate al time frame.',
    sections: [
      { h: 'Cos\'è', p: 'Google KPI ti dà la fotografia complessiva del tuo account Google Ads: spesa, conversioni, valore, ROAS, CPC e CTR aggregati in un colpo d\'occhio. È il punto da cui capisci in fretta lo stato di salute di Google, prima di scendere nel dettaglio delle singole campagne o dei prodotti.' },
      { h: 'Le metriche, spiegate', list: [
        'Spesa: quanto stai investendo nel periodo, la base di ogni altro ragionamento.',
        'Conversioni e valore conversioni: quante azioni di valore (acquisti) hai generato e quanto valgono complessivamente.',
        'ROAS: il valore delle conversioni diviso la spesa, cioè quanti euro generi per ogni euro investito.',
        'CPC: quanto paghi in media per ogni clic; insieme al CTR dice quanto è efficiente l\'intercettazione del traffico.',
        'CTR: quanto spesso chi vede gli annunci ci clicca; un CTR basso su Search spesso segnala annunci o keyword poco pertinenti.',
      ] },
      { h: 'Come funziona', list: [
        'Tutti i numeri seguono il time frame selezionato in alto, così confronti periodi diversi cambiando solo il selettore.',
        'Una nota importante sulla segmentazione nuovi/ritornanti: su Google la divisione tra clienti nuovi e di ritorno riguarda le conversioni, ma non il costo. Significa che il CAC dei soli clienti nuovi su Google è parziale, a differenza di Meta dove è esatto.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Leggi il ROAS sempre insieme al volume: un ROAS altissimo su pochissima spesa può non essere scalabile, mentre un ROAS solido su volumi importanti vale molto di più.',
        'Non valutare Google in isolamento: confrontalo con Meta in KPI Brain e con l\'Attribuzione, perché una parte delle conversioni Google (specie su brand e PMax) intercetta domanda generata da altri canali.',
      ] },
      { h: 'Domande frequenti', list: [
        'Perché il CAC nuovi clienti su Google è "parziale"? Perché Google permette di segmentare le conversioni tra nuovi e ritornanti, ma non attribuisce il costo a quella divisione. Si può sapere quanti clienti nuovi, non quanto è costato acquisirli con precisione.',
        'Che ROAS dovrei puntare? Quello che, dato il tuo margine, ti lascia profittevole: non esiste un numero universale, dipende da quanto guadagni su ciò che vendi.',
      ] },
    ] }),
  A({ id: 'googleLighthouse', tab: 'googleLighthouse', icon: 'warning', group: 'Google', category: 'advanced',
    title: 'Lighthouse (Google)', summary: 'Il sistema di allerta che porta in superficie criticità e opportunità delle campagne Google, già spiegate.',
    sections: [
      { h: 'Cos\'è', p: 'Lighthouse per Google è il "faro" sul tuo account Ads: segnala criticità e opportunità nelle campagne con spiegazioni su cosa migliorare, invece di lasciarti scoprire i problemi da solo scorrendo report. È pensato per intercettare in tempo gli sprechi e le occasioni mancate, prima che incidano sui risultati.' },
      { h: 'Che tipo di segnalazioni trovi', list: [
        'Campagne o prodotti che spendono senza convertire, da rivedere o limitare.',
        'Squilibri di budget, dove i soldi non sono allocati dove rendono di più.',
        'Opportunità di crescita su ciò che sta già funzionando e meriterebbe più spinta.',
      ] },
      { h: 'Come usarlo', list: [
        'Ogni alert ha una descrizione azionabile: non solo "c\'è un problema", ma cosa fare concretamente.',
        'Le segnalazioni sono prioritizzate, così affronti prima quelle a maggior impatto.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Trattalo come una checklist settimanale: risolvere gli alert con costanza mantiene l\'account in salute molto meglio di interventi grandi e sporadici.',
        'Applica un alert per volta e osserva l\'effetto: così capisci cosa funziona invece di cambiare dieci cose insieme senza sapere quale ha spostato i numeri.',
      ] },
    ] }),
  A({ id: 'googleBudgetAdvisor', tab: 'googleBudgetAdvisor', icon: 'wallet', group: 'Google', category: 'advanced',
    title: 'Budget Advisor (Google)', summary: 'Ti indica come ridistribuire il budget tra le campagne Google per metterlo dove rende di più.',
    sections: [
      { h: 'Cos\'è', p: 'Budget Advisor per Google guarda le performance delle tue campagne e ti dice come spostare il budget: più dove rende, meno dove non rende. È l\'aiuto per allocare la spesa con metodo invece che a intuito, una delle decisioni che più incidono sul ritorno complessivo dell\'account.' },
      { h: 'Cosa propone', list: [
        'Raccomandazioni di budget per ciascuna campagna, basate sul rendimento reale.',
        'Indicazioni su dove aumentare e dove ridurre per migliorare il risultato d\'insieme.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Procedi per piccoli aggiustamenti e dai tempo alle campagne di assestarsi prima di valutare l\'effetto: i sistemi automatici di Google reagiscono ai cambi di budget e serve qualche giorno per stabilizzarsi.',
        'Prima di travasare budget verso una campagna, controlla in Prodotti (Google) che a rendere siano articoli a buon margine, non solo a ROAS alto.',
      ] },
    ] }),

  // ── INCREMENTALITY ────────────────────────────────────────────────────
  A({ id: 'incrContribution', tab: 'incrContribution', icon: 'layers', group: 'Incrementality', category: 'advanced',
    title: 'Contributo incrementale', summary: 'Quanta parte delle vendite è generata DAVVERO dalle ads, canale per canale, oltre la baseline organica.',
    sections: [
      { h: 'Cos\'è e perché è diverso dall\'attribuzione', p: 'Le piattaforme pubblicitarie si attribuiscono ogni vendita che riescono a toccare: se un cliente che ti avrebbe comprato comunque clicca una ads di brand, per Meta quella è una conversione. Il Contributo incrementale risponde alla domanda più onesta: quante vendite NON sarebbero avvenute senza le ads? Il modello separa la baseline (vendite organiche: brand, passaparola, clienti di ritorno, SEO) dal contributo reale di ciascun canale, ricostruito dalla relazione storica tra spesa giornaliera e ricavi.' },
      { h: 'Cosa mostra', list: [
        'La ripartizione dei ricavi del periodo tra baseline organica e contributo incrementale di Meta e Google, con la quota percentuale di ciascuno.',
        'Il confronto tra ricavo attribuito dalle piattaforme e ricavo incrementale stimato dal modello: la differenza è la parte che le ads si "prendono" ma che sarebbe arrivata comunque.',
        'L\'effetto carryover (adstock): la coda di vendite che una campagna continua a generare nei giorni successivi alla spesa, che i modelli last-click ignorano.',
        'Un badge di affidabilità della stima, con i motivi espliciti: quanti giorni di dati ci sono, se la spesa è variata abbastanza da poter misurare l\'effetto, se i dati riportati tornano con quelli reali.',
      ] },
      { h: 'Come leggerla', list: [
        'Guarda prima la baseline: se è alta (60-70%) non è una cattiva notizia, significa che il brand ha forza propria; le ads vanno giudicate su quello che aggiungono sopra.',
        'Confronta attribuito vs incrementale per canale: un canale con attribuito molto più alto dell\'incrementale sta probabilmente intercettando domanda già tua (tipico del retargeting e delle campagne brand).',
        'Controlla sempre il badge di affidabilità prima di prendere decisioni: con pochi giorni di dati o spesa piatta il modello non può distinguere l\'effetto delle ads dalla stagionalità.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Per aumentare l\'affidabilità serve variazione: se la spesa è sempre identica, il modello non ha "esperimenti naturali" da cui imparare. Anche le normali oscillazioni di budget aiutano.',
        'Usa questa tab insieme a Curve di risposta e Simulatore: qui capisci quanto rende ogni canale oggi, lì capisci cosa succederebbe spostando il budget.',
        'Non confrontare questi numeri col ROAS di piattaforma aspettandoti che coincidano: misurano cose diverse, ed è proprio quello il punto.',
      ] },
    ] }),
  A({ id: 'incrCurves', tab: 'incrCurves', icon: 'chart-line', group: 'Incrementality', category: 'advanced',
    title: 'Curve di risposta', summary: 'Come cambia il ritorno all\'aumentare della spesa: saturazione, ROAS marginale e punto di mezza saturazione per canale.',
    sections: [
      { h: 'Cos\'è', p: 'La relazione tra spesa e ricavi non è una retta: i primi euro spesi rendono molto, poi il pubblico si satura e ogni euro in più rende meno. Le Curve di risposta disegnano questa relazione per ogni canale, stimata dai tuoi dati storici con una curva di saturazione (Hill) e l\'effetto carryover. Sono la base scientifica per decidere se un canale ha ancora spazio per crescere o se stai già pagando rendimenti decrescenti.' },
      { h: 'Cosa mostra', list: [
        'La curva spesa→ricavo incrementale di ciascun canale, con il punto in cui ti trovi oggi evidenziato sulla curva.',
        'Il ROAS marginale: quanto renderebbe il PROSSIMO euro speso, che è il numero giusto per decidere gli aumenti di budget (non il ROAS medio).',
        'Il punto di mezza saturazione: il livello di spesa oltre il quale il canale rende visibilmente meno.',
        'Il carryover stimato per canale: quanti giorni continua l\'effetto di un euro speso oggi.',
      ] },
      { h: 'Come leggerla', list: [
        'Se il tuo punto attuale è nella parte ripida della curva, c\'è spazio: aumentare il budget dovrebbe portare ricavi più che proporzionali.',
        'Se sei oltre la mezza saturazione, ogni aumento rende progressivamente meno: valuta se spostare il budget extra su un altro canale o su nuovi pubblici.',
        'Un ROAS marginale sotto il tuo break-even è il segnale di stop: il prossimo euro su quel canale è in perdita anche se il ROAS medio sembra ancora buono.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Le curve sono stime, non certezze: usale per formare ipotesi e valida i cambi importanti con un test geo-lift o con aumenti graduali monitorati.',
        'Rileggi le curve dopo cambi strutturali (nuove campagne, nuovi mercati, stagionalità forte): la forma può cambiare nel tempo.',
      ] },
    ] }),
  A({ id: 'incrSimulator', tab: 'incrSimulator', icon: 'gauge', group: 'Incrementality', category: 'advanced',
    title: 'Simulatore budget', summary: 'Sposta la spesa tra i canali in una simulazione e vedi l\'effetto previsto su ricavi e ROAS prima di farlo davvero.',
    sections: [
      { h: 'Cos\'è', p: 'Il Simulatore applica le curve di risposta a scenari "what-if": cosa succederebbe ai ricavi se aumentassi Meta del 20%? E se spostassi budget da Google a Meta a parità di spesa totale? Invece di scoprirlo a tue spese con un mese di test, muovi i cursori e vedi la previsione del modello in tempo reale, confrontata con la situazione attuale.' },
      { h: 'Come funziona', list: [
        'Parti dalla spesa attuale per canale e modificala con i cursori: il simulatore ricalcola ricavi incrementali e ROAS previsti usando le curve di saturazione.',
        'Il confronto con lo scenario attuale è sempre visibile: vedi subito se il mix simulato è previsto rendere di più o di meno di quello reale.',
        'Le previsioni tengono conto della saturazione: raddoppiare la spesa non raddoppia i ricavi, e il simulatore ti mostra esattamente quanto ti aspetti di perdere per strada.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Usalo prima di ogni decisione importante di budget: cinque minuti di simulazione evitano settimane di test alla cieca.',
        'Applica i cambi nella realtà in modo graduale (10-20% alla volta) e verifica che i risultati seguano la previsione prima del passo successivo.',
        'La simulazione è affidabile intorno ai livelli di spesa che il modello ha già osservato: scenari estremi (spesa 5× o canali mai usati) sono estrapolazioni da prendere con cautela.',
      ] },
    ] }),
  A({ id: 'geolift', tab: 'geolift', icon: 'target', group: 'Incrementality', category: 'advanced',
    title: 'Geo-lift', summary: 'Il test scientifico definitivo: spegni (o accendi) le ads in alcune regioni e misura la differenza reale con le regioni di controllo.',
    sections: [
      { h: 'Cos\'è', p: 'Il geo-lift è l\'esperimento che chiude ogni discussione sull\'incrementalità: si sceglie un gruppo di regioni "trattamento" dove cambiare la spesa (per esempio spegnere un canale) e un gruppo di regioni "controllo" simili dove non si tocca nulla. La differenza di vendite tra i due gruppi, nel periodo del test, è l\'effetto causale delle ads — misurato sul campo, non stimato da un modello. È lo standard usato dai brand più evoluti per validare le stime di contributo.' },
      { h: 'Come funziona', list: [
        'Scegli il canale da testare e la piattaforma propone il disegno dell\'esperimento: regioni di trattamento, regioni di controllo comparabili e durata consigliata.',
        'Il pannello ti mostra il lift minimo rilevabile con i tuoi volumi: se è troppo alto (poco traffico), il test rischia di non essere conclusivo e conviene allungare la durata o allargare le regioni.',
        'Durante il test le vendite delle due aree vengono confrontate giorno per giorno; alla fine ottieni l\'effetto misurato con il suo intervallo di confidenza.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Non toccare le campagne durante il test: ogni cambio contamina l\'esperimento e rende i risultati illeggibili.',
        'Evita i periodi anomali (Black Friday, saldi, lanci): la stagionalità estrema maschera l\'effetto che vuoi misurare.',
        'Usa il geo-lift per validare le decisioni più pesanti (spegnere un canale, raddoppiare il budget) e le stime del Contributo incrementale: se il test conferma il modello, puoi fidarti del modello anche altrove.',
      ] },
    ] }),

  // ── REPORTS ───────────────────────────────────────────────────────────
  A({ id: 'pnl', tab: 'pnl', icon: 'euro', group: 'Reports', category: 'features',
    title: 'Conto Economico', summary: 'Il P&L del business in un solo quadro: ricavi, costo del venduto, spese pubblicitarie e margini.',
    sections: [
      { h: 'Cos\'è', p: 'Il Conto Economico mette insieme i pezzi sparsi — ricavi, COGS, spese ads, margini — in un unico quadro finanziario che ti dice se stai davvero guadagnando. È la vista che traduce tutta l\'attività operativa in linguaggio di bilancio, ed è il posto dove il lavoro fatto nei Costi prodotto ripaga in chiarezza.' },
      { h: 'Cosa include', list: [
        'Ricavi netti, costo del venduto, spese pubblicitarie e margine risultante.',
        'La vista per periodo, per confrontare mesi o trimestri.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Tieni aggiornati i Costi prodotto: il Conto Economico è affidabile quanto lo sono i COGS che gli dai in pasto. Con costi sbagliati, il margine che vedi è una finzione.',
      ] },
    ] }),
  A({ id: 'scheduledReports', tab: 'scheduledReports', icon: 'send', group: 'Reports', category: 'advanced',
    title: 'Scheduled Reports', summary: 'Report automatici inviati via email con la cadenza che scegli, senza doverli aprire ogni volta.',
    sections: [
      { h: 'Cos\'è', p: 'Scheduled Reports automatizza la rendicontazione: imposti una cadenza e i report arrivano via email a te e a chi vuoi, già pronti. È pensato per chi non vuole ricordarsi di aprire la piattaforma per controllare i numeri, e per tenere allineati soci, collaboratori o clienti senza lavoro manuale.' },
      { h: 'Cosa include', list: [
        'La pianificazione dell\'invio su base settimanale e/o mensile.',
        'L\'invio automatico ai destinatari che indichi.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Manda il report settimanale a chi deve restare sul polso operativo e quello mensile a chi gli serve per le decisioni più ampie: cadenze diverse per pubblici diversi.',
      ] },
    ] }),
  A({ id: 'periodReports', tab: 'weekly', icon: 'calendar', group: 'Reports', category: 'features',
    title: 'Report periodici (Weekly / Monthly / Quarter / Year)', summary: 'Sintesi pronte delle performance per settimana, mese, trimestre e anno, con insight AI ed export PDF.',
    sections: [
      { h: 'Cos\'è', p: 'I report periodici sono riepiloghi già confezionati delle tue performance sui diversi orizzonti temporali. Ognuno non si limita a impilare numeri: include una sintesi scritta dall\'AI con gli insight principali e una lista di cose da fare, così il report si legge e si traduce in azione invece di restare un foglio di dati.' },
      { h: 'Cosa include', list: [
        'Quattro orizzonti distinti — settimanale, mensile, trimestrale e annuale — ciascuno tarato sul giusto livello di dettaglio.',
        'Una sintesi AI che evidenzia gli insight e propone i prossimi passi.',
        'L\'export PDF scaricabile nella lingua del cliente, pronto da condividere.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Usa il Weekly per il ritmo operativo — cosa è successo e cosa fare subito — e il Monthly/Quarter per le decisioni strategiche, dove conta il trend più del singolo dato.',
      ] },
    ] }),
  A({ id: 'simulator', tab: 'simulator', icon: 'gauge', group: 'Reports', category: 'advanced',
    title: 'Simulatore', summary: 'Simula scenari "what-if" sui tuoi numeri prima di muovere il budget reale.',
    sections: [
      { h: 'Cos\'è', p: 'Il Simulatore è la tua sandbox finanziaria: muovi le leve — spesa pubblicitaria, ROAS, scontrino medio, margini — e vedi all\'istante come cambiano ricavi e marginalità. Ti permette di rispondere a domande come "cosa succede se raddoppio il budget ma il ROAS cala?" senza rischiare un solo euro reale.' },
      { h: 'Cosa include', list: [
        'Scenari what-if interattivi in cui modifichi i parametri e leggi subito l\'effetto.',
        'Le proiezioni su ricavi e margini derivanti dalle tue ipotesi.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Parti sempre dai numeri reali attuali e cambia una sola leva per volta: così capisci esattamente quale variabile guida il risultato.',
        'Usalo prima di una decisione importante di budget: una simulazione di cinque minuti può evitarti un errore costoso.',
      ] },
    ] }),

  // ── SYSTEM ────────────────────────────────────────────────────────────
  A({ id: 'integrations', tab: 'integrations', icon: 'gear', group: 'System', category: 'gettingStarted',
    title: 'Integrazioni', summary: 'Il pannello dove gestisci e verifichi le connessioni: Shopify, Meta, Google, Klaviyo, Search Console.',
    sections: [
      { h: 'Cos\'è', p: 'Integrazioni è il centro di controllo delle tue connessioni dati. Mentre l\'Onboarding ti accompagna nel primo collegamento, questa tab è dove torni nel tempo per controllare lo stato, riconnettere un canale o gestire i permessi. È il primo posto da guardare ogni volta che qualcosa "non torna" nei dati.' },
      { h: 'Cosa include', list: [
        'Lo stato aggiornato di ogni connessione, per vedere a colpo d\'occhio cosa è attivo e cosa no.',
        'La possibilità di riconnettere un canale e di gestire i permessi concessi.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Quando una tab smette di mostrare dati, vieni qui prima di tutto: nove volte su dieci il canale relativo ha perso l\'autorizzazione.',
        'Dopo aver cambiato password o permessi su Shopify, Meta o Google, può essere necessario riconnettere: le autorizzazioni OAuth si invalidano con quei cambi.',
      ] },
    ] }),
  A({ id: 'brandIdentity', tab: 'brandIdentity', icon: 'star', group: 'System', category: 'gettingStarted',
    title: 'Brand Identity', summary: 'La base del brand — tono, lessico, target, persona — che l\'AI usa per ogni copy e ogni creatività.',
    sections: [
      { h: 'Cos\'è e perché migliora tutto', p: 'Brand Identity è la "memoria del brand" che l\'AI consulta ogni volta che genera qualcosa per te. Quando scrive un\'email per un segmento di clienti o crea una creatività, attinge da qui per tono di voce, parole da usare e parole da evitare, target e personalità. Compilarla bene non è un esercizio di stile: è ciò che separa un copy generico da uno che suona davvero come il tuo brand.' },
      { h: 'Cosa include', list: [
        'Il tono di voce, il lessico tipico del brand e le parole vietate da non usare mai.',
        'Il target audience, la mission e la descrizione di chi sei.',
        'Esempi di copy che funzionano, da cui l\'AI impara il tuo stile concreto.',
      ] },
      { h: 'Consigli e best practice', list: [
        'Dedicaci tempo una volta sola: ogni output AI della piattaforma — email dei Clienti, campagne, creatività, insight — migliora di colpo quando questa scheda è completa.',
        'Cura soprattutto le "parole vietate": è il modo più semplice per evitare che l\'AI usi termini fuori brand o concetti che non vuoi associare a te.',
      ] },
    ] }),
  A({ id: 'settings', tab: 'settings', icon: 'gear', group: 'System', category: 'gettingStarted',
    title: 'Settings', summary: 'Le impostazioni dell\'account: lingua dell\'interfaccia, piano, fatturazione e preferenze.',
    sections: [
      { h: 'Cos\'è', p: 'Settings raccoglie le impostazioni dell\'account e dell\'abbonamento: da qui scegli la lingua dell\'interfaccia, gestisci il tuo piano e le preferenze generali. È la tab "amministrativa" a cui torni di rado ma che è bene sapere dove trovare.' },
      { h: 'Cosa include', list: [
        'La lingua dell\'interfaccia, disponibile in italiano, inglese, spagnolo, francese e tedesco.',
        'La gestione del piano e della fatturazione.',
        'Le preferenze generali dell\'account.',
      ] },
      { h: 'Consigli e best practice', list: [
        'La lingua scelta qui si riflette anche sugli output tradotti (come i report PDF e i copy), quindi impostala sulla lingua in cui vuoi comunicare.',
      ] },
    ] }),
]

// ── Multilingua ─────────────────────────────────────────────────────────────
// L'italiano è la sorgente (HELP_ARTICLES). Le altre lingue stanno in
// content.translations.js (generato da scripts/help-translate.mjs). Fallback
// sempre all'italiano se manca una traduzione.
import { HELP_TRANSLATIONS } from './content.translations.js'

const IT_BY_ID = Object.fromEntries(HELP_ARTICLES.map(a => [a.id, a]))
const LOC_BY_ID = {}
for (const [loc, arr] of Object.entries(HELP_TRANSLATIONS || {})) {
  LOC_BY_ID[loc] = Object.fromEntries((arr || []).map(a => [a.id, a]))
}
const hasLoc = (locale, id) => locale && locale !== 'it' && LOC_BY_ID[locale] && LOC_BY_ID[locale][id]

// Lista articoli nella lingua richiesta (ordine IT, fallback IT per i mancanti).
export function articlesFor(locale) {
  if (locale && locale !== 'it' && LOC_BY_ID[locale]) {
    return HELP_ARTICLES.map(a => LOC_BY_ID[locale][a.id] || a)
  }
  return HELP_ARTICLES
}

export function findArticle(id, locale) {
  if (hasLoc(locale, id)) return LOC_BY_ID[locale][id]
  return IT_BY_ID[id] || null
}

// Trova l'articolo collegato a una tab della nav (per l'icona guida in header).
// Alias: i report periodici condividono un'unica guida.
const TAB_ALIASES = { monthly: 'weekly', quarter: 'weekly', year: 'weekly' }
export function articleForTab(tabId, locale) {
  const t = TAB_ALIASES[tabId] || tabId
  const it = HELP_ARTICLES.find(a => a.tab === t)
  return it ? findArticle(it.id, locale) : null
}
