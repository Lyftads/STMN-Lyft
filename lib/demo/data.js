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

  return undefined
}
