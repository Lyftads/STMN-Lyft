// ============================================================================
//  DEMO DATA — dati 100% inventati per la modalità demo pubblica (/demo).
//  NON tocca nulla del software reale: viene servito solo da un intercettore
//  fetch attivo esclusivamente nella pagina /demo. Brand fittizio "Acme Store".
// ============================================================================

const DAY = 86400000
const iso = (d) => new Date(d).toISOString()
const ymd = (d) => new Date(d).toISOString().slice(0, 10)
const round = (n) => Math.round(n)

// Serie settimanale (ultime 16 settimane) con crescita + rumore deterministico.
function buildWeeks() {
  const out = []
  const now = Date.now()
  for (let i = 15; i >= 0; i--) {
    const start = now - i * 7 * DAY
    const base = 6200 + (15 - i) * 540
    const noise = ((i * 37) % 13) / 13 * 1800 - 600
    const fatturato = round(base + noise)
    const ordini = round(fatturato / 72)
    const nc = round(ordini * 0.62)
    const rc = ordini - nc
    const uniqueSessions = round(ordini * 46)
    const resi = round(ordini * 0.02)
    const spend = round(fatturato / 2.6)
    const impressions = round(spend * 210)
    const linkClicks = round(impressions * 0.021)
    out.push({
      shop: { week: ymd(start), weekStart: ymd(start), weekKey: ymd(start), date: ymd(start), fatturato, ordini, nc, rc, uniqueSessions, resi },
      meta: { week: ymd(start), weekStart: ymd(start), weekKey: ymd(start), date: ymd(start), spend, impressions, linkClicks, clicks: linkClicks, conversions: round(ordini * 0.8) },
    })
  }
  return out
}

function demoMetrics() {
  const weeks = buildWeeks()
  const shopifyWeekly = weeks.map(w => w.shop)
  const metaWeekly = weeks.map(w => w.meta)
  const sum = (a, f) => a.reduce((s, r) => s + (r[f] || 0), 0)
  const totRev = sum(shopifyWeekly, 'fatturato')
  const totOrd = sum(shopifyWeekly, 'ordini')

  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1)
    const f = 24000 + (5 - i) * 3200
    months.push({ month: d.toISOString().slice(0, 7), fatturato: f, ordini: round(f / 72), nc: round(f / 72 * 0.6), rc: round(f / 72 * 0.4) })
  }

  const topProducts = [
    { title: 'Bestseller #1', revenue: 18420, orders: 256, quantity: 268 },
    { title: 'Prodotto Pro', revenue: 12110, orders: 168, quantity: 175 },
    { title: 'Kit Starter', revenue: 9870, orders: 141, quantity: 152 },
    { title: 'Accessorio Plus', revenue: 6240, orders: 98, quantity: 110 },
    { title: 'Bundle Risparmio', revenue: 5180, orders: 72, quantity: 80 },
    { title: 'Edizione Limitata', revenue: 3920, orders: 54, quantity: 56 },
  ]
  const marketingSources = [
    { source: 'Meta Ads', orders: round(totOrd * 0.38), revenue: round(totRev * 0.38) },
    { source: 'Organic Search', orders: round(totOrd * 0.24), revenue: round(totRev * 0.24) },
    { source: 'Google Ads', orders: round(totOrd * 0.21), revenue: round(totRev * 0.21) },
    { source: 'Email', orders: round(totOrd * 0.12), revenue: round(totRev * 0.12) },
    { source: 'Direct', orders: round(totOrd * 0.05), revenue: round(totRev * 0.05) },
  ]
  const dayBreakdown = []
  for (let i = 29; i >= 0; i--) {
    const d = Date.now() - i * DAY
    const revenue = 800 + ((i * 53) % 17) / 17 * 1400
    dayBreakdown.push({ date: ymd(d), day: ymd(d), revenue: round(revenue), orders: round(revenue / 72) })
  }

  const metaSpend = sum(metaWeekly, 'spend')
  return {
    aovLive: round((totRev / Math.max(1, totOrd)) * 100) / 100,
    ordersLive: totOrd,
    shopifyWeekly, shopifyMonthly: months,
    shopifyTopProducts: topProducts,
    shopifyMarketingSources: marketingSources,
    shopifyDayBreakdown: dayBreakdown,
    shopifyPrevRange: { revenue: round(totRev * 0.82), orders: round(totOrd * 0.82), nc: round(totOrd * 0.5), rc: round(totOrd * 0.32), sessions: round(totOrd * 40), resi: round(totOrd * 0.02) },
    metaPrevRange: { spend: round(metaSpend * 0.88), impressions: round(metaSpend * 0.88 * 210), clicks: round(metaSpend * 0.88 * 4) },
    kpiBrain: {
      preset: 'last_90d', range: null, previousRange: null,
      shopifyTopProducts: topProducts, shopifyMarketingSources: marketingSources, shopifyDayBreakdown: dayBreakdown,
      previous: { shopifyTopProducts: topProducts, shopifyMarketingSources: marketingSources, shopifyDayBreakdown: dayBreakdown },
    },
    metaSpend, metaMonthly: months.map(m => ({ month: m.month, spend: round(m.fatturato / 2.6), impressions: round(m.fatturato / 2.6 * 210), linkClicks: round(m.fatturato / 2.6 * 4) })), metaWeekly,
    sources: { shopify: true, meta: true },
    updatedAt: iso(Date.now()),
  }
}

