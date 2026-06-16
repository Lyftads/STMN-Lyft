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

function demoPriceComparison() {
  const cats = [
    { id: 'men_apparel', label: 'Abbigliamento Uomo', ownAvg: 38.0 },
    { id: 'women_apparel', label: 'Abbigliamento Donna', ownAvg: 36.0 },
    { id: 'bags', label: 'Zaini & Borsoni', ownAvg: 49.0 },
  ]
  const comps = ['Competitor A', 'Competitor B', 'Competitor C']
  const r2 = n => Math.round(n * 100) / 100
  return cats.map(c => {
    const ownProducts = [0, 1, 2].map(i => ({ title: `Modello ${['Base', 'Pro', 'Elite'][i]}`, price: r2(c.ownAvg + (i - 1) * 4), compareAtPrice: 0, onSale: false, image: gradImg('#7b5bff', '#5b8bff', '€') }))
    const own = { count: ownProducts.length, avg: c.ownAvg, min: Math.min(...ownProducts.map(p => p.price)), max: Math.max(...ownProducts.map(p => p.price)), products: ownProducts }
    const competitors = {}
    comps.forEach((name, j) => {
      const avg = r2(c.ownAvg * (1 + (j - 1) * 0.12))
      const deltaEuro = r2(c.ownAvg - avg)
      const products = [0, 1].map(i => ({ title: `${name} ${i + 1}`, price: r2(avg + (i - 0.5) * 3), compareAtPrice: j === 2 ? r2(avg * 1.2) : 0, onSale: j === 2 && i === 0, image: gradImg('#ff375f', '#7b5bff', '€'), currency: 'EUR' }))
      competitors[name] = { count: products.length, avg, min: Math.min(...products.map(p => p.price)), max: Math.max(...products.map(p => p.price)), currency: 'EUR', deltaEuro, deltaPct: avg > 0 ? Math.round(deltaEuro / avg * 1000) / 10 : 0, products }
    })
    return { id: c.id, label: c.label, own, competitors }
  })
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

// Coda Azioni (demo): azioni di esempio su più stati/sorgenti (in italiano,
// come il resto del software nella demo).
function demoActions(search) {
  const now = Date.now()
  const all = [
    { id: 'da1', channel: 'meta', type: 'scale_budget', target_name: 'Prospecting · Bestseller', summary: 'Scala il budget di «Prospecting · Bestseller» +20% (€80,00 → €96,00)', source: 'budget_advisor', status: 'pending', payload: {}, created_at: iso(now - 2 * 3600e3) },
    { id: 'da2', channel: 'meta', type: 'refresh_creative', target_name: 'Video UGC #3', summary: 'Rinfresca la creativa «Video UGC #3» (frequency 5.2, CTR 0.7%) — fatigue alta', source: 'creative_fatigue', status: 'pending', payload: {}, created_at: iso(now - 5 * 3600e3) },
    { id: 'da3', channel: 'shopify', type: 'custom', target_name: 'Abbigliamento Uomo', summary: 'Valuta un adeguamento prezzo: Abbigliamento Uomo', source: 'price_intel', status: 'pending', payload: { why: 'Siamo +18% vs Competitor A su questa categoria.' }, created_at: iso(now - 9 * 3600e3) },
    { id: 'da4', channel: 'meta', type: 'shift_budget', target_name: 'Riallocazione budget', summary: 'Sposta ~€120 dalle campagne deboli (ROAS 1.1x) verso quelle forti (ROAS 3.4x)', source: 'orchestrator', status: 'approved', payload: { why: 'Le deboli erodono il MER; le forti hanno margine di scala.' }, created_at: iso(now - 1 * DAY) },
    { id: 'da5', channel: 'other', type: 'custom', target_name: 'Hero CTA above the fold', summary: 'Fix CRO — Hero CTA above the fold', source: 'cro', status: 'executed', payload: {}, created_at: iso(now - 3 * DAY), executed_at: iso(now - 2 * DAY) },
    { id: 'da6', channel: 'klaviyo', type: 'custom', target_name: 'Welcome Flow v2', summary: 'Programma l’invio della campagna email «Welcome Flow v2»', source: 'klaviyo', status: 'executed', payload: {}, created_at: iso(now - 6 * DAY), executed_at: iso(now - 5 * DAY) },
    { id: 'da7', channel: 'meta', type: 'pause_campaign', target_name: 'Retargeting · Vecchio', summary: 'Metti in pausa «Retargeting · Vecchio» (ROAS 0.8x)', source: 'budget_advisor', status: 'rejected', payload: {}, created_at: iso(now - 4 * DAY) },
  ]
  const st = search && search.get && search.get('status')
  const counts = { pending: 0, approved: 0, executed: 0, rejected: 0, failed: 0 }
  for (const a of all) if (counts[a.status] != null) counts[a.status]++
  return { actions: st ? all.filter(a => a.status === st) : all, counts, me: { memberId: 'd-owner', roles: ['admin'], isAdmin: true } }
}

// ── Catalogo demo condiviso (Inventario, Performance, Costi, Google Products) ──
const DEMO_PRODUCTS = [
  ['Zaino X-Line 40 Litri', 79.9, 28, '#7b5bff'],
  ['Paracalli HYBRID senza magnesite', 24.9, 7, '#ff375f'],
  ['Paracalli ZERO Slim 2.0', 22.9, 6.5, '#30d158'],
  ['Zaino Borsone X-Line 50 Litri', 99.9, 36, '#0a84ff'],
  ['Paracalli SYNTH con magnesite', 19.9, 5.8, '#fbbf24'],
  ['Zaino NOMATEC 30-35 Litri', 69.9, 24, '#bf5af2'],
  ['Strongman Sandbag 70kg', 119, 41, '#64d2ff'],
  ['Ginocchiere 5mm Unisex', 34.9, 9, '#ff6482'],
  ['Cintura da Sollevamento', 44.9, 12, '#22c55e'],
  ['Corda Salto Speed Pro', 18.9, 4.5, '#f59e0b'],
  ['Magnesite Liquida 250ml', 12.9, 3.2, '#a855f7'],
  ['Fasce Polso Premium', 16.9, 4.1, '#06b6d4'],
]
const SIZES = ['S', 'M', 'L', 'XL']
const pimg = (pi) => gradImg(DEMO_PRODUCTS[pi][3], '#5b8bff', DEMO_PRODUCTS[pi][0].split(' ')[0])
const r2 = (n) => Math.round(n * 100) / 100

function demoInventory() {
  const items = []
  DEMO_PRODUCTS.forEach(([title, price, cost], pi) => {
    const nVar = 2 + (pi % 3)
    for (let s = 0; s < nVar; s++) {
      const velocity = r2(0.4 + ((pi * 3 + s) % 7) / 7 * 4)
      const r = (pi * 5 + s * 7) % 11
      let stock
      if (r === 0) stock = 0
      else if (r < 3) stock = Math.round(velocity * (2 + r))
      else if (r < 6) stock = Math.round(velocity * (12 + r))
      else stock = Math.round(velocity * (60 + r))
      const oos = stock <= 0
      const sold30 = Math.round(velocity * 30)
      const daysToStockout = oos ? 0 : (velocity > 0 ? Math.round(stock / velocity) : null)
      const brokenSize = oos && sold30 > 0
      const lostRevPerDay = brokenSize ? velocity * price : 0
      let risk = 'ok'
      if (brokenSize) risk = 'oos_sales'
      else if (oos) risk = 'oos'
      else if (daysToStockout != null && daysToStockout <= 7) risk = 'le7'
      else if (daysToStockout != null && daysToStockout <= 30) risk = 'le30'
      let priorityScore = 0
      if (brokenSize) priorityScore = lostRevPerDay * 7
      else if (risk === 'le7' || risk === 'le30') priorityScore = velocity * price * (30 / Math.max(daysToStockout, 0.5))
      items.push({
        productId: 'p' + pi, productTitle: title, variantId: `v${pi}-${s}`, sku: `ACME-${pi}${s}`,
        size: SIZES[s] || 'Unica', price, cost, stock, sold30, velocity, daysToStockout,
        oos, brokenSize, lostRevPerDay, value: Math.max(stock, 0) * cost, risk, priorityScore,
        image: pimg(pi),
      })
    }
  })
  const kpis = {
    inventoryValueCogs: Math.round(items.reduce((a, i) => a + (i.value || 0), 0)),
    qtyOnHand: items.reduce((a, i) => a + Math.max(i.stock, 0), 0),
    countLe7: items.filter(i => i.risk === 'le7').length,
    countLe30: items.filter(i => i.risk === 'le7' || i.risk === 'le30').length,
    brokenCount: items.filter(i => i.brokenSize).length,
    lostRevenueWeek: Math.round(items.reduce((a, i) => a + i.lostRevPerDay, 0) * 7),
    variantCount: items.length, productCount: DEMO_PRODUCTS.length, costCoverage: 100,
  }
  return { ok: true, currency: 'EUR', periodDays: 30, updatedAt: iso(Date.now()), kpis, items }
}

function demoProductPerformance() {
  let metaSpend = 0, googleSpend = 0
  const products = DEMO_PRODUCTS.map(([title, price, cost], pi) => {
    const units = 40 + ((pi * 13) % 9) * 20
    const netRevenue = Math.round(units * price * 0.82)
    const cogs = Math.round(units * cost)
    const ads = Math.round(netRevenue * (0.18 + ((pi % 5) / 5) * 0.12))
    metaSpend += Math.round(ads * 0.7); googleSpend += Math.round(ads * 0.3)
    const marginOp = netRevenue - cogs - ads
    return {
      productId: 'p' + pi, title, image: pimg(pi), units, netRevenue, cogs, ads, marginOp,
      marginPct: r2(marginOp / netRevenue * 100), roas: r2(netRevenue / ads), deltaNet: r2(((pi % 7) - 3) / 3 * 40),
    }
  })
  const tot = products.reduce((a, p) => ({ netRevenue: a.netRevenue + p.netRevenue, cogs: a.cogs + p.cogs, ads: a.ads + p.ads, marginOp: a.marginOp + p.marginOp, units: a.units + p.units }), { netRevenue: 0, cogs: 0, ads: 0, marginOp: 0, units: 0 })
  const totals = { ...tot, roas: r2(tot.netRevenue / tot.ads), metaSpend, googleSpend, costCoverage: 100, marginPct: r2(tot.marginOp / tot.netRevenue * 100), grossMargin: tot.netRevenue - tot.cogs }
  return { ok: true, currency: 'EUR', range: { since: ymd(Date.now() - 30 * DAY), until: ymd(Date.now()) }, products, totals, attributedPct: 84 }
}

function demoProductCosts() {
  const products = DEMO_PRODUCTS.map(([title, price, cost], pi) => {
    const nVar = 2 + (pi % 3)
    const variants = []
    for (let s = 0; s < nVar; s++) variants.push({ variant_id: `v${pi}-${s}`, sku: `ACME-${pi}${s}`, landed: r2(cost + s * 0.4), historyCount: (pi + s) % 3 })
    return { productId: 'p' + pi, title, image: pimg(pi), variants }
  })
  return { ok: true, currency: 'EUR', products, savedAvailable: true }
}

function googleKpiBucket(spend, factor = 1) {
  const convValue = round(spend * 3.5 * factor)
  const impressions = round(spend * 80)
  const clicks = round(impressions * 0.03)
  const conversions = r2(convValue / 75)
  return {
    spend: round(spend), convValue, conversions, impressions, clicks,
    roas: r2(convValue / spend), cpa: r2(spend / Math.max(conversions, 1)),
    ctr: r2(clicks / impressions * 100), cpc: r2(spend / clicks), cpm: r2(spend / impressions * 1000),
    convRate: r2(conversions / clicks * 100),
  }
}
function demoGoogleKpi() {
  const totals = googleKpiBucket(6171), prevTotals = googleKpiBucket(5600, 0.93)
  const daily = []
  for (let i = 27; i >= 0; i--) { const sp = 180 + ((i * 37) % 13) / 13 * 120; daily.push({ date: ymd(Date.now() - i * DAY), ...googleKpiBucket(sp) }) }
  return { configured: true, preset: 'last_28d', range: { since: ymd(Date.now() - 28 * DAY), until: ymd(Date.now()) }, prevRange: { since: ymd(Date.now() - 56 * DAY), until: ymd(Date.now() - 29 * DAY) }, totals, prevTotals, daily, updatedAt: iso(Date.now()) }
}

function demoGoogleDetail() {
  const defs = [
    ['Brand Search', 1200, 8.5, 'ENABLED'], ['Shopping - Tutti i prodotti', 2400, 5.2, 'ENABLED'],
    ['PMax - Performance Max', 1900, 4.1, 'ENABLED'], ['Search - Generico Fitness', 680, 2.3, 'ENABLED'],
    ['Display - Remarketing', 420, 3.1, 'PAUSED'], ['Shopping - Liquidazione', 310, 1.4, 'PAUSED'],
    ['Search - Competitor', 260, 1.1, 'REMOVED'],
  ]
  const rows = defs.map(([name, spend, roas, status], i) => {
    const convValue = round(spend * roas), impressions = round(spend * 80), clicks = round(impressions * 0.03), conversions = r2(convValue / 75)
    return {
      id: 'g' + i, level: 'campaign', name, status, has_children: true, budget: Math.round(spend / 28),
      spend, impressions, clicks, conversions, convValue, roas: r2(roas),
      ctr: r2(clicks / impressions * 100), cpc: r2(spend / clicks), cpa: r2(spend / Math.max(conversions, 1)),
    }
  })
  const sum = (f) => rows.reduce((a, r) => a + (r[f] || 0), 0)
  const spend = sum('spend'), convValue = sum('convValue'), conversions = sum('conversions'), clicks = sum('clicks'), impressions = sum('impressions')
  const summary = { spend, convValue, conversions, impressions, clicks, roas: r2(convValue / spend), cpa: r2(spend / Math.max(conversions, 1)), ctr: r2(clicks / impressions * 100), cpc: r2(spend / clicks) }
  const previousSummary = { ...summary, spend: round(spend * 0.94), convValue: round(convValue * 0.9), roas: r2(summary.roas * 0.96) }
  const dailySeries = []
  for (let i = 27; i >= 0; i--) { const sp = 150 + ((i * 29) % 13) / 13 * 130, cv = round(sp * 3.6), cn = r2(cv / 75); dailySeries.push({ date: ymd(Date.now() - i * DAY), spend: sp, convValue: cv, conversions: cn, roas: r2(cv / sp), cpa: r2(sp / Math.max(cn, 1)), ctr: 3.0 }) }
  return { ok: true, configured: true, preset: 'last_28d', level: 'campaigns', range: { since: ymd(Date.now() - 28 * DAY), until: ymd(Date.now()) }, prevRange: { since: ymd(Date.now() - 56 * DAY), until: ymd(Date.now() - 29 * DAY) }, rows, summary, previousSummary, dailySeries, updatedAt: iso(Date.now()) }
}

function demoGoogleProducts() {
  const rows = DEMO_PRODUCTS.map(([title, price], pi) => {
    const clicks = 20 + ((pi * 7) % 9) * 14
    const impressions = clicks * (70 + pi * 5)
    const cost = r2(clicks * (0.35 + (pi % 4) * 0.12))
    const conversions = r2(clicks * 0.05)
    const convValue = r2(conversions * price)
    return {
      itemId: `shopify_it_${8000000 + pi}_${4300000 + pi}`, productId: 'p' + pi, title, image: pimg(pi),
      clicks, impressions, cost, conversions, convValue,
      ctr: r2(clicks / impressions * 100), cpc: r2(cost / clicks),
      costPerConv: conversions > 0 ? r2(cost / conversions) : null,
      roas: cost > 0 ? r2(convValue / cost) : null,
    }
  }).sort((a, b) => b.cost - a.cost)
  const t = rows.reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions, cost: a.cost + r.cost, conversions: a.conversions + r.conversions, convValue: a.convValue + r.convValue }), { clicks: 0, impressions: 0, cost: 0, conversions: 0, convValue: 0 })
  const totals = { ...t, cost: r2(t.cost), conversions: r2(t.conversions), convValue: r2(t.convValue), roas: t.cost > 0 ? r2(t.convValue / t.cost) : null, products: rows.length }
  return { ok: true, currency: 'EUR', range: { since: ymd(Date.now() - 7 * DAY), until: ymd(Date.now()) }, rows, totals, updatedAt: iso(Date.now()) }
}

