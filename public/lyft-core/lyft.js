// ============================================================================
//  Lyft — il centro di comando del prodotto.
//
//  La pagina (stile, struttura, nucleo animato) e' quella dell'assistente
//  personale da cui nasce; qui c'e' solo cio' che la fa vivere dentro il
//  prodotto: i pannelli si riempiono con i dati del cliente in cui si e'
//  entrati, la domanda va al cervello del prodotto (/api/agent) e la voce e'
//  quella del browser, che reagisce al nome «Lyft».
//
//  Nessuna chiave e nessun dato stanno in questo file: tutto passa dalle rotte
//  del prodotto, che decidono il cliente dalla sessione.
// ============================================================================
(function () {
  const $ = id => document.getElementById(id)
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const Q = new URLSearchParams(location.search)
  const L = ['it', 'en', 'es', 'fr', 'de'].includes(Q.get('l')) ? Q.get('l') : 'it'
  const LOC = { it: 'it-IT', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' }[L]
  const T = {
    it: { stradaVeloce: 'Risposta veloce', miCollego: 'Mi collego…', inConversazione: 'Ti ascolto: parla pure. Spazio per interrompermi', hoSentito: 'Ho sentito', notaSpento: 'Microfono spento: premi per riaccenderlo', eMic: 'Microfono non autorizzato: consenti il microfono per questo sito e premi qui', eNessunMic: 'Nessun microfono trovato', eRete: 'Il riconoscimento vocale di questo browser non è raggiungibile: prova con Chrome o Safari', eLingua: 'Lingua non supportata dal riconoscimento vocale', eBrowser: 'Questo browser non ha il riconoscimento vocale: usa Chrome, Edge o Safari. Puoi comunque scrivere.', eVoce: 'La voce non parte', browser: 'Browser', senzaEstensione: 'Estensione del browser non installata', senzaEstensioneLungo: 'Per cercare guidando il tuo browser serve l’estensione Lyft. Senza, posso comunque cercare online e darti le fonti.', stoNavigando: 'Sto navigando', fermati: 'Fermati', fermato: 'Mi sono fermato come hai chiesto.', passatoA: 'Passato a', haFinito: 'ha finito', nonHaFinito: 'non è riuscito a finire', vediSquadra: 'Il risultato è nella tab Squadra agent.', cercoOnline: 'Sto cercando online', passoSquadra: 'Passo il lavoro alla squadra', agendaOggi: 'Agenda di oggi', giornataLibera: 'Nessun appuntamento oggi', kVendite: 'Vendite', kNuovi: 'Nuovi', kVisite: 'Visite', kOrdini: 'Ordini', pDati: 'Dati', pSquadra: 'Squadra', pMotore: 'Motore', centro: 'Centro di comando', motore: 'Motore Creativo', squadra: 'Squadra agent', report: 'Report', integrazioni: 'Integrazioni', voce: 'Voce', spento: 'Spento', ascolto: 'In ascolto…', armato: 'Dimmi', pensa: 'Sto pensando…', parla: 'Sto parlando…', nota: 'Di’ «Lyft» o «Ehy Lyft» e poi la domanda', sistemi: 'Stato sistemi', ottimale: 'Ottimale', attenzione: 'Attenzione', operatore: 'Operatore', nucleo: 'Nucleo AI', cervello: 'Cervello', dati: 'Dati del negozio', sistema: 'Sistema', attivo: 'attivo', fermo: 'fermo', feed: 'Feed in diretta', timeline: 'Squadra · prossimi giri', piattaforme: 'Piattaforme · oggi', comandi: 'Comandi rapidi', c1: 'Punto di ieri', c2: 'Creatività da scalare', c3: 'Cosa devo decidere', c4: 'Dove perdo margine', q1: 'Fammi il punto di ieri: vendite, spesa, MER e cosa è cambiato rispetto al giorno prima.', q2: 'Quali creatività devo scalare, quali tenere e quali spegnere, e perché?', q3: 'Cosa aspetta una mia decisione dalla squadra?', q4: 'Dove sto perdendo margine questo mese?', agenti: 'Agenti', lavoro: 'Al lavoro', decidere: 'Da decidere', verdetti: 'Creatività · verdetti', collegamenti: 'Collegamenti', parlaCon: 'PARLA CON LYFT', premi: 'di’ «Lyft» o «Ehy Lyft»', scrivi: 'Scrivi a Lyft…', invia: 'Invia', fatturato: 'Fatturato', ordini: 'Ordini', spesaMeta: 'Spesa Meta', mer: 'MER', sessioni: 'Sessioni', nuovi: 'Clienti nuovi', suMeta: 'sulla spesa Meta', oggi: 'oggi', nessunaSquadra: 'Nessuna squadra attiva', motoreSpento: 'Motore Creativo non acceso', creativita: 'creatività', guardo: 'Sto guardando i dati', risposto: 'risposta pronta', domanda: 'domanda', nonRiuscito: 'Non sono riuscito a rispondere', chiudi: 'Chiudi', collegato: 'collegato', nonCollegato: 'non collegato', libero: 'libero', haiChiesto: 'Hai chiesto', online: 'online', offline: 'offline', giroLibero: 'Nessun giro in programma', domani: 'domani' },
    en: { stradaVeloce: 'Quick answer', miCollego: 'Connecting…', inConversazione: 'I’m listening: go ahead. Space to interrupt me', hoSentito: 'I heard', notaSpento: 'Microphone off: press to turn it back on', eMic: 'Microphone not allowed: allow the microphone for this site and press here', eNessunMic: 'No microphone found', eRete: 'This browser’s speech recognition cannot be reached: try Chrome or Safari', eLingua: 'Language not supported by speech recognition', eBrowser: 'This browser has no speech recognition: use Chrome, Edge or Safari. You can still type.', eVoce: 'Voice will not start', browser: 'Browser', senzaEstensione: 'Browser extension not installed', senzaEstensioneLungo: 'To search by driving your browser the Lyft extension is needed. Without it I can still search online and give you the sources.', stoNavigando: 'Browsing', fermati: 'Stop', fermato: 'I stopped as you asked.', passatoA: 'Passed to', haFinito: 'has finished', nonHaFinito: 'could not finish', vediSquadra: 'The result is in the Agent team tab.', cercoOnline: 'Searching online', passoSquadra: 'Handing the work to the team', agendaOggi: 'Today’s agenda', giornataLibera: 'No appointments today', kVendite: 'Sales', kNuovi: 'New', kVisite: 'Visits', kOrdini: 'Orders', pDati: 'Data', pSquadra: 'Team', pMotore: 'Engine', centro: 'Command centre', motore: 'Creative Engine', squadra: 'Agent team', report: 'Reports', integrazioni: 'Integrations', voce: 'Voice', spento: 'Off', ascolto: 'Listening…', armato: 'Go ahead', pensa: 'Thinking…', parla: 'Speaking…', nota: 'Say “Lyft” or “Hey Lyft”, then your question', sistemi: 'System status', ottimale: 'Optimal', attenzione: 'Attention', operatore: 'Operator', nucleo: 'AI core', cervello: 'Brain', dati: 'Store data', sistema: 'System', attivo: 'active', fermo: 'stopped', feed: 'Live feed', timeline: 'Team · next runs', piattaforme: 'Platforms · today', comandi: 'Quick commands', c1: 'Yesterday’s recap', c2: 'Creatives to scale', c3: 'What needs my decision', c4: 'Where I lose margin', q1: 'Give me yesterday’s recap: sales, spend, MER and what changed versus the day before.', q2: 'Which creatives should I scale, keep and switch off, and why?', q3: 'What is waiting for my decision from the team?', q4: 'Where am I losing margin this month?', agenti: 'Agents', lavoro: 'Working', decidere: 'To decide', verdetti: 'Creatives · verdicts', collegamenti: 'Connections', parlaCon: 'TALK TO LYFT', premi: 'press or say “Lyft”', scrivi: 'Write to Lyft…', invia: 'Send', fatturato: 'Revenue', ordini: 'Orders', spesaMeta: 'Meta spend', mer: 'MER', sessioni: 'Sessions', nuovi: 'New customers', suMeta: 'on Meta spend', oggi: 'today', nessunaSquadra: 'No active team', motoreSpento: 'Creative Engine not switched on', creativita: 'creatives', guardo: 'Looking at the data', risposto: 'answer ready', domanda: 'question', nonRiuscito: 'I could not answer', chiudi: 'Close', collegato: 'connected', nonCollegato: 'not connected', libero: 'free', haiChiesto: 'You asked', online: 'online', offline: 'offline', giroLibero: 'No runs scheduled', domani: 'tomorrow' },
    es: { stradaVeloce: 'Respuesta rápida', miCollego: 'Conectando…', inConversazione: 'Te escucho: habla. Espacio para interrumpirme', hoSentito: 'He oído', notaSpento: 'Micrófono apagado: pulsa para encenderlo', eMic: 'Micrófono no autorizado: permite el micrófono para este sitio y pulsa aquí', eNessunMic: 'No se ha encontrado ningún micrófono', eRete: 'El reconocimiento de voz de este navegador no está disponible: prueba con Chrome o Safari', eLingua: 'Idioma no compatible con el reconocimiento de voz', eBrowser: 'Este navegador no tiene reconocimiento de voz: usa Chrome, Edge o Safari. Puedes escribir igualmente.', eVoce: 'La voz no arranca', browser: 'Navegador', senzaEstensione: 'Extensión del navegador no instalada', senzaEstensioneLungo: 'Para buscar guiando tu navegador hace falta la extensión Lyft. Sin ella puedo buscar en línea y darte las fuentes.', stoNavigando: 'Navegando', fermati: 'Detener', fermato: 'Me he detenido como pediste.', passatoA: 'Pasado a', haFinito: 'ha terminado', nonHaFinito: 'no ha podido terminar', vediSquadra: 'El resultado está en la pestaña Equipo de agentes.', cercoOnline: 'Buscando en línea', passoSquadra: 'Paso el trabajo al equipo', agendaOggi: 'Agenda de hoy', giornataLibera: 'Sin citas hoy', kVendite: 'Ventas', kNuovi: 'Nuevos', kVisite: 'Visitas', kOrdini: 'Pedidos', pDati: 'Datos', pSquadra: 'Equipo', pMotore: 'Motor', centro: 'Centro de mando', motore: 'Motor Creativo', squadra: 'Equipo de agentes', report: 'Informes', integrazioni: 'Integraciones', voce: 'Voz', spento: 'Apagado', ascolto: 'Escuchando…', armato: 'Dime', pensa: 'Pensando…', parla: 'Hablando…', nota: 'Di «Lyft» o «Ey Lyft» y luego la pregunta', sistemi: 'Estado de sistemas', ottimale: 'Óptimo', attenzione: 'Atención', operatore: 'Operador', nucleo: 'Núcleo IA', cervello: 'Cerebro', dati: 'Datos de la tienda', sistema: 'Sistema', attivo: 'activo', fermo: 'parado', feed: 'En directo', timeline: 'Equipo · próximas rondas', piattaforme: 'Plataformas · hoy', comandi: 'Comandos rápidos', c1: 'Resumen de ayer', c2: 'Creatividades a escalar', c3: 'Qué debo decidir', c4: 'Dónde pierdo margen', q1: 'Hazme el resumen de ayer: ventas, gasto, MER y qué ha cambiado respecto al día anterior.', q2: '¿Qué creatividades debo escalar, mantener y apagar, y por qué?', q3: '¿Qué está esperando una decisión mía del equipo?', q4: '¿Dónde estoy perdiendo margen este mes?', agenti: 'Agentes', lavoro: 'Trabajando', decidere: 'Por decidir', verdetti: 'Creatividades · veredictos', collegamenti: 'Conexiones', parlaCon: 'HABLA CON LYFT', premi: 'pulsa o di «Lyft»', scrivi: 'Escribe a Lyft…', invia: 'Enviar', fatturato: 'Facturación', ordini: 'Pedidos', spesaMeta: 'Gasto Meta', mer: 'MER', sessioni: 'Sesiones', nuovi: 'Clientes nuevos', suMeta: 'sobre el gasto de Meta', oggi: 'hoy', nessunaSquadra: 'Ningún equipo activo', motoreSpento: 'Motor Creativo sin encender', creativita: 'creatividades', guardo: 'Estoy mirando los datos', risposto: 'respuesta lista', domanda: 'pregunta', nonRiuscito: 'No he podido responder', chiudi: 'Cerrar', collegato: 'conectado', nonCollegato: 'sin conectar', libero: 'libre', haiChiesto: 'Has preguntado', online: 'en línea', offline: 'sin conexión', giroLibero: 'Sin rondas programadas', domani: 'mañana' },
    fr: { stradaVeloce: 'Réponse rapide', miCollego: 'Connexion…', inConversazione: 'Je vous écoute : parlez. Espace pour m’interrompre', hoSentito: 'J’ai entendu', notaSpento: 'Micro coupé : appuyez pour le rallumer', eMic: 'Micro non autorisé : autorisez le micro pour ce site et appuyez ici', eNessunMic: 'Aucun micro trouvé', eRete: 'La reconnaissance vocale de ce navigateur est injoignable : essayez Chrome ou Safari', eLingua: 'Langue non prise en charge par la reconnaissance vocale', eBrowser: 'Ce navigateur n’a pas de reconnaissance vocale : utilisez Chrome, Edge ou Safari. Vous pouvez toujours écrire.', eVoce: 'La voix ne démarre pas', browser: 'Navigateur', senzaEstensione: 'Extension du navigateur non installée', senzaEstensioneLungo: 'Pour chercher en pilotant votre navigateur, il faut l’extension Lyft. Sans elle, je peux quand même chercher en ligne et vous donner les sources.', stoNavigando: 'Je navigue', fermati: 'Arrêter', fermato: 'Je me suis arrêté comme demandé.', passatoA: 'Transmis à', haFinito: 'a terminé', nonHaFinito: 'n’a pas pu terminer', vediSquadra: 'Le résultat est dans l’onglet Équipe d’agents.', cercoOnline: 'Recherche en ligne', passoSquadra: 'Je passe le travail à l’équipe', agendaOggi: 'Agenda du jour', giornataLibera: 'Aucun rendez-vous aujourd’hui', kVendite: 'Ventes', kNuovi: 'Nouv.', kVisite: 'Visites', kOrdini: 'Cmdes', pDati: 'Données', pSquadra: 'Équipe', pMotore: 'Moteur', centro: 'Centre de commande', motore: 'Moteur Créatif', squadra: 'Équipe d’agents', report: 'Rapports', integrazioni: 'Intégrations', voce: 'Voix', spento: 'Éteint', ascolto: 'À l’écoute…', armato: 'Je vous écoute', pensa: 'Je réfléchis…', parla: 'Je parle…', nota: 'Dites « Lyft » ou « Hé Lyft », puis la question', sistemi: 'État des systèmes', ottimale: 'Optimal', attenzione: 'Attention', operatore: 'Opérateur', nucleo: 'Noyau IA', cervello: 'Cerveau', dati: 'Données de la boutique', sistema: 'Système', attivo: 'actif', fermo: 'arrêté', feed: 'En direct', timeline: 'Équipe · prochains tours', piattaforme: 'Plateformes · aujourd’hui', comandi: 'Commandes rapides', c1: 'Point d’hier', c2: 'Créations à amplifier', c3: 'Ce que je dois décider', c4: 'Où je perds de la marge', q1: 'Fais-moi le point d’hier : ventes, dépenses, MER et ce qui a changé par rapport à la veille.', q2: 'Quelles créations dois-je amplifier, garder et éteindre, et pourquoi ?', q3: 'Qu’est-ce qui attend une décision de ma part dans l’équipe ?', q4: 'Où est-ce que je perds de la marge ce mois-ci ?', agenti: 'Agents', lavoro: 'Au travail', decidere: 'À décider', verdetti: 'Créations · verdicts', collegamenti: 'Connexions', parlaCon: 'PARLER À LYFT', premi: 'appuyez ou dites « Lyft »', scrivi: 'Écrire à Lyft…', invia: 'Envoyer', fatturato: 'Chiffre d’affaires', ordini: 'Commandes', spesaMeta: 'Dépense Meta', mer: 'MER', sessioni: 'Sessions', nuovi: 'Nouveaux clients', suMeta: 'sur la dépense Meta', oggi: 'aujourd’hui', nessunaSquadra: 'Aucune équipe active', motoreSpento: 'Moteur Créatif non allumé', creativita: 'créations', guardo: 'Je regarde les données', risposto: 'réponse prête', domanda: 'question', nonRiuscito: 'Je n’ai pas pu répondre', chiudi: 'Fermer', collegato: 'connecté', nonCollegato: 'non connecté', libero: 'libre', haiChiesto: 'Vous avez demandé', online: 'en ligne', offline: 'hors ligne', giroLibero: 'Aucun tour prévu', domani: 'demain' },
    de: { stradaVeloce: 'Schnelle Antwort', miCollego: 'Verbinde…', inConversazione: 'Ich höre zu: sprich einfach. Leertaste zum Unterbrechen', hoSentito: 'Ich habe gehört', notaSpento: 'Mikrofon aus: drücken, um es wieder einzuschalten', eMic: 'Mikrofon nicht erlaubt: Erlaube das Mikrofon für diese Seite und drücke hier', eNessunMic: 'Kein Mikrofon gefunden', eRete: 'Die Spracherkennung dieses Browsers ist nicht erreichbar: Versuch es mit Chrome oder Safari', eLingua: 'Sprache wird von der Spracherkennung nicht unterstützt', eBrowser: 'Dieser Browser hat keine Spracherkennung: Nutze Chrome, Edge oder Safari. Schreiben geht trotzdem.', eVoce: 'Die Stimme startet nicht', browser: 'Browser', senzaEstensione: 'Browser-Erweiterung nicht installiert', senzaEstensioneLungo: 'Um zu suchen, indem ich deinen Browser steuere, wird die Lyft-Erweiterung gebraucht. Ohne sie kann ich trotzdem online suchen und dir die Quellen geben.', stoNavigando: 'Ich navigiere', fermati: 'Stopp', fermato: 'Ich habe wie gewünscht angehalten.', passatoA: 'Übergeben an', haFinito: 'ist fertig', nonHaFinito: 'konnte nicht fertig werden', vediSquadra: 'Das Ergebnis steht im Tab Agenten-Team.', cercoOnline: 'Ich suche online', passoSquadra: 'Ich gebe die Arbeit ans Team', agendaOggi: 'Heutige Termine', giornataLibera: 'Heute keine Termine', kVendite: 'Umsatz', kNuovi: 'Neu', kVisite: 'Besuche', kOrdini: 'Käufe', pDati: 'Daten', pSquadra: 'Team', pMotore: 'Motor', centro: 'Kommandozentrale', motore: 'Kreativ-Motor', squadra: 'Agenten-Team', report: 'Berichte', integrazioni: 'Integrationen', voce: 'Stimme', spento: 'Aus', ascolto: 'Ich höre zu…', armato: 'Sag es mir', pensa: 'Ich überlege…', parla: 'Ich spreche…', nota: 'Sag „Lyft“ oder „Hey Lyft“, dann die Frage', sistemi: 'Systemstatus', ottimale: 'Optimal', attenzione: 'Achtung', operatore: 'Operator', nucleo: 'KI-Kern', cervello: 'Gehirn', dati: 'Shop-Daten', sistema: 'System', attivo: 'aktiv', fermo: 'gestoppt', feed: 'Live-Feed', timeline: 'Team · nächste Durchläufe', piattaforme: 'Plattformen · heute', comandi: 'Schnellbefehle', c1: 'Rückblick gestern', c2: 'Creatives zum Skalieren', c3: 'Was ich entscheiden muss', c4: 'Wo ich Marge verliere', q1: 'Gib mir den Rückblick auf gestern: Umsatz, Ausgaben, MER und was sich gegenüber dem Vortag geändert hat.', q2: 'Welche Creatives soll ich skalieren, behalten und abschalten – und warum?', q3: 'Was wartet im Team auf meine Entscheidung?', q4: 'Wo verliere ich diesen Monat Marge?', agenti: 'Agenten', lavoro: 'Bei der Arbeit', decidere: 'Zu entscheiden', verdetti: 'Creatives · Urteile', collegamenti: 'Verbindungen', parlaCon: 'MIT LYFT SPRECHEN', premi: 'drücken oder „Lyft“ sagen', scrivi: 'Schreib an Lyft…', invia: 'Senden', fatturato: 'Umsatz', ordini: 'Bestellungen', spesaMeta: 'Meta-Ausgaben', mer: 'MER', sessioni: 'Sitzungen', nuovi: 'Neukunden', suMeta: 'auf Meta-Ausgaben', oggi: 'heute', nessunaSquadra: 'Kein aktives Team', motoreSpento: 'Kreativ-Motor nicht eingeschaltet', creativita: 'Creatives', guardo: 'Ich sehe mir die Daten an', risposto: 'Antwort bereit', domanda: 'Frage', nonRiuscito: 'Ich konnte nicht antworten', chiudi: 'Schließen', collegato: 'verbunden', nonCollegato: 'nicht verbunden', libero: 'frei', haiChiesto: 'Du hast gefragt', online: 'online', offline: 'offline', giroLibero: 'Keine Durchläufe geplant', domani: 'morgen' },
  }[L]

  // ---- la pagina e' sempre a schermo intero: i pezzi vanno nei riquadri del centro di comando
  const scena = $('scena'), card = $('card')
  $('slot-hero').prepend(scena); $('slot-card').prepend(card)
  document.querySelector('.azioni')?.remove()
  const voceOk = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  // Il primo testo «nudo» dentro un elemento (accanto all'icona): li' stanno le etichette della pagina.
  const etichetta = (el, testo) => { if (!el) return; const n = [...el.childNodes].find(x => x.nodeType === 3 && x.textContent.trim()); if (n) n.textContent = ` ${testo} `; else el.append(` ${testo}`) }
  const h2 = cls => document.querySelector(`.p.${cls} h2`)
  etichetta(h2('nucleo'), T.nucleo); etichetta(h2('feed'), T.feed); etichetta(h2('timeline'), T.timeline); etichetta(h2('piattaforme'), T.piattaforme)
  etichetta(h2('comandi'), T.comandi); etichetta(h2('monitor'), T.squadra); etichetta(h2('clienti'), T.verdetti); etichetta(h2('modelli'), T.collegamenti)
  document.querySelector('.marchio small').textContent = T.centro
  document.querySelector('.lato-voce .titoletto').textContent = T.voce
  document.querySelector('.lato-voce .nota').textContent = T.nota
  etichetta(document.querySelector('.stato-sistema'), `${T.sistemi} ·`)
  $('cm-op-etichetta').textContent = T.operatore
  $('scrivi-testo').placeholder = T.scrivi; $('scrivi-invia').textContent = T.invia
  document.querySelector('#cm-parla b').textContent = T.parlaCon
  for (const [id, t] of [['g-cpu', T.agenti], ['g-ram', T.lavoro], ['g-disco', T.decidere]]) $(id).querySelector('small').textContent = t
  const prima = (id, testo) => { let n = $(id)?.previousSibling; while (n && !(n.nodeType === 3 && n.textContent.trim())) n = n.previousSibling; if (n) n.textContent = ` ${testo} ` }
  prima('cm-cloud', T.pDati); prima('cm-tg', T.pSquadra); prima('cm-mem', T.pMotore)

  // La colonna di sinistra porta alle altre sezioni del prodotto (la pagina vive dentro una cornice).
  const vai = percorso => { try { window.top.location.href = percorso } catch { location.href = percorso } }
  const voci = [...document.querySelectorAll('.nav .voce-nav')]
  const mete = [[T.centro, null], ['KPI Brain', '/kpi'], [T.motore, '/motore-creativo'], [T.squadra, '/squadra'], [T.report, '/weekly'], [T.integrazioni, '/integrazioni']]
  voci.forEach((b, i) => { const m = mete[i]; if (!m) return b.remove(); b.querySelector('span').textContent = m[0]; b.removeAttribute('data-comando'); if (m[1]) b.addEventListener('click', () => vai(m[1])) })
  const rapidi = [...document.querySelectorAll('.p.comandi button')]
  const domande = [[T.c1, T.q1], [T.c2, T.q2], [T.c3, T.q3], [T.c4, T.q4]]
  rapidi.forEach((b, i) => { const d = domande[i]; if (!d) return b.remove(); b.querySelector('span').textContent = d[0]; b.removeAttribute('data-comando'); b.addEventListener('click', () => chiedi(d[1], false)) })

  // ---- stato: spento · ascolto · pensa · parla (muove il nucleo e le scritte)
  let livello = 0
  const ETIC = { spento: T.spento, ascolto: T.ascolto, pensa: T.pensa, parla: T.parla }
  function stato(s) { document.body.dataset.stato = s; try { window.Particelle?.impostaStato(s) } catch {} ; $('cm-voce-stato').textContent = ETIC[s]; $('cm-parla-stato').textContent = s === 'spento' ? T.premi : ETIC[s]; const e = $('etichetta'); if (e) e.textContent = ETIC[s] }
  // Il browser non dice quanto e' forte la voce che sta leggendo: mentre parla il nucleo pulsa da solo.

  function orologio() {
    const d = new Date()
    $('cm-ora').textContent = d.toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const g = d.toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    $('cm-data').textContent = g.charAt(0).toUpperCase() + g.slice(1)
    $('cm-rete').textContent = navigator.onLine ? T.online : T.offline; $('cm-rete').className = navigator.onLine ? 'on' : 'off'
  }
  setInterval(orologio, 1000); orologio()

  const li = (cls, html) => { const x = document.createElement('li'); if (cls) x.className = cls; x.innerHTML = html; return x }
  function feed({ icona = '•', colore = '', titolo, sotto = '' }) {
    const f = $('cm-feed'), ora = new Date().toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' })
    const x = li('', `<span class="ico ${colore}">${esc(icona)}</span><span><b>${esc(titolo)}</b><small>${esc(sotto)}</small></span><span class="t">${ora}</span>`)
    f.prepend(x); while (f.children.length > 30) f.lastChild.remove(); return x
  }

  // ---- i dati del cliente
  const num = (n, d = 0) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString(LOC, { maximumFractionDigits: d, minimumFractionDigits: d }))
  const euro = n => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString(LOC, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }))
  // nelle card c'e' posto per sei caratteri a 22px: sopra i diecimila si scrive in migliaia
  const euroCorto = n => (n == null || isNaN(n) ? '—' : Math.abs(n) >= 10000 ? `${(n / 1000).toLocaleString(LOC, { maximumFractionDigits: 1 })}k €` : `${Math.round(n).toLocaleString(LOC)} €`)
  const leggi = p => fetch(p, { cache: 'no-store', credentials: 'same-origin' }).then(r => (r.ok ? r.json() : null)).catch(() => null)
  const loghi = [...card.querySelectorAll('.card .logo')].map(x => x.cloneNode(true))
  function gauge(id, valore, su) { const g = $(id); if (!g) return; const p = su ? Math.min(1, valore / su) : 0; g.querySelector('.v').style.strokeDashoffset = 201 * (1 - p); g.querySelector('b').textContent = valore == null ? '—' : String(valore) }
  const giaVisti = new Set()
  // L'ultima lettura dei dati del cliente: la voce risponde da qui in un attimo, senza richiamare il server.
  const ultimi = { sq: null, mo: null, me: null, cal: null, quando: 0 }

  async function aggiorna() {
    const [sq, mo, st, ch, me, pr, cal] = await Promise.all([leggi('/api/squadra/stato'), leggi('/api/motore/board'), leggi('/api/integrations/status'), leggi('/api/integrations/chiavi'), leggi('/api/metrics?preset=today'), leggi('/api/profile'), leggi('/api/integrations/calendario?oggi=1')])
    if (sq && sq.ok) riferisci(sq)
    Object.assign(ultimi, { sq, mo, me, cal, quando: Date.now() })
    const squadraOk = !!(sq && sq.ok), motoreOk = !!(mo && Array.isArray(mo.righe) && mo.righe.length)
    const datiOk = !!(me && me.shopifyRange)
    // testata e piede
    $('cm-operatore').textContent = pr?.profile?.full_name || String(pr?.profile?.email || '—').split('@')[0]
    $('cm-luogo').textContent = sq?.cliente || mo?.cliente?.nome || '—'
    $('cm-meteo').textContent = T.oggi
    const problemi = [!datiOk && T.dati, st && !(st.connected || []).length && T.collegamenti].filter(Boolean)
    $('cm-stato').textContent = problemi.length ? `${T.attenzione} · ${problemi.join(', ')}` : T.ottimale
    $('cm-stato').classList.toggle('attenzione', problemi.length > 0)
    const segna = (id, ok, testo) => { const e = $(id); if (!e) return; e.textContent = testo; e.className = ok ? 'on' : 'off' }
    segna('cm-cloud', datiOk, datiOk ? 'ok' : '—'); segna('cm-tg', squadraOk, squadraOk ? 'ok' : '—'); segna('cm-mem', motoreOk, motoreOk ? `${mo.righe.length} ${T.creativita}` : '—')
    // nucleo
    const n = $('cm-nucleo'); n.innerHTML = ''
    const voce = document.body.dataset.stato || 'spento'
    const lavorano = squadraOk ? (sq.agenti || []).filter(a => a.stato?.inCorso).length : 0
    for (const [nome, sotto, ok] of [
      [T.cervello, 'Lyft', true],
      [T.voce, ETIC[voce].replace('…', ''), voce !== 'spento'],
      [T.dati, datiOk ? `Shopify${me.metaRange ? ' · Meta' : ''}` : T.nonCollegato, datiOk],
      [T.motore, motoreOk ? `${mo.righe.length} ${T.creativita}` : T.motoreSpento, motoreOk],
      [T.squadra, squadraOk ? `${(sq.agenti || []).length} ${T.agenti.toLowerCase()} · ${lavorano} ${T.lavoro.toLowerCase()}` : T.nessunaSquadra, squadraOk],
      [T.sistema, problemi.length ? T.attenzione.toLowerCase() : T.ottimale.toLowerCase(), !problemi.length],
    ]) n.append(li('', `<span class="tondo">●</span><span><b>${esc(nome)}</b><small>${esc(sotto)}</small></span><span class="pt ${ok ? 'on' : 'off'}">${ok ? T.attivo : T.fermo}</span>`))
    // piattaforme · oggi
    card.innerHTML = ''
    const s = me?.shopifyRange, m = me?.metaRange
    const carte = [
      [2, T.kVendite, s ? euroCorto(s.revenue) : '—', s ? `${num(s.orders)} ${T.ordini.toLowerCase()}` : ''],
      [0, 'Meta', m ? euroCorto(m.spend) : '—', m ? `${num(m.purchases)} · ${euro(m.purchaseValue)}` : ''],
      [3, T.mer, s && m && m.spend ? num(s.revenue / m.spend, 2) : '—', T.suMeta],
      [2, T.kNuovi, s ? num(s.nc) : '—', s && s.orders ? `${Math.round((s.nc / s.orders) * 100)}%` : ''],
      [2, T.kVisite, s ? num(s.sessions) : '—', s && s.sessions ? `${num((s.orders / s.sessions) * 100, 2)}% CR` : ''],
      [2, T.kOrdini, s ? num(s.orders) : '—', s && s.orders ? `AOV ${euro(s.revenue / s.orders)}` : ''],
    ]
    for (const [logo, cosa, numero, sotto] of carte) {
      const a = document.createElement('article'); a.className = 'card'
      a.innerHTML = `<p class="cosa"></p><p class="numero">${esc(numero)}</p><p class="sotto">${esc(sotto)}</p>`
      const c = a.querySelector('.cosa'); if (loghi[logo]) c.append(loghi[logo].cloneNode(true)); c.append(` ${cosa}`); card.append(a)
    }
    // squadra: anelli e prossimi giri
    const daDecidere = squadraOk ? (sq.lavori || []).filter(l => ['in_revisione', 'errore_pubblicazione', 'programmato'].includes(l.stato)) : []
    const quanti = squadraOk ? (sq.agenti || []).length : null
    gauge('g-cpu', quanti, quanti || 1); gauge('g-ram', squadraOk ? lavorano : null, quanti || 1); gauge('g-disco', squadraOk ? daDecidere.length : null, Math.max(daDecidere.length, 10))
    const tl = $('cm-agenda'); tl.innerHTML = ''
    const agenda = cal?.collegato ? (cal.eventi || []) : null
    etichetta(h2('timeline'), agenda ? T.agendaOggi : T.timeline)
    if (agenda) {
      if (!agenda.length) tl.append(li('vuoto', T.giornataLibera))
      for (const e of agenda.slice(0, 8)) tl.append(li(e.passato ? 'passato' : '', `<span class="h">${esc(e.inizio || '—')}</span><span class="pallino"></span><span><b>${esc(e.titolo)}</b><small>${e.call ? 'call · ' : ''}${esc((e.con || []).slice(0, 3).join(', ') || (e.fine ? `→ ${e.fine}` : ''))}</small></span>`))
    } else {
    const giri = squadraOk ? (sq.agenti || []).filter(a => a.prossimo?.ora).sort((a, b) => a.prossimo.m - b.prossimo.m).slice(0, 7) : []
    if (!agenda && !giri.length) tl.append(li('vuoto', squadraOk ? T.giroLibero : T.nessunaSquadra))
    for (const a of giri) tl.append(li('', `<span class="h">${esc(a.prossimo.ora)}</span><span class="pallino"></span><span><b>${esc(a.nome)}</b><small>${a.prossimo.m >= 1440 ? `${T.domani} · ` : ''}${esc(String(a.prossimo.compito || a.ruolo).slice(0, 70))}</small></span>`))
    }
    // creatività: verdetti
    const cl = $('cm-clienti'); cl.innerHTML = ''
    if (!motoreOk) cl.append(li('vuoto', T.motoreSpento))
    else {
      const conta = {}; for (const r of mo.righe) { const k = r.bandaLabel || r.banda || '—'; (conta[k] ||= { n: 0, spesa: 0 }).n++; conta[k].spesa += r.spend || 0 }
      for (const [k, v] of Object.entries(conta).sort((a, b) => b[1].spesa - a[1].spesa).slice(0, 7)) cl.append(li('', `<b>${esc(k)}</b><span class="n">${v.n}</span><small>${euro(v.spesa)}</small>`))
    }
    // collegamenti
    const md = $('cm-modelli'); md.innerHTML = ''
    const con = new Set(st?.connected || []), chiavi = ch?.servizi || {}
    for (const [nome, ruolo, ok] of [['Shopify', 'Commerce', con.has('shopify') || !!st?.shopifyStore], ['Meta', 'Ads', con.has('facebook')], ['Google', 'Analytics · Ads', !!st?.googleConnected], ['Klaviyo', 'Email', con.has('klaviyo-oauth')], ['ChatGPT', 'API', !!chiavi.openai], ['Claude', 'API', !!chiavi.anthropic], ['Higgsfield', 'API', !!chiavi.higgsfield], ['Gmail', 'IMAP', !!chiavi.posta], ['Calendar', 'Google', !!cal?.collegato], [T.browser, estensione ? `v${estensione}` : '', !!estensione]]) {
      const d = document.createElement('div'); d.className = 'mod'; d.innerHTML = `<i class="${ok ? 'on' : 'off'}"></i><span><b>${esc(nome)}</b><small>${esc(ok ? ruolo : T.nonCollegato)}</small></span>`; md.append(d)
    }
    // nel feed: cio' che aspetta una decisione (una volta sola per lavoro)
    for (const l of daDecidere.slice(0, 6).reverse()) { if (giaVisti.has(l.id)) continue; giaVisti.add(l.id); feed({ icona: '!', colore: 'giallo', titolo: l.titolo, sotto: `${l.autore_nome || l.autore} · ${T.decidere.toLowerCase()}` }) }
  }
  aggiorna(); let ultimoGiro = Date.now()
  // Il prodotto dice se Lyft e' la tab in vista. Da nascosto i pannelli si aggiornano ogni 5 minuti invece
  // che ogni minuto (nessuno li guarda); tornando in vista si aggiornano subito se il dato ha piu' di un minuto.
  let inVista = true
  window.addEventListener('message', e => { if (e.origin !== location.origin || !e.data || e.data.tipo !== 'lyft:vista') return; const prima = inVista; inVista = !!e.data.attiva; if (inVista && !prima && Date.now() - ultimoGiro > 60000) { ultimoGiro = Date.now(); aggiorna() } })
  setInterval(() => { const ogni = leggiSeguiti().length ? 20000 : inVista ? 60000 : 300000; if (Date.now() - ultimoGiro >= ogni) { ultimoGiro = Date.now(); aggiorna() } }, 5000)

  // ---- l'estensione del browser: e' lei che apre e legge le schede, sotto gli occhi della persona
  let estensione = null
  const inAttesa = new Map()
  window.addEventListener('message', e => {
    if (e.source !== window || e.origin !== location.origin || !e.data || e.data.da !== 'lyft-estensione') return
    if (e.data.tipo === 'pronta') { estensione = e.data.versione || '?'; return }
    const p = inAttesa.get(e.data.id); if (p) { inAttesa.delete(e.data.id); p(e.data.esito || { errore: 'nessuna risposta' }) }
  })
  window.postMessage({ a: 'lyft-estensione', comando: 'ci-sei' }, location.origin)
  const comanda = (comando, dati) => new Promise(ok => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    inAttesa.set(id, ok); window.postMessage({ a: 'lyft-estensione', id, comando, dati }, location.origin)
    setTimeout(() => { if (inAttesa.delete(id)) ok({ errore: 'il browser non ha risposto in tempo' }) }, 30000)
  })

  // Una ricerca guidata: il server decide un passo, l'estensione lo esegue nel browser, cio' che si vede
  // torna al server, e cosi' via finche' c'e' una risposta. Ogni passo compare nel feed mentre accade.
  let navigando = false, ferma = false
  async function naviga(obiettivo, aVoce) {
    if (navigando) return
    if (!estensione) { feed({ icona: '!', colore: 'giallo', titolo: T.senzaEstensione, sotto: '' }); mostra(obiettivo, T.senzaEstensioneLungo); stato(ascolto ? 'ascolto' : 'spento'); return }
    navigando = true; ferma = false; stato('pensa')
    const passi = []; let tab = null, risposta = ''
    const bottone = () => { const r = $('risposta'); r.classList.add('aperta'); r.innerHTML = `<button class="chiudi-r" type="button">${esc(T.fermati)}</button><span class="tu">${esc(T.stoNavigando)} · ${esc(obiettivo.slice(0, 120))}</span>${passi.map(p => '› ' + esc(p.azione.perche || p.azione.azione)).join('\n')}`; r.querySelector('.chiudi-r').onclick = () => { ferma = true } }
    try {
      for (let i = 0; i < 14 && !ferma; i++) {
        const r = await fetch('/api/lyft/naviga', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ obiettivo, passi, lingua: L }) })
        const a = await r.json().catch(() => ({}))
        if (!r.ok || !a.azione) { risposta = a.error ? `⚠️ ${a.error}` : T.nonRiuscito; break }
        if (a.azione === 'fine') { risposta = a.risposta || T.nonRiuscito; break }
        const riga = feed({ icona: '›', titolo: a.perche || a.azione, sotto: a.azione === 'apri' ? String(a.url).replace(/^https?:\/\/(www\.)?/, '').slice(0, 60) : a.azione })
        let o
        if (a.azione === 'apri') { o = tab == null ? await comanda('apri', { url: a.url }) : await comanda('vai', { tab, url: a.url }); if (o && o.tab != null) tab = o.tab }
        else if (tab == null) o = { errore: 'nessuna pagina aperta: prima apri un indirizzo' }
        else if (a.azione === 'leggi') o = await comanda('leggi', { tab })
        else if (a.azione === 'clicca') o = await comanda('clicca', { tab, n: a.n })
        else if (a.azione === 'scrivi') o = await comanda('scrivi', { tab, n: a.n, testo: a.testo, invio: a.invio })
        else if (a.azione === 'scorri') o = await comanda('scorri', { tab })
        const ok = o && !o.errore
        riga.querySelector('.ico').className = `ico ${ok ? 'verde' : 'rosso'}`; riga.querySelector('.ico').textContent = ok ? '✓' : '×'
        passi.push({ azione: { azione: a.azione, url: a.url, n: a.n, testo: a.testo, invio: a.invio, perche: a.perche }, osservazione: o || { errore: 'nessun esito' } })
        bottone()
      }
    } catch { risposta = T.nonRiuscito }
    if (ferma && !risposta) risposta = T.fermato
    navigando = false
    if (!risposta) risposta = T.nonRiuscito
    storia.push({ role: 'assistant', content: risposta }); feed({ icona: '✓', colore: 'verde', titolo: perVoce(risposta).slice(0, 90), sotto: T.risposto })
    mostra(obiettivo, risposta)
    if (aVoce && !risposta.startsWith('⚠️')) { if (!avvisaAVoce(`La ricerca nel browser è conclusa. Risultato: ${risposta}`)) leggiVoce(risposta) } else stato(ascolto ? 'ascolto' : 'spento')
  }

  // ---- la domanda al cervello
  let occupato = false, storia = []
  // Gli incarichi che Lyft ha passato alla squadra e di cui deve ancora riferire l'esito.
  // Stanno nel browser: se la pagina si chiude, alla riapertura riprende da dove era.
  const leggiSeguiti = () => { try { return JSON.parse(localStorage.getItem('lyft-incarichi') || '[]') } catch { return [] } }
  const scriviSeguiti = l => { try { localStorage.setItem('lyft-incarichi', JSON.stringify(l.slice(-30))) } catch {} }
  async function segui(daQuando) {
    const sq = await leggi('/api/squadra/stato'); if (!sq?.ok) return
    const gia = new Set(leggiSeguiti().map(x => x.id))
    const nuovi = (sq.incarichi || []).filter(i => i.origine === 'marino' && !gia.has(i.id) && new Date(i.creato).getTime() >= daQuando - 5000)
    if (nuovi.length) scriviSeguiti([...leggiSeguiti(), ...nuovi.map(i => ({ id: i.id, agente: i.agente, compito: String(i.compito || '').replace(/^Marino ti scrive:\s*/, '').slice(0, 160) }))])
    for (const i of nuovi) { const a = (sq.agenti || []).find(x => x.id === i.agente); feed({ icona: '→', titolo: `${T.passatoA} ${a?.nome || i.agente}`, sotto: String(i.compito || '').replace(/^Marino ti scrive:\s*/, '').slice(0, 90) }) }
  }
  function riferisci(sq) {
    const seguiti = leggiSeguiti(); if (!seguiti.length) return
    const restano = []
    for (const s of seguiti) {
      const i = (sq.incarichi || []).find(x => x.id === s.id)
      if (!i) { restano.push(s); continue }                       // non ancora visibile: si riprova al prossimo giro
      if (i.stato !== 'fatto' && i.stato !== 'fallito') { restano.push(s); continue }
      const a = (sq.agenti || []).find(x => x.id === i.agente), nome = a?.nome || i.agente
      if (i.stato === 'fatto') {
        const esito = String(i.esito || '').trim()
        feed({ icona: '✓', colore: 'verde', titolo: `${nome} ${T.haFinito}`, sotto: s.compito })
        mostra(`${nome} · ${s.compito}`, `${nome} ${T.haFinito}.\n\n${esito || T.vediSquadra}`)
        if (!avvisaAVoce(`${nome} ha finito il lavoro «${s.compito}». Esito: ${esito.slice(0, 900) || 'il risultato è nella tab Squadra agent'}`) && ascolto) leggiVoce(`${nome} ${T.haFinito}. ${esito.slice(0, 400)}`)
      } else {
        feed({ icona: '×', colore: 'rosso', titolo: `${nome} ${T.nonHaFinito}`, sotto: String(i.errore || '').slice(0, 120) })
        mostra(`${nome} · ${s.compito}`, `${nome} ${T.nonHaFinito}: ${String(i.errore || '').slice(0, 400)}`)
        if (!avvisaAVoce(`${nome} NON è riuscito a finire il lavoro «${s.compito}»: ${String(i.errore || '').slice(0, 300)}`) && ascolto) leggiVoce(`${nome} ${T.nonHaFinito}.`)
      }
    }
    scriviSeguiti(restano)
  }
  const perVoce = t => String(t || '').replace(/```[\s\S]*?```/g, ' ').replace(/[*_#>`|]/g, ' ').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 900)
  const pulito = t => String(t || '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/^#+\s*/gm, '').replace(/`/g, '')
  function mostra(domanda, testo) {
    const r = $('risposta'); r.classList.add('aperta')
    const conLink = esc(pulito(testo)).replace(/https?:\/\/[^\s<)\]]+/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer" style="color:var(--accento)">${u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}</a>`)
    r.innerHTML = `<button class="chiudi-r" type="button">${esc(T.chiudi)}</button><span class="tu">${esc(T.haiChiesto)} · ${esc(domanda.slice(0, 120))}</span>${conLink}`
    r.querySelector('.chiudi-r').onclick = () => { r.classList.remove('aperta'); try { speechSynthesis.cancel() } catch {} ; if (document.body.dataset.stato === 'parla') stato(ascolto ? 'ascolto' : 'spento') }
  }
  let parlando = false
  function leggiVoce(testo) {
    try {
      if (!window.speechSynthesis) return stato(ascolto ? 'ascolto' : 'spento')
      const u = new SpeechSynthesisUtterance(perVoce(testo)); u.lang = LOC; u.rate = 1.05
      // Mentre legge non ascolta, o sentirebbe se stesso pronunciare il proprio nome.
      parlando = true; stato('parla'); u.onend = u.onerror = () => { parlando = false; stato(ascolto ? 'ascolto' : 'spento') }
      speechSynthesis.cancel(); speechSynthesis.speak(u)
    } catch { parlando = false; stato(ascolto ? 'ascolto' : 'spento') }
  }
  async function chiedi(testo, aVoce) {
    const domanda = String(testo || '').trim(); if (!domanda || occupato) return
    occupato = true; $('scrivi-testo').value = ''; stato('pensa')
    feed({ icona: '?', titolo: domanda, sotto: T.domanda })
    storia.push({ role: 'user', content: domanda }); storia = storia.slice(-16)
    let acc = '', passo = null, haPassato = false; const partenza = Date.now()
    try {
      const r = await fetch('/api/agent', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: storia, agentContext: { _currentTab: 'Lyft', _estensione: !!estensione }, preset: 'last_30d', locale: L, stream: true, assistente: 'lyft' }) })
      if (r.ok && (r.headers.get('content-type') || '').includes('text/event-stream') && r.body) {
        const lettore = r.body.getReader(), dec = new TextDecoder(); let buf = ''
        for (;;) {
          const { done, value } = await lettore.read(); if (done) break
          buf += dec.decode(value, { stream: true }); const ev = buf.split('\n\n'); buf = ev.pop() || ''
          for (const e of ev) {
            if (!e.startsWith('data: ')) continue
            let j; try { j = JSON.parse(e.slice(6)) } catch { continue }
            if (j.d) { acc += j.d; mostra(domanda, acc.replace(/\[\[NAVIGA:[^\]]*\]?\]?/, '').trim()) }
            if (Array.isArray(j.tools) && j.tools.length) { if (j.tools.includes('give_agent_task')) haPassato = true; passo = feed({ icona: '›', titolo: j.tools.includes('search_web') ? T.cercoOnline : j.tools.includes('give_agent_task') ? T.passoSquadra : T.guardo, sotto: j.tools.join(' · ') }) }
            if (Array.isArray(j.tools) && !j.tools.length && passo) { passo.querySelector('.ico').className = 'ico verde'; passo.querySelector('.ico').textContent = '✓'; passo = null }
            if (j.error) acc = `⚠️ ${j.error}`
          }
        }
      } else { const j = await r.json().catch(() => ({})); acc = j.reply || j.content || (j.error ? `⚠️ ${j.error}` : '') }
    } catch {}
    occupato = false
    if (haPassato) segui(partenza)
    // «[[NAVIGA: …]]» nella risposta = Lyft vuole cercare guidando il browser: il segno non si mostra, si esegue.
    const segno = /\[\[NAVIGA:\s*([^\]]{4,800})\]\]/.exec(acc)
    if (segno) acc = acc.replace(segno[0], '').trim()
    if (!acc) { acc = `${T.nonRiuscito}.`; feed({ icona: '×', colore: 'rosso', titolo: T.nonRiuscito, sotto: '' }) }
    else { storia.push({ role: 'assistant', content: acc }); feed({ icona: '✓', colore: 'verde', titolo: perVoce(acc).slice(0, 90), sotto: T.risposto }) }
    mostra(domanda, acc)
    if (segno) return naviga(segno[1].trim(), aVoce)
    if (aVoce && !acc.startsWith('⚠️')) leggiVoce(acc); else stato(ascolto ? 'ascolto' : 'spento')
  }
  $('scrivi').addEventListener('submit', e => { e.preventDefault(); chiedi($('scrivi-testo').value, false) })

  // ---- la voce: ascolto continuo, si reagisce solo al nome
  //
  // Il riconoscimento del browser scrive «Lyft» in molti modi (lift, left, list, life, leaf…), e in
  // italiano ancora di piu'. Si accetta ogni parola corta che inizia per L e dista al massimo una
  // lettera da «lift» o «lyft», da sola o dopo «ehi/ehy/hey/ok/ciao». Cio' che non e' preceduto dal
  // nome viene ignorato: in una stanza si parla anche d'altro.
  const vicino = (a, b) => { if (Math.abs(a.length - b.length) > 1) return false; let x = 0, y = 0, err = 0; while (x < a.length && y < b.length) { if (a[x] === b[y]) { x++; y++; continue } if (++err > 1) return false; if (a.length > b.length) x++; else if (a.length < b.length) y++; else { x++; y++ } } return err + (a.length - x) + (b.length - y) <= 1 }
  const SUONA = ['lift', 'lyft', 'left', 'list', 'life', 'leaf', 'live', 'lit', 'lif', 'liff', 'loft', 'lift', 'lifte', 'lifts', 'lifta', 'lifti', 'lifto', 'leaft', 'lifft', 'laift', 'lyfte', 'lyfts', 'leift', 'lieft', 'lifth', 'lefth', 'lifd']
  const eIlNome = p => {
    let w = p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '')
    w = w.replace(/^(ehi|ehy|hey|hei|eih|ei|ai|air|he|eh|e|a|i)(?=l[iyea])/, '')          // «elift», «heylift», «airlift»
    return w.length >= 3 && w.length <= 6 && w[0] === 'l' && (SUONA.includes(w) || vicino(w, 'lift') || vicino(w, 'lyft'))
  }
  // Restituisce cio' che segue il nome ('' se c'e' solo il nome), oppure null se il nome non c'e'.
  // Il nome deve stare fra le prime quattro parole: «Hey Lyft …», «Senti Lyft …», «Ok allora Lyft …».
  function dopoIlNome(frase) {
    const parole = frase.trim().split(/\s+/)
    for (let n = 0; n < Math.min(parole.length, 4); n++) if (eIlNome(parole[n])) return parole.slice(n + 1).join(' ').replace(/^[\s,.:;!?]+/, '').trim()
    return null
  }
  // In sviluppo si scrive nel registro del server cosa fa il microfono: e' l'unico modo di capire, da fuori,
  // perche' su un certo computer il nome non viene riconosciuto. In produzione la rotta non esiste.
  const LOCALE = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  const diario = (evento, dettaglio = '') => { if (!LOCALE) return; try { fetch('/api/lyft/diario', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evento, dettaglio }), keepalive: true }).catch(() => {}) } catch {} }
  // ------------------------------------------------------------------------------------------
  //  DUE ORECCHIE, come nell'assistente da cui Lyft nasce:
  //   · l'ASCOLTO DEL NOME (riconoscimento del browser): aspetta «Lyft» / «Hey Lyft» e basta.
  //     Finche' nessuno lo chiama non parte nessuna conversazione, e il silenzio non si paga;
  //   · la CONVERSAZIONE (voce in tempo reale): si apre quando sente il nome, ascolta e parla
  //     in modo naturale, si lascia interrompere, e si richiude da sola dopo un po' di silenzio.
  //  La voce non sa niente da sola: ogni domanda vera la passa al cervello e legge la risposta.
  // ------------------------------------------------------------------------------------------
  let ascolto = false, ric = null, ultimaFinale = ''
  let pc = null, canale = null, microfono = null, collegando = false, parlaLyft = false, volMic = () => 0, volVoce = () => 0, silenzio = null, primaFrase = '', nomePersona = ''
  const SILENZIO_MAX = 75000
  const nota = document.querySelector('.lato-voce .nota')
  const diNota = (testo, errore) => { if (!nota) return; nota.textContent = testo; nota.style.color = errore ? 'var(--errore)' : '' }
  const ERRORI = { 'not-allowed': T.eMic, 'service-not-allowed': T.eMic, 'audio-capture': T.eNessunMic, network: T.eRete, 'language-not-supported': T.eLingua }
  const inConversazione = () => !!pc && pc.connectionState !== 'closed'
  try { window.Particelle?.impostaVolume(() => Math.max(volMic(), volVoce(), livello)) } catch {}

  function misuraVolume(stream) {
    try {
      const ctx = new AudioContext(), analisi = ctx.createAnalyser(); analisi.fftSize = 256
      ctx.createMediaStreamSource(stream).connect(analisi)
      const buf = new Uint8Array(analisi.frequencyBinCount)
      return () => { analisi.getByteTimeDomainData(buf); let somma = 0; for (const v of buf) somma += ((v - 128) / 128) ** 2; return Math.sqrt(somma / buf.length) }
    } catch { return () => 0 }
  }
  const invia = evento => { if (canale?.readyState === 'open') canale.send(JSON.stringify(evento)) }
  // Mentre Lyft parla il microfono e' in pausa: altrimenti sente la propria voce dalle casse, la scambia
  // per la persona e si interrompe da solo a meta' parola. Per interromperlo: barra spaziatrice o «Fermati».
  const aggiornaMic = () => microfono?.getAudioTracks().forEach(t => { t.enabled = !parlaLyft })
  const zittisci = () => { invia({ type: 'response.cancel' }); invia({ type: 'output_audio_buffer.clear' }) }
  const riarma = () => { clearTimeout(silenzio); silenzio = setTimeout(() => { if (inConversazione() && !navigando && !occupato) chiudiConversazione() }, SILENZIO_MAX) }
  // Una notizia da far dire alla voce (un agente ha finito, una navigazione e' conclusa).
  const avvisaAVoce = testo => { if (!inConversazione() || canale?.readyState !== 'open') return false; invia({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: `[AVVISO] ${String(testo).slice(0, 1500)}` }] } }); invia({ type: 'response.create' }); riarma(); return true }

  // La domanda passata al cervello dalla voce: stessa rotta della domanda scritta, risposta intera.
  async function cervello(domanda) {
    feed({ icona: '?', titolo: domanda, sotto: T.domanda })
    storia.push({ role: 'user', content: domanda }); storia = storia.slice(-16)
    const partenza = Date.now(); let testo = ''
    try {
      const r = await fetch('/api/agent', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: storia, agentContext: { _currentTab: 'Lyft', _estensione: !!estensione }, preset: 'last_30d', locale: L, stream: false, assistente: 'lyft' }) })
      const j = await r.json().catch(() => ({})); testo = j.reply || j.content || (j.error ? `Non posso rispondere: ${j.error}` : '')
    } catch {}
    if (!testo) testo = T.nonRiuscito
    segui(partenza)                                                  // se ha passato un lavoro agli agenti, lo segue fino all'esito
    const segno = /\[\[NAVIGA:\s*([^\]]{4,800})\]\]/.exec(testo)
    if (segno) testo = testo.replace(segno[0], '').trim()
    storia.push({ role: 'assistant', content: testo }); feed({ icona: '✓', colore: 'verde', titolo: perVoce(testo).slice(0, 90), sotto: T.risposto })
    mostra(domanda, testo)
    if (segno) setTimeout(() => naviga(segno[1].trim(), true), 600)
    return testo
  }
  // ---- la strada veloce: numeri e stati che la pagina ha gia' (o che arrivano in un secondo)
  const tondo = n => (n == null || isNaN(n) ? null : Math.round(Number(n)))
  function numeriDa(m, etichetta) {
    const sh = m?.shopifyRange, mt = m?.metaRange
    if (!sh) return { errore: 'i numeri del negozio non sono disponibili adesso' }
    return { periodo: etichetta, fatturato_euro: tondo(sh.revenue), ordini: sh.orders, carrello_medio_euro: sh.orders ? tondo(sh.revenue / sh.orders) : null, clienti_nuovi: sh.nc, clienti_abituali: sh.rc, visite: sh.sessions, conversione_percento: sh.sessions ? +(sh.orders / sh.sessions * 100).toFixed(2) : null,
      spesa_meta_euro: mt ? tondo(mt.spend) : null, acquisti_attribuiti_da_meta: mt ? mt.purchases : null, mer_sulla_sola_spesa_meta: mt && mt.spend ? +(sh.revenue / mt.spend).toFixed(2) : null, nota: 'MER calcolato sulla sola spesa Meta' }
  }
  async function veloce(nome, a) {
    if (nome === 'numeri_veloci') {
      if (a.periodo === 'oggi' && ultimi.me && Date.now() - ultimi.quando < 180000) return numeriDa(ultimi.me, 'oggi finora')
      const preset = { oggi: 'today', ieri: 'yesterday', ultimi_7_giorni: 'last_7d' }[a.periodo] || 'today'
      return numeriDa(await leggi(`/api/metrics?preset=${preset}`), { today: 'oggi finora', yesterday: 'ieri', last_7d: 'ultimi 7 giorni' }[preset])
    }
    if (nome === 'squadra_veloce') {
      const sq = ultimi.sq && Date.now() - ultimi.quando < 120000 ? ultimi.sq : await leggi('/api/squadra/stato')
      if (!sq?.ok) return { squadra: 'nessuna squadra attiva per questa azienda' }
      const dec = (sq.lavori || []).filter(l => ['in_revisione', 'errore_pubblicazione', 'programmato'].includes(l.stato))
      return { agenti: (sq.agenti || []).length, al_lavoro_adesso: (sq.agenti || []).filter(x => x.stato?.inCorso).map(x => `${x.nome}: ${String(x.stato.inCorso).slice(0, 80)}`), giri_oggi: sq.giri_oggi, da_decidere: dec.slice(0, 8).map(l => `${l.titolo} (di ${l.autore_nome || l.autore})`), prossimi_giri: (sq.agenti || []).filter(x => x.prossimo?.ora).sort((x, y) => x.prossimo.m - y.prossimo.m).slice(0, 3).map(x => `${x.nome} alle ${x.prossimo.ora}`) }
    }
    if (nome === 'creativita_veloci') {
      const mo = ultimi.mo && Date.now() - ultimi.quando < 600000 ? ultimi.mo : await leggi('/api/motore/board')
      if (!mo || !Array.isArray(mo.righe) || !mo.righe.length) return { motore: 'il Motore Creativo non è acceso o non ha dati' }
      const conta = {}; for (const x of mo.righe) { const k = x.bandaLabel || x.banda || '—'; conta[k] = (conta[k] || 0) + 1 }
      return { creativita: mo.righe.length, per_verdetto: conta, spesa_euro: tondo(mo.account?.spesa), roas_meta: mo.account?.roas ? +mo.account.roas.toFixed(2) : null, con_piu_spesa: [...mo.righe].sort((x, y) => (y.spend || 0) - (x.spend || 0)).slice(0, 4).map(x => `${x.name}: ${x.bandaLabel || x.banda}, ${tondo(x.spend)} euro, ROAS ${(x.roas || 0).toFixed(1)}`) }
    }
    if (nome === 'agenda_veloce') {
      const c = await leggi('/api/integrations/calendario?oggi=1')
      if (!c?.collegato) return { agenda: 'il Google Calendar non è collegato: si collega dalla tab Integrazioni' }
      return { oggi: (c.eventi || []).map(e => `${e.inizio || 'tutto il giorno'} ${e.titolo}${(e.con || []).length ? ' con ' + e.con.slice(0, 3).join(', ') : ''}${e.call ? ' (call)' : ''}`), nessuno: !(c.eventi || []).length }
    }
    return null
  }
  async function eseguiStrumento(chiamata) {
    stato('pensa'); clearTimeout(silenzio)
    let uscita = ''; const t0 = Date.now()
    try {
      const a = JSON.parse(chiamata.arguments || '{}')
      if (chiamata.name === 'chiedi_al_cervello') uscita = await cervello(String(a.domanda || '').trim())
      else { const v = await veloce(chiamata.name, a); uscita = v ? JSON.stringify(v) : 'strumento sconosciuto'; if (v) feed({ icona: '✓', colore: 'verde', titolo: T.stradaVeloce, sotto: chiamata.name }) }
    } catch (e) { uscita = T.nonRiuscito }
    diario('strumento', `${chiamata.name} ${Date.now() - t0} ms · ${String(chiamata.arguments || '').slice(0, 120)}`)
    invia({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: chiamata.call_id, output: String(uscita) } })
    invia({ type: 'response.create' }); riarma()
  }
  function gestisciEvento(e) {
    switch (e.type) {
      case 'output_audio_buffer.started': parlaLyft = true; aggiornaMic(); stato('parla'); clearTimeout(silenzio); break
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
        // Mezzo secondo di coda: l'eco della stanza finisce dopo l'ultima parola.
        setTimeout(() => { parlaLyft = false; aggiornaMic(); if (inConversazione()) stato('ascolto') }, 500); riarma(); break
      case 'input_audio_buffer.speech_started': diNota('…'); riarma(); break
      case 'conversation.item.input_audio_transcription.completed': { const t = String(e.transcript || '').trim(); if (t) { diNota(`${T.hoSentito}: «${t.slice(0, 90)}»`); diario('trascritto', t) } break }
      case 'response.output_audio_transcript.done': diario('detto', String(e.transcript || '').slice(0, 160)); break
      case 'response.done': for (const item of e.response?.output || []) if (item.type === 'function_call') eseguiStrumento(item); riarma(); break
      case 'error': diNota(String(e.error?.message || T.eVoce).slice(0, 140), true); break
    }
  }
  async function apriConversazione(frase = '') {
    if (collegando || inConversazione()) return
    collegando = true; primaFrase = frase; fermaAscoltoNome(); stato('pensa'); diNota(T.miCollego); diario('apro-conversazione', frase)
    try {
      const r = await fetch('/api/lyft/voce', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lingua: L, nome: nomePersona, azienda: ultimi.sq?.cliente || ultimi.mo?.cliente?.nome || '', agenti: (ultimi.sq?.agenti || []).map(x => x.nome) }) })
      const s = await r.json().catch(() => ({})); if (!r.ok || !s.chiave) throw new Error(s.errore || T.eVoce)
      pc = new RTCPeerConnection()
      pc.ontrack = ev => { $('voce').srcObject = ev.streams[0]; volVoce = misuraVolume(ev.streams[0]) }
      pc.onconnectionstatechange = () => { if (pc && ['failed', 'closed', 'disconnected'].includes(pc.connectionState)) chiudiConversazione() }
      microfono = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      microfono.getAudioTracks().forEach(t => pc.addTrack(t, microfono)); volMic = misuraVolume(microfono)
      canale = pc.createDataChannel('oai-events')
      canale.onopen = () => {
        stato('ascolto'); diNota(T.inConversazione); riarma()
        // «Hey Lyft, quanto ho fatturato?» in una frase sola: la domanda parte subito. Solo il nome: risponde che c'e'.
        if (primaFrase.length > 2) { invia({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: primaFrase }] } }); invia({ type: 'response.create' }) }
        else invia({ type: 'response.create', response: { instructions: `Di' solo «Dimmi${nomePersona ? ', ' + nomePersona : ''}.» o una variante brevissima nella lingua della conversazione, niente altro.` } })
      }
      canale.onmessage = m => { try { gestisciEvento(JSON.parse(m.data)) } catch {} }
      const offerta = await pc.createOffer(); await pc.setLocalDescription(offerta)
      const a = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(s.modello)}`, { method: 'POST', body: offerta.sdp, headers: { Authorization: `Bearer ${s.chiave}`, 'Content-Type': 'application/sdp' } })
      if (!a.ok) throw new Error(`${T.eVoce} (${a.status})`)
      await pc.setRemoteDescription({ type: 'answer', sdp: await a.text() })
      $('cm-mic').setAttribute('aria-pressed', 'true')
    } catch (err) {
      const nome = err && err.name
      diario('conversazione-fallita', `${nome || ''} ${String(err && err.message || '').slice(0, 120)}`)
      diNota(nome === 'NotAllowedError' ? T.eMic : nome === 'NotFoundError' ? T.eNessunMic : String(err && err.message || T.eVoce).slice(0, 160), true)
      chiudiConversazione(true)
    } finally { collegando = false }
  }
  function chiudiConversazione(conErrore = false) {
    clearTimeout(silenzio)
    try { canale?.close() } catch {} ; try { pc?.close() } catch {}
    microfono?.getTracks().forEach(t => t.stop())
    pc = canale = microfono = null; volMic = volVoce = () => 0; parlaLyft = false
    $('cm-mic').setAttribute('aria-pressed', ascolto ? 'true' : 'false')
    // Chiusa la conversazione si torna ad aspettare il nome (se la persona non ha spento la voce).
    if (ascolto && !conErrore) avviaAscoltoNome(); else if (ascolto && conErrore) { stato('spento'); setTimeout(() => { if (ascolto && !inConversazione()) avviaAscoltoNome(true) }, 4000) } else stato('spento')
  }

  // ---- l'orecchio di riserva: il nome riconosciuto anche dove il browser non trascrive
  //
  // Su molti computer il riconoscimento del browser parte ma non restituisce mai una parola (dipende
  // da un servizio che non sempre risponde). Qui la pagina misura il volume del microfono: quando
  // qualcuno parla registra quella frase (al massimo 8 secondi) e, SOLO se il browser non ne ha
  // restituito il testo, la manda a trascrivere per cercarci il nome. Dove il browser funziona non
  // parte nessun invio; e mentre la conversazione e' aperta questo orecchio e' spento.
  let orecchio = null, ultimoTestoBrowser = 0
  async function avviaOrecchio() {
    if (orecchio || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return
    let stream
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }) }
    catch (e) { diario('orecchio-negato', String(e && e.name)); diNota(e && e.name === 'NotAllowedError' ? T.eMic : T.eNessunMic, true); return }
    if (!ascolto || inConversazione()) { stream.getTracks().forEach(t => t.stop()); return }
    const ctx = new AudioContext(), analisi = ctx.createAnalyser(); analisi.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(analisi)
    const buf = new Uint8Array(analisi.fftSize)
    const o = { stream, ctx, rec: null, pezzi: [], inizio: 0, ultimaVoce: 0, giro: null, inviando: false }
    orecchio = o
    const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || ''
    diario('orecchio-partito', tipo)
    const chiudiFrase = () => {
      const rec = o.rec; o.rec = null; if (!rec) return
      const durata = o.ultimaVoce - o.inizio, quando = o.inizio
      rec.onstop = async () => {
        const blob = new Blob(o.pezzi, { type: rec.mimeType || tipo || 'audio/webm' }); o.pezzi = []
        // Frase troppo corta, oppure il browser l'ha gia' trascritta: non si manda niente.
        if (durata < 350 || orecchio !== o || o.inviando || inConversazione() || collegando) return
        await new Promise(ok => setTimeout(ok, 900))
        if (ultimoTestoBrowser >= quando - 300 || orecchio !== o || inConversazione() || collegando) return
        o.inviando = true
        try {
          const r = await fetch(`/api/lyft/voce/nome?l=${L}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': blob.type || 'audio/webm' }, body: blob })
          const j = await r.json().catch(() => ({})); const frase = String(j.testo || '').trim()
          if (frase) {
            diNota(`${T.hoSentito}: «${frase.slice(0, 90)}»`)
            const dopo = dopoIlNome(frase)
            diario(dopo === null ? 'orecchio-senza-nome' : 'orecchio-col-nome', frase)
            if (dopo !== null && orecchio === o && !inConversazione()) { try { window.parent.postMessage({ tipo: 'lyft:apri' }, location.origin) } catch {} ; apriConversazione(dopo) }
          } else if (j.errore) diario('orecchio-errore', j.errore)
        } catch {} finally { o.inviando = false }
      }
      try { rec.stop() } catch {}
    }
    o.giro = setInterval(() => {
      analisi.getByteTimeDomainData(buf)
      let somma = 0; for (const v of buf) somma += ((v - 128) / 128) ** 2
      const vol = Math.sqrt(somma / buf.length), ora = Date.now()
      livello = Math.min(1, vol * 4)
      if (vol > 0.03) {
        o.ultimaVoce = ora
        if (!o.rec && !o.inviando) { try { o.pezzi = []; o.rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined); o.rec.ondataavailable = e => { if (e.data && e.data.size) o.pezzi.push(e.data) }; o.rec.start(); o.inizio = ora } catch { o.rec = null } }
      }
      if (o.rec && (ora - o.ultimaVoce > 850 || ora - o.inizio > 8000)) chiudiFrase()
    }, 60)
  }
  function fermaOrecchio() { const o = orecchio; orecchio = null; if (!o) return; clearInterval(o.giro); try { o.rec && o.rec.stop() } catch {} ; o.stream.getTracks().forEach(t => t.stop()); try { o.ctx.close() } catch {} ; livello = 0 }

  // ---- l'ascolto del nome
  function fermaAscoltoNome() { fermaOrecchio(); const r = ric; ric = null; try { if (r) { r.onend = null; r.onresult = null; r.stop() } } catch {} }
  function avviaAscoltoNome(tieniNota = false) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    stato('ascolto'); if (!tieniNota) diNota(T.nota)
    avviaOrecchio()                                    // il nome si riconosce anche se il browser non trascrive
    if (!SR) { diario('senza-riconoscimento', navigator.userAgent.slice(-90)); return }
    const r = new SR(); ric = r; r.lang = LOC; r.continuous = true; r.interimResults = true
    r.onresult = e => {
      const ult = e.results[e.results.length - 1]; const frase = String(ult?.[0]?.transcript || '').trim(); if (!frase) return
      ultimoTestoBrowser = Date.now()                  // il browser sta trascrivendo: l'orecchio di riserva non manda niente
      const dopo = dopoIlNome(frase)
      // Appena sente il nome (anche a frase non finita) si prepara; la conversazione parte a frase conclusa.
      diNota(`${T.hoSentito}: «${frase.slice(0, 90)}»`)
      if (ult.isFinal) diario(dopo === null ? 'sentito-senza-nome' : 'sentito-col-nome', frase)
      if (!ult.isFinal || frase === ultimaFinale || dopo === null) return
      ultimaFinale = frase; setTimeout(() => { ultimaFinale = '' }, 1500)
      try { window.parent.postMessage({ tipo: 'lyft:apri' }, location.origin) } catch {}
      apriConversazione(dopo)
    }
    // Il browser chiude l'ascolto dopo un silenzio: finche' la voce e' accesa si riapre da solo.
    r.onend = () => { if (ascolto && ric === r) setTimeout(() => { if (ascolto && ric === r) { try { r.start() } catch {} } }, 250) }
    r.onerror = e => {
      diario('errore-ascolto', e.error)
      if (e.error === 'no-speech' || e.error === 'aborted') return                       // silenzio: normale
      if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported'].includes(e.error)) { if (ric === r) ric = null; if (!orecchio) { diNota(ERRORI[e.error] || `${T.eVoce} (${e.error})`, true); stato('spento') } }
    }
    r.onstart = () => diario('ascolto-partito', `${LOC} · ${navigator.userAgent.replace(/^.*?\) /, '').slice(0, 90)}`)
    r.onaudiostart = () => diario('audio-partito')
    try { r.start() } catch (err) { diario('ascolto-non-parte', String(err && err.name || err)); diNota(`${T.eVoce} (${String(err && err.name || err)})`, true) }
  }
  function accendi() { ascolto = true; $('cm-mic').setAttribute('aria-pressed', 'true'); try { localStorage.setItem('lyft-ascolto', '1') } catch {} ; try { window.parent.postMessage({ tipo: 'lyft:ascolto', acceso: true }, location.origin) } catch {} ; avviaAscoltoNome() }
  function spegni(ricorda = true) { if (ricorda) { try { localStorage.setItem('lyft-ascolto', '0') } catch {} ; try { window.parent.postMessage({ tipo: 'lyft:ascolto', acceso: false }, location.origin) } catch {} } ascolto = false; fermaAscoltoNome(); if (inConversazione()) chiudiConversazione(); try { speechSynthesis.cancel() } catch {} ; parlando = false; $('cm-mic').setAttribute('aria-pressed', 'false'); stato('spento'); diNota(T.notaSpento) }
  // Il microfono a sinistra: apre subito la conversazione (senza dire il nome) o la chiude.
  $('cm-mic')?.addEventListener('click', () => { if (inConversazione()) { chiudiConversazione(); if (!ascolto) accendi() } else { if (!ascolto) { ascolto = true; try { localStorage.setItem('lyft-ascolto', '1') } catch {} } apriConversazione('') } })
  // «Parla con Lyft» in basso: accende o spegne del tutto la voce.
  $('cm-parla')?.addEventListener('click', () => (ascolto || inConversazione() ? spegni() : accendi()))
  document.addEventListener('keydown', e => { if (e.code !== 'Space' || document.activeElement?.tagName === 'INPUT') return; if (parlaLyft) { e.preventDefault(); zittisci() } else if (parlando) { e.preventDefault(); try { speechSynthesis.cancel() } catch {} } })
  leggi('/api/profile').then(p => { nomePersona = String(p?.profile?.full_name || '').split(' ')[0] || '' })
  stato('spento')
  // L'ascolto del nome parte DA SOLO all'apertura: basta dire «Lyft» o «Hey Lyft», senza toccare niente.
  // La prima volta il browser chiede il permesso del microfono; chi spegne la voce a mano la ritrova spenta.
  { let spento = false; try { spento = localStorage.getItem('lyft-ascolto') === '0' } catch {} ; if (spento) diNota(T.notaSpento); else accendi() }
})()
