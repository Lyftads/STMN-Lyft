'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import LogoMark from '../components/LogoMark'

const ACCENT = '#bf5af2'
const BLUE = '#2997ff'
const GREEN = '#22c55e'

// ─────────────────────────────────────────────────────────────
//  i18n — IT / EN / ES (no library, dictionary lookup)
// ─────────────────────────────────────────────────────────────
const I18N = {
  it: {
    nav: { features: 'Funzionalità', pricing: 'Prezzi', contact: 'Contatti', login: 'Accedi', cta: 'Prova gratis' },
    hero: {
      badge: 'Prova gratuita · 14 giorni',
      title1: 'Il consulente AI',
      title2: 'che conosce il tuo brand.',
      subtitle: 'Connetti Shopify, Meta e Klaviyo in 5 minuti. LyftAI legge i tuoi dati, impara dal tuo brand, e ogni mattina ti dice dove stai bruciando soldi e dove c\'è leva di crescita.',
      ctaPrimary: 'Inizia la prova gratuita',
      ctaSecondary: 'Scopri come funziona',
      perks: ['Niente carta richiesta', 'Setup in 5 minuti', 'Cancella quando vuoi'],
    },
    trust: { label: 'Integrazioni native' },
    problem: {
      eyebrow: 'Il problema',
      title: '4 dashboard, 12 spreadsheet, 0 risposte chiare',
      withoutLabel: 'Senza LyftAI',
      withoutList: [
        '6 dashboard aperte: Shopify, Meta, Klaviyo, GA4, Stripe, fogli Google',
        'Tempo perso a ricontrollare se i dati combaciano',
        'Anomalie scoperte dopo 3 giorni di spend bruciato',
        'Decisioni basate su sentimento, non su numeri',
        'Consulenti esterni a €3-5k/mese che ti rispondono lentamente',
      ],
      withLabel: 'Con LyftAI',
      withList: [
        '1 dashboard centralizzata, KPI live da tutte le piattaforme',
        'Numeri consolidati e cross-verificati automaticamente',
        'Briefing notturno: l\'anomalia te la dice lui all\'alba',
        'Raccomandazioni proattive con expected impact in €',
        'AI advisor che impara dal tuo brand e ricorda tutto',
      ],
    },
    stats: [
      { v: '+34%', l: 'ROAS medio dopo 60 giorni' },
      { v: '−22%', l: 'CAC sui brand pilot' },
      { v: '5min', l: 'Setup completo integrazioni' },
      { v: '24/7', l: 'Briefing automatico anomalie' },
    ],
    tabsTour: { eyebrow: 'Tour completo', title: '9 tab. Tutto quello che ti serve in un unico software.' },
    tabs: [
      { id: 'dashboard', icon: '◉', title: 'Dashboard', desc: 'Vista d\'insieme con KPI live, raccomandazioni proattive e alert anomalie.' },
      { id: 'kpi', icon: '★', title: 'KPI Brain', desc: 'Top prodotti, marketing sources, paesi di fatturazione. Insight pronti.' },
      { id: 'reports', icon: '▦', title: 'Report periodici', desc: 'Weekly, Monthly, Quarter, Year con confronto period-over-period. Export PDF.' },
      { id: 'klaviyo', icon: '✉', title: 'Klaviyo', desc: 'Revenue email, KPI flussi, segmenti. Tutto in un\'unica vista.' },
      { id: 'meta', icon: '⊞', title: 'Creative + Meta Detail', desc: 'Performance ad-level, ROAS per campagna, analisi creative.' },
      { id: 'cro', icon: '◇', title: 'CRO + AI Scanner', desc: 'Funnel, top pages, audit CRO automatico via GPT-4o Vision.' },
      { id: 'agent', icon: '✦', title: 'Performance Agent', desc: 'Chat con un advisor AI verticale sul tuo brand. CMO · CFO · CRO.' },
      { id: 'lab', icon: '✧', title: 'Creative Lab', desc: 'Generazione AI di ad creative basate sul tuo brand identity.' },
      { id: 'competitor', icon: '◈', title: 'Competitor Intel', desc: 'Catalogo, ads attive, comparazione prezzi automatica.' },
    ],
    featuresTitle: { eyebrow: 'Cosa fa per te', title: '6 strumenti che cambiano come gestisci il tuo brand' },
    features: [
      { icon: '◎', title: 'Dashboard real-time', desc: 'KPI core (Fatturato, AOV, MER, CAC, LTV) aggiornati live da Shopify e Meta.' },
      { icon: '✦', title: 'Performance Agent AI', desc: 'Consulente AI che parla del TUO brand. Risponde coi tuoi numeri.' },
      { icon: '◐', title: 'Briefing notturno', desc: 'Ogni mattina alle 6 l\'AI ha già scansionato i dati. Apri la chat: lui sa già cosa è successo.' },
      { icon: '◈', title: 'Competitor Intel', desc: 'Monitoraggio automatico ads attive, prezzi e cataloghi dei tuoi 5 competitor principali.' },
      { icon: '⚖', title: 'Budget Advisor', desc: 'Analizza Meta Ads e suggerisce dove spostare budget per massimizzare ROAS.' },
      { icon: '⊛', title: 'Creative Fatigue', desc: 'Identifica le creative sature prima che brucino il budget.' },
    ],
    demoTitle: { eyebrow: 'Dati in azione', title: 'Esempio di quello che vedi ogni giorno' },
    demoCards: {
      revenue: { eyebrow: 'Fatturato 30gg', value: '€84.250', delta: '+24% vs periodo precedente' },
      orders: { eyebrow: 'Ordini per canale', value: '1.284', sub: 'Meta è il top channel' },
      briefingTitle: 'Briefing automatico — stamattina',
      briefingItems: [
        { icon: '⚠', color: '#f87171', txt: 'ROAS Meta crollato a 1.4x (vs 2.8x media 7gg)' },
        { icon: '▲', color: '#fbbf24', txt: 'AOV in calo da 4 giorni: 78€ → 71€' },
        { icon: '◆', color: BLUE, txt: 'Top product cambia: Paracalli Premium scala' },
        { icon: 'ⓘ', color: GREEN, txt: 'Settimana record: 142 ordini (best del mese)' },
      ],
      chatTitle: 'Performance Agent — chat',
      chatUser: 'Com\'è andata la settimana?',
      chatAi: 'Allora, MER a {strong}2,6x{/strong} — sopra il target che tieni a 2,5x. Settimana solida. AOV in linea, ma il {strong}CTR Meta cala da 3 giorni{/strong}. Lo guardo?',
    },
    pricingTitle: { eyebrow: 'Pricing', title: 'Scegli il piano giusto per la tua crescita' },
    pricingSub: 'Tutti i piani con 14 giorni gratis. Niente carta richiesta. Cancellazione in 1 click.',
    plans: [
      { id: 'starter', name: 'Starter', price: '€119,99', period: '/mese', tagline: 'Per founder che strutturano il primo brand', features: ['Dashboard KPI core', 'Report periodici', 'Integrazione Shopify + Meta + GA4', 'Email support 48h'], cta: 'Inizia con Starter' },
      { id: 'growth', name: 'Growth', price: '€179,99', period: '/mese', tagline: 'Brand in scaling che cercano leve data-driven', features: ['Tutto di Starter +', 'Klaviyo + Creative Tab Meta Ads', 'AI Website Scanner (CRO)', 'Meta Detail ad-level', 'Priority support 12h'], cta: 'Inizia con Growth', popular: true, popularLabel: 'POPOLARE' },
      { id: 'scale', name: 'Scale', price: '€349,99', period: '/mese', tagline: 'Brand 7-8 figure con team dedicato', features: ['Tutto di Growth +', 'Creative Lab AI generation', 'Competitor Intel', 'Performance Agent AI + Simulatore', 'CSM dedicato'], cta: 'Inizia con Scale' },
    ],
    testimonialsTitle: { eyebrow: 'Cosa dicono di noi', title: 'Brand che hanno smesso di scegliere a sentimento' },
    testimonials: [
      { name: 'Marino C.', role: 'Founder, STMN Fitness', text: 'Prima dovevo aprire 4 dashboard ogni mattina. Adesso apro la chat e mi dice: ROAS Meta in calo, AOV stabile, top product cambia. In 2 minuti so cosa fare.', avatar: 'MC' },
      { name: 'Andrea R.', role: 'Head of Growth, brand DTC', text: 'Il Creative Fatigue mi ha salvato. Avevo 6 ads sopra frequency 4 e bruciavo €800/day per niente. LyftAI me l\'ha detto al terzo giorno.', avatar: 'AR' },
      { name: 'Sara M.', role: 'CMO, fashion D2C', text: 'Il Performance Agent ricorda tutto. Gli ho detto una volta che il MER target è 2.5x — non glielo devo più ripetere. Mi avvisa quando scendiamo sotto.', avatar: 'SM' },
    ],
    faqTitle: { eyebrow: 'FAQ', title: 'Domande comuni' },
    faq: [
      { q: 'Come fa LyftAI a conoscere il mio brand?', a: 'Compili la sezione Brand Identity con descrizione, target, tone of voice, prodotti, brand guard, palette. L\'AI riusa questi dati come system prompt per ogni risposta.' },
      { q: 'I miei dati sono al sicuro?', a: 'Sì. Ogni tenant ha credenziali isolate. I dati Shopify/Meta non vengono mai condivisi tra brand. Crittografia in transito e at-rest.' },
      { q: 'Quanto tempo serve per il setup?', a: '5 minuti. Onboarding guidato: incolli URL store e token API delle 4 integrazioni principali.' },
      { q: 'Come funziona la prova gratuita?', a: 'Ti registri, fai onboarding, hai 14 giorni di accesso completo. Nessuna carta richiesta. Alla scadenza scegli un piano o cancelli.' },
      { q: 'Posso annullare quando voglio?', a: 'Sì. Niente contratti annuali, niente penali. Cancelli dal portale Stripe in 1 click.' },
    ],
    contactTitle: { eyebrow: 'Parliamo', title: 'Richiedi una demo personalizzata' },
    contactSub: 'Ti rispondiamo entro 24h. Niente venditori, parliamo direttamente noi.',
    contactForm: {
      name: 'Nome e cognome', namePlaceholder: 'Mario Rossi',
      company: 'Nome azienda', companyPlaceholder: 'Acme Srl',
      email: 'Email', emailPlaceholder: 'mario@acme.it',
      phone: 'Telefono', phonePlaceholder: '+39 333 1234567',
      website: 'Sito web', websitePlaceholder: 'https://acme.it',
      revenue: 'Fatturato annuo', revenueSelect: '— Seleziona —',
      message: 'Messaggio', messagePlaceholder: 'Raccontaci cosa cerchi, su quali piattaforme sei attivo, e cosa vorresti migliorare...',
      required: 'Compila almeno nome, azienda e email.',
      send: 'Invia richiesta',
      sending: 'Invio in corso…',
      donesubtitle: 'Ti ricontattiamo entro 24h via email.',
      doneTitle: 'Messaggio inviato!',
      disclaimer: 'Premendo invii i dati a Marino Catasta. Nessuna newsletter, nessuno spam.',
    },
    finalCta: { title: 'Smetti di scegliere a sentimento.', sub: 'Connetti il tuo store e in 5 minuti hai un\'AI che conosce i tuoi dati meglio di te.', btn: 'Inizia la prova gratuita →' },
    footer: { tagline: 'AI consultant per brand DTC' },
  },
  en: {
    nav: { features: 'Features', pricing: 'Pricing', contact: 'Contact', login: 'Sign in', cta: 'Free trial' },
    hero: {
      badge: 'Free trial · 14 days',
      title1: 'The AI consultant',
      title2: 'that knows your brand.',
      subtitle: 'Connect Shopify, Meta and Klaviyo in 5 minutes. LyftAI reads your data, learns your brand, and every morning tells you where you\'re burning money and where there\'s growth leverage.',
      ctaPrimary: 'Start free trial',
      ctaSecondary: 'See how it works',
      perks: ['No credit card required', '5-minute setup', 'Cancel anytime'],
    },
    trust: { label: 'Native integrations' },
    problem: {
      eyebrow: 'The problem',
      title: '4 dashboards, 12 spreadsheets, 0 clear answers',
      withoutLabel: 'Without LyftAI',
      withoutList: [
        '6 open dashboards: Shopify, Meta, Klaviyo, GA4, Stripe, Google sheets',
        'Time wasted re-checking if data matches',
        'Anomalies discovered after 3 days of burnt spend',
        'Decisions based on gut feeling, not numbers',
        'External consultants at €3-5k/month with slow turnaround',
      ],
      withLabel: 'With LyftAI',
      withList: [
        '1 centralized dashboard, live KPIs from all platforms',
        'Numbers consolidated and cross-verified automatically',
        'Nightly briefing: anomalies told to you at dawn',
        'Proactive recommendations with expected impact in €',
        'AI advisor that learns your brand and remembers everything',
      ],
    },
    stats: [
      { v: '+34%', l: 'Average ROAS after 60 days' },
      { v: '−22%', l: 'CAC on pilot brands' },
      { v: '5min', l: 'Complete integrations setup' },
      { v: '24/7', l: 'Automatic anomaly briefing' },
    ],
    tabsTour: { eyebrow: 'Complete tour', title: '9 tabs. Everything you need in one software.' },
    tabs: [
      { id: 'dashboard', icon: '◉', title: 'Dashboard', desc: 'Overview with live KPIs, proactive recommendations and anomaly alerts.' },
      { id: 'kpi', icon: '★', title: 'KPI Brain', desc: 'Top products, marketing sources, billing countries. Insights ready.' },
      { id: 'reports', icon: '▦', title: 'Periodic reports', desc: 'Weekly, Monthly, Quarter, Year with period-over-period comparison. PDF export.' },
      { id: 'klaviyo', icon: '✉', title: 'Klaviyo', desc: 'Email revenue, flow KPIs, segments. All in one view.' },
      { id: 'meta', icon: '⊞', title: 'Creative + Meta Detail', desc: 'Ad-level performance, ROAS per campaign, creative analysis.' },
      { id: 'cro', icon: '◇', title: 'CRO + AI Scanner', desc: 'Funnel, top pages, automatic CRO audit via GPT-4o Vision.' },
      { id: 'agent', icon: '✦', title: 'Performance Agent', desc: 'Chat with an AI advisor verticalized on your brand. CMO · CFO · CRO.' },
      { id: 'lab', icon: '✧', title: 'Creative Lab', desc: 'AI generation of ad creatives based on your brand identity.' },
      { id: 'competitor', icon: '◈', title: 'Competitor Intel', desc: 'Catalog, active ads, automatic price comparison.' },
    ],
    featuresTitle: { eyebrow: 'What it does for you', title: '6 tools that change how you manage your brand' },
    features: [
      { icon: '◎', title: 'Real-time Dashboard', desc: 'Core KPIs (Revenue, AOV, MER, CAC, LTV) updated live from Shopify and Meta.' },
      { icon: '✦', title: 'Performance Agent AI', desc: 'AI consultant that speaks YOUR brand. Answers with your real numbers.' },
      { icon: '◐', title: 'Nightly briefing', desc: 'Every morning at 6 the AI has already scanned the data. Open the chat: it already knows what happened.' },
      { icon: '◈', title: 'Competitor Intel', desc: 'Automatic monitoring of active ads, prices and catalogs of your 5 main competitors.' },
      { icon: '⚖', title: 'Budget Advisor', desc: 'Analyzes Meta Ads and suggests where to shift budget to maximize ROAS.' },
      { icon: '⊛', title: 'Creative Fatigue', desc: 'Identifies saturated creatives before they burn budget.' },
    ],
    demoTitle: { eyebrow: 'Data in action', title: 'Example of what you see every day' },
    demoCards: {
      revenue: { eyebrow: '30d Revenue', value: '€84,250', delta: '+24% vs previous period' },
      orders: { eyebrow: 'Orders by channel', value: '1,284', sub: 'Meta is the top channel' },
      briefingTitle: 'Automatic briefing — this morning',
      briefingItems: [
        { icon: '⚠', color: '#f87171', txt: 'Meta ROAS collapsed to 1.4x (vs 2.8x 7d avg)' },
        { icon: '▲', color: '#fbbf24', txt: 'AOV declining for 4 days: 78€ → 71€' },
        { icon: '◆', color: BLUE, txt: 'Top product changes: Premium Grips scaling' },
        { icon: 'ⓘ', color: GREEN, txt: 'Record week: 142 orders (best of month)' },
      ],
      chatTitle: 'Performance Agent — chat',
      chatUser: 'How was the week?',
      chatAi: 'So, MER at {strong}2.6x{/strong} — above the 2.5x target you keep. Solid week. AOV in line, but {strong}Meta CTR is dropping for 3 days{/strong}. Should I look into it?',
    },
    pricingTitle: { eyebrow: 'Pricing', title: 'Choose the right plan for your growth' },
    pricingSub: 'All plans with 14 days free. No credit card required. 1-click cancellation.',
    plans: [
      { id: 'starter', name: 'Starter', price: '€119.99', period: '/month', tagline: 'For founders structuring the first brand', features: ['Core KPI Dashboard', 'Periodic reports', 'Shopify + Meta + GA4 integration', 'Email support 48h'], cta: 'Start with Starter' },
      { id: 'growth', name: 'Growth', price: '€179.99', period: '/month', tagline: 'Scaling brands seeking data-driven leverage', features: ['Everything in Starter +', 'Klaviyo + Meta Ads Creative Tab', 'AI Website Scanner (CRO)', 'Meta Detail ad-level', 'Priority support 12h'], cta: 'Start with Growth', popular: true, popularLabel: 'POPULAR' },
      { id: 'scale', name: 'Scale', price: '€349.99', period: '/month', tagline: '7-8 figure brands with dedicated team', features: ['Everything in Growth +', 'Creative Lab AI generation', 'Competitor Intel', 'Performance Agent AI + Simulator', 'Dedicated CSM'], cta: 'Start with Scale' },
    ],
    testimonialsTitle: { eyebrow: 'What they say about us', title: 'Brands that stopped choosing by gut feeling' },
    testimonials: [
      { name: 'Marino C.', role: 'Founder, STMN Fitness', text: 'Before I had to open 4 dashboards every morning. Now I open the chat and it tells me: Meta ROAS down, AOV stable, top product changing. In 2 minutes I know what to do.', avatar: 'MC' },
      { name: 'Andrea R.', role: 'Head of Growth, DTC brand', text: 'Creative Fatigue saved me. I had 6 ads above frequency 4 and was burning €800/day for nothing. LyftAI told me on day 3.', avatar: 'AR' },
      { name: 'Sara M.', role: 'CMO, fashion D2C', text: 'The Performance Agent remembers everything. I told it once that MER target is 2.5x — never had to repeat it. It alerts me when we drop below.', avatar: 'SM' },
    ],
    faqTitle: { eyebrow: 'FAQ', title: 'Common questions' },
    faq: [
      { q: 'How does LyftAI know my brand?', a: 'You fill the Brand Identity section with description, target, tone of voice, products, brand guard, palette. The AI reuses this data as system prompt for every response.' },
      { q: 'Is my data safe?', a: 'Yes. Each tenant has isolated credentials. Shopify/Meta data is never shared between brands. Encryption in transit and at-rest.' },
      { q: 'How long does setup take?', a: '5 minutes. Guided onboarding: you paste store URL and API tokens of the 4 main integrations.' },
      { q: 'How does the free trial work?', a: 'You sign up, do onboarding, get 14 days of full access. No credit card required. At the end you pick a plan or cancel.' },
      { q: 'Can I cancel anytime?', a: 'Yes. No annual contracts, no penalties. Cancel from the Stripe portal in 1 click.' },
    ],
    contactTitle: { eyebrow: 'Let\'s talk', title: 'Request a personalized demo' },
    contactSub: 'We reply within 24h. No salespeople, you talk directly to us.',
    contactForm: {
      name: 'Full name', namePlaceholder: 'Mario Rossi',
      company: 'Company name', companyPlaceholder: 'Acme Inc',
      email: 'Email', emailPlaceholder: 'mario@acme.com',
      phone: 'Phone', phonePlaceholder: '+39 333 1234567',
      website: 'Website', websitePlaceholder: 'https://acme.com',
      revenue: 'Annual revenue', revenueSelect: '— Select —',
      message: 'Message', messagePlaceholder: 'Tell us what you\'re looking for, which platforms you\'re on, and what you\'d like to improve...',
      required: 'Fill at least name, company and email.',
      send: 'Send request',
      sending: 'Sending…',
      doneTitle: 'Message sent!',
      donesubtitle: 'We\'ll contact you within 24h via email.',
      disclaimer: 'By submitting you send the data to Marino Catasta. No newsletter, no spam.',
    },
    finalCta: { title: 'Stop choosing by gut feeling.', sub: 'Connect your store and in 5 minutes you have an AI that knows your data better than you.', btn: 'Start free trial →' },
    footer: { tagline: 'AI consultant for DTC brands' },
  },
  es: {
    nav: { features: 'Funciones', pricing: 'Precios', contact: 'Contacto', login: 'Acceder', cta: 'Prueba gratis' },
    hero: {
      badge: 'Prueba gratuita · 14 días',
      title1: 'El consultor de IA',
      title2: 'que conoce tu marca.',
      subtitle: 'Conecta Shopify, Meta y Klaviyo en 5 minutos. LyftAI lee tus datos, aprende tu marca, y cada mañana te dice dónde estás quemando dinero y dónde hay palanca de crecimiento.',
      ctaPrimary: 'Iniciar prueba gratuita',
      ctaSecondary: 'Ver cómo funciona',
      perks: ['Sin tarjeta de crédito', 'Configuración en 5 minutos', 'Cancela cuando quieras'],
    },
    trust: { label: 'Integraciones nativas' },
    problem: {
      eyebrow: 'El problema',
      title: '4 dashboards, 12 hojas de cálculo, 0 respuestas claras',
      withoutLabel: 'Sin LyftAI',
      withoutList: [
        '6 dashboards abiertos: Shopify, Meta, Klaviyo, GA4, Stripe, hojas Google',
        'Tiempo perdido verificando que los datos coincidan',
        'Anomalías descubiertas después de 3 días de gasto quemado',
        'Decisiones basadas en intuición, no en números',
        'Consultores externos a €3-5k/mes con respuesta lenta',
      ],
      withLabel: 'Con LyftAI',
      withList: [
        '1 dashboard centralizado, KPIs en vivo de todas las plataformas',
        'Números consolidados y verificados automáticamente',
        'Briefing nocturno: la anomalía te la dice al amanecer',
        'Recomendaciones proactivas con impacto esperado en €',
        'Asesor IA que aprende tu marca y recuerda todo',
      ],
    },
    stats: [
      { v: '+34%', l: 'ROAS promedio después de 60 días' },
      { v: '−22%', l: 'CAC en marcas piloto' },
      { v: '5min', l: 'Configuración completa integraciones' },
      { v: '24/7', l: 'Briefing automático de anomalías' },
    ],
    tabsTour: { eyebrow: 'Tour completo', title: '9 pestañas. Todo lo que necesitas en un software.' },
    tabs: [
      { id: 'dashboard', icon: '◉', title: 'Dashboard', desc: 'Vista general con KPIs en vivo, recomendaciones proactivas y alertas de anomalías.' },
      { id: 'kpi', icon: '★', title: 'KPI Brain', desc: 'Top productos, fuentes de marketing, países de facturación. Insights listos.' },
      { id: 'reports', icon: '▦', title: 'Reportes periódicos', desc: 'Semanal, Mensual, Trimestral, Anual con comparación período sobre período. Exporte PDF.' },
      { id: 'klaviyo', icon: '✉', title: 'Klaviyo', desc: 'Revenue email, KPIs de flujos, segmentos. Todo en una vista.' },
      { id: 'meta', icon: '⊞', title: 'Creative + Meta Detail', desc: 'Performance ad-level, ROAS por campaña, análisis creativo.' },
      { id: 'cro', icon: '◇', title: 'CRO + AI Scanner', desc: 'Embudo, top páginas, auditoría CRO automática vía GPT-4o Vision.' },
      { id: 'agent', icon: '✦', title: 'Performance Agent', desc: 'Chat con un asesor IA verticalizado en tu marca. CMO · CFO · CRO.' },
      { id: 'lab', icon: '✧', title: 'Creative Lab', desc: 'Generación IA de creatividades publicitarias basadas en tu brand identity.' },
      { id: 'competitor', icon: '◈', title: 'Competitor Intel', desc: 'Catálogo, ads activos, comparación de precios automática.' },
    ],
    featuresTitle: { eyebrow: 'Qué hace por ti', title: '6 herramientas que cambian cómo gestionas tu marca' },
    features: [
      { icon: '◎', title: 'Dashboard en tiempo real', desc: 'KPIs core (Revenue, AOV, MER, CAC, LTV) actualizados en vivo desde Shopify y Meta.' },
      { icon: '✦', title: 'Performance Agent AI', desc: 'Consultor IA que habla de TU marca. Responde con tus números reales.' },
      { icon: '◐', title: 'Briefing nocturno', desc: 'Cada mañana a las 6 la IA ya escaneó los datos. Abre el chat: ya sabe qué pasó.' },
      { icon: '◈', title: 'Competitor Intel', desc: 'Monitoreo automático ads activos, precios y catálogos de tus 5 competidores principales.' },
      { icon: '⚖', title: 'Budget Advisor', desc: 'Analiza Meta Ads y sugiere dónde mover budget para maximizar ROAS.' },
      { icon: '⊛', title: 'Creative Fatigue', desc: 'Identifica creatividades saturadas antes de que quemen budget.' },
    ],
    demoTitle: { eyebrow: 'Datos en acción', title: 'Ejemplo de lo que ves cada día' },
    demoCards: {
      revenue: { eyebrow: 'Revenue 30d', value: '€84.250', delta: '+24% vs período anterior' },
      orders: { eyebrow: 'Pedidos por canal', value: '1.284', sub: 'Meta es el top channel' },
      briefingTitle: 'Briefing automático — esta mañana',
      briefingItems: [
        { icon: '⚠', color: '#f87171', txt: 'ROAS Meta colapsó a 1.4x (vs 2.8x media 7d)' },
        { icon: '▲', color: '#fbbf24', txt: 'AOV bajando desde 4 días: 78€ → 71€' },
        { icon: '◆', color: BLUE, txt: 'Top product cambia: Premium Grips escala' },
        { icon: 'ⓘ', color: GREEN, txt: 'Semana récord: 142 pedidos (mejor del mes)' },
      ],
      chatTitle: 'Performance Agent — chat',
      chatUser: '¿Cómo fue la semana?',
      chatAi: 'Entonces, MER en {strong}2,6x{/strong} — por encima del target 2,5x que tienes. Semana sólida. AOV en línea, pero el {strong}CTR Meta baja desde 3 días{/strong}. ¿Lo reviso?',
    },
    pricingTitle: { eyebrow: 'Precios', title: 'Elige el plan adecuado para tu crecimiento' },
    pricingSub: 'Todos los planes con 14 días gratis. Sin tarjeta. Cancelación en 1 click.',
    plans: [
      { id: 'starter', name: 'Starter', price: '€119,99', period: '/mes', tagline: 'Para founders estructurando la primera marca', features: ['Dashboard KPI core', 'Reportes periódicos', 'Integración Shopify + Meta + GA4', 'Email support 48h'], cta: 'Iniciar con Starter' },
      { id: 'growth', name: 'Growth', price: '€179,99', period: '/mes', tagline: 'Marcas en scaling que buscan palanca data-driven', features: ['Todo de Starter +', 'Klaviyo + Creative Tab Meta Ads', 'AI Website Scanner (CRO)', 'Meta Detail ad-level', 'Priority support 12h'], cta: 'Iniciar con Growth', popular: true, popularLabel: 'POPULAR' },
      { id: 'scale', name: 'Scale', price: '€349,99', period: '/mes', tagline: 'Marcas 7-8 figuras con equipo dedicado', features: ['Todo de Growth +', 'Creative Lab AI generation', 'Competitor Intel', 'Performance Agent AI + Simulador', 'CSM dedicado'], cta: 'Iniciar con Scale' },
    ],
    testimonialsTitle: { eyebrow: 'Qué dicen de nosotros', title: 'Marcas que dejaron de elegir por intuición' },
    testimonials: [
      { name: 'Marino C.', role: 'Founder, STMN Fitness', text: 'Antes tenía que abrir 4 dashboards cada mañana. Ahora abro el chat y me dice: ROAS Meta cayendo, AOV estable, top product cambiando. En 2 minutos sé qué hacer.', avatar: 'MC' },
      { name: 'Andrea R.', role: 'Head of Growth, marca DTC', text: 'El Creative Fatigue me salvó. Tenía 6 ads sobre frequency 4 y quemaba €800/día por nada. LyftAI me lo dijo al tercer día.', avatar: 'AR' },
      { name: 'Sara M.', role: 'CMO, fashion D2C', text: 'El Performance Agent recuerda todo. Le dije una vez que el MER target es 2.5x — no se lo tengo que repetir. Me avisa cuando bajamos.', avatar: 'SM' },
    ],
    faqTitle: { eyebrow: 'FAQ', title: 'Preguntas comunes' },
    faq: [
      { q: '¿Cómo conoce LyftAI mi marca?', a: 'Llenas la sección Brand Identity con descripción, target, tone of voice, productos, brand guard, paleta. La IA reusa estos datos como system prompt para cada respuesta.' },
      { q: '¿Mis datos están seguros?', a: 'Sí. Cada tenant tiene credenciales aisladas. Los datos Shopify/Meta nunca se comparten entre marcas. Encriptación en tránsito y at-rest.' },
      { q: '¿Cuánto tarda la configuración?', a: '5 minutos. Onboarding guiado: pegas URL store y tokens API de las 4 integraciones principales.' },
      { q: '¿Cómo funciona la prueba gratuita?', a: 'Te registras, haces onboarding, tienes 14 días de acceso completo. Sin tarjeta. Al final eliges un plan o cancelas.' },
      { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. Sin contratos anuales, sin penalidades. Cancela desde el portal Stripe en 1 click.' },
    ],
    contactTitle: { eyebrow: 'Hablemos', title: 'Solicita una demo personalizada' },
    contactSub: 'Respondemos en 24h. Sin vendedores, hablas directamente con nosotros.',
    contactForm: {
      name: 'Nombre completo', namePlaceholder: 'Mario Rossi',
      company: 'Nombre empresa', companyPlaceholder: 'Acme S.L.',
      email: 'Email', emailPlaceholder: 'mario@acme.es',
      phone: 'Teléfono', phonePlaceholder: '+34 666 123456',
      website: 'Sitio web', websitePlaceholder: 'https://acme.es',
      revenue: 'Facturación anual', revenueSelect: '— Seleccionar —',
      message: 'Mensaje', messagePlaceholder: 'Cuéntanos qué buscas, en qué plataformas estás, y qué te gustaría mejorar...',
      required: 'Completa al menos nombre, empresa y email.',
      send: 'Enviar solicitud',
      sending: 'Enviando…',
      doneTitle: '¡Mensaje enviado!',
      donesubtitle: 'Te contactaremos en 24h vía email.',
      disclaimer: 'Al enviar mandas los datos a Marino Catasta. Sin newsletter, sin spam.',
    },
    finalCta: { title: 'Deja de elegir por intuición.', sub: 'Conecta tu store y en 5 minutos tienes una IA que conoce tus datos mejor que tú.', btn: 'Iniciar prueba gratuita →' },
    footer: { tagline: 'AI consultant para marcas DTC' },
  },
}

const LANG_LABELS = { it: 'IT', en: 'EN', es: 'ES' }

// ─────────────────────────────────────────────────────────────
//  Page
// ─────────────────────────────────────────────────────────────
export default function WelcomePage() {
  const [lang, setLang] = useState('it')

  // Persisti scelta lingua in localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('lyftai_lang')
    if (saved && I18N[saved]) setLang(saved)
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('lyftai_lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  const t = I18N[lang]

  return (
    <div style={{
      minHeight: '100vh', background: '#000', color: '#fff',
      fontFamily: 'inherit', overflowX: 'hidden', position: 'relative',
      WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale',
    }}>
      <Styles />
      <BgFx />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Nav t={t} lang={lang} setLang={setLang} />
        <Hero t={t} />
        <TrustBar t={t} />
        <ProblemSolution t={t} />
        <StatsRow t={t} />
        <TabsTour t={t} />
        <FeaturesGrid t={t} />
        <DemoCharts t={t} />
        <Pricing t={t} />
        <Testimonials t={t} />
        <Faq t={t} />
        <ContactForm t={t} lang={lang} />
        <FinalCta t={t} />
        <Footer t={t} />
      </div>
    </div>
  )
}

function Styles() {
  return (
    <style>{`
      @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes zoomIn { from { opacity: 0; transform: scale(0.85) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      @keyframes pulseDot { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }
      @keyframes shineFlow { 0% { background-position: 200% 50%; } 100% { background-position: -200% 50%; } }
      @keyframes barRise { from { transform: scaleY(0); transform-origin: bottom; } to { transform: scaleY(1); transform-origin: bottom; } }
      @keyframes lineDraw { from { stroke-dashoffset: 1000; } to { stroke-dashoffset: 0; } }

      /* Orbs di sfondo che vagano lentamente — effetto futurista */
      @keyframes orbDrift1 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        25%      { transform: translate(15vw, -8vh) scale(1.15); }
        50%      { transform: translate(8vw, 12vh) scale(0.95); }
        75%      { transform: translate(-10vw, 5vh) scale(1.05); }
      }
      @keyframes orbDrift2 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33%      { transform: translate(-12vw, 10vh) scale(1.2); }
        66%      { transform: translate(14vw, -6vh) scale(0.9); }
      }
      @keyframes orbDrift3 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50%      { transform: translate(20vw, -15vh) scale(1.3); }
      }
      @keyframes gridShift { 0% { background-position: 0 0; } 100% { background-position: 80px 80px; } }

      /* Logo */
      @keyframes logoSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      @keyframes logoGlow {
        0%, 100% { filter: drop-shadow(0 0 18px ${ACCENT}88) drop-shadow(0 0 50px ${BLUE}55); }
        50%      { filter: drop-shadow(0 0 30px ${ACCENT}aa) drop-shadow(0 0 70px ${BLUE}77); }
      }

      /* Reveal variants */
      .reveal { opacity: 0; transform: translateY(40px); transition: opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1); }
      .reveal.in { opacity: 1; transform: translateY(0); }
      .reveal-zoom { opacity: 0; transform: scale(0.85); transition: opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1); }
      .reveal-zoom.in { opacity: 1; transform: scale(1); }
      .reveal-blur { opacity: 0; filter: blur(14px); transform: translateY(20px); transition: opacity 1.1s, filter 1.1s, transform 1.1s; }
      .reveal-blur.in { opacity: 1; filter: blur(0); transform: translateY(0); }

      /* Parallax — JS-driven via CSS var */
      .parallax-slow { transform: translateY(calc(var(--scrollY, 0) * -0.15px)); will-change: transform; }
      .parallax-mid  { transform: translateY(calc(var(--scrollY, 0) * -0.30px)); will-change: transform; }
      .parallax-fast { transform: translateY(calc(var(--scrollY, 0) * -0.50px)); will-change: transform; }

      /* Hero scroll-driven scale + opacity */
      .hero-scale {
        transform: scale(var(--heroScale, 1)) translateY(calc(var(--scrollY, 0) * -0.20px));
        opacity: var(--heroOpacity, 1);
        will-change: transform, opacity;
      }

      .shine-text {
        background: linear-gradient(90deg, #fff 0%, ${ACCENT} 35%, ${BLUE} 65%, #fff 100%);
        background-size: 200% 100%;
        -webkit-background-clip: text; background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: shineFlow 8s linear infinite;
      }
      .grid-bg::before {
        content: ''; position: absolute; inset: 0;
        background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
        background-size: 80px 80px;
        mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
        -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
        pointer-events: none;
        animation: gridShift 60s linear infinite;
      }
      .cta-btn { transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s; }
      .cta-btn:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 35px 80px rgba(191,90,242,0.50); }

      .logo-mark-outer { animation: logoGlow 4s ease-in-out infinite; }
      .logo-ring { animation: logoSpin 20s linear infinite; transform-origin: center; transform-box: fill-box; }

      html { scroll-behavior: smooth; }
    `}</style>
  )
}

function BgFx() {
  // Mouse parallax: il background reagisce leggermente al movimento del cursore
  const wrapRef = useRef(null)
  useEffect(() => {
    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      if (wrapRef.current) {
        wrapRef.current.style.setProperty('--mx', `${x * 20}px`)
        wrapRef.current.style.setProperty('--my', `${y * 20}px`)
      }
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {/* Solid black base */}
      <div style={{ position: 'absolute', inset: 0, background: '#000' }} />

      {/* Orbs floating — 3 con animazioni indipendenti */}
      <div style={{
        position: 'absolute', top: '-10%', left: '5%',
        width: 600, height: 600, borderRadius: '50%',
        background: `radial-gradient(circle, ${ACCENT}55, ${ACCENT}11 40%, transparent 70%)`,
        filter: 'blur(40px)',
        animation: 'orbDrift1 28s ease-in-out infinite',
        transform: 'translate(var(--mx, 0), var(--my, 0))',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '0%',
        width: 700, height: 700, borderRadius: '50%',
        background: `radial-gradient(circle, ${BLUE}55, ${BLUE}11 40%, transparent 70%)`,
        filter: 'blur(40px)',
        animation: 'orbDrift2 34s ease-in-out infinite',
        transform: 'translate(calc(var(--mx, 0) * -1), calc(var(--my, 0) * -1))',
      }} />
      <div style={{
        position: 'absolute', top: '40%', left: '50%',
        width: 500, height: 500, borderRadius: '50%',
        background: `radial-gradient(circle, ${GREEN}33, transparent 70%)`,
        filter: 'blur(50px)',
        animation: 'orbDrift3 40s ease-in-out infinite',
        transform: 'translate(calc(var(--mx, 0) * 0.5), var(--my, 0))',
      }} />

      {/* Grid overlay con shift animation */}
      <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />

      {/* Vignette nei bordi */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)',
      }} />
    </div>
  )
}

function Reveal({ children, delay = 0, style, variant = '' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setVisible(true) })
    }, { threshold: 0.12 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  const baseClass = variant === 'zoom' ? 'reveal-zoom' : variant === 'blur' ? 'reveal-blur' : 'reveal'
  return (
    <div ref={ref} className={`${baseClass} ${visible ? 'in' : ''}`} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  )
}