const MEMBERS = [
  { id: 'd-owner', full_name: 'Marco (Demo)', email: 'owner@acme.demo', roles: ['admin'], status: 'active', avatar_url: null, hourly_rate: 45 },
  { id: 'd-cro', full_name: 'Giulia', email: 'giulia@acme.demo', roles: ['cro_specialist'], status: 'active', avatar_url: null, hourly_rate: 35 },
  { id: 'd-adv', full_name: 'Luca', email: 'luca@acme.demo', roles: ['advertising_manager'], status: 'active', avatar_url: null, hourly_rate: 38 },
]

const PROJECTS = [
  { id: 'p-ads', name: 'Advertising Q3', color: '#7b5bff', archived: false },
  { id: 'p-seo', name: 'SEO & Content', color: '#30d158', archived: false },
  { id: 'p-launch', name: 'Lancio nuovo prodotto', color: '#ff9f0a', archived: false },
]

function demoTasks() {
  const now = Date.now()
  const t = (id, title, status, project_id, assignee_id, prio, due) => ({ id, title, status, project_id, assignee_id, priority: prio, due_date: due, description: '', links: [], attachments: [], position: 0, created_at: iso(now), updated_at: iso(now), approved_at: status === 'approved' ? iso(now) : null })
  return [
    t('t1', 'Brief campagna estate', 'todo', 'p-ads', 'd-adv', 'high', ymd(now + 3 * DAY)),
    t('t2', 'Aggiornare schede prodotto', 'todo', 'p-seo', 'd-cro', 'medium', ymd(now + 6 * DAY)),
    t('t3', 'Setup retargeting Meta', 'in_progress', 'p-ads', 'd-adv', 'high', ymd(now + 1 * DAY)),
    t('t4', 'Audit SEO blog', 'in_progress', 'p-seo', 'd-cro', 'medium', ymd(now + 4 * DAY)),
    t('t5', 'Test A/B checkout', 'in_review', 'p-launch', 'd-cro', 'high', ymd(now - 1 * DAY)),
    t('t6', 'Report mensile', 'approved', 'p-launch', 'd-owner', 'low', ymd(now - 3 * DAY)),
    t('t7', 'Piano editoriale', 'done', 'p-seo', 'd-cro', 'medium', ymd(now - 5 * DAY)),
  ]
}

