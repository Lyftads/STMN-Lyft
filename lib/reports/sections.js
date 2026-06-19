// Catalogo dei report schedulabili.
//  - kind 'report'  → PDF generato da /api/report?tab=<tab>&since&until
//  - kind 'seo'     → audit SEO on-page di un URL (needsUrl)
//  - kind 'scanner' → analisi CRO (Vision) di un URL (needsUrl)
// Usato sia dal client (ScheduledReportsTab) sia dal server (send-custom).
export const REPORT_SECTIONS = [
  { id: 'completo',    kind: 'report', tab: 'Completo',             label: 'Report completo (tutte le tab)' },
  { id: 'kpiBrain',    kind: 'report', tab: 'KPI Brain',            label: 'KPI Brain' },
  { id: 'meta',        kind: 'report', tab: 'Meta KPI',             label: 'Meta Ads' },
  { id: 'google',      kind: 'report', tab: 'Google Ads',           label: 'Google Ads' },
  { id: 'inventory',   kind: 'report', tab: 'Inventario',           label: 'Inventario' },
  { id: 'productPerf', kind: 'report', tab: 'Performance prodotti', label: 'Performance prodotti' },
  { id: 'seoAudit',    kind: 'seo',     needsUrl: true, label: 'SEO Audit (URL)' },
  { id: 'webScanner',  kind: 'scanner', needsUrl: true, label: 'AI Website Scanner (URL)' },
]

export const REPORT_SECTION_MAP = Object.fromEntries(REPORT_SECTIONS.map(s => [s.id, s]))

// True se almeno una delle sezioni scelte richiede un URL target.
export const sectionsNeedUrl = (ids = []) => ids.some(id => REPORT_SECTION_MAP[id]?.needsUrl)

export const REPORT_TIMEFRAMES = ['last_7d', 'last_28d', 'last_30d', 'last_90d', 'this_month', 'last_month']
export const REPORT_FREQUENCIES = ['daily', 'weekly', 'monthly']
