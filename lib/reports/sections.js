// Catalogo dei report schedulabili. Ogni sezione mappa su un valore `tab`
// accettato da /api/report (che genera il PDF corrispondente).
// Usato sia dal client (ScheduledReportsTab) sia dal server (send-custom).
export const REPORT_SECTIONS = [
  { id: 'completo',    tab: 'Completo',             label: 'Report completo (tutte le tab)' },
  { id: 'kpiBrain',    tab: 'KPI Brain',            label: 'KPI Brain' },
  { id: 'meta',        tab: 'Meta KPI',             label: 'Meta Ads' },
  { id: 'google',      tab: 'Google Ads',           label: 'Google Ads' },
  { id: 'inventory',   tab: 'Inventario',           label: 'Inventario' },
  { id: 'productPerf', tab: 'Performance prodotti', label: 'Performance prodotti' },
]

export const REPORT_SECTION_MAP = Object.fromEntries(REPORT_SECTIONS.map(s => [s.id, s]))

export const REPORT_TIMEFRAMES = ['last_7d', 'last_28d', 'last_30d', 'last_90d', 'this_month', 'last_month']
export const REPORT_FREQUENCIES = ['daily', 'weekly', 'monthly']