function demoTimeEntries() {
  const now = Date.now()
  const e = (id, mid, name, pid, desc, h, dayoff) => { const start = now - dayoff * DAY - h * 3600000; return { id, member_id: mid, member_name: name, project_id: pid, task_id: null, task_name: null, description: desc, started_at: iso(start), ended_at: iso(start + h * 3600000), duration_seconds: round(h * 3600), billable: true, member_avatar: null, rate: 40, cost: round(h * 40), project_name: (PROJECTS.find(p => p.id === pid) || {}).name || '', project_color: (PROJECTS.find(p => p.id === pid) || {}).color || null } }
  const entries = [
    e('e1', 'd-adv', 'Luca', 'p-ads', 'Setup campagna', 3.2, 0),
    e('e2', 'd-cro', 'Giulia', 'p-seo', 'Audit on-page', 2.6, 0),
    e('e3', 'd-adv', 'Luca', 'p-ads', 'Ottimizzazione adset', 1.9, 1),
    e('e4', 'd-cro', 'Giulia', 'p-launch', 'A/B test', 2.1, 1),
  ]
  const spark = [3, 5, 4, 6, 5, 7, 8].map(x => x * 3600)
  return {
    entries, running: null,
    summary: { spark, days: spark.map((s, i) => ({ label: ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'][i], sec: s })), todaySec: 5.8 * 3600, weekSec: 38 * 3600, total7: 38 * 3600,
      members: MEMBERS.slice(0, 3).map((m, i) => ({ name: m.full_name, avatar: null, todaySec: (2 + i) * 3600, weekSec: (9 + i * 3) * 3600 })),
      projects: PROJECTS.map((p, i) => ({ name: p.name, color: p.color, sec: (14 - i * 4) * 3600 })) },
    me: { memberId: 'd-owner', name: 'Marco (Demo)', avatar: null, isAdmin: true },
  }
}

const CHANNELS = [
  { id: 'c-gen', name: 'generale', is_private: false, is_dm: false },
  { id: 'c-mkt', name: 'marketing', is_private: false, is_dm: false },
  { id: 'c-dev', name: 'dev', is_private: false, is_dm: false },
]

// Immagine creative finta (gradiente SVG inline, nessuna rete).
function gradImg(a, b, label) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='320' height='320' rx='18' fill='url(#g)'/><text x='50%' y='53%' font-family='Arial' font-size='30' fill='white' text-anchor='middle' font-weight='bold'>${label}</text></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}
function dailySeries(n, baseSpend) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const spend = round(baseSpend * (0.7 + ((i * 31) % 11) / 11 * 0.6))
    const revenue = round(spend * (2.2 + ((i * 17) % 7) / 7 * 1.4))
    out.push({ date: ymd(Date.now() - i * DAY), spend, revenue, roas: Math.round(revenue / spend * 100) / 100, impressions: spend * 210, link_clicks: round(spend * 4) })
  }
  return out
}

