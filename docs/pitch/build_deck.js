// Genera i 2 pitch deck (IT/EN) di LyftAI — stesso design system del SaaS.
const fs = require('fs')
const path = require('path')

const ACCENT = '#bf5af2', BLUE = '#2997ff', GREEN = '#22c55e'

const LOGO_T = (u) => `
<svg viewBox="0 0 100 100" class="logo-svg">
  <defs>
    <linearGradient id="lgm-${u}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${ACCENT}"/><stop offset="100%" stop-color="${BLUE}"/>
    </linearGradient>
    <linearGradient id="lgl-${u}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f5f5f7" stop-opacity="0.9"/><stop offset="100%" stop-color="#f5f5f7" stop-opacity="0.3"/>
    </linearGradient>
  </defs>
  <g class="logo-ring"><circle cx="50" cy="50" r="44" fill="none" stroke="url(#lgm-${u})" stroke-width="2" stroke-dasharray="60 8 30 8" opacity="0.7"/></g>
  <g transform="translate(50 50)">
    <rect x="-26" y="-26" width="52" height="52" rx="10" transform="rotate(45)" fill="url(#lgm-${u})" opacity="0.95"/>
    <rect x="-26" y="-26" width="52" height="26" rx="10" transform="rotate(45)" fill="url(#lgl-${u})" opacity="0.18"/>
  </g>
  <g transform="translate(50 50)" fill="#f5f5f7"><rect x="-9" y="-14" width="5" height="28" rx="2"/><rect x="-9" y="9" width="18" height="5" rx="2"/></g>
  <circle cx="78" cy="22" r="3" fill="${GREEN}"><animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite"/></circle>
</svg>`

