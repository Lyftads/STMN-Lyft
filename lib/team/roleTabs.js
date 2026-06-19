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

// Tutti i tab della nav — TENERE ALLINEATO a navGroups in VendroShell.jsx.
export const ALL_TABS = [
  'onboarding', 'dashboard', 'inventory', 'productPerformance', 'productCosts', 'kpiBrain', 'attribution', 'ltvCohorts', 'clienti', 'klaviyo',
  'tasks', 'timeTracking', 'chat', 'team', 'performanceAgent', 'creativeStudio', 'actionQueue',
  'cro', 'webScanner', 'seoAudit', 'competitorIntel', 'priceComparison', 'creativeIntel',
  'creative', 'metaDetail', 'metaKpi', 'lighthouse', 'creativeFatigue', 'budgetAdvisor',
  'googleDetail', 'googleProducts', 'googleKpi', 'googleLighthouse', 'googleBudgetAdvisor',
  'pnl', 'scheduledReports', 'weekly', 'monthly', 'quarter', 'year', 'simulator',
  'helpCenter', 'integrations', 'brandIdentity', 'settings',
]

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
export function allowedTabsFor(roles, isAdmin) {
  if (isAdmin || (roles || []).includes('admin')) return null
  // guest esterno: accede SOLO alla chat
  if ((roles || []).includes('guest')) return new Set(['chat'])
  // Tutti gli altri membri invitati: intera suite, tranne i tab solo-Admin.
  return new Set(MEMBER_TABS)
}
