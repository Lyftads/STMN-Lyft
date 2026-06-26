// Mappa accessi del team → tab visibili nella sidebar. Usata per il gating UX
// dei membri (l'Admin/owner non viene filtrato: vede tutto).
// NB: in env-only i dati restano quelli di STMN per chiunque sia loggato; questo
// gating controlla COSA si vede nella UI, non l'isolamento dei dati (che arriverà
// con il multi-tenant resolver). La barriera reale è "chi può fare login" (inviti).
//
// MODELLO ATTUALE (19 giu 2026): "tutti vedono tutto" — ogni collaboratore
// invitato vede l'INTERA suite, così nessuno resta indietro sulle novità.
// Eccezioni: solo l'Admin vede Integrazioni + Settings (fatturazione); il guest
// esterno vede solo la chat.

// Tutti i tab della nav — TENERE ALLINEATO a navGroups nella shell dell.app.
export const ALL_TABS = [
  'onboarding', 'dashboard', 'inventory', 'productPerformance', 'productCosts', 'kpiBrain', 'attribution', 'ltvCohorts', 'clienti', 'klaviyo',
  'tasks', 'timeTracking', 'chat', 'team', 'performanceAgent', 'creativeStudio', 'actionQueue',
  'cro', 'webScanner', 'seoAudit', 'competitorIntel', 'priceComparison', 'creativeIntel',
  'creative', 'metaDetail', 'metaKpi', 'lighthouse', 'creativeFatigue', 'budgetAdvisor',
  'googleDetail', 'googleProducts', 'googleKpi', 'googleLighthouse', 'googleBudgetAdvisor',
  'pnl', 'scheduledReports', 'weekly', 'monthly', 'quarter', 'year', 'simulator',
  'incrContribution', 'incrCurves', 'incrSimulator', 'geolift',
  'helpCenter', 'integrations', 'brandIdentity', 'settings',
]

// Etichette tab (per il pannello "Visibilità tab membri") — allineate a navGroups.
export const TAB_LABELS = {
  onboarding: 'Onboarding', dashboard: 'Dashboard', inventory: 'Inventario', productPerformance: 'Performance prodotti', productCosts: 'Costi prodotto', kpiBrain: 'KPI Brain', attribution: 'Attribuzione', ltvCohorts: 'LTV & Coorti', clienti: 'Clienti', klaviyo: 'Email Marketing',
  tasks: 'Progetti & Task', timeTracking: 'Lyftimer', chat: 'LyftTalk', team: 'Squadra AI', performanceAgent: 'Performance Agent', creativeStudio: 'Creative Studio', actionQueue: 'Coda Azioni',
  cro: 'CRO', webScanner: 'AI Website Scanner', seoAudit: 'SEO Audit', competitorIntel: 'Competitor Intel', priceComparison: 'Prezzi vs Competitor', creativeIntel: 'Creative Intel',
  creative: 'Creative', metaDetail: 'Meta Detail', metaKpi: 'Meta KPI', lighthouse: 'Meta Lighthouse', creativeFatigue: 'Creative Fatigue', budgetAdvisor: 'Meta Budget Advisor',
  googleDetail: 'Google Detail', googleProducts: 'Google Prodotti', googleKpi: 'Google KPI', googleLighthouse: 'Google Lighthouse', googleBudgetAdvisor: 'Google Budget Advisor',
  incrContribution: 'Contributo incrementale', incrCurves: 'Curve di risposta', incrSimulator: 'Simulatore budget', geolift: 'Geo-lift',
  pnl: 'Conto Economico', scheduledReports: 'Scheduled Reports', weekly: 'Weekly', monthly: 'Monthly', quarter: 'Quarter', year: 'Year', simulator: 'Simulatore',
  helpCenter: 'Centro Assistenza', brandIdentity: 'Brand Identity',
}

// Tab riservati all'Admin/owner (i membri NON li vedono).
export const ADMIN_ONLY_TABS = ['integrations', 'settings']

// Set dei tab che ogni membro (non-admin, non-guest) può vedere = tutto tranne admin-only.
export const MEMBER_TABS = ALL_TABS.filter(t => !ADMIN_ONLY_TABS.includes(t))

// ── LEGACY (non usata ora): mappa ruolo → tab, per tornare a un gating granulare. ──
export const ROLE_TABS = {
  cro_specialist: ['dashboard', 'clienti', 'kpiBrain', 'attribution', 'ltvCohorts', 'cro', 'webScanner', 'seoAudit', 'competitorIntel', 'priceComparison', 'brandIdentity'],
  ecommerce_manager: ['dashboard', 'inventory', 'productPerformance', 'productCosts', 'clienti', 'kpiBrain', 'attribution', 'ltvCohorts', 'klaviyo', 'cro', 'webScanner', 'seoAudit', 'pnl', 'scheduledReports', 'weekly', 'monthly', 'quarter', 'year', 'simulator', 'googleDetail', 'googleProducts', 'googleKpi', 'googleLighthouse', 'googleBudgetAdvisor', 'competitorIntel', 'priceComparison', 'creativeIntel', 'brandIdentity'],
  advertising_manager: ['creative', 'metaDetail', 'metaKpi', 'lighthouse', 'creativeFatigue', 'budgetAdvisor', 'googleDetail', 'googleProducts', 'googleKpi', 'googleLighthouse', 'googleBudgetAdvisor', 'seoAudit', 'webScanner', 'cro', 'clienti', 'klaviyo', 'performanceAgent', 'creativeStudio', 'competitorIntel', 'priceComparison', 'creativeIntel', 'actionQueue', 'brandIdentity'],
  data_analyst: ['inventory', 'productPerformance', 'productCosts', 'clienti', 'kpiBrain', 'attribution', 'ltvCohorts', 'pnl', 'scheduledReports', 'weekly', 'monthly', 'quarter', 'year', 'simulator', 'googleDetail', 'googleProducts', 'googleKpi', 'googleLighthouse', 'googleBudgetAdvisor', 'metaDetail', 'metaKpi', 'competitorIntel', 'priceComparison', 'creativeIntel'],
}

// Tab sempre visibili (resta per compatibilità; oggi i membri vedono tutto comunque).
export const ALWAYS_TABS = ['onboarding', 'tasks', 'timeTracking', 'chat', 'team', 'helpCenter']

// Calcola l'insieme di tab consentite. Ritorna null = accesso completo (Admin/owner).
// `hiddenTabs` = tab che l'Admin del workspace ha scelto di nascondere ai membri.
export function allowedTabsFor(roles, isAdmin, hiddenTabs = []) {
  if (isAdmin || (roles || []).includes('admin')) return null
  // guest esterno: accede SOLO alla chat
  if ((roles || []).includes('guest')) return new Set(['chat'])
  // Tutti gli altri membri invitati: intera suite, tranne i tab solo-Admin e
  // quelli nascosti dall'Admin per questo workspace.
  const hidden = new Set(Array.isArray(hiddenTabs) ? hiddenTabs : [])
  return new Set(MEMBER_TABS.filter(t => !hidden.has(t)))
}