function demoLighthouse(accent) {
  const alerts = [
    { id: 'a1', severity: 'high', metric: 'ROAS', title: 'ROAS in calo', value: '2.09x', baseline: '3.71x', deltaPct: -43.7, date: ymd(Date.now() - DAY), cause: 'Creative fatigue oppure shift su prodotti meno performanti', action: 'Verifica budget reallocation + identifica creative winner del periodo' },
    { id: 'a2', severity: 'high', metric: 'CPA', title: 'CPA sopra soglia', value: '€18,40', baseline: '€12,10', deltaPct: 52.1, date: ymd(Date.now() - 2 * DAY), cause: 'Aste più care e CTR in flessione', action: 'Rivedi offerte target CPA e metti in pausa keyword/audience inefficienti' },
    { id: 'a3', severity: 'medium', metric: 'CTR', title: 'CTR in flessione', value: '1.98%', baseline: '2.40%', deltaPct: -17.5, date: ymd(Date.now() - 3 * DAY), cause: 'Annunci meno pertinenti o creatività stanca', action: 'Testa nuovi titoli/descrizioni e refresh creatività' },
    { id: 'a4', severity: 'medium', metric: 'Frequenza', title: 'Frequenza alta', value: '4.2', baseline: '2.8', deltaPct: 50, date: ymd(Date.now() - 4 * DAY), cause: 'Pubblico saturo, stessi utenti raggiunti', action: 'Espandi audience o crea nuove lookalike' },
    { id: 'a5', severity: 'low', metric: 'CPM', title: 'CPM in lieve aumento', value: '€12,99', baseline: '€11,40', deltaPct: 14, date: ymd(Date.now() - 5 * DAY), cause: 'Maggiore competizione in asta', action: 'Monitora; valuta orari/posizionamenti meno cari' },
  ]
  const proposals = [
    { id: 'p1', title: 'Riallocazione budget', detail: 'Sposta il 20% del budget dalle campagne con ROAS < media a quelle con ROAS > 4x.', impact: '+€86 ricavo stimato/settimana' },
    { id: 'p2', title: 'Refresh creatività', detail: 'Sostituisci le 3 creatività con frequenza > 4 con nuovi angoli.', impact: 'Riduzione CPM e CPA attesa' },
  ]
  const summary = { high: alerts.filter(a => a.severity === 'high').length, medium: alerts.filter(a => a.severity === 'medium').length, low: alerts.filter(a => a.severity === 'low').length, total: alerts.length }
  return { preset: 'last_28d', range: { since: ymd(Date.now() - 28 * DAY), until: ymd(Date.now()) }, alerts, proposals, summary, baseline_window: 14, days_analyzed: 28, updatedAt: iso(Date.now()) }
}

