// ============================================================================
//  DEMO DATA — dati 100% inventati per la modalità demo pubblica (/demo).
//  NON tocca nulla del software reale: viene servito solo da un intercettore
//  fetch attivo esclusivamente nella pagina /demo. Brand fittizio "Acme Store".
// ============================================================================

const DAY = 86400000
const iso = (d) => new Date(d).toISOString()
const ymd = (d) => new Date(d).toISOString().slice(0, 10)
const round = (n) => Math.round(n)

// Serie settimanale (ultime 16 settimane) allineata ai LUNEDÌ UTC, così le
// chiavi combaciano con getWeeks() della dashboard (match per s.date).
function buildWeeks() {
  const out = []
  const mon = new Date(); mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7)); mon.setUTCHours(0, 0, 0, 0)
  for (let i = 15; i >= 0; i--) {
    const start = new Date(mon); start.setUTCDate(start.getUTCDate() - i * 7)
    const k = start.toISOString().slice(0, 10)
    const base = 6200 + (15 - i) * 540
    const noise = ((i * 37) % 13) / 13 * 1800 - 600
    const fatturato = round(base + noise)
    const ordini = round(fatturato / 72)
    const nc = round(ordini * 0.62)
    const rc = ordini - nc
    const fatturNC = round(fatturato * 0.62), fatturRC = fatturato - fatturNC
    const uniqueSessions = round(ordini * 46)
    const resi = round(ordini * 0.02)
    const spend = round(fatturato / 2.6)
    const impressions = round(spend * 210)
    const linkClicks = round(impressions * 0.021)
    out.push({
      shop: { week: k, weekStart: k, weekKey: k, date: k, fatturato, fatturNC, fatturRC, ordini, nc, rc, uniqueSessions, resi },
      meta: { week: k, weekStart: k, weekKey: k, date: k, spend, impressions, linkClicks, clicks: linkClicks, reach: round(impressions / 1.7), conversions: round(ordini * 0.8) },
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
    const o = round(f / 72)
    const fNC = round(f * 0.62)
    months.push({ month: d.toISOString().slice(0, 7), fatturato: f, fatturNC: fNC, fatturRC: f - fNC, ordini: o, nc: round(o * 0.6), rc: round(o * 0.4), uniqueSessions: round(o * 46), resi: round(o * 0.02), resiNC: round(o * 0.012), resiRC: round(o * 0.008) })
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
    // Periodo corrente (ultime ~4 settimane) per le card di KPI Brain
    shopifyRange: (() => { const l = shopifyWeekly.slice(-4); const r = sum(l, 'resi'); return { revenue: sum(l, 'fatturato'), fatturNC: sum(l, 'fatturNC'), fatturRC: sum(l, 'fatturRC'), orders: sum(l, 'ordini'), nc: sum(l, 'nc'), rc: sum(l, 'rc'), sessions: sum(l, 'uniqueSessions'), resi: r, resiNC: round(r * 0.6), resiRC: round(r * 0.4) } })(),
    metaRange: (() => { const l = metaWeekly.slice(-4); return { spend: sum(l, 'spend'), impressions: sum(l, 'impressions'), clicks: sum(l, 'linkClicks') } })(),
    shopifyPrevRange: (() => { const l = shopifyWeekly.slice(-8, -4); const r = sum(l, 'resi'); return { revenue: sum(l, 'fatturato'), fatturNC: sum(l, 'fatturNC'), fatturRC: sum(l, 'fatturRC'), orders: sum(l, 'ordini'), nc: sum(l, 'nc'), rc: sum(l, 'rc'), sessions: sum(l, 'uniqueSessions'), resi: r, resiNC: round(r * 0.6), resiRC: round(r * 0.4) } })(),
    metaPrevRange: (() => { const l = metaWeekly.slice(-8, -4); return { spend: sum(l, 'spend'), impressions: sum(l, 'impressions'), clicks: sum(l, 'linkClicks') } })(),
    kpiBrain: {
      preset: 'last_28d',
      range: { since: ymd(Date.now() - 28 * DAY), until: ymd(Date.now()) },
      previousRange: { since: ymd(Date.now() - 56 * DAY), until: ymd(Date.now() - 29 * DAY) },
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

// Dati "manuali" finti (mesi/settimane) per le chiavi localStorage che l'app
// legge: includono la spesa GOOGLE ADS (manuale nell'app). Usato dallo shim
// localStorage SOLO nella demo. Allineato ai mesi/lunedì dei dati /api/metrics.
export function demoLocalStorage() {
  const months = {}
  for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1); const m = d.toISOString().slice(0, 7); const f = 24000 + (5 - i) * 3200; months[m] = { googleSpend: round(f / 2.6 * 0.45) } }
  const weeks = {}
  const mon = new Date(); mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7)); mon.setUTCHours(0, 0, 0, 0)
  for (let i = 15; i >= 0; i--) { const s = new Date(mon); s.setUTCDate(s.getUTCDate() - i * 7); const k = s.toISOString().slice(0, 10); const base = 6200 + (15 - i) * 540; const noise = ((i * 37) % 13) / 13 * 1800 - 600; const fat = round(base + noise); weeks[k] = { google: round(fat / 2.6 * 0.45) } }
  return { stmn_m: JSON.stringify(months), stmn_w: JSON.stringify(weeks), stmn_c: '{}' }
}

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

