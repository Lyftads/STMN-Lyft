// Indirizzo di ogni tab: /task, /weekly, /calendario… cosi' una tab si salva
// nei preferiti e si riapre da sola (Marino, 5 ott 2026). Gli slug non devono
// coincidere con le cartelle di app/ (chat, creative, kpi-brain, meta,
// onboarding, lyftimer, welcome, en…): quelle pagine vincerebbero e la tab non si aprirebbe mai.
export const SLUG_DI_TAB = {
  onboarding: 'primi-passi', dashboard: 'dashboard', inventory: 'inventario',
  productPerformance: 'performance-prodotti', productCosts: 'costi-prodotto', prezzi: 'prezzi',
  kpiBrain: 'kpi', attribution: 'attribuzione', ltvCohorts: 'ltv', clienti: 'clienti', klaviyo: 'email',
  tasks: 'task', calendar: 'calendario', timeOff: 'ferie', timeTracking: 'tempo', chat: 'lyfttalk', team: 'squadra-ai',
  cro: 'cro', webScanner: 'scanner', seoAudit: 'seo',
  creative: 'creative-ads', metaDetail: 'meta-detail', metaKpi: 'meta-kpi', creativeFatigue: 'creative-fatigue', budgetAdvisor: 'meta-budget', metaLeadgen: 'lead-gen',
  googleDetail: 'google-detail', googleProducts: 'google-prodotti', googleVerdicts: 'google-performance', googleKpi: 'google-kpi', googleBudgetAdvisor: 'google-budget',
  incrContribution: 'contributo-incrementale', incrCurves: 'curve-di-risposta', incrSimulator: 'simulatore-budget', geolift: 'geo-lift',
  corrispettivi: 'corrispettivi', pnl: 'conto-economico', scheduledReports: 'report-programmati',
  weekly: 'weekly', monthly: 'monthly', quarter: 'quarter', year: 'year', simulator: 'simulatore',
  helpCenter: 'assistenza', teamManage: 'team', integrations: 'integrazioni', brandIdentity: 'brand', settings: 'impostazioni',
}

export const TAB_DI_SLUG = Object.fromEntries(Object.entries(SLUG_DI_TAB).map(([tab, slug]) => [slug, tab]))

export const percorsoDiTab = (tab) => '/' + (SLUG_DI_TAB[tab] || '')

// Tab scritta nell'indirizzo: prima il percorso (/task), poi il vecchio ?tab=
// che usano ancora le email e il cambio di workspace.
export function tabDaIndirizzo(loc) {
  const slug = decodeURIComponent(String(loc?.pathname || '').replace(/^\/+|\/+$/g, '')).toLowerCase()
  if (TAB_DI_SLUG[slug]) return TAB_DI_SLUG[slug]
  try { return new URLSearchParams(loc?.search || '').get('tab') || null } catch { return null }
}
