// ============================================================================
//  i18n server-side per i PDF (report marketing + SEO audit).
//  I PDF prima uscivano solo in italiano: qui traduciamo etichette, intestazioni
//  e chrome nella lingua del cliente (locale passato dal client al /api/report).
//  La chiave del dizionario è la stringa ITALIANA canonica → se manca una
//  traduzione si torna all'italiano (fallthrough), così gli acronimi universali
//  (ROAS, CTR, CPA, CPM, CPC, AOV, MER, COGS, ADS, Klaviyo…) restano invariati.
// ============================================================================

const D = {
  // ── Chrome / sezioni ──
  'Periodo': { en: 'Period', es: 'Periodo', fr: 'Période', de: 'Zeitraum' },
  'Generato il': { en: 'Generated on', es: 'Generado el', fr: 'Généré le', de: 'Erstellt am' },
  'prec.': { en: 'prev.', es: 'ant.', fr: 'préc.', de: 'vorh.' },
  'KPI del periodo': { en: 'KPIs for the period', es: 'KPI del periodo', fr: 'KPI de la période', de: 'KPIs des Zeitraums' },
  'Campagne attive': { en: 'Active campaigns', es: 'Campañas activas', fr: 'Campagnes actives', de: 'Aktive Kampagnen' },
  'Andamento valore conversioni (giornaliero)': { en: 'Conversion value trend (daily)', es: 'Evolución del valor de conversión (diario)', fr: 'Évolution de la valeur de conversion (quotidien)', de: 'Conversion-Wert-Verlauf (täglich)' },
  'Andamento revenue (giornaliero)': { en: 'Revenue trend (daily)', es: 'Evolución de ingresos (diario)', fr: 'Évolution du chiffre d’affaires (quotidien)', de: 'Umsatzverlauf (täglich)' },
  'Insight': { en: 'Insights', es: 'Insights', fr: 'Insights', de: 'Insights' },
  'To-do': { en: 'To-do', es: 'To-do', fr: 'À faire', de: 'To-do' },
  'Azioni consigliate': { en: 'Recommended actions', es: 'Acciones recomendadas', fr: 'Actions recommandées', de: 'Empfohlene Maßnahmen' },
  'To-do proattivi': { en: 'Proactive to-dos', es: 'To-do proactivos', fr: 'À faire proactifs', de: 'Proaktive To-dos' },
  'Prodotti a rischio stockout': { en: 'Products at stockout risk', es: 'Productos en riesgo de rotura de stock', fr: 'Produits à risque de rupture', de: 'Produkte mit Stockout-Risiko' },
  'Performance per prodotto': { en: 'Performance by product', es: 'Rendimiento por producto', fr: 'Performance par produit', de: 'Performance pro Produkt' },
  'Prodotti più venduti': { en: 'Best-selling products', es: 'Productos más vendidos', fr: 'Produits les plus vendus', de: 'Meistverkaufte Produkte' },
  'Paesi · ordini e fatturato': { en: 'Countries · orders and revenue', es: 'Países · pedidos e ingresos', fr: 'Pays · commandes et chiffre d’affaires', de: 'Länder · Bestellungen und Umsatz' },
  'Gerarchia campagna': { en: 'Campaign hierarchy', es: 'Jerarquía de campaña', fr: 'Hiérarchie de campagne', de: 'Kampagnenhierarchie' },
  'Nessuna creativa attiva.': { en: 'No active creatives.', es: 'Sin creatividades activas.', fr: 'Aucune création active.', de: 'Keine aktiven Creatives.' },
  'Report completo': { en: 'Full report', es: 'Informe completo', fr: 'Rapport complet', de: 'Vollständiger Bericht' },
  'Flow attivi': { en: 'Active flows', es: 'Flujos activos', fr: 'Flux actifs', de: 'Aktive Flows' },
  'Perché': { en: 'Why', es: 'Por qué', fr: 'Pourquoi', de: 'Warum' },
  'Soluzione': { en: 'Solution', es: 'Solución', fr: 'Solution', de: 'Lösung' },

  // Sezioni report completo (con emoji)
  '📊 KPI Brain — panoramica': { en: '📊 KPI Brain — overview', es: '📊 KPI Brain — resumen', fr: '📊 KPI Brain — aperçu', de: '📊 KPI Brain — Überblick' },
  '🚨 Problemi rilevati e soluzioni': { en: '🚨 Detected issues and solutions', es: '🚨 Problemas detectados y soluciones', fr: '🚨 Problèmes détectés et solutions', de: '🚨 Erkannte Probleme und Lösungen' },
  '🔵 Meta KPI': { en: '🔵 Meta KPI', es: '🔵 Meta KPI', fr: '🔵 Meta KPI', de: '🔵 Meta KPI' },
  '🔵 Meta Detail — campagne': { en: '🔵 Meta Detail — campaigns', es: '🔵 Meta Detail — campañas', fr: '🔵 Meta Detail — campagnes', de: '🔵 Meta Detail — Kampagnen' },
  '🟡 Google KPI': { en: '🟡 Google KPI', es: '🟡 Google KPI', fr: '🟡 Google KPI', de: '🟡 Google KPI' },
  '🟡 Google Detail — campagne': { en: '🟡 Google Detail — campaigns', es: '🟡 Google Detail — campañas', fr: '🟡 Google Detail — campagnes', de: '🟡 Google Detail — Kampagnen' },
  '📦 Performance prodotti': { en: '📦 Product performance', es: '📦 Rendimiento de productos', fr: '📦 Performance produits', de: '📦 Produkt-Performance' },
  '🏷️ Inventario': { en: '🏷️ Inventory', es: '🏷️ Inventario', fr: '🏷️ Inventaire', de: '🏷️ Inventar' },
  '✉️ Klaviyo — email marketing': { en: '✉️ Klaviyo — email marketing', es: '✉️ Klaviyo — email marketing', fr: '✉️ Klaviyo — email marketing', de: '✉️ Klaviyo — E-Mail-Marketing' },

  // ── Intestazioni tabelle ──
  'Campagna': { en: 'Campaign', es: 'Campaña', fr: 'Campagne', de: 'Kampagne' },
  'Stato': { en: 'Status', es: 'Estado', fr: 'Statut', de: 'Status' },
  'Prodotto': { en: 'Product', es: 'Producto', fr: 'Produit', de: 'Produkt' },
  'Taglia/SKU': { en: 'Size/SKU', es: 'Talla/SKU', fr: 'Taille/SKU', de: 'Größe/SKU' },
  'Stock': { en: 'Stock', es: 'Stock', fr: 'Stock', de: 'Bestand' },
  'Vendite/g': { en: 'Sales/d', es: 'Ventas/d', fr: 'Ventes/j', de: 'Verkäufe/T' },
  'Giorni a stockout': { en: 'Days to stockout', es: 'Días para rotura', fr: 'Jours avant rupture', de: 'Tage bis Stockout' },
  'Rischio': { en: 'Risk', es: 'Riesgo', fr: 'Risque', de: 'Risiko' },
  'Perse/sett.': { en: 'Lost/week', es: 'Perdidas/sem.', fr: 'Perdues/sem.', de: 'Verloren/Woche' },
  'Quantità': { en: 'Quantity', es: 'Cantidad', fr: 'Quantité', de: 'Menge' },
  'Paese': { en: 'Country', es: 'País', fr: 'Pays', de: 'Land' },
  'Nuovi': { en: 'New', es: 'Nuevos', fr: 'Nouveaux', de: 'Neu' },
  'Ritorno': { en: 'Returning', es: 'Recurrentes', fr: 'Récurrents', de: 'Wiederkehrend' },
  'Netto': { en: 'Net', es: 'Neto', fr: 'Net', de: 'Netto' },
  'Flow': { en: 'Flow', es: 'Flujo', fr: 'Flux', de: 'Flow' },

  // ── Etichette di rischio inventario ──
  'Stockout < 7gg': { en: 'Stockout < 7d', es: 'Rotura < 7d', fr: 'Rupture < 7j', de: 'Stockout < 7T' },
  'A rischio < 30gg': { en: 'At risk < 30d', es: 'En riesgo < 30d', fr: 'À risque < 30j', de: 'Risiko < 30T' },
  'Broken size': { en: 'Broken size', es: 'Talla rota', fr: 'Taille en rupture', de: 'Fehlende Größe' },
  'Esaurito': { en: 'Sold out', es: 'Agotado', fr: 'Épuisé', de: 'Ausverkauft' },

  // ── Etichette KPI ──
  'Spesa': { en: 'Spend', es: 'Gasto', fr: 'Dépense', de: 'Ausgaben' },
  'Revenue (Meta)': { en: 'Revenue (Meta)', es: 'Ingresos (Meta)', fr: 'Revenu (Meta)', de: 'Umsatz (Meta)' },
  'Acquisti': { en: 'Purchases', es: 'Compras', fr: 'Achats', de: 'Käufe' },
  'CTR link': { en: 'Link CTR', es: 'CTR enlace', fr: 'CTR lien', de: 'Link-CTR' },
  'CPC link': { en: 'Link CPC', es: 'CPC enlace', fr: 'CPC lien', de: 'Link-CPC' },
  'Frequenza': { en: 'Frequency', es: 'Frecuencia', fr: 'Fréquence', de: 'Frequenz' },
  'Fatturato': { en: 'Revenue', es: 'Ingresos', fr: 'Chiffre d’affaires', de: 'Umsatz' },
  'Ordini': { en: 'Orders', es: 'Pedidos', fr: 'Commandes', de: 'Bestellungen' },
  'Sessioni': { en: 'Sessions', es: 'Sesiones', fr: 'Sessions', de: 'Sitzungen' },
  'Conversion rate': { en: 'Conversion rate', es: 'Tasa de conversión', fr: 'Taux de conversion', de: 'Conversion-Rate' },
  'Nuovi clienti': { en: 'New customers', es: 'Clientes nuevos', fr: 'Nouveaux clients', de: 'Neukunden' },
  'Clienti ritorno': { en: 'Returning customers', es: 'Clientes recurrentes', fr: 'Clients récurrents', de: 'Bestandskunden' },
  'Repeat rate': { en: 'Repeat rate', es: 'Tasa de recompra', fr: 'Taux de réachat', de: 'Wiederkaufrate' },
  'Fatturato nuovi': { en: 'New revenue', es: 'Ingresos nuevos', fr: 'CA nouveaux', de: 'Umsatz Neu' },
  'Fatturato ritorno': { en: 'Returning revenue', es: 'Ingresos recurrentes', fr: 'CA récurrents', de: 'Umsatz Bestand' },
  'Resi': { en: 'Returns', es: 'Devoluciones', fr: 'Retours', de: 'Retouren' },
  'Spesa Meta': { en: 'Meta spend', es: 'Gasto Meta', fr: 'Dépense Meta', de: 'Meta-Ausgaben' },
  'Spesa Google': { en: 'Google spend', es: 'Gasto Google', fr: 'Dépense Google', de: 'Google-Ausgaben' },
  'MER (blended)': { en: 'MER (blended)', es: 'MER (blended)', fr: 'MER (blended)', de: 'MER (blended)' },
  'CTR Meta': { en: 'Meta CTR', es: 'CTR Meta', fr: 'CTR Meta', de: 'Meta-CTR' },
  'ROAS Meta': { en: 'Meta ROAS', es: 'ROAS Meta', fr: 'ROAS Meta', de: 'Meta-ROAS' },
  'ROAS Google': { en: 'Google ROAS', es: 'ROAS Google', fr: 'ROAS Google', de: 'Google-ROAS' },
  'Acquisti Meta': { en: 'Meta purchases', es: 'Compras Meta', fr: 'Achats Meta', de: 'Meta-Käufe' },
  'Conversioni Google': { en: 'Google conversions', es: 'Conversiones Google', fr: 'Conversions Google', de: 'Google-Conversions' },
  'Valore conv.': { en: 'Conv. value', es: 'Valor conv.', fr: 'Valeur conv.', de: 'Conv.-Wert' },
  'Conversioni': { en: 'Conversions', es: 'Conversiones', fr: 'Conversions', de: 'Conversions' },
  'Impression': { en: 'Impressions', es: 'Impresiones', fr: 'Impressions', de: 'Impressionen' },
  'Valore magazzino': { en: 'Inventory value', es: 'Valor de inventario', fr: 'Valeur du stock', de: 'Lagerwert' },
  'Pezzi a stock': { en: 'Units in stock', es: 'Unidades en stock', fr: 'Unités en stock', de: 'Einheiten auf Lager' },
  'Prodotti': { en: 'Products', es: 'Productos', fr: 'Produits', de: 'Produkte' },
  'Varianti': { en: 'Variants', es: 'Variantes', fr: 'Variantes', de: 'Varianten' },
  'Broken sizes': { en: 'Broken sizes', es: 'Tallas rotas', fr: 'Tailles en rupture', de: 'Fehlende Größen' },
  'Vendite perse/sett.': { en: 'Lost sales/week', es: 'Ventas perdidas/sem.', fr: 'Ventes perdues/sem.', de: 'Verlorene Verkäufe/Woche' },
  'Fatturato netto': { en: 'Net revenue', es: 'Ingresos netos', fr: 'CA net', de: 'Nettoumsatz' },
  'Margine op.': { en: 'Op. margin', es: 'Margen op.', fr: 'Marge op.', de: 'Op. Marge' },
  'ADS totali': { en: 'Total ads', es: 'ADS totales', fr: 'ADS totales', de: 'ADS gesamt' },
  'Unità': { en: 'Units', es: 'Unidades', fr: 'Unités', de: 'Einheiten' },
  'Copertura costi': { en: 'Cost coverage', es: 'Cobertura de costes', fr: 'Couverture des coûts', de: 'Kostendeckung' },
  'Email inviate': { en: 'Emails sent', es: 'Emails enviados', fr: 'Emails envoyés', de: 'Gesendete E-Mails' },
  'Aperture': { en: 'Opens', es: 'Aperturas', fr: 'Ouvertures', de: 'Öffnungen' },
  'Click': { en: 'Clicks', es: 'Clics', fr: 'Clics', de: 'Klicks' },
  'Open rate': { en: 'Open rate', es: 'Tasa de apertura', fr: 'Taux d’ouverture', de: 'Öffnungsrate' },
  'Click rate': { en: 'Click rate', es: 'Tasa de clics', fr: 'Taux de clic', de: 'Klickrate' },
  'Revenue email': { en: 'Email revenue', es: 'Ingresos email', fr: 'Revenu email', de: 'E-Mail-Umsatz' },

  // ── Footer ──
  'report generato automaticamente · i dati riflettono il periodo selezionato': {
    en: 'report generated automatically · data reflects the selected period',
    es: 'informe generado automáticamente · los datos reflejan el periodo seleccionado',
    fr: 'rapport généré automatiquement · les données reflètent la période sélectionnée',
    de: 'Bericht automatisch erstellt · Daten beziehen sich auf den gewählten Zeitraum',
  },
  'report completo generato automaticamente · dati del periodo selezionato': {
    en: 'full report generated automatically · data for the selected period',
    es: 'informe completo generado automáticamente · datos del periodo seleccionado',
    fr: 'rapport complet généré automatiquement · données de la période sélectionnée',
    de: 'vollständiger Bericht automatisch erstellt · Daten des gewählten Zeitraums',
  },

  // ── SEO Audit PDF ──
  'pagine': { en: 'pages', es: 'páginas', fr: 'pages', de: 'Seiten' },
  'Problemi ricorrenti': { en: 'Recurring issues', es: 'Problemas recurrentes', fr: 'Problèmes récurrents', de: 'Wiederkehrende Probleme' },
  'Pagine analizzate (peggiori in alto)': { en: 'Analyzed pages (worst on top)', es: 'Páginas analizadas (peores arriba)', fr: 'Pages analysées (pires en haut)', de: 'Analysierte Seiten (schlechteste oben)' },
  'Problemi': { en: 'Issues', es: 'Problemas', fr: 'Problèmes', de: 'Probleme' },
  'Essenziali': { en: 'Essential', es: 'Esenciales', fr: 'Essentiels', de: 'Essenziell' },
  'Social/Sharing': { en: 'Social/Sharing', es: 'Social/Compartir', fr: 'Social/Partage', de: 'Social/Sharing' },
  'Strutturati': { en: 'Structured', es: 'Estructurados', fr: 'Structurés', de: 'Strukturiert' },
  'Contenuto': { en: 'Content', es: 'Contenido', fr: 'Contenu', de: 'Inhalt' },
  'Tecnici': { en: 'Technical', es: 'Técnicos', fr: 'Techniques', de: 'Technisch' },
  'ok': { en: 'ok', es: 'ok', fr: 'ok', de: 'ok' },
  'da migliorare': { en: 'to improve', es: 'a mejorar', fr: 'à améliorer', de: 'verbesserbar' },
  'critici': { en: 'critical', es: 'críticos', fr: 'critiques', de: 'kritisch' },
  'Analisi keyword': { en: 'Keyword analysis', es: 'Análisis de keywords', fr: 'Analyse de mots-clés', de: 'Keyword-Analyse' },
  'Analisi keyword AI': { en: 'AI keyword analysis', es: 'Análisis de keywords IA', fr: 'Analyse de mots-clés IA', de: 'KI-Keyword-Analyse' },
  'occorrenze · densità': { en: 'occurrences · density', es: 'ocurrencias · densidad', fr: 'occurrences · densité', de: 'Vorkommen · Dichte' },
  'Parole più frequenti': { en: 'Most frequent words', es: 'Palabras más frecuentes', fr: 'Mots les plus fréquents', de: 'Häufigste Wörter' },
  'Frasi (2 parole)': { en: 'Phrases (2 words)', es: 'Frases (2 palabras)', fr: 'Expressions (2 mots)', de: 'Phrasen (2 Wörter)' },
  'Dettaglio controlli': { en: 'Checks detail', es: 'Detalle de comprobaciones', fr: 'Détail des contrôles', de: 'Prüfungsdetails' },
  'Keyword correlate': { en: 'Related keywords', es: 'Keywords relacionadas', fr: 'Mots-clés associés', de: 'Verwandte Keywords' },
  'Domande (PAA)': { en: 'Questions (PAA)', es: 'Preguntas (PAA)', fr: 'Questions (PAA)', de: 'Fragen (PAA)' },
  'Idee di contenuto': { en: 'Content ideas', es: 'Ideas de contenido', fr: 'Idées de contenu', de: 'Content-Ideen' },
  'Intent': { en: 'Intent', es: 'Intención', fr: 'Intention', de: 'Intent' },
  'Difficoltà': { en: 'Difficulty', es: 'Dificultad', fr: 'Difficulté', de: 'Schwierigkeit' },
  'Probabile': { en: 'Likely', es: 'Probable', fr: 'Probable', de: 'Wahrscheinlich' },
  'Improbabile': { en: 'Unlikely', es: 'Improbable', fr: 'Improbable', de: 'Unwahrscheinlich' },
  'Volume': { en: 'Volume', es: 'Volumen', fr: 'Volume', de: 'Volumen' },
  'Brief': { en: 'Brief', es: 'Brief', fr: 'Brief', de: 'Brief' },
  'Editor contenuti': { en: 'Content editor', es: 'Editor de contenido', fr: 'Éditeur de contenu', de: 'Content-Editor' },
  'Lunghezza': { en: 'Length', es: 'Longitud', fr: 'Longueur', de: 'Länge' },
  'parole': { en: 'words', es: 'palabras', fr: 'mots', de: 'Wörter' },
  'Struttura heading': { en: 'Heading structure', es: 'Estructura de encabezados', fr: 'Structure des titres', de: 'Überschriftenstruktur' },
  'Entità da coprire': { en: 'Entities to cover', es: 'Entidades a cubrir', fr: 'Entités à couvrir', de: 'Abzudeckende Entitäten' },
  'Gap / opportunità': { en: 'Gaps / opportunities', es: 'Gaps / oportunidades', fr: 'Lacunes / opportunités', de: 'Lücken / Chancen' },
  'Confronto competitor on-page': { en: 'On-page competitor comparison', es: 'Comparación on-page de competidores', fr: 'Comparaison on-page concurrents', de: 'On-Page-Wettbewerbsvergleich' },
  'Title (lung.)': { en: 'Title (len.)', es: 'Title (long.)', fr: 'Title (long.)', de: 'Title (Länge)' },
  'Meta (lung.)': { en: 'Meta (len.)', es: 'Meta (long.)', fr: 'Meta (long.)', de: 'Meta (Länge)' },
  'Parole': { en: 'Words', es: 'Palabras', fr: 'Mots', de: 'Wörter' },
  'Velocità': { en: 'Speed', es: 'Velocidad', fr: 'Vitesse', de: 'Geschwindigkeit' },
  'Risultati per prompt': { en: 'Results by prompt', es: 'Resultados por prompt', fr: 'Résultats par prompt', de: 'Ergebnisse pro Prompt' },
  'Citato': { en: 'Cited', es: 'Citado', fr: 'Cité', de: 'Zitiert' },
  'Non citato': { en: 'Not cited', es: 'No citado', fr: 'Non cité', de: 'Nicht zitiert' },
  'CTR medio': { en: 'Avg CTR', es: 'CTR medio', fr: 'CTR moyen', de: 'Ø CTR' },
  'Posizione media': { en: 'Avg position', es: 'Posición media', fr: 'Position moyenne', de: 'Ø Position' },
  'Opportunità — quasi prima pagina (pos 11–20)': { en: 'Opportunities — near first page (pos 11–20)', es: 'Oportunidades — casi primera página (pos 11–20)', fr: 'Opportunités — proche 1re page (pos 11–20)', de: 'Chancen — fast erste Seite (Pos. 11–20)' },
  'Query': { en: 'Query', es: 'Consulta', fr: 'Requête', de: 'Suchanfrage' },
  'Top query': { en: 'Top queries', es: 'Top consultas', fr: 'Top requêtes', de: 'Top-Suchanfragen' },
  'Generato da LyftAI · SEO Audit': { en: 'Generated by LyftAI · SEO Audit', es: 'Generado por LyftAI · SEO Audit', fr: 'Généré par LyftAI · SEO Audit', de: 'Erstellt von LyftAI · SEO Audit' },
}

const LOCALE_TAG = { it: 'it-IT', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' }

export function normLocale(locale) {
  const lc = String(locale || 'it').slice(0, 2).toLowerCase()
  return LOCALE_TAG[lc] ? lc : 'it'
}

export function localeTag(locale) {
  return LOCALE_TAG[normLocale(locale)]
}

// Ritorna una funzione tr(key) che traduce la stringa italiana canonica.
export function reportT(locale) {
  const lc = normLocale(locale)
  if (lc === 'it') return (k) => k
  return (k) => (D[k] && D[k][lc]) || k
}