// Ad finte per Ad Library (ricerca keyword + pagina competitor).
function demoAds(pageName = 'Competitor A', n = 8) {
  const copy = [
    ['Spedizione gratis sopra 49€', 'Scopri la nuova collezione, consegna in 24/48h.'],
    ['-20% solo questa settimana', 'Approfitta dello sconto sui bestseller. Offerta a tempo.'],
    ['Risultati in 30 giorni', 'Migliaia di clienti soddisfatti. Provalo senza rischi.'],
    ['Nuovo arrivo 🔥', 'Il prodotto più richiesto è tornato disponibile.'],
    ['Recensito 4,8/5', 'Oltre 2.400 recensioni verificate. Scopri perché.'],
    ['Bundle risparmio', '3 prodotti, 1 prezzo. Risparmia fino al 35%.'],
    ['Reso facile 30 giorni', 'Soddisfatti o rimborsati. Acquista in sicurezza.'],
    ['Edizione limitata', 'Disponibilità ridotta — non perdere l\'occasione.'],
  ]
  const colors = [['#7b5bff', '#5b8bff'], ['#ff375f', '#ff8a5b'], ['#30d158', '#28b14c'], ['#fbbf24', '#ff9f0a'], ['#bf5af2', '#7b5bff'], ['#0a84ff', '#5b8bff'], ['#64d2ff', '#5b8bff'], ['#ff6482', '#bf5af2']]
  const out = []
  for (let i = 0; i < n; i++) {
    const [title, body] = copy[i % copy.length]
    const img = gradImg(colors[i % colors.length][0], colors[i % colors.length][1], 'AD ' + (i + 1))
    out.push({
      id: 'al' + i, imageUrl: img, videoUrl: null, isVideo: false, pageName,
      platforms: i % 3 === 0 ? ['facebook', 'instagram'] : ['facebook'],
      snapshotUrl: 'https://www.facebook.com/ads/library/', startDate: ymd(Date.now() - (i * 6 + 3) * DAY),
      titles: [title], bodies: [body], descriptions: [body], captions: ['Acquista ora'],
    })
  }
  return out
}