function demoGoogleBudgetAdvisor() {
  const defs = [['Brand Search', 1200, 8.5], ['Shopping - Tutti', 2400, 5.2], ['PMax', 1900, 4.1], ['Search Generico', 680, 2.3], ['Display Remarketing', 420, 0.9], ['Shopping Liquidazione', 310, 0.6]]
  const campaigns = defs.map(([name, spend, roas], i) => {
    let action = 'mantieni', deltaPct = 0
    if (roas >= 5) { action = 'scala'; deltaPct = 25 }
    else if (roas < 1) { action = 'taglia'; deltaPct = -100 }
    else if (roas < 2) { action = 'riduci'; deltaPct = -30 }
    return { id: 'gb' + i, name, spend, revenue: round(spend * roas), roas: r2(roas), cpa: r2(spend / Math.max(round(spend * roas / 75), 1)), action, deltaPct, suggestedSpend: r2(spend * (1 + deltaPct / 100)) }
  })
  const totalSpend = campaigns.reduce((a, c) => a + c.spend, 0)
  const totalRevenue = campaigns.reduce((a, c) => a + c.revenue, 0)
  const freed = campaigns.filter(c => c.deltaPct < 0).reduce((a, c) => a + (c.spend - c.suggestedSpend), 0)
  return {
    configured: true, preset: 'last_28d', range: { since: ymd(Date.now() - 28 * DAY), until: ymd(Date.now()) }, accounts: [], campaigns,
    totalSpend, totalRevenue, mer: r2(totalRevenue / totalSpend),
    prev: { totalSpend: round(totalSpend * 0.95), totalRevenue: round(totalRevenue * 0.9), mer: r2(totalRevenue * 0.9 / (totalSpend * 0.95)) },
    delta: { spend: { abs: round(totalSpend * 0.05), pct: 5 }, revenue: { abs: round(totalRevenue * 0.1), pct: 10 }, mer: { abs: 0.3, pct: 6 } },
    counts: { scala: campaigns.filter(c => c.action === 'scala').length, riduci: campaigns.filter(c => c.action === 'riduci').length, taglia: campaigns.filter(c => c.action === 'taglia').length },
    reallocation: { freed: r2(freed), avgScaleRoas: 6.8, avgCutRoas: 0.8, forecastDelta: round(freed * 5) },
    updatedAt: iso(Date.now()),
  }
}

