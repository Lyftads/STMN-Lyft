// ============================================================================
//  Regioni e province italiane — la tabella che mette d'accordo quattro fonti.
//
//  Ognuna chiama le stesse regioni in modo diverso, e nessuna lo dichiara:
//   - Shopify scrive la PROVINCIA in italiano ("Forlì-Cesena", "Pesaro e Urbino");
//   - Meta scrive la regione a volte in italiano e a volte in inglese nella
//     stessa risposta ("Lombardia", "Sicilia" ma "Sardinia", "Piedmont",
//     "Tuscany", "Aosta Valley") — verificato sull'account;
//   - Google Ads e Google Analytics la scrivono in inglese ("Lombardy", "Sicily").
//  Senza una forma unica la Toscana comparirebbe due volte, una con la spesa e
//  una con le vendite, e sembrerebbero due regioni in perdita.
// ============================================================================

export const chiave = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')

const REGIONI = {
  'Abruzzo': ['L\'Aquila', 'Chieti', 'Pescara', 'Teramo'],
  'Basilicata': ['Matera', 'Potenza'],
  'Calabria': ['Catanzaro', 'Cosenza', 'Crotone', 'Reggio Calabria', 'Reggio di Calabria', 'Vibo Valentia'],
  'Campania': ['Avellino', 'Benevento', 'Caserta', 'Napoli', 'Salerno'],
  'Emilia-Romagna': ['Bologna', 'Ferrara', 'Forlì-Cesena', 'Modena', 'Parma', 'Piacenza', 'Ravenna', 'Reggio Emilia', 'Reggio nell\'Emilia', 'Rimini'],
  'Friuli-Venezia Giulia': ['Gorizia', 'Pordenone', 'Trieste', 'Udine'],
  'Lazio': ['Frosinone', 'Latina', 'Rieti', 'Roma', 'Viterbo'],
  'Liguria': ['Genova', 'Imperia', 'La Spezia', 'Savona'],
  'Lombardia': ['Bergamo', 'Brescia', 'Como', 'Cremona', 'Lecco', 'Lodi', 'Mantova', 'Milano', 'Monza e Brianza', 'Monza e della Brianza', 'Monza Brianza', 'Pavia', 'Sondrio', 'Varese'],
  'Marche': ['Ancona', 'Ascoli Piceno', 'Fermo', 'Macerata', 'Pesaro e Urbino', 'Pesaro Urbino'],
  'Molise': ['Campobasso', 'Isernia'],
  'Piemonte': ['Alessandria', 'Asti', 'Biella', 'Cuneo', 'Novara', 'Torino', 'Verbano-Cusio-Ossola', 'Vercelli'],
  'Puglia': ['Bari', 'Barletta-Andria-Trani', 'Brindisi', 'Foggia', 'Lecce', 'Taranto'],
  'Sardegna': ['Cagliari', 'Nuoro', 'Oristano', 'Sassari', 'Sud Sardegna', 'Carbonia-Iglesias', 'Medio Campidano', 'Ogliastra', 'Olbia-Tempio'],
  'Sicilia': ['Agrigento', 'Caltanissetta', 'Catania', 'Enna', 'Messina', 'Palermo', 'Ragusa', 'Siracusa', 'Trapani'],
  'Toscana': ['Arezzo', 'Firenze', 'Grosseto', 'Livorno', 'Lucca', 'Massa-Carrara', 'Massa e Carrara', 'Pisa', 'Pistoia', 'Prato', 'Siena'],
  'Trentino-Alto Adige': ['Bolzano', 'Bozen', 'Trento'],
  'Umbria': ['Perugia', 'Terni'],
  'Valle d\'Aosta': ['Aosta'],
  'Veneto': ['Belluno', 'Padova', 'Rovigo', 'Treviso', 'Venezia', 'Verona', 'Vicenza'],
}

// Come le piattaforme chiamano le regioni quando non usano l'italiano.
const ALIAS_REGIONE = {
  'Lombardia': ['Lombardy'],
  'Piemonte': ['Piedmont'],
  'Toscana': ['Tuscany'],
  'Sardegna': ['Sardinia'],
  'Sicilia': ['Sicily'],
  'Puglia': ['Apulia'],
  'Marche': ['The Marches', 'Marches'],
  'Valle d\'Aosta': ['Aosta Valley', 'Aosta', 'Vallee d\'Aoste', 'Valle d\'Aosta/Vallée d\'Aoste'],
  'Trentino-Alto Adige': ['Trentino-South Tyrol', 'Trentino Alto Adige', 'Trentino-Alto Adige/South Tyrol', 'Trentino-Alto Adige/Südtirol', 'Trentino-Alto Adige/Sudtirol', 'South Tyrol'],
  'Friuli-Venezia Giulia': ['Friuli Venezia Giulia'],
  'Emilia-Romagna': ['Emilia Romagna'],
  'Lazio': ['Latium'],
  // Shopify scrive cosi' la Basilicata nelle sessioni.
  'Basilicata': ['Basilicate'],
}

const perProvincia = new Map()
const perRegione = new Map()
for (const [regione, province] of Object.entries(REGIONI)) {
  perRegione.set(chiave(regione), regione)
  for (const p of province) perProvincia.set(chiave(p), regione)
}
for (const [regione, alias] of Object.entries(ALIAS_REGIONE)) {
  for (const a of alias) perRegione.set(chiave(a), regione)
}

export const REGIONI_ITALIANE = Object.keys(REGIONI)

// Le province di una regione: serve a chiedere a Shopify le province giuste quando si vuole una
// serie per REGIONE (ShopifyQL le regioni italiane non le conosce, conosce solo shipping_region,
// che nelle vendite e' la PROVINCIA).
export const provinceDiRegione = (regione) => REGIONI[regioneCanonica(regione) || regione] || []

// Provincia (come la scrive Shopify) → regione. null se non la conosciamo:
// chi chiama deve contarla a parte, non buttarla in una regione a caso.
export const regioneDiProvincia = (provincia) => perProvincia.get(chiave(provincia)) || null

// Nome di regione scritto da una piattaforma → forma unica in italiano.
export const regioneCanonica = (nome) => perRegione.get(chiave(nome)) || null

// Dove sta ogni regione sul globo (il capoluogo): serve a mettere i visitatori
// in tempo reale sulla loro regione vera, non "da qualche parte in Italia".
export const CENTRO_REGIONE = {
  'Abruzzo': [42.35, 13.40], 'Basilicata': [40.64, 15.80], 'Calabria': [38.91, 16.59], 'Campania': [40.85, 14.27],
  'Emilia-Romagna': [44.49, 11.34], 'Friuli-Venezia Giulia': [45.65, 13.78], 'Lazio': [41.90, 12.50], 'Liguria': [44.41, 8.93],
  'Lombardia': [45.46, 9.19], 'Marche': [43.62, 13.51], 'Molise': [41.56, 14.66], 'Piemonte': [45.07, 7.69],
  'Puglia': [41.12, 16.87], 'Sardegna': [39.22, 9.12], 'Sicilia': [38.12, 13.36], 'Toscana': [43.77, 11.25],
  'Trentino-Alto Adige': [46.07, 11.12], 'Umbria': [43.11, 12.39], "Valle d'Aosta": [45.74, 7.32], 'Veneto': [45.44, 12.32],
}
