// Gating per PIANO di abbonamento. A differenza del gating per ruolo
// (roleTabs.js) che NASCONDE le tab, qui le tab non incluse nel piano restano
// VISIBILI ma BLOCCATE (lucchetto, non cliccabili) → invito all'upgrade.

// Tutte le tab del software (deve combaciare con i nav id di VendroShell).
export const ALL_TAB_IDS = [
  'onboarding', 'dashboard', 'kpiBrain', 'attribution', 'ltvCohorts', 'klaviyo',
  'cro', 'webScanner', 'seoAudit',
  'creative', 'metaDetail', 'metaKpi', 'lighthouse', 'creativeFatigue', 'budgetAdvisor',
  'pnl', 'scheduledReports', 'weekly', 'monthly', 'quarter', 'year', 'simulator',
  'competitorIntel', 'priceComparison',
  'performanceAgent', 'creativeLab',
  'integrations', 'brandIdentity', 'settings',
  'tasks', 'timeTracking', 'chat',
]

// Sempre accessibili a prescindere dal piano (account, setup, collaborazione base).
const ALWAYS = ['onboarding', 'integrations', 'brandIdentity', 'settings', 'tasks', 'chat']

// Tab incluse nel piano Base (€69).
const BASE = [...ALWAYS, 'dashboard', 'kpiBrain', 'pnl', 'seoAudit', 'klaviyo']

// Pro (€149) = Base + ads completo, SEO/CRO, attribuzione, time tracking, report.
const PRO = [...BASE,
  'attribution', 'ltvCohorts', 'cro', 'webScanner',
  'creative', 'metaDetail', 'metaKpi', 'lighthouse', 'creativeFatigue', 'budgetAdvisor',
  'timeTracking', 'scheduledReports', 'weekly', 'monthly', 'quarter', 'year',
]

// Full (€299) = tutto.
const PLAN_ALLOWED = {
  base: new Set(BASE),
  pro: new Set(PRO),
  full: new Set(ALL_TAB_IDS),
}

const PLAN_OF = { starter: 'base', growth: 'pro', scale: 'full' }
export const PLAN_LABEL = { base: 'Base', pro: 'Pro', full: 'Full' }

// Piano minimo che sblocca una certa tab (per il messaggio di upsell).
export function minPlanForTab(tabId) {
  if (PLAN_ALLOWED.base.has(tabId)) return 'base'
  if (PLAN_ALLOWED.pro.has(tabId)) return 'pro'
  return 'full'
}

// Ritorna il Set delle tab BLOCCATE per il piano corrente.
// - status 'trialing' → accesso completo (nessun lock) durante la prova
// - planId mancante / non riconosciuto → nessun lock (es. owner senza Stripe)
export function lockedTabsForPlan(planId, status) {
  if (status === 'trialing') return new Set()
  const key = PLAN_OF[planId]
  if (!key || key === 'full') return new Set()
  const allowed = PLAN_ALLOWED[key]
  return new Set(ALL_TAB_IDS.filter(id => !allowed.has(id)))
}
