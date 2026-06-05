// Mappa ruolo → tab visibili nella sidebar. Usata per il gating UX dei membri
// del team (l'Admin/owner non viene filtrato: vede tutto).
// NB: in env-only i dati restano quelli di STMN per chiunque sia loggato; questo
// gating controlla COSA si vede nella UI, non l'isolamento dei dati (che arriverà
// con il multi-tenant resolver). La barriera reale è "chi può fare login" (inviti).

export const ROLE_TABS = {
  cro_specialist: ['dashboard', 'kpiBrain', 'attribution', 'ltvCohorts', 'cro', 'webScanner', 'seoAudit', 'userPath'],
  ecommerce_manager: ['dashboard', 'kpiBrain', 'attribution', 'ltvCohorts', 'klaviyo', 'cro', 'webScanner', 'seoAudit', 'userPath', 'pnl', 'scheduledReports', 'weekly', 'monthly', 'quarter', 'year', 'simulator'],
  advertising_manager: ['creative', 'metaDetail', 'metaKpi', 'lighthouse', 'creativeFatigue', 'budgetAdvisor', 'seoAudit', 'webScanner', 'cro', 'klaviyo', 'performanceAgent', 'creativeLab', 'competitorIntel', 'priceComparison'],
  data_analyst: ['kpiBrain', 'attribution', 'ltvCohorts', 'pnl', 'scheduledReports', 'weekly', 'monthly', 'quarter', 'year', 'simulator', 'competitorIntel', 'priceComparison'],
}

// Tab sempre visibili a tutti i membri.
export const ALWAYS_TABS = ['tasks', 'chat']

// Calcola l'insieme di tab consentite. Ritorna null = accesso completo (Admin/owner).
export function allowedTabsFor(roles, isAdmin) {
  if (isAdmin || (roles || []).includes('admin')) return null
  const set = new Set(ALWAYS_TABS)
  for (const r of (roles || [])) (ROLE_TABS[r] || []).forEach(t => set.add(t))
  return set
}