// ─────────────────────────────────────────────────────────────
//  Contenuti IT / EN
// ─────────────────────────────────────────────────────────────
const IT = {
  htmlLang: 'it', title: 'LyftAI — Investor Pitch',
  badge: 'Investor pitch · 10 minuti · 2026',
  cover: {
    h1a: 'Il sistema operativo AI', h1b: 'del tuo e-commerce.',
    sub: 'Un’unica piattaforma che legge i dati di Shopify, Meta, Google ed email, li trasforma in decisioni e li affida a una squadra di agenti AI che conosce il brand.',
    meta: 'LYFT SRL · lyftai.io · 5 lingue (IT EN ES FR DE)',
  },
  problem: {
    eyebrow: 'Il problema', title: '6 dashboard, 12 spreadsheet, 0 risposte chiare',
    items: [
      ['6+ tool scollegati', 'Shopify, Meta, Google Ads, GA4, email, fogli: numeri che non combaciano mai'],
      ['ROAS che mente', 'le piattaforme si auto-attribuiscono vendite: il budget viene allocato sul numero sbagliato'],
      ['Anomalie in ritardo', 'giorni di spend bruciato prima di accorgersene'],
      ['Stack costoso', 'i tool verticali sommati costano €700–900/mese e non si parlano'],
    ],
    stat: ['€3-5k/mese', 'il costo dei consulenti esterni che i brand pagano per avere risposte'],
  },
  solution: {
    eyebrow: 'La soluzione', title: 'Dal dato alla decisione, in una piattaforma sola',
    steps: [
      ['01', 'Connetti in 5 minuti', 'Onboarding guidato a 10 step, OAuth one-click, zero token. Mentre finisci, i dati sono già pronti.'],
      ['02', 'Vedi tutto in un posto', 'KPI live cross-piattaforma, consolidati e coerenti. Anche da mobile.'],
      ['03', 'Capisci cosa è vero', 'Incrementalità (MMM), attribuzione, LTV corretto per maturità: i numeri su cui decidere.'],
      ['04', 'Agisci con l’AI', '8 agenti C-suite che conoscono il brand, creative generative, report automatici.'],
    ],
  },
  product: {
    eyebrow: 'Il prodotto', title: '8 aree · 45+ moduli · tutti inclusi in ogni piano',
    areas: [
      ['🛒', 'Commerce & Analytics', 'Dashboard live + globo 3D, Inventario (stockout €), P&L per prodotto, Costi landed, KPI Brain, Attribuzione, LTV & Coorti, CRM clienti (RFM), Email multi-provider, Conto Economico', '10 moduli'],
      ['🤖', 'Productivity AI', 'Squadra AI (8 agenti C-suite), Performance Agent, LyftTalk (chat + call di gruppo), Progetti & Task, Lyftimer, Creative Studio & Lab', '7 moduli'],
      ['🌐', 'Intelligence Website', 'CRO giorno-preciso, AI Website Scanner, SEO Audit + AEO, Competitor Intel, Prezzi vs Competitor, Creative Intel', '6 moduli'],
      ['📱', 'Meta Ads', 'Creative, Detail ad-level, KPI + segmenti pubblico, Lighthouse, Creative Fatigue, Budget Advisor', '6 moduli'],
      ['🔍', 'Google Ads', 'Suite gemella: Detail, Prodotti (PMax), KPI, Lighthouse, Budget Advisor', '5 moduli'],
      ['📈', 'Incrementalità (MMM)', 'Contributo reale per canale, curve di saturazione, simulatore budget, geo-lift designer', '4 moduli'],
      ['📊', 'Reports', 'Weekly/Monthly/Quarter/Year, PDF brandizzati multilingua, invii automatici via email', '7 moduli'],
      ['⚙️', 'System', 'Centro assistenza, Integrazioni, Brand Identity, Billing', '4 moduli'],
    ],
  },
  truth: {
    eyebrow: 'Differenziatore nº1', title: 'Vendiamo la verità sul marketing',
    sub: 'Le ad platform si auto-attribuiscono vendite che sarebbero arrivate comunque. LyftAI separa il ricavo incrementale dalla baseline organica — la profondità delle suite MMM enterprise, a prezzo SaaS.',
    barLabelA: 'ROAS riportato da Meta', barLabelB: 'ROAS incrementale reale',
    barA: '3.8×', barB: '1.9×',
    points: [
      ['Curve di saturazione', 'quanto rende il prossimo euro, canale per canale'],
      ['Simulatore budget', 'sposta la spesa con lo slider → forecast a 2/4/8 settimane'],
      ['Geo-lift designer', 'il test causale che trasforma la stima in certezza'],
      ['LTV a maturità', 'corregge la sottostima dei brand in crescita → scaling con fiducia'],
    ],
  },
  ai: {
    eyebrow: 'Differenziatore nº2', title: 'AI nativa che conosce il brand',
    sub: 'La Brand Identity (prodotti, tone of voice, competitor, obiettivi) è il contesto di ogni agente: risposte sul TUO brand, coi TUOI numeri, con memoria persistente.',
    chatQ: 'Com’è andata la settimana?',
    chatA: 'MER a 2,6× — sopra il tuo target di 2,5×. AOV in linea, ma il CTR Meta cala da 3 giorni. Lo approfondisco?',
    cards: [
      ['Squadra AI', '8 agenti C-suite (CEO · CFO · CMO · Ads · SEO · CRO · Data · Creative) con gerarchia e memoria condivisa, anche in call vocale'],
      ['Creative Studio', 'Immagini prodotto ad alta fedeltà, Try-On, training del modello sul prodotto, board collaborative'],
      ['Report che si scrivono da soli', 'Insight AI in ogni tab, PDF automatici nella lingua del cliente'],
    ],
  },
  platform: {
    eyebrow: 'Differenziatore nº3', title: 'Una piattaforma, due mercati',
    cards: [
      ['Tutto incluso', 'Sostituisce 10+ abbonamenti (BI, MMM, SEO, creative AI, CRM, PM, chat…): valore di mercato €900+/mese', '€900+/mese sostituiti'],
      ['Fair pricing verificato', 'Il piano è agganciato al volume ordini REALE letto da Shopify: impossibile sbagliare piano, upgrade solo quando il cliente cresce', 'Zero attrito'],
      ['Multi-tenant per agenzie', 'Un account, N workspace clienti isolati, switch in 1 click, white-label, lingua per-cliente', '2º motore di revenue'],
      ['Europa-ready', 'Prodotto, PDF ed email in 5 lingue con auto-detect. GDPR by design', '5 lingue'],
    ],
  },
  pricing: {
    eyebrow: 'Business model', title: 'Il prezzo cresce col cliente, mai con le funzioni',
    plans: [
      ['Starter', '€69', 'fino a 500 ordini/mese'],
      ['Growth', '€149', '500 – 2.000 ordini/mese'],
      ['Scale', '€299', '2.000 – 7.000 ordini/mese'],
      ['Enterprise', '€599', '7.000+ ordini/mese'],
    ],
    notes: ['Agenzie & freelance: €199 → €1.990/mese per portfolio clienti', 'Crediti AI (Creative Lab/Studio) come revenue aggiuntiva', 'Annuale = 2 mesi gratis · Trial 14 giorni senza carta', 'Canali: signup diretto (Stripe) + Shopify App Store (Managed Pricing)'],
  },
  unit: {
    eyebrow: 'Unit economics', title: 'Margini da software, payback da SaaS sano',
    stats: [
      ['€150/m', 'ARPA blended per e-commerce (piani €69–599 + agenzie + crediti AI)'],
      ['~€15/m', 'costo medio di servizio per azienda (infra + inference AI) → margine lordo ~90%'],
      ['<3 mesi', 'CAC payback target (canali: App Store Shopify + partnership agenzie)'],
      ['~300', 'e-commerce per l’EBITDA breakeven (struttura leggera, AI-augmented)'],
    ],
    banner: 'A 5.000 e-commerce: €9M ARR con EBITDA target ~35-40% (~€3M+/anno). Il pre-seed da €300k si ripaga con pochi mesi di utile oltre il breakeven; ritorno atteso per l’investitore 10-15× a 36-48 mesi (multipli SaaS 4-6× ARR). Assunzioni: churn 3-4%/mese, ARPA €150.',
  },
  market: {
    eyebrow: 'Mercato', title: 'Un mercato grande che cresce del 20% l’anno',
    stats: [
      ['$23,7B', 'TAM 2030 · e-commerce analytics software (da $9,6B nel 2025, CAGR ~20%)'],
      ['$2-3B', 'SAM · analytics & attribution per brand Shopify SMB-mid (EU: ~600k store attivi nei top-5 mercati)'],
      ['€9M ARR', 'SOM a 36 mesi · obiettivo 5.000 e-commerce × €150/mese = <0,9% degli store attivi europei'],
    ],
    banner: 'L’87% dei brand Shopify Plus non usa ALCUNA piattaforma di attribution: riconcilia le ads con gli ordini in un foglio di calcolo. Il mercato non è rubare clienti — è convertire chi decide alla cieca.',
  },
  comp: {
    eyebrow: 'Competitor & posizionamento', title: 'Soli nel quadrante verità × piattaforma',
    rows: [
      ['Triple Whale', 'dashboard + attribution DTC · $53M raised', 'US-only, EN-only, $129→$2k+/mese, niente MMM né suite operativa'],
      ['Northbeam', 'multi-touch attribution research-grade', '$1k+/mese, solo misurazione: nessuna azione, nessun AI layer'],
      ['Polar Analytics', 'BI + agenti per brand $10M+ GMV', 'richiede data team; niente P&L, inventario, CRM, PM'],
      ['MMM enterprise', 'incrementalità seria (Measured, Rockerbox…)', 'decine di migliaia €/anno, fuori portata SMB'],
      ['Stack fai-da-te', 'lo status quo dell’87%', '€700-900/mese in tool scollegati, zero verità incrementale'],
    ],
    pos: 'LyftAI: incrementalità enterprise + sistema operativo completo, a prezzo SMB. Cunei: Europa-first (5 lingue, GDPR), fair pricing per ordini, dual-market brand+agenzie.',
  },
  whynow: {
    eyebrow: 'Perché ora', title: 'Tre onde che si incrociano',
    items: [
      ['CAC in crescita', 'La differenza tra chi scala e chi chiude è l’allocazione del budget sulla verità incrementale — oggi riservata a chi spende decine di migliaia di € in suite enterprise'],
      ['Costo marginale AI ~ zero', 'La produzione creativa e la consulenza analitica sono state commoditizzate: LyftAI le impacchetta nel workflow quotidiano'],
      ['Consolidamento dello stack', 'Chi possiede dati + decisioni + esecuzione possiede il cliente. I tool mono-feature verranno assorbiti'],
    ],
  },
  moat: {
    eyebrow: 'Moat tecnico', title: 'Velocità di esecuzione come vantaggio strutturale',
    stats: [['45+', 'moduli spediti in mesi, non anni'], ['5', 'lingue dal giorno uno'], ['1', 'codebase multi-tenant per brand e agenzie']],
    secItems: ['Isolamento multi-tenant verificato (credenziali per-tenant, RLS, cache per-workspace)', 'GDPR: export/delete self-service, DPA, PII scrubber verso i modelli AI', 'Stack moderno: Next.js · Supabase · Nango · OpenAI · fal.ai · Stripe'],
  },
  status: {
    eyebrow: 'Dove siamo', title: 'Prodotto live, distribuzione in apertura',
    done: ['Piattaforma completa live su lyftai.io (web + mobile)', 'Landing con demo interattiva (software reale, dati finti)', 'Beta tenant DTC attivo (dogfooding quotidiano) + primo cliente pagante in onboarding', 'Billing attivo: Stripe + Shopify Managed Pricing', 'Meta Marketing API Advanced Access — APPROVATA (lug 2026)', 'App pubblicata sullo Shopify App Store'],
    pending: ['Google Ads API Basic — richiesto'],
    placeholders: ['MRR', 'Clienti attivi', 'Pipeline'],
    phLabel: 'da compilare',
  },
  roadmap: {
    eyebrow: 'Roadmap', title: 'Da analytics a ciclo chiuso',
    steps: [
      ['Ora', 'Cervello unico', 'Context engine condiviso: un’AI, tutte le tab, memoria cross-modulo'],
      ['Poi', 'Action layer', 'Dalla raccomandazione all’esecuzione: campagne email/Meta create dalla piattaforma'],
      ['Quindi', 'Geo-lift readout', 'Lettura causale dei test: l’incrementalità diventa certezza'],
      ['Dopo', 'Creative video & UGC', 'Studio in GA per tutti + generazione video'],
    ],
  },
  closing: {
    title1: 'Smetti di scegliere', title2: 'a sentimento.',
    sub: 'LyftAI porta la verità incrementale e una squadra AI dentro ogni brand e-commerce.',
    askLabel: 'Pre-seed', askAmount: '€300.000', askNote: '36 mesi di runway',
    funds: [['50%', 'Go-to-market'], ['35%', 'Prodotto & AI'], ['15%', 'Team & ops']],
    contact: 'lyftai.io · LYFT SRL',
  },
  ui: { counter: 'di', print: 'Premi P per stampare/PDF · frecce per navigare' },
}