const CREATIVE_DEFS = [
  ['Reel UGC #3', 'Prima e dopo: risultati reali', '#7b5bff', '#5b8bff', 4.1, 1280],
  ['Video Hook 6s', 'Bastano 30 giorni', '#ff375f', '#ff8a5b', 3.7, 1620],
  ['Carosello Bundle', '3 prodotti, 1 prezzo', '#30d158', '#28b14c', 3.0, 980],
  ['Statico Promo', '-20% solo questa settimana', '#fbbf24', '#ff9f0a', 2.2, 640],
  ['Testimonial Clara', '"Non torno più indietro"', '#bf5af2', '#7b5bff', 1.8, 410],
  ['Before/After', 'La differenza si vede', '#0a84ff', '#5b8bff', 2.9, 870],
  ['Unboxing', 'Apri con noi la box', '#64d2ff', '#5b8bff', 3.4, 1130],
  ['Founder Story', 'Perché l\'abbiamo creato', '#ff6482', '#bf5af2', 2.6, 720],
]
function demoCreativeRows() {
  return CREATIVE_DEFS.map((c, i) => {
    const [name, copy, ca, cb, roas, spend] = c
    const revenue = round(spend * roas)
    const impressions = round(spend * 210)
    const link_clicks = round(spend * 4.2)
    const orders = round(revenue / 72)
    const img = gradImg(ca, cb, 'AD ' + (i + 1))
    return {
      id: 'cr' + i, ad_id: 'ad' + i, creative_id: 'cre' + i, name, ad_name: name,
      adset_name: i % 2 ? 'Retargeting 7d' : 'Prospecting Broad', adset_id: 'as' + (i % 3),
      campaign_name: i % 2 ? 'Retargeting' : 'Prospecting', campaign_id: 'cmp' + (i % 2),
      spend, purchase_value: revenue, revenue, roas, impressions, link_clicks, clicks: link_clicks,
      cpc_link: Math.round(spend / link_clicks * 100) / 100, cpc: Math.round(spend / link_clicks * 100) / 100,
      ctr_link: Math.round(link_clicks / impressions * 10000) / 100, ctr: Math.round(link_clicks / impressions * 10000) / 100,
      orders, purchases: orders, conversione_acquisti: 1.8, cost_per_result: Math.round(spend / orders * 100) / 100,
      frequency: 1.6 + (i % 5) * 0.3, reach: round(impressions / 1.7), cpm: Math.round(spend / impressions * 100000) / 100,
      headline: name, copy, description: copy, cta: 'Acquista ora', link: 'https://acme.store',
      status: 'ACTIVE', thumbnail_url: img, image_url: img, display_image_url: img, products: [],
    }
  })
}
function creativeSummary(rows) {
  const s = (f) => rows.reduce((a, r) => a + (r[f] || 0), 0)
  const spend = s('spend'), rev = s('revenue'), imp = s('impressions'), lc = s('link_clicks'), ord = s('orders')
  return { creatives: rows.length, spend, purchase_value: rev, revenue: rev, roas: Math.round(rev / spend * 100) / 100, impressions: imp, link_clicks: lc, clicks: lc, orders: ord, purchases: ord, cpc_link: Math.round(spend / lc * 100) / 100, ctr_link: Math.round(lc / imp * 10000) / 100, frequency: 1.7, cost_per_result: Math.round(spend / ord * 100) / 100 }
}

function demoMetaDetailRows() {
  const defs = [
    ['Prospecting Broad', 4120, 2.1], ['Retargeting 7d', 1980, 4.3], ['Lookalike 3%', 2640, 2.8],
    ['Advantage+ Shop', 3310, 1.6], ['Catalog DPA', 1450, 3.5], ['Brand Awareness', 900, 1.2],
  ]
  return defs.map((d, i) => {
    const [name, spend, roas] = d
    const revenue = round(spend * roas), impressions = round(spend * 210), link_clicks = round(spend * 4), orders = round(revenue / 72)
    return { id: 'm' + i, name, level: 'campaign', status: 'ACTIVE', spend, impressions, reach: round(impressions / 1.7), frequency: Math.round((1.4 + i * 0.2) * 100) / 100, link_clicks, ctr_link: Math.round(link_clicks / impressions * 10000) / 100, cpc_link: Math.round(spend / link_clicks * 100) / 100, cpm: Math.round(spend / impressions * 100000) / 100, purchases: orders, conversione_acquisti: Math.round(orders / link_clicks * 10000) / 100, cost_per_result: Math.round(spend / orders * 100) / 100, roas, aov_campagna: 72, cro_campagna: 1.9, thumbnail_url: gradImg('#0866FF', '#5b8bff', name.slice(0, 2)), products: [] }
  })
}
function metaSummaryOf(rows) {
  const s = (f) => rows.reduce((a, r) => a + (r[f] || 0), 0)
  const spend = s('spend'), rev = rows.reduce((a, r) => a + r.spend * r.roas, 0), imp = s('impressions'), lc = s('link_clicks'), ord = s('purchases')
  return { spend, roas: Math.round(rev / spend * 100) / 100, ctr_link: Math.round(lc / imp * 10000) / 100, cpc_link: Math.round(spend / lc * 100) / 100, cpm: Math.round(spend / imp * 100000) / 100, frequency: 1.7, purchases: ord, reach: round(imp / 1.7), impressions: imp, link_clicks: lc, cost_per_result: Math.round(spend / ord * 100) / 100, conversione_acquisti: Math.round(ord / lc * 10000) / 100, aov_campagna: 72, cro_campagna: 1.9 }
}

