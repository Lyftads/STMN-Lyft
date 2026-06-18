// ─────────────────────────────────────────────────────────────
//  Config pagine-soluzione marketing (/soluzioni/[area]).
//  - AREAS: aree del prodotto → moduli (id allineati a HELP_ARTICLES + HELP_VIDEOS)
//  - SOL_I18N: copy "chrome" + hero PAS per area, in 5 lingue (fallback en→it).
//  Il contenuto di OGNI modulo (titolo/descrizione PAS) arriva da findArticle()
//  (già tradotto) e il video da HELP_VIDEOS — qui sta solo l'impalcatura.
// ─────────────────────────────────────────────────────────────

// hero = id del modulo con IL video principale (un solo video per pagina).
// Gli altri moduli compaiono come screenshot reali (poster) + descrizioni.
export const AREAS = [
  {
    id: 'commerce',
    // path SVG (viewBox 0 0 24 24) — niente emoji
    icon: 'M3 3v18h18 M7 14l3-3 3 3 4-5',
    hero: 'dashboard',
    modules: ['dashboard', 'kpiBrain', 'inventory', 'productPerformance', 'clienti', 'ltvCohorts', 'pnl'],
  },
  {
    id: 'advertising',
    icon: 'M3 11l19-7-7 19-2-8-8-2z',
    hero: 'metaDetail',
    modules: ['metaDetail', 'metaKpi', 'creative', 'creativeFatigue', 'budgetAdvisor', 'googleKpi', 'competitorIntel'],
  },
  {
    id: 'seo',
    icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.3-4.3',
    hero: 'seoAudit',
    modules: ['seoAudit', 'webScanner', 'cro', 'creativeIntel'],
  },
  {
    id: 'ai-creative',
    icon: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
    hero: 'performanceAgent',
    modules: ['performanceAgent', 'team', 'creativeStudio'],
  },
  {
    id: 'team',
    icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    hero: 'chat',
    modules: ['chat', 'tasks', 'timeTracking'],
  },
]

export function getArea(id) {
  return AREAS.find(a => a.id === id) || null
}