const EN = {
  htmlLang: 'en', title: 'LyftAI — Investor Pitch',
  badge: 'Investor pitch · 10 minutes · 2026',
  cover: {
    h1a: 'The AI operating system', h1b: 'for your e-commerce.',
    sub: 'One platform that reads Shopify, Meta, Google and email data, turns it into decisions, and hands it to an AI team that knows the brand.',
    meta: 'LYFT SRL · lyftai.io · 5 languages (IT EN ES FR DE)',
  },
  problem: {
    eyebrow: 'The problem', title: '6 dashboards, 12 spreadsheets, 0 clear answers',
    items: [
      ['6+ disconnected tools', 'Shopify, Meta, Google Ads, GA4, email, spreadsheets: numbers that never match'],
      ['ROAS that lies', 'ad platforms self-attribute sales: budget gets allocated on the wrong number'],
      ['Anomalies caught late', 'days of wasted spend before anyone notices'],
      ['An expensive stack', 'vertical tools add up to €700–900/month and don’t talk to each other'],
    ],
    stat: ['€3-5k/mo', 'what brands pay external consultants just to get answers'],
  },
  solution: {
    eyebrow: 'The solution', title: 'From data to decision, in a single platform',
    steps: [
      ['01', 'Connect in 5 minutes', 'Guided 10-step onboarding, one-click OAuth, zero tokens. Data is ready before you finish.'],
      ['02', 'See everything in one place', 'Live cross-platform KPIs, consolidated and consistent. Mobile included.'],
      ['03', 'Understand what’s true', 'Incrementality (MMM), attribution, maturity-corrected LTV: the numbers to decide on.'],
      ['04', 'Act with AI', '8 C-suite agents that know the brand, generative creatives, automatic reports.'],
    ],
  },
  product: {
    eyebrow: 'The product', title: '8 areas · 45+ modules · all included in every plan',
    areas: [
      ['🛒', 'Commerce & Analytics', 'Live dashboard + 3D globe, Inventory (stockout €), per-product P&L, Landed costs, KPI Brain, Attribution, LTV & Cohorts, Customer CRM (RFM), Multi-provider email, P&L statement', '10 modules'],
      ['🤖', 'Productivity AI', 'AI Team (8 C-suite agents), Performance Agent, LyftTalk (chat + group calls), Projects & Tasks, Lyftimer, Creative Studio & Lab', '7 modules'],
      ['🌐', 'Website Intelligence', 'Day-precise CRO, AI Website Scanner, SEO Audit + AEO, Competitor Intel, Price comparison, Creative Intel', '6 modules'],
      ['📱', 'Meta Ads', 'Creative, ad-level Detail, KPI + audience segments, Lighthouse, Creative Fatigue, Budget Advisor', '6 modules'],
      ['🔍', 'Google Ads', 'Twin suite: Detail, Products (PMax), KPI, Lighthouse, Budget Advisor', '5 modules'],
      ['📈', 'Incrementality (MMM)', 'True contribution per channel, saturation curves, budget simulator, geo-lift designer', '4 modules'],
      ['📊', 'Reports', 'Weekly/Monthly/Quarter/Year, branded multilingual PDFs, automatic email delivery', '7 modules'],
      ['⚙️', 'System', 'Help center, Integrations, Brand Identity, Billing', '4 modules'],
    ],
  },
  truth: {
    eyebrow: 'Differentiator #1', title: 'We sell the truth about marketing',
    sub: 'Ad platforms claim sales that would have happened anyway. LyftAI separates incremental revenue from the organic baseline — enterprise-MMM depth at SaaS pricing.',
    barLabelA: 'Meta-reported ROAS', barLabelB: 'Real incremental ROAS',
    barA: '3.8×', barB: '1.9×',
    points: [
      ['Saturation curves', 'what the next euro returns, channel by channel'],
      ['Budget simulator', 'move spend with a slider → 2/4/8-week forecast'],
      ['Geo-lift designer', 'the causal test that turns estimates into certainty'],
      ['Maturity-corrected LTV', 'fixes the understatement growing brands suffer → scale with confidence'],
    ],
  },
  ai: {
    eyebrow: 'Differentiator #2', title: 'Native AI that knows the brand',
    sub: 'The Brand Identity (products, tone of voice, competitors, goals) is the context of every agent: answers about YOUR brand, with YOUR numbers, with persistent memory.',
    chatQ: 'How did the week go?',
    chatA: 'MER at 2.6× — above your 2.5× target. AOV in line, but Meta CTR has dropped for 3 days. Want me to dig in?',
    cards: [
      ['AI Team', '8 C-suite agents (CEO · CFO · CMO · Ads · SEO · CRO · Data · Creative) with hierarchy and shared memory, voice calls included'],
      ['Creative Studio', 'High-fidelity product images, Try-On, product-trained models, collaborative boards'],
      ['Reports that write themselves', 'AI insights in every tab, automatic PDFs in the customer’s language'],
    ],
  },
  platform: {
    eyebrow: 'Differentiator #3', title: 'One platform, two markets',
    cards: [
      ['All included', 'Replaces 10+ subscriptions (BI, MMM, SEO, creative AI, CRM, PM, chat…): €900+/month of market value', '€900+/mo replaced'],
      ['Verified fair pricing', 'Plans are tied to REAL order volume read from Shopify: impossible to pick the wrong plan, upgrades only when the customer grows', 'Zero friction'],
      ['Multi-tenant for agencies', 'One account, N isolated client workspaces, 1-click switch, white-label, per-client language', '2nd revenue engine'],
      ['Europe-ready', 'Product, PDFs and emails in 5 languages with auto-detect. GDPR by design', '5 languages'],
    ],
  },
  pricing: {
    eyebrow: 'Business model', title: 'Price grows with the customer, never with features',
    plans: [
      ['Starter', '€69', 'up to 500 orders/mo'],
      ['Growth', '€149', '500 – 2,000 orders/mo'],
      ['Scale', '€299', '2,000 – 7,000 orders/mo'],
      ['Enterprise', '€599', '7,000+ orders/mo'],
    ],
    notes: ['Agencies & freelancers: €199 → €1,990/mo per client portfolio', 'AI credits (Creative Lab/Studio) as additional revenue', 'Annual = 2 months free · 14-day trial, no card', 'Channels: direct signup (Stripe) + Shopify App Store (Managed Pricing)'],
  },
  unit: {
    eyebrow: 'Unit economics', title: 'Software margins, healthy-SaaS payback',
    stats: [
      ['€150/mo', 'blended ARPA per e-commerce (€69–599 plans + agencies + AI credits)'],
      ['~€15/mo', 'average cost-to-serve per company (infra + AI inference) → ~90% gross margin'],
      ['<3 months', 'target CAC payback (channels: Shopify App Store + agency partnerships)'],
      ['~300', 'e-commerce customers to EBITDA breakeven (lean, AI-augmented structure)'],
    ],
    banner: 'At 5,000 e-commerce: €9M ARR with ~35-40% target EBITDA (€3M+/yr). The €300k pre-seed pays back with a few months of profit past breakeven; expected investor return 10-15× in 36-48 months (SaaS multiples 4-6× ARR). Assumptions: 3-4% monthly churn, €150 ARPA.',
  },
  market: {
    eyebrow: 'Market', title: 'A large market growing 20% a year',
    stats: [
      ['$23.7B', 'TAM 2030 · e-commerce analytics software (from $9.6B in 2025, ~20% CAGR)'],
      ['$2-3B', 'SAM · analytics & attribution for SMB-mid Shopify brands (EU: ~600k active stores in top-5 markets)'],
      ['€9M ARR', 'SOM at 36 months · target 5,000 e-commerce × €150/mo = <0.9% of active European stores'],
    ],
    banner: '87% of Shopify Plus brands use NO dedicated attribution platform: they reconcile ads with orders in a spreadsheet. The market isn’t stealing customers — it’s converting those deciding blind.',
  },
  comp: {
    eyebrow: 'Competitors & positioning', title: 'Alone in the truth × platform quadrant',
    rows: [
      ['Triple Whale', 'DTC dashboard + attribution · $53M raised', 'US-only, EN-only, $129→$2k+/mo, no real MMM, no operating suite'],
      ['Northbeam', 'research-grade multi-touch attribution', '$1k+/mo, measurement only: no action, no AI layer'],
      ['Polar Analytics', 'BI + agents for $10M+ GMV brands', 'requires a data team; no P&L, inventory, CRM, PM'],
      ['Enterprise MMM', 'serious incrementality (Measured, Rockerbox…)', 'tens of thousands €/yr, out of SMB reach'],
      ['DIY stack', 'the status quo of the 87%', '€700-900/mo of disconnected tools, zero incremental truth'],
    ],
    pos: 'LyftAI: enterprise incrementality + a complete operating system, at SMB pricing. Wedges: Europe-first (5 languages, GDPR), verified fair pricing, dual-market brands+agencies.',
  },
  whynow: {
    eyebrow: 'Why now', title: 'Three waves crossing',
    items: [
      ['Rising CAC', 'The difference between scaling and closing is allocating budget on incremental truth — today reserved for those spending tens of thousands on enterprise suites'],
      ['AI marginal cost ~ zero', 'Creative production and analytical consulting have been commoditized: LyftAI packages both into the daily workflow'],
      ['Stack consolidation', 'Whoever owns data + decisions + execution owns the customer. Single-feature tools will be absorbed'],
    ],
  },
  moat: {
    eyebrow: 'Technical moat', title: 'Execution speed as a structural advantage',
    stats: [['45+', 'modules shipped in months, not years'], ['5', 'languages from day one'], ['1', 'multi-tenant codebase for brands and agencies']],
    secItems: ['Verified multi-tenant isolation (per-tenant credentials, RLS, per-workspace cache)', 'GDPR: self-service export/delete, DPA, PII scrubber towards AI models', 'Modern stack: Next.js · Supabase · Nango · OpenAI · fal.ai · Stripe'],
  },
  status: {
    eyebrow: 'Where we are', title: 'Product live, distribution opening up',
    done: ['Full platform live on lyftai.io (web + mobile)', 'Landing with interactive demo (real software, mock data)', 'Active DTC beta tenant (daily dogfooding) + first paying customer onboarding', 'Billing live: Stripe + Shopify Managed Pricing', 'Meta Marketing API Advanced Access — APPROVED (Jul 2026)', 'App published on the Shopify App Store'],
    pending: ['Google Ads API Basic — requested'],
    placeholders: ['MRR', 'Active customers', 'Pipeline'],
    phLabel: 'to fill in',
  },
  roadmap: {
    eyebrow: 'Roadmap', title: 'From analytics to closed loop',
    steps: [
      ['Now', 'Unified brain', 'Shared context engine: one AI, every tab, cross-module memory'],
      ['Next', 'Action layer', 'From recommendation to execution: email/Meta campaigns created from the platform'],
      ['Then', 'Geo-lift readout', 'Causal test reading: incrementality becomes certainty'],
      ['Later', 'Creative video & UGC', 'Studio GA for everyone + video generation'],
    ],
  },
  closing: {
    title1: 'Stop deciding', title2: 'on gut feeling.',
    sub: 'LyftAI puts incremental truth and an AI team inside every e-commerce brand.',
    askLabel: 'Pre-seed', askAmount: '€300,000', askNote: '36-month runway',
    funds: [['50%', 'Go-to-market'], ['35%', 'Product & AI'], ['15%', 'Team & ops']],
    contact: 'lyftai.io · LYFT SRL',
  },
  ui: { counter: 'of', print: 'Press P to print/PDF · arrows to navigate' },
}