function demoAttribution() {
  const revenue = 55298, orders = 768, adSpend = 21268, metaRevenue = 32000, metaPurchases = 444
  const blendedMer = Math.round(revenue / adSpend * 100) / 100
  const metaRoas = Math.round(metaRevenue / adSpend * 100) / 100
  const paidRevenue = Math.round(revenue * 0.6), organicRevenue = revenue - paidRevenue
  const dl = pct => ({ pct })
  const daily = []
  for (let i = 27; i >= 0; i--) { const rev = round(1400 + ((i * 53) % 17) / 17 * 1400); const sp = round(rev / 2.6); daily.push({ date: ymd(Date.now() - i * DAY), revenue: rev, adSpend: sp, blendedMer: Math.round(rev / sp * 100) / 100, metaRoas: Math.round((rev * 0.6) / sp * 100) / 100 }) }
  const channels = [
    { label: 'Meta Ads', revenue: round(revenue * 0.38), orders: round(orders * 0.38), aov: 72, share: 38 },
    { label: 'Organic Search', revenue: round(revenue * 0.24), orders: round(orders * 0.24), aov: 72, share: 24 },
    { label: 'Google Ads', revenue: round(revenue * 0.21), orders: round(orders * 0.21), aov: 72, share: 21 },
    { label: 'Email', revenue: round(revenue * 0.12), orders: round(orders * 0.12), aov: 71, share: 12 },
    { label: 'Direct', revenue: round(revenue * 0.05), orders: round(orders * 0.05), aov: 70, share: 5 },
  ]
  return {
    hasShopify: true, hasMeta: true,
    totals: { revenue, orders, adSpend, blendedMer, metaRevenue, metaRoas, metaPurchases },
    delta: { revenue: dl(18.2), adSpend: dl(9.1), blendedMer: dl(6.4), metaRoas: dl(-3.1) },
    split: { paidRevenue, paidOrders: round(orders * 0.6), paidPct: 60, organicRevenue, organicOrders: round(orders * 0.4), organicPct: 40, deltaPaid: dl(12.0), deltaOrganic: dl(7.5) },
    customers: { ncRevenue: round(revenue * 0.62), rcRevenue: round(revenue * 0.38), nc: round(orders * 0.62), rc: round(orders * 0.38), ncPct: 62 },
    channels, daily,
    attribution: { metaRevenue, metaTrackedRevenue: round(metaRevenue * 0.82), gap: round(metaRevenue * 0.18), overAttributionPct: 18 },
    updatedAt: iso(Date.now()),
  }
}