function demoCro() {
  const sessions = 29576, addToCart = 2386, checkout = 1477, orders = 972, revenue = 71473, newCustomers = 496, returningCustomers = 455
  return {
    funnel: { sessions, visitors: sessions, addToCart, checkout, purchase: orders, source: 'Shopify' },
    topPages: [], flow: { nodes: [], links: [] },
    totalRevenue: revenue, totalOrders: orders, sessions, newCustomers, returningCustomers,
    prev: { revenue: round(revenue * 0.92), orders: round(orders * 0.95), sessions: round(sessions * 1.1), newCustomers: round(newCustomers * 1.07), returningCustomers: round(returningCustomers * 0.96) },
    range: { since: ymd(Date.now() - 30 * DAY), until: ymd(Date.now()) }, prevRange: { since: ymd(Date.now() - 60 * DAY), until: ymd(Date.now() - 31 * DAY) },
    days: 30, hasGA4: false, source: 'shopifyql', updatedAt: iso(Date.now()),
  }
}

function demoForecast() {
  const history = [], forecast = []
  for (let i = 89; i >= 0; i--) { const rev = round(4200 + ((i * 53) % 17) / 17 * 2600), sp = round(rev / 4.2); history.push({ date: ymd(Date.now() - i * DAY), revenue: rev, spend: sp }) }
  for (let i = 1; i <= 30; i++) { const rev = round(5200 + ((i * 31) % 11) / 11 * 1800), sp = round(rev / 4.4); forecast.push({ date: ymd(Date.now() + i * DAY), revenue: rev, revenue_low: round(rev * 0.82), revenue_high: round(rev * 1.18), spend: sp, spend_low: round(sp * 0.85), spend_high: round(sp * 1.15), mer: r2(rev / sp) }) }
  const proj = forecast.reduce((s, d) => s + d.revenue, 0), projSp = forecast.reduce((s, d) => s + d.spend, 0)
  const recent = history.slice(-30).reduce((s, d) => s + d.revenue, 0), recentSp = history.slice(-30).reduce((s, d) => s + d.spend, 0)
  return { horizon: 30, history_days: 90, history, forecast, summary: { projected_revenue: proj, projected_spend: projSp, projected_mer: r2(proj / projSp), last_period_revenue: recent, last_period_spend: recentSp, revenue_change_pct: r2((proj - recent) / recent * 100) }, updatedAt: iso(Date.now()) }
}