// ─────────────────────────────────────────────────────────────
//  Template
// ─────────────────────────────────────────────────────────────
const esc = (s) => String(s)

function slides(c) {
  const S = []

  // 1 · Cover
  S.push(`
  <section class="slide cover">
    <div class="logo-wrap">${LOGO_T(1)}</div>
    <div class="badge"><span class="dot"></span>${c.badge}</div>
    <h1><span class="shine">${c.cover.h1a}</span><br>${c.cover.h1b}</h1>
    <p class="sub">${c.cover.sub}</p>
    <div class="meta">${c.cover.meta}</div>
  </section>`)

  // 2 · Problem
  S.push(`
  <section class="slide">
    <div class="eyebrow" style="color:#f87171">${c.problem.eyebrow}</div>
    <h2>${c.problem.title}</h2>
    <div class="cols">
      <div class="list">
        ${c.problem.items.map(([t, d]) => `<div class="li"><span class="x">✕</span><div><b>${t}</b><span>${d}</span></div></div>`).join('')}
      </div>
      <div class="glass stat-hero" style="border-top:2px solid #f87171">
        <div class="big" style="color:#f87171">${c.problem.stat[0]}</div>
        <div class="small">${c.problem.stat[1]}</div>
      </div>
    </div>
  </section>`)

  // 3 · Solution
  S.push(`
  <section class="slide">
    <div class="eyebrow">${c.solution.eyebrow}</div>
    <h2>${c.solution.title}</h2>
    <div class="grid4">
      ${c.solution.steps.map(([n, t, d]) => `<div class="glass step"><div class="num">${n}</div><b>${t}</b><span>${d}</span></div>`).join('')}
    </div>
  </section>`)

  // 4 · Product map
  S.push(`
  <section class="slide">
    <div class="eyebrow">${c.product.eyebrow}</div>
    <h2>${c.product.title}</h2>
    <div class="grid4 areas">
      ${c.product.areas.map(([ic, t, d, n]) => `<div class="glass area"><div class="ahead"><span class="aicon">${ic}</span><b>${t}</b><span class="count">${n}</span></div><span class="adesc">${d}</span></div>`).join('')}
    </div>
  </section>`)

  // 5 · Truth (incrementality)
  S.push(`
  <section class="slide">
    <div class="eyebrow">${c.truth.eyebrow}</div>
    <h2>${c.truth.title}</h2>
    <p class="lead">${c.truth.sub}</p>
    <div class="cols">
      <div class="glass bars">
        <div class="barrow"><span>${c.truth.barLabelA}</span><div class="track"><div class="fill" style="width:95%;background:linear-gradient(90deg,#f87171,#f8717188)"></div></div><b style="color:#f87171">${c.truth.barA}</b></div>
        <div class="barrow"><span>${c.truth.barLabelB}</span><div class="track"><div class="fill" style="width:48%;background:linear-gradient(90deg,${GREEN},${GREEN}88)"></div></div><b style="color:${GREEN}">${c.truth.barB}</b></div>
      </div>
      <div class="list">
        ${c.truth.points.map(([t, d]) => `<div class="li"><span class="v">✓</span><div><b>${t}</b><span>${d}</span></div></div>`).join('')}
      </div>
    </div>
  </section>`)

  // 6 · AI
  S.push(`
  <section class="slide">
    <div class="eyebrow">${c.ai.eyebrow}</div>
    <h2>${c.ai.title}</h2>
    <p class="lead">${c.ai.sub}</p>
    <div class="cols">
      <div class="glass chat">
        <div class="msg user">${c.ai.chatQ}</div>
        <div class="msg ai">${c.ai.chatA}</div>
      </div>
      <div class="list">
        ${c.ai.cards.map(([t, d]) => `<div class="li"><span class="v" style="color:${ACCENT}">◆</span><div><b>${t}</b><span>${d}</span></div></div>`).join('')}
      </div>
    </div>
  </section>`)

  // 7 · Platform
  S.push(`
  <section class="slide">
    <div class="eyebrow">${c.platform.eyebrow}</div>
    <h2>${c.platform.title}</h2>
    <div class="grid4">
      ${c.platform.cards.map(([t, d, k]) => `<div class="glass step"><div class="kpi">${k}</div><b>${t}</b><span>${d}</span></div>`).join('')}
    </div>
  </section>`)

  // 7b · Market
  S.push(`
  <section class="slide">
    <div class="eyebrow">${c.market.eyebrow}</div>
    <h2>${c.market.title}</h2>
    <div class="grid3">
      ${c.market.stats.map(([v, l]) => `<div class="glass stat"><div class="big shine">${v}</div><div class="small">${l}</div></div>`).join('')}
    </div>
    <div class="banner87">${c.market.banner}</div>
  </section>`)

  // 7c · Competitors
  S.push(`
  <section class="slide">
    <div class="eyebrow">${c.comp.eyebrow}</div>
    <h2>${c.comp.title}</h2>
    <div class="comprows">
      ${c.comp.rows.map(([n, w, l]) => `<div class="glass crow"><b>${n}</b><span class="cwhat">${w}</span><span class="climit">${l}</span></div>`).join('')}
    </div>
    <div class="posline">◆ ${c.comp.pos}</div>
  </section>`)

  // 8 · Pricing
  S.push(`
  <section class="slide">
    <div class="eyebrow">${c.pricing.eyebrow}</div>
    <h2>${c.pricing.title}</h2>
    <div class="grid4">
      ${c.pricing.plans.map(([n, p, d], i) => `<div class="glass plan${i === 1 ? ' hot' : ''}"><div class="pname">${n}</div><div class="price">${p}<span>/m</span></div><span>${d}</span></div>`).join('')}
    </div>
    <div class="notes">${c.pricing.notes.map(n => `<span>· ${n}</span>`).join('')}</div>
  </section>`)

  // 8b · Unit economics
  S.push(`
  <section class="slide">
    <div class="eyebrow">${c.unit.eyebrow}</div>
    <h2>${c.unit.title}</h2>
    <div class="grid4">
      ${c.unit.stats.map(([v, l]) => `<div class="glass stat"><div class="big shine" style="font-size:clamp(30px,3.4vw,44px)">${v}</div><div class="small">${l}</div></div>`).join('')}
    </div>
    <div class="banner87">${c.unit.banner}</div>
  </section>`)

  // 9 · Why now
  S.push(`
  <section class="slide">
    <div class="eyebrow">${c.whynow.eyebrow}</div>
    <h2>${c.whynow.title}</h2>
    <div class="grid3">
      ${c.whynow.items.map(([t, d], i) => `<div class="glass wave"><div class="wnum">${i + 1}</div><b>${t}</b><span>${d}</span></div>`).join('')}
    </div>
  </section>`)

  // 10 · Moat
  S.push(`
  <section class="slide">
    <div class="eyebrow">${c.moat.eyebrow}</div>
    <h2>${c.moat.title}</h2>
    <div class="grid3">
      ${c.moat.stats.map(([v, l]) => `<div class="glass stat"><div class="big shine">${v}</div><div class="small">${l}</div></div>`).join('')}
    </div>
    <div class="list" style="margin-top:26px">
      ${c.moat.secItems.map(d => `<div class="li"><span class="v">✓</span><div><span>${d}</span></div></div>`).join('')}
    </div>
  </section>`)

  // 11 · Status
  S.push(`
  <section class="slide">
    <div class="eyebrow">${c.status.eyebrow}</div>
    <h2>${c.status.title}</h2>
    <div class="cols">
      <div class="list">
        ${c.status.done.map(d => `<div class="li"><span class="v">✓</span><div><span>${d}</span></div></div>`).join('')}
        ${c.status.pending.map(d => `<div class="li"><span class="w">⏳</span><div><span>${d}</span></div></div>`).join('')}
      </div>
      <div class="phcol">
        ${c.status.placeholders.map(p => `<div class="ph"><div class="phlabel">${p}</div><div class="phval">[ ${c.status.phLabel} ]</div></div>`).join('')}
      </div>
    </div>
  </section>`)

  // 12 · Roadmap
  S.push(`
  <section class="slide">
    <div class="eyebrow">${c.roadmap.eyebrow}</div>
    <h2>${c.roadmap.title}</h2>
    <div class="timeline">
      ${c.roadmap.steps.map(([w, t, d]) => `<div class="tstep"><div class="twhen">${w}</div><div class="tdot"></div><b>${t}</b><span>${d}</span></div>`).join('')}
    </div>
  </section>`)

  // 15 · Closing + ASK
  S.push(`
  <section class="slide cover">
    <div class="logo-wrap" style="margin-bottom:14px">${LOGO_T(2)}</div>
    <h1><span class="shine">${c.closing.title1}</span><br>${c.closing.title2}</h1>
    <p class="sub">${c.closing.sub}</p>
    <div class="askbox">
      <div class="asklabel">${c.closing.askLabel}</div>
      <div class="askamount">${c.closing.askAmount}</div>
      <div class="askfunds">
        ${c.closing.funds.map(([p, l]) => `<span class="fund"><b>${p}</b> ${l}</span>`).join('')}
      </div>
      <div class="asknote">${c.closing.askNote}</div>
    </div>
    <div class="meta">${c.closing.contact}</div>
  </section>`)

  return S.join('\n')
}

