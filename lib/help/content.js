// ── Contenuti del Centro Assistenza (guide per ogni tab) ────────────────────
// Sorgente unica delle guide. Ogni articolo è collegato a una tab (campo `tab`)
// così dal pop-up si può aprire direttamente la sezione. Contenuto in italiano
// (lingua principale dell'app); la traduzione integrale degli articoli è un
// follow-up — la UI del Centro è già multilingua.

export const HELP_CATEGORIES = ['gettingStarted', 'features', 'advanced']

const A = (o) => o

export const HELP_ARTICLES = [
  // ── COMMERCE ──────────────────────────────────────────────────────────
  A({ id: 'onboarding', tab: 'onboarding', icon: 'rocket', group: 'Commerce', category: 'gettingStarted',
    title: 'Onboarding', summary: 'Collega i tuoi account e prepara LyftAI in pochi minuti.',
    sections: [
      { h: 'Cos\'è', p: 'La procedura guidata che collega le tue fonti dati (Shopify, Meta, Google, Klaviyo) così tutte le altre tab si popolano automaticamente.' },
      { h: 'Cosa include', list: ['Connessione Shopify (ordini, prodotti, clienti, inventario)', 'Collegamento Meta Ads e Google Ads/GA4 via OAuth', 'Klaviyo per l\'email marketing', 'Verifica degli scope/permessi necessari'] },
      { h: 'Come funziona', list: ['Segui i passaggi in ordine: ogni connessione abilita le tab collegate', 'Per Shopify assegna gli scope di LETTURA (read_orders, read_products, read_customers, read_inventory, read_reports)', 'Una volta collegato un canale, la spunta diventa verde'] },
      { h: 'Consigli', list: ['Completa prima Shopify: sblocca Dashboard, Inventario, Clienti, LTV', 'Se un dato non compare, torna qui e controlla che il canale sia connesso'] },
    ] }),
  A({ id: 'dashboard', tab: 'dashboard', icon: 'grid', group: 'Commerce', category: 'gettingStarted',
    title: 'Dashboard', summary: 'La fotografia quotidiana del business: vendite, ordini, ads e clienti.',
    sections: [
      { h: 'Cos\'è', p: 'Il quadro generale con i numeri chiave del periodo selezionato: ricavi, ordini, nuovi vs ritorno, resi, spesa pubblicitaria e ROAS.' },
      { h: 'Cosa include', list: ['KPI vendite (ricavi, ordini, AOV)', 'Nuovi clienti vs clienti di ritorno e relativi resi', 'Spesa e ritorno su Meta e Google', 'Globo realtime dei visitatori (dati GA4)'] },
      { h: 'Come funziona', list: ['Cambia il time frame in alto a destra: tutti i dati si aggiornano', 'I dati vendite arrivano da Shopify, gli ads da Meta/Google, il realtime da GA4', 'Le card colorano solo le variazioni %, i valori restano bianchi'] },
      { h: 'Consigli', list: ['Usala ogni mattina come check rapido', 'Per analisi profonde vai nelle tab dedicate (KPI Brain, Performance prodotti, Clienti)'] },
    ] }),
  A({ id: 'inventory', tab: 'inventory', icon: 'box', group: 'Commerce', category: 'features',
    title: 'Inventario', summary: 'Intelligence sullo stock per taglia/SKU: stockout, taglie rotte, vendite perse.',
    sections: [
      { h: 'Cos\'è', p: 'Monitora la giacenza a livello di variante/taglia da Shopify e stima quando andrai in stockout, evidenziando il rischio commerciale in €.' },
      { h: 'Cosa include', list: ['Giorni-a-stockout per variante (velocità pesata sul recente)', '"Taglie rotte" (broken sizes) dei prodotti', 'Valore inventario a COGS e vendite perse stimate in €', 'Matrice taglie per prodotto (ideale per apparel)'] },
      { h: 'Come funziona', list: ['La velocità di vendita è pesata sui giorni recenti per essere realistica', 'Il rischio è ordinato per priorità commerciale (€ a rischio, non solo giorni)', 'I COGS arrivano dalla tab Costi prodotto'] },
      { h: 'Consigli', list: ['Riassortisci prima le varianti con più € a rischio', 'Tieni aggiornati i costi landed per stime di margine corrette'] },
    ] }),
  A({ id: 'productPerformance', tab: 'productPerformance', icon: 'chart-bar', group: 'Commerce', category: 'features',
    title: 'Performance prodotti', summary: 'Conto economico per singolo prodotto: netto, COGS, ADS allocati, margine, ROAS.',
    sections: [
      { h: 'Cos\'è', p: 'Un P&L per prodotto che mostra quanto guadagni davvero su ciascun articolo, allocando i costi pubblicitari.' },
      { h: 'Cosa include', list: ['Ricavo netto, COGS, margine operativo per prodotto', 'ADS (Meta + Google) allocati in proporzione al ricavo o per mappatura campagna→prodotto', 'ROAS e variazione Δ rispetto al periodo precedente'] },
      { h: 'Come funziona', list: ['Gli ADS si allocano in modo proporzionale (stima) oppure preciso se mappi le campagne ai prodotti', 'Esclude spedizione e marketplace esterni: è focalizzato sul B2C diretto'] },
      { h: 'Consigli', list: ['Mappa le campagne ai prodotti per un\'allocazione ADS precisa', 'Taglia o ripensa i prodotti con margine operativo negativo costante'] },
    ] }),
  A({ id: 'productCosts', tab: 'productCosts', icon: 'money', group: 'Commerce', category: 'features',
    title: 'Costi prodotto', summary: 'Editor del costo landed per variante: alimenta COGS di Inventario e Performance.',
    sections: [
      { h: 'Cos\'è', p: 'Dove imposti il costo reale "landed" (prodotto + dazi + spedizione in entrata) di ogni variante.' },
      { h: 'Cosa include', list: ['Costo landed per variante con storico inline', 'Sync automatico dei cambi costo da Shopify (on-load + cron notturno)', 'Override manuale quando il costo Shopify non basta'] },
      { h: 'Come funziona', list: ['Ogni salvataggio crea una riga storica con data di validità', 'I valori alimentano COGS, margini e vendite perse nelle altre tab'] },
      { h: 'Consigli', list: ['Aggiorna i costi quando cambi fornitore o prezzi d\'acquisto', 'Costi corretti = margini e P&L affidabili ovunque'] },
    ] }),
  A({ id: 'kpiBrain', tab: 'kpiBrain', icon: 'chart-line', group: 'Commerce', category: 'features',
    title: 'KPI Brain', summary: 'Tutti i KPI di marketing in un cervello unico, con lettura AI.',
    sections: [
      { h: 'Cos\'è', p: 'La centrale dei KPI cross-canale (Shopify, Meta, Google) con pannelli e una lettura intelligente dei numeri.' },
      { h: 'Cosa include', list: ['Card KPI per Shopify, Meta Ads e Google Ads', 'CAC nuovi clienti per canale (segmenti pubblico Meta + Google)', 'Sparkline e variazione % vs periodo precedente'] },
      { h: 'Come funziona', list: ['Tutto è legato al time frame selezionato', 'I dati sono in cache (SWR) per aperture istantanee'] },
      { h: 'Consigli', list: ['Parti da qui per capire "come va" prima di scendere nel dettaglio per canale'] },
    ] }),
  A({ id: 'attribution', tab: 'attribution', icon: 'target', group: 'Commerce', category: 'advanced',
    title: 'Attribuzione', summary: 'Capisci quali canali generano davvero le vendite.',
    sections: [
      { h: 'Cos\'è', p: 'Mette a confronto la spesa e i ricavi per canale per stimare il contributo reale di ciascuna fonte.' },
      { h: 'Cosa include', list: ['Confronto canali (Meta, Google, organico, email)', 'Vendite e ROAS per fonte nel time frame scelto'] },
      { h: 'Consigli', list: ['Leggila insieme a KPI Brain e LTV per decisioni di budget'] },
    ] }),
  A({ id: 'ltvCohorts', tab: 'ltvCohorts', icon: 'layers', group: 'Commerce', category: 'features',
    title: 'LTV & Coorti', summary: 'Valore nel tempo dei clienti per coorte d\'acquisizione, con CAC e ratio.',
    sections: [
      { h: 'Cos\'è', p: 'Analizza il valore dei clienti raggruppati per mese di primo acquisto: repeat rate, ordini/cliente, LTV.' },
      { h: 'Cosa include', list: ['LTV Lordo e LTV Netto (× margine reale dai costi)', 'CAC (spesa ads ÷ nuovi clienti) e ratio LTV:CAC', 'Repeat rate e ordini per cliente per coorte'] },
      { h: 'Come funziona', list: ['Usa gli aggregati lifetime di Shopify (storico completo, non solo 60 giorni)', 'Il margine reale arriva dai Costi prodotto'] },
      { h: 'Consigli', list: ['Un ratio LTV:CAC sano è ≥ 3: sotto, rivedi acquisizione o margini'] },
    ] }),
  A({ id: 'clienti', tab: 'clienti', icon: 'users', group: 'Commerce', category: 'features',
    title: 'Clienti', summary: 'Segmentazione RFM dei clienti + Analytics + Insight AI e campagne in 1 click.',
    sections: [
      { h: 'Cos\'è', p: 'Il layer d\'azione sui clienti: divide automaticamente la base in segmenti per ciclo di vita e ti fa agire subito.' },
      { h: 'Cosa include', list: ['6 segmenti RFM: Nuovi, Potenziali fedeli, Fedeli, Fedeli a rischio, Stanno per dormire, Dormienti', 'KPI (clienti, CLV, ordini/cliente, giorni tra ordini, AOV) con split nuovi/ritorno', 'Analytics nel tempo: clienti, retention, CLV, clienti per segmento, variazioni', 'Insight AI con raccomandazioni proattive', 'Crea campagna: copy email generato dall\'AI da incollare in Klaviyo'] },
      { h: 'Come funziona', list: ['I dati arrivano via Shopify Bulk Operations (tutti i clienti, niente limiti)', 'Tre viste: Panoramica, Analytics, Insight', 'Clicca un segmento per vedere i suoi clienti; "Ricostruisci storico" popola i grafici dagli ordini passati'] },
      { h: 'Consigli', list: ['Parti dai segmenti a maggior valore recuperabile (Fedeli a rischio, Dormienti)', 'Usa gli Insight per sapere quale azione fare prima'] },
    ] }),
  A({ id: 'klaviyo', tab: 'klaviyo', icon: 'mail', group: 'Commerce', category: 'features',
    title: 'Klaviyo', summary: 'Le metriche email/SMS e i flussi che generano ricavo.',
    sections: [
      { h: 'Cos\'è', p: 'Porta in LyftAI le performance del tuo Klaviyo: campagne, flussi e revenue attribuito.' },
      { h: 'Cosa include', list: ['Ricavi da email/SMS e quota sul totale', 'Performance di campagne e flussi automatici'] },
      { h: 'Consigli', list: ['Incolla qui i segmenti generati dalla tab Clienti per campagne mirate'] },
    ] }),

  // ── PRODUCTIVITY AI ───────────────────────────────────────────────────
  A({ id: 'tasks', tab: 'tasks', icon: 'kanban', group: 'Productivity AI', category: 'features',
    title: 'Progetti & Task', summary: 'Board Kanban multi-utente per gestire il lavoro del team.',
    sections: [
      { h: 'Cos\'è', p: 'Un gestionale di progetti e attività con board Kanban, ruoli e accessi per il team.' },
      { h: 'Cosa include', list: ['Board Kanban con colonne e schede', 'Multi-utente con ruoli (login reali via invito email)', 'Assegnazioni e stato delle attività'] },
      { h: 'Consigli', list: ['Trasforma le raccomandazioni dell\'AI in task assegnati'] },
    ] }),
  A({ id: 'timeTracking', tab: 'timeTracking', icon: 'clock', group: 'Productivity AI', category: 'features',
    title: 'Lyftimer', summary: 'Time-tracker stile Hubstaff: timer live, timesheet e totali.',
    sections: [
      { h: 'Cos\'è', p: 'Traccia il tempo su progetti e task con timer live e riepiloghi.' },
      { h: 'Cosa include', list: ['Timer live con progetto/task/descrizione', 'Timesheet e totali per persona e progetto'] },
      { h: 'Consigli', list: ['Collega le ore ai progetti per capire il costo reale del lavoro'] },
    ] }),
  A({ id: 'chat', tab: 'chat', icon: 'chat', group: 'Productivity AI', category: 'features',
    title: 'LyftTalk', summary: 'La chat dove vive la Squadra AI e parli con i tuoi dati.',
    sections: [
      { h: 'Cos\'è', p: 'L\'assistente conversazionale: fai domande sui dati, chiedi strategie, brainstorming.' },
      { h: 'Cosa include', list: ['Chat con il consulente AI sui tuoi numeri reali', 'Accesso agli agenti della Squadra AI chiamandoli per nome'] },
      { h: 'Consigli', list: ['Chiedi "cosa faresti questa settimana?" per priorità concrete'] },
    ] }),
  A({ id: 'team', tab: 'team', icon: 'users', group: 'Productivity AI', category: 'advanced',
    title: 'Squadra AI', summary: '8 agenti C-suite/specialisti con gerarchia che lavorano per te.',
    sections: [
      { h: 'Cos\'è', p: 'Un team di agenti AI (CEO, marketing, performance, copy, creatività…) che rispondono nel loro ruolo.' },
      { h: 'Cosa include', list: ['Agenti specializzati con personalità e competenze diverse', 'Vivono in LyftTalk e rispondono se chiamati per nome'] },
      { h: 'Consigli', list: ['Chiedi all\'agente giusto: il copy a chi fa copy, il budget a chi fa performance'] },
    ] }),
  A({ id: 'performanceAgent', tab: 'performanceAgent', icon: 'sparkle', group: 'Productivity AI', category: 'advanced',
    title: 'Performance Agent', summary: 'L\'agente che analizza le performance e propone azioni.',
    sections: [
      { h: 'Cos\'è', p: 'Analizza automaticamente i dati di performance e suggerisce cosa ottimizzare.' },
      { h: 'Cosa include', list: ['Analisi cross-canale delle performance', 'Raccomandazioni azionabili con priorità'] },
      { h: 'Consigli', list: ['Manda le raccomandazioni nella Coda Azioni per eseguirle'] },
    ] }),
  A({ id: 'creativeStudio', tab: 'creativeStudio', icon: 'sparkle', group: 'Productivity AI', category: 'features',
    title: 'Creative Studio', summary: 'Board generativa chat-driven per immagini e creatività (e presto video/UGC).',
    sections: [
      { h: 'Cos\'è', p: 'Lo studio creativo AI: generi immagini e asset partendo dal contesto del tuo brand.' },
      { h: 'Cosa include', list: ['Generazione immagini multi-modello con contesto cliente', 'Studios/ambienti e suite di editing', 'Crediti gestiti via Stripe'] },
      { h: 'Consigli', list: ['Mantieni coerenza con il Brand Identity per output on-brand'] },
    ] }),
  A({ id: 'actionQueue', tab: 'actionQueue', icon: 'bolt', group: 'Productivity AI', category: 'advanced',
    title: 'Coda Azioni', summary: 'Le azioni proposte dai moduli, in attesa di approvazione ed esecuzione.',
    sections: [
      { h: 'Cos\'è', p: 'Il punto di controllo dove approvi (o scarti) le azioni suggerite dall\'AI prima che vengano eseguite.' },
      { h: 'Cosa include', list: ['Elenco azioni proposte con priorità', 'Approvazione/esecuzione tracciata'] },
      { h: 'Consigli', list: ['Rivedi la coda con regolarità: è il ponte tra insight e azione'] },
    ] }),

  // ── INTELLIGENCE WEBSITE ──────────────────────────────────────────────
  A({ id: 'cro', tab: 'cro', icon: 'funnel', group: 'Intelligence Website', category: 'features',
    title: 'CRO', summary: 'Funnel di conversione giorno-preciso da GA4 e Shopify.',
    sections: [
      { h: 'Cos\'è', p: 'Analisi della conversione del sito con funnel reale (non stimato) per il periodo scelto.' },
      { h: 'Cosa include', list: ['Funnel reale da GA4 + Shopify', 'Nuovi vs ritornanti e confronto col periodo precedente'] },
      { h: 'Consigli', list: ['Individua lo step del funnel con più abbandono e agisci lì'] },
    ] }),
  A({ id: 'webScanner', tab: 'webScanner', icon: 'scan', group: 'Intelligence Website', category: 'features',
    title: 'AI Website Scanner', summary: 'Scansione AI del sito per problemi e opportunità.',
    sections: [
      { h: 'Cos\'è', p: 'Analizza le pagine del sito e segnala criticità e miglioramenti.' },
      { h: 'Cosa include', list: ['Scansione on-page con segnalazioni prioritarie', 'Suggerimenti di ottimizzazione'] },
    ] }),
  A({ id: 'seoAudit', tab: 'seoAudit', icon: 'search', group: 'Intelligence Website', category: 'features',
    title: 'SEO Audit', summary: 'Audit SEO on-page e multipagina, keyword AI, AEO, competitor, PDF.',
    sections: [
      { h: 'Cos\'è', p: 'La suite SEO: audit tecnico/on-page, ricerca keyword con AI, editor, AEO e analisi competitor.' },
      { h: 'Cosa include', list: ['Audit on-page e multipagina con storico su Supabase', 'Keyword AI, Editor, AEO, Competitor', 'Export PDF nella lingua del cliente', 'Integrazione Google Search Console'] },
      { h: 'Come funziona', list: ['Volumi e backlink avanzati richiedono fonti dati a pagamento', 'Collega GSC dal pulsante dedicato per i dati reali di ricerca'] },
      { h: 'Consigli', list: ['Parti dall\'audit, poi lavora le keyword ad alto potenziale nell\'Editor'] },
    ] }),
  A({ id: 'competitorIntel', tab: 'competitorIntel', icon: 'target', group: 'Intelligence Website', category: 'advanced',
    title: 'Competitor Intel', summary: 'Monitora i competitor: creatività, catalogo, mosse.',
    sections: [
      { h: 'Cos\'è', p: 'Tiene d\'occhio i competitor raccogliendo creatività e informazioni dal mercato.' },
      { h: 'Cosa include', list: ['Creatività dall\'Ad Library (cache durevole)', 'Catalogo e segnali competitivi'] },
      { h: 'Consigli', list: ['Usa le creatività come ispirazione, non copiarle'] },
    ] }),
  A({ id: 'priceComparison', tab: 'priceComparison', icon: 'scale', group: 'Intelligence Website', category: 'advanced',
    title: 'Prezzi vs Competitor', summary: 'Confronta i tuoi prezzi con quelli dei competitor.',
    sections: [
      { h: 'Cos\'è', p: 'Mette a confronto il posizionamento di prezzo dei tuoi prodotti rispetto ai concorrenti.' },
      { h: 'Cosa include', list: ['Confronto prezzi per prodotto/categoria', 'Posizionamento competitivo'] },
    ] }),
  A({ id: 'creativeIntel', tab: 'creativeIntel', icon: 'eye', group: 'Intelligence Website', category: 'advanced',
    title: 'Creative Intel', summary: 'Intelligence sulle creatività che funzionano nel mercato.',
    sections: [
      { h: 'Cos\'è', p: 'Analizza le creatività pubblicitarie per capire pattern, hook e formati vincenti.' },
      { h: 'Cosa include', list: ['Analisi di creatività e angoli', 'Spunti per i tuoi test creativi'] },
    ] }),

  // ── META ──────────────────────────────────────────────────────────────
  A({ id: 'creative', tab: 'creative', icon: 'image', group: 'Meta', category: 'features',
    title: 'Creative (Meta)', summary: 'Le creatività Meta con le loro performance.',
    sections: [
      { h: 'Cos\'è', p: 'La libreria delle creatività attive su Meta con i KPI per ognuna.' },
      { h: 'Cosa include', list: ['Anteprime creatività con metriche (CTR, ROAS, spesa)', 'Ordinamento per performance'] },
      { h: 'Consigli', list: ['Identifica le creatività stanche e sostituiscile (vedi Creative Fatigue)'] },
    ] }),
  A({ id: 'metaDetail', tab: 'metaDetail', icon: 'list', group: 'Meta', category: 'features',
    title: 'Meta Detail', summary: 'Dettaglio campagne Meta con drill sui segmenti di pubblico.',
    sections: [
      { h: 'Cos\'è', p: 'La vista a campagne di Meta con tutti i KPI e il drill-down per segmento di pubblico.' },
      { h: 'Cosa include', list: ['Tabella campagne con KPI completi', 'Drill-down per segmenti pubblico (on-demand, solo se clicchi)'] },
      { h: 'Come funziona', list: ['Il drill segmenti fa la chiamata API solo quando attivi il toggle', 'Tutto segue il time frame selezionato'] },
    ] }),
  A({ id: 'metaKpi', tab: 'metaKpi', icon: 'gauge', group: 'Meta', category: 'features',
    title: 'Meta KPI', summary: 'KPI medi dell\'account Meta, anche per segmento di pubblico.',
    sections: [
      { h: 'Cos\'è', p: 'I KPI aggregati di Meta con tab per segmento (Tutti/Nuovo/Esistenti/Interagito/Sconosciuto).' },
      { h: 'Cosa include', list: ['CAC, CPO, acquisti, ROAS, CPC, CTR, CPM, frequenza', 'Tab segmento che scambiano card e grafici'] },
      { h: 'Consigli', list: ['Confronta il CAC dei segmenti per capire dove spingere'] },
    ] }),
  A({ id: 'lighthouse', tab: 'lighthouse', icon: 'warning', group: 'Meta', category: 'advanced',
    title: 'Lighthouse (Meta)', summary: 'Alert e diagnosi sulle campagne Meta.',
    sections: [
      { h: 'Cos\'è', p: 'Segnala problemi e opportunità nelle campagne Meta con spiegazioni azionabili.' },
      { h: 'Cosa include', list: ['Alert prioritari con descrizione', 'Indicazioni su cosa correggere'] },
    ] }),
  A({ id: 'creativeFatigue', tab: 'creativeFatigue', icon: 'pulse', group: 'Meta', category: 'advanced',
    title: 'Creative Fatigue', summary: 'Capisci quando una creatività si è "bruciata".',
    sections: [
      { h: 'Cos\'è', p: 'Rileva l\'affaticamento delle creatività (frequenza alta, CTR in calo) per sostituirle in tempo.' },
      { h: 'Cosa include', list: ['Indicatori di fatica per creatività', 'Segnali di calo performance nel tempo'] },
      { h: 'Consigli', list: ['Quando la frequenza sale e il CTR scende, rinnova la creatività'] },
    ] }),
  A({ id: 'budgetAdvisor', tab: 'budgetAdvisor', icon: 'wallet', group: 'Meta', category: 'advanced',
    title: 'Budget Advisor (Meta)', summary: 'Suggerimenti su come allocare il budget Meta.',
    sections: [
      { h: 'Cos\'è', p: 'Indica dove spostare il budget tra campagne in base alle performance.' },
      { h: 'Cosa include', list: ['Raccomandazioni di allocazione budget', 'Scale up/down per campagna'] },
    ] }),

  // ── GOOGLE ────────────────────────────────────────────────────────────
  A({ id: 'googleDetail', tab: 'googleDetail', icon: 'list', group: 'Google', category: 'features',
    title: 'Google Detail', summary: 'Dettaglio campagne Google Ads con tutti i KPI.',
    sections: [
      { h: 'Cos\'è', p: 'La vista a campagne di Google Ads con metriche complete per il periodo scelto.' },
      { h: 'Cosa include', list: ['Tabella campagne con spesa, conversioni, valore, ROAS', 'Segmentazione per data'] },
    ] }),
  A({ id: 'googleProducts', tab: 'googleProducts', icon: 'bag', group: 'Google', category: 'features',
    title: 'Prodotti (Google)', summary: 'Performance dei prodotti su Google Shopping.',
    sections: [
      { h: 'Cos\'è', p: 'Le performance a livello di prodotto delle campagne Shopping/Performance Max.' },
      { h: 'Cosa include', list: ['Spesa e ritorno per prodotto', 'Prodotti che spingono o sprecano budget'] },
    ] }),
  A({ id: 'googleKpi', tab: 'googleKpi', icon: 'gauge', group: 'Google', category: 'features',
    title: 'Google KPI', summary: 'KPI medi dell\'account Google Ads.',
    sections: [
      { h: 'Cos\'è', p: 'I KPI aggregati di Google Ads (spesa, conversioni, valore, ROAS, CPC, CTR).' },
      { h: 'Come funziona', list: ['Il ROAS = valore conversioni ÷ spesa', 'I dati seguono il time frame selezionato'] },
    ] }),
  A({ id: 'googleLighthouse', tab: 'googleLighthouse', icon: 'warning', group: 'Google', category: 'advanced',
    title: 'Lighthouse (Google)', summary: 'Alert e diagnosi sulle campagne Google.',
    sections: [
      { h: 'Cos\'è', p: 'Segnala criticità e opportunità nelle campagne Google con spiegazioni.' },
      { h: 'Cosa include', list: ['Alert prioritari con descrizione azionabile'] },
    ] }),
  A({ id: 'googleBudgetAdvisor', tab: 'googleBudgetAdvisor', icon: 'wallet', group: 'Google', category: 'advanced',
    title: 'Budget Advisor (Google)', summary: 'Suggerimenti di allocazione budget su Google.',
    sections: [
      { h: 'Cos\'è', p: 'Indica come ridistribuire il budget tra campagne Google in base alle performance.' },
      { h: 'Cosa include', list: ['Raccomandazioni di budget per campagna'] },
    ] }),

  // ── REPORTS ───────────────────────────────────────────────────────────
  A({ id: 'pnl', tab: 'pnl', icon: 'euro', group: 'Reports', category: 'features',
    title: 'Conto Economico', summary: 'Il P&L del business: ricavi, costi, margini.',
    sections: [
      { h: 'Cos\'è', p: 'Il conto economico che unisce ricavi, COGS, spese ads e margini in un quadro finanziario.' },
      { h: 'Cosa include', list: ['Ricavi netti, COGS, spese pubblicitarie, margine', 'Vista per periodo'] },
      { h: 'Consigli', list: ['Tieni aggiornati i Costi prodotto per un P&L affidabile'] },
    ] }),
  A({ id: 'scheduledReports', tab: 'scheduledReports', icon: 'send', group: 'Reports', category: 'advanced',
    title: 'Scheduled Reports', summary: 'Report automatici inviati via email con cadenza.',
    sections: [
      { h: 'Cos\'è', p: 'Programma l\'invio automatico di report periodici via email.' },
      { h: 'Cosa include', list: ['Pianificazione settimanale/mensile', 'Invio automatico ai destinatari'] },
    ] }),
  A({ id: 'periodReports', tab: 'weekly', icon: 'calendar', group: 'Reports', category: 'features',
    title: 'Report periodici (Weekly/Monthly/Quarter/Year)', summary: 'Sintesi delle performance per settimana, mese, trimestre e anno.',
    sections: [
      { h: 'Cos\'è', p: 'Report già pronti con il riepilogo delle performance per i diversi orizzonti temporali.' },
      { h: 'Cosa include', list: ['Weekly, Monthly, Quarter e Year', 'Sintesi AI con insight e to-do', 'Export PDF scaricabile'] },
      { h: 'Consigli', list: ['Usa il Weekly per il ritmo operativo, il Monthly/Quarter per le decisioni strategiche'] },
    ] }),
  A({ id: 'simulator', tab: 'simulator', icon: 'gauge', group: 'Reports', category: 'advanced',
    title: 'Simulatore', summary: 'Simula scenari "what-if" sui tuoi numeri.',
    sections: [
      { h: 'Cos\'è', p: 'Modifica leve (spesa, ROAS, AOV, margini…) e vedi l\'impatto sui risultati.' },
      { h: 'Cosa include', list: ['Scenari what-if interattivi', 'Proiezioni su ricavi e margini'] },
      { h: 'Consigli', list: ['Usalo per validare un piano prima di spostare il budget reale'] },
    ] }),

  // ── SYSTEM ────────────────────────────────────────────────────────────
  A({ id: 'integrations', tab: 'integrations', icon: 'gear', group: 'System', category: 'gettingStarted',
    title: 'Integrazioni', summary: 'Gestisci le connessioni: Shopify, Meta, Google, Klaviyo, GSC.',
    sections: [
      { h: 'Cos\'è', p: 'Il pannello per collegare, scollegare e verificare lo stato delle tue integrazioni.' },
      { h: 'Cosa include', list: ['Stato di ogni connessione', 'Riconnessione e gestione permessi'] },
      { h: 'Consigli', list: ['Se una tab non ha dati, controlla qui che il canale sia attivo'] },
    ] }),
  A({ id: 'brandIdentity', tab: 'brandIdentity', icon: 'star', group: 'System', category: 'gettingStarted',
    title: 'Brand Identity', summary: 'La base del brand: tono, lessico, target, persona.',
    sections: [
      { h: 'Cos\'è', p: 'Dove definisci l\'identità del brand che l\'AI usa per generare copy e creatività on-brand.' },
      { h: 'Cosa include', list: ['Tono di voce, lessico e parole vietate', 'Target audience, mission, esempi di copy'] },
      { h: 'Consigli', list: ['Compilala bene: migliora tutti gli output AI (copy email, campagne, creative)'] },
    ] }),
  A({ id: 'settings', tab: 'settings', icon: 'gear', group: 'System', category: 'gettingStarted',
    title: 'Settings', summary: 'Account, lingua, piano e preferenze.',
    sections: [
      { h: 'Cos\'è', p: 'Le impostazioni dell\'account e dell\'abbonamento.' },
      { h: 'Cosa include', list: ['Lingua dell\'interfaccia (5 lingue)', 'Gestione piano e fatturazione', 'Preferenze generali'] },
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