// LogoMark importato dal componente condiviso — stesso usato in VendroShell sidebar

// ─────────────────────────────────────────────────────────────
//  Nav with language picker
// ─────────────────────────────────────────────────────────────
function Nav({ t, lang, setLang }) {
  const [openLang, setOpenLang] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpenLang(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      backdropFilter: 'blur(24px) saturate(2)', WebkitBackdropFilter: 'blur(24px) saturate(2)',
      background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '18px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/welcome" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <LogoMark size={32} />
          <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>LyftAI</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="#features" style={navLinkStyle}>{t.nav.features}</a>
          <a href="#pricing" style={navLinkStyle}>{t.nav.pricing}</a>
          <a href="#contact" style={navLinkStyle}>{t.nav.contact}</a>

          <div ref={ref} style={{ position: 'relative' }}>
            <button onClick={() => setOpenLang(o => !o)} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#fff', borderRadius: 8, padding: '6px 12px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <span>🌐</span> {LANG_LABELS[lang]}
              <span style={{ fontSize: 8, opacity: 0.6 }}>▾</span>
            </button>
            {openLang && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                background: 'rgba(10,10,22,0.98)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10,
                padding: 5, minWidth: 100,
                boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              }}>
                {Object.keys(I18N).map(code => (
                  <button key={code} onClick={() => { setLang(code); setOpenLang(false) }} style={{
                    width: '100%', textAlign: 'left',
                    background: lang === code ? `${ACCENT}22` : 'transparent',
                    border: 'none', color: '#fff', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, padding: '8px 12px',
                    borderRadius: 7, display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    {lang === code ? '✓' : ' '} {LANG_LABELS[code]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link href="/login" style={navLinkStyle}>{t.nav.login}</Link>
          <Link href="/register" className="cta-btn" style={{
            padding: '9px 16px', borderRadius: 10,
            background: `linear-gradient(135deg, ${ACCENT}, ${BLUE})`,
            color: '#fff', textDecoration: 'none',
            fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em',
            boxShadow: '0 10px 30px rgba(191,90,242,0.25)',
          }}>{t.nav.cta}</Link>
        </div>
      </div>
    </header>
  )
}
const navLinkStyle = { color: 'rgba(255,255,255,0.65)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }

// ─────────────────────────────────────────────────────────────
//  Hero — Apple-style massiccio
// ─────────────────────────────────────────────────────────────
function Hero({ t }) {
  // Scroll-driven scale + parallax sul titolo Hero
  const heroRef = useRef(null)
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      if (!heroRef.current) return
      // Scale: 1 fino a 0px, scende a 0.85 a 600px
      const scale = Math.max(0.85, 1 - y / 4000)
      const opacity = Math.max(0, 1 - y / 600)
      heroRef.current.style.setProperty('--scrollY', String(y))
      heroRef.current.style.setProperty('--heroScale', String(scale))
      heroRef.current.style.setProperty('--heroOpacity', String(opacity))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <section ref={heroRef} style={{
      minHeight: '95vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px 80px', textAlign: 'center', position: 'relative',
    }}>
      <div className="hero-scale" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Logo gigante animato in alto */}
        <Reveal variant="zoom">
          <div style={{ marginBottom: 28 }}>
            <LogoMark size={104} />
          </div>
        </Reveal>

        <Reveal>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 18px', borderRadius: 999,
            background: `linear-gradient(90deg, ${GREEN}22, ${ACCENT}18)`,
            border: `1px solid ${GREEN}55`,
            fontSize: 12, fontWeight: 800, color: '#fff',
            letterSpacing: '0.10em', textTransform: 'uppercase',
            marginBottom: 32,
            boxShadow: `0 10px 40px ${GREEN}22`,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: GREEN, animation: 'pulseDot 2s infinite' }} />
            {t.hero.badge}
          </div>
        </Reveal>

        <Reveal variant="blur" delay={150}>
          <h1 style={{
            fontSize: 'clamp(48px, 9vw, 120px)',
            fontWeight: 900, letterSpacing: '-0.055em', lineHeight: 0.95,
            margin: 0, marginBottom: 28, maxWidth: 1100,
          }}>
            <span className="shine-text">{t.hero.title1}</span><br />
            <span style={{ color: 'rgba(255,255,255,0.95)' }}>{t.hero.title2}</span>
          </h1>
        </Reveal>

        <Reveal delay={300}>
          <p style={{
            fontSize: 'clamp(17px, 1.7vw, 22px)',
            color: 'rgba(255,255,255,0.7)', lineHeight: 1.5,
            maxWidth: 780, margin: '0 auto 44px',
          }}>{t.hero.subtitle}</p>
        </Reveal>

        <Reveal variant="zoom" delay={450}>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="cta-btn" style={primaryCta}>{t.hero.ctaPrimary} →</Link>
            <a href="#tabs-tour" style={secondaryCta}>{t.hero.ctaSecondary}</a>
          </div>
          <div style={{
            marginTop: 32, fontSize: 12.5, color: 'rgba(255,255,255,0.5)',
            display: 'flex', justifyContent: 'center', gap: 22, flexWrap: 'wrap',
          }}>
            {t.hero.perks.map((p, i) => <span key={i}>✓ {p}</span>)}
          </div>
        </Reveal>
      </div>

      {/* Scroll indicator */}
      <div style={{
        position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        opacity: 0.5, animation: 'pulseDot 2.5s infinite',
      }}>
        <div style={{ fontSize: 10, color: '#fff', letterSpacing: '0.20em', textTransform: 'uppercase', fontWeight: 700 }}>Scroll</div>
        <div style={{
          width: 22, height: 36, borderRadius: 11,
          border: '1.5px solid rgba(255,255,255,0.30)',
          display: 'grid', placeItems: 'center',
        }}>
          <div style={{
            width: 3, height: 8, borderRadius: 2, background: '#fff',
            animation: 'fadeUp 1.5s ease-in-out infinite',
          }} />
        </div>
      </div>
    </section>
  )
}
const primaryCta = {
  padding: '16px 32px', borderRadius: 999,
  background: `linear-gradient(135deg, ${ACCENT}, ${BLUE})`,
  color: '#fff', textDecoration: 'none',
  fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em',
  boxShadow: '0 20px 50px rgba(191,90,242,0.35)',
  display: 'inline-block',
}
const secondaryCta = {
  padding: '16px 32px', borderRadius: 999,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', textDecoration: 'none',
  fontSize: 15, fontWeight: 800,
}

function TrustBar({ t }) {
  return (
    <Reveal>
      <section style={{
        maxWidth: 1080, margin: '0 auto', padding: '20px 24px 80px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.20em', textTransform: 'uppercase' }}>
          {t.trust.label}
        </div>
        {['Shopify', 'Meta Ads', 'Klaviyo', 'GA4', 'Stripe'].map(name => (
          <div key={name} style={{
            padding: '8px 16px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.65)',
          }}>{name}</div>
        ))}
      </section>
    </Reveal>
  )
}

function ProblemSolution({ t }) {
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 100px' }}>
      <Reveal><SectionHeader eyebrow={t.problem.eyebrow} title={t.problem.title} /></Reveal>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20, marginTop: 50,
      }}>
        <Reveal>
          <div className="glass-card-static" style={{ padding: 30, borderLeft: '3px solid #f87171', height: '100%' }}>
            <div style={{ fontSize: 11, color: '#f87171', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 18 }}>
              {t.problem.withoutLabel}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {t.problem.withoutList.map(it => (
                <li key={it} style={{ display: 'flex', gap: 12, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
                  <span style={{ color: '#f87171', fontWeight: 900, fontSize: 14, flexShrink: 0, lineHeight: 1.5 }}>✕</span>
                  {it}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <div className="glass-card-static" style={{ padding: 30, borderLeft: `3px solid ${GREEN}`, height: '100%' }}>
            <div style={{ fontSize: 11, color: GREEN, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 18 }}>
              {t.problem.withLabel}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {t.problem.withList.map(it => (
                <li key={it} style={{ display: 'flex', gap: 12, fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>
                  <span style={{ color: GREEN, fontWeight: 900, fontSize: 14, flexShrink: 0, lineHeight: 1.5 }}>✓</span>
                  {it}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function StatsRow({ t }) {
  const colors = [GREEN, BLUE, ACCENT, '#fbbf24']
  return (
    <Reveal>
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 100px' }}>
        <div className="glass-card-static" style={{
          padding: '36px 30px',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 32,
        }}>
          {t.stats.map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 42, fontWeight: 900, letterSpacing: '-0.03em',
                color: colors[i], lineHeight: 1, marginBottom: 8,
              }}>{s.v}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>
    </Reveal>
  )
}

function TabsTour({ t }) {
  return (
    <section id="tabs-tour" style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 100px' }}>
      <Reveal><SectionHeader eyebrow={t.tabsTour.eyebrow} title={t.tabsTour.title} /></Reveal>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 50,
      }}>
        {t.tabs.map((tab, i) => (
          <Reveal key={tab.id} delay={i * 50}>
            <div className="glass-card-static" style={{ padding: 24, height: '100%' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 42, height: 42, borderRadius: 11,
                background: `${ACCENT}18`, color: ACCENT,
                fontSize: 17, fontWeight: 800, marginBottom: 14,
              }}>{tab.icon}</span>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8, letterSpacing: '-0.01em' }}>
                {tab.title}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{tab.desc}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function FeaturesGrid({ t }) {
  return (
    <section id="features" style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 100px' }}>
      <Reveal><SectionHeader eyebrow={t.featuresTitle.eyebrow} title={t.featuresTitle.title} /></Reveal>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 18, marginTop: 50,
      }}>
        {t.features.map((f, i) => (
          <Reveal key={f.title} delay={i * 80}>
            <div className="glass-card-static" style={{ padding: 28, height: '100%' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 52, height: 52, borderRadius: 14,
                background: `linear-gradient(135deg, ${ACCENT}28, ${BLUE}18)`,
                border: `1px solid ${ACCENT}44`,
                color: ACCENT, fontSize: 22, fontWeight: 800, marginBottom: 18,
              }}>{f.icon}</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 10, letterSpacing: '-0.01em' }}>
                {f.title}
              </div>
              <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>{f.desc}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function DemoCharts({ t }) {
  const renderChat = (txt) => {
    const parts = txt.split(/(\{strong\}.*?\{\/strong\})/)
    return parts.map((p, i) => {
      const m = p.match(/^\{strong\}(.*)\{\/strong\}$/)
      if (m) return <strong key={i} style={{ color: '#fff' }}>{m[1]}</strong>
      return <span key={i}>{p}</span>
    })
  }
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 100px' }}>
      <Reveal><SectionHeader eyebrow={t.demoTitle.eyebrow} title={t.demoTitle.title} /></Reveal>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 18, marginTop: 50,
      }}>
        <Reveal>
          <div className="glass-card-static" style={{ padding: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 11, color: GREEN, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  {t.demoCards.revenue.eyebrow}
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, marginTop: 6, letterSpacing: '-0.02em' }}>{t.demoCards.revenue.value}</div>
                <div style={{ fontSize: 12, color: GREEN, marginTop: 4 }}>{t.demoCards.revenue.delta}</div>
              </div>
              <span style={{ fontSize: 26 }}>📈</span>
            </div>
            <MockLineChart />
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="glass-card-static" style={{ padding: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 11, color: BLUE, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  {t.demoCards.orders.eyebrow}
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, marginTop: 6, letterSpacing: '-0.02em' }}>{t.demoCards.orders.value}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{t.demoCards.orders.sub}</div>
              </div>
              <span style={{ fontSize: 26 }}>🛒</span>
            </div>
            <MockBarChart />
          </div>
        </Reveal>
        <Reveal>
          <div className="glass-card-static" style={{ padding: 26 }}>
            <div style={{ fontSize: 11, color: ACCENT, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>
              {t.demoCards.briefingTitle}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {t.demoCards.briefingItems.map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  borderLeft: `3px solid ${a.color}`,
                  fontSize: 13, color: 'rgba(255,255,255,0.88)',
                }}>
                  <span style={{ color: a.color, fontWeight: 900 }}>{a.icon}</span>
                  {a.txt}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="glass-card-static" style={{ padding: 26 }}>
            <div style={{ fontSize: 11, color: ACCENT, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>
              {t.demoCards.chatTitle}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ alignSelf: 'flex-end', maxWidth: '85%', padding: '11px 16px', borderRadius: 16, background: `${ACCENT}30`, border: `1px solid ${ACCENT}55`, fontSize: 13 }}>
                {t.demoCards.chatUser}
              </div>
              <div style={{ alignSelf: 'flex-start', maxWidth: '92%', padding: '11px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, lineHeight: 1.55 }}>
                {renderChat(t.demoCards.chatAi)}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function MockLineChart() {
  const points = [40, 55, 48, 70, 62, 85, 75, 92, 88, 110, 100, 125]
  const max = Math.max(...points)
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 100
    const y = 100 - (p / max) * 80
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: 150 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="grad-line" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GREEN} stopOpacity="0.35" />
          <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L 100 100 L 0 100 Z`} fill="url(#grad-line)" />
      <path d={path} fill="none" stroke={GREEN} strokeWidth="0.9"
            strokeDasharray="1000" style={{ animation: 'lineDraw 2.5s ease-out forwards' }} />
    </svg>
  )
}

function MockBarChart() {
  const bars = [
    { label: 'Meta', val: 70, color: BLUE },
    { label: 'Direct', val: 50, color: ACCENT },
    { label: 'Klaviyo', val: 35, color: GREEN },
    { label: 'Google', val: 22, color: '#fbbf24' },
    { label: 'Other', val: 12, color: 'rgba(255,255,255,0.4)' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150, padding: '0 4px' }}>
      {bars.map((b, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
            <div style={{
              width: '100%', height: `${b.val}%`,
              background: `linear-gradient(to top, ${b.color}, ${b.color}77)`,
              borderRadius: '6px 6px 0 0',
              animation: `barRise 1.1s cubic-bezier(0.16,1,0.3,1) ${i * 0.08}s backwards`,
            }} />
          </div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>{b.label}</div>
        </div>
      ))}
    </div>
  )
}

function Pricing({ t }) {
  const planAccents = ['#0ea5e9', ACCENT, GREEN]
  return (
    <section id="pricing" style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 100px' }}>
      <Reveal>
        <SectionHeader eyebrow={t.pricingTitle.eyebrow} title={t.pricingTitle.title} />
        <p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 14 }}>
          {t.pricingSub}
        </p>
      </Reveal>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
        gap: 20, maxWidth: 1000, margin: '50px auto 0',
      }}>
        {t.plans.map((p, i) => (
          <Reveal key={p.id} delay={i * 120}>
            <div className="glass-card-static" style={{
              padding: 30, position: 'relative', height: '100%',
              ...(p.popular && {
                borderTop: `2px solid ${planAccents[i]}`,
                boxShadow: `0 30px 80px rgba(0,0,0,0.80), 0 0 80px ${planAccents[i]}22, inset 0 1.5px 0 ${planAccents[i]}88`,
              }),
            }}>
              {p.popular && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  padding: '4px 14px', borderRadius: 999,
                  background: planAccents[i], color: '#fff',
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
                }}>{p.popularLabel}</div>
              )}
              <div style={{ fontSize: 12, color: planAccents[i], fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                {p.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14, marginBottom: 10 }}>
                <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em' }}>{p.price}</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{p.period}</span>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 24, minHeight: 38 }}>{p.tagline}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 26 }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 11, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                    <span style={{ color: planAccents[i], fontWeight: 800, fontSize: 14, lineHeight: 1.4 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="cta-btn" style={{
                display: 'block', textAlign: 'center',
                padding: '13px 18px', borderRadius: 999,
                background: p.popular ? `linear-gradient(135deg, ${ACCENT}, ${BLUE})` : 'rgba(255,255,255,0.06)',
                border: p.popular ? 'none' : '1px solid rgba(255,255,255,0.12)',
                color: '#fff', textDecoration: 'none',
                fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.01em',
              }}>{p.cta}</Link>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Testimonials({ t }) {
  const bgs = [ACCENT, BLUE, GREEN]
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 100px' }}>
      <Reveal><SectionHeader eyebrow={t.testimonialsTitle.eyebrow} title={t.testimonialsTitle.title} /></Reveal>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 20, marginTop: 50,
      }}>
        {t.testimonials.map((tm, i) => (
          <Reveal key={i} delay={i * 100}>
            <div className="glass-card-static" style={{ padding: 28, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 32, color: ACCENT, marginBottom: 12, lineHeight: 1, fontWeight: 900 }}>"</div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.55, flex: 1, margin: 0, marginBottom: 20 }}>
                {tm.text}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  width: 44, height: 44, borderRadius: '50%',
                  display: 'grid', placeItems: 'center',
                  background: `linear-gradient(135deg, ${bgs[i]}, ${bgs[i]}88)`,
                  color: '#fff', fontWeight: 800, fontSize: 13,
                }}>{tm.avatar}</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>{tm.name}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>{tm.role}</div>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Faq({ t }) {
  const [open, setOpen] = useState(0)
  return (
    <section style={{ maxWidth: 820, margin: '0 auto', padding: '80px 24px 100px' }}>
      <Reveal><SectionHeader eyebrow={t.faqTitle.eyebrow} title={t.faqTitle.title} /></Reveal>
      <div style={{ marginTop: 50, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {t.faq.map((f, i) => (
          <Reveal key={i} delay={i * 60}>
            <div className="glass-card-static" style={{ padding: 0, overflow: 'hidden' }}>
              <button onClick={() => setOpen(open === i ? -1 : i)} style={{
                width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '20px 24px', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff' }}>{f.q}</span>
                <span style={{
                  fontSize: 22, color: 'rgba(255,255,255,0.5)',
                  transition: 'transform .25s', transform: open === i ? 'rotate(45deg)' : 'rotate(0)',
                }}>+</span>
              </button>
              {open === i && (
                <div style={{
                  padding: '0 24px 22px', fontSize: 13.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6,
                  borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 16,
                }}>{f.a}</div>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function ContactForm({ t, lang }) {
  const [data, setData] = useState({
    name: '', company: '', email: '', phone: '', website: '', revenue: '', message: '',
  })
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setData(d => ({ ...d, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!data.name || !data.email || !data.company) {
      setError(t.contactForm.required)
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, lang }),
      })
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error || `HTTP ${res.status}`)
      setDone(true)
    } catch (e) {
      setError(e?.message || 'Error')
    } finally {
      setSending(false)
    }
  }

  const cf = t.contactForm

  return (
    <section id="contact" style={{ maxWidth: 880, margin: '0 auto', padding: '80px 24px 100px' }}>
      <Reveal>
        <SectionHeader eyebrow={t.contactTitle.eyebrow} title={t.contactTitle.title} />
        <p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 14 }}>
          {t.contactSub}
        </p>
      </Reveal>
      <Reveal delay={150}>
        <div className="glass-card-static" style={{ padding: 32, marginTop: 50 }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 16, color: GREEN }}>✓</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 10, letterSpacing: '-0.02em' }}>
                {cf.doneTitle}
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', marginBottom: 0 }}>
                {cf.donesubtitle}
              </p>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <FormField label={cf.name} required>
                  <input type="text" value={data.name} onChange={e => set('name', e.target.value)} placeholder={cf.namePlaceholder} style={inputStyle} required />
                </FormField>
                <FormField label={cf.company} required>
                  <input type="text" value={data.company} onChange={e => set('company', e.target.value)} placeholder={cf.companyPlaceholder} style={inputStyle} required />
                </FormField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <FormField label={cf.email} required>
                  <input type="email" value={data.email} onChange={e => set('email', e.target.value)} placeholder={cf.emailPlaceholder} style={inputStyle} required />
                </FormField>
                <FormField label={cf.phone}>
                  <input type="tel" value={data.phone} onChange={e => set('phone', e.target.value)} placeholder={cf.phonePlaceholder} style={inputStyle} />
                </FormField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <FormField label={cf.website}>
                  <input type="text" value={data.website} onChange={e => set('website', e.target.value)} placeholder={cf.websitePlaceholder} style={inputStyle} />
                </FormField>
                <FormField label={cf.revenue}>
                  <select value={data.revenue} onChange={e => set('revenue', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">{cf.revenueSelect}</option>
                    <option value="<100k">&lt; €100k</option>
                    <option value="100k-500k">€100k – €500k</option>
                    <option value="500k-1M">€500k – €1M</option>
                    <option value="1M-5M">€1M – €5M</option>
                    <option value="5M+">€5M+</option>
                  </select>
                </FormField>
              </div>
              <FormField label={cf.message}>
                <textarea value={data.message} onChange={e => set('message', e.target.value)} rows={4} placeholder={cf.messagePlaceholder} style={{ ...inputStyle, resize: 'vertical', minHeight: 110, lineHeight: 1.5, fontFamily: 'inherit' }} />
              </FormField>
              {error && (
                <div style={{ padding: 12, borderRadius: 10, background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)', color: '#fca5a5', fontSize: 13 }}>
                  ⚠ {error}
                </div>
              )}
              <button type="submit" disabled={sending} className="cta-btn" style={{
                padding: '15px 24px', borderRadius: 999, border: 'none',
                background: `linear-gradient(135deg, ${ACCENT}, ${BLUE})`,
                color: '#fff', fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.01em',
                cursor: sending ? 'wait' : 'pointer', opacity: sending ? 0.6 : 1,
                boxShadow: '0 20px 50px rgba(191,90,242,0.30)', marginTop: 4,
              }}>
                {sending ? cf.sending : `${cf.send} →`}
              </button>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: -4 }}>
                {cf.disclaimer}
              </div>
            </form>
          )}
        </div>
      </Reveal>
    </section>
  )
}

function FormField({ label, required, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', fontWeight: 700, marginBottom: 7, letterSpacing: '0.02em' }}>
        {label} {required && <span style={{ color: ACCENT }}>*</span>}
      </div>
      {children}
    </label>
  )
}
const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
  color: '#fff', fontSize: 13.5, fontFamily: 'inherit',
  outline: 'none', transition: 'border-color .15s', boxSizing: 'border-box',
}

function FinalCta({ t }) {
  return (
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 100px', textAlign: 'center' }}>
      <Reveal>
        <div className="glass-card-static" style={{ padding: '60px 32px', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at center, ${ACCENT}18, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <h2 style={{
            position: 'relative',
            fontSize: 'clamp(32px, 5.5vw, 56px)', fontWeight: 900,
            letterSpacing: '-0.04em', margin: 0, marginBottom: 18, lineHeight: 1.05,
          }}>{t.finalCta.title}</h2>
          <p style={{
            position: 'relative',
            fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 36, lineHeight: 1.55,
            maxWidth: 560, margin: '0 auto 36px',
          }}>{t.finalCta.sub}</p>
          <Link href="/register" className="cta-btn" style={{
            ...primaryCta, position: 'relative',
            padding: '18px 42px', fontSize: 16,
          }}>{t.finalCta.btn}</Link>
        </div>
      </Reveal>
    </section>
  )
}

function SectionHeader({ eyebrow, title }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 11, color: ACCENT, fontWeight: 800,
        letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 12,
      }}>{eyebrow}</div>
      <h2 style={{
        fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 900,
        letterSpacing: '-0.04em', margin: 0, lineHeight: 1.05,
      }}>{title}</h2>
    </div>
  )
}

function Footer({ t }) {
  return (
    <footer style={{
      maxWidth: 1200, margin: '0 auto', padding: '50px 24px 50px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 30, marginBottom: 30,
      }}>
        {/* Brand */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <LogoMark size={32} />
            <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.02em' }}>LyftAI</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            {t.footer.tagline}
          </div>
        </div>

        {/* Dati aziendali */}
        <div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>
            Dati aziendali
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
            <div style={{ color: '#fff', fontWeight: 700 }}>LYFT SRL</div>
            <div>Via Corso Giuseppe Mazzini 223</div>
            <div>San Benedetto del Tronto (AP) 63074</div>
            <div style={{ marginTop: 4 }}>P. IVA: 02600730440</div>
          </div>
        </div>

        {/* Link */}
        <div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>
            Link
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
            <a href="#features" style={footerLinkStyle}>{t.nav.features}</a>
            <a href="#pricing" style={footerLinkStyle}>{t.nav.pricing}</a>
            <a href="#contact" style={footerLinkStyle}>{t.nav.contact}</a>
            <Link href="/login" style={footerLinkStyle}>{t.nav.login}</Link>
            <Link href="/register" style={footerLinkStyle}>{t.nav.cta}</Link>
          </div>
        </div>
      </div>

      <div style={{
        paddingTop: 22,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        fontSize: 11, color: 'rgba(255,255,255,0.4)',
      }}>
        <div>© {new Date().getFullYear()} LYFT SRL — Tutti i diritti riservati</div>
        <div>Made with ✦ in Italia</div>
      </div>
    </footer>
  )
}
const footerLinkStyle = {
  color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color .15s',
}
