'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import Icon from '../components/ui/Icon'
import AgencyPricing from '../components/AgencyPricing'
import dynamic from 'next/dynamic'
import LogoMark from '../components/LogoMark'
import { browserToLocale } from '../../lib/i18n/geoLocale'

// Globo decorativo dell'hero (three.js) — lazy, niente SSR, non blocca il primo paint
const LandingGlobe = dynamic(() => import('../components/LandingGlobe'), { ssr: false })

const ACCENT = '#bf5af2'
const BLUE = '#2997ff'
const GREEN = '#22c55e'

// ─────────────────────────────────────────────────────────────
//  i18n — IT / EN / ES (no library, dictionary lookup)
// ─────────────────────────────────────────────────────────────
// Mega-menu "Soluzioni": colonne (titoli localizzati via t.solMenu) + voci
// (nomi prodotto neutri, validi in tutte le lingue).
const SOLUTIONS = [
  { key: 'commerce', items: ['Dashboard live', 'KPI Brain', 'Inventario', 'Performance prodotti', 'Costi prodotto', 'Clienti (CRM)', 'Attribution', 'LTV & Cohorts', 'Conto Economico (P&L)'] },
  { key: 'ads', items: ['Meta Detail & KPI', 'Google KPI & Detail', 'Google Products (PMax)', 'Google Lighthouse & Budget', 'Creative & Budget Advisor', 'Creative Fatigue', 'Lighthouse alerts', 'Competitor Intel', 'Price comparison'] },
  { key: 'website', items: ['CRO & Funnel', 'AI Website Scanner', 'SEO Audit + GSC', 'Keyword AI & AEO'] },
  { key: 'ai', items: ['Performance Agent AI', 'Creative Lab', 'Report PDF completo', 'Report PDF automatici'] },
  { key: 'team', items: ['Progetti & Task', 'Lyftimer · time tracking', 'LyftTalk · chat', 'Onboarding guidato'] },
]