const CHROME = {
  it: {
    backToSite: 'Torna al sito', login: 'Accedi', freeTrial: 'Prova gratis', watchDemo: 'Guarda la demo',
    problemLabel: 'Il problema', solutionLabel: 'Come lo risolve LyftAI',
    watchTutorial: 'Guarda il tutorial', keyPoints: 'In breve',
    included: 'Tutto questo è incluso in ogni piano, senza costi extra né funzioni a pagamento.',
    finalH: 'Pronto a vederlo sui tuoi dati?', finalSub: '14 giorni gratis. Niente carta. Setup in 5 minuti.',
    finalCta: 'Inizia gratis', rights: 'Tutti i diritti riservati.',
    featured: 'Guardalo in azione', inside: 'Tutto quello che trovi dentro',
    compareTitle: 'Con LyftAI cambia tutto', withoutLabel: 'Senza LyftAI', withLabel: 'Con LyftAI',
    compare: [
      { k: 'Strumenti', a: '5–10 abbonamenti separati', b: 'Tutto in una sola piattaforma' },
      { k: 'Dati', a: 'Sparsi, da ricontrollare a mano', b: 'Consolidati e verificati in automatico' },
      { k: 'Tempo', a: 'Ore di reporting manuale', b: 'Pronto ogni mattina' },
      { k: 'Decisioni', a: 'A sensazione', b: 'Su numeri reali, in tempo' },
    ],
    statsTitle: 'I numeri sui brand pilota',
    stats: [{ v: '+34%', l: 'ROAS medio dopo 60 giorni' }, { v: '−22%', l: 'CAC sui brand pilota' }, { v: '5 min', l: 'Setup completo' }, { v: '24/7', l: 'Briefing anomalie' }],
  },
  en: {
    backToSite: 'Back to site', login: 'Log in', freeTrial: 'Free trial', watchDemo: 'Watch the demo',
    problemLabel: 'The problem', solutionLabel: 'How LyftAI solves it',
    watchTutorial: 'Watch the tutorial', keyPoints: 'In short',
    included: 'All of this is included in every plan — no extra costs, no paywalled features.',
    finalH: 'Ready to see it on your data?', finalSub: '14 days free. No card. 5-minute setup.',
    finalCta: 'Start free', rights: 'All rights reserved.',
    featured: 'See it in action', inside: 'Everything you get inside',
    compareTitle: 'With LyftAI, everything changes', withoutLabel: 'Without LyftAI', withLabel: 'With LyftAI',
    compare: [
      { k: 'Tools', a: '5–10 separate subscriptions', b: 'Everything in one platform' },
      { k: 'Data', a: 'Scattered, re-checked by hand', b: 'Consolidated and auto-verified' },
      { k: 'Time', a: 'Hours of manual reporting', b: 'Ready every morning' },
      { k: 'Decisions', a: 'By gut feeling', b: 'On real numbers, in time' },
    ],
    statsTitle: 'The numbers on pilot brands',
    stats: [{ v: '+34%', l: 'Average ROAS after 60 days' }, { v: '−22%', l: 'CAC on pilot brands' }, { v: '5 min', l: 'Full setup' }, { v: '24/7', l: 'Anomaly briefing' }],
  },
  es: {
    backToSite: 'Volver al sitio', login: 'Entrar', freeTrial: 'Prueba gratis', watchDemo: 'Ver la demo',
    problemLabel: 'El problema', solutionLabel: 'Cómo lo resuelve LyftAI',
    watchTutorial: 'Ver el tutorial', keyPoints: 'En breve',
    included: 'Todo esto está incluido en cada plan, sin costes extra ni funciones de pago.',
    finalH: '¿Listo para verlo con tus datos?', finalSub: '14 días gratis. Sin tarjeta. Configuración en 5 minutos.',
    finalCta: 'Empezar gratis', rights: 'Todos los derechos reservados.',
    featured: 'Míralo en acción', inside: 'Todo lo que encuentras dentro',
    compareTitle: 'Con LyftAI cambia todo', withoutLabel: 'Sin LyftAI', withLabel: 'Con LyftAI',
    compare: [
      { k: 'Herramientas', a: '5–10 suscripciones separadas', b: 'Todo en una sola plataforma' },
      { k: 'Datos', a: 'Dispersos, verificados a mano', b: 'Consolidados y verificados automáticamente' },
      { k: 'Tiempo', a: 'Horas de reporting manual', b: 'Listo cada mañana' },
      { k: 'Decisiones', a: 'Por intuición', b: 'Sobre números reales, a tiempo' },
    ],
    statsTitle: 'Los números en marcas piloto',
    stats: [{ v: '+34%', l: 'ROAS medio tras 60 días' }, { v: '−22%', l: 'CAC en marcas piloto' }, { v: '5 min', l: 'Configuración completa' }, { v: '24/7', l: 'Briefing de anomalías' }],
  },
  fr: {
    backToSite: 'Retour au site', login: 'Se connecter', freeTrial: 'Essai gratuit', watchDemo: 'Voir la démo',
    problemLabel: 'Le problème', solutionLabel: 'Comment LyftAI le résout',
    watchTutorial: 'Voir le tutoriel', keyPoints: 'En bref',
    included: 'Tout cela est inclus dans chaque plan — sans coûts supplémentaires ni fonctions payantes.',
    finalH: 'Prêt à le voir sur vos données ?', finalSub: '14 jours gratuits. Sans carte. Installation en 5 minutes.',
    finalCta: 'Commencer gratuitement', rights: 'Tous droits réservés.',
    featured: 'Voir en action', inside: 'Tout ce que vous obtenez à l’intérieur',
    compareTitle: 'Avec LyftAI, tout change', withoutLabel: 'Sans LyftAI', withLabel: 'Avec LyftAI',
    compare: [
      { k: 'Outils', a: '5 à 10 abonnements séparés', b: 'Tout dans une seule plateforme' },
      { k: 'Données', a: 'Éparpillées, revérifiées à la main', b: 'Consolidées et vérifiées automatiquement' },
      { k: 'Temps', a: 'Des heures de reporting manuel', b: 'Prêt chaque matin' },
      { k: 'Décisions', a: 'Au feeling', b: 'Sur des chiffres réels, à temps' },
    ],
    statsTitle: 'Les chiffres sur les marques pilotes',
    stats: [{ v: '+34%', l: 'ROAS moyen après 60 jours' }, { v: '−22%', l: 'CAC sur les marques pilotes' }, { v: '5 min', l: 'Installation complète' }, { v: '24/7', l: 'Briefing des anomalies' }],
  },
  de: {
    backToSite: 'Zurück zur Seite', login: 'Anmelden', freeTrial: 'Kostenlos testen', watchDemo: 'Demo ansehen',
    problemLabel: 'Das Problem', solutionLabel: 'So löst LyftAI es',
    watchTutorial: 'Tutorial ansehen', keyPoints: 'Kurz gesagt',
    included: 'All das ist in jedem Plan enthalten — keine Zusatzkosten, keine kostenpflichtigen Funktionen.',
    finalH: 'Bereit, es mit Ihren Daten zu sehen?', finalSub: '14 Tage kostenlos. Keine Karte. Einrichtung in 5 Minuten.',
    finalCta: 'Kostenlos starten', rights: 'Alle Rechte vorbehalten.',
    featured: 'In Aktion sehen', inside: 'Alles, was Sie darin bekommen',
    compareTitle: 'Mit LyftAI ändert sich alles', withoutLabel: 'Ohne LyftAI', withLabel: 'Mit LyftAI',
    compare: [
      { k: 'Tools', a: '5–10 separate Abos', b: 'Alles in einer Plattform' },
      { k: 'Daten', a: 'Verstreut, von Hand geprüft', b: 'Konsolidiert und automatisch verifiziert' },
      { k: 'Zeit', a: 'Stunden manuelles Reporting', b: 'Jeden Morgen bereit' },
      { k: 'Entscheidungen', a: 'Aus dem Bauch', b: 'Auf echten Zahlen, rechtzeitig' },
    ],
    statsTitle: 'Die Zahlen bei Pilot-Marken',
    stats: [{ v: '+34%', l: 'Durchschnittlicher ROAS nach 60 Tagen' }, { v: '−22%', l: 'CAC bei Pilot-Marken' }, { v: '5 Min', l: 'Komplette Einrichtung' }, { v: '24/7', l: 'Anomalie-Briefing' }],
  },
}