function page(c) {
  return `<!DOCTYPE html>
<html lang="${c.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${c.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --acc: ${ACCENT}; --blue: ${BLUE}; --green: ${GREEN}; --text: #f5f5f7; --text3: rgba(255,255,255,0.55); }
  html, body { background: #000; color: var(--text); font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }

  /* Sfondo: orbs + griglia (stesso linguaggio del SaaS) */
  .bgfx { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
  .orb { position: absolute; border-radius: 50%; filter: blur(60px); }
  .o1 { top: -12%; left: 4%; width: 560px; height: 560px; background: radial-gradient(circle, ${ACCENT}44, transparent 70%); }
  .o2 { bottom: -18%; right: -4%; width: 640px; height: 640px; background: radial-gradient(circle, ${BLUE}44, transparent 70%); }
  .o3 { top: 42%; left: 48%; width: 420px; height: 420px; background: radial-gradient(circle, ${GREEN}22, transparent 70%); }
  .gridbg { position: absolute; inset: 0;
    background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 80px 80px;
    -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%); mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%); }

  .deck { position: relative; z-index: 1; }
  .slide { width: 100vw; height: 100vh; display: none; flex-direction: column; justify-content: center;
    padding: 7vh 8vw; position: relative; }
  .slide.on { display: flex; animation: sIn .45s cubic-bezier(0.16,1,0.3,1); }
  @keyframes sIn { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }

  .logo-svg { width: 92px; height: 92px; }
  .logo-ring { animation: spin 20s linear infinite; transform-origin: 50% 50%; transform-box: fill-box; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .logo-wrap { margin: 0 auto 26px; filter: drop-shadow(0 0 18px ${ACCENT}66) drop-shadow(0 0 40px ${BLUE}44); }

  .cover { text-align: center; align-items: center; }
  .badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: 999px;
    background: linear-gradient(90deg, ${GREEN}22, ${ACCENT}18); border: 1px solid ${GREEN}55;
    font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 30px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100% { opacity: .6; } 50% { opacity: 1; } }

  h1 { font-size: clamp(44px, 6.4vw, 88px); font-weight: 900; letter-spacing: -0.05em; line-height: 0.98; margin-bottom: 26px; }
  h2 { font-size: clamp(30px, 4vw, 52px); font-weight: 900; letter-spacing: -0.035em; line-height: 1.04; margin-bottom: 30px; max-width: 1080px; }
  .shine { background: linear-gradient(90deg, #fff 0%, ${ACCENT} 35%, ${BLUE} 65%, #fff 100%); background-size: 200% 100%;
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: shineFlow 8s linear infinite; }
  @keyframes shineFlow { 0% { background-position: 200% 50%; } 100% { background-position: -200% 50%; } }

  .eyebrow { font-size: 13px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--acc); margin-bottom: 14px; }
  .sub { font-size: clamp(16px, 1.6vw, 21px); color: rgba(255,255,255,0.72); line-height: 1.5; max-width: 760px; margin: 0 auto 26px; }
  .lead { font-size: clamp(14px, 1.35vw, 18px); color: rgba(255,255,255,0.65); line-height: 1.5; max-width: 900px; margin: -10px 0 28px; }
  .meta { font-size: 12.5px; color: var(--text3); letter-spacing: 0.06em; margin-top: 18px; }

  .glass { background: rgba(0,0,0,0.42); border: 1.5px solid rgba(255,255,255,0.08); border-top-color: rgba(255,255,255,0.14);
    border-radius: 20px; padding: 24px; box-shadow: 0 25px 70px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05);
    position: relative; overflow: hidden; }
  .glass::before { content: ''; position: absolute; top: 0; left: 8%; right: 8%; height: 1.5px;
    background: linear-gradient(90deg, transparent, ${BLUE}80, ${ACCENT}66, transparent); opacity: .7; }

  .cols { display: grid; grid-template-columns: 1.15fr 1fr; gap: 26px; align-items: start; }
  .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
  .areas { grid-template-rows: 1fr 1fr; }

  .list { display: flex; flex-direction: column; gap: 13px; }
  .li { display: flex; gap: 13px; align-items: flex-start; font-size: clamp(13px, 1.25vw, 16px); line-height: 1.45; }
  .li b { display: block; font-weight: 800; margin-bottom: 2px; }
  .li span { color: rgba(255,255,255,0.62); }
  .li b + span { display: block; }
  .x { color: #f87171; font-weight: 900; } .v { color: var(--green); font-weight: 900; } .w { font-size: 14px; }

  .stat-hero { text-align: center; padding: 44px 28px; }
  .big { font-size: clamp(40px, 4.6vw, 64px); font-weight: 900; letter-spacing: -0.03em; line-height: 1; margin-bottom: 12px; }
  .small { font-size: 14px; color: var(--text3); line-height: 1.45; }
  .stat { text-align: center; padding: 34px 20px; }

  .step { display: flex; flex-direction: column; gap: 10px; }
  .step .num { font-size: 13px; font-weight: 900; color: var(--acc); letter-spacing: .1em; }
  .step .kpi { font-size: 12px; font-weight: 900; color: var(--green); letter-spacing: .06em; text-transform: uppercase; }
  .step b { font-size: clamp(15px, 1.5vw, 19px); font-weight: 800; letter-spacing: -0.01em; }
  .step span { font-size: clamp(12px, 1.1vw, 14px); color: rgba(255,255,255,0.6); line-height: 1.5; }

  .area { padding: 18px; display: flex; flex-direction: column; gap: 8px; }
  .ahead { display: flex; align-items: center; gap: 9px; }
  .aicon { font-size: 18px; }
  .ahead b { font-size: clamp(13px, 1.2vw, 15.5px); font-weight: 800; flex: 1; }
  .count { font-size: 10px; font-weight: 800; color: var(--acc); background: ${ACCENT}1a; border: 1px solid ${ACCENT}44;
    padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
  .adesc { font-size: clamp(10.5px, 0.95vw, 12.5px); color: rgba(255,255,255,0.55); line-height: 1.5; }

  .bars { display: flex; flex-direction: column; gap: 26px; padding: 34px 28px; }
  .barrow { display: grid; grid-template-columns: 1fr; gap: 9px; }
  .barrow span { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.7); }
  .barrow b { font-size: 24px; letter-spacing: -0.02em; }
  .track { height: 14px; border-radius: 999px; background: rgba(255,255,255,0.05); overflow: hidden; }
  .fill { height: 100%; border-radius: 999px; }

  .chat { display: flex; flex-direction: column; gap: 13px; padding: 28px; }
  .msg { padding: 13px 17px; border-radius: 15px; font-size: clamp(13px, 1.2vw, 15.5px); line-height: 1.5; max-width: 88%; }
  .msg.user { align-self: flex-end; background: ${ACCENT}30; border: 1px solid ${ACCENT}55; }
  .msg.ai { align-self: flex-start; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); }

  .plan { text-align: center; padding: 28px 18px; }
  .plan.hot { border-top: 2px solid var(--acc); box-shadow: 0 25px 70px rgba(0,0,0,0.8), 0 0 60px ${ACCENT}22; }
  .pname { font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--acc); margin-bottom: 12px; }
  .price { font-size: clamp(34px, 3.6vw, 48px); font-weight: 900; letter-spacing: -0.03em; margin-bottom: 8px; }
  .price span { font-size: 14px; color: var(--text3); font-weight: 700; }
  .plan > span { font-size: 12.5px; color: rgba(255,255,255,0.6); }
  .notes { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 22px; font-size: 12.5px; color: rgba(255,255,255,0.55); }

  .wave { padding: 30px 24px; display: flex; flex-direction: column; gap: 12px; }
  .wnum { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center;
    background: linear-gradient(135deg, ${ACCENT}33, ${BLUE}22); border: 1px solid ${ACCENT}55;
    font-weight: 900; color: var(--acc); }
  .wave b { font-size: clamp(16px, 1.6vw, 20px); letter-spacing: -0.01em; }
  .wave span { font-size: clamp(12.5px, 1.15vw, 15px); color: rgba(255,255,255,0.62); line-height: 1.55; }

  .phcol { display: flex; flex-direction: column; gap: 14px; }
  .ph { border: 1.5px dashed rgba(255,255,255,0.22); border-radius: 16px; padding: 20px 22px; }
  .phlabel { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text3); margin-bottom: 8px; }
  .phval { font-size: 24px; font-weight: 900; color: rgba(255,255,255,0.35); letter-spacing: -0.02em; }

  .timeline { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; position: relative; margin-top: 12px; }
  .timeline::before { content: ''; position: absolute; top: 47px; left: 4%; right: 4%; height: 2px;
    background: linear-gradient(90deg, ${ACCENT}, ${BLUE}, ${GREEN}); opacity: .5; }
  .tstep { display: flex; flex-direction: column; gap: 9px; padding: 0 8px; }
  .twhen { font-size: 11.5px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase; color: var(--acc); height: 22px; }
  .tdot { width: 15px; height: 15px; border-radius: 50%; background: #fff; border: 3.5px solid var(--acc);
    box-shadow: 0 0 0 6px ${ACCENT}22, 0 0 20px ${ACCENT}88; margin-bottom: 10px; }
  .tstep b { font-size: clamp(15px, 1.5vw, 19px); letter-spacing: -0.01em; }
  .tstep span { font-size: clamp(12px, 1.1vw, 14px); color: rgba(255,255,255,0.6); line-height: 1.5; }

  .banner87 { margin-top: 24px; padding: 18px 24px; border-radius: 16px;
    background: linear-gradient(90deg, ${ACCENT}14, ${BLUE}10); border: 1px solid ${ACCENT}44;
    font-size: clamp(13px, 1.35vw, 17px); font-weight: 700; line-height: 1.5; color: rgba(255,255,255,0.88); }

  .comprows { display: flex; flex-direction: column; gap: 10px; }
  .crow { display: grid; grid-template-columns: 150px 1fr 1.25fr; gap: 16px; align-items: center;
    padding: 13px 20px; border-radius: 14px; }
  .crow b { font-size: clamp(13px, 1.2vw, 15.5px); letter-spacing: -0.01em; }
  .cwhat { font-size: clamp(11.5px, 1.05vw, 13.5px); color: rgba(255,255,255,0.6); line-height: 1.4; }
  .climit { font-size: clamp(11.5px, 1.05vw, 13.5px); color: #fbbf24; line-height: 1.4; }
  .posline { margin-top: 18px; font-size: clamp(13px, 1.25vw, 16px); font-weight: 700;
    color: var(--acc); line-height: 1.5; }

  .askbox { margin-top: 8px; padding: 20px 40px 18px; border-radius: 20px; text-align: center;
    background: rgba(0,0,0,0.45); border: 1.5px solid ${ACCENT}55;
    box-shadow: 0 0 60px ${ACCENT}22, inset 0 1px 0 rgba(255,255,255,0.08); }
  .asklabel { font-size: 12px; font-weight: 900; letter-spacing: 0.22em; text-transform: uppercase; color: var(--acc); }
  .askamount { font-size: clamp(38px, 4.4vw, 58px); font-weight: 900; letter-spacing: -0.03em; margin: 4px 0 10px; }
  .askfunds { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .fund { font-size: 12.5px; color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.12); border-radius: 999px; padding: 6px 14px; }
  .fund b { color: var(--green); }
  .asknote { margin-top: 10px; font-size: 11.5px; color: var(--text3); }

  /* HUD navigazione */
  .hud { position: fixed; bottom: 22px; left: 0; right: 0; display: flex; justify-content: center; align-items: center;
    gap: 18px; z-index: 10; font-size: 12px; color: var(--text3); }
  .hudbtn { cursor: pointer; user-select: none; padding: 6px 13px; border-radius: 9px; background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1); color: var(--text); font-weight: 800; }
  .progress { position: fixed; top: 0; left: 0; height: 3px; background: linear-gradient(90deg, ${ACCENT}, ${BLUE});
    z-index: 10; transition: width .3s cubic-bezier(0.16,1,0.3,1); box-shadow: 0 0 12px ${ACCENT}; }
  .hint { position: fixed; top: 16px; right: 20px; z-index: 10; font-size: 11px; color: rgba(255,255,255,0.35); }

  /* Stampa / PDF: tutte le slide, una per pagina, 16:9 */
  @media print {
    @page { size: 297mm 167mm; margin: 0; }
    html, body { background: #000 !important; }
    .hud, .hint, .progress { display: none !important; }
    .slide { display: flex !important; width: 297mm; height: 167mm; page-break-after: always; padding: 14mm 20mm; }
    .bgfx { position: absolute; }
    /* background-clip:text si rompe nell'export PDF di Chromium (dipinge un
       blocco pieno sul testo multi-parola): in stampa il shine è tinta unita. */
    .shine { animation: none !important; background: none !important;
      -webkit-background-clip: initial !important; background-clip: initial !important;
      -webkit-text-fill-color: #c9a6ff !important; color: #c9a6ff !important; }
  }
</style>
</head>
<body>
  <div class="bgfx"><div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div><div class="gridbg"></div></div>
  <div class="progress" id="bar"></div>
  <div class="hint">${c.ui.print}</div>
  <div class="deck" id="deck">
${slides(c)}
  </div>
  <div class="hud">
    <span class="hudbtn" onclick="nav(-1)">←</span>
    <span id="counter"></span>
    <span class="hudbtn" onclick="nav(1)">→</span>
  </div>
<script>
  const S = [...document.querySelectorAll('.slide')]
  let i = 0
  function show() {
    S.forEach((s, k) => s.classList.toggle('on', k === i))
    document.getElementById('counter').textContent = (i + 1) + ' ${'${'}'' + '}' // placeholder replaced below
    document.getElementById('bar').style.width = (((i + 1) / S.length) * 100) + '%'
  }
  function nav(d) { i = Math.max(0, Math.min(S.length - 1, i + d)); show() }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') nav(1)
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') nav(-1)
    else if (e.key === 'Home') { i = 0; show() }
    else if (e.key === 'End') { i = S.length - 1; show() }
    else if (e.key.toLowerCase() === 'p') window.print()
    else if (e.key.toLowerCase() === 'f') document.documentElement.requestFullscreen?.()
  })
  document.addEventListener('click', (e) => {
    if (e.target.closest('.hudbtn')) return
    nav(e.clientX > innerWidth / 2 ? 1 : -1)
  })
  show()
</script>
</body>
</html>`
}

// Fix del counter (evita template literal annidati problematici)
function finalize(html, c) {
  return html.replace(
    /document\.getElementById\('counter'\)\.textContent = .*/,
    `document.getElementById('counter').textContent = (i + 1) + ' ${c.ui.counter} ' + S.length`
  )
}

const outDir = '/Users/marino/STMN-Lyft/docs/pitch'
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'LyftAI_Pitch_IT.html'), finalize(page(IT), IT))
fs.writeFileSync(path.join(outDir, 'LyftAI_Pitch_EN.html'), finalize(page(EN), EN))
console.log('DECKS OK:',
  fs.statSync(path.join(outDir, 'LyftAI_Pitch_IT.html')).size, 'bytes IT ·',
  fs.statSync(path.join(outDir, 'LyftAI_Pitch_EN.html')).size, 'bytes EN')
