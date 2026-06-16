// ── Contenuti del Centro Assistenza (guide per ogni tab) ────────────────────
// Sorgente unica delle guide. Ogni articolo è collegato a una tab (campo `tab`)
// così dal pop-up si può aprire direttamente la sezione. Contenuto in italiano
// (lingua principale dell'app); la traduzione integrale degli articoli è un
// follow-up — la UI del Centro è già multilingua.
//
// Struttura sezione: { h: 'Titolo', p: 'paragrafo' } oppure { h, list: [...] }.

export const HELP_CATEGORIES = ['gettingStarted', 'features', 'advanced']

const A = (o) => o

export const HELP_ARTICLES = [
  // ── COMMERCE ──────────────────────────────────────────────────────────
  A({ id: 'onboarding', tab: 'onboarding', icon: 'rocket', group: 'Commerce', category: 'gettingStarted',
    title: 'Onboarding', summary: 'La procedura guidata che collega le tue fonti dati e accende tutta la piattaforma in pochi minuti.',
    sections: [
      { h: 'Cos\'è', p: 'L\'Onboarding è il punto di partenza: collega Shopify, Meta, Google e Klaviyo così ogni altra tab si popola da sola con i tuoi dati reali. Finché un canale non è connesso, le tab che dipendono da quei dati restano vuote.' },
      { h: 'Cosa include', list: [
        'Connessione Shopify: ordini, prodotti, clienti, inventario e report',
        'Collegamento Meta Ads (campagne, creatività, spesa, ROAS)',
        'Collegamento Google Ads + GA4 (campagne, conversioni, realtime)',
        'Klaviyo per email/SMS marketing',
        'Verifica automatica degli scope/permessi richiesti',
        'Stato di avanzamento con spunta verde per ogni canale collegato',
      ] },
      { h: 'Come funziona, passo per passo', list: [
        '1. Parti da Shopify: è la fonte base e sblocca Dashboard, Inventario, Clienti, LTV, Performance prodotti',
        '2. Per Shopify assegna gli scope di LETTURA: read_orders, read_products, read_customers, read_inventory, read_reports, read_discounts, read_fulfillments',
        '3. Collega Meta e Google con il login OAuth (autorizzi una volta, restano connessi)',
        '4. Aggiungi Klaviyo se fai email marketing',
        '5. Quando un canale è a posto, la sua riga diventa verde',
      ] },
      { h: 'Consigli e best practice', list: [
        'Completa prima Shopify: è quello che sblocca più tab',
        'Usa l\'account amministratore dei canali ads per evitare permessi mancanti',
        'Se in seguito una tab non mostra dati, torna qui e controlla che il canale sia ancora connesso',
      ] },
      { h: 'Risoluzione problemi', list: [
        'Tab vuota → il canale collegato a quella tab non è connesso o ha perso l\'autorizzazione',
        'Mancano scope → riconnetti Shopify assegnando tutti gli scope di lettura',
        'Dati ads assenti → verifica di aver scelto l\'account pubblicitario giusto in fase di OAuth',
      ] },
    ] }),
  A({ id: 'dashboard', tab: 'dashboard', icon: 'grid', group: 'Commerce', category: 'gettingStarted',
    title: 'Dashboard', summary: 'La fotografia quotidiana del business: vendite, ordini, clienti e pubblicità in un colpo d\'occhio.',
    sections: [
      { h: 'Cos\'è', p: 'La Dashboard riassume i numeri chiave del periodo selezionato. È il punto da cui parti ogni mattina per capire "come sta andando" prima di scendere nel dettaglio nelle tab specializzate.' },
      { h: 'Cosa include', list: [
        'KPI vendite: ricavi, numero ordini, scontrino medio (AOV)',
        'Nuovi clienti vs clienti di ritorno, con i rispettivi resi',
        'Spesa pubblicitaria e ROAS su Meta e Google',
        'Card di spesa Google e sezione Google Ads quando collegato',
        'Globo 3D dei visitatori in tempo reale (dati da GA4 Realtime)',
      ] },
      { h: 'Come funziona', list: [
        'Cambia il time frame in alto a destra: tutti i dati si ricalcolano sul periodo scelto',
        'Vendite e resi arrivano da Shopify, la pubblicità da Meta/Google, il realtime da GA4',
        'Le card colorano solo le variazioni % (verde/rosso); i valori restano bianchi per leggibilità',
        'I dati sono in cache per aperture istantanee e si aggiornano in background',
      ] },
      { h: 'Consigli e best practice', list: [
        'Usala come check rapido giornaliero, non per analisi profonde',
        'Per capire "perché" un numero cambia, vai in KPI Brain, Performance prodotti o Clienti',
        'Confronta sempre con il periodo precedente per leggere il trend, non solo il valore assoluto',
      ] },
      { h: 'Risoluzione problemi', list: [
        'Resi nuovi/ritorno a zero → verifica la connessione Shopify (i resi arrivano dal breakdown ordini)',
        'Globo vuoto → serve GA4 collegato con traffico realtime attivo',
      ] },
    ] }),
  A({ id: 'inventory', tab: 'inventory', icon: 'box', group: 'Commerce', category: 'features',
    title: 'Inventario', summary: 'Intelligence sullo stock per taglia/SKU: quando vai in stockout, taglie rotte e vendite perse in €.',
    sections: [
      { h: 'Cos\'è', p: 'L\'Inventario monitora la giacenza a livello di singola variante/taglia da Shopify e stima quando finirai lo stock, ordinando tutto per rischio commerciale reale (€ a rischio, non solo giorni).' },
      { h: 'Cosa include', list: [
        'Giorni-a-stockout per variante, con velocità di vendita pesata sul recente',
        '"Taglie rotte" (broken sizes): prodotti con buchi nella curva taglie',
        'Valore dell\'inventario a COGS e quantità a magazzino',
        'Vendite perse stimate in € per gli articoli esauriti',
        'Matrice taglie per prodotto (ideale per apparel e accessori)',
        'Vista catalogo, prodotti con problemi, prodotti senza costo',
      ] },
      { h: 'Come funziona', list: [
        'La velocità di vendita è pesata sui giorni recenti per riflettere la domanda attuale',
        'Il rischio è ordinato per priorità commerciale: prima ciò che ti fa perdere più soldi',
        'I COGS arrivano dalla tab Costi prodotto; senza costi, alcune stime restano parziali',
        'Le celle della matrice si colorano in base al rischio (rosso = critico, verde = ok)',
      ] },
      { h: 'Consigli e best practice', list: [
        'Riassortisci prima le varianti con più € a rischio, non quelle con meno giorni in assoluto',
        'Tieni aggiornati i costi landed per avere stime di margine e vendite perse corrette',
        'Controlla le "taglie rotte": spesso bastano 1-2 taglie per recuperare un prodotto',
      ] },
    ] }),
  A({ id: 'productPerformance', tab: 'productPerformance', icon: 'chart-bar', group: 'Commerce', category: 'features',
    title: 'Performance prodotti', summary: 'Conto economico per singolo prodotto: netto, COGS, ADS allocati, margine operativo e ROAS.',
    sections: [
      { h: 'Cos\'è', p: 'Un vero P&L per prodotto che mostra quanto guadagni davvero su ciascun articolo, allocando anche i costi pubblicitari per avere il margine reale, non solo il fatturato.' },
      { h: 'Cosa include', list: [
        'Ricavo netto, COGS e margine operativo per prodotto',
        'Spesa ADS (Meta + Google) allocata a ciascun prodotto',
        'ROAS per prodotto e variazione Δ vs periodo precedente',
        'Totali con margine lordo e COGS aggregati',
      ] },
      { h: 'Come funziona', list: [
        'Gli ADS si allocano in modo proporzionale al ricavo (stima) oppure in modo preciso se mappi le campagne ai prodotti',
        'Il calcolo esclude spedizione e marketplace esterni: è focalizzato sul B2C diretto',
        'COGS dai Costi prodotto, spesa ads da Meta/Google',
      ] },
      { h: 'Consigli e best practice', list: [
        'Mappa le campagne ai prodotti per un\'allocazione ADS precisa invece che stimata',
        'Taglia o ripensa i prodotti con margine operativo costantemente negativo',
        'Usa il ROAS per prodotto per decidere su cosa spingere il budget',
      ] },
    ] }),
  A({ id: 'productCosts', tab: 'productCosts', icon: 'money', group: 'Commerce', category: 'features',
    title: 'Costi prodotto', summary: 'Editor del costo "landed" per variante: alimenta i COGS di Inventario, Performance e LTV.',
    sections: [
      { h: 'Cos\'è', p: 'Qui imposti il costo reale "landed" (prodotto + dazi + spedizione in entrata) di ogni variante. È la base che rende affidabili margini e P&L in tutta la piattaforma.' },
      { h: 'Cosa include', list: [
        'Costo landed per variante con storico inline delle modifiche',
        'Sync automatico dei cambi costo da Shopify (all\'apertura + cron notturno)',
        'Override manuale quando il costo Shopify non basta',
        'Tracciamento delle variazioni di costo nel tempo',
      ] },
      { h: 'Come funziona', list: [
        'Ogni salvataggio crea una riga storica con data di validità: gli ordini passati usano il costo dell\'epoca',
        'Il costo "corrente" è quello con data più recente',
        'I valori alimentano COGS, margini, vendite perse e LTV Netto altrove',
      ] },
      { h: 'Consigli e best practice', list: [
        'Aggiorna i costi quando cambi fornitore o prezzi d\'acquisto',
        'Costi corretti = margini, P&L e LTV Netto affidabili in tutta l\'app',
      ] },
    ] }),
  A({ id: 'kpiBrain', tab: 'kpiBrain', icon: 'chart-line', group: 'Commerce', category: 'features',
    title: 'KPI Brain', summary: 'Tutti i KPI di marketing cross-canale in un cervello unico, con sparkline, variazioni e lettura AI.',
    sections: [
      { h: 'Cos\'è', p: 'KPI Brain raccoglie i KPI di Shopify, Meta e Google in un\'unica vista, con il confronto col periodo precedente e una lettura intelligente dei numeri.' },
      { h: 'Cosa include', list: [
        'Card KPI per Shopify, Meta Ads e Google Ads',
        'CAC nuovi clienti per canale (segmenti pubblico Meta + Google)',
        'Sparkline e variazione % rispetto allo stesso periodo precedente',
        'Pannelli con CAC esatto per segmento (Meta) e parziale (Google)',
      ] },
      { h: 'Come funziona', list: [
        'Tutto è legato al time frame selezionato e si ricalcola al cambio',
        'I dati sono in cache (SWR) per aperture istantanee con refresh in background',
        'Il CAC Meta è esatto via breakdown nativo; su Google è parziale (segmenta solo le conversioni)',
      ] },
      { h: 'Consigli e best practice', list: [
        'Parti da qui per capire "come va" prima di entrare nelle tab di dettaglio per canale',
        'Confronta il CAC dei segmenti per capire dove conviene spingere l\'acquisizione',
      ] },
    ] }),
  A({ id: 'attribution', tab: 'attribution', icon: 'target', group: 'Commerce', category: 'advanced',
    title: 'Attribuzione', summary: 'Capisci quali canali generano davvero le vendite, confrontando spesa e ricavi per fonte.',
    sections: [
      { h: 'Cos\'è', p: 'L\'Attribuzione mette a confronto spesa e ricavi per canale per stimare il contributo reale di ciascuna fonte alle vendite.' },
      { h: 'Cosa include', list: [
        'Confronto tra canali: Meta, Google, organico, email',
        'Vendite, spesa e ROAS per fonte nel time frame scelto',
      ] },
      { h: 'Consigli e best practice', list: [
        'Leggila insieme a KPI Brain e LTV per decisioni di budget basate sul valore, non solo sul ROAS immediato',
        'Ricorda che nessun modello è perfetto: usala come bussola, non come verità assoluta',
      ] },
    ] }),
  A({ id: 'ltvCohorts', tab: 'ltvCohorts', icon: 'layers', group: 'Commerce', category: 'features',
    title: 'LTV & Coorti', summary: 'Valore dei clienti nel tempo per coorte d\'acquisizione, con LTV lordo/netto, CAC e ratio LTV:CAC.',
    sections: [
      { h: 'Cos\'è', p: 'Analizza il valore dei clienti raggruppati per mese di primo acquisto: repeat rate, ordini per cliente e LTV. Ti dice se la tua acquisizione è sostenibile nel tempo.' },
      { h: 'Cosa include', list: [
        'LTV Lordo (ricavo lifetime per cliente) e LTV Netto (× margine reale)',
        'CAC (spesa ads ÷ nuovi clienti) e ratio LTV:CAC',
        'Repeat rate, ordini per cliente e tempo al 2° ordine per coorte',
        'Clienti acquisiti, monouso e fatturato delle coorti',
        'Controllo del margine lordo (manuale o reale dai Costi prodotto)',
      ] },
      { h: 'Come funziona', list: [
        'Usa gli aggregati lifetime di Shopify: storico completo, non soggetto al limite 60 giorni',
        'Il margine reale viene calcolato dai Costi prodotto; se non li hai impostati è una stima',
        'Cambia la finestra (6/12/18/24 mesi) per ampliare l\'analisi',
      ] },
      { h: 'Consigli e best practice', list: [
        'Un ratio LTV:CAC sano è ≥ 3: sotto, rivedi acquisizione o margini',
        'Imposta i Costi prodotto per passare da LTV Netto stimato a reale',
        'Guarda il tempo al 2° ordine: accorciarlo è una delle leve più potenti sull\'LTV',
      ] },
    ] }),
  A({ id: 'clienti', tab: 'clienti', icon: 'users', group: 'Commerce', category: 'features',
    title: 'Clienti', summary: 'Segmentazione RFM dei clienti, Analytics nel tempo, Insight AI e campagne in 1 click via Klaviyo.',
    sections: [
      { h: 'Cos\'è', p: 'La tab Clienti è il layer d\'azione sui tuoi clienti: divide automaticamente l\'intera base per ciclo di vita (modello RFM) e ti permette di agire subito con campagne mirate generate dall\'AI.' },
      { h: 'I 6 segmenti', list: [
        'Nuovi — primo ordine di recente',
        'Potenziali fedeli — più ordini di recente, in crescita',
        'Fedeli — ordinano spesso e regolarmente',
        'Fedeli a rischio — erano fedeli ma non ordinano da un po\'',
        'Stanno per dormire — primo ordine un po\' di tempo fa, in raffreddamento',
        'Dormienti — primo ordine molto tempo fa, inattivi',
      ] },
      { h: 'Le tre viste', list: [
        'Panoramica: KPI (clienti, CLV, ordini/cliente, giorni tra ordini, AOV) + tabella metriche per segmento',
        'Analytics: grafici nel tempo (clienti, retention, CLV, clienti per segmento, variazioni)',
        'Insight: la Squadra AI legge i dati e propone azioni concrete con priorità',
      ] },
      { h: 'Come funziona', list: [
        'I dati arrivano via Shopify Bulk Operations: tutti i clienti, senza limiti né rallentamenti',
        'Clicca su un segmento per vedere l\'elenco dei suoi clienti (con ricerca per nome/email)',
        '"Crea campagna" genera oggetto, anteprima e corpo email nel tono del brand, da incollare in Klaviyo',
        '"Ricostruisci storico" rigioca gli ordini passati per popolare subito i grafici nel tempo',
      ] },
      { h: 'Consigli e best practice', list: [
        'Parti dai segmenti a maggior valore recuperabile: Fedeli a rischio e Dormienti',
        'Usa gli Insight per sapere quale azione fare prima e perché',
        'Premia i Fedeli e accompagna i Nuovi al secondo acquisto: sono le due leve sull\'LTV',
      ] },
    ] }),
  A({ id: 'klaviyo', tab: 'klaviyo', icon: 'mail', group: 'Commerce', category: 'features',
    title: 'Klaviyo', summary: 'Le metriche di email/SMS marketing e i flussi che generano ricavo, dentro LyftAI.',
    sections: [
      { h: 'Cos\'è', p: 'Porta in LyftAI le performance del tuo account Klaviyo: campagne, flussi automatici e revenue attribuito al canale email/SMS.' },
      { h: 'Cosa include', list: [
        'Ricavi da email/SMS e quota sul fatturato totale',
        'Performance di campagne e flussi automatici (benvenuto, carrello, post-acquisto…)',
        'Andamento del canale nel tempo',
      ] },
      { h: 'Consigli e best practice', list: [
        'Incolla qui i segmenti generati nella tab Clienti per campagne più mirate',
        'I flussi automatici sono spesso la quota più redditizia: controlla che siano tutti attivi',
      ] },
    ] }),

  // ── PRODUCTIVITY AI ───────────────────────────────────────────────────
  A({ id: 'tasks', tab: 'tasks', icon: 'kanban', group: 'Productivity AI', category: 'features',
    title: 'Progetti & Task', summary: 'Board Kanban multi-utente per gestire il lavoro del team con ruoli e assegnazioni.',
    sections: [
      { h: 'Cos\'è', p: 'Un gestionale di progetti e attività con board Kanban, pensato per far lavorare insieme il team con ruoli e accessi dedicati.' },
      { h: 'Cosa include', list: [
        'Board Kanban con colonne e schede trascinabili',
        'Multi-utente con ruoli e login reali via invito email',
        'Assegnazione di responsabili e stato di avanzamento',
      ] },
      { h: 'Consigli e best practice', list: [
        'Trasforma le raccomandazioni dell\'AI (Insight, Coda Azioni) in task assegnati',
        'Usa colonne semplici (Da fare / In corso / Fatto) per non complicare il flusso',
      ] },
    ] }),
  A({ id: 'timeTracking', tab: 'timeTracking', icon: 'clock', group: 'Productivity AI', category: 'features',
    title: 'Lyftimer', summary: 'Time-tracker stile Hubstaff: timer live, timesheet e totali per persona e progetto.',
    sections: [
      { h: 'Cos\'è', p: 'Lyftimer traccia il tempo dedicato a progetti e task con un timer live e riepiloghi, per capire quanto costa davvero il lavoro.' },
      { h: 'Cosa include', list: [
        'Timer live con progetto, task e descrizione',
        'Timesheet con totali per persona e per progetto',
        'Storico delle sessioni di lavoro',
      ] },
      { h: 'Consigli e best practice', list: [
        'Collega le ore ai progetti giusti per misurare la marginalità reale del lavoro',
        'Fai partire il timer all\'inizio dell\'attività, non a fine giornata a memoria',
      ] },
    ] }),
  A({ id: 'chat', tab: 'chat', icon: 'chat', group: 'Productivity AI', category: 'features',
    title: 'LyftTalk', summary: 'La chat dove parli con i tuoi dati e con la Squadra AI: domande, strategie, brainstorming.',
    sections: [
      { h: 'Cos\'è', p: 'LyftTalk è l\'assistente conversazionale di LyftAI: fai domande sui tuoi numeri reali, chiedi strategie e idee, e dialoghi con gli agenti della Squadra AI.' },
      { h: 'Cosa include', list: [
        'Chat con il consulente AI che legge i tuoi dati live',
        'Accesso agli agenti della Squadra AI chiamandoli per nome',
        'Risposte basate sui numeri reali, non generiche',
      ] },
      { h: 'Consigli e best practice', list: [
        'Chiedi "cosa faresti questa settimana?" per ottenere priorità concrete',
        'Sii specifico: più contesto dai, più la risposta è azionabile',
      ] },
    ] }),
  A({ id: 'team', tab: 'team', icon: 'users', group: 'Productivity AI', category: 'advanced',
    title: 'Squadra AI', summary: '8 agenti C-suite e specialisti con gerarchia, ognuno con il suo ruolo e la sua competenza.',
    sections: [
      { h: 'Cos\'è', p: 'La Squadra AI è un team di agenti (CEO, marketing, performance, copy, creatività, dati…) che rispondono ciascuno nel proprio ruolo e con la propria personalità.' },
      { h: 'Cosa include', list: [
        'Agenti specializzati con competenze e tono diversi',
        'Una gerarchia con un capo che coordina',
        'Vivono in LyftTalk e rispondono quando li chiami per nome',
      ] },
      { h: 'Consigli e best practice', list: [
        'Chiedi all\'agente giusto: il copy a chi fa copy, il budget a chi fa performance',
        'Usa la squadra per avere punti di vista diversi sullo stesso problema',
      ] },
    ] }),
  A({ id: 'performanceAgent', tab: 'performanceAgent', icon: 'sparkle', group: 'Productivity AI', category: 'advanced',
    title: 'Performance Agent', summary: 'L\'agente che analizza le performance cross-canale e propone azioni concrete con priorità.',
    sections: [
      { h: 'Cos\'è', p: 'Il Performance Agent analizza automaticamente i tuoi dati di performance e suggerisce cosa ottimizzare, con motivazioni e impatto atteso.' },
      { h: 'Cosa include', list: [
        'Analisi cross-canale delle performance',
        'Raccomandazioni azionabili ordinate per priorità',
        'Spiegazione del perché e dell\'impatto stimato',
      ] },
      { h: 'Consigli e best practice', list: [
        'Manda le raccomandazioni nella Coda Azioni per approvarle ed eseguirle',
        'Eseguine poche per volta e misura l\'effetto prima di passare alle successive',
      ] },
    ] }),
  A({ id: 'creativeStudio', tab: 'creativeStudio', icon: 'sparkle', group: 'Productivity AI', category: 'features',
    title: 'Creative Studio', summary: 'Board generativa chat-driven per immagini e creatività (video/UGC in arrivo), con contesto del brand.',
    sections: [
      { h: 'Cos\'è', p: 'Lo studio creativo AI: generi immagini e asset partendo dal contesto del tuo brand, con ambienti (Studios) e una suite di editing.' },
      { h: 'Cosa include', list: [
        'Generazione immagini multi-modello con contesto cliente',
        'Studios/ambienti e suite di editing avanzata',
        'Progetti e board in stile moodboard',
        'Crediti gestiti via Stripe',
      ] },
      { h: 'Consigli e best practice', list: [
        'Compila bene il Brand Identity: gli output saranno più on-brand',
        'Parti da brief chiari (soggetto, mood, formato) per risultati migliori',
      ] },
    ] }),
  A({ id: 'actionQueue', tab: 'actionQueue', icon: 'bolt', group: 'Productivity AI', category: 'advanced',
    title: 'Coda Azioni', summary: 'Il centro di controllo dove approvi o scarti le azioni proposte dall\'AI prima dell\'esecuzione.',
    sections: [
      { h: 'Cos\'è', p: 'La Coda Azioni raccoglie tutte le azioni suggerite dai moduli AI e ti mette al comando: approvi, modifichi o scarti prima che qualcosa venga eseguito.' },
      { h: 'Cosa include', list: [
        'Elenco delle azioni proposte con priorità',
        'Approvazione ed esecuzione tracciate',
        'Stato di ogni azione (in attesa, eseguita, scartata)',
      ] },
      { h: 'Consigli e best practice', list: [
        'Rivedi la coda con regolarità: è il ponte tra insight e azione concreta',
        'Niente viene eseguito senza la tua approvazione: usala con serenità',
      ] },
    ] }),

  // ── INTELLIGENCE WEBSITE ──────────────────────────────────────────────
  A({ id: 'cro', tab: 'cro', icon: 'funnel', group: 'Intelligence Website', category: 'features',
    title: 'CRO', summary: 'Funnel di conversione giorno-preciso da GA4 e Shopify, con nuovi vs ritornanti e confronto periodo.',
    sections: [
      { h: 'Cos\'è', p: 'La CRO analizza la conversione del sito con un funnel reale (non stimato) per il periodo scelto, così vedi davvero dove perdi clienti.' },
      { h: 'Cosa include', list: [
        'Funnel reale costruito da GA4 + Shopify',
        'Distinzione nuovi vs ritornanti',
        'Confronto con il periodo precedente',
        'Date arbitrarie (since/until) a tua scelta',
      ] },
      { h: 'Consigli e best practice', list: [
        'Individua lo step del funnel con più abbandono e concentra lì i test',
        'Guarda separatamente nuovi e ritornanti: convertono in modo diverso',
      ] },
    ] }),
  A({ id: 'webScanner', tab: 'webScanner', icon: 'scan', group: 'Intelligence Website', category: 'features',
    title: 'AI Website Scanner', summary: 'Scansione AI del sito che segnala problemi e opportunità di miglioramento.',
    sections: [
      { h: 'Cos\'è', p: 'Lo Scanner analizza le pagine del sito con l\'AI e segnala criticità tecniche, di UX e di conversione, con suggerimenti pratici.' },
      { h: 'Cosa include', list: [
        'Scansione on-page con segnalazioni prioritarie',
        'Suggerimenti di ottimizzazione concreti',
      ] },
      { h: 'Consigli e best practice', list: [
        'Affronta prima le segnalazioni ad alto impatto e basso sforzo',
      ] },
    ] }),
  A({ id: 'seoAudit', tab: 'seoAudit', icon: 'search', group: 'Intelligence Website', category: 'features',
    title: 'SEO Audit', summary: 'Suite SEO completa: audit on-page e multipagina, Keyword AI, Editor, AEO, Competitor ed export PDF.',
    sections: [
      { h: 'Cos\'è', p: 'La SEO Audit è la suite per la ricerca organica: audit tecnico e on-page, ricerca keyword con AI, editor dei contenuti, AEO e analisi competitor.' },
      { h: 'Cosa include', list: [
        'Audit on-page e multipagina con storico salvato',
        'Keyword AI, Editor dei contenuti, AEO, analisi Competitor',
        'Integrazione con Google Search Console (dati reali di ricerca)',
        'Export PDF dell\'audit nella lingua del cliente',
      ] },
      { h: 'Come funziona', list: [
        'Collega la Search Console dal pulsante dedicato per i dati reali (query, posizioni)',
        'Volumi keyword e backlink avanzati richiedono fonti dati a pagamento',
        'Lo storico degli audit resta salvato per confrontare i progressi',
      ] },
      { h: 'Consigli e best practice', list: [
        'Parti dall\'audit, poi lavora nell\'Editor le keyword ad alto potenziale',
        'Ricontrolla periodicamente per misurare i miglioramenti nel tempo',
      ] },
    ] }),
  A({ id: 'competitorIntel', tab: 'competitorIntel', icon: 'target', group: 'Intelligence Website', category: 'advanced',
    title: 'Competitor Intel', summary: 'Monitora i competitor: creatività dall\'Ad Library, catalogo e segnali di mercato.',
    sections: [
      { h: 'Cos\'è', p: 'Competitor Intel tiene d\'occhio i tuoi concorrenti raccogliendo creatività pubblicitarie e informazioni utili dal mercato.' },
      { h: 'Cosa include', list: [
        'Creatività dall\'Ad Library con cache durevole',
        'Catalogo e segnali competitivi',
      ] },
      { h: 'Consigli e best practice', list: [
        'Usa le creatività come ispirazione e spunto, non copiarle',
        'Cerca pattern ricorrenti: angoli, formati e offerte che il mercato ripete funzionano',
      ] },
    ] }),
  A({ id: 'priceComparison', tab: 'priceComparison', icon: 'scale', group: 'Intelligence Website', category: 'advanced',
    title: 'Prezzi vs Competitor', summary: 'Confronta il posizionamento di prezzo dei tuoi prodotti con quello dei concorrenti.',
    sections: [
      { h: 'Cos\'è', p: 'Mette a confronto i tuoi prezzi con quelli dei competitor per capire dove sei caro, allineato o conveniente.' },
      { h: 'Cosa include', list: [
        'Confronto prezzi per prodotto/categoria',
        'Posizionamento competitivo complessivo',
      ] },
      { h: 'Consigli e best practice', list: [
        'Non inseguire sempre il prezzo più basso: valuta valore percepito e margine',
      ] },
    ] }),
  A({ id: 'creativeIntel', tab: 'creativeIntel', icon: 'eye', group: 'Intelligence Website', category: 'advanced',
    title: 'Creative Intel', summary: 'Intelligence sulle creatività che funzionano nel mercato: angoli, hook e formati.',
    sections: [
      { h: 'Cos\'è', p: 'Creative Intel analizza le creatività pubblicitarie per individuare pattern, hook e formati vincenti da cui prendere spunto.' },
      { h: 'Cosa include', list: [
        'Analisi di creatività e angoli di comunicazione',
        'Spunti per i tuoi prossimi test creativi',
      ] },
      { h: 'Consigli e best practice', list: [
        'Trasforma gli spunti in test concreti su Meta, poi misura',
      ] },
    ] }),

  // ── META ──────────────────────────────────────────────────────────────
  A({ id: 'creative', tab: 'creative', icon: 'image', group: 'Meta', category: 'features',
    title: 'Creative (Meta)', summary: 'La libreria delle creatività Meta attive con le performance di ognuna.',
    sections: [
      { h: 'Cos\'è', p: 'La tab Creative mostra le creatività attive su Meta con i KPI per ciascuna, così capisci quali immagini/video funzionano davvero.' },
      { h: 'Cosa include', list: [
        'Anteprime delle creatività con metriche (CTR, ROAS, spesa)',
        'Ordinamento per performance',
      ] },
      { h: 'Consigli e best practice', list: [
        'Identifica le creatività stanche e sostituiscile (vedi Creative Fatigue)',
        'Non scalare una sola vincente: confrontane più di una e trova il pattern',
      ] },
    ] }),
  A({ id: 'metaDetail', tab: 'metaDetail', icon: 'list', group: 'Meta', category: 'features',
    title: 'Meta Detail', summary: 'Dettaglio campagne Meta con tutti i KPI e drill-down per segmento di pubblico.',
    sections: [
      { h: 'Cos\'è', p: 'Meta Detail è la vista a campagne di Meta con tutti i KPI e la possibilità di aprire il dettaglio per segmento di pubblico.' },
      { h: 'Cosa include', list: [
        'Tabella campagne con KPI completi',
        'Drill-down per segmenti di pubblico (Nuovo/Esistenti/Interagito/Sconosciuto)',
        'Ordinamento e filtri per stato campagna',
      ] },
      { h: 'Come funziona', list: [
        'Il drill segmenti fa la chiamata API solo quando attivi il toggle (per non sprecare richieste)',
        'Tutto segue il time frame selezionato',
      ] },
    ] }),
  A({ id: 'metaKpi', tab: 'metaKpi', icon: 'gauge', group: 'Meta', category: 'features',
    title: 'Meta KPI', summary: 'KPI medi dell\'account Meta, anche per segmento di pubblico, con grafici che si adattano.',
    sections: [
      { h: 'Cos\'è', p: 'Meta KPI mostra i KPI aggregati dell\'account con tab per segmento di pubblico: cambiando segmento, card e grafici si aggiornano.' },
      { h: 'Cosa include', list: [
        'CAC, CPO, costo per acquisto, acquisti, ROAS, CPC, CTR, CPM, frequenza',
        'Tab segmento: Tutti, Nuovo, Esistenti, Interagito, Sconosciuto',
        'Grafici e variazioni legati al time frame',
      ] },
      { h: 'Consigli e best practice', list: [
        'Confronta il CAC dei segmenti per capire dove spingere l\'acquisizione',
      ] },
    ] }),
  A({ id: 'lighthouse', tab: 'lighthouse', icon: 'warning', group: 'Meta', category: 'advanced',
    title: 'Lighthouse (Meta)', summary: 'Alert e diagnosi azionabili sulle campagne Meta.',
    sections: [
      { h: 'Cos\'è', p: 'Lighthouse segnala problemi e opportunità nelle campagne Meta con spiegazioni chiare su cosa correggere.' },
      { h: 'Cosa include', list: [
        'Alert prioritari con descrizione',
        'Indicazioni concrete su come intervenire',
      ] },
    ] }),
  A({ id: 'creativeFatigue', tab: 'creativeFatigue', icon: 'pulse', group: 'Meta', category: 'advanced',
    title: 'Creative Fatigue', summary: 'Capisci quando una creatività si è "bruciata" e va sostituita.',
    sections: [
      { h: 'Cos\'è', p: 'Rileva l\'affaticamento delle creatività (frequenza alta, CTR in calo) per sostituirle prima che peggiorino i risultati.' },
      { h: 'Cosa include', list: [
        'Indicatori di fatica per creatività',
        'Segnali di calo performance nel tempo',
      ] },
      { h: 'Consigli e best practice', list: [
        'Quando la frequenza sale e il CTR scende, è il momento di rinnovare la creatività',
        'Tieni sempre 2-3 creatività fresche pronte da mettere in rotazione',
      ] },
    ] }),
  A({ id: 'budgetAdvisor', tab: 'budgetAdvisor', icon: 'wallet', group: 'Meta', category: 'advanced',
    title: 'Budget Advisor (Meta)', summary: 'Suggerimenti su come allocare il budget tra le campagne Meta.',
    sections: [
      { h: 'Cos\'è', p: 'Indica dove spostare il budget tra le campagne Meta in base alle performance, per massimizzare il ritorno.' },
      { h: 'Cosa include', list: [
        'Raccomandazioni di allocazione budget',
        'Indicazioni di scale up/down per campagna',
      ] },
    ] }),

  // ── GOOGLE ────────────────────────────────────────────────────────────
  A({ id: 'googleDetail', tab: 'googleDetail', icon: 'list', group: 'Google', category: 'features',
    title: 'Google Detail', summary: 'Dettaglio campagne Google Ads con tutti i KPI per il periodo scelto.',
    sections: [
      { h: 'Cos\'è', p: 'Google Detail è la vista a campagne di Google Ads con metriche complete per il periodo selezionato.' },
      { h: 'Cosa include', list: [
        'Tabella campagne con spesa, conversioni, valore, ROAS',
        'Segmentazione per data',
      ] },
    ] }),
  A({ id: 'googleProducts', tab: 'googleProducts', icon: 'bag', group: 'Google', category: 'features',
    title: 'Prodotti (Google)', summary: 'Performance dei prodotti nelle campagne Shopping / Performance Max.',
    sections: [
      { h: 'Cos\'è', p: 'Mostra le performance a livello di singolo prodotto delle tue campagne Shopping e Performance Max.' },
      { h: 'Cosa include', list: [
        'Spesa e ritorno per prodotto',
        'Prodotti che spingono o sprecano budget',
      ] },
      { h: 'Consigli e best practice', list: [
        'Escludi o riduci i prodotti che bruciano budget senza convertire',
      ] },
    ] }),
  A({ id: 'googleKpi', tab: 'googleKpi', icon: 'gauge', group: 'Google', category: 'features',
    title: 'Google KPI', summary: 'KPI medi dell\'account Google Ads, legati al time frame.',
    sections: [
      { h: 'Cos\'è', p: 'I KPI aggregati di Google Ads: spesa, conversioni, valore, ROAS, CPC, CTR.' },
      { h: 'Come funziona', list: [
        'Il ROAS = valore conversioni ÷ spesa',
        'I dati seguono il time frame selezionato',
      ] },
    ] }),
  A({ id: 'googleLighthouse', tab: 'googleLighthouse', icon: 'warning', group: 'Google', category: 'advanced',
    title: 'Lighthouse (Google)', summary: 'Alert e diagnosi azionabili sulle campagne Google.',
    sections: [
      { h: 'Cos\'è', p: 'Segnala criticità e opportunità nelle campagne Google con spiegazioni su cosa migliorare.' },
      { h: 'Cosa include', list: ['Alert prioritari con descrizione azionabile'] },
    ] }),
  A({ id: 'googleBudgetAdvisor', tab: 'googleBudgetAdvisor', icon: 'wallet', group: 'Google', category: 'advanced',
    title: 'Budget Advisor (Google)', summary: 'Suggerimenti di allocazione del budget sulle campagne Google.',
    sections: [
      { h: 'Cos\'è', p: 'Indica come ridistribuire il budget tra le campagne Google in base alle performance.' },
      { h: 'Cosa include', list: ['Raccomandazioni di budget per campagna'] },
    ] }),

  // ── REPORTS ───────────────────────────────────────────────────────────
  A({ id: 'pnl', tab: 'pnl', icon: 'euro', group: 'Reports', category: 'features',
    title: 'Conto Economico', summary: 'Il P&L del business: ricavi, COGS, spese pubblicitarie e margini in un unico quadro.',
    sections: [
      { h: 'Cos\'è', p: 'Il Conto Economico unisce ricavi, costo del venduto, spese ads e margini per darti il quadro finanziario reale del business.' },
      { h: 'Cosa include', list: [
        'Ricavi netti, COGS, spese pubblicitarie e margine',
        'Vista per periodo',
      ] },
      { h: 'Consigli e best practice', list: [
        'Tieni aggiornati i Costi prodotto: senza COGS corretti il P&L non è affidabile',
      ] },
    ] }),
  A({ id: 'scheduledReports', tab: 'scheduledReports', icon: 'send', group: 'Reports', category: 'advanced',
    title: 'Scheduled Reports', summary: 'Report automatici inviati via email con la cadenza che scegli.',
    sections: [
      { h: 'Cos\'è', p: 'Programma l\'invio automatico di report periodici via email, così tu e il team li ricevete senza doverli aprire.' },
      { h: 'Cosa include', list: [
        'Pianificazione settimanale e/o mensile',
        'Invio automatico ai destinatari scelti',
      ] },
    ] }),
  A({ id: 'periodReports', tab: 'weekly', icon: 'calendar', group: 'Reports', category: 'features',
    title: 'Report periodici (Weekly/Monthly/Quarter/Year)', summary: 'Sintesi delle performance per settimana, mese, trimestre e anno, con insight AI ed export PDF.',
    sections: [
      { h: 'Cos\'è', p: 'Report già pronti che riassumono le performance sui diversi orizzonti temporali, con una sintesi AI di insight e to-do.' },
      { h: 'Cosa include', list: [
        'Quattro orizzonti: Weekly, Monthly, Quarter e Year',
        'Sintesi AI con insight e cose da fare',
        'Export PDF scaricabile nella lingua del cliente',
      ] },
      { h: 'Consigli e best practice', list: [
        'Usa il Weekly per il ritmo operativo e il Monthly/Quarter per le decisioni strategiche',
      ] },
    ] }),
  A({ id: 'simulator', tab: 'simulator', icon: 'gauge', group: 'Reports', category: 'advanced',
    title: 'Simulatore', summary: 'Simula scenari "what-if" sui tuoi numeri prima di muovere il budget reale.',
    sections: [
      { h: 'Cos\'è', p: 'Il Simulatore ti fa modificare le leve (spesa, ROAS, AOV, margini…) e vedere subito l\'impatto sui risultati.' },
      { h: 'Cosa include', list: [
        'Scenari what-if interattivi',
        'Proiezioni su ricavi e margini',
      ] },
      { h: 'Consigli e best practice', list: [
        'Usalo per validare un piano prima di spostare budget vero',
        'Parti dai numeri reali attuali e cambia una leva per volta',
      ] },
    ] }),

  // ── SYSTEM ────────────────────────────────────────────────────────────
  A({ id: 'integrations', tab: 'integrations', icon: 'gear', group: 'System', category: 'gettingStarted',
    title: 'Integrazioni', summary: 'Gestisci le connessioni: Shopify, Meta, Google, Klaviyo, Search Console.',
    sections: [
      { h: 'Cos\'è', p: 'Il pannello dove colleghi, scolleghi e verifichi lo stato di tutte le tue integrazioni dati.' },
      { h: 'Cosa include', list: [
        'Stato di ogni connessione',
        'Riconnessione e gestione dei permessi',
      ] },
      { h: 'Consigli e best practice', list: [
        'Se una tab non ha dati, controlla qui che il canale relativo sia attivo',
        'Dopo un cambio password/permessi sui canali, potrebbe servire riconnettere',
      ] },
    ] }),
  A({ id: 'brandIdentity', tab: 'brandIdentity', icon: 'star', group: 'System', category: 'gettingStarted',
    title: 'Brand Identity', summary: 'La base del brand (tono, lessico, target, persona) che l\'AI usa per ogni output.',
    sections: [
      { h: 'Cos\'è', p: 'Qui definisci l\'identità del brand: è il contesto che l\'AI usa per generare copy, campagne e creatività coerenti col tuo stile.' },
      { h: 'Cosa include', list: [
        'Tono di voce, lessico del brand e parole vietate',
        'Target audience, mission e descrizione',
        'Esempi di copy che funzionano',
      ] },
      { h: 'Consigli e best practice', list: [
        'Compilala con cura: migliora la qualità di TUTTI gli output AI (email, campagne, creative, insight)',
        'Aggiorna le "parole vietate" per evitare termini fuori brand',
      ] },
    ] }),
  A({ id: 'settings', tab: 'settings', icon: 'gear', group: 'System', category: 'gettingStarted',
    title: 'Settings', summary: 'Account, lingua dell\'interfaccia, piano e preferenze.',
    sections: [
      { h: 'Cos\'è', p: 'Le impostazioni dell\'account e dell\'abbonamento.' },
      { h: 'Cosa include', list: [
        'Lingua dell\'interfaccia (italiano, inglese, spagnolo, francese, tedesco)',
        'Gestione piano e fatturazione',
        'Preferenze generali dell\'account',
      ] },
    ] }),
]

export function findArticle(id) {
  return HELP_ARTICLES.find(a => a.id === id) || null
}

// Trova l'articolo collegato a una tab della nav (per l'icona guida in header).
// Alias: i report periodici condividono un'unica guida.
const TAB_ALIASES = { monthly: 'weekly', quarter: 'weekly', year: 'weekly' }
export function articleForTab(tabId) {
  const t = TAB_ALIASES[tabId] || tabId
  return HELP_ARTICLES.find(a => a.tab === t) || null
}