const I18N = {
  it: {
    nav: { features: 'Funzionalità', pricing: 'Prezzi', contact: 'Contatti', login: 'Accedi', cta: 'Prova gratis', solutions: 'Soluzioni' },
    solMenu: { commerce: 'Commerce & Analytics', ads: 'Advertising', website: 'Sito & SEO', ai: 'AI & Creative', team: 'Team & Operations', all: 'Esplora tutto il software →' },
    bundle: {
      eyebrow: 'Un solo abbonamento',
      title: 'Tutti i tool in un\'unica piattaforma',
      sub: 'Quello che di solito paghi con 10+ abbonamenti separati, qui è già tutto incluso in un solo prezzo.',
      allinoneLabel: 'LyftAI · tutto incluso',
      allinoneNote: 'Tutto incluso, un unico accesso, un unico prezzo.',
      separateLabel: 'Gli stessi tool, separati',
      separateNote: 'Stima media di mercato per categoria (€/mese).',
      items: [
        { name: 'Dashboard & BI analytics', price: 99 },
        { name: 'Connettori dati multi-piattaforma', price: 120 },
        { name: 'Analytics Meta + Google Ads', price: 89 },
        { name: 'Email marketing analytics', price: 70 },
        { name: 'Suite SEO (audit, keyword, GSC)', price: 99 },
        { name: 'Squadra di agenti AI marketing', price: 80 },
        { name: 'Generatore creative AI', price: 49 },
        { name: 'Competitor & price intelligence', price: 99 },
        { name: 'CRM & segmentazione clienti', price: 60 },
        { name: 'Inventario & stockout intelligence', price: 45 },
        { name: 'Project management', price: 39 },
        { name: 'Time tracking', price: 29 },
        { name: 'Team chat', price: 25 },
      ],
      totalLabel: 'Totale separati',
      perMonth: '/mese',
      saveLabel: 'Risparmi',
      saveSuffix: 'al mese con LyftAI',
    },
    hero: {
      badge: 'Prova gratuita · 14 giorni',
      title1: 'Il sistema operativo AI',
      title2: 'del tuo e-commerce.',
      subtitle: 'Analisi, creatività, agenti AI e team in un\'unica piattaforma che conosce il tuo brand. Connetti Shopify, Meta, Google e Klaviyo in 5 minuti: LyftAI legge i dati e ogni giorno ti mostra dove c\'è leva di crescita e dove stai bruciando soldi.',
      ctaPrimary: 'Inizia la prova gratuita',
      ctaSecondary: 'Scopri come funziona',
      perks: ['Niente carta richiesta', 'Setup in 5 minuti', 'Disponibile in 5 lingue'],
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
    tabsTour: { eyebrow: 'Tour completo', title: '6 aree, 40+ strumenti. Tutto il tuo e-commerce in un unico software.' },
    tabs: [
      { id: 'dashboard', icon: '◉', title: 'Dashboard + Live View', desc: 'KPI live da tutte le piattaforme, raccomandazioni proattive, alert anomalie e globo 3D dei visitatori in tempo reale.' },
      { id: 'kpi', icon: <Icon name="star" size={18} />, title: 'KPI Brain + Attribuzione', desc: 'Top prodotti, marketing sources, attribuzione total-impact e paesi di fatturazione. Insight pronti.' },
      { id: 'clienti', icon: <Icon name="users" size={18} />, title: 'Clienti (CRM AI)', desc: 'Segmenti RFM, analytics clienti e insight AI — sui dati Shopify reali.' },
      { id: 'commerce', icon: '€', title: 'Inventario + P&L', desc: 'Conto economico fino all\'EBIT, intelligence stockout, broken sizes, vendite perse € e costi prodotto landed.' },
      { id: 'meta', icon: '⊞', title: 'Meta Ads completo', desc: 'Creative, Meta Detail ad-level, Budget Advisor, Creative Fatigue e Lighthouse.' },
      { id: 'google', icon: <Icon name="search" size={18} />, title: 'Google Ads completo', desc: 'Suite gemella di Meta: KPI, Detail, Prodotti, Budget Advisor e Lighthouse.' },
      { id: 'seo', icon: '⌕', title: 'SEO + CRO + Website', desc: 'Audit SEO, GSC reale, Keyword AI, AI Visibility (AEO), CRO e AI Website Scanner.' },
      { id: 'studio', icon: <Icon name="sparkles" size={18} />, title: 'Creative Studio', desc: 'Produzione generativa di immagini e creative sul tuo brand, Try-On sul prodotto e board collaborative.' },
      { id: 'team', icon: <Icon name="sparkle" size={18} />, title: 'Squadra AI', desc: '8 agenti C-suite (CEO · CFO · CMO · Ads · SEO · CRO · Data · Creative) con memoria condivisa che conoscono il tuo brand.' },
      { id: 'ops', icon: <Icon name="chat" size={18} />, title: 'Team & Operations', desc: 'Chat LyftTalk con agenti AI e call vocali, Lyftimer time-tracking, Progetti & Task.' },
      { id: 'reports', icon: '▦', title: 'Report periodici', desc: 'Weekly, Monthly, Quarter, Year + digest email automatici. Confronto period-over-period, export PDF.' },
    ],
    featuresTitle: { eyebrow: 'Cosa fa per te', title: 'Tutto il tuo brand in un\'unica piattaforma' },
    features: [
      { icon: '◎', title: 'Dashboard real-time + Live View', desc: 'KPI core (Fatturato, AOV, MER, CAC, LTV) live + globo 3D dei visitatori in tempo reale da GA4.' },
      { icon: <Icon name="sparkle" size={18} />, title: 'Squadra AI', desc: '8 agenti C-suite (CEO · CFO · CMO · Ads · SEO · CRO · Data · Creative) con memoria condivisa. Leggono Shopify, Meta, GA4 e Search Console e rispondono coi tuoi numeri.' },
      { icon: <Icon name="scale" size={18} />, title: 'Meta + Google Ads completo', desc: 'Entrambe le suite: KPI, Detail ad-level, Budget Advisor, Creative Fatigue e Lighthouse. Vedi dove stai bruciando budget.' },
      { icon: <Icon name="sparkles" size={18} />, title: 'Creative Studio', desc: 'Produzione generativa di immagini e creative sul tuo brand identity, Try-On sul prodotto e board collaborative.' },
      { icon: '⌕', title: 'Suite SEO + AI', desc: 'Audit on-page e multipagina, Google Search Console reale, Keyword AI, AI Visibility (AEO), Editor contenuti, Competitor.' },
      { icon: '€', title: 'Commerce intelligence', desc: 'Conto Economico fino all\'EBIT, Inventario (stockout & vendite perse €), Clienti (segmenti RFM) e LTV & Coorti.' },
      { icon: <Icon name="chat" size={18} />, title: 'Team & Operations', desc: 'Chat LyftTalk con i tuoi agenti AI e call vocali, Lyftimer per il time-tracking, Progetti & Task. Tutto il team in un posto.' },
      { icon: '◈', title: 'Competitor Intel', desc: 'Ads attive, prezzi e cataloghi dei competitor, con analisi creative dalla Ad Library.' },
    ],
    inAction: { eyebrow: 'Demo', title: 'Vedi LyftAI in azione', sub: 'Ecco cosa trovi appena entri nel tuo account: tutti i dati del tuo brand già pronti, in un\'unica dashboard.', explore: 'È il software reale: cliccaci dentro ed esploralo →', openFull: '▶ Apri la demo a schermo intero', loading: 'Carico la demo…' },
    demoTitle: { eyebrow: 'Dati in azione', title: 'Esempio di quello che vedi ogni giorno' },
    demoCards: {
      revenue: { eyebrow: 'Fatturato 30gg', value: '€84.250', delta: '+24% vs periodo precedente' },
      orders: { eyebrow: 'Ordini per canale', value: '1.284', sub: 'Meta è il top channel' },
      briefingTitle: 'Briefing automatico — stamattina',
      briefingItems: [
        { icon: <Icon name="warning" size={16} />, color: '#f87171', txt: 'ROAS Meta crollato a 1.4x (vs 2.8x media 7gg)' },
        { icon: '▲', color: '#fbbf24', txt: 'AOV in calo da 4 giorni: 78€ → 71€' },
        { icon: '◆', color: BLUE, txt: 'Top product cambia: il nuovo bestseller scala' },
        { icon: 'ⓘ', color: GREEN, txt: 'Settimana record: 142 ordini (best del mese)' },
      ],
      chatTitle: 'Performance Agent — chat',
      chatUser: 'Com\'è andata la settimana?',
      chatAi: 'Allora, MER a {strong}2,6x{/strong} — sopra il target che tieni a 2,5x. Settimana solida. AOV in linea, ma il {strong}CTR Meta cala da 3 giorni{/strong}. Lo guardo?',
    },
    pricingTitle: { eyebrow: 'Pricing', title: 'Paghi in base alla tua dimensione. I tool sono sempre tutti.' },
    pricingSub: 'Tutti i tool inclusi in ogni piano. Il prezzo cresce con i tuoi ordini, mai con le funzioni. 14 giorni gratis, niente carta, cancelli in 1 click.',
    pricingUI: { founder: 'Founder: −30% A VITA per le prime 100 aziende', founderCum: '· cumulabile con lo sconto annuale', audBrand: 'Aziende', audAgency: 'Agenzie & Freelance', agencySub: 'Gestisci tutti i tuoi clienti da un unico posto. Paghi per numero di aziende, switch immediato tra una e l’altra.', cadMonthly: 'Mensile', cadAnnual: 'Annuale', billAnnual: 'all’anno', twoFree: '2 mesi gratis', save: 'Risparmi', billed: 'fatturato' },
    plans: [
      { id: 'starter', name: 'Starter', price: '€69', period: '/mese', tagline: 'Fino a 500 ordini/mese. Perfetto per partire con tutto già incluso.', features: ['✨ Tutti i tool inclusi', 'Fino a 500 ordini/mese', 'Tutte le integrazioni (Shopify, Meta, Google, Klaviyo)', '2 utenti del team', 'Email support 48h'], cta: 'Inizia con Starter' },
      { id: 'growth', name: 'Growth', price: '€149', period: '/mese', tagline: 'Da 500 a 2.000 ordini/mese. Per brand in crescita.', features: ['✨ Tutti i tool inclusi', '500 – 2.000 ordini/mese', '5 utenti del team', 'Crediti Creative Lab (AI) estesi', 'Priority support 12h'], cta: 'Inizia con Growth', popular: true, popularLabel: 'PIÙ SCELTO' },
      { id: 'scale', name: 'Scale', price: '€299', period: '/mese', tagline: 'Da 2.000 a 7.000 ordini/mese. Per brand strutturati.', features: ['✨ Tutti i tool inclusi', '2.000 – 7.000 ordini/mese', 'Utenti del team illimitati', 'Crediti Creative Lab (AI) massimi', 'CSM dedicato'], cta: 'Inizia con Scale' },
      { id: 'enterprise', name: 'Enterprise', price: 'Su misura', period: '', tagline: 'Oltre 7.000 ordini/mese. Volumi alti ed esigenze custom.', features: ['✨ Tutti i tool inclusi', '7.000+ ordini/mese', 'SLA e onboarding dedicato', 'Integrazioni custom', 'Account manager dedicato'], cta: 'Contattaci', href: '#contact' },
    ],
    agency: {
      eyebrow: 'Per agenzie & freelance',
      title: 'Gestisci tutti i tuoi clienti da un\'unica piattaforma',
      sub: 'Un workspace per ogni cliente, switch immediato, tutti i tool inclusi. Paghi per numero di aziende, non per funzioni.',
      items: [
        { title: 'Multi-workspace', desc: 'Un account, tutti i tuoi clienti. Passi da un brand all\'altro in 1 click, con dati isolati per ciascuno.' },
        { title: 'White-label', desc: 'Logo e dominio tuoi: i clienti vedono il TUO brand, non il nostro.' },
        { title: 'Interfaccia in 5 lingue', desc: 'Italiano, inglese, spagnolo, francese, tedesco — lingua per-cliente, rilevata in automatico.' },
        { title: 'Pricing a pacchetti', desc: 'Aziende incluse + overage per cliente extra. Scala con il tuo portfolio.' },
      ],
      cta: 'Vedi i piani agenzia',
    },
    testimonialsTitle: { eyebrow: 'Cosa dicono di noi', title: 'Brand che hanno smesso di scegliere a sentimento' },
    testimonials: [
      { name: 'Andrea M.', role: 'Founder, brand fitness DTC', text: 'Prima dovevo aprire 4 dashboard ogni mattina. Adesso apro la chat e mi dice: ROAS Meta in calo, AOV stabile, top product cambia. In 2 minuti so cosa fare.', avatar: 'AM' },
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
      disclaimer: 'Premendo invii i dati a LYFT SRL. Nessuna newsletter, nessuno spam.',
    },
    finalCta: { title: 'Smetti di scegliere a sentimento.', sub: 'Connetti il tuo store e in 5 minuti hai un\'AI che conosce i tuoi dati meglio di te.', btn: 'Inizia la prova gratuita →' },
    footer: { tagline: 'AI consultant per brand DTC' },
  },
  en: {
    nav: { features: 'Features', pricing: 'Pricing', contact: 'Contact', login: 'Sign in', cta: 'Free trial', solutions: 'Solutions' },
    solMenu: { commerce: 'Commerce & Analytics', ads: 'Advertising', website: 'Website & SEO', ai: 'AI & Creative', team: 'Team & Operations', all: 'Explore the whole platform →' },
    bundle: {
      eyebrow: 'One single subscription',
      title: 'Every tool in one platform',
      sub: 'What you usually pay across 10+ separate subscriptions is already included here, for one price.',
      allinoneLabel: 'LyftAI · all included',
      allinoneNote: 'Everything included, one login, one price.',
      separateLabel: 'The same tools, separately',
      separateNote: 'Average market estimate per category (€/month).',
      items: [
        { name: 'Dashboard & BI analytics', price: 99 },
        { name: 'Multi-platform data connectors', price: 120 },
        { name: 'Meta + Google Ads analytics', price: 89 },
        { name: 'Email marketing analytics', price: 70 },
        { name: 'SEO suite (audit, keyword, GSC)', price: 99 },
        { name: 'AI marketing agent team', price: 80 },
        { name: 'AI creative generator', price: 49 },
        { name: 'Competitor & price intelligence', price: 99 },
        { name: 'CRM & customer segmentation', price: 60 },
        { name: 'Inventory & stockout intelligence', price: 45 },
        { name: 'Project management', price: 39 },
        { name: 'Time tracking', price: 29 },
        { name: 'Team chat', price: 25 },
      ],
      totalLabel: 'Separate total',
      perMonth: '/month',
      saveLabel: 'You save',
      saveSuffix: 'per month with LyftAI',
    },
    hero: {
      badge: 'Free trial · 14 days',
      title1: 'The AI operating system',
      title2: 'for your e-commerce.',
      subtitle: 'Analytics, creative, AI agents and team in one platform that knows your brand. Connect Shopify, Meta, Google and Klaviyo in 5 minutes: LyftAI reads your data and shows you every day where there\'s growth leverage and where you\'re burning money.',
      ctaPrimary: 'Start free trial',
      ctaSecondary: 'See how it works',
      perks: ['No credit card required', '5-minute setup', 'Available in 5 languages'],
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
    tabsTour: { eyebrow: 'Complete tour', title: '6 areas, 40+ tools. Your whole e-commerce in one software.' },
    tabs: [
      { id: 'dashboard', icon: '◉', title: 'Dashboard + Live View', desc: 'Live KPIs from every platform, proactive recommendations, anomaly alerts and a 3D globe of real-time visitors.' },
      { id: 'kpi', icon: <Icon name="star" size={18} />, title: 'KPI Brain + Attribution', desc: 'Top products, marketing sources, total-impact attribution and billing countries. Insights ready.' },
      { id: 'clienti', icon: <Icon name="users" size={18} />, title: 'Customers (AI CRM)', desc: 'RFM segments, customer analytics and AI insights — on your real Shopify data.' },
      { id: 'commerce', icon: '€', title: 'Inventory + P&L', desc: 'P&L down to EBIT, stockout intelligence, broken sizes, lost sales € and landed product costs.' },
      { id: 'meta', icon: '⊞', title: 'Full Meta Ads', desc: 'Creative, ad-level Meta Detail, Budget Advisor, Creative Fatigue and Lighthouse.' },
      { id: 'google', icon: <Icon name="search" size={18} />, title: 'Full Google Ads', desc: 'Twin suite to Meta: KPI, Detail, Products, Budget Advisor and Lighthouse.' },
      { id: 'seo', icon: '⌕', title: 'SEO + CRO + Website', desc: 'SEO audit, real GSC, Keyword AI, AI Visibility (AEO), CRO and AI Website Scanner.' },
      { id: 'studio', icon: <Icon name="sparkles" size={18} />, title: 'Creative Studio', desc: 'Generative production of on-brand images and creatives, product Try-On and collaborative boards.' },
      { id: 'team', icon: <Icon name="sparkle" size={18} />, title: 'AI Squad', desc: '8 C-suite agents (CEO · CFO · CMO · Ads · SEO · CRO · Data · Creative) with shared memory that know your brand.' },
      { id: 'ops', icon: <Icon name="chat" size={18} />, title: 'Team & Operations', desc: 'LyftTalk chat with AI agents and voice calls, Lyftimer time-tracking, Projects & Tasks.' },
      { id: 'reports', icon: '▦', title: 'Periodic reports', desc: 'Weekly, Monthly, Quarter, Year + automatic email digests. Period-over-period comparison, PDF export.' },
    ],
    featuresTitle: { eyebrow: 'What it does for you', title: 'Your whole brand in a single platform' },
    features: [
      { icon: '◎', title: 'Real-time Dashboard + Live View', desc: 'Core KPIs (Revenue, AOV, MER, CAC, LTV) live + 3D globe of real-time visitors from GA4.' },
      { icon: <Icon name="sparkle" size={18} />, title: 'AI Squad', desc: '8 C-suite agents (CEO · CFO · CMO · Ads · SEO · CRO · Data · Creative) with shared memory. They read Shopify, Meta, GA4 and Search Console and answer with your numbers.' },
      { icon: <Icon name="scale" size={18} />, title: 'Full Meta + Google Ads', desc: 'Both suites: KPI, ad-level Detail, Budget Advisor, Creative Fatigue and Lighthouse. See where you\'re burning budget.' },
      { icon: <Icon name="sparkles" size={18} />, title: 'Creative Studio', desc: 'Generative production of on-brand images and creatives, product Try-On and collaborative boards.' },
      { icon: '⌕', title: 'SEO Suite + AI', desc: 'On-page & multi-page audit, real Google Search Console, Keyword AI, AI Visibility (AEO), content Editor, Competitor.' },
      { icon: '€', title: 'Commerce intelligence', desc: 'P&L down to EBIT, Inventory (stockout & lost sales €), Customers (RFM segments) and LTV & Cohorts.' },
      { icon: <Icon name="chat" size={18} />, title: 'Team & Operations', desc: 'LyftTalk chat with your AI agents and voice calls, Lyftimer time-tracking, Projects & Tasks. Your whole team in one place.' },
      { icon: '◈', title: 'Competitor Intel', desc: 'Active ads, prices and competitor catalogs, with creative analysis from the Ad Library.' },
    ],
    inAction: { eyebrow: 'Demo', title: 'See LyftAI in action', sub: 'Here\'s what you find the moment you log in: all your brand\'s data, ready to go, in one dashboard.', explore: 'It\'s the real software: click inside and explore →', openFull: '▶ Open the demo full screen', loading: 'Loading the demo…' },
    demoTitle: { eyebrow: 'Data in action', title: 'Example of what you see every day' },
    demoCards: {
      revenue: { eyebrow: '30d Revenue', value: '€84,250', delta: '+24% vs previous period' },
      orders: { eyebrow: 'Orders by channel', value: '1,284', sub: 'Meta is the top channel' },
      briefingTitle: 'Automatic briefing — this morning',
      briefingItems: [
        { icon: <Icon name="warning" size={16} />, color: '#f87171', txt: 'Meta ROAS collapsed to 1.4x (vs 2.8x 7d avg)' },
        { icon: '▲', color: '#fbbf24', txt: 'AOV declining for 4 days: 78€ → 71€' },
        { icon: '◆', color: BLUE, txt: 'Top product changes: the new bestseller is scaling' },
        { icon: 'ⓘ', color: GREEN, txt: 'Record week: 142 orders (best of month)' },
      ],
      chatTitle: 'Performance Agent — chat',
      chatUser: 'How was the week?',
      chatAi: 'So, MER at {strong}2.6x{/strong} — above the 2.5x target you keep. Solid week. AOV in line, but {strong}Meta CTR is dropping for 3 days{/strong}. Should I look into it?',
    },
    pricingTitle: { eyebrow: 'Pricing', title: 'You pay by your size. The tools are always all of them.' },
    pricingSub: 'Every tool included in every plan. The price grows with your orders, never with features. 14 days free, no card, 1-click cancellation.',
    pricingUI: { founder: 'Founder: −30% FOR LIFE for the first 100 companies', founderCum: '· stacks with the annual discount', audBrand: 'Companies', audAgency: 'Agencies & Freelancers', agencySub: 'Manage all your clients from one place. You pay per number of companies, switch instantly between them.', cadMonthly: 'Monthly', cadAnnual: 'Annual', billAnnual: 'per year', twoFree: '2 months free', save: 'You save', billed: 'billed' },
    plans: [
      { id: 'starter', name: 'Starter', price: '€69', period: '/month', tagline: 'Up to 500 orders/month. Perfect to start, with everything already included.', features: ['✨ All tools included', 'Up to 500 orders/month', 'All integrations (Shopify, Meta, Google, Klaviyo)', '2 team users', 'Email support 48h'], cta: 'Start with Starter' },
      { id: 'growth', name: 'Growth', price: '€149', period: '/month', tagline: '500 to 2,000 orders/month. For growing brands.', features: ['✨ All tools included', '500 – 2,000 orders/month', '5 team users', 'Extended Creative Lab (AI) credits', 'Priority support 12h'], cta: 'Start with Growth', popular: true, popularLabel: 'MOST CHOSEN' },
      { id: 'scale', name: 'Scale', price: '€299', period: '/month', tagline: '2,000 to 7,000 orders/month. For structured brands.', features: ['✨ All tools included', '2,000 – 7,000 orders/month', 'Unlimited team users', 'Maximum Creative Lab (AI) credits', 'Dedicated CSM'], cta: 'Start with Scale' },
      { id: 'enterprise', name: 'Enterprise', price: 'Custom', period: '', tagline: 'Over 7,000 orders/month. High volume and custom needs.', features: ['✨ All tools included', '7,000+ orders/month', 'Dedicated SLA & onboarding', 'Custom integrations', 'Dedicated account manager'], cta: 'Contact us', href: '#contact' },
    ],
    agency: {
      eyebrow: 'For agencies & freelancers',
      title: 'Manage all your clients from one platform',
      sub: 'A workspace per client, instant switching, every tool included. You pay per number of companies, not per feature.',
      items: [
        { title: 'Multi-workspace', desc: 'One account, all your clients. Switch from one brand to another in 1 click, with isolated data for each.' },
        { title: 'White-label', desc: 'Your logo and domain: clients see YOUR brand, not ours.' },
        { title: 'Interface in 5 languages', desc: 'Italian, English, Spanish, French, German — per-client language, auto-detected.' },
        { title: 'Bundle pricing', desc: 'Included companies + overage per extra client. Scale with your portfolio.' },
      ],
      cta: 'See agency plans',
    },
    testimonialsTitle: { eyebrow: 'What they say about us', title: 'Brands that stopped choosing by gut feeling' },
    testimonials: [
      { name: 'Andrea M.', role: 'Founder, brand fitness DTC', text: 'Before I had to open 4 dashboards every morning. Now I open the chat and it tells me: Meta ROAS down, AOV stable, top product changing. In 2 minutes I know what to do.', avatar: 'AM' },
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
      disclaimer: 'By submitting you send the data to LYFT SRL. No newsletter, no spam.',
    },
    finalCta: { title: 'Stop choosing by gut feeling.', sub: 'Connect your store and in 5 minutes you have an AI that knows your data better than you.', btn: 'Start free trial →' },
    footer: { tagline: 'AI consultant for DTC brands' },
  },
  es: {
    nav: { features: 'Funciones', pricing: 'Precios', contact: 'Contacto', login: 'Acceder', cta: 'Prueba gratis', solutions: 'Soluciones' },
    solMenu: { commerce: 'Commerce & Analytics', ads: 'Publicidad', website: 'Web & SEO', ai: 'IA & Creative', team: 'Equipo & Operaciones', all: 'Explora todo el software →' },
    bundle: {
      eyebrow: 'Una sola suscripción',
      title: 'Todas las herramientas en una plataforma',
      sub: 'Lo que normalmente pagas con más de 10 suscripciones separadas, aquí ya está incluido en un único precio.',
      allinoneLabel: 'LyftAI · todo incluido',
      allinoneNote: 'Todo incluido, un único acceso, un único precio.',
      separateLabel: 'Las mismas herramientas, por separado',
      separateNote: 'Estimación media de mercado por categoría (€/mes).',
      items: [
        { name: 'Dashboard & BI analytics', price: 99 },
        { name: 'Conectores de datos multiplataforma', price: 120 },
        { name: 'Analytics Meta + Google Ads', price: 89 },
        { name: 'Analytics de email marketing', price: 70 },
        { name: 'Suite SEO (audit, keyword, GSC)', price: 99 },
        { name: 'Equipo de agentes IA de marketing', price: 80 },
        { name: 'Generador de creatividades IA', price: 49 },
        { name: 'Competitor & price intelligence', price: 99 },
        { name: 'CRM y segmentación de clientes', price: 60 },
        { name: 'Inventario & stockout intelligence', price: 45 },
        { name: 'Project management', price: 39 },
        { name: 'Time tracking', price: 29 },
        { name: 'Chat de equipo', price: 25 },
      ],
      totalLabel: 'Total por separado',
      perMonth: '/mes',
      saveLabel: 'Ahorras',
      saveSuffix: 'al mes con LyftAI',
    },
    hero: {
      badge: 'Prueba gratuita · 14 días',
      title1: 'El sistema operativo IA',
      title2: 'de tu e-commerce.',
      subtitle: 'Analytics, creatividades, agentes IA y equipo en una sola plataforma que conoce tu marca. Conecta Shopify, Meta, Google y Klaviyo en 5 minutos: LyftAI lee tus datos y cada día te muestra dónde hay palanca de crecimiento y dónde estás quemando dinero.',
      ctaPrimary: 'Iniciar prueba gratuita',
      ctaSecondary: 'Ver cómo funciona',
      perks: ['Sin tarjeta de crédito', 'Configuración en 5 minutos', 'Disponible en 5 idiomas'],
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
    tabsTour: { eyebrow: 'Tour completo', title: '6 áreas, 40+ herramientas. Todo tu e-commerce en un software.' },
    tabs: [
      { id: 'dashboard', icon: '◉', title: 'Dashboard + Live View', desc: 'KPIs en vivo de todas las plataformas, recomendaciones proactivas, alertas de anomalías y globo 3D de visitantes en tiempo real.' },
      { id: 'kpi', icon: <Icon name="star" size={18} />, title: 'KPI Brain + Atribución', desc: 'Top productos, fuentes de marketing, atribución total-impact y países de facturación. Insights listos.' },
      { id: 'clienti', icon: <Icon name="users" size={18} />, title: 'Clientes (CRM IA)', desc: 'Segmentos RFM, analytics de clientes e insights IA — sobre tus datos reales de Shopify.' },
      { id: 'commerce', icon: '€', title: 'Inventario + P&L', desc: 'Cuenta de resultados hasta el EBIT, inteligencia de stockout, broken sizes, ventas perdidas € y costes de producto landed.' },
      { id: 'meta', icon: '⊞', title: 'Meta Ads completo', desc: 'Creative, Meta Detail ad-level, Budget Advisor, Creative Fatigue y Lighthouse.' },
      { id: 'google', icon: <Icon name="search" size={18} />, title: 'Google Ads completo', desc: 'Suite gemela de Meta: KPI, Detail, Productos, Budget Advisor y Lighthouse.' },
      { id: 'seo', icon: '⌕', title: 'SEO + CRO + Website', desc: 'Auditoría SEO, GSC real, Keyword AI, AI Visibility (AEO), CRO y AI Website Scanner.' },
      { id: 'studio', icon: <Icon name="sparkles" size={18} />, title: 'Creative Studio', desc: 'Producción generativa de imágenes y creatividades de tu marca, Try-On de producto y boards colaborativos.' },
      { id: 'team', icon: <Icon name="sparkle" size={18} />, title: 'Escuadrón IA', desc: '8 agentes C-suite (CEO · CFO · CMO · Ads · SEO · CRO · Data · Creative) con memoria compartida que conocen tu marca.' },
      { id: 'ops', icon: <Icon name="chat" size={18} />, title: 'Team & Operations', desc: 'Chat LyftTalk con agentes IA y llamadas de voz, Lyftimer time-tracking, Proyectos & Tareas.' },
      { id: 'reports', icon: '▦', title: 'Reportes periódicos', desc: 'Semanal, Mensual, Trimestral, Anual + digests por email automáticos. Comparación período sobre período, exporte PDF.' },
    ],
    featuresTitle: { eyebrow: 'Qué hace por ti', title: 'Toda tu marca en una sola plataforma' },
    features: [
      { icon: '◎', title: 'Dashboard en tiempo real + Live View', desc: 'KPIs core (Revenue, AOV, MER, CAC, LTV) en vivo + globo 3D de visitantes en tiempo real desde GA4.' },
      { icon: <Icon name="sparkle" size={18} />, title: 'Escuadrón IA', desc: '8 agentes C-suite (CEO · CFO · CMO · Ads · SEO · CRO · Data · Creative) con memoria compartida. Leen Shopify, Meta, GA4 y Search Console y responden con tus números.' },
      { icon: <Icon name="scale" size={18} />, title: 'Meta + Google Ads completo', desc: 'Ambas suites: KPI, Detail a nivel de ad, Budget Advisor, Creative Fatigue y Lighthouse. Ves dónde estás quemando budget.' },
      { icon: <Icon name="sparkles" size={18} />, title: 'Creative Studio', desc: 'Producción generativa de imágenes y creatividades de tu brand identity, Try-On de producto y boards colaborativos.' },
      { icon: '⌕', title: 'Suite SEO + IA', desc: 'Auditoría on-page y multipágina, Google Search Console real, Keyword AI, AI Visibility (AEO), Editor de contenidos, Competidores.' },
      { icon: '€', title: 'Commerce intelligence', desc: 'P&L hasta el EBIT, Inventario (stockout & ventas perdidas €), Clientes (segmentos RFM) y LTV & Cohortes.' },
      { icon: <Icon name="chat" size={18} />, title: 'Team & Operations', desc: 'Chat LyftTalk con tus agentes IA y llamadas de voz, Lyftimer para time-tracking, Proyectos & Tareas. Todo el equipo en un lugar.' },
      { icon: '◈', title: 'Competitor Intel', desc: 'Ads activos, precios y catálogos de competidores, con análisis creativo de la Ad Library.' },
    ],
    inAction: { eyebrow: 'Demo', title: 'Mira LyftAI en acción', sub: 'Esto es lo que encuentras al entrar en tu cuenta: todos los datos de tu marca listos, en un solo dashboard.', explore: 'Es el software real: haz clic dentro y explóralo →', openFull: '▶ Abrir la demo a pantalla completa', loading: 'Cargando la demo…' },
    demoTitle: { eyebrow: 'Datos en acción', title: 'Ejemplo de lo que ves cada día' },
    demoCards: {
      revenue: { eyebrow: 'Revenue 30d', value: '€84.250', delta: '+24% vs período anterior' },
      orders: { eyebrow: 'Pedidos por canal', value: '1.284', sub: 'Meta es el top channel' },
      briefingTitle: 'Briefing automático — esta mañana',
      briefingItems: [
        { icon: <Icon name="warning" size={16} />, color: '#f87171', txt: 'ROAS Meta colapsó a 1.4x (vs 2.8x media 7d)' },
        { icon: '▲', color: '#fbbf24', txt: 'AOV bajando desde 4 días: 78€ → 71€' },
        { icon: '◆', color: BLUE, txt: 'Top product cambia: el nuevo bestseller escala' },
        { icon: 'ⓘ', color: GREEN, txt: 'Semana récord: 142 pedidos (mejor del mes)' },
      ],
      chatTitle: 'Performance Agent — chat',
      chatUser: '¿Cómo fue la semana?',
      chatAi: 'Entonces, MER en {strong}2,6x{/strong} — por encima del target 2,5x que tienes. Semana sólida. AOV en línea, pero el {strong}CTR Meta baja desde 3 días{/strong}. ¿Lo reviso?',
    },
    pricingTitle: { eyebrow: 'Precios', title: 'Pagas según tu tamaño. Las herramientas son siempre todas.' },
    pricingSub: 'Todas las herramientas incluidas en cada plan. El precio crece con tus pedidos, nunca con las funciones. 14 días gratis, sin tarjeta, cancelas en 1 click.',
    pricingUI: { founder: 'Founder: −30% DE POR VIDA para las primeras 100 empresas', founderCum: '· acumulable con el descuento anual', audBrand: 'Empresas', audAgency: 'Agencias y Freelancers', agencySub: 'Gestiona todos tus clientes desde un solo lugar. Pagas por número de empresas, cambias al instante entre ellas.', cadMonthly: 'Mensual', cadAnnual: 'Anual', billAnnual: 'al año', twoFree: '2 meses gratis', save: 'Ahorras', billed: 'facturado' },
    plans: [
      { id: 'starter', name: 'Starter', price: '€69', period: '/mes', tagline: 'Hasta 500 pedidos/mes. Perfecto para empezar, con todo ya incluido.', features: ['✨ Todas las herramientas incluidas', 'Hasta 500 pedidos/mes', 'Todas las integraciones (Shopify, Meta, Google, Klaviyo)', '2 usuarios del equipo', 'Email support 48h'], cta: 'Iniciar con Starter' },
      { id: 'growth', name: 'Growth', price: '€149', period: '/mes', tagline: 'De 500 a 2.000 pedidos/mes. Para marcas en crecimiento.', features: ['✨ Todas las herramientas incluidas', '500 – 2.000 pedidos/mes', '5 usuarios del equipo', 'Créditos Creative Lab (IA) ampliados', 'Priority support 12h'], cta: 'Iniciar con Growth', popular: true, popularLabel: 'MÁS ELEGIDO' },
      { id: 'scale', name: 'Scale', price: '€299', period: '/mes', tagline: 'De 2.000 a 7.000 pedidos/mes. Para marcas estructuradas.', features: ['✨ Todas las herramientas incluidas', '2.000 – 7.000 pedidos/mes', 'Usuarios del equipo ilimitados', 'Créditos Creative Lab (IA) máximos', 'CSM dedicado'], cta: 'Iniciar con Scale' },
      { id: 'enterprise', name: 'Enterprise', price: 'A medida', period: '', tagline: 'Más de 7.000 pedidos/mes. Alto volumen y necesidades custom.', features: ['✨ Todas las herramientas incluidas', '7.000+ pedidos/mes', 'SLA y onboarding dedicado', 'Integraciones custom', 'Account manager dedicado'], cta: 'Contáctanos', href: '#contact' },
    ],
    agency: {
      eyebrow: 'Para agencias y freelancers',
      title: 'Gestiona todos tus clientes desde una sola plataforma',
      sub: 'Un workspace por cliente, cambio inmediato, todas las herramientas incluidas. Pagas por número de empresas, no por funciones.',
      items: [
        { title: 'Multi-workspace', desc: 'Una cuenta, todos tus clientes. Cambias de una marca a otra en 1 click, con datos aislados para cada una.' },
        { title: 'White-label', desc: 'Tu logo y tu dominio: los clientes ven TU marca, no la nuestra.' },
        { title: 'Interfaz en 5 idiomas', desc: 'Italiano, inglés, español, francés, alemán — idioma por cliente, detectado automáticamente.' },
        { title: 'Pricing por paquetes', desc: 'Empresas incluidas + overage por cliente extra. Escala con tu portfolio.' },
      ],
      cta: 'Ver planes de agencia',
    },
    testimonialsTitle: { eyebrow: 'Qué dicen de nosotros', title: 'Marcas que dejaron de elegir por intuición' },
    testimonials: [
      { name: 'Andrea M.', role: 'Founder, brand fitness DTC', text: 'Antes tenía que abrir 4 dashboards cada mañana. Ahora abro el chat y me dice: ROAS Meta cayendo, AOV estable, top product cambiando. En 2 minutos sé qué hacer.', avatar: 'AM' },
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
      disclaimer: 'Al enviar mandas los datos a LYFT SRL. Sin newsletter, sin spam.',
    },
    finalCta: { title: 'Deja de elegir por intuición.', sub: 'Conecta tu store y en 5 minutos tienes una IA que conoce tus datos mejor que tú.', btn: 'Iniciar prueba gratuita →' },
    footer: { tagline: 'AI consultant para marcas DTC' },
  },
  fr: {
    nav: { features: 'Fonctionnalités', pricing: 'Tarifs', contact: 'Contact', login: 'Connexion', cta: 'Essai gratuit', solutions: 'Solutions' },
    solMenu: { commerce: 'Commerce & Analytics', ads: 'Publicité', website: 'Site web & SEO', ai: 'IA & Créa', team: 'Équipe & Opérations', all: 'Explorer toute la plateforme →' },
    bundle: {
      eyebrow: 'Un seul abonnement',
      title: 'Tous les outils dans une seule plateforme',
      sub: 'Ce que vous payez habituellement sur plus de 10 abonnements séparés est déjà inclus ici, pour un seul prix.',
      allinoneLabel: 'LyftAI · tout inclus',
      allinoneNote: 'Tout inclus, un seul login, un seul prix.',
      separateLabel: 'Les mêmes outils, séparément',
      separateNote: 'Estimation moyenne du marché par catégorie (€/mois).',
      items: [
        { name: 'Dashboard & analytics BI', price: 99 },
        { name: 'Connecteurs de données multi-plateformes', price: 120 },
        { name: 'Analytics Meta + Google Ads', price: 89 },
        { name: 'Analytics email marketing', price: 70 },
        { name: 'Suite SEO (audit, mots-clés, GSC)', price: 99 },
        { name: 'Équipe d\'agents IA marketing', price: 80 },
        { name: 'Générateur de créas IA', price: 49 },
        { name: 'Intelligence concurrents & prix', price: 99 },
        { name: 'CRM & segmentation clients', price: 60 },
        { name: 'Inventaire & intelligence stockout', price: 45 },
        { name: 'Gestion de projet', price: 39 },
        { name: 'Suivi du temps', price: 29 },
        { name: 'Chat d\'équipe', price: 25 },
      ],
      totalLabel: 'Total séparé',
      perMonth: '/mois',
      saveLabel: 'Vous économisez',
      saveSuffix: 'par mois avec LyftAI',
    },
    hero: {
      badge: 'Essai gratuit · 14 jours',
      title1: 'Le système d\'exploitation IA',
      title2: 'de votre e-commerce.',
      subtitle: 'Analytics, créas, agents IA et équipe dans une seule plateforme qui connaît votre marque. Connectez Shopify, Meta, Google et Klaviyo en 5 minutes : LyftAI lit vos données et vous montre chaque jour où se trouvent les leviers de croissance et où vous brûlez de l\'argent.',
      ctaPrimary: 'Démarrer l\'essai gratuit',
      ctaSecondary: 'Voir comment ça marche',
      perks: ['Sans carte bancaire', 'Installation en 5 minutes', 'Disponible en 5 langues'],
    },
    trust: { label: 'Intégrations natives' },
    problem: {
      eyebrow: 'Le problème',
      title: '4 dashboards, 12 tableurs, 0 réponse claire',
      withoutLabel: 'Sans LyftAI',
      withoutList: [
        '6 dashboards ouverts : Shopify, Meta, Klaviyo, GA4, Stripe, Google sheets',
        'Du temps perdu à revérifier si les données concordent',
        'Anomalies découvertes après 3 jours de budget brûlé',
        'Décisions prises au feeling, pas sur les chiffres',
        'Consultants externes à 3-5k€/mois avec des délais lents',
      ],
      withLabel: 'Avec LyftAI',
      withList: [
        '1 dashboard centralisé, KPI en direct de toutes les plateformes',
        'Chiffres consolidés et recoupés automatiquement',
        'Briefing nocturne : les anomalies vous sont dites à l\'aube',
        'Recommandations proactives avec impact attendu en €',
        'Conseiller IA qui apprend votre marque et se souvient de tout',
      ],
    },
    stats: [
      { v: '+34%', l: 'ROAS moyen après 60 jours' },
      { v: '−22%', l: 'CAC sur les marques pilotes' },
      { v: '5min', l: 'Configuration complète des intégrations' },
      { v: '24/7', l: 'Briefing automatique des anomalies' },
    ],
    tabsTour: { eyebrow: 'Tour complet', title: '6 domaines, 40+ outils. Tout votre e-commerce dans un seul logiciel.' },
    tabs: [
      { id: 'dashboard', icon: '◉', title: 'Dashboard + Live View', desc: 'KPI en direct de toutes les plateformes, recommandations proactives, alertes d\'anomalies et globe 3D des visiteurs en temps réel.' },
      { id: 'kpi', icon: <Icon name="star" size={18} />, title: 'KPI Brain + Attribution', desc: 'Top produits, sources marketing, attribution total-impact et pays de facturation. Insights prêts.' },
      { id: 'clienti', icon: <Icon name="users" size={18} />, title: 'Clients (CRM IA)', desc: 'Segments RFM, analytics clients et insights IA — sur vos données Shopify réelles.' },
      { id: 'commerce', icon: '€', title: 'Inventaire + P&L', desc: 'Compte de résultat jusqu\'à l\'EBIT, intelligence stockout, broken sizes, ventes perdues € et coûts produit landed.' },
      { id: 'meta', icon: '⊞', title: 'Meta Ads complet', desc: 'Créa, Meta Detail au niveau de l\'annonce, Budget Advisor, Creative Fatigue et Lighthouse.' },
      { id: 'google', icon: <Icon name="search" size={18} />, title: 'Google Ads complet', desc: 'Suite jumelle de Meta : KPI, Detail, Produits, Budget Advisor et Lighthouse.' },
      { id: 'seo', icon: '⌕', title: 'SEO + CRO + Website', desc: 'Audit SEO, GSC réel, Keyword AI, AI Visibility (AEO), CRO et AI Website Scanner.' },
      { id: 'studio', icon: <Icon name="sparkles" size={18} />, title: 'Creative Studio', desc: 'Production générative d\'images et de créas à votre marque, Try-On produit et boards collaboratifs.' },
      { id: 'team', icon: <Icon name="sparkle" size={18} />, title: 'Escouade IA', desc: '8 agents C-suite (CEO · CFO · CMO · Ads · SEO · CRO · Data · Creative) avec mémoire partagée qui connaissent votre marque.' },
      { id: 'ops', icon: <Icon name="chat" size={18} />, title: 'Team & Operations', desc: 'Chat LyftTalk avec agents IA et appels vocaux, Lyftimer time-tracking, Projets & Tâches.' },
      { id: 'reports', icon: '▦', title: 'Rapports périodiques', desc: 'Hebdo, Mensuel, Trimestre, Année + digests email automatiques. Comparaison période sur période, export PDF.' },
    ],
    featuresTitle: { eyebrow: 'Ce qu\'il fait pour vous', title: 'Toute votre marque dans une seule plateforme' },
    features: [
      { icon: '◎', title: 'Dashboard temps réel + Live View', desc: 'KPI clés (Revenu, AOV, MER, CAC, LTV) en direct + globe 3D des visiteurs en temps réel depuis GA4.' },
      { icon: <Icon name="sparkle" size={18} />, title: 'Escouade IA', desc: '8 agents C-suite (CEO · CFO · CMO · Ads · SEO · CRO · Data · Creative) avec mémoire partagée. Ils lisent Shopify, Meta, GA4 et Search Console et répondent avec vos chiffres.' },
      { icon: <Icon name="scale" size={18} />, title: 'Meta + Google Ads complet', desc: 'Les deux suites : KPI, Detail au niveau de l\'annonce, Budget Advisor, Creative Fatigue et Lighthouse. Voyez où vous brûlez du budget.' },
      { icon: <Icon name="sparkles" size={18} />, title: 'Creative Studio', desc: 'Production générative d\'images et de créas à votre identité de marque, Try-On produit et boards collaboratifs.' },
      { icon: '⌕', title: 'Suite SEO + IA', desc: 'Audit on-page & multi-pages, Google Search Console réel, Keyword AI, AI Visibility (AEO), éditeur de contenu, Competitor.' },
      { icon: '€', title: 'Commerce intelligence', desc: 'Compte de résultat jusqu\'à l\'EBIT, Inventaire (stockout & ventes perdues €), Clients (segments RFM) et LTV & Cohortes.' },
      { icon: <Icon name="chat" size={18} />, title: 'Team & Operations', desc: 'Chat LyftTalk avec vos agents IA et appels vocaux, Lyftimer pour le time-tracking, Projets & Tâches. Toute l\'équipe au même endroit.' },
      { icon: '◈', title: 'Competitor Intel', desc: 'Annonces actives, prix et catalogues concurrents, avec analyse créative depuis l\'Ad Library.' },
    ],
    inAction: { eyebrow: 'Démo', title: 'Voir LyftAI en action', sub: 'Voici ce que vous trouvez dès la connexion : toutes les données de votre marque, prêtes, dans un seul dashboard.', explore: 'C\'est le vrai logiciel : cliquez à l\'intérieur et explorez →', openFull: '▶ Ouvrir la démo en plein écran', loading: 'Chargement de la démo…' },
    demoTitle: { eyebrow: 'Données en action', title: 'Exemple de ce que vous voyez chaque jour' },
    demoCards: {
      revenue: { eyebrow: 'Revenu 30j', value: '84 250 €', delta: '+24% vs période précédente' },
      orders: { eyebrow: 'Commandes par canal', value: '1 284', sub: 'Meta est le premier canal' },
      briefingTitle: 'Briefing automatique — ce matin',
      briefingItems: [
        { icon: <Icon name="warning" size={16} />, color: '#f87171', txt: 'ROAS Meta effondré à 1,4x (vs 2,8x moy. 7j)' },
        { icon: '▲', color: '#fbbf24', txt: 'AOV en baisse depuis 4 jours : 78€ → 71€' },
        { icon: '◆', color: BLUE, txt: 'Le top produit change : le nouveau best-seller scale' },
        { icon: 'ⓘ', color: GREEN, txt: 'Semaine record : 142 commandes (meilleure du mois)' },
      ],
      chatTitle: 'Performance Agent — chat',
      chatUser: 'Comment s\'est passée la semaine ?',
      chatAi: 'Alors, MER à {strong}2,6x{/strong} — au-dessus de l\'objectif de 2,5x que tu gardes. Semaine solide. AOV en ligne, mais {strong}le CTR Meta baisse depuis 3 jours{/strong}. Je creuse ?',
    },
    pricingTitle: { eyebrow: 'Tarifs', title: 'Vous payez selon votre taille. Les outils sont toujours tous là.' },
    pricingSub: 'Tous les outils inclus dans chaque plan. Le prix grandit avec vos commandes, jamais avec les fonctionnalités. 14 jours gratuits, sans carte, annulation en 1 clic.',
    pricingUI: { founder: 'Founder : −30% À VIE pour les 100 premières entreprises', founderCum: '· cumulable avec la remise annuelle', audBrand: 'Entreprises', audAgency: 'Agences & Freelances', agencySub: 'Gérez tous vos clients depuis un seul endroit. Vous payez selon le nombre d’entreprises, basculez instantanément de l’une à l’autre.', cadMonthly: 'Mensuel', cadAnnual: 'Annuel', billAnnual: 'par an', twoFree: '2 mois offerts', save: 'Vous économisez', billed: 'facturé' },
    plans: [
      { id: 'starter', name: 'Starter', price: '69€', period: '/mois', tagline: 'Jusqu\'à 500 commandes/mois. Parfait pour démarrer, tout déjà inclus.', features: ['✨ Tous les outils inclus', 'Jusqu\'à 500 commandes/mois', 'Toutes les intégrations (Shopify, Meta, Google, Klaviyo)', '2 utilisateurs', 'Support email 48h'], cta: 'Commencer avec Starter' },
      { id: 'growth', name: 'Growth', price: '149€', period: '/mois', tagline: 'De 500 à 2 000 commandes/mois. Pour les marques en croissance.', features: ['✨ Tous les outils inclus', '500 – 2 000 commandes/mois', '5 utilisateurs', 'Crédits Creative Lab (IA) étendus', 'Support prioritaire 12h'], cta: 'Commencer avec Growth', popular: true, popularLabel: 'LE PLUS CHOISI' },
      { id: 'scale', name: 'Scale', price: '299€', period: '/mois', tagline: 'De 2 000 à 7 000 commandes/mois. Pour les marques structurées.', features: ['✨ Tous les outils inclus', '2 000 – 7 000 commandes/mois', 'Utilisateurs illimités', 'Crédits Creative Lab (IA) maximum', 'CSM dédié'], cta: 'Commencer avec Scale' },
      { id: 'enterprise', name: 'Enterprise', price: 'Sur mesure', period: '', tagline: 'Plus de 7 000 commandes/mois. Gros volumes et besoins personnalisés.', features: ['✨ Tous les outils inclus', '7 000+ commandes/mois', 'SLA & onboarding dédiés', 'Intégrations personnalisées', 'Account manager dédié'], cta: 'Nous contacter', href: '#contact' },
    ],
    agency: {
      eyebrow: 'Pour agences & freelances',
      title: 'Gérez tous vos clients depuis une seule plateforme',
      sub: 'Un workspace par client, bascule immédiate, tous les outils inclus. Vous payez selon le nombre d\'entreprises, pas selon les fonctionnalités.',
      items: [
        { title: 'Multi-workspace', desc: 'Un compte, tous vos clients. Vous passez d\'une marque à l\'autre en 1 clic, avec des données isolées pour chacune.' },
        { title: 'White-label', desc: 'Votre logo et votre domaine : les clients voient VOTRE marque, pas la nôtre.' },
        { title: 'Interface en 5 langues', desc: 'Italien, anglais, espagnol, français, allemand — langue par client, détectée automatiquement.' },
        { title: 'Tarification par packs', desc: 'Entreprises incluses + overage par client supplémentaire. Évoluez avec votre portfolio.' },
      ],
      cta: 'Voir les plans agence',
    },
    testimonialsTitle: { eyebrow: 'Ce qu\'ils disent de nous', title: 'Des marques qui ont arrêté de choisir au feeling' },
    testimonials: [
      { name: 'Antoine M.', role: 'Fondateur, marque fitness DTC', text: 'Avant je devais ouvrir 4 dashboards chaque matin. Maintenant j\'ouvre le chat et il me dit : ROAS Meta en baisse, AOV stable, top produit qui change. En 2 minutes je sais quoi faire.', avatar: 'AM' },
      { name: 'Antoine R.', role: 'Head of Growth, marque DTC', text: 'Creative Fatigue m\'a sauvé. J\'avais 6 annonces au-dessus de la fréquence 4 et je brûlais 800€/jour pour rien. LyftAI me l\'a dit au jour 3.', avatar: 'AR' },
      { name: 'Sara M.', role: 'CMO, mode D2C', text: 'Le Performance Agent se souvient de tout. Je lui ai dit une fois que l\'objectif MER est 2,5x — jamais eu à le répéter. Il m\'alerte quand on passe en dessous.', avatar: 'SM' },
    ],
    faqTitle: { eyebrow: 'FAQ', title: 'Questions fréquentes' },
    faq: [
      { q: 'Comment LyftAI connaît ma marque ?', a: 'Vous remplissez la section Brand Identity avec description, cible, ton de voix, produits, brand guard, palette. L\'IA réutilise ces données comme system prompt pour chaque réponse.' },
      { q: 'Mes données sont-elles en sécurité ?', a: 'Oui. Chaque tenant a des identifiants isolés. Les données Shopify/Meta ne sont jamais partagées entre marques. Chiffrement en transit et au repos.' },
      { q: 'Combien de temps prend l\'installation ?', a: '5 minutes. Onboarding guidé : vous collez l\'URL du store et les tokens API des 4 intégrations principales.' },
      { q: 'Comment fonctionne l\'essai gratuit ?', a: 'Vous vous inscrivez, faites l\'onboarding, obtenez 14 jours d\'accès complet. Sans carte bancaire. À la fin vous choisissez un plan ou annulez.' },
      { q: 'Puis-je annuler à tout moment ?', a: 'Oui. Pas de contrats annuels, pas de pénalités. Annulez depuis le portail Stripe en 1 clic.' },
    ],
    contactTitle: { eyebrow: 'Parlons-en', title: 'Demandez une démo personnalisée' },
    contactSub: 'Nous répondons sous 24h. Pas de commerciaux, vous parlez directement avec nous.',
    contactForm: {
      name: 'Nom complet', namePlaceholder: 'Jean Dupont',
      company: 'Nom de l\'entreprise', companyPlaceholder: 'Acme Inc',
      email: 'Email', emailPlaceholder: 'jean@acme.com',
      phone: 'Téléphone', phonePlaceholder: '+33 6 12 34 56 78',
      website: 'Site web', websitePlaceholder: 'https://acme.com',
      revenue: 'Chiffre d\'affaires annuel', revenueSelect: '— Sélectionner —',
      message: 'Message', messagePlaceholder: 'Dites-nous ce que vous cherchez, sur quelles plateformes vous êtes, et ce que vous aimeriez améliorer...',
      required: 'Remplissez au moins nom, entreprise et email.',
      send: 'Envoyer la demande',
      sending: 'Envoi…',
      doneTitle: 'Message envoyé !',
      donesubtitle: 'Nous vous contacterons sous 24h par email.',
      disclaimer: 'En envoyant vous transmettez les données à LYFT SRL. Pas de newsletter, pas de spam.',
    },
    finalCta: { title: 'Arrêtez de choisir au feeling.', sub: 'Connectez votre store et en 5 minutes vous avez une IA qui connaît vos données mieux que vous.', btn: 'Démarrer l\'essai gratuit →' },
    footer: { tagline: 'Consultant IA pour les marques DTC' },
  },
  de: {
    nav: { features: 'Funktionen', pricing: 'Preise', contact: 'Kontakt', login: 'Anmelden', cta: 'Kostenlos testen', solutions: 'Lösungen' },
    solMenu: { commerce: 'Commerce & Analytics', ads: 'Werbung', website: 'Website & SEO', ai: 'KI & Kreativ', team: 'Team & Betrieb', all: 'Die ganze Plattform entdecken →' },
    bundle: {
      eyebrow: 'Ein einziges Abo',
      title: 'Alle Tools in einer Plattform',
      sub: 'Was Sie normalerweise über mehr als 10 separate Abos zahlen, ist hier bereits enthalten – zu einem Preis.',
      allinoneLabel: 'LyftAI · alles inklusive',
      allinoneNote: 'Alles inklusive, ein Login, ein Preis.',
      separateLabel: 'Dieselben Tools, einzeln',
      separateNote: 'Durchschnittliche Marktschätzung pro Kategorie (€/Monat).',
      items: [
        { name: 'Dashboard & BI-Analytics', price: 99 },
        { name: 'Multi-Plattform-Datenkonnektoren', price: 120 },
        { name: 'Meta + Google Ads Analytics', price: 89 },
        { name: 'E-Mail-Marketing-Analytics', price: 70 },
        { name: 'SEO-Suite (Audit, Keywords, GSC)', price: 99 },
        { name: 'KI-Marketing-Agententeam', price: 80 },
        { name: 'KI-Kreativ-Generator', price: 49 },
        { name: 'Wettbewerber- & Preis-Intelligence', price: 99 },
        { name: 'CRM & Kundensegmentierung', price: 60 },
        { name: 'Inventar & Stockout-Intelligence', price: 45 },
        { name: 'Projektmanagement', price: 39 },
        { name: 'Zeiterfassung', price: 29 },
        { name: 'Team-Chat', price: 25 },
      ],
      totalLabel: 'Einzelsumme',
      perMonth: '/Monat',
      saveLabel: 'Sie sparen',
      saveSuffix: 'pro Monat mit LyftAI',
    },
    hero: {
      badge: 'Kostenlos testen · 14 Tage',
      title1: 'Das KI-Betriebssystem',
      title2: 'für Ihren E-Commerce.',
      subtitle: 'Analytics, Kreatives, KI-Agenten und Team in einer Plattform, die Ihre Marke kennt. Verbinden Sie Shopify, Meta, Google und Klaviyo in 5 Minuten: LyftAI liest Ihre Daten und zeigt Ihnen täglich, wo Wachstumshebel liegen und wo Sie Geld verbrennen.',
      ctaPrimary: 'Kostenlosen Test starten',
      ctaSecondary: 'So funktioniert es',
      perks: ['Keine Kreditkarte nötig', 'Einrichtung in 5 Minuten', 'In 5 Sprachen verfügbar'],
    },
    trust: { label: 'Native Integrationen' },
    problem: {
      eyebrow: 'Das Problem',
      title: '4 Dashboards, 12 Tabellen, 0 klare Antworten',
      withoutLabel: 'Ohne LyftAI',
      withoutList: [
        '6 offene Dashboards: Shopify, Meta, Klaviyo, GA4, Stripe, Google Sheets',
        'Zeitverschwendung beim Abgleichen der Daten',
        'Anomalien erst nach 3 Tagen verbranntem Budget entdeckt',
        'Entscheidungen aus dem Bauch, nicht aus Zahlen',
        'Externe Berater für 3-5k€/Monat mit langen Reaktionszeiten',
      ],
      withLabel: 'Mit LyftAI',
      withList: [
        '1 zentrales Dashboard, Live-KPIs von allen Plattformen',
        'Zahlen automatisch konsolidiert und gegengeprüft',
        'Nächtliches Briefing: Anomalien werden Ihnen im Morgengrauen gemeldet',
        'Proaktive Empfehlungen mit erwartetem Impact in €',
        'KI-Berater, der Ihre Marke lernt und sich an alles erinnert',
      ],
    },
    stats: [
      { v: '+34%', l: 'Durchschn. ROAS nach 60 Tagen' },
      { v: '−22%', l: 'CAC bei Pilot-Marken' },
      { v: '5min', l: 'Komplette Einrichtung der Integrationen' },
      { v: '24/7', l: 'Automatisches Anomalie-Briefing' },
    ],
    tabsTour: { eyebrow: 'Komplette Tour', title: '6 Bereiche, 40+ Tools. Ihr ganzer E-Commerce in einer Software.' },
    tabs: [
      { id: 'dashboard', icon: '◉', title: 'Dashboard + Live View', desc: 'Live-KPIs von allen Plattformen, proaktive Empfehlungen, Anomalie-Alerts und 3D-Globus der Echtzeit-Besucher.' },
      { id: 'kpi', icon: <Icon name="star" size={18} />, title: 'KPI Brain + Attribution', desc: 'Top-Produkte, Marketing-Quellen, Total-Impact-Attribution und Abrechnungsländer. Insights sofort bereit.' },
      { id: 'clienti', icon: <Icon name="users" size={18} />, title: 'Kunden (KI-CRM)', desc: 'RFM-Segmente, Kunden-Analytics und KI-Insights — auf Ihren echten Shopify-Daten.' },
      { id: 'commerce', icon: '€', title: 'Inventar + GuV', desc: 'GuV bis zum EBIT, Stockout-Intelligence, Broken Sizes, entgangene Umsätze € und Landed-Produktkosten.' },
      { id: 'meta', icon: '⊞', title: 'Komplettes Meta Ads', desc: 'Kreativ, Meta Detail auf Anzeigenebene, Budget Advisor, Creative Fatigue und Lighthouse.' },
      { id: 'google', icon: <Icon name="search" size={18} />, title: 'Komplettes Google Ads', desc: 'Zwillings-Suite zu Meta: KPI, Detail, Produkte, Budget Advisor und Lighthouse.' },
      { id: 'seo', icon: '⌕', title: 'SEO + CRO + Website', desc: 'SEO-Audit, echte GSC, Keyword AI, AI Visibility (AEO), CRO und AI Website Scanner.' },
      { id: 'studio', icon: <Icon name="sparkles" size={18} />, title: 'Creative Studio', desc: 'Generative Produktion markengerechter Bilder und Kreativen, Produkt-Try-On und kollaborative Boards.' },
      { id: 'team', icon: <Icon name="sparkle" size={18} />, title: 'KI-Squad', desc: '8 C-Suite-Agenten (CEO · CFO · CMO · Ads · SEO · CRO · Data · Creative) mit geteiltem Gedächtnis, die Ihre Marke kennen.' },
      { id: 'ops', icon: <Icon name="chat" size={18} />, title: 'Team & Operations', desc: 'LyftTalk-Chat mit KI-Agenten und Sprachanrufen, Lyftimer-Zeiterfassung, Projekte & Aufgaben.' },
      { id: 'reports', icon: '▦', title: 'Periodische Berichte', desc: 'Woche, Monat, Quartal, Jahr + automatische E-Mail-Digests. Periodenvergleich, PDF-Export.' },
    ],
    featuresTitle: { eyebrow: 'Was es für Sie tut', title: 'Ihre ganze Marke in einer einzigen Plattform' },
    features: [
      { icon: '◎', title: 'Echtzeit-Dashboard + Live View', desc: 'Kern-KPIs (Umsatz, AOV, MER, CAC, LTV) live + 3D-Globus der Echtzeit-Besucher aus GA4.' },
      { icon: <Icon name="sparkle" size={18} />, title: 'KI-Squad', desc: '8 C-Suite-Agenten (CEO · CFO · CMO · Ads · SEO · CRO · Data · Creative) mit geteiltem Gedächtnis. Sie lesen Shopify, Meta, GA4 und Search Console und antworten mit Ihren Zahlen.' },
      { icon: <Icon name="scale" size={18} />, title: 'Komplettes Meta + Google Ads', desc: 'Beide Suites: KPI, Detail auf Anzeigenebene, Budget Advisor, Creative Fatigue und Lighthouse. Sehen Sie, wo Sie Budget verbrennen.' },
      { icon: <Icon name="sparkles" size={18} />, title: 'Creative Studio', desc: 'Generative Produktion markengerechter Bilder und Kreativen, Produkt-Try-On und kollaborative Boards.' },
      { icon: '⌕', title: 'SEO-Suite + KI', desc: 'On-Page- & Multi-Page-Audit, echte Google Search Console, Keyword AI, AI Visibility (AEO), Content-Editor, Competitor.' },
      { icon: '€', title: 'Commerce-Intelligence', desc: 'GuV bis zum EBIT, Inventar (Stockout & entgangene Umsätze €), Kunden (RFM-Segmente) und LTV & Kohorten.' },
      { icon: <Icon name="chat" size={18} />, title: 'Team & Operations', desc: 'LyftTalk-Chat mit Ihren KI-Agenten und Sprachanrufen, Lyftimer-Zeiterfassung, Projekte & Aufgaben. Ihr ganzes Team an einem Ort.' },
      { icon: '◈', title: 'Competitor Intel', desc: 'Aktive Anzeigen, Preise und Wettbewerber-Kataloge, mit Kreativ-Analyse aus der Ad Library.' },
    ],
    inAction: { eyebrow: 'Demo', title: 'LyftAI in Aktion sehen', sub: 'Das finden Sie direkt nach dem Login: alle Daten Ihrer Marke, startklar, in einem Dashboard.', explore: 'Es ist die echte Software: klicken Sie hinein und erkunden Sie →', openFull: '▶ Demo im Vollbild öffnen', loading: 'Demo wird geladen…' },
    demoTitle: { eyebrow: 'Daten in Aktion', title: 'Beispiel dessen, was Sie täglich sehen' },
    demoCards: {
      revenue: { eyebrow: 'Umsatz 30T', value: '84.250 €', delta: '+24% vs. Vorperiode' },
      orders: { eyebrow: 'Bestellungen nach Kanal', value: '1.284', sub: 'Meta ist der Top-Kanal' },
      briefingTitle: 'Automatisches Briefing — heute Morgen',
      briefingItems: [
        { icon: <Icon name="warning" size={16} />, color: '#f87171', txt: 'Meta-ROAS eingebrochen auf 1,4x (vs. 2,8x 7T-Schnitt)' },
        { icon: '▲', color: '#fbbf24', txt: 'AOV seit 4 Tagen rückläufig: 78€ → 71€' },
        { icon: '◆', color: BLUE, txt: 'Top-Produkt ändert sich: der neue Bestseller skaliert' },
        { icon: 'ⓘ', color: GREEN, txt: 'Rekordwoche: 142 Bestellungen (beste des Monats)' },
      ],
      chatTitle: 'Performance Agent — Chat',
      chatUser: 'Wie war die Woche?',
      chatAi: 'Also, MER bei {strong}2,6x{/strong} — über dem 2,5x-Ziel, das du hältst. Solide Woche. AOV im Plan, aber {strong}der Meta-CTR fällt seit 3 Tagen{/strong}. Soll ich das prüfen?',
    },
    pricingTitle: { eyebrow: 'Preise', title: 'Sie zahlen nach Ihrer Größe. Die Tools sind immer alle dabei.' },
    pricingSub: 'Alle Tools in jedem Plan enthalten. Der Preis wächst mit Ihren Bestellungen, nie mit Funktionen. 14 Tage kostenlos, keine Karte, Kündigung mit 1 Klick.',
    pricingUI: { founder: 'Founder: −30% LEBENSLANG für die ersten 100 Unternehmen', founderCum: '· kombinierbar mit dem Jahresrabatt', audBrand: 'Unternehmen', audAgency: 'Agenturen & Freelancer', agencySub: 'Verwalten Sie alle Ihre Kunden an einem Ort. Sie zahlen pro Anzahl der Unternehmen und wechseln sofort zwischen ihnen.', cadMonthly: 'Monatlich', cadAnnual: 'Jährlich', billAnnual: 'pro Jahr', twoFree: '2 Monate gratis', save: 'Sie sparen', billed: 'abgerechnet' },
    plans: [
      { id: 'starter', name: 'Starter', price: '69€', period: '/Monat', tagline: 'Bis zu 500 Bestellungen/Monat. Perfekt zum Start, alles schon dabei.', features: ['✨ Alle Tools inklusive', 'Bis zu 500 Bestellungen/Monat', 'Alle Integrationen (Shopify, Meta, Google, Klaviyo)', '2 Team-Nutzer', 'E-Mail-Support 48h'], cta: 'Mit Starter beginnen' },
      { id: 'growth', name: 'Growth', price: '149€', period: '/Monat', tagline: '500 bis 2.000 Bestellungen/Monat. Für wachsende Marken.', features: ['✨ Alle Tools inklusive', '500 – 2.000 Bestellungen/Monat', '5 Team-Nutzer', 'Erweiterte Creative-Lab-(KI)-Credits', 'Priority-Support 12h'], cta: 'Mit Growth beginnen', popular: true, popularLabel: 'AM HÄUFIGSTEN GEWÄHLT' },
      { id: 'scale', name: 'Scale', price: '299€', period: '/Monat', tagline: '2.000 bis 7.000 Bestellungen/Monat. Für strukturierte Marken.', features: ['✨ Alle Tools inklusive', '2.000 – 7.000 Bestellungen/Monat', 'Unbegrenzte Team-Nutzer', 'Maximale Creative-Lab-(KI)-Credits', 'Dedizierter CSM'], cta: 'Mit Scale beginnen' },
      { id: 'enterprise', name: 'Enterprise', price: 'Individuell', period: '', tagline: 'Über 7.000 Bestellungen/Monat. Hohe Volumen und individuelle Anforderungen.', features: ['✨ Alle Tools inklusive', '7.000+ Bestellungen/Monat', 'Dediziertes SLA & Onboarding', 'Individuelle Integrationen', 'Dedizierter Account Manager'], cta: 'Kontakt aufnehmen', href: '#contact' },
    ],
    agency: {
      eyebrow: 'Für Agenturen & Freelancer',
      title: 'Verwalten Sie alle Ihre Kunden über eine Plattform',
      sub: 'Ein Workspace pro Kunde, sofortiger Wechsel, alle Tools inklusive. Sie zahlen pro Anzahl der Unternehmen, nicht pro Funktion.',
      items: [
        { title: 'Multi-Workspace', desc: 'Ein Account, alle Ihre Kunden. Wechseln Sie mit 1 Klick von einer Marke zur anderen, mit isolierten Daten für jede.' },
        { title: 'White-Label', desc: 'Ihr Logo und Ihre Domain: Kunden sehen IHRE Marke, nicht unsere.' },
        { title: 'Oberfläche in 5 Sprachen', desc: 'Italienisch, Englisch, Spanisch, Französisch, Deutsch — Sprache pro Kunde, automatisch erkannt.' },
        { title: 'Paket-Pricing', desc: 'Inklusive Unternehmen + Overage pro zusätzlichem Kunden. Skaliert mit Ihrem Portfolio.' },
      ],
      cta: 'Agentur-Pläne ansehen',
    },
    testimonialsTitle: { eyebrow: 'Was man über uns sagt', title: 'Marken, die aufgehört haben, aus dem Bauch zu entscheiden' },
    testimonials: [
      { name: 'Andreas M.', role: 'Gründer, Fitness-DTC-Marke', text: 'Früher musste ich jeden Morgen 4 Dashboards öffnen. Jetzt öffne ich den Chat und er sagt mir: Meta-ROAS runter, AOV stabil, Top-Produkt ändert sich. In 2 Minuten weiß ich, was zu tun ist.', avatar: 'AM' },
      { name: 'Andreas R.', role: 'Head of Growth, DTC-Marke', text: 'Creative Fatigue hat mich gerettet. Ich hatte 6 Anzeigen über Frequenz 4 und verbrannte 800€/Tag für nichts. LyftAI hat es mir an Tag 3 gesagt.', avatar: 'AR' },
      { name: 'Sara M.', role: 'CMO, Fashion D2C', text: 'Der Performance Agent merkt sich alles. Ich habe ihm einmal gesagt, dass das MER-Ziel 2,5x ist — nie wiederholen müssen. Er warnt mich, wenn wir darunter fallen.', avatar: 'SM' },
    ],
    faqTitle: { eyebrow: 'FAQ', title: 'Häufige Fragen' },
    faq: [
      { q: 'Wie kennt LyftAI meine Marke?', a: 'Sie füllen den Bereich Brand Identity mit Beschreibung, Zielgruppe, Tonalität, Produkten, Brand Guard, Palette. Die KI nutzt diese Daten als System-Prompt für jede Antwort.' },
      { q: 'Sind meine Daten sicher?', a: 'Ja. Jeder Tenant hat isolierte Zugangsdaten. Shopify-/Meta-Daten werden nie zwischen Marken geteilt. Verschlüsselung bei Übertragung und im Ruhezustand.' },
      { q: 'Wie lange dauert die Einrichtung?', a: '5 Minuten. Geführtes Onboarding: Sie fügen Store-URL und API-Tokens der 4 Hauptintegrationen ein.' },
      { q: 'Wie funktioniert der kostenlose Test?', a: 'Sie melden sich an, machen das Onboarding und erhalten 14 Tage Vollzugriff. Keine Kreditkarte nötig. Am Ende wählen Sie einen Plan oder kündigen.' },
      { q: 'Kann ich jederzeit kündigen?', a: 'Ja. Keine Jahresverträge, keine Strafen. Kündigen Sie im Stripe-Portal mit 1 Klick.' },
    ],
    contactTitle: { eyebrow: 'Sprechen wir', title: 'Fordern Sie eine personalisierte Demo an' },
    contactSub: 'Wir antworten innerhalb von 24h. Keine Vertriebler, Sie sprechen direkt mit uns.',
    contactForm: {
      name: 'Vollständiger Name', namePlaceholder: 'Max Mustermann',
      company: 'Firmenname', companyPlaceholder: 'Acme Inc',
      email: 'E-Mail', emailPlaceholder: 'max@acme.com',
      phone: 'Telefon', phonePlaceholder: '+49 151 12345678',
      website: 'Website', websitePlaceholder: 'https://acme.com',
      revenue: 'Jahresumsatz', revenueSelect: '— Auswählen —',
      message: 'Nachricht', messagePlaceholder: 'Sagen Sie uns, wonach Sie suchen, auf welchen Plattformen Sie sind und was Sie verbessern möchten...',
      required: 'Mindestens Name, Firma und E-Mail ausfüllen.',
      send: 'Anfrage senden',
      sending: 'Senden…',
      doneTitle: 'Nachricht gesendet!',
      donesubtitle: 'Wir kontaktieren Sie innerhalb von 24h per E-Mail.',
      disclaimer: 'Mit dem Senden übermitteln Sie die Daten an LYFT SRL. Kein Newsletter, kein Spam.',
    },
    finalCta: { title: 'Hören Sie auf, aus dem Bauch zu entscheiden.', sub: 'Verbinden Sie Ihren Store und in 5 Minuten haben Sie eine KI, die Ihre Daten besser kennt als Sie.', btn: 'Kostenlosen Test starten →' },
    footer: { tagline: 'KI-Berater für DTC-Marken' },
  },
}

const LANG_LABELS = { it: 'IT', en: 'EN', es: 'ES', fr: 'FR', de: 'DE' }

// ─────────────────────────────────────────────────────────────
//  Page
// ─────────────────────────────────────────────────────────────
export default function WelcomePage() {
  const [lang, setLang] = useState('it')

  // Lingua: 1) scelta salvata su questo device 2) auto-rilevamento
  // (lingua del browser → poi paese dell'IP) 3) default 'it'.
  const langChosen = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    let alive = true
    try {
      const saved = localStorage.getItem('lyftai_lang')
      if (saved && I18N[saved]) { langChosen.current = true; setLang(saved); return }
    } catch {}

    // Nessuna scelta salvata → auto-rileva. Visitatore EN/ES/FR/DE vede subito
    // la landing nella sua lingua, senza dover cliccare il selettore.
    const browser = browserToLocale(navigator.language || (navigator.languages && navigator.languages[0]))
    if (browser && I18N[browser]) { setLang(browser); return }
    fetch('/api/geo')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!alive || langChosen.current) return
        const s = j?.suggested
        if (s && I18N[s]) setLang(s)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('lyftai_lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  // Scelta manuale dal selettore → vince sull'auto-rilevamento async.
  const chooseLang = (code) => { langChosen.current = true; setLang(code) }

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
        <Nav t={t} lang={lang} setLang={chooseLang} />
        <Hero t={t} />
        <TrustBar t={t} />
        <ProblemSolution t={t} />
        <StatsRow t={t} />
        <ProductShowcase t={t} />
        <TabsTour t={t} />
        <FeaturesGrid t={t} />
        <DemoCharts t={t} />
        <BundleCompare t={t} />
        <AgencySection t={t} />
        <Pricing t={t} lang={lang} />
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
      /* Icone piattaforme che "sparano" sessioni verso il globo */
      .hero-feeds { position: absolute; left: max(24px, 6vw); top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 18px; }
      .feed-pill { position: relative; display: inline-flex; align-items: center; padding: 8px 14px; border-radius: 12px;
        background: rgba(8,8,15,0.6); border: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(8px);
        font-size: 13px; font-weight: 800; color: #fff; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }
      .feed-pill b { font-weight: 800; }
      .feed-pill::before { content: ''; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; box-shadow: 0 0 10px currentColor; background: currentColor; }
      .feed-meta { color: #2997ff; } .feed-google { color: #ff6d4d; } .feed-ga4 { color: #ff9f0a; }
      .feed-klaviyo { color: #34e7b0; } .feed-gsc { color: #bf5af2; }
      /* beam lineari animati che partono dalle pill verso il globo */
      .feed-beam { position: absolute; left: 100%; top: 50%; width: clamp(60px, 12vw, 220px); height: 2px; transform: translateY(-50%);
        background: linear-gradient(90deg, currentColor, transparent); border-radius: 2px; overflow: hidden; opacity: 0.75; }
      .feed-beam::after { content: ''; position: absolute; top: 0; left: -40%; width: 40%; height: 100%;
        background: linear-gradient(90deg, transparent, #fff, transparent); animation: feedFlow 2.2s linear infinite; }
      .feed-google .feed-beam::after { animation-delay: .5s; } .feed-ga4 .feed-beam::after { animation-delay: 1s; }
      .feed-klaviyo .feed-beam::after { animation-delay: 1.5s; } .feed-gsc .feed-beam::after { animation-delay: 2s; }
      @keyframes feedFlow { from { left: -40%; } to { left: 120%; } }
      @media (max-width: 900px) { .hero-feeds { display: none; } }

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

// LogoMark importato dal componente condiviso — stesso usato nella sidebar dell.app

// ─────────────────────────────────────────────────────────────
//  Nav with language picker
// ─────────────────────────────────────────────────────────────
function Nav({ t, lang, setLang }) {
  const [openLang, setOpenLang] = useState(false)
  const [openSol, setOpenSol] = useState(false)
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
          <button onClick={() => setOpenSol(o => !o)} style={{ ...navLinkStyle, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', color: openSol ? '#fff' : navLinkStyle.color }}>
            {t.nav.solutions} <span style={{ fontSize: 8, opacity: 0.6, transform: openSol ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform .2s' }}>▾</span>
          </button>
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
              <span style={{ display: 'inline-flex' }}><Icon name="globe" size={14} /></span> {LANG_LABELS[lang]}
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
                    {lang === code ? <Icon name="check" size={12} /> : ' '} {LANG_LABELS[code]}
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

      {/* Mega-menu Soluzioni */}
      {openSol && (
        <>
          <div onClick={() => setOpenSol(false)} style={{ position: 'fixed', inset: 0, top: 64, zIndex: 80 }} />
          <div onMouseLeave={() => setOpenSol(false)} style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 101,
            background: 'rgba(8,8,16,0.98)', backdropFilter: 'blur(24px)',
            borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
          }}>
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 26 }}>
              {SOLUTIONS.map(col => (
                <div key={col.key}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: ACCENT, marginBottom: 12 }}>{t.solMenu?.[col.key] || col.key}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {col.items.map(it => (
                      <Link key={it} href="/register" onClick={() => setOpenSol(false)} style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.78)', textDecoration: 'none', fontWeight: 500 }} className="sol-item">{it}</Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 22px' }}>
              <a href="#features" onClick={() => setOpenSol(false)} style={{ fontSize: 13.5, fontWeight: 800, color: BLUE, textDecoration: 'none' }}>{t.solMenu?.all || 'Explore →'}</a>
            </div>
          </div>
        </>
      )}
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
      {/* Globo Shopify-style di sfondo: visitatori live + sessioni da Meta/Google/GA4 */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '50%', right: '-12vw', transform: 'translateY(-50%)',
          width: 'min(1050px, 80vw)', height: 'min(1050px, 80vw)', opacity: 1,
        }}>
          <LandingGlobe />
        </div>
        {/* Archi curvi (stile globo) che partono da Meta/Google/GA4 e passano
            sotto l'headline fino al globo, con flusso animato */}
        {/* Icone piattaforme che alimentano il globo con le sessioni (beam lineari) */}
        <div className="hero-feeds">
          <span className="feed-pill feed-meta"><b>Meta</b><i className="feed-beam" /></span>
          <span className="feed-pill feed-google"><b>Google</b><i className="feed-beam" /></span>
          <span className="feed-pill feed-ga4"><b>GA4</b><i className="feed-beam" /></span>
          <span className="feed-pill feed-klaviyo"><b>Klaviyo</b><i className="feed-beam" /></span>
          <span className="feed-pill feed-gsc"><b>Search Console</b><i className="feed-beam" /></span>
        </div>
      </div>

      <div className="hero-scale" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
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
            {t.hero.perks.map((p, i) => <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={13} /> {p}</span>)}
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
        {['Shopify', 'Meta Ads', 'Google Ads', 'GA4', 'Klaviyo', 'Search Console'].map(name => (
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
                  <span style={{ color: '#f87171', fontWeight: 900, fontSize: 14, flexShrink: 0, lineHeight: 1.5 }}><Icon name="close" size={14} /></span>
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
                  <span style={{ color: GREEN, fontWeight: 900, fontSize: 14, flexShrink: 0, lineHeight: 1.5 }}><Icon name="check" size={14} /></span>
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

function AgencySection({ t }) {
  const a = t.agency
  if (!a) return null
  return (
    <section id="agency" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 60px' }}>
      <Reveal>
        <div className="glass-card-static" style={{
          padding: 'clamp(28px, 5vw, 56px)',
          background: `linear-gradient(180deg, rgba(191,90,242,0.10), rgba(0,0,0,0.55))`,
          border: `1px solid ${ACCENT}33`,
        }}>
          <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
            <div style={{ fontSize: 12, color: ACCENT, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{a.eyebrow}</div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, color: '#fff', margin: '12px 0 0', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{a.title}</h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', marginTop: 14, lineHeight: 1.55 }}>{a.sub}</p>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16, marginTop: 36,
          }}>
            {a.items.map(it => (
              <div key={it.title} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: '18px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: '#22c55e', fontWeight: 900 }}><Icon name="check" size={15} /></span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{it.title}</span>
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 1.5 }}>{it.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <a href="#pricing" className="cta-btn" style={{
              display: 'inline-block', padding: '13px 26px', borderRadius: 999,
              background: `linear-gradient(135deg, ${ACCENT}, ${BLUE})`,
              color: '#fff', textDecoration: 'none', fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.01em',
            }}>{a.cta} →</a>
          </div>
        </div>
      </Reveal>
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
              <span style={{ color: GREEN, display: 'inline-flex' }}><Icon name="chart-line" size={26} /></span>
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
              <span style={{ color: BLUE, display: 'inline-flex' }}><Icon name="cart" size={26} /></span>
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

function Pricing({ t, lang = 'it' }) {
  const pui = t.pricingUI || {}
  const planAccents = ['#0ea5e9', ACCENT, GREEN, '#f59e0b']
  const [audience, setAudience] = useState('brand') // 'brand' | 'agency'
  const [cadB, setCadB] = useState('annual')        // cadenza dei piani brand
  const BRAND_CAD = [
    { id: 'monthly', label: pui.cadMonthly || 'Mensile', months: 1,  factor: 1,      off: 0, bill: '' },
    // Annuale = 2 mesi gratis → paghi 10 mensilità su 12 (factor 10/12).
    { id: 'annual',  label: pui.cadAnnual || 'Annuale',  months: 12, factor: 10 / 12, off: 1, bill: pui.billAnnual || 'all’anno' },
  ]
  const bc = BRAND_CAD.find(x => x.id === cadB)
  const eur0 = n => `€${Number(n).toLocaleString(lang, { maximumFractionDigits: 0 })}`
  return (
    <section id="pricing" style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 100px' }}>
      <Reveal>
        <SectionHeader eyebrow={t.pricingTitle.eyebrow} title={t.pricingTitle.title} />
        <p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 14, maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' }}>
          {audience === 'agency' ? (pui.agencySub || '') : t.pricingSub}
        </p>
      </Reveal>

      {/* Toggle pubblico: Aziende vs Agenzie & Freelance */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
        <div style={{ display: 'inline-flex', gap: 4, padding: 5, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {[{ id: 'brand', l: pui.audBrand || 'Aziende' }, { id: 'agency', l: pui.audAgency || 'Agenzie & Freelance' }].map(o => {
            const on = audience === o.id
            return (
              <button key={o.id} type="button" onClick={() => setAudience(o.id)} style={{
                padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: on ? ACCENT : 'transparent', color: on ? '#0a0a14' : 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 800,
              }}>{o.l}</button>
            )
          })}
        </div>
      </div>

      {audience === 'agency' ? (
        <div style={{ maxWidth: 1180, margin: '40px auto 0' }}>
          <AgencyPricing />
        </div>
      ) : (
      <>
      {/* Founder banner brand */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', textAlign: 'center', padding: '12px 18px', borderRadius: 14, marginTop: 28, maxWidth: 760, marginLeft: 'auto', marginRight: 'auto', background: 'linear-gradient(90deg, rgba(34,197,94,0.16), rgba(41,151,255,0.16))', border: '1px solid rgba(34,197,94,0.35)' }}>
        <span style={{ fontSize: 18 }}>🎉</span>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: '#86efac' }}>{pui.founder || 'Founder: −30% A VITA per le prime 100 aziende'}</span>
        <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>{pui.founderCum || '· cumulabile con lo sconto annuale'}</span>
      </div>
      {/* Toggle cadenza brand */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
        <div style={{ display: 'inline-flex', gap: 4, padding: 5, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {BRAND_CAD.map(x => {
            const on = cadB === x.id
            return (
              <button key={x.id} type="button" onClick={() => setCadB(x.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: on ? ACCENT : 'transparent', color: on ? '#0a0a14' : 'rgba(255,255,255,0.7)', fontSize: 13.5, fontWeight: 800 }}>
                {x.label}
                {x.off > 0 && <span style={{ fontSize: 10.5, fontWeight: 900, padding: '2px 7px', borderRadius: 999, background: on ? 'rgba(10,10,20,0.18)' : 'rgba(34,197,94,0.16)', color: on ? '#0a0a14' : '#22c55e' }}>{pui.twoFree || '2 mesi gratis'}</span>}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 18, maxWidth: 1180, margin: '40px auto 0',
      }}>
        {t.plans.map((p, i) => {
          const hot = p.popular || p.best
          const hotLabel = p.popularLabel || p.bestLabel
          return (
          <Reveal key={p.id} delay={i * 120}>
            <div className="glass-card-static" style={{
              padding: 30, position: 'relative', height: '100%',
              ...(hot && {
                borderTop: `2px solid ${planAccents[i]}`,
                boxShadow: `0 30px 80px rgba(0,0,0,0.80), 0 0 80px ${planAccents[i]}22, inset 0 1.5px 0 ${planAccents[i]}88`,
              }),
            }}>
              {hot && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  padding: '4px 14px', borderRadius: 999, whiteSpace: 'nowrap',
                  background: planAccents[i], color: '#fff',
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
                }}>{hotLabel}</div>
              )}
              <div style={{ fontSize: 12, color: planAccents[i], fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                {p.name}
              </div>
              {(() => {
                const m = parseInt(String(p.price).replace(/[^0-9]/g, ''), 10)
                if (!Number.isFinite(m)) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14, marginBottom: 10 }}>
                      <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em' }}>{p.price}</span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{p.period}</span>
                    </div>
                  )
                }
                const eff = Math.round(m * bc.factor)
                const total = Math.round(eff * bc.months)
                const save = Math.round((m - eff) * bc.months)
                return (
                  <div style={{ marginTop: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em' }}>{eur0(eff)}</span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{p.period}</span>
                    </div>
                    {bc.off > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textDecoration: 'line-through' }}>{eur0(m)}{p.period}</span>
                        <span style={{ fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.16)', color: '#ef4444' }}>{pui.save || 'Risparmi'} {eur0(save)}</span>
                      </div>
                    )}
                    {bc.off > 0 && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{eur0(total)} {pui.billed || 'fatturato'} {bc.bill}</div>}
                  </div>
                )
              })()}
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 24, minHeight: 38 }}>{p.tagline}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 26 }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 11, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                    <span style={{ color: planAccents[i], fontWeight: 800, fontSize: 14, lineHeight: 1.4 }}><Icon name="check" size={14} /></span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={p.href || '/register'} className="cta-btn" style={{
                display: 'block', textAlign: 'center',
                padding: '13px 18px', borderRadius: 999,
                background: hot ? `linear-gradient(135deg, ${ACCENT}, ${BLUE})` : 'rgba(255,255,255,0.06)',
                border: hot ? 'none' : '1px solid rgba(255,255,255,0.12)',
                color: '#fff', textDecoration: 'none',
                fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.01em',
              }}>{p.cta}</Link>
            </div>
          </Reveal>
          )
        })}
      </div>
      </>
      )}
    </section>
  )
}


// ─────────────────────────────────────────────────────────────
//  Product showcase — il SOFTWARE REALE embeddato (iframe /demo)
//  dentro la cornice del PC, navigabile senza lasciare la landing.
// ─────────────────────────────────────────────────────────────
function ProductShowcase({ t }) {
  const ia = t.inAction
  const ref = useRef(null)
  const [load, setLoad] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setLoad(true); obs.disconnect() } }, { rootMargin: '300px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <section style={{ maxWidth: 1680, margin: '0 auto', padding: '64px clamp(12px,4vw,32px) 40px' }}>
      <Reveal><SectionHeader eyebrow={ia.eyebrow} title={ia.title} /></Reveal>
      <Reveal><p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.55)', maxWidth: 660, margin: '14px auto 0', padding: '0 12px' }}>{ia.sub} <span style={{ color: ACCENT, fontWeight: 700 }}>{ia.explore}</span></p></Reveal>

      <Reveal>
        <div ref={ref} style={{ marginTop: 40, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 40px 120px rgba(0,0,0,0.7), 0 0 90px rgba(123,91,255,0.14)', background: '#0b0b14' }}>
          {/* Barra finestra */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
            <div style={{ flex: 1, textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>app.lyftai.io · demo</div>
          </div>
          {/* Software reale embeddato */}
          <div style={{ position: 'relative', width: '100%', height: 'clamp(460px, 78vh, 860px)', background: '#07070e' }}>
            {load ? (
              <iframe src="/demo" title="Demo LyftAI" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'rgba(255,255,255,0.5)' }}>
                <span style={{ width: 46, height: 46, borderRadius: 12, background: `linear-gradient(135deg,${ACCENT},${BLUE})` }} />
                <div style={{ fontSize: 13 }}>{ia.loading}</div>
              </div>
            )}
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div style={{ textAlign: 'center', marginTop: 26 }}>
          <Link href="/demo" className="cta-btn" style={{ display: 'inline-block', padding: '14px 28px', borderRadius: 999, background: `linear-gradient(135deg,${ACCENT},${BLUE})`, color: '#fff', textDecoration: 'none', fontSize: 15, fontWeight: 800, boxShadow: '0 12px 40px rgba(123,91,255,0.3)' }}>{ia.openFull}</Link>
        </div>
      </Reveal>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
//  Bundle / Comparison — un abbonamento vs N tool separati
// ─────────────────────────────────────────────────────────────
function BundleCompare({ t }) {
  const b = t.bundle
  if (!b) return null
  const total = b.items.reduce((s, i) => s + i.price, 0)
  const full = 69 // prezzo d'ingresso: tutti i tool inclusi "da" questo prezzo
  const save = total - full
  const euro = (n) => '€' + n.toLocaleString('it-IT')
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 40px' }}>
      <Reveal><SectionHeader eyebrow={b.eyebrow} title={b.title} /></Reveal>
      <Reveal>
        <p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 14, maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' }}>{b.sub}</p>
      </Reveal>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginTop: 50, alignItems: 'stretch' }}>
        {/* All-in-one */}
        <Reveal>
          <div className="glass-card-static" style={{ padding: 30, height: '100%', borderTop: `2px solid ${GREEN}`, boxShadow: `0 30px 80px rgba(0,0,0,0.8), 0 0 80px ${GREEN}22, inset 0 1.5px 0 ${GREEN}88`, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, color: GREEN, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{b.allinoneLabel}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>da</span>
              <span style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-0.03em' }}>{euro(full)}</span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>{b.perMonth}</span>
            </div>
            <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', marginTop: 10, marginBottom: 20 }}>{b.allinoneNote}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1 }}>
              {b.items.map(it => (
                <li key={it.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                  <span style={{ color: GREEN, fontWeight: 800 }}><Icon name="check" size={14} /></span>{it.name}
                  <span style={{ marginLeft: 'auto', color: GREEN, fontSize: 12, fontWeight: 700 }}>incluso</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        {/* Separate */}
        <Reveal delay={120}>
          <div className="glass-card-static" style={{ padding: 30, height: '100%', opacity: 0.92, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{b.separateLabel}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
              <span style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-0.03em', color: '#ff6b6b', textDecoration: 'line-through', textDecorationColor: 'rgba(255,107,107,0.4)' }}>{euro(total)}</span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>{b.perMonth}</span>
            </div>
            <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', marginTop: 10, marginBottom: 20 }}>{b.separateNote}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1 }}>
              {b.items.map(it => (
                <li key={it.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>{it.name}
                  <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{euro(it.price)}</span>
                </li>
              ))}
            </ul>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 12, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{b.totalLabel}</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#ff6b6b', fontVariantNumeric: 'tabular-nums' }}>{euro(total)}{b.perMonth}</span>
            </div>
          </div>
        </Reveal>
      </div>
      {/* Savings banner */}
      <Reveal>
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, padding: '16px 28px', borderRadius: 999, background: `linear-gradient(135deg, ${GREEN}22, ${BLUE}22)`, border: `1px solid ${GREEN}55` }}>
            <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>{b.saveLabel}</span>
            <span style={{ fontSize: 30, fontWeight: 900, color: GREEN, letterSpacing: '-0.02em' }}>{euro(save)}</span>
            <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>{b.saveSuffix} · −{Math.round(save / total * 100)}%</span>
          </div>
        </div>
      </Reveal>
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
              <div style={{ fontSize: 56, marginBottom: 16, color: GREEN }}><Icon name="check" size={56} /></div>
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
                  <Icon name="warning" size={13} /> {error}
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
            <Link href="/privacy" style={footerLinkStyle}>Privacy Policy</Link>
            <Link href="/terms" style={footerLinkStyle}>Termini di Servizio</Link>
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
        <div>Made with <Icon name="sparkle" size={12} /> in Italia</div>
      </div>
    </footer>
  )
}
const footerLinkStyle = {
  color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color .15s',
}