function metaKpiBucket(spend, factor = 1) {
  const revenue = round(spend * 1.5 * factor)
  const impressions = round(spend * 210)
  const clicks = round(impressions * 0.021)
  const link_clicks = round(clicks * 0.9)
  const purchases = round(revenue / 72)
  return {
    spend: round(spend), revenue, purchases,
    impressions, clicks, link_clicks,
    reach: round(impressions / 1.7), frequency: 1.7,
    roas: Math.round(revenue / spend * 100) / 100,
    cpo: Math.round(spend / purchases * 100) / 100,
    cpm: Math.round(spend / impressions * 100000) / 100,
    ctr: Math.round(clicks / impressions * 10000) / 100,
    ctr_link: Math.round(link_clicks / impressions * 10000) / 100,
    cpc: Math.round(spend / clicks * 100) / 100,
    cpc_link: Math.round(spend / link_clicks * 100) / 100,
  }
}
function demoMetaKpi() {
  const totals = metaKpiBucket(21268)
  const prevTotals = metaKpiBucket(19200, 0.92)
  const daily = []
  for (let i = 27; i >= 0; i--) { const sp = 600 + ((i * 41) % 13) / 13 * 500; daily.push({ date: ymd(Date.now() - i * DAY), ...metaKpiBucket(sp) }) }
  return { preset: 'last_28d', range: { since: ymd(Date.now() - 28 * DAY), until: ymd(Date.now()) }, prevRange: { since: ymd(Date.now() - 56 * DAY), until: ymd(Date.now() - 29 * DAY) }, accounts: ['act_demo'], totals, prevTotals, daily, updatedAt: iso(Date.now()) }
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
  if (p === '/api/attribution') return demoAttribution()
  if (p === '/api/meta-kpi') return demoMetaKpi()
  if (p === '/api/budget-advisor') {
    const defs = [
      ['Retargeting 7d', 1980, 4.3, 'scala', 25], ['Catalog DPA', 1450, 3.5, 'scala', 25], ['Lookalike 3%', 2640, 3.2, 'scala', 25],
      ['Prospecting Broad', 4120, 2.4, 'mantieni', 0], ['Advantage+ Shop', 3310, 1.5, 'riduci', -30], ['Brand Awareness', 900, 0.8, 'taglia', -100],
    ]
    const campaigns = defs.map((d, i) => { const [name, spend, roas, action, deltaPct] = d; const revenue = round(spend * roas); const suggestedSpend = Math.round(spend * (1 + deltaPct / 100) * 100) / 100; return { id: 'b' + i, name, spend, revenue, roas, cpa: Math.round(spend / (revenue / 72) * 100) / 100, action, deltaPct, suggestedSpend } }).sort((a, b) => b.spend - a.spend)
    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
    const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0)
    const mer = Math.round(totalRevenue / totalSpend * 100) / 100
    const freed = campaigns.filter(c => c.deltaPct < 0).reduce((s, c) => s + (c.spend - c.suggestedSpend), 0)
    return {
      preset: 'last_28d', accounts: [{ id: 'act_demo', name: 'Acme Store' }], account: 'act_demo',
      totalSpend, totalRevenue, mer,
      prev: { totalSpend: round(totalSpend * 0.91), totalRevenue: round(totalRevenue * 0.86), mer: Math.round(mer * 0.94 * 100) / 100 },
      delta: { spend: { abs: round(totalSpend * 0.09), pct: 9.1 }, revenue: { abs: round(totalRevenue * 0.14), pct: 16.2 }, mer: { abs: 0.2, pct: 8.5 } },
      counts: { scala: 3, riduci: 1, taglia: 1 },
      reallocation: { freed: round(freed), forecastDelta: round(freed * 2.4), avgScaleRoas: 3.6, avgCutRoas: 1.2, scaleSpend: round(campaigns.filter(c => c.action === 'scala').reduce((s, c) => s + c.spend, 0)), cutSpend: round(freed) },
      campaigns, updatedAt: iso(Date.now()),
    }
  }
  if (p === '/api/creative-fatigue') {
    const defs = [
      ['Testimonial Clara', 'Retargeting', 6.1, 0.9, 41, 980], ['Statico Promo', 'Prospecting', 5.2, 1.1, 36, 1240],
      ['Before/After', 'Retargeting', 4.6, 1.4, 31, 760], ['Reel UGC #3', 'Prospecting', 3.1, 2.4, 22, 1680],
      ['Carosello Bundle', 'Lookalike', 2.4, 2.8, 19, 1130], ['Video Hook 6s', 'Prospecting', 1.8, 3.6, 16, 1420],
      ['Unboxing', 'Lookalike', 1.6, 3.2, 18, 870], ['Founder Story', 'Prospecting', 1.4, 2.9, 21, 640],
    ]
    const ads = defs.map((d, i) => {
      const [name, adset, frequency, ctr, cpa, spend] = d
      const score = Math.round((frequency * 0.9 + (4 - ctr) * 0.6 + (cpa / 12)) * 100) / 100
      const severity = (frequency >= 5 || score >= 4) ? 'high' : (score >= 2.2 ? 'medium' : 'low')
      return { id: 'f' + i, adId: 'ad' + i, name, campaign: adset === 'Retargeting' ? 'Retargeting' : 'Prospecting', adset, frequency, ctr, cpa, spend, score, severity, refresh: severity !== 'low', thumbnail: gradImg(['#ff375f', '#7b5bff', '#30d158', '#fbbf24'][i % 4], '#5b8bff', 'AD ' + (i + 1)) }
    }).sort((a, b) => b.score - a.score)
    return { ok: true, preset: 'last_28d', accounts: ['act_demo'], ads, total: ads.length, toRefresh: ads.filter(a => a.refresh).length, updatedAt: iso(Date.now()) }
  }
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
  // ── Conto Economico (P&L) ──
  if (p === '/api/pnl') {
    const series = [], cogsByMonth = {}, feesByMonth = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1)
      const month = d.toISOString().slice(0, 7)
      const totalSales = 24000 + (5 - i) * 3200
      const netSales = round(totalSales / 1.22)
      const orders = round(totalSales / 72)
      series.push({ month, totalSales, netSales, orders })
      cogsByMonth[month] = round(netSales * 0.34)
      feesByMonth[month] = round(totalSales * 0.025)
    }
    return { configured: true, months: 6, since: series[0].month, until: series[5].month, series, metricRows: [], cogsByMonth, cogsSource: 'shopify', cogsRatio: 0.34, avgMargin: 0.66, feesByMonth, feesSource: 'shopify-payments', updatedAt: iso(Date.now()) }
  }
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
  // ── Lighthouse (anomalie finte) ──
  if (p === '/api/lighthouse') {
    const mk = (metric, key, sev, cur, base, fmt, hiw, cause, suggestion) => ({ id: ymd(Date.now() - DAY) + '-' + key, date: ymd(Date.now() - DAY), metric, metric_key: key, current: cur, baseline: base, current_fmt: fmt(cur), baseline_fmt: fmt(base), deviation_pct: Math.round((cur - base) / base * 1000) / 10, severity: sev, higher_is_worse: hiw, cause, suggestion })
    const alerts = [
      mk('ROAS', 'roas', 'high', 1.6, 2.7, v => `${v.toFixed(2)}x`, false, 'Calo improvviso del ritorno sulla spesa pubblicitaria', 'Verifica le campagne Advantage+ e metti in pausa gli adset sotto 1,5x'),
      mk('CPM', 'cpm', 'medium', 28.4, 21.2, v => `€${v.toFixed(2)}`, true, 'Costo per mille impression in aumento', 'Rinfresca le creative: la frequenza alta sta facendo salire il CPM'),
      mk('Frequenza', 'frequency', 'low', 3.9, 2.8, v => v.toFixed(2), true, 'Frequenza sopra la soglia consigliata', 'Allarga il pubblico o aggiungi nuove creative per ridurre la saturazione'),
    ]
    return { preset: 'last_7d', range: { since: ymd(Date.now() - 7 * DAY), until: ymd(Date.now()) }, alerts, proposals: [], summary: { high: 1, medium: 1, low: 1, total: 3 }, baseline_window: 14, days_analyzed: 7, updatedAt: iso(Date.now()) }
  }
  // ── LTV & Coorti ──
  if (p === '/api/ltv-cohorts') {
    const months = []
    for (let i = 11; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); months.push(d.toISOString().slice(0, 7)) }
    const mLabel = (m) => { const d = new Date(m + '-01'); return d.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }) }
    // newest first (in alto), effetto maturità: recenti = repeat/LTV più bassi
    const cohorts = [...months].reverse().map((m, i) => {
      const size = round(70 + ((11 - i) * 11) + ((i * 7) % 9) * 3)
      const repeatRate = Math.round(Math.max(9, 40 - i * 2.4) * 10) / 10
      const avgOrders = Math.round(Math.max(1.05, 1.9 - i * 0.06) * 100) / 100
      const ltv = round(Math.max(58, 125 - i * 5))
      return { cohort: m, label: mLabel(m), size, repeatRate, avgOrders, ltv }
    })
    return { months, since: months[0] + '-01', truncated: false, summary: { customers: 1840, repeatCustomers: 624, repeatRate: 33.9, oneTimeRate: 66.1, avgOrders: 1.42, avgLtv: 104.5, ordersTotal: 2613, revenueTotal: 192300 }, cohorts, distribution: [{ label: '1 ordine', count: 1216 }, { label: '2 ordini', count: 388 }, { label: '3 ordini', count: 152 }, { label: '4+ ordini', count: 84 }], updatedAt: iso(Date.now()) }
  }
  // ── Klaviyo ──
  if (p === '/api/klaviyo') {
    if (search && search.get && search.get('part') === 'breakdown') {
      return { revenueBreakdown: {
        campaigns: { rows: [
          { campaignId: 'c-bw', name: 'Black Week', revenue: 21900, openRate: 48, clickRate: 6.2, conversions: 304 },
          { campaignId: 'c-nl', name: 'Newsletter #42', revenue: 2680, openRate: 41, clickRate: 4.1, conversions: 37 },
          { campaignId: 'c-rs', name: 'Restock alert', revenue: 5400, openRate: 52, clickRate: 7.8, conversions: 75 },
        ] },
        flows: { rows: [
          { flowId: 'f-ab', name: 'Abandoned Cart', revenue: 12470, openRate: 55, clickRate: 9.1 },
          { flowId: 'f-wc', name: 'Welcome Flow', revenue: 8240, openRate: 62, clickRate: 11.4 },
          { flowId: 'f-pp', name: 'Post-purchase', revenue: 4180, openRate: 58, clickRate: 6.7 },
          { flowId: 'f-wb', name: 'Win-back 90d', revenue: 3110, openRate: 34, clickRate: 3.9 },
        ] },
      } }
    }
    const dates = []; for (let i = 27; i >= 0; i--) dates.push(ymd(Date.now() - i * DAY))
    const series = (total) => ({ total, dates, values: dates.map((_, i) => round(total / 28 * (0.7 + ((i * 13) % 9) / 9 * 0.6))) })
    const camp = (id, name, recipients, or, cr, rev, daysAgo) => ({ id, name, subject: name, status: 'Sent', sentAt: iso(Date.now() - daysAgo * DAY), recipients, openRate: or, clickRate: cr, revenue: rev, revenuePerRecipient: Math.round(rev / recipients * 100) / 100 })
    return {
      account: { name: 'Acme Store', id: 'acc_demo' },
      lists: [{ id: 'l1', name: 'Newsletter', count: 18420 }, { id: 'l2', name: 'VIP', count: 2110 }],
      segments: [{ id: 's1', name: 'Engaged 30d', count: 6240 }, { id: 's2', name: 'Win-back', count: 3110 }],
      campaigns: {
        sent: [camp('c-bw', 'Black Week', 18420, 48, 6.2, 21900, 5), camp('c-nl', 'Newsletter #42', 16800, 41, 4.1, 2680, 9), camp('c-rs', 'Restock alert', 9200, 52, 7.8, 5400, 13)],
        draft: [{ id: 'd1', name: 'Saldi estate', status: 'Draft' }],
        scheduled: [{ id: 'sc1', name: 'Promo weekend', status: 'Scheduled', sentAt: iso(Date.now() + 2 * DAY), recipients: 17000 }],
      },
      flows: [{ id: 'f-wc', name: 'Welcome Flow' }, { id: 'f-ab', name: 'Abandoned Cart' }, { id: 'f-wb', name: 'Win-back 90d' }, { id: 'f-pp', name: 'Post-purchase' }],
      metrics: [],
      kpis: {
        received: series(86000), opened: series(39700), clicked: series(4980), revenue: series(57000),
        bounced: { total: 760 }, unsubscribed: { total: 210 },
        openRate: 46.2, clickRate: 5.8, ctor: 12.5,
      },
    }
  }
  // ── Paesi (KPI Brain) ──
  if (p === '/api/shopify-countries') return { since: ymd(Date.now() - 30 * DAY), until: ymd(Date.now()), countries: [{ country: 'Italia', country_code: 'IT', revenue: 123000, orders: 1640 }, { country: 'Germania', country_code: 'DE', revenue: 27000, orders: 360 }, { country: 'Francia', country_code: 'FR', revenue: 21000, orders: 280 }, { country: 'Spagna', country_code: 'ES', revenue: 13500, orders: 180 }, { country: 'Paesi Bassi', country_code: 'NL', revenue: 7800, orders: 104 }], daily: [], updatedAt: iso(Date.now()) }
  if (p === '/api/product-images') return {}
  // ── Competitor Intel / Price Comparison ──
  if (p === '/api/competitor-intel') return { competitors: [], priceComparison: [], ownStoreName: 'Acme Store', countries: ['IT'], fetchedAt: iso(Date.now()), cached: false }
  // Ad Library: ricerca per keyword + creative attive della pagina competitor
  if (p === '/api/adlibrary-search') { const q = (search && search.get && search.get('q')) || ''; return { ok: true, query: q, ads: demoAds('Brand ' + (q ? q.slice(0, 12) : 'X'), 9), total: 24 } }
  if (p === '/api/adlibrary-page') return { ok: true, ads: demoAds('Competitor', 12), total: 18, capped: false, source: 'api' }
  if (p === '/api/creative-reverse') return { ok: true }

  // ── Google Search Console (dati generici, dominio acme.store) ──
  if (p === '/api/gsc') {
    if (!(search && search.get && search.get('site'))) {
      return { configured: true, sites: [{ siteUrl: 'sc-domain:acme.store', permission: 'siteOwner' }] }
    }
    const KW = ['scarpe running uomo', 'integratori sportivi', 'magliette tecniche', 'borraccia termica', 'recovery muscolare', 'leggings palestra', 'proteine vegane', 'set allenamento casa', 'fascia plantare', 'guanti palestra', 'tappetino yoga', 'corda salto']
    const queries = KW.map((k, i) => { const impressions = round(4200 - i * 280 + (i % 3) * 140); const ctr = Math.round((0.02 + (i % 5) * 0.012) * 10000) / 10000; const clicks = round(impressions * ctr); return { key: k, query: k, clicks, impressions, ctr, position: Math.round((3 + i * 1.3) * 10) / 10 } })
    const pages = ['/', '/running', '/integratori', '/abbigliamento', '/accessori', '/blog/guida-recovery'].map((pg, i) => { const impressions = round(6000 - i * 700); const clicks = round(impressions * (0.05 - i * 0.005)); return { key: 'https://acme.store' + pg, page: 'https://acme.store' + pg, clicks, impressions, ctr: Math.round(clicks / impressions * 10000) / 10000, position: Math.round((4 + i) * 10) / 10 } })
    const totClicks = queries.reduce((s, q) => s + q.clicks, 0), totImpr = queries.reduce((s, q) => s + q.impressions, 0)
    const totals = { clicks: totClicks, impressions: totImpr, ctr: Math.round(totClicks / totImpr * 10000) / 10000, position: 8.4 }
    const series = []
    for (let i = 27; i >= 0; i--) { const cl = round(totClicks / 28 * (0.7 + ((i * 13) % 9) / 9 * 0.6)); series.push({ date: ymd(Date.now() - i * DAY), clicks: cl, impressions: round(cl / totals.ctr) }) }
    const countries = [['ita', 'Italia'], ['deu', 'Germania'], ['fra', 'Francia'], ['esp', 'Spagna']].map(([k, n], i) => ({ key: k, country: n, clicks: round(totClicks * [0.62, 0.16, 0.13, 0.09][i]), impressions: round(totImpr * [0.62, 0.16, 0.13, 0.09][i]), ctr: totals.ctr, position: 8 + i }))
    const devices = [['MOBILE', 0.64], ['DESKTOP', 0.30], ['TABLET', 0.06]].map(([k, w]) => ({ key: k, clicks: round(totClicks * w), impressions: round(totImpr * w), ctr: totals.ctr, position: 8.4 }))
    return {
      configured: true, site: 'sc-domain:acme.store', range: {}, prevRange: {}, days: 28,
      totals, deltas: { clicks: 12.4, impressions: 8.1, ctr: 3.2, position: -0.6 },
      series, queries, pages, countries, devices,
      appearance: [{ key: 'Risultati multimediali', clicks: round(totClicks * 0.3), impressions: round(totImpr * 0.3), ctr: totals.ctr, position: 6.2 }],
      branded: { brandedClicks: round(totClicks * 0.28), nonBrandedClicks: round(totClicks * 0.72), tokens: ['acme', 'acme store', 'acmestore'] },
      pageMovers: { up: pages.slice(0, 3).map(p => ({ key: p.key, clicks: p.clicks, prev: round(p.clicks * 0.8), delta: round(p.clicks * 0.2) })), down: pages.slice(3, 5).map(p => ({ key: p.key, clicks: p.clicks, prev: round(p.clicks * 1.2), delta: -round(p.clicks * 0.2) })) },
      opportunities: { nearFirstPage: queries.filter(q => q.position > 10 && q.position <= 20).slice(0, 8), lowCtr: queries.filter(q => q.position <= 10 && q.ctr < 0.03).slice(0, 8) },
      updatedAt: iso(Date.now()),
    }
  }
  // ── AI Website Scanner (risultato finto completo, niente errore) ──
  if (p === '/api/website-scanner') {
    const shot = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'><rect width='1200' height='800' fill='#0f1117'/><rect width='1200' height='70' fill='#16181f'/><text x='40' y='44' font-family='Arial' font-size='24' fill='#fff' font-weight='bold'>Acme Store</text><rect x='980' y='22' width='180' height='32' rx='8' fill='#7b5bff'/><text x='1070' y='44' font-family='Arial' font-size='15' fill='#fff' text-anchor='middle'>Acquista ora</text><rect x='80' y='150' width='560' height='460' rx='14' fill='#1c1f2a'/><text x='110' y='250' font-family='Arial' font-size='40' fill='#fff' font-weight='bold'>Allenati meglio.</text><text x='110' y='300' font-family='Arial' font-size='40' fill='#9aa' >Risultati in 30 giorni.</text><rect x='110' y='350' width='220' height='54' rx='10' fill='#7b5bff'/><text x='220' y='385' font-family='Arial' font-size='18' fill='#fff' text-anchor='middle'>Scopri i prodotti</text><rect x='700' y='150' width='420' height='460' rx='14' fill='#222634'/></svg>`)
    return {
      ok: true, url: 'https://acme.store', viewport: 'desktop', provider: 'browserless-eu',
      screenshotDataUrl: shot, fallbackErrors: [],
      analysis: {
        overallScore: 72, scoreLabel: 'Buono',
        summary: 'La home comunica bene il beneficio principale e ha una CTA chiara above the fold. Mancano però alcuni trust signal e la valle visiva sotto la fold è poco guidata.',
        firstImpression: 'Hero pulito con claim forte e CTA viola ad alto contrasto. Si capisce subito cosa vende il brand, ma non si vedono recensioni o garanzie nei primi 3 secondi.',
        works: [
          { title: 'CTA principale ad alto contrasto', details: 'Il bottone viola spicca sul fondo scuro e segue il pattern a F: occhio guidato bene.', impact: 'high' },
          { title: 'Value proposition immediata', details: 'L\'headline comunica il beneficio (risultati in 30 giorni) senza gergo.', impact: 'medium' },
          { title: 'Header essenziale', details: 'Navigazione minimale che non distrae dalla conversione.', impact: 'medium' },
        ],
        improve: [
          { title: 'Aggiungi social proof above the fold', current: 'Nessuna recensione visibile nella prima schermata.', suggestion: 'Inserisci una riga "★ 4,8/5 · 2.400+ recensioni" subito sotto la CTA.', example: '★★★★★ 4,8/5 — oltre 2.400 clienti soddisfatti', priority: 'high', expectedImpact: '+0,8-1,5pp CR' },
          { title: 'CTA copy più specifico', current: 'CTA generica "Scopri i prodotti".', suggestion: 'Cambia in "Scopri i bestseller · spedizione gratis" per ridurre l\'attrito.', example: 'Scopri i bestseller · spedizione gratis', priority: 'medium', expectedImpact: '+12% click sulla CTA' },
        ],
        remove: [
          { title: 'Blocco vuoto a destra dell\'hero', reason: 'Spazio non sfruttato che indebolisce il focus sul claim.', alternative: 'Inseriscici un\'immagine prodotto o un video di 6 secondi.' },
        ],
        quickWins: ['Aggiungi "★ 4,8/5" sotto la CTA', 'Rendi la CTA sticky su mobile', 'Mostra i loghi dei metodi di pagamento nel footer', 'Aggiungi "spedizione gratis sopra 49€" nella top bar', 'Comprimi le immagini hero per migliorare il LCP'],
        ctaAnalysis: { primaryCta: 'Scopri i prodotti', position: 'sopra la fold, ben visibile', contrast: 'alto', verdict: 'Posizione e contrasto ottimi, copy migliorabile aggiungendo un incentivo.' },
        trustSignals: { present: ['Header brandizzato', 'CTA chiara'], missing: ['Recensioni clienti', 'Garanzia soddisfatti o rimborsati', 'Loghi metodi di pagamento', 'Badge spedizione gratuita'] },
        copyAnalysis: { headline: '"Allenati meglio. Risultati in 30 giorni." — forte e orientato al beneficio', valueProposition: 'chiara', tone: 'Diretto e motivazionale, coerente con un target sportivo' },
      },
      updatedAt: iso(Date.now()),
    }
  }
  // ── Creative Lab / SEO (azione-driven: stato vuoto pulito) ──
  if (p === '/api/creative-lab') return { ok: true, items: [], generations: [] }
  if (p === '/api/seo-audit/history') return { items: [] }
  if (p === '/api/seo-ai' || p === '/api/seo-competitor') return { ok: true }

  return undefined
}