// Hero per area. Commerce in 5 lingue; le altre in it/en (fallback gestito sotto).
const HERO = {
  commerce: {
    it: { eyebrow: 'Commerce & Analytics', h1: 'Tutto il tuo commerce, leggibile a colpo d’occhio', sub: 'Vendite, margini reali fino all’EBIT, inventario, clienti e LTV — consolidati dai dati veri del tuo Shopify, in un’unica vista.', problem: 'Apri 6 dashboard ogni mattina, esporti fogli, ricontrolli se i numeri tornano — e scopri i problemi quando hai già bruciato giorni di margine.', solution: 'Una sola fonte di verità: ogni metrica commerciale calcolata sui tuoi dati reali, con i video qui sotto che ti mostrano esattamente cosa vedi e come usarla.' },
    en: { eyebrow: 'Commerce & Analytics', h1: 'Your whole commerce, readable at a glance', sub: 'Sales, real margins down to EBIT, inventory, customers and LTV — consolidated from your real Shopify data, in one view.', problem: 'You open 6 dashboards every morning, export spreadsheets, double-check the numbers — and find problems after you’ve already burned days of margin.', solution: 'One source of truth: every commerce metric computed on your real data, with the videos below showing exactly what you see and how to use it.' },
    es: { eyebrow: 'Commerce & Analytics', h1: 'Todo tu comercio, legible de un vistazo', sub: 'Ventas, márgenes reales hasta el EBIT, inventario, clientes y LTV — consolidados desde tus datos reales de Shopify, en una sola vista.', problem: 'Abres 6 dashboards cada mañana, exportas hojas, verificas si los números cuadran — y descubres los problemas cuando ya has quemado días de margen.', solution: 'Una única fuente de verdad: cada métrica de comercio calculada sobre tus datos reales, con los vídeos de abajo que muestran exactamente qué ves y cómo usarlo.' },
    fr: { eyebrow: 'Commerce & Analytics', h1: 'Tout votre commerce, lisible d’un coup d’œil', sub: 'Ventes, marges réelles jusqu’à l’EBIT, inventaire, clients et LTV — consolidés depuis vos vraies données Shopify, en une seule vue.', problem: 'Vous ouvrez 6 dashboards chaque matin, exportez des feuilles, revérifiez les chiffres — et découvrez les problèmes après avoir déjà brûlé des jours de marge.', solution: 'Une seule source de vérité : chaque métrique de commerce calculée sur vos vraies données, avec les vidéos ci-dessous qui montrent exactement ce que vous voyez et comment l’utiliser.' },
    de: { eyebrow: 'Commerce & Analytics', h1: 'Ihr ganzer Commerce, auf einen Blick lesbar', sub: 'Umsätze, echte Margen bis zum EBIT, Inventar, Kunden und LTV — konsolidiert aus Ihren echten Shopify-Daten, in einer Ansicht.', problem: 'Sie öffnen jeden Morgen 6 Dashboards, exportieren Tabellen, prüfen die Zahlen doppelt — und entdecken Probleme, wenn Sie schon Tage an Marge verbrannt haben.', solution: 'Eine einzige Quelle der Wahrheit: jede Commerce-Kennzahl auf Ihren echten Daten berechnet, mit den Videos unten, die genau zeigen, was Sie sehen und wie Sie es nutzen.' },
  },
  advertising: {
    it: { eyebrow: 'Advertising', h1: 'Meta e Google Ads, fino al singolo annuncio', sub: 'Spesa, ROAS, performance per campagna/adset/ad, Budget Advisor e Creative Fatigue — su Meta e Google, senza saltare tra le piattaforme.', problem: 'Tra Gestione Inserzioni, Google Ads e fogli di attribuzione, capire dove stai bruciando budget richiede ore e arriva sempre tardi.', solution: 'Tutte le metriche paid in un posto, fino all’ad-level, con gli alert di fatica creativa e budget che ti dicono dove intervenire.' },
    en: { eyebrow: 'Advertising', h1: 'Meta and Google Ads, down to the single ad', sub: 'Spend, ROAS, campaign/adset/ad performance, Budget Advisor and Creative Fatigue — across Meta and Google, without jumping between platforms.', problem: 'Between Ads Manager, Google Ads and attribution spreadsheets, understanding where you’re burning budget takes hours and always arrives late.', solution: 'All your paid metrics in one place, down to ad-level, with creative-fatigue and budget alerts that tell you where to act.' },
  },
  seo: {
    it: { eyebrow: 'Sito & SEO', h1: 'Posizionamento, conversioni e salute del sito', sub: 'SEO audit on-page e multipagina, Google Search Console reale, Keyword AI, AI Visibility (AEO), CRO e scanner del sito con AI.', problem: 'SEO, CRO e performance del sito vivono in tool separati: difficile capire cosa sistemare prima e che impatto avrà.', solution: 'Audit chiari con priorità, dati GSC reali e analisi CRO automatica — sai cosa correggere e perché conta.' },
    en: { eyebrow: 'Website & SEO', h1: 'Rankings, conversions and site health', sub: 'On-page & multi-page SEO audit, real Google Search Console, Keyword AI, AI Visibility (AEO), CRO and AI site scanner.', problem: 'SEO, CRO and site performance live in separate tools — hard to know what to fix first and what impact it will have.', solution: 'Clear, prioritized audits, real GSC data and automatic CRO analysis — you know what to fix and why it matters.' },
  },
  'ai-creative': {
    it: { eyebrow: 'AI & Creative', h1: 'Una squadra AI che conosce il tuo brand', sub: 'Performance Agent, 8 agenti C-suite con memoria condivisa e Creative Studio per immagini e creatività sul tuo brand identity.', problem: 'Gli assistenti generici non conoscono il tuo brand: rispondono a vuoto e devi rispiegare tutto ogni volta.', solution: 'Agenti che leggono i tuoi dati reali e ricordano il tuo brand, più uno studio creativo che produce sul tuo stile.' },
    en: { eyebrow: 'AI & Creative', h1: 'An AI team that knows your brand', sub: 'Performance Agent, 8 C-suite agents with shared memory and Creative Studio for on-brand images and creatives.', problem: 'Generic assistants don’t know your brand: they answer in a vacuum and you re-explain everything every time.', solution: 'Agents that read your real data and remember your brand, plus a creative studio that produces in your style.' },
  },
  team: {
    it: { eyebrow: 'Team & Operations', h1: 'Tutto il team, dentro la stessa piattaforma', sub: 'Progetti & Task in Kanban, Lyftimer per il time-tracking e LyftTalk: chat con i tuoi agenti AI e call vocali.', problem: 'Task su un tool, chat su un altro, ore su un terzo: il lavoro del team è frammentato e niente parla coi tuoi dati.', solution: 'Operatività e collaborazione nello stesso posto degli analytics, con gli agenti AI a un messaggio di distanza.' },
    en: { eyebrow: 'Team & Operations', h1: 'Your whole team, inside the same platform', sub: 'Projects & Tasks on Kanban, Lyftimer for time-tracking and LyftTalk: chat with your AI agents and voice calls.', problem: 'Tasks on one tool, chat on another, hours on a third: team work is fragmented and none of it talks to your data.', solution: 'Operations and collaboration in the same place as your analytics, with AI agents one message away.' },
  },
}

export function getMarketing(area, lang) {
  const L = CHROME[lang] ? lang : (CHROME.en ? 'en' : 'it')
  const chrome = CHROME[L] || CHROME.it
  const heroByLang = HERO[area] || {}
  const hero = heroByLang[lang] || heroByLang.en || heroByLang.it || null
  return { chrome, hero }
}