function demoCustomers() {
  const segMeta = {
    new: [820, 64], potentialLoyal: [540, 96], loyal: [410, 168], loyalAtRisk: [180, 142], aboutToSleep: [240, 78], sleepers: [610, 41],
  }
  const segments = {}
  for (const [key, [count, aov]] of Object.entries(segMeta)) {
    const avgOrders = key === 'loyal' ? 4.2 : key === 'potentialLoyal' ? 2.3 : key === 'new' ? 1 : 1.8
    segments[key] = {
      count, aov, avgOrders, daysBetween: Math.round(40 + Math.random() * 60),
      customerValue: r2(aov * avgOrders), totalSales: round(count * aov * avgOrders),
      customers: Array.from({ length: Math.min(count, 12) }, (_, i) => ({ email: `cliente${i + 1}@acme.demo`, totalSales: round(aov * avgOrders), orders: Math.round(avgOrders) })),
    }
  }
  const totalCustomers = Object.values(segMeta).reduce((a, [c]) => a + c, 0)
  const series = []
  for (let w = 7; w >= 0; w--) {
    series.push({ week: ymd(Date.now() - w * 7 * DAY), segments: { new: round(110 - w * 4), potentialLoyal: round(70 + w * 2), loyal: round(55 + w), loyalAtRisk: round(22 + w), aboutToSleep: round(30 - w), sleepers: round(80 + w * 3) } })
  }
  const kpis = { totalCustomers, deltaCustomers: 8.4, repeatRate: 41, avgAov: 78, avgOrders: 2.1, ltv: 164 }
  return { ok: true, kpis, segments, series, updatedAt: iso(Date.now()) }
}