// Mappa pathname → payload demo. Ritorna undefined per endpoint non gestiti
// (l'intercettore restituirà {} → i componenti usano i loro default vuoti).
export function demoData(path, search, method = 'GET') {
  const p = path.replace(/\/$/, '')

  if (p === '/api/metrics') return demoMetrics()
  if (p === '/api/realtime') return { activeUsers: 37, byCountry: [{ country: 'IT', countryCode: 'IT', users: 21 }, { country: 'DE', countryCode: 'DE', users: 6 }, { country: 'FR', countryCode: 'FR', users: 4 }, { country: 'ES', countryCode: 'ES', users: 3 }, { country: 'US', countryCode: 'US', users: 3 }], byPage: [{ page: '/', users: 12 }, { page: '/products', users: 9 }, { page: '/checkout', users: 4 }] }

  if (p === '/api/team-members') return { members: MEMBERS, roles: ['cro_specialist', 'ecommerce_manager', 'advertising_manager', 'data_analyst'], roleLabels: { admin: 'Admin', cro_specialist: 'CRO Specialist', ecommerce_manager: 'E-commerce Manager', advertising_manager: 'Advertising / Marketing / SEO', data_analyst: 'Data Analyst / Revisore' }, seats: { plan: 'scale', limit: null, used: MEMBERS.length }, me: { userId: 'd-owner', memberId: 'd-owner', roles: ['admin'], isAdmin: true, isMember: false } }
  if (p === '/api/onboarding') return { completed: true, steps: { shopify: true, meta: true, ga4: true, klaviyo: true } }
  if (p === '/api/stripe/subscription') return { subscription: { id: 'sub_demo', status: 'active', priceId: null, planId: 'scale', currentPeriodStart: Math.floor(Date.now() / 1000) - 10 * DAY / 1000, currentPeriodEnd: Math.floor(Date.now() / 1000) + 20 * DAY / 1000, cancelAtPeriodEnd: false, amount: 29900, currency: 'eur', interval: 'month' }, paymentMethod: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028 }, invoices: [] }
  if (p === '/api/plan-usage') return { plan: 'scale', orders: 1284, recommended: { plan: 'scale', label: 'Scale', price: '€299' }, current: { plan: 'scale', label: 'Scale', max: 7000 }, over: false }
  if (p === '/api/integrations/status') return { connected: ['facebook', 'klaviyo-oauth'], metaAccountId: 'act_demo', googleConnected: true, ga4PropertyId: 'properties/000000' }
  if (p === '/api/integrations') return { active: [], available: [] }
  if (p === '/api/notifications') return { notifications: [] }
  if (p === '/api/alerts') return { alerts: [] }
  if (p === '/api/recommendations') return { recommendations: [] }
  if (p === '/api/insights') return { insights: [] }
  if (p === '/api/profile') return { profile: { id: 'd-owner', full_name: 'Marco (Demo)', email: 'owner@acme.demo', avatar_url: null, roles: ['admin'] } }
  if (p === '/api/presence') return { ok: true }

  if (p === '/api/tasks') return { tasks: demoTasks(), me: { memberId: 'd-owner', roles: ['admin'], isAdmin: true } }
  if (p === '/api/projects') return { projects: PROJECTS }
  if (p === '/api/task-comments') return { comments: [] }
  if (p === '/api/time-entries') return demoTimeEntries()
  if (p === '/api/time-approvals') return { approvals: [], me: { isAdmin: true, memberId: 'd-owner' } }
  if (p === '/api/time-off') return { requests: [], me: { memberId: 'd-owner', isAdmin: true } }

  if (p === '/api/channels') return { channels: CHANNELS, me: { memberId: 'd-owner', isAdmin: true }, lastAt: {} }
  if (p === '/api/channel-members') return { member_ids: ['d-owner', 'd-cro', 'd-adv'] }
  if (p === '/api/channel-messages') return { messages: [
    { id: 'm1', channel_id: 'c-gen', author_id: 'd-cro', author_name: 'Giulia', body: 'Il ROAS Meta è risalito a 2,8x 🚀', created_at: iso(Date.now() - 3600000), reactions: {}, thread_root: null, reply_count: 0 },
    { id: 'm2', channel_id: 'c-gen', author_id: 'd-owner', author_name: 'Marco (Demo)', body: 'Ottimo, scaliamo il retargeting allora', created_at: iso(Date.now() - 1800000), reactions: {}, thread_root: null, reply_count: 0 },
  ] }
  if (p === '/api/chat-files') return { files: [] }
  if (p === '/api/brand-identity') return { companyName: 'Acme Store', identity: { description: 'Brand DTC demo', tone: 'Diretto e amichevole', target: '25-45 sportivi' }, assets: [] }
  if (p === '/api/pnl/config') return { config: {} }
  if (p === '/api/push/subscribe') return { publicKey: null }

  // ── Creative (creatives finte con immagini) ──
  if (p === '/api/creative') {
    const rows = demoCreativeRows()
    return { ok: true, preset: 'last_30d', level: 'ad', accountFilter: '', accounts: ['act_demo'], allAccounts: ['act_demo'], rows, summary: creativeSummary(rows), dailySeries: dailySeries(14, 600), sources: { meta: true }, updatedAt: iso(Date.now()) }
  }
  // ── Meta Detail / Meta KPI ──
  if (p === '/api/meta-detail') {
    const rows = demoMetaDetailRows()
    const summary = metaSummaryOf(rows)
    const prev = { ...summary, spend: round(summary.spend * 0.88), roas: Math.round(summary.roas * 0.9 * 100) / 100 }
    return { ok: true, preset: 'last_30d', level: 'campaign', accountFilter: '', accounts: ['act_demo'], allAccounts: ['act_demo'], range: { since: ymd(Date.now() - 30 * DAY), until: ymd(Date.now()) }, previousRange: { since: ymd(Date.now() - 60 * DAY), until: ymd(Date.now() - 30 * DAY) }, summary, previousSummary: prev, comparison: {}, insight: 'Il retargeting performa a 4,3x: c\'è spazio per scalare il budget mantenendo il ROAS sopra target.', todos: ['Scala Retargeting 7d (+20% budget)', 'Rinfresca le creative di Advantage+ Shop (ROAS 1,6x)'], rows, dailySeries: dailySeries(14, 800), sources: { meta: true }, updatedAt: iso(Date.now()) }
  }
  // ── Lighthouse (nessuna anomalia critica in demo) ──
  if (p === '/api/lighthouse') return { preset: 'last_7d', range: { since: ymd(Date.now() - 7 * DAY), until: ymd(Date.now()) }, alerts: [], proposals: [], summary: { high: 0, medium: 0, low: 0, total: 0 }, baseline_window: 14, days_analyzed: 7, updatedAt: iso(Date.now()) }
  // ── LTV & Coorti ──
  if (p === '/api/ltv-cohorts') {
    const months = []
    for (let i = 11; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); months.push(d.toISOString().slice(0, 7)) }
    const cohorts = months.map((m, i) => ({ month: m, customers: round(80 + i * 9), revenue: round((80 + i * 9) * 72 * (1 + i * 0.04)), orders: round((80 + i * 9) * (1.2 + i * 0.03)), retention: [100, 38, 24, 17, 12, 9].map(x => Math.max(0, x - i)) }))
    return { months, since: months[0] + '-01', truncated: false, summary: { customers: 1840, repeatCustomers: 624, repeatRate: 33.9, oneTimeRate: 66.1, avgOrders: 1.42, avgLtv: 104.5, ordersTotal: 2613, revenueTotal: 192300 }, cohorts, distribution: [{ label: '1 ordine', count: 1216 }, { label: '2 ordini', count: 388 }, { label: '3 ordini', count: 152 }, { label: '4+ ordini', count: 84 }], updatedAt: iso(Date.now()) }
  }
  // ── Klaviyo ──
  if (p === '/api/klaviyo') {
    const camp = (name, recipients, or, cr, rev, daysAgo) => ({ id: name, name, subject: name, status: 'Sent', sentAt: iso(Date.now() - daysAgo * DAY), recipients, openRate: or, clickRate: cr, revenue: rev, revenuePerRecipient: Math.round(rev / recipients * 100) / 100 })
    const flow = (name, recipients, or, rev) => ({ id: name, name, status: 'live', recipients, openRate: or, revenue: rev, revenuePerRecipient: Math.round(rev / recipients * 100) / 100 })
    return {
      account: { name: 'Acme Store', id: 'acc_demo' },
      lists: [{ id: 'l1', name: 'Newsletter', count: 18420 }, { id: 'l2', name: 'VIP', count: 2110 }],
      segments: [{ id: 's1', name: 'Engaged 30d', count: 6240 }, { id: 's2', name: 'Win-back', count: 3110 }],
      campaigns: { sent: [camp('Black Week', 18420, 48, 6.2, 21900, 5), camp('Newsletter #42', 16800, 41, 4.1, 2680, 9), camp('Restock alert', 9200, 52, 7.8, 5400, 13)], draft: [{ id: 'd1', name: 'Saldi estate', status: 'Draft' }], scheduled: [{ id: 'sc1', name: 'Promo weekend', status: 'Scheduled', sendAt: iso(Date.now() + 2 * DAY) }] },
      flows: [flow('Welcome Flow', 4200, 62, 8240), flow('Abandoned Cart', 3100, 55, 12470), flow('Win-back 90d', 1800, 34, 3110), flow('Post-purchase', 2600, 58, 4180)],
      metrics: [], kpis: { openRate: 46.2, clickRate: 5.8, revenue: 57000, revenuePerRecipient: 1.9, placedOrderRate: 3.1, deliveryRate: 99.1, unsubRate: 0.3, totalEmailRevenue: 57000, emailRevenueShare: 28 },
    }
  }
  // ── Paesi (KPI Brain) ──
  if (p === '/api/shopify-countries') return { since: ymd(Date.now() - 30 * DAY), until: ymd(Date.now()), countries: [{ country: 'Italia', country_code: 'IT', revenue: 123000, orders: 1640 }, { country: 'Germania', country_code: 'DE', revenue: 27000, orders: 360 }, { country: 'Francia', country_code: 'FR', revenue: 21000, orders: 280 }, { country: 'Spagna', country_code: 'ES', revenue: 13500, orders: 180 }, { country: 'Paesi Bassi', country_code: 'NL', revenue: 7800, orders: 104 }], daily: [], updatedAt: iso(Date.now()) }
  if (p === '/api/product-images') return {}
  // ── Competitor Intel / Price Comparison ──
  if (p === '/api/competitor-intel') return { competitors: [], priceComparison: [], ownStoreName: 'Acme Store', countries: ['IT'], fetchedAt: iso(Date.now()), cached: false }

  return undefined
}