function demoCampaignMap() {
  const products = DEMO_PRODUCTS.map(([title], pi) => ({ id: 'p' + pi, title, handle: title.toLowerCase().replace(/\s+/g, '-') }))
  const campaigns = demoMetaDetailRows().map((c, i) => ({ platform: 'meta', campaign_id: c.id, campaign_name: c.name, selected: i < 3 ? [products[i]] : [], auto: i >= 3 ? [products[i % products.length]] : [], suggestedProductId: products[i % products.length].id, suggestions: products.slice(0, 4) }))
  return { ok: true, campaigns, products }
}

// Mappa pathname → payload demo. Ritorna undefined per endpoint non gestiti
// (l'intercettore restituirà {} → i componenti usano i loro default vuoti).
export function demoData(path, search, method = 'GET') {
  const p = path.replace(/\/$/, '')

  // ── Commerce / Google / Clienti / CRO (demo) ──
  if (p === '/api/inventory') return demoInventory()
  if (p === '/api/product-performance') return demoProductPerformance()
  if (p === '/api/product-costs-landed') {
    if (method === 'GET' && search && search.get && search.get('variant_id')) {
      return { ok: true, history: [
        { landed_cost: 8.4, effective_from: ymd(Date.now() - 60 * DAY), note: 'sync Shopify', created_at: iso(Date.now() - 60 * DAY) },
        { landed_cost: 8.9, effective_from: ymd(Date.now() - 20 * DAY), note: 'manuale', created_at: iso(Date.now() - 20 * DAY) },
      ] }
    }
    return method === 'GET' ? demoProductCosts() : { ok: true, saved: 1 }
  }
  if (p === '/api/google-kpi') return demoGoogleKpi()
  if (p === '/api/google-detail') return method === 'GET' ? demoGoogleDetail() : { ok: true }
  if (p === '/api/google-products') return demoGoogleProducts()
  if (p === '/api/google-lighthouse') return demoLighthouse('#eab308')
  if (p === '/api/google-budget-advisor') return demoGoogleBudgetAdvisor()
  if (p === '/api/cro') return demoCro()
  if (p === '/api/forecast') return demoForecast()
  if (p === '/api/campaign-map') return demoCampaignMap()
  if (p === '/api/customers') return demoCustomers()
  if (p === '/api/customers/insights') return { ok: true, headline: 'I clienti fedeli generano ~il 38% del fatturato ma sono in lieve calo: prioritizza retention e win-back.', insights: [{ title: 'Concentrazione sui fedeli', text: 'I segmenti Fedeli e Potenziali fedeli valgono ~2× l\'AOV medio: proteggili con un programma loyalty.' }, { title: 'Rischio abbandono in crescita', text: 'Il segmento "Fedeli a rischio" cresce: un flusso win-back può recuperarne una quota.' }, { title: 'Nuovi da fidelizzare', text: 'Molti "Nuovi" con un solo ordine: una sequenza post-acquisto spinge il secondo acquisto.' }], recommendations: [{ title: 'Win-back fedeli a rischio', action: 'Email con incentivo mirato + bestseller del segmento.' }, { title: 'Loyalty per i Fedeli', action: 'Early access e vantaggi esclusivi per aumentare la frequenza d\'acquisto.' }] }
  if (p === '/api/customers/campaign') return { ok: true, angle: 'Retention con incentivo mirato', subject: 'Ci sei mancato — il tuo 15% ti aspetta', preview: 'Un piccolo pensiero per riaverti con noi', body: 'Ciao,\n\nè passato un po\' dal tuo ultimo ordine. Ecco un 15% sui tuoi preferiti, valido 7 giorni.\n\nA presto,\nAcme Store', cta: 'Usa il 15%' }
  if (p === '/api/customers/backfill') return { ok: true, weeks: 12 }

  // Coda Azioni (demo)
  if (p === '/api/actions/suggest') return { ok: true, suggestions: [
    { channel: 'meta', type: 'scale_budget', target_name: 'Prospecting · Bestseller', summary: 'Scala del 20% la campagna prospecting sul bestseller', priority: 'high', why: 'ROAS 3.4x e CPA sotto media: c’è margine per scalare senza perdere efficienza.' },
    { channel: 'klaviyo', type: 'custom', target_name: 'Carrello abbandonato', summary: 'Testa un nuovo oggetto sul flusso carrello abbandonato', priority: 'medium', why: 'Open rate al 28%, sotto il potenziale: nuovi subject possono recuperare revenue.' },
    { channel: 'shopify', type: 'custom', target_name: 'Bundle prodotti', summary: 'Crea un bundle bestseller + accessorio per alzare l’AOV', priority: 'medium', why: 'AOV in calo del 6% nelle ultime 2 settimane; il bundling è la leva più rapida.' },
  ] }
  if (p === '/api/actions/draft-campaign') return { ok: true, draft: { name: 'Vendite · Bestseller IT', objective: 'OUTCOME_SALES', daily_budget_eur: 40, audience: 'Italia, donne 25-45, interesse fitness e wellness', optimization_goal: 'PURCHASE', summary: 'Campagna vendite sul bestseller, €40/giorno, donne 25-45 IT interessate al fitness.' } }
  if (p === '/api/actions') return method === 'GET' ? demoActions(search) : { ok: true }

  if (p === '/api/metrics') return demoMetrics()
  if (p === '/api/realtime') return {
    activeUsers: 37,
    points: [
      { lat: 41.9, lng: 12.5, count: 14, label: 'Roma' }, { lat: 45.46, lng: 9.19, count: 9, label: 'Milano' },
      { lat: 48.85, lng: 2.35, count: 5, label: 'Parigi' }, { lat: 52.52, lng: 13.4, count: 4, label: 'Berlino' },
      { lat: 40.42, lng: -3.7, count: 3, label: 'Madrid' }, { lat: 51.5, lng: -0.12, count: 2, label: 'Londra' },
    ],
    byLocation: [
      { country: 'Italia', city: 'Roma', activeUsers: 14 }, { country: 'Italia', city: 'Milano', activeUsers: 9 },
      { country: 'Francia', city: 'Parigi', activeUsers: 5 }, { country: 'Germania', city: 'Berlino', activeUsers: 4 },
      { country: 'Spagna', city: 'Madrid', activeUsers: 3 }, { country: 'Regno Unito', city: 'Londra', activeUsers: 2 },
    ],
    byCountry: [{ country: 'IT', countryCode: 'IT', users: 23 }, { country: 'FR', countryCode: 'FR', users: 5 }, { country: 'DE', countryCode: 'DE', users: 4 }, { country: 'ES', countryCode: 'ES', users: 3 }, { country: 'GB', countryCode: 'GB', users: 2 }],
    byPage: [{ page: '/', users: 12 }, { page: '/products', users: 9 }, { page: '/checkout', users: 4 }],
  }

  if (p === '/api/team-members') return { members: MEMBERS, roles: ['cro_specialist', 'ecommerce_manager', 'advertising_manager', 'data_analyst'], roleLabels: { admin: 'Admin', cro_specialist: 'CRO Specialist', ecommerce_manager: 'E-commerce Manager', advertising_manager: 'Advertising / Marketing / SEO', data_analyst: 'Data Analyst / Revisore' }, seats: { plan: 'scale', limit: null, used: MEMBERS.length }, me: { userId: 'd-owner', memberId: 'd-owner', roles: ['admin'], isAdmin: true, isMember: false } }
  if (p === '/api/onboarding') return { completed: true, steps: { shopify: true, meta: true, ga4: true, klaviyo: true } }
  if (p === '/api/stripe/subscription') return { subscription: { id: 'sub_demo', status: 'active', priceId: null, planId: 'scale', currentPeriodStart: Math.floor(Date.now() / 1000) - 10 * DAY / 1000, currentPeriodEnd: Math.floor(Date.now() / 1000) + 20 * DAY / 1000, cancelAtPeriodEnd: false, amount: 29900, currency: 'eur', interval: 'month' }, paymentMethod: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028 }, invoices: [] }
  if (p === '/api/plan-usage') return { plan: 'scale', orders: 1284, recommended: { plan: 'scale', label: 'Scale', price: '€299' }, current: { plan: 'scale', label: 'Scale', max: 7000 }, over: false }
  if (p === '/api/integrations/status') return { connected: ['facebook', 'klaviyo-oauth'], metaAccountId: 'act_demo', googleConnected: true, ga4PropertyId: 'properties/000000' }
  if (p === '/api/integrations') return { active: [], available: [] }
  if (p === '/api/attribution') return demoAttribution()
  // ── Performance Agent (chat AI) ──
  if (p === '/api/agent-context') return { sources: ['Shopify', 'Meta', 'GA4', 'Klaviyo'], activeSources: ['Shopify', 'Meta', 'GA4', 'Klaviyo'], activeCount: 4, preset: 'last_28d' }
  if (p === '/api/agent') return {
    reply: 'Allora, ultimi 30 giorni: fatturato €55.298 (+18%), MER blended 2,6x — sopra il tuo target di 2,5x. Il retargeting Meta sta spingendo (ROAS 4,3x): lì hai margine per scalare il budget. Attenzione invece ad Advantage+ Shop (ROAS 1,6x) e a 3 creative sopra frequency 5 da rinfrescare. Sul fronte clienti il repeat rate è 33,9%: il flusso Welcome e l\'Abandoned Cart su Klaviyo stanno performando bene. Vuoi che ti prepari un piano di riallocazione budget?',
    summary: { activeSources: ['Shopify', 'Meta', 'GA4', 'Klaviyo'], activeCount: 4 },
  }
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
  if (p === '/api/competitor-intel') return { competitors: [], priceComparison: demoPriceComparison(), ownStoreName: 'Acme Store', countries: ['IT'], fetchedAt: iso(Date.now()), cached: false }
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
  // ── Creative Lab: griglia prodotti (GET) + generazione creative (POST) ──
  if (p === '/api/creative-lab') {
    if (method === 'POST') {
      const defs = [
        ['Bestseller Pro', 'TOFU', 'Problema/Soluzione', 'Risultati in 30 giorni', 'Prova il bestseller n.1', '#7b5bff', '#5b8bff'],
        ['Bestseller Pro', 'MOFU', 'Social proof', '4,8/5 su oltre 2.400 recensioni', 'Scopri perché lo amano', '#ff375f', '#ff8a5b'],
        ['Kit Starter', 'BOFU', 'Offerta', '-20% solo questa settimana', 'Approfittane ora', '#30d158', '#28b14c'],
        ['Kit Starter', 'TOFU', 'Curiosità', 'Il segreto dei pro', 'Guarda come funziona', '#fbbf24', '#ff9f0a'],
      ]
      const creatives = defs.map((d, i) => { const [productTitle, funnelStage, angle, headline, cta, a, b] = d; return { productTitle, funnelStage, angle, headline, cta, persona: i % 2 ? 'Sportivo 25-40' : 'Neofita 30-50', primaryText: `${headline}. Spedizione gratis sopra 49€, reso facile in 30 giorni. Migliaia di clienti soddisfatti ti aspettano.`, description: 'Scopri la collezione', reasoning: `Angolo "${angle}" calibrato per la fase ${funnelStage}: cattura l'attenzione e spinge all'azione con un beneficio chiaro.`, imageModel: 'gpt-image-1', generatedImage: gradImg(a, b, 'AD ' + (i + 1)) } })
      return { ok: true, creatives }
    }
    const P = [
      ['bestseller-pro', 'Bestseller Pro', 49.9, '#7b5bff'], ['kit-starter', 'Kit Starter', 39.0, '#5b8bff'],
      ['accessorio-plus', 'Accessorio Plus', 24.9, '#30d158'], ['bundle-risparmio', 'Bundle Risparmio', 79.0, '#ff9f0a'],
      ['edizione-limitata', 'Edizione Limitata', 59.0, '#bf5af2'], ['prodotto-base', 'Prodotto Base', 29.0, '#0a84ff'],
    ]
    const products = P.map(([handle, title, price, c]) => ({ handle, title, price, description: `${title} — qualità premium, materiali selezionati, pensato per durare.`, image: gradImg(c, '#5b8bff', title.split(' ')[0]) }))
    return { products, page: 1, totalPages: 1, totalProducts: products.length }
  }
  if (p === '/api/seo-audit/history') return { items: [] }
  if (p === '/api/seo-ai' || p === '/api/seo-competitor') return { ok: true }

  return undefined
}
