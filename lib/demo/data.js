// ============================================================================
//  DEMO DATA — dati 100% inventati per la modalità demo pubblica (/demo).
//  NON tocca nulla del software reale: viene servito solo da un intercettore
//  fetch attivo esclusivamente nella pagina /demo. Brand fittizio "Acme Store".
// ============================================================================

// Il KPI Brain della demo (Dove comprano, fasce orarie, segmenti Meta e Google, paesi, foto dei
// prodotti): in un file a parte, alimentato dagli stessi numeri di demoMetrics().
import { demoKpiBrain, giorniSettimana, KPI_BRAIN_PATHS } from './kpiBrain.js'
// Prezzi (confronto coi concorrenti da Merchant Center) e Verdetti prodotti Google: vuoti fino al 21 set.
import { demoPrezzi, PREZZI_PATHS } from './prezzi.js'

const DAY = 86400000
const iso = (d) => new Date(d).toISOString()
const ymd = (d) => new Date(d).toISOString().slice(0, 10)
const round = (n) => Math.round(n)

// Serie settimanale (ultime 16 settimane) allineata ai LUNEDÌ UTC, così le
// chiavi combaciano con getWeeks() della dashboard (match per s.date).
// Fatturato diviso spesa Meta nel negozio d'esempio; Google spende il 45% di Meta. Con 5,2 il MER
// complessivo (fatturato / spesa Meta+Google) sta intorno a 3,5.
const DEMO_MER_META = 5.2

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
    // Il negozio d'esempio spendeva in pubblicita' 1 euro ogni 1,8 di fatturato (MER 1,6): un
    // negozio in perdita, e proprio nell'immagine principale della landing. Ora MER ~3,5.
    const spend = round(fatturato / DEMO_MER_META)
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
    metaRange: (() => { const l = metaWeekly.slice(-4); const spend = sum(l, 'spend'); return { spend, impressions: sum(l, 'impressions'), clicks: sum(l, 'linkClicks'), purchases: round(spend / 31.2), purchaseValue: round(spend * 2.8) } })(),
    shopifyPrevRange: (() => { const l = shopifyWeekly.slice(-8, -4); const r = sum(l, 'resi'); return { revenue: sum(l, 'fatturato'), fatturNC: sum(l, 'fatturNC'), fatturRC: sum(l, 'fatturRC'), orders: sum(l, 'ordini'), nc: sum(l, 'nc'), rc: sum(l, 'rc'), sessions: sum(l, 'uniqueSessions'), resi: r, resiNC: round(r * 0.6), resiRC: round(r * 0.4) } })(),
    metaPrevRange: (() => { const l = metaWeekly.slice(-8, -4); const spend = sum(l, 'spend'); return { spend, impressions: sum(l, 'impressions'), clicks: sum(l, 'linkClicks'), purchases: round(spend / 31.2), purchaseValue: round(spend * 2.8) } })(),
    kpiBrain: {
      preset: 'last_28d',
      range: { since: ymd(Date.now() - 28 * DAY), until: ymd(Date.now()) },
      previousRange: { since: ymd(Date.now() - 56 * DAY), until: ymd(Date.now() - 29 * DAY) },
      shopifyTopProducts: topProducts, shopifyMarketingSources: marketingSources, shopifyDayBreakdown: dayBreakdown,
      previous: { shopifyTopProducts: topProducts, shopifyMarketingSources: marketingSources, shopifyDayBreakdown: dayBreakdown },
    },
    metaSpend, metaMonthly: months.map(m => ({ month: m.month, spend: round(m.fatturato / DEMO_MER_META), impressions: round(m.fatturato / DEMO_MER_META * 210), linkClicks: round(m.fatturato / DEMO_MER_META * 4) })), metaWeekly,
    sources: { shopify: true, meta: true },
    updatedAt: iso(Date.now()),
  }
}

// La squadra del negozio d'esempio. Giulia e Luca c'erano già; Sara, Nico ed
// Elena completano il team per Progetti, Calendario, Lyftimer e LyftTalk.
// Progetti, task, ore, chat e creatività stanno nel blocco «Productivity AI» più sotto.
const MEMBERS = [
  { id: 'd-owner', full_name: 'Marco (Demo)', email: 'owner@acme.demo', roles: ['admin'], status: 'active', avatar_url: null, hourly_rate: 45 },
  { id: 'd-cro', full_name: 'Giulia', email: 'giulia@acme.demo', roles: ['cro_specialist'], status: 'active', avatar_url: null, hourly_rate: 35 },
  { id: 'd-adv', full_name: 'Luca', email: 'luca@acme.demo', roles: ['advertising_manager'], status: 'active', avatar_url: null, hourly_rate: 38 },
  { id: 'd-seo', full_name: 'Sara', email: 'sara@acme.demo', roles: ['advertising_manager'], status: 'active', avatar_url: null, hourly_rate: 32 },
  { id: 'd-ecom', full_name: 'Nico', email: 'nico@acme.demo', roles: ['ecommerce_manager'], status: 'active', avatar_url: null, hourly_rate: 36 },
  { id: 'd-design', full_name: 'Elena', email: 'elena@acme.demo', roles: ['advertising_manager'], status: 'active', avatar_url: null, hourly_rate: 34 },
]

// Dati "manuali" finti (mesi/settimane) per le chiavi localStorage che l'app
// legge: includono la spesa GOOGLE ADS (manuale nell'app). Usato dallo shim
// localStorage SOLO nella demo. Allineato ai mesi/lunedì dei dati /api/metrics.
export function demoLocalStorage() {
  const months = {}
  for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1); const m = d.toISOString().slice(0, 7); const f = 24000 + (5 - i) * 3200; months[m] = { googleSpend: round(f / DEMO_MER_META * 0.45) } }
  const weeks = {}
  const mon = new Date(); mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7)); mon.setUTCHours(0, 0, 0, 0)
  for (let i = 15; i >= 0; i--) { const s = new Date(mon); s.setUTCDate(s.getUTCDate() - i * 7); const k = s.toISOString().slice(0, 10); const base = 6200 + (15 - i) * 540; const noise = ((i * 37) % 13) / 13 * 1800 - 600; const fat = round(base + noise); weeks[k] = { google: round(fat / DEMO_MER_META * 0.45) } }
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

// Coda Azioni (demo): azioni di esempio su più stati/sorgenti (in italiano,
// come il resto del software nella demo).
// ── Catalogo demo condiviso (Inventario, Performance, Costi, Google Products) ──
const DEMO_PRODUCTS = [
  ['Zaino Urban 25L', 79.9, 28, '#7b5bff'],
  ['T-Shirt Tecnica Dry', 24.9, 7, '#ff375f'],
  ['Leggings Compression Pro', 22.9, 6.5, '#30d158'],
  ['Borsone Duffel 40L', 99.9, 36, '#0a84ff'],
  ['Calzini Performance (3 paia)', 19.9, 5.8, '#fbbf24'],
  ['Felpa Hoodie Essential', 69.9, 24, '#bf5af2'],
  ['Scarpe Running AirFlow', 119, 41, '#64d2ff'],
  ['Tappetino Yoga 6mm', 34.9, 9, '#ff6482'],
  ['Borraccia Termica 750ml', 24.9, 7, '#22c55e'],
  ['Cappellino Dry-Fit', 18.9, 4.5, '#f59e0b'],
  ['Fascia Sport Antiscivolo', 12.9, 3.2, '#a855f7'],
  ['Guanti Training Grip', 16.9, 4.1, '#06b6d4'],
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
    // Venduto IVA inclusa e IVA come le mostra il conto vero: netto = venduto − IVA.
    const aliquota = pi % 4 === 3 ? 10 : 22
    const venduto = Math.round(netRevenue * (1 + aliquota / 100))
    return {
      productId: 'p' + pi, title, image: pimg(pi), units, venduto, iva: venduto - netRevenue, aliquotaIva: aliquota,
      netRevenue, cogs, hasCost: true, ads, adsExact: pi % 3 !== 2, marginOp,
      marginPct: r2(marginOp / netRevenue * 100), roas: r2(netRevenue / ads), deltaNet: r2(((pi % 7) - 3) / 3 * 40),
    }
  })
  const tot = products.reduce((a, p) => ({ netRevenue: a.netRevenue + p.netRevenue, cogs: a.cogs + p.cogs, ads: a.ads + p.ads, marginOp: a.marginOp + p.marginOp, units: a.units + p.units }), { netRevenue: 0, cogs: 0, ads: 0, marginOp: 0, units: 0 })
  const totals = { ...tot, roas: r2(tot.netRevenue / tot.ads), metaSpend, googleSpend, costCoverage: 100, adsMappedPct: 84, marginPct: r2(tot.marginOp / tot.netRevenue * 100), grossMargin: tot.netRevenue - tot.cogs }
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
  // Stessa forma di /api/customers: le schede in alto si ricavano dai segmenti,
  // cosi' i numeri della tabella e quelli delle schede tornano tra loro.
  const segMeta = {
    new: [820, 64, 1, 0], potentialLoyal: [540, 96, 2.3, 58], loyal: [410, 168, 4.2, 41],
    loyalAtRisk: [180, 142, 2.6, 96], aboutToSleep: [240, 78, 1, 0], sleepers: [610, 41, 1, 0],
  }
  const RIPETONO = ['potentialLoyal', 'loyal', 'loyalAtRisk']
  const segments = {}
  for (const [key, [count, aov, avgOrders, giorni]] of Object.entries(segMeta)) {
    segments[key] = {
      count, aov, avgOrders, daysBetween: giorni || null,
      customerValue: r2(aov * avgOrders), totalSales: round(count * aov * avgOrders),
      customers: Array.from({ length: Math.min(count, 12) }, (_, i) => ({ email: `cliente${i + 1}@acme.demo`, totalSales: round(aov * avgOrders), orders: Math.round(avgOrders) })),
    }
  }
  const gruppo = (chiavi) => {
    const cl = chiavi.reduce((a, k) => a + segMeta[k][0], 0)
    const ordini = chiavi.reduce((a, k) => a + segMeta[k][0] * segMeta[k][2], 0)
    const vendite = chiavi.reduce((a, k) => a + segments[k].totalSales, 0)
    return { customers: cl, orders: ordini, sales: vendite, customerValue: r2(vendite / cl), ordersPerCustomer: r2(ordini / cl), aov: r2(vendite / ordini) }
  }
  const tutti = gruppo(Object.keys(segMeta))
  const rt = gruppo(RIPETONO)
  const ft = gruppo(Object.keys(segMeta).filter(k => !RIPETONO.includes(k)))
  const totalCustomers = tutti.customers
  const retention = r2(rt.customers / totalCustomers * 100)
  const daysBetween = Math.round(RIPETONO.reduce((a, k) => a + segMeta[k][0] * segMeta[k][3], 0) / rt.customers)
  const series = []
  for (let w = 25; w >= 0; w--) {
    const quota = 1 - w * 0.012
    series.push({
      week: ymd(Date.now() - w * 7 * DAY),
      totalCustomers: round(totalCustomers * quota), firstTime: round(ft.customers * quota), returning: round(rt.customers * quota),
      retention: r2(retention - w * 0.15), clv: r2(tutti.customerValue * (1 - w * 0.006)), aov: r2(tutti.aov * (1 - w * 0.003)),
      segments: { new: round(820 - w * 6), potentialLoyal: round(540 - w * 4), loyal: round(410 - w * 3), loyalAtRisk: round(180 + w), aboutToSleep: round(240 - w), sleepers: round(610 - w * 5) },
    })
  }
  const kpis = {
    totalCustomers, firstTime: ft.customers, returning: rt.customers, retention,
    clv: tutti.customerValue, aov: tutti.aov, ordersPerCustomer: tutti.ordersPerCustomer, daysBetween,
    ft, rt, deltaCustomers: series[series.length - 1].totalCustomers - series[series.length - 2].totalCustomers,
  }
  return { ok: true, currency: 'EUR', generatedAt: iso(Date.now()), kpis, segments, series, hasHistory: true, updatedAt: iso(Date.now()) }
}

function demoCampaignMap() {
  const products = DEMO_PRODUCTS.map(([title], pi) => ({ id: 'p' + pi, title, handle: title.toLowerCase().replace(/\s+/g, '-') }))
  const campaigns = demoMetaDetailRows().map((c, i) => ({ platform: 'meta', campaign_id: c.id, campaign_name: c.name, selected: i < 3 ? [products[i]] : [], auto: i >= 3 ? [products[i % products.length]] : [], suggestedProductId: products[i % products.length].id, suggestions: products.slice(0, 4) }))
  return { ok: true, campaigns, products }
}

// Incrementalità (MMM-lite): Contributo / Curve / Simulatore. Tutte e 3 le tab
// leggono lo stesso /api/incrementality. Dati 100% inventati (brand generico).
function demoIncrementality() {
  const days = 150
  const today = Date.now()
  const baselineDaily = 3300
  const defs = [
    { key: 'meta',   avgSpend: 1000, dailyIncr: 1800, attrDaily: 3000, k: 1200, vMax: 3960, mRoas: 1.25, saturation: 0.56, carryover: [0.45, 0.27, 0.16, 0.08, 0.04], cd90: 11 },
    { key: 'google', avgSpend: 600,  dailyIncr: 900,  attrDaily: 2400, k: 900,  vMax: 2250, mRoas: 0.95, saturation: 0.66, carryover: [0.6, 0.25, 0.1, 0.05],        cd90: 6 },
  ]
  const daily = []
  for (let i = days - 1; i >= 0; i--) {
    const meta = round(defs[0].dailyIncr * (1 + 0.18 * Math.sin(i * 0.5)))
    const google = round(defs[1].dailyIncr * (1 + 0.16 * Math.sin(i * 0.5 + 2)))
    const baseline = round(baselineDaily * (1 + 0.08 * Math.sin(i * 0.2)))
    daily.push({ date: ymd(today - i * DAY), baseline, meta, google, revenue: baseline + meta + google })
  }
  const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0)
  const baselineRevenue = daily.reduce((s, d) => s + d.baseline, 0)
  const channels = defs.map(c => {
    const spend = c.avgSpend * days
    const incrementalRevenue = c.dailyIncr * days
    const attributedRevenue = c.attrDaily * days
    return {
      key: c.key, lambda: 0.6, k: c.k, spend, avgSpend: c.avgSpend,
      attributedRevenue, reportedEstimated: false,
      incrementalRevenue,
      incrementalShare: incrementalRevenue / totalRevenue,
      incrementalVsAttributed: incrementalRevenue / attributedRevenue,
      roasReported: attributedRevenue / spend,
      iRoas: incrementalRevenue / spend,
      mRoas: c.mRoas, saturation: c.saturation, factor: incrementalRevenue / attributedRevenue,
      halfSatSpend: c.k, carryover: c.carryover, carryoverDays90: c.cd90,
      contribDaily: daily.map(d => d[c.key]),
    }
  })
  const curves = {}
  for (const c of defs) {
    const pts = []; const maxS = c.avgSpend * 3
    for (let i = 0; i <= 20; i++) { const s = (maxS / 20) * i; const rev = c.vMax * s / (s + c.k); pts.push({ spend: round(s), revenue: round(rev), roas: s > 0 ? +(rev / s).toFixed(2) : 0 }) }
    curves[c.key] = pts
  }
  const perChannel = {}; let fincr = 0
  for (const c of defs) { const total = c.dailyIncr * 28; perChannel[c.key] = { dailySpend: c.avgSpend, incremental: total, iRoas: total / (c.avgSpend * 28) }; fincr += total }
  const forecast = { weeks: 4, days: 28, incremental: fincr, baseline: baselineDaily * 28, total: fincr + baselineDaily * 28, perChannel }
  return {
    ok: true, range: { since: ymd(today - (days - 1) * DAY), until: ymd(today), days }, days,
    r2: 0.78, totalRevenue, baselineRevenue, channels, daily, curves, forecast,
    channelNames: { meta: 'Meta', google: 'Google' }, sources: { meta: true, google: true, shopify: true },
    updatedAt: iso(today),
  }
}

// Geo Lift (design esperimento geo) — dati inventati, regioni generiche.
function demoGeoLift() {
  const days = 120
  const today = Date.now()
  const cvRatio = 0.17, Z = 2.8
  const mde = [14, 21, 28, 35].map(D => ({ days: D, weeks: Math.round(D / 7), mde: +(Z * cvRatio / Math.sqrt(D)).toFixed(3) }))
  const rec = mde[2] // 28 giorni
  const daily = []
  for (let i = 0; i < days; i++) {
    const w = 8 * Math.sin(i * 0.3) + i * 0.05
    daily.push({ date: ymd(today - (days - 1 - i) * DAY), test: round(100 + w), control: round(100 + w * 0.95) })
  }
  return {
    ok: true, days, metricNote: 'revenue', metric: 'revenue', source: 'shopify_region', unit: 'region',
    matchQuality: 0.86, cvRatio,
    test: { regions: ['Lombardia', 'Veneto', 'Toscana', 'Puglia', 'Sicilia'], totalRevenue: 420000 },
    control: { regions: ['Lazio', 'Campania', 'Piemonte', 'Emilia-Romagna', 'Liguria'], totalRevenue: 400000 },
    mde, recommendedDays: rec.days, recommendedWeeks: rec.weeks, recommendedMde: rec.mde,
    daily, range: { days }, updatedAt: iso(today),
  }
}

// Cassa (open banking demo): banca "collegata" con saldi, movimenti
// categorizzati e proiezione — numeri coerenti col fatturato demo (~€84k/30g).
function demoCassa() {
  const now = Date.now()
  const mstr = (off) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - off, 1).toISOString().slice(0, 7) }
  const tx = (dAgo, amount, counterparty, description, category) => ({
    booking_date: ymd(now - dAgo * DAY), amount, currency: 'EUR', counterparty, description, category,
  })
  const recent = [
    tx(0, 2841.4, 'Shopify Payments', 'Payout ordini', 'Incassi vendite'),
    tx(1, 3120.9, 'Shopify Payments', 'Payout ordini', 'Incassi vendite'),
    tx(1, -1240.0, 'Meta Platforms Ireland', 'Facebook Ads', 'Marketing e advertising'),
    tx(2, 2630.75, 'Shopify Payments', 'Payout ordini', 'Incassi vendite'),
    tx(2, -684.5, 'Google Ireland Ltd', 'Google Ads', 'Marketing e advertising'),
    tx(3, -1890.0, 'BRT S.p.A.', 'Spedizioni settimana 28', 'Logistica e spedizioni'),
    tx(4, 2954.1, 'Shopify Payments', 'Payout ordini', 'Incassi vendite'),
    tx(5, -3420.0, 'Packaging Italia Srl', 'Fattura 2026/512 — scatole e nastri', 'Fornitori'),
    tx(6, 2711.3, 'Shopify Payments', 'Payout ordini', 'Incassi vendite'),
    tx(7, -253.0, 'PayPal Europe', 'Rimborso ordine #10982', 'Rimborsi'),
    tx(8, -6400.0, 'Agenzia delle Entrate', 'F24 — IVA e contributi', 'Tasse e contributi'),
    tx(9, 3082.65, 'Shopify Payments', 'Payout ordini', 'Incassi vendite'),
    tx(10, -5200.0, 'Bonifico stipendi', 'Stipendi mese corrente', 'Stipendi e collaboratori'),
    tx(11, -389.0, 'Shopify International', 'Abbonamento + app', 'Software e servizi'),
    tx(12, 2498.8, 'Shopify Payments', 'Payout ordini', 'Incassi vendite'),
    tx(12, -980.0, 'Studio Rossi & Associati', 'Consulenza contabile Q3', 'Fornitori'),
    tx(13, -1150.0, 'Immobiliare Nord Srl', 'Affitto magazzino', 'Affitto e utenze'),
    tx(14, -47.9, 'Banca', 'Canone e commissioni', 'Bancari e finanziari'),
  ]
  const byMonth = [
    { month: mstr(3), in: 78400, out: 71200 },
    { month: mstr(2), in: 81250, out: 74800 },
    { month: mstr(1), in: 86900, out: 76400 },
    { month: mstr(0), in: 62300, out: 55600 }, // mese corrente, parziale
  ]
  const inflow90 = 251480.6
  const outflow90 = 229540.25
  const totalBalance = 59710.75
  const netPerDay = +((inflow90 - outflow90) / 90).toFixed(2) // ~243.8
  return {
    configured: true,
    connections: [
      { id: 'demo-conn-1', institution: 'Intesa Sanpaolo', status: 'active', lastSyncedAt: iso(now - 2 * 3600e3), accounts: 2 },
    ],
    balances: [
      { account_id: 'demo-acc-1', name: 'Conto Business', iban: 'IT60 X054 2811 1010 0000 0123 456', balance: 47230.55, currency: 'EUR', updated_at: iso(now - 2 * 3600e3) },
      { account_id: 'demo-acc-2', name: 'Conto Operativo', iban: 'IT12 B030 6909 6061 0000 0456 789', balance: 12480.2, currency: 'EUR', updated_at: iso(now - 2 * 3600e3) },
    ],
    recent,
    totalBalance,
    inflow90,
    outflow90,
    byMonth,
    byCategory: [
      { category: 'Fornitori', amount: 82400 },
      { category: 'Marketing e advertising', amount: 54300 },
      { category: 'Logistica e spedizioni', amount: 31200 },
      { category: 'Stipendi e collaboratori', amount: 24000 },
      { category: 'Tasse e contributi', amount: 14800 },
      { category: 'Software e servizi', amount: 6900 },
      { category: 'Affitto e utenze', amount: 5400 },
      { category: 'Rimborsi', amount: 3990 },
      { category: 'Bancari e finanziari', amount: 2150 },
      { category: 'Altro', amount: 4400 },
    ],
    projection: {
      basedOnDays: 90,
      netPerDay,
      d30: +(totalBalance + netPerDay * 30).toFixed(2),
      d60: +(totalBalance + netPerDay * 60).toFixed(2),
      d90: +(totalBalance + netPerDay * 90).toFixed(2),
    },
    updatedAt: iso(now),
  }
}

// Mappa pathname → payload demo. Ritorna undefined per endpoint non gestiti
// (l'intercettore restituirà {} → i componenti usano i loro default vuoti).
// ── Email della demo (Klaviyo) ──────────────────────────────────────────────
// Le email del negozio d'esempio: campagne e messaggi dei flussi, con oggetto, anteprima e un
// corpo HTML vero (tabelle e stili in linea, come un'email). I numeri tornano con la tabella della
// tab: stessi destinatari, stesse aperture, stesse entrate.
const DEMO_EMAIL = {
  'c-bw': { nome: 'Black Week', oggetto: 'Black Week: fino al −30% su tutto', anteprima: 'Solo fino a domenica. Le tue taglie ci sono ancora.', titolo: 'Black Week', testo: 'Fino al −30% su tutto il negozio, solo fino a domenica. Spedizione gratuita sopra i 49 €.', bottone: 'Vai agli sconti', link: '/collections/black-week', dest: 18420, ap: 48, cl: 6.2, ord: 304, rev: 21900 },
  'c-nl': { nome: 'Newsletter #42', oggetto: 'Le novità di settembre', anteprima: 'Tre arrivi nuovi e una guida per allenarti meglio.', titolo: 'Novità di settembre', testo: 'Tre arrivi nuovi per la stagione e la nostra guida per ricominciare ad allenarti dopo l’estate.', bottone: 'Scopri le novità', link: '/collections/novita', dest: 16800, ap: 41, cl: 4.1, ord: 37, rev: 2680 },
  'c-rs': { nome: 'Restock alert', oggetto: 'È tornato disponibile', anteprima: 'La tua taglia è di nuovo in magazzino.', titolo: 'È tornato', testo: 'Il prodotto che aspettavi è di nuovo disponibile, in tutte le taglie. Le scorte sono limitate.', bottone: 'Compralo ora', link: '/products/scarpe-running-airflow', dest: 9200, ap: 52, cl: 7.8, ord: 75, rev: 5400 },
  'm-wc1': { nome: 'Benvenuto', oggetto: 'Benvenuto in Acme Store', anteprima: 'Il tuo codice −10% è qui dentro.', titolo: 'Benvenuto', testo: 'Grazie per esserti iscritto. Ecco il tuo codice per il primo ordine: BENVENUTO10.', bottone: 'Inizia lo shopping', link: '/', dest: 2140, ap: 64, cl: 12.1, ord: 118, rev: 6120 },
  'm-wc2': { nome: 'Promemoria codice', oggetto: 'Il tuo −10% scade domani', anteprima: 'Ultimo giorno per usarlo.', titolo: 'Scade domani', testo: 'Il tuo codice BENVENUTO10 vale ancora per 24 ore. I più scelti della settimana ti aspettano.', bottone: 'Usa il codice', link: '/collections/best-seller', dest: 1720, ap: 58, cl: 9.8, ord: 44, rev: 2120 },
  'm-ab1': { nome: 'Carrello · 1', oggetto: 'Hai dimenticato qualcosa?', anteprima: 'Il tuo carrello è ancora qui.', titolo: 'Il tuo carrello ti aspetta', testo: 'Hai lasciato qualcosa nel carrello. Lo teniamo da parte ancora per un po’.', bottone: 'Torna al carrello', link: '/cart', dest: 3410, ap: 57, cl: 10.2, ord: 162, rev: 9080 },
  'm-ab2': { nome: 'Carrello · 2', oggetto: 'Ultima occasione per il tuo carrello', anteprima: 'Spedizione gratuita se completi oggi.', titolo: 'Ultima occasione', testo: 'Completa l’ordine oggi e la spedizione è gratuita.', bottone: 'Completa l’ordine', link: '/cart', dest: 2280, ap: 51, cl: 7.4, ord: 61, rev: 3390 },
  'm-pp1': { nome: 'Grazie', oggetto: 'Grazie per il tuo ordine', anteprima: 'Ecco cosa succede adesso.', titolo: 'Grazie', testo: 'Il tuo ordine è in preparazione. Ti scriviamo appena parte, con il link per seguirlo.', bottone: 'Segui l’ordine', link: '/account', dest: 2960, ap: 61, cl: 6.1, ord: 38, rev: 2310 },
  'm-pp2': { nome: 'Recensione', oggetto: 'Come ti trovi?', anteprima: 'Ci basta un minuto.', titolo: 'Com’è andata?', testo: 'Raccontaci come ti trovi con il tuo acquisto: ci aiuta a migliorare e aiuta chi deve scegliere.', bottone: 'Lascia una recensione', link: '/pages/recensioni', dest: 2410, ap: 49, cl: 5.2, ord: 21, rev: 1870 },
  'm-wb1': { nome: 'Ci manchi', oggetto: 'Ci manchi', anteprima: 'Un regalo per tornare.', titolo: 'Ci manchi', testo: 'È un po’ che non passi. Per tornare, la spedizione del prossimo ordine la offriamo noi.', bottone: 'Torna a trovarci', link: '/', dest: 3890, ap: 34, cl: 3.9, ord: 52, rev: 3110 },
}
const emailDi = (search) => {
  const id = (search && search.get && (search.get('flowMessage') || search.get('id'))) || ''
  return DEMO_EMAIL[id] || { nome: 'Promo weekend', oggetto: 'Il weekend degli sconti', anteprima: 'Da venerdì a domenica.', titolo: 'Weekend di sconti', testo: 'Da venerdì a domenica, i più venduti a prezzo speciale.', bottone: 'Guarda la selezione', link: '/collections/weekend', dest: 17000, ap: 44, cl: 5.1, ord: 96, rev: 6900 }
}
function htmlEmail(e) {
  const url = (x) => 'https://acme.store' + x
  const prodotti = DEMO_PRODUCTS.slice(0, 3).map(([titolo, prezzo], i) => `
          <td width="33%" style="padding:0 6px;vertical-align:top;text-align:center">
            <a href="${url('/products/' + titolo.toLowerCase().replace(/\s+/g, '-'))}" style="text-decoration:none;color:#1d1d1d">
              <div style="height:120px;border-radius:10px;background:${['#e8eef6', '#eef3ea', '#f3ecf4'][i]}"></div>
              <div style="font:600 13px/1.4 -apple-system,Helvetica,Arial,sans-serif;margin-top:8px">${titolo}</div>
              <div style="font:400 13px/1.4 -apple-system,Helvetica,Arial,sans-serif;color:#666">€${String(prezzo).replace('.', ',')}</div>
            </a>
          </td>`).join('')
  return `<!doctype html><html><body style="margin:0;background:#f4f4f4">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden">
      <tr><td style="padding:22px 28px;border-bottom:1px solid #eee;font:700 15px/1 -apple-system,Helvetica,Arial,sans-serif;letter-spacing:.14em;color:#1d1d1d">ACME STORE</td></tr>
      <tr><td style="padding:36px 28px 8px;font:700 30px/1.15 -apple-system,Helvetica,Arial,sans-serif;color:#1d1d1d">${e.titolo}</td></tr>
      <tr><td style="padding:8px 28px 22px;font:400 16px/1.55 -apple-system,Helvetica,Arial,sans-serif;color:#555">${e.testo}</td></tr>
      <tr><td style="padding:0 28px 30px"><a href="${url(e.link)}" style="display:inline-block;background:#1d1d1d;color:#ffffff;text-decoration:none;font:600 14px/1 -apple-system,Helvetica,Arial,sans-serif;padding:14px 22px;border-radius:999px">${e.bottone}</a></td></tr>
      <tr><td style="padding:0 22px 30px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${prodotti}
      </tr></table></td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid #eee;font:400 12px/1.6 -apple-system,Helvetica,Arial,sans-serif;color:#888">
        Acme Store · Via dell’Esempio 1, Milano<br><a href="${url('/pages/contatti')}" style="color:#888">Contatti</a> · <a href="${url('/unsubscribe')}" style="color:#888">Disiscriviti</a>
      </td></tr>
    </table>
  </td></tr></table></body></html>`
}
function demoEmailAnteprima(search) {
  const e = emailDi(search)
  const flusso = !!(search && search.get && search.get('flowMessage'))
  return {
    ok: true,
    campaign: { id: search?.get?.('id') || search?.get?.('flowMessage') || 'demo', name: e.nome, status: 'Sent', sendTime: iso(Date.now() - 5 * DAY) },
    message: { subject: e.oggetto, previewText: e.anteprima, fromLabel: 'Acme Store', fromEmail: 'ciao@acme.store', replyTo: 'assistenza@acme.store' },
    audiences: flusso ? { included: [], excluded: [] } : { included: [{ id: 'l1', name: 'Newsletter', type: 'list' }, { id: 's1', name: 'Engaged 30d', type: 'segment' }], excluded: [{ id: 's2', name: 'Win-back', type: 'segment' }] },
    body: { html: htmlEmail(e), text: e.testo, error: null },
  }
}
function demoEmailConsegna(search) {
  const e = emailDi(search)
  const consegnate = Math.round(e.dest * 0.992)
  const aperti = Math.round(consegnate * e.ap / 100), clic = Math.round(consegnate * e.cl / 100)
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null)
  const pesi = [[e.link, 0.58], ['/products/scarpe-running-airflow', 0.17], ['/products/borsone-duffel-40l', 0.12], ['/products/felpa-hoodie-essential', 0.09], ['/pages/contatti', 0.04]]
  const clicTotali = Math.round(clic * 1.4)
  const link = pesi.map(([u, q]) => ({ url: 'https://acme.store' + u, clic: Math.round(clicTotali * q), quota: Math.round(q * 1000) / 10 }))
  const disiscritti = Math.round(consegnate * 0.0021)
  return {
    ok: true, campagna: search?.get?.('id') || search?.get?.('flowMessage') || 'demo', avviso: null,
    consegna: {
      destinatari: e.dest, consegnate, rimbalzi: e.dest - consegnate,
      aperturePersone: aperti, aperturePct: pct(aperti, consegnate), apertureTotali: Math.round(aperti * 1.6),
      clicPersone: clic, clicPct: pct(clic, consegnate), clicTotali, clicSuAperture: pct(clic, aperti),
      clicPerPersona: Math.round((clicTotali / Math.max(1, clic)) * 10) / 10, nonHannoCliccato: consegnate - clic,
      ordini: e.ord, entrate: e.rev, entratePerDestinatario: Math.round((e.rev / consegnate) * 100) / 100,
      disiscritti, disiscrittiPct: pct(disiscritti, consegnate), spam: 2, spamPct: pct(2, consegnate),
    },
    link,
    clientClic: [{ client: 'Apple Mail', valore: Math.round(clic * 0.46) }, { client: 'Gmail', valore: Math.round(clic * 0.38) }, { client: 'Outlook', valore: Math.round(clic * 0.1) }, { client: 'Yahoo', valore: Math.round(clic * 0.06) }],
    nonDisponibile: {},
    periodoGiorni: 30,
  }
}
// I flussi della demo, come li restituisce /api/klaviyo/flusso: innesco, passi collegati fra loro,
// statistiche per ogni email.
function demoFlusso(search) {
  const id = (search && search.get && search.get('id')) || 'f-wc'
  const stat = (k) => { const e = DEMO_EMAIL[k]; return { destinatari: e.dest, aperturePct: e.ap, clicPct: e.cl, ordini: e.ord, entrate: e.rev } }
  const email = (pid, k, prossimo = null) => ({ id: pid, tipoOriginale: 'send-email', tipo: 'email', titolo: DEMO_EMAIL[k].nome, sotto: DEMO_EMAIL[k].oggetto, anteprima: DEMO_EMAIL[k].anteprima, stato: 'live', etichette: ['Smart Sending', 'Tracciamento UTM'], messaggioId: k, senzaInvii: false, statistiche: stat(k), prossimo, seSi: null, seNo: null })
  const attesa = (pid, giorni, prossimo) => ({ id: pid, tipoOriginale: 'time-delay', tipo: 'attesa', titolo: giorni === 1 ? 'Aspetta 1 giorno' : giorni < 1 ? `Aspetta ${Math.round(giorni * 24)} ore` : `Aspetta ${giorni} giorni`, sotto: null, giorni, prossimo, seSi: null, seNo: null })
  const bivio = (pid, sotto, seSi, seNo) => ({ id: pid, tipoOriginale: 'conditional-split', tipo: 'bivio', titolo: 'Suddivisione condizionale', sotto, prossimo: null, seSi, seNo })
  const FLUSSI = {
    'f-wc': { nome: 'Welcome Flow', innesco: 'Quando una persona entra nella lista', passi: [email('1', 'm-wc1', '2'), attesa('2', 2, '3'), bivio('3', 'Ha fatto «Placed Order» zero volte dall’avvio del flusso', '4', null), email('4', 'm-wc2')] },
    'f-ab': { nome: 'Abandoned Cart', innesco: 'Quando una persona fa «Started Checkout»', passi: [attesa('1', 0.17, '2'), email('2', 'm-ab1', '3'), attesa('3', 1, '4'), bivio('4', 'Ha fatto «Placed Order» zero volte dall’avvio del flusso', '5', null), email('5', 'm-ab2')] },
    'f-pp': { nome: 'Post-purchase', innesco: 'Quando una persona fa «Placed Order»', passi: [email('1', 'm-pp1', '2'), attesa('2', 10, '3'), email('3', 'm-pp2')] },
    'f-wb': { nome: 'Win-back 90d', innesco: 'Quando una persona entra nel segmento', passi: [email('1', 'm-wb1')] },
  }
  const f = FLUSSI[id] || FLUSSI['f-wc']
  const emails = f.passi.filter(x => x.tipo === 'email')
  return {
    ok: true,
    flusso: { id, nome: f.nome, stato: 'live', creato: iso(Date.now() - 400 * DAY), aggiornato: iso(Date.now() - 20 * DAY) },
    innesco: { testo: f.innesco, filtriEvento: false, filtriProfilo: false },
    ingresso: f.passi[0].id,
    passi: f.passi,
    periodoGiorni: Number(search?.get?.('days')) || 30,
    totali: { invii: emails.reduce((a, x) => a + x.statistiche.destinatari, 0), ordini: emails.reduce((a, x) => a + x.statistiche.ordini, 0), entrate: emails.reduce((a, x) => a + x.statistiche.entrate, 0) },
    avvisoStatistiche: null, diagnostica: null,
  }
}
function demoPubblico(search) {
  const id = (search && search.get && search.get('id')) || 'l1'
  const tipo = (search && search.get && search.get('tipo')) || 'list'
  const NOMI = { l1: ['Newsletter', 18420], l2: ['VIP', 2110], s1: ['Engaged 30d', 6240], s2: ['Win-back', 3110] }
  const [nome, profili] = NOMI[id] || ['Pubblico', 5000]
  const campagne = ['c-bw', 'c-nl', 'c-rs'].map((k, i) => {
    const e = DEMO_EMAIL[k]
    const quota = Math.min(1, profili / e.dest)
    return { id: k, nome: e.nome, inviata: iso(Date.now() - [5, 9, 13][i] * DAY), destinatari: Math.round(e.dest * quota), aperturePct: e.ap, clickPct: e.cl, ordini: Math.round(e.ord * quota), entrate: Math.round(e.rev * quota), incluso: true }
  })
  const destinatari = campagne.reduce((a, c) => a + c.destinatari, 0), entrate = campagne.reduce((a, c) => a + c.entrate, 0)
  const crescita = tipo === 'list' ? Array.from({ length: 30 }, (_, i) => ({ giorno: ymd(Date.now() - (29 - i) * DAY), iscritti: 18 + ((i * 7) % 11), aggiunti: (i * 3) % 5, disiscritti: 2 + (i % 4), rimossi: i % 7 === 0 ? 3 : 0 })) : null
  return {
    ok: true,
    pubblico: { id, tipo, nome, profili, creato: iso(Date.now() - 700 * DAY), aggiornato: iso(Date.now() - DAY) },
    totali: { campagne: campagne.length, destinatari, aperturePct: 46.1, clickPct: 5.9, ordini: campagne.reduce((a, c) => a + c.ordini, 0), entrate, entratePerDestinatario: Math.round((entrate / Math.max(1, destinatari)) * 100) / 100 },
    campagne, crescita, crescitaNota: tipo === 'list' ? null : 'segmento', statisticheErrore: null,
    periodoCrescita: 30, periodoCampagne: 90,
  }
}

// ============================================================================
//  PRODUCTIVITY AI (demo) — Progetti & Task, Calendario, Ferie e permessi,
//  Lyftimer, LyftTalk, Creatività, Squadra AI.
//
//  Queste tab finiscono nelle immagini della landing in cinque lingue, quindi i
//  TESTI inventati (titoli, messaggi, eventi, note, nomi delle creatività)
//  seguono la lingua della demo, letta al momento della chiamata. Ogni voce ha
//  accanto le sue cinque traduzioni: una frase nuova si aggiunge in un posto
//  solo e non può restare indietro in una lingua.
//  Le date sono sempre relative a oggi e cadono su giorni veri della settimana
//  (lunedì in testa): la demo non invecchia e le promo non partono a caso.
// ============================================================================

const LINGUE_DEMO = ['it', 'en', 'es', 'fr', 'de']
const INTL_DEMO = { it: 'it-IT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' }

// La lingua la tiene l'I18nProvider su <html lang>. Nella demo localStorage è
// sostituito da uno shim che non conosce 'lyft_lang': resta come riserva per
// chi chiama queste funzioni fuori dalla demo.
function linguaDemo() {
  try {
    const l = String((typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) || '').slice(0, 2).toLowerCase()
    if (LINGUE_DEMO.includes(l)) return l
  } catch {}
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem('lyft_lang') : null
    if (v && LINGUE_DEMO.includes(v)) return v
  } catch {}
  return 'it'
}
// La voce nella lingua scelta; l'italiano fa da riserva, come nei dizionari veri.
const tl = (o, l) => (o == null ? null : typeof o === 'string' ? o : (o[l] ?? o.it ?? null))

// Giorni di calendario in ora LOCALE ('YYYY-MM-DD'): è così che li leggono
// Calendario, Ferie e le scadenze delle task. ymd() qui sopra passa da UTC e
// vicino alla mezzanotte sbaglierebbe giorno.
const pad2 = n => String(n).padStart(2, '0')
const ymdLocale = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
function lunediDi(settimane = 0) {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + settimane * 7)
  return d
}
// [settimane da questa, giorno 0=lunedì … 6=domenica] oppure n giorni da oggi.
function quando(v) {
  if (v == null) return null
  if (Array.isArray(v)) { const d = lunediDi(v[0]); d.setDate(d.getDate() + v[1]); return ymdLocale(d) }
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + v); return ymdLocale(d)
}
const nomeDi = id => (MEMBERS.find(m => m.id === id) || {}).full_name || ''

// Presenza: chi è in ferie risulta scollegato, gli altri online (il pallino
// verde di LyftTalk guarda last_seen_at negli ultimi 70 secondi).
function demoMembers() {
  const ora = Date.now()
  return MEMBERS.map(m => ({ ...m, last_seen_at: iso(m.id === 'd-ecom' ? ora - 3 * DAY : ora - 15000) }))
}

// Avvisi per le azioni che nella demo non possono andare a buon fine: meglio
// dirlo nella lingua di chi guarda che far sparire il testo senza spiegazioni.
const AVVISO_CHAT = { it: 'Nella demo i messaggi non vengono inviati.', en: 'Messages aren’t sent in the demo.', es: 'En la demo los mensajes no se envían.', fr: 'Dans la démo, les messages ne sont pas envoyés.', de: 'In der Demo werden keine Nachrichten gesendet.' }
const AVVISO_DEMO = { it: 'Nella demo le modifiche non vengono salvate.', en: 'Changes aren’t saved in the demo.', es: 'En la demo los cambios no se guardan.', fr: 'Dans la démo, les modifications ne sont pas enregistrées.', de: 'In der Demo werden Änderungen nicht gespeichert.' }
const AVVISO_FILE = { it: 'Nella demo i file non si scaricano.', en: 'Files can’t be downloaded in the demo.', es: 'En la demo no se pueden descargar archivos.', fr: 'Les fichiers ne se téléchargent pas dans la démo.', de: 'In der Demo lassen sich keine Dateien herunterladen.' }

// ── Progetti ────────────────────────────────────────────────────────────────
// Sei spazi di lavoro tipici di un e-commerce; «Checkout più veloce» è chiuso
// del tutto, così i Grafici hanno anche un progetto completato.
const PROGETTI = [
  { id: 'p-launch', color: '#ff9f0a', by: 'd-owner', creato: 24, inizio: [-3, 0], fine: [1, 4], ore: 240, euro: 8900,
    name: { it: 'Lancio nuova collezione', en: 'New collection launch', es: 'Lanzamiento nueva colección', fr: 'Lancement nouvelle collection', de: 'Launch neue Kollektion' },
    description: { it: 'Shooting, landing, email ai VIP e campagne della settimana di lancio.', en: 'Photo shoot, landing page, VIP email and launch-week campaigns.', es: 'Sesión de fotos, landing, email a clientes VIP y campañas de la semana de lanzamiento.', fr: 'Shooting, landing page, e-mail aux clients VIP et campagnes de la semaine de lancement.', de: 'Shooting, Landingpage, VIP-Mailing und Kampagnen der Launch-Woche.' } },
  { id: 'p-ads', color: '#7b5bff', by: 'd-adv', creato: 70, inizio: -70, fine: null, ore: 360, euro: 13300,
    name: { it: 'Campagne Meta & Google', en: 'Meta & Google campaigns', es: 'Campañas Meta y Google', fr: 'Campagnes Meta & Google', de: 'Meta- & Google-Kampagnen' },
    description: { it: 'Creative nuove ogni settimana, test di pubblico e budget guidato dal MER.', en: 'Fresh creatives every week, audience tests and MER-driven budgets.', es: 'Creatividades nuevas cada semana, tests de audiencias y presupuesto guiado por el MER.', fr: 'De nouvelles créas chaque semaine, des tests d’audiences et un budget piloté par le MER.', de: 'Jede Woche neue Creatives, Zielgruppentests und Budget nach MER.' } },
  { id: 'p-promo', color: '#ff375f', by: 'd-owner', creato: 12, inizio: [-1, 0], fine: [3, 6], ore: 120, euro: 4400,
    name: { it: 'Saldi di metà stagione', en: 'Mid-season sale', es: 'Rebajas de mitad de temporada', fr: 'Soldes de mi-saison', de: 'Mid-Season-Sale' },
    description: { it: '−20% su una selezione e spedizione gratuita sopra 49 €, per dieci giorni.', en: '−20% on a selection and free shipping over €49, for ten days.', es: '−20 % en una selección y envío gratis a partir de 49 €, durante diez días.', fr: '−20 % sur une sélection et livraison offerte dès 49 €, pendant dix jours.', de: '−20 % auf eine Auswahl und kostenloser Versand ab 49 €, zehn Tage lang.' } },
  { id: 'p-email', color: '#0a84ff', by: 'd-seo', creato: 50, inizio: -50, fine: null, ore: 110, euro: 3700,
    name: { it: 'Email & automazioni', en: 'Email & automations', es: 'Email y automatizaciones', fr: 'E-mails & automatisations', de: 'E-Mail & Automationen' },
    description: { it: 'Flussi di benvenuto, carrello abbandonato e riattivazione dei clienti inattivi.', en: 'Welcome, abandoned-cart and win-back flows.', es: 'Flujos de bienvenida, carrito abandonado y reactivación de clientes inactivos.', fr: 'Scénarios de bienvenue, de panier abandonné et de réactivation des clients inactifs.', de: 'Welcome-, Warenkorbabbruch- und Reaktivierungs-Flows.' } },
  { id: 'p-seo', color: '#30d158', by: 'd-seo', creato: 90, inizio: -90, fine: null, ore: 120, euro: 3800,
    name: { it: 'SEO & blog', en: 'SEO & blog', es: 'SEO y blog', fr: 'SEO & blog', de: 'SEO & Blog' },
    description: { it: 'Guide, schede prodotto e correzioni tecniche per crescere nell’organico.', en: 'Guides, product pages and technical fixes to grow organic traffic.', es: 'Guías, fichas de producto y correcciones técnicas para crecer en orgánico.', fr: 'Guides, fiches produit et correctifs techniques pour développer le trafic organique.', de: 'Ratgeber, Produktseiten und technische Fixes für mehr organischen Traffic.' } },
  { id: 'p-cro', color: '#64d2ff', by: 'd-cro', creato: 45, inizio: -45, fine: -8, ore: 110, euro: 3900,
    name: { it: 'Checkout più veloce', en: 'Faster checkout', es: 'Checkout más rápido', fr: 'Checkout plus rapide', de: 'Schnellerer Checkout' },
    description: { it: 'Checkout in una pagina, pagamenti rapidi e test sul pulsante acquista.', en: 'One-page checkout, express payments and buy-button tests.', es: 'Checkout en una página, pagos exprés y tests en el botón de compra.', fr: 'Checkout sur une page, paiements express et tests sur le bouton d’achat.', de: 'One-Page-Checkout, Express-Zahlungen und Tests am Kaufen-Button.' } },
]
function demoProjects(l = linguaDemo()) {
  return PROGETTI.map(p => ({
    id: p.id, name: tl(p.name, l), description: tl(p.description, l), color: p.color, archived: false,
    created_by: p.by, start_date: quando(p.inizio), end_date: quando(p.fine),
    budget_hours: p.ore, budget_amount: p.euro, created_at: iso(Date.now() - p.creato * DAY),
  }))
}
// La chat di un progetto apre il canale LyftTalk più vicino (il lancio ha il suo).
const CANALE_DEL_PROGETTO = { 'p-launch': 'c-launch', 'p-ads': 'c-ads', 'p-promo': 'c-mkt', 'p-email': 'c-mkt', 'p-seo': 'c-seo', 'p-cro': 'c-gen' }

// ── Task ────────────────────────────────────────────────────────────────────
// s = stato, a = responsabile, due = scadenza (giorni da oggi o [settimana, giorno]),
// fatto = completata N giorni fa, c = creata N giorni fa. Il lancio cade giovedì
// della settimana prossima ([1, 3]) e i saldi partono il venerdì dopo ([2, 4]):
// le scadenze che li riguardano sono agganciate a quelle date.
const TASK = [
  { id: 't1', p: 'p-launch', s: 'in_progress', a: 'd-design', pr: 'high', due: [1, 0], by: 'd-owner', c: 12,
    t: { it: 'Shooting prodotti nuova collezione', en: 'New collection product shoot', es: 'Sesión de fotos de la nueva colección', fr: 'Shooting produits nouvelle collection', de: 'Produktshooting neue Kollektion' },
    d: { it: '24 capi su sfondo neutro + 6 foto ambientate. Shotlist in allegato.', en: '24 items on a neutral background + 6 lifestyle shots. Shot list attached.', es: '24 prendas sobre fondo neutro + 6 fotos lifestyle. Shotlist adjunta.', fr: '24 pièces sur fond neutre + 6 photos lifestyle. Shot list en pièce jointe.', de: '24 Teile vor neutralem Hintergrund + 6 Lifestyle-Fotos. Shotlist im Anhang.' },
    f: [['shotlist.pdf', 184320]] },
  { id: 't2', p: 'p-launch', s: 'todo', a: 'd-seo', pr: 'medium', due: [1, 1], by: 'd-owner', c: 11,
    t: { it: 'Schede prodotto: testi e guida taglie', en: 'Product pages: copy and size guide', es: 'Fichas de producto: textos y guía de tallas', fr: 'Fiches produit : textes et guide des tailles', de: 'Produktseiten: Texte und Größentabelle' } },
  { id: 't3', p: 'p-launch', s: 'in_review', a: 'd-cro', pr: 'high', due: [1, 0], by: 'd-owner', c: 10,
    t: { it: 'Landing page di lancio', en: 'Launch landing page', es: 'Landing page de lanzamiento', fr: 'Landing page de lancement', de: 'Launch-Landingpage' },
    d: { it: 'Hero con video di 6 secondi, blocco taglie, recensioni sotto la CTA. Prima la versione mobile.', en: 'Hero with a 6-second video, size block, reviews under the CTA. Mobile version first.', es: 'Hero con vídeo de 6 segundos, bloque de tallas y reseñas bajo la CTA. Primero la versión móvil.', fr: 'Hero avec une vidéo de 6 secondes, bloc tailles, avis sous le CTA. Version mobile d’abord.', de: 'Hero mit 6-Sekunden-Video, Größenblock, Bewertungen unter dem CTA. Mobile zuerst.' },
    f: [['wireframe-landing.png', 412672]] },
  { id: 't4', p: 'p-launch', s: 'todo', a: 'd-owner', pr: 'high', due: [1, 1], by: 'd-owner', c: 9,
    t: { it: 'Email di lancio ai clienti VIP', en: 'Launch email to VIP customers', es: 'Email de lanzamiento a clientes VIP', fr: 'E-mail de lancement aux clients VIP', de: 'Launch-Mail an VIP-Kunden' },
    d: { it: 'Invio 48 ore prima del lancio: accesso anticipato con codice personale.', en: 'Send 48 hours before launch: early access with a personal code.', es: 'Envío 48 horas antes del lanzamiento: acceso anticipado con código personal.', fr: 'Envoi 48 h avant le lancement : accès anticipé avec un code personnel.', de: 'Versand 48 Stunden vor dem Launch: Early Access mit persönlichem Code.' } },
  { id: 't5', p: 'p-launch', s: 'in_review', a: 'd-adv', pr: 'urgent', due: [1, 2], by: 'd-owner', c: 6,
    t: { it: 'Budget ads della settimana di lancio', en: 'Ad budget for launch week', es: 'Presupuesto de anuncios de la semana de lanzamiento', fr: 'Budget ads de la semaine de lancement', de: 'Ads-Budget für die Launch-Woche' },
    d: { it: '450 € al giorno per 7 giorni, 70% Meta e 30% Google. Da rivedere col MER dopo 3 giorni.', en: '€450 a day for 7 days, 70% Meta and 30% Google. Review against MER after 3 days.', es: '450 € al día durante 7 días, 70 % Meta y 30 % Google. Revisar con el MER a los 3 días.', fr: '450 € par jour pendant 7 jours, 70 % Meta et 30 % Google. À revoir avec le MER après 3 jours.', de: '450 € pro Tag für 7 Tage, 70 % Meta und 30 % Google. Nach 3 Tagen mit dem MER prüfen.' } },
  { id: 't6', p: 'p-launch', s: 'done', a: 'd-ecom', pr: 'medium', due: -4, fatto: 5, by: 'd-owner', c: 14,
    t: { it: 'Controllo stock taglie M e L', en: 'Stock check on sizes M and L', es: 'Control de stock de las tallas M y L', fr: 'Contrôle du stock tailles M et L', de: 'Bestandscheck Größen M und L' } },
  { id: 't7', p: 'p-ads', s: 'in_progress', a: 'd-adv', pr: 'high', due: 3, by: 'd-adv', c: 8,
    t: { it: 'Nuove creative UGC per il prospecting', en: 'New UGC creatives for prospecting', es: 'Nuevas creatividades UGC para prospecting', fr: 'Nouvelles créas UGC pour la prospection', de: 'Neue UGC-Creatives fürs Prospecting' } },
  { id: 't8', p: 'p-ads', s: 'done', a: 'd-adv', pr: 'medium', due: -6, fatto: 6, by: 'd-adv', c: 16,
    t: { it: 'Escludere chi ha comprato dal retargeting', en: 'Exclude recent buyers from retargeting', es: 'Excluir a los compradores recientes del retargeting', fr: 'Exclure les acheteurs récents du retargeting', de: 'Käufer aus dem Retargeting ausschließen' } },
  { id: 't9', p: 'p-ads', s: 'in_progress', a: 'd-adv', pr: 'medium', due: 8, by: 'd-owner', c: 7,
    t: { it: 'Test Advantage+ contro pubblico ampio', en: 'Advantage+ vs broad audience test', es: 'Test Advantage+ frente a público amplio', fr: 'Test Advantage+ vs audience large', de: 'Test: Advantage+ vs. breite Zielgruppe' } },
  { id: 't10', p: 'p-ads', s: 'todo', a: 'd-seo', pr: 'medium', due: 10, by: 'd-adv', c: 5,
    t: { it: 'Feed Google Shopping: titoli ottimizzati', en: 'Google Shopping feed: optimized titles', es: 'Feed de Google Shopping: títulos optimizados', fr: 'Flux Google Shopping : titres optimisés', de: 'Google-Shopping-Feed: optimierte Titel' } },
  { id: 't11', p: 'p-ads', s: 'approved', a: 'd-owner', pr: 'low', due: -2, fatto: 2, by: 'd-adv', c: 9,
    t: { it: 'Report settimanale MER e CAC', en: 'Weekly MER and CAC report', es: 'Informe semanal de MER y CAC', fr: 'Rapport hebdo MER et CAC', de: 'Wöchentlicher MER- und CAC-Report' } },
  { id: 't12', p: 'p-promo', s: 'approved', a: 'd-owner', pr: 'high', due: -3, fatto: 4, by: 'd-owner', c: 12,
    t: { it: 'Piano sconti e soglia di spedizione', en: 'Discount plan and free-shipping threshold', es: 'Plan de descuentos y umbral de envío gratis', fr: 'Plan de remises et seuil de livraison offerte', de: 'Rabattplan und Versandkostenschwelle' },
    f: [['discount-plan.xlsx', 38912]] },
  { id: 't13', p: 'p-promo', s: 'in_review', a: 'd-design', pr: 'high', due: [2, 0], by: 'd-owner', c: 7,
    t: { it: 'Banner home e barra promo', en: 'Homepage banner and promo bar', es: 'Banner de la home y barra promocional', fr: 'Bannière d’accueil et barre promo', de: 'Startseiten-Banner und Promo-Leiste' },
    f: [['banner-home-v2.png', 530432]] },
  { id: 't14', p: 'p-promo', s: 'todo', a: 'd-ecom', pr: 'medium', due: [2, 2], by: 'd-owner', c: 6,
    t: { it: 'Codici sconto su Shopify', en: 'Set up discount codes in Shopify', es: 'Crear los códigos de descuento en Shopify', fr: 'Créer les codes promo dans Shopify', de: 'Rabattcodes in Shopify anlegen' } },
  { id: 't15', p: 'p-promo', s: 'in_progress', a: 'd-design', pr: 'high', due: [1, 4], by: 'd-adv', c: 5,
    t: { it: 'Statiche −20% per Meta (3 formati)', en: '−20% static ads for Meta (3 formats)', es: 'Estáticos −20 % para Meta (3 formatos)', fr: 'Visuels −20 % pour Meta (3 formats)', de: '−20-%-Statics für Meta (3 Formate)' } },
  { id: 't16', p: 'p-promo', s: 'todo', a: 'd-seo', pr: 'medium', due: [3, 4], by: 'd-owner', c: 4,
    t: { it: 'Email e SMS dell’ultimo giorno', en: 'Last-day email and SMS', es: 'Email y SMS del último día', fr: 'E-mail et SMS du dernier jour', de: 'E-Mail und SMS zum letzten Tag' } },
  { id: 't17', p: 'p-email', s: 'in_review', a: 'd-seo', pr: 'medium', due: -1, by: 'd-seo', c: 10,
    t: { it: 'Carrello abbandonato: nuova terza email', en: 'Abandoned cart: new third email', es: 'Carrito abandonado: nueva tercera email', fr: 'Panier abandonné : nouvel e-mail n° 3', de: 'Warenkorbabbruch: neue dritte Mail' },
    d: { it: 'Oggetto con un’urgenza gentile, tre prodotti simili, nessuno sconto.', en: 'Gentle urgency in the subject line, three similar products, no discount.', es: 'Asunto con una urgencia amable, tres productos similares, sin descuento.', fr: 'Objet avec une urgence douce, trois produits similaires, sans remise.', de: 'Betreff mit sanfter Dringlichkeit, drei ähnliche Produkte, kein Rabatt.' } },
  { id: 't18', p: 'p-email', s: 'done', a: 'd-cro', pr: 'medium', due: -9, fatto: 8, by: 'd-seo', c: 18,
    t: { it: 'Segmento clienti inattivi da 90 giorni', en: '90-day inactive customers segment', es: 'Segmento de clientes inactivos 90 días', fr: 'Segment clients inactifs depuis 90 jours', de: 'Segment: seit 90 Tagen inaktive Kunden' } },
  { id: 't19', p: 'p-email', s: 'todo', a: 'd-owner', pr: 'low', due: 12, by: 'd-seo', c: 3,
    t: { it: 'Test A/B sull’oggetto della newsletter', en: 'Newsletter subject line A/B test', es: 'Test A/B del asunto de la newsletter', fr: 'Test A/B de l’objet de la newsletter', de: 'A/B-Test Newsletter-Betreff' } },
  { id: 't20', p: 'p-email', s: 'in_progress', a: 'd-seo', pr: 'medium', due: 6, by: 'd-seo', c: 9,
    t: { it: 'Welcome flow: sconto e storia del brand', en: 'Welcome flow: discount and brand story', es: 'Flujo de bienvenida: descuento e historia de la marca', fr: 'Scénario de bienvenue : remise et histoire de la marque', de: 'Welcome-Flow: Rabatt und Markenstory' } },
  { id: 't21', p: 'p-seo', s: 'in_progress', a: 'd-seo', pr: 'medium', due: 4, by: 'd-seo', c: 13,
    t: { it: 'Articolo: guida completa alle taglie', en: 'Article: complete size guide', es: 'Artículo: guía completa de tallas', fr: 'Article : guide complet des tailles', de: 'Artikel: kompletter Größenratgeber' } },
  { id: 't22', p: 'p-seo', s: 'todo', a: 'd-cro', pr: 'urgent', due: -1, by: 'd-seo', c: 2,
    t: { it: 'Correggere le 404 dopo il cambio URL', en: 'Fix 404s after the URL change', es: 'Corregir los 404 tras el cambio de URL', fr: 'Corriger les 404 après le changement d’URL', de: '404-Fehler nach URL-Umstellung beheben' },
    d: { it: '12 pagine segnalate da Search Console: l’elenco dei redirect è in allegato.', en: '12 pages flagged in Search Console: the redirect list is attached.', es: '12 páginas señaladas por Search Console: la lista de redirecciones está adjunta.', fr: '12 pages signalées par la Search Console : la liste des redirections est en pièce jointe.', de: '12 Seiten in der Search Console gemeldet: Die Redirect-Liste hängt an.' },
    f: [['redirects.csv', 2150]] },
  { id: 't23', p: 'p-seo', s: 'done', a: 'd-seo', pr: 'low', due: -9, fatto: 11, by: 'd-seo', c: 20,
    t: { it: 'Meta description delle categorie principali', en: 'Meta descriptions for main categories', es: 'Meta descriptions de las categorías principales', fr: 'Meta descriptions des catégories principales', de: 'Meta-Descriptions der Hauptkategorien' } },
  { id: 't24', p: 'p-seo', s: 'todo', a: 'd-cro', pr: 'medium', due: 14, by: 'd-seo', c: 2,
    t: { it: 'Dati strutturati per le recensioni', en: 'Structured data for reviews', es: 'Datos estructurados para las reseñas', fr: 'Données structurées pour les avis', de: 'Strukturierte Daten für Bewertungen' } },
  { id: 't25', p: 'p-cro', s: 'approved', a: 'd-cro', pr: 'high', due: -8, fatto: 9, by: 'd-cro', c: 40,
    t: { it: 'Checkout in una pagina', en: 'One-page checkout', es: 'Checkout en una sola página', fr: 'Checkout sur une seule page', de: 'One-Page-Checkout' } },
  { id: 't26', p: 'p-cro', s: 'done', a: 'd-ecom', pr: 'medium', due: -12, fatto: 13, by: 'd-cro', c: 38,
    t: { it: 'Attivare Apple Pay e Google Pay', en: 'Enable Apple Pay and Google Pay', es: 'Activar Apple Pay y Google Pay', fr: 'Activer Apple Pay et Google Pay', de: 'Apple Pay und Google Pay aktivieren' } },
  { id: 't27', p: 'p-cro', s: 'approved', a: 'd-cro', pr: 'medium', due: -5, fatto: 6, by: 'd-cro', c: 30,
    t: { it: 'Test A/B sul pulsante acquista', en: 'A/B test on the buy button', es: 'Test A/B del botón de compra', fr: 'Test A/B sur le bouton d’achat', de: 'A/B-Test am Kaufen-Button' } },
  { id: 't28', p: null, s: 'todo', a: 'd-owner', pr: 'medium', due: 7, by: 'd-owner', c: 3,
    t: { it: 'Rinnovo del contratto di magazzino', en: 'Renew the warehouse contract', es: 'Renovar el contrato del almacén', fr: 'Renouveler le contrat de l’entrepôt', de: 'Lagervertrag verlängern' } },
]
const titoloTask = (id, l) => { const x = TASK.find(t => t.id === id); return x ? tl(x.t, l) : '' }

function demoTasks(l = linguaDemo()) {
  const ora = Date.now()
  return TASK.map((x, i) => {
    const chiusa = x.fatto != null ? ora - x.fatto * DAY + (i % 5) * 3600000 : null
    return {
      id: x.id, workspace_id: 'demo', project_id: x.p, title: tl(x.t, l), description: tl(x.d, l) || '',
      status: x.s, priority: x.pr, assignee_id: x.a, assignees: [x.a], due_date: quando(x.due),
      links: [], attachments: (x.f || []).map(([name, size]) => ({ path: `demo/${x.id}/${name}`, name, size })),
      position: i, created_by: x.by, created_at: iso(ora - x.c * DAY),
      // Completata = approved_at (o updated_at): i Grafici ci contano puntualità e andamento.
      updated_at: iso(chiusa || ora - ((i * 7) % 30) * 3600000),
      approved_at: x.s === 'approved' ? iso(chiusa) : null,
    }
  })
}

// Commenti sulle task più «vive»: si vedono aprendo la scheda.
const COMMENTI = {
  t3: [
    ['d-owner', 300, { it: 'Vista: ottima. Solo la foto hero, la vorrei più luminosa.', en: 'Looks great. Just the hero photo: I’d make it brighter.', es: 'Vista: genial. Solo la foto del hero, la haría más luminosa.', fr: 'Vu : très bien. Juste la photo du hero, je la voudrais plus lumineuse.', de: 'Gesehen: super. Nur das Hero-Foto hätte ich gern heller.' }],
    ['d-cro', 190, { it: 'Fatto, caricata la versione nuova. Ora il blocco recensioni sta sopra la piega.', en: 'Done, new version uploaded. The reviews block is now above the fold.', es: 'Hecho, subida la nueva versión. Ahora el bloque de reseñas está en la primera pantalla.', fr: 'C’est fait, nouvelle version en ligne. Le bloc d’avis est maintenant au-dessus de la ligne de flottaison.', de: 'Erledigt, neue Version hochgeladen. Der Bewertungsblock ist jetzt above the fold.' }],
  ],
  t5: [
    ['d-adv', 820, { it: 'La proposta è nella descrizione. Se va bene, la attivo la mattina del lancio.', en: 'The proposal is in the description. If it’s OK, I’ll switch it on the morning of the launch.', es: 'La propuesta está en la descripción. Si os parece bien, la activo la mañana del lanzamiento.', fr: 'La proposition est dans la description. Si c’est bon, je l’active le matin du lancement.', de: 'Der Vorschlag steht in der Beschreibung. Wenn es passt, schalte ich ihn am Launch-Morgen live.' }],
    ['d-owner', 760, { it: 'Ok per me. Teniamo 50 € al giorno per il test Advantage+.', en: 'Fine by me. Let’s keep €50 a day for the Advantage+ test.', es: 'Por mí, bien. Dejemos 50 € al día para el test de Advantage+.', fr: 'OK pour moi. Gardons 50 € par jour pour le test Advantage+.', de: 'Passt für mich. 50 € pro Tag lassen wir für den Advantage+-Test.' }],
  ],
  t13: [
    ['d-cro', 145, { it: 'Su mobile il bottone lo farei più grande.', en: 'On mobile I’d make the button bigger.', es: 'En móvil haría el botón más grande.', fr: 'Sur mobile, je ferais le bouton plus grand.', de: 'Auf dem Handy würde ich den Button größer machen.' }],
    ['d-design', 130, { it: 'Fatto, caricata la v2.', en: 'Done, v2 is uploaded.', es: 'Hecho, subida la v2.', fr: 'C’est fait, la v2 est en ligne.', de: 'Erledigt, v2 ist hochgeladen.' }],
  ],
}
function demoTaskComments(search, l = linguaDemo()) {
  const id = (search && search.get && search.get('task_id')) || ''
  return (COMMENTI[id] || []).map(([mid, min, body], k) => ({
    id: `tc-${id}-${k}`, task_id: id, author_id: mid, author_name: nomeDi(mid), body: tl(body, l), created_at: iso(Date.now() - min * 60000),
  }))
}

// Membri di progetto: lead + persone. I ruoli escono già con l'etichetta leggibile
// (il pannello li mostra così come arrivano).
const RUOLI_LEGGIBILI = { admin: 'Admin', cro_specialist: 'CRO Specialist', ecommerce_manager: 'E-commerce Manager', advertising_manager: 'Advertising / Marketing / SEO', data_analyst: 'Data Analyst' }
const SQUADRE_PROGETTO = {
  'p-launch': ['d-owner', 'd-cro', 'd-design', 'd-seo', 'd-ecom', 'd-adv'],
  'p-ads': ['d-adv', 'd-design', 'd-owner'],
  'p-promo': ['d-owner', 'd-design', 'd-ecom', 'd-seo', 'd-adv'],
  'p-email': ['d-seo', 'd-cro', 'd-owner'],
  'p-seo': ['d-seo', 'd-cro'],
  'p-cro': ['d-cro', 'd-ecom', 'd-owner'],
}
function assentiOggi(l = linguaDemo()) {
  const oggi = quando(0)
  const out = {}
  for (const r of demoTimeOff(l)) if (r.status === 'approved' && r.start_date <= oggi && r.end_date >= oggi) out[r.member_id] = { type: r.type, until: r.end_date }
  return out
}
function demoProjectMembers(search) {
  const leave = assentiOggi()
  const team = MEMBERS.map(m => ({ id: m.id, name: m.full_name, email: m.email, roles: m.roles.map(r => RUOLI_LEGGIBILI[r] || r), leave: leave[m.id] || null }))
  const pid = search && search.get && search.get('projectId')
  if (!pid) return { members: [], team, needsSetup: false }
  const members = (SQUADRE_PROGETTO[pid] || []).map((mid, k) => {
    const m = team.find(x => x.id === mid)
    return { id: `pm-${pid}-${mid}`, memberId: mid, name: m.name, roles: m.roles, isLead: k === 0, leave: m.leave }
  })
  return { members, team, needsSetup: false, can: { write: true } }
}

// ── Ferie e permessi ────────────────────────────────────────────────────────
// Stessa fonte per Ferie, Calendario, Lyftimer (presenze) e per il bollino
// «in ferie» su task e membri di progetto: Nico è via da questo lunedì a venerdì
// della settimana prossima, così l'avviso si vede oggi.
const ASSENZE = [
  { id: 'to1', m: 'd-ecom', type: 'ferie', da: [0, 0], a: [1, 4], st: 'approved', c: 30,
    n: { it: 'Viaggio prenotato da mesi', en: 'Trip booked months ago', es: 'Viaje reservado hace meses', fr: 'Voyage réservé depuis des mois', de: 'Reise schon lange gebucht' } },
  { id: 'to2', m: 'd-design', type: 'ferie', da: [3, 0], a: [3, 4], st: 'pending', c: 2,
    n: { it: 'Matrimonio di mia sorella', en: 'My sister’s wedding', es: 'La boda de mi hermana', fr: 'Le mariage de ma sœur', de: 'Hochzeit meiner Schwester' } },
  { id: 'to3', m: 'd-adv', type: 'permesso', da: [0, 3], a: [0, 3], st: 'approved', c: 6,
    n: { it: 'Visita medica, rientro alle 14', en: 'Doctor’s appointment, back at 2pm', es: 'Cita médica, vuelvo a las 14:00', fr: 'Rendez-vous médical, retour à 14 h', de: 'Arzttermin, ab 14 Uhr zurück' } },
  { id: 'to4', m: 'd-cro', type: 'ferie', da: [2, 3], a: [2, 4], st: 'pending', c: 1,
    n: { it: 'Ponte lungo', en: 'Long weekend', es: 'Puente largo', fr: 'Long week-end', de: 'Brückentage' } },
  { id: 'to5', m: 'd-seo', type: 'malattia', da: [-1, 1], a: [-1, 2], st: 'approved', c: 9, n: null },
  { id: 'to6', m: 'd-owner', type: 'ferie', da: [5, 0], a: [5, 4], st: 'approved', c: 20,
    n: { it: 'Dopo i saldi', en: 'After the sale', es: 'Después de las rebajas', fr: 'Après les soldes', de: 'Nach dem Sale' } },
  { id: 'to7', m: 'd-adv', type: 'ferie', da: [-6, 0], a: [-5, 4], st: 'approved', c: 80,
    n: { it: 'Vacanze', en: 'Holiday', es: 'Vacaciones', fr: 'Vacances', de: 'Urlaub' } },
  { id: 'to8', m: 'd-cro', type: 'ferie', da: [-8, 0], a: [-7, 4], st: 'approved', c: 90,
    n: { it: 'Vacanze', en: 'Holiday', es: 'Vacaciones', fr: 'Vacances', de: 'Urlaub' } },
  { id: 'to9', m: 'd-seo', type: 'ferie', da: [-4, 0], a: [-4, 4], st: 'approved', c: 60, n: null },
  { id: 'to10', m: 'd-design', type: 'permesso', da: [1, 3], a: [1, 3], st: 'rejected', c: 4,
    n: { it: 'Trasloco', en: 'Moving house', es: 'Mudanza', fr: 'Déménagement', de: 'Umzug' } },
  { id: 'to11', m: 'd-ecom', type: 'permesso', da: [-3, 4], a: [-3, 4], st: 'approved', c: 25, n: null },
  { id: 'to12', m: 'd-design', type: 'ferie', da: [-10, 0], a: [-9, 4], st: 'approved', c: 100, n: null },
]
function demoTimeOff(l = linguaDemo()) {
  return ASSENZE.map(r => ({
    id: r.id, workspace_id: 'demo', member_id: r.m, member_name: nomeDi(r.m), type: r.type,
    start_date: quando(r.da), end_date: quando(r.a), status: r.st, note: tl(r.n, l),
    created_at: iso(Date.now() - r.c * DAY),
  }))
}

// ── Calendario ──────────────────────────────────────────────────────────────
// Promo, eventi e riunioni attorno a oggi (da un mese fa a sei settimane avanti),
// più le assenze qui sopra. Il weekly del lunedì dà ritmo alla griglia come in
// un calendario vero; due voci sono «da valutare» (bozze).
const WEEKLY = { it: 'Weekly marketing', en: 'Weekly marketing sync', es: 'Reunión semanal de marketing', fr: 'Point marketing hebdo', de: 'Wöchentliches Marketing-Meeting' }
const NEWSLETTER = { it: 'Invio newsletter', en: 'Newsletter send', es: 'Envío de la newsletter', fr: 'Envoi de la newsletter', de: 'Newsletter-Versand' }
const EVENTI = [
  ...[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(w => ({ id: `ev-weekly${w}`, kind: 'meeting', da: [w, 0], a: [w, 0], t: WEEKLY })),
  ...[-4, -2, 0, 2, 4].map(w => ({ id: `ev-nl${w}`, kind: 'evento', da: [w, 1], a: [w, 1], t: NEWSLETTER })),
  { id: 'ev-kpi', kind: 'meeting', da: [1, 2], a: [1, 2], t: { it: 'Revisione KPI del mese', en: 'Monthly KPI review', es: 'Revisión mensual de KPI', fr: 'Revue mensuelle des KPI', de: 'Monatlicher KPI-Review' } },
  { id: 'ev-kpi-prev', kind: 'meeting', da: [-3, 2], a: [-3, 2], t: { it: 'Revisione KPI del mese', en: 'Monthly KPI review', es: 'Revisión mensual de KPI', fr: 'Revue mensuelle des KPI', de: 'Monatlicher KPI-Review' } },
  { id: 'ev-fornitore', kind: 'meeting', da: [0, 2], a: [0, 2], t: { it: 'Call con il fornitore del packaging', en: 'Call with the packaging supplier', es: 'Llamada con el proveedor de packaging', fr: 'Appel avec le fournisseur d’emballages', de: 'Call mit dem Verpackungslieferanten' } },
  { id: 'ev-shoot', kind: 'evento', da: [0, 1], a: [0, 2], p: 'd-design', t: { it: 'Shooting nuova collezione', en: 'New collection photo shoot', es: 'Sesión de fotos nueva colección', fr: 'Shooting nouvelle collection', de: 'Shooting neue Kollektion' } },
  { id: 'ev-launch', kind: 'evento', da: [1, 3], a: [1, 3], t: { it: 'Lancio nuova collezione', en: 'New collection launch', es: 'Lanzamiento nueva colección', fr: 'Lancement nouvelle collection', de: 'Launch neue Kollektion' },
    n: { it: 'Pubblicazione alle 10. L’email ai VIP parte 48 ore prima.', en: 'Goes live at 10am. The VIP email goes out 48 hours before.', es: 'Publicación a las 10. El email a los VIP sale 48 horas antes.', fr: 'Mise en ligne à 10 h. L’e-mail aux VIP part 48 h avant.', de: 'Live um 10 Uhr. Die VIP-Mail geht 48 Stunden vorher raus.' } },
  { id: 'ev-live', kind: 'evento', da: [2, 2], a: [2, 2], p: 'd-seo', t: { it: 'Live Instagram con una creator', en: 'Instagram Live with a creator', es: 'Directo de Instagram con una creadora', fr: 'Live Instagram avec une créatrice', de: 'Instagram-Live mit einer Creatorin' } },
  { id: 'ev-fair', kind: 'evento', da: [4, 3], a: [4, 5], t: { it: 'Fiera di settore', en: 'Industry trade fair', es: 'Feria del sector', fr: 'Salon professionnel', de: 'Branchenmesse' } },
  { id: 'ev-saldi', kind: 'promo_b2c', da: [2, 4], a: [3, 6], t: { it: 'Saldi di metà stagione −20%', en: 'Mid-season sale −20%', es: 'Rebajas de mitad de temporada −20 %', fr: 'Soldes de mi-saison −20 %', de: 'Mid-Season-Sale −20 %' },
    n: { it: 'Selezione di 60 prodotti, spedizione gratuita sopra 49 €.', en: '60 selected products, free shipping over €49.', es: 'Selección de 60 productos, envío gratis a partir de 49 €.', fr: 'Sélection de 60 produits, livraison offerte dès 49 €.', de: 'Auswahl von 60 Produkten, kostenloser Versand ab 49 €.' } },
  { id: 'ev-ship', kind: 'promo_b2c', da: [0, 4], a: [0, 6], t: { it: 'Weekend spedizione gratuita', en: 'Free shipping weekend', es: 'Fin de semana de envío gratis', fr: 'Week-end livraison offerte', de: 'Versandkostenfreies Wochenende' } },
  { id: 'ev-flash', kind: 'promo_b2c', da: [-2, 5], a: [-2, 6], t: { it: 'Flash sale 48 ore', en: '48-hour flash sale', es: 'Flash sale de 48 horas', fr: 'Vente flash 48 h', de: '48-Stunden-Flash-Sale' } },
  { id: 'ev-bundle', kind: 'promo_b2c', da: [-1, 0], a: [-1, 2], t: { it: 'Bundle −15%', en: 'Bundle deal −15%', es: 'Packs −15 %', fr: 'Offre bundle −15 %', de: 'Bundle-Aktion −15 %' } },
  { id: 'ev-sellin', kind: 'promo_negozi', da: [0, 0], a: [1, 4], t: { it: 'Promo rivenditori: collezione in anteprima', en: 'Retailer promo: collection preview', es: 'Promo distribuidores: colección en preventa', fr: 'Promo revendeurs : collection en avant-première', de: 'Händler-Promo: Kollektion vorab' } },
  { id: 'ev-vetrine', kind: 'promo_negozi', da: [3, 0], a: [3, 6], t: { it: 'Vetrine nei negozi partner', en: 'Partner store window displays', es: 'Escaparates en tiendas asociadas', fr: 'Vitrines chez les magasins partenaires', de: 'Schaufenster bei Partnerhändlern' } },
  { id: 'ev-gift', kind: 'promo_b2c', da: [5, 0], a: [5, 6], draft: true, t: { it: 'Idea: settimana del regalo', en: 'Idea: gift week', es: 'Idea: semana del regalo', fr: 'Idée : semaine du cadeau', de: 'Idee: Geschenkwoche' } },
  { id: 'ev-popup', kind: 'evento', da: [6, 4], a: [6, 6], draft: true, t: { it: 'Pop-up store in centro', en: 'City-centre pop-up store', es: 'Pop-up store en el centro', fr: 'Pop-up store en centre-ville', de: 'Pop-up-Store in der Innenstadt' } },
]
function eventiCalendario(l) {
  return EVENTI.map(e => ({
    id: e.id, source: 'event', kind: e.kind, title: tl(e.t, l), person: e.p ? nomeDi(e.p) : null, memberId: e.p || null,
    start: quando(e.da), end: quando(e.a), status: e.draft ? 'draft' : 'confirmed', note: tl(e.n, l), color: null, canEdit: true,
  }))
}
function demoCalendar(search, l = linguaDemo()) {
  const from = search && search.get && search.get('from')
  const to = search && search.get && search.get('to')
  const assenze = demoTimeOff(l).map(r => ({
    id: r.id, source: 'time_off', kind: r.type, title: r.member_name, person: r.member_name, memberId: r.member_id,
    start: r.start_date, end: r.end_date, status: r.status === 'approved' ? 'confirmed' : (r.status === 'rejected' ? 'rejected' : 'draft'),
    note: r.note, canEdit: true,
  }))
  // Sovrapposizione col periodo richiesto, come la route vera.
  const entries = [...assenze, ...eventiCalendario(l)]
    .filter(e => (!from || e.end >= from) && (!to || e.start <= to))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
  return {
    entries, needsSetup: false,
    members: MEMBERS.map(m => ({ id: m.id, name: m.full_name })),
    me: { memberId: 'd-owner', name: 'Marco (Demo)', isAdmin: true, canWrite: true },
  }
}

// ── Lyftimer ────────────────────────────────────────────────────────────────
// Cinque settimane di ore vere per tutto il team: giorni feriali dalle 9, pausa
// pranzo, niente ore nei giorni di ferie/malattia, mezza giornata col permesso.
// Marco ha un timer acceso da 47 minuti, così il cronometro in alto corre.
// Ogni attività è [progetto, task, descrizione]; null = senza progetto.
const ATTIVITA = {
  'd-owner': [
    ['p-promo', 't12', { it: 'Piano sconti: margini per categoria', en: 'Discount plan: margins by category', es: 'Plan de descuentos: márgenes por categoría', fr: 'Plan de remises : marges par catégorie', de: 'Rabattplan: Margen pro Kategorie' }],
    ['p-ads', 't11', { it: 'Lettura di MER e CAC della settimana', en: 'Reviewing this week’s MER and CAC', es: 'Revisión del MER y el CAC de la semana', fr: 'Lecture du MER et du CAC de la semaine', de: 'MER und CAC der Woche durchgehen' }],
    ['p-launch', 't4', { it: 'Revisione copy email di lancio', en: 'Reviewing the launch email copy', es: 'Revisión del copy del email de lanzamiento', fr: 'Relecture du texte de l’e-mail de lancement', de: 'Launch-Mail-Texte prüfen' }],
    [null, null, { it: 'Call con il fornitore del packaging', en: 'Call with the packaging supplier', es: 'Llamada con el proveedor de packaging', fr: 'Appel avec le fournisseur d’emballages', de: 'Call mit dem Verpackungslieferanten' }],
  ],
  'd-cro': [
    ['p-launch', 't3', { it: 'Landing di lancio: versione mobile', en: 'Launch landing page: mobile version', es: 'Landing de lanzamiento: versión móvil', fr: 'Landing de lancement : version mobile', de: 'Launch-Landingpage: Mobile-Version' }],
    ['p-cro', 't27', { it: 'Analisi del test A/B sul pulsante acquista', en: 'Analysing the buy-button A/B test', es: 'Análisis del test A/B del botón de compra', fr: 'Analyse du test A/B du bouton d’achat', de: 'Auswertung A/B-Test Kaufen-Button' }],
    ['p-seo', 't22', { it: 'Redirect delle pagine 404', en: 'Redirects for 404 pages', es: 'Redirecciones de las páginas 404', fr: 'Redirections des pages 404', de: 'Weiterleitungen für 404-Seiten' }],
    ['p-email', 't18', { it: 'Segmento clienti inattivi', en: 'Inactive customers segment', es: 'Segmento de clientes inactivos', fr: 'Segment clients inactifs', de: 'Segment inaktive Kunden' }],
  ],
  'd-adv': [
    ['p-ads', 't7', { it: 'Brief e montaggio UGC', en: 'UGC brief and editing', es: 'Brief y montaje de UGC', fr: 'Brief et montage UGC', de: 'UGC-Briefing und Schnitt' }],
    ['p-ads', 't9', { it: 'Setup del test Advantage+', en: 'Setting up the Advantage+ test', es: 'Configuración del test Advantage+', fr: 'Mise en place du test Advantage+', de: 'Advantage+-Test aufsetzen' }],
    ['p-launch', 't5', { it: 'Budget e calendario campagne di lancio', en: 'Launch campaign budget and schedule', es: 'Presupuesto y calendario de campañas de lanzamiento', fr: 'Budget et calendrier des campagnes de lancement', de: 'Budget und Zeitplan der Launch-Kampagnen' }],
    ['p-ads', null, { it: 'Ottimizzazione adset e offerte', en: 'Ad set and bid optimisation', es: 'Optimización de conjuntos de anuncios y pujas', fr: 'Optimisation des ensembles de publicités et des enchères', de: 'Anzeigengruppen und Gebote optimieren' }],
  ],
  'd-seo': [
    ['p-seo', 't21', { it: 'Scrittura della guida alle taglie', en: 'Writing the size guide', es: 'Redacción de la guía de tallas', fr: 'Rédaction du guide des tailles', de: 'Größenratgeber schreiben' }],
    ['p-email', 't20', { it: 'Welcome flow: testi e immagini', en: 'Welcome flow: copy and images', es: 'Flujo de bienvenida: textos e imágenes', fr: 'Scénario de bienvenue : textes et visuels', de: 'Welcome-Flow: Texte und Bilder' }],
    ['p-launch', 't2', { it: 'Schede prodotto della nuova collezione', en: 'New collection product pages', es: 'Fichas de producto de la nueva colección', fr: 'Fiches produit de la nouvelle collection', de: 'Produktseiten der neuen Kollektion' }],
    ['p-email', 't17', { it: 'Terza email del carrello abbandonato', en: 'Third abandoned-cart email', es: 'Tercera email de carrito abandonado', fr: 'Troisième e-mail de panier abandonné', de: 'Dritte Warenkorbabbruch-Mail' }],
  ],
  'd-ecom': [
    ['p-launch', 't6', { it: 'Conteggio stock e riassortimenti', en: 'Stock count and restock orders', es: 'Recuento de stock y reposiciones', fr: 'Inventaire et réassorts', de: 'Bestandszählung und Nachbestellungen' }],
    ['p-promo', 't14', { it: 'Codici sconto e regole di spedizione', en: 'Discount codes and shipping rules', es: 'Códigos de descuento y reglas de envío', fr: 'Codes promo et règles de livraison', de: 'Rabattcodes und Versandregeln' }],
    ['p-cro', 't26', { it: 'Configurazione dei pagamenti rapidi', en: 'Express payments setup', es: 'Configuración de los pagos exprés', fr: 'Configuration des paiements express', de: 'Express-Zahlungen einrichten' }],
  ],
  'd-design': [
    ['p-launch', 't1', { it: 'Shooting: selezione e ritocco foto', en: 'Photo shoot: selection and retouching', es: 'Sesión de fotos: selección y retoque', fr: 'Shooting : sélection et retouche', de: 'Shooting: Auswahl und Retusche' }],
    ['p-promo', 't15', { it: 'Statiche −20% nei tre formati', en: '−20% statics in all three formats', es: 'Estáticos −20 % en los tres formatos', fr: 'Visuels −20 % dans les trois formats', de: '−20-%-Statics in allen drei Formaten' }],
    ['p-promo', 't13', { it: 'Banner home e barra promo', en: 'Homepage banner and promo bar', es: 'Banner de la home y barra promocional', fr: 'Bannière d’accueil et barre promo', de: 'Startseiten-Banner und Promo-Leiste' }],
    ['p-ads', null, { it: 'Adattamento delle creative per le stories', en: 'Adapting creatives for Stories', es: 'Adaptación de creatividades para stories', fr: 'Déclinaison des créas pour les stories', de: 'Creatives für Stories anpassen' }],
  ],
}
const TIMER_ACCESO_MIN = 47

function tutteLeOre(l) {
  const ora = Date.now()
  const progetti = demoProjects(l)
  const prog = id => progetti.find(p => p.id === id) || null
  const assenze = demoTimeOff(l).filter(r => r.status === 'approved')
  const inizioTimer = ora - TIMER_ACCESO_MIN * 60000
  const out = []
  MEMBERS.forEach((m, mi) => {
    const att = ATTIVITA[m.id] || []
    for (let d = 34; d >= 0; d--) {
      const giorno = new Date(); giorno.setHours(0, 0, 0, 0); giorno.setDate(giorno.getDate() - d)
      if (giorno.getDay() === 0 || giorno.getDay() === 6) continue
      const g = ymdLocale(giorno)
      const via = assenze.find(r => r.member_id === m.id && r.start_date <= g && r.end_date >= g)
      if (via && via.type !== 'permesso') continue
      const n = via ? 1 : 2 + ((mi * 7 + d * 3) % 3)
      let t = new Date(giorno); t.setHours(9, (mi * 7 + d * 11) % 25, 0, 0)
      let pranzo = false
      const limite = d === 0 ? (m.id === 'd-owner' ? inizioTimer - 5 * 60000 : ora) : Infinity
      for (let k = 0; k < n; k++) {
        if (t.getHours() >= 18) break
        const ore = 1.3 + (((mi + 3) * (d + 5) * (k + 2)) % 17) / 17 * 1.7
        const start = t.getTime()
        const end = start + Math.round(ore * 3600) * 1000
        if (end > limite) break
        // Solo progetti aperti quel giorno: niente ore sui saldi prima che partano,
        // né sul checkout dopo che è stato chiuso (il Budget lo noterebbe).
        const aperte = att.filter(([id]) => { const x = id ? prog(id) : null; return !x || ((!x.start_date || x.start_date <= g) && (!x.end_date || x.end_date >= g)) })
        const scelta = aperte.length ? aperte : att
        const [pid, tid, desc] = scelta[(d + k + mi) % scelta.length]
        const p = pid ? prog(pid) : null
        const sec = Math.round((end - start) / 1000)
        out.push({
          id: `te-${mi}-${d}-${k}`, workspace_id: 'demo', member_id: m.id, member_name: m.full_name, member_avatar: null,
          project_id: pid, task_id: tid, task_name: null, task_title: tid ? titoloTask(tid, l) : '',
          description: tl(desc, l), started_at: iso(start), ended_at: iso(end), duration_seconds: sec,
          billable: !!pid, rate: m.hourly_rate, cost: r2(sec / 3600 * m.hourly_rate),
          project_name: p ? p.name : '', project_color: p ? p.color : null,
        })
        // Pausa pranzo dopo la prima voce che arriva a mezzogiorno, altrimenti un caffè.
        const fine = new Date(end)
        const pausa = !pranzo && fine.getHours() >= 12 ? (pranzo = true, 60) : 10
        t = new Date(end + pausa * 60000)
      }
    }
  })
  return out
}

function demoTimeEntries(search, l = linguaDemo()) {
  const q = k => (search && search.get && search.get(k)) || null
  const scope = q('scope') || 'me'
  const period = q('period') || 'week'
  const fromP = q('from'), toP = q('to')
  const mio = e => scope !== 'me' || e.member_id === 'd-owner'
  const tutte = tutteLeOre(l)
  // Stessi filtri della route vera: intervallo esplicito (report, presenze) oppure periodo.
  let da = null
  if (fromP) da = new Date(fromP)
  else if (period === 'today') { da = new Date(); da.setHours(0, 0, 0, 0) }
  else if (period === 'week') da = lunediDi(0)
  const a = toP ? new Date(toP) : null
  const entries = tutte
    .filter(mio)
    .filter(e => (!da || new Date(e.started_at) >= da) && (!a || new Date(e.started_at) <= a))
    .sort((x, y) => (x.started_at < y.started_at ? 1 : -1))

  const p = demoProjects(l).find(x => x.id === 'p-launch')
  const desc = ATTIVITA['d-owner'][2]
  const running = {
    id: 'te-running', workspace_id: 'demo', member_id: 'd-owner', member_name: 'Marco (Demo)', project_id: 'p-launch',
    task_id: 't4', task_name: null, task_title: titoloTask('t4', l), description: tl(desc[2], l),
    started_at: iso(Date.now() - TIMER_ACCESO_MIN * 60000), ended_at: null, duration_seconds: null, billable: true,
    project_name: p.name, project_color: p.color,
  }

  // Riepilogo ultimi 7 giorni (card e sparkline), calcolato come la route vera.
  const giorni = []
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0); giorni.push({ key: d.toDateString(), label: d.toLocaleDateString(INTL_DEMO[l] || 'it-IT', { weekday: 'short' }), sec: 0 }) }
  const idx = {}; giorni.forEach((g, i) => { idx[g.key] = i })
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
  const lun = lunediDi(0)
  let todaySec = 0, weekSec = 0, total7 = 0
  const perMembro = {}, perProgetto = {}
  const dal7 = new Date(); dal7.setDate(dal7.getDate() - 6); dal7.setHours(0, 0, 0, 0)
  for (const e of tutte.filter(mio)) {
    const dt = new Date(e.started_at)
    if (dt < dal7) continue
    const sec = e.duration_seconds || 0, dk = dt.toDateString()
    if (idx[dk] !== undefined) giorni[idx[dk]].sec += sec
    total7 += sec
    if (dk === oggi.toDateString()) todaySec += sec
    if (dt >= lun) weekSec += sec
    const mm = perMembro[e.member_id] || (perMembro[e.member_id] = { name: e.member_name, avatar: null, todaySec: 0, weekSec: 0 })
    if (dk === oggi.toDateString()) mm.todaySec += sec
    if (dt >= lun) mm.weekSec += sec
    const pk = e.project_id || '__none'
    const pp = perProgetto[pk] || (perProgetto[pk] = { name: e.project_id ? e.project_name : tl({ it: 'Senza progetto', en: 'No project', es: 'Sin proyecto', fr: 'Sans projet', de: 'Ohne Projekt' }, l), color: e.project_color, sec: 0 })
    pp.sec += sec
  }
  const summary = {
    spark: giorni.map(g => g.sec), days: giorni.map(g => ({ label: g.label, sec: g.sec })),
    todaySec, weekSec, total7,
    members: Object.values(perMembro).sort((x, y) => y.weekSec - x.weekSec),
    projects: Object.values(perProgetto).sort((x, y) => y.sec - x.sec),
  }
  return { entries, running, summary, me: { memberId: 'd-owner', name: 'Marco (Demo)', avatar: null, isAdmin: true } }
}

// Approvazione ore: le settimane passate sono approvate (una respinta e poi
// corretta non serve: la demo mostra lo stato normale), quella in corso è a metà.
function demoTimeApprovals(search) {
  const week = (search && search.get && search.get('week')) || ymdLocale(lunediDi(0))
  const corrente = ymdLocale(lunediDi(0))
  const approvati = week < corrente ? MEMBERS.map(m => m.id) : (week === corrente ? ['d-cro', 'd-seo'] : [])
  return {
    approvals: approvati.map(mid => ({ member_id: mid, week_start: week, status: 'approved', approved_at: iso(Date.now() - DAY) })),
    me: { isAdmin: true, memberId: 'd-owner' },
  }
}

// ── Squadra AI ──────────────────────────────────────────────────────────────
// Stessi nomi, ruoli, colori ed emoji di lib/agent/team.js. Le foto vere degli
// agenti stanno su un sito esterno: nella demo ogni agente ha un avatar SVG in
// linea (iniziale su fondo del suo colore), niente rete.
const SQUADRA = [
  { id: 'ceo', name: 'Chiara', role: 'CEO', gender: 'f', color: '#7c5cff', emoji: '👑', tagline: { it: 'Visione, priorità, decisioni', en: 'Vision, priorities, decisions', es: 'Visión, prioridades, decisiones', fr: 'Vision, priorités, décisions', de: 'Vision, Prioritäten, Entscheidungen' } },
  { id: 'cfo', name: 'Marco', role: 'CFO', gender: 'm', color: '#30d158', emoji: '📊', tagline: { it: 'P&L, margini, cassa, budget', en: 'P&L, margins, cash, budget', es: 'P&L, márgenes, caja, presupuesto', fr: 'P&L, marges, trésorerie, budget', de: 'GuV, Margen, Cash, Budget' } },
  { id: 'cmo', name: 'Luigi', role: 'CMO', gender: 'm', color: '#2997ff', emoji: '🎯', tagline: { it: 'Strategia marketing, brand, canali', en: 'Marketing strategy, brand, channels', es: 'Estrategia de marketing, marca, canales', fr: 'Stratégie marketing, marque, canaux', de: 'Marketingstrategie, Marke, Kanäle' } },
  { id: 'ads', name: 'Sofia', role: 'Advertising Specialist', gender: 'f', color: '#ff453a', emoji: '🚀', tagline: { it: 'Meta/Google/TikTok, ROAS, scaling', en: 'Meta/Google/TikTok, ROAS, scaling', es: 'Meta/Google/TikTok, ROAS, escalado', fr: 'Meta/Google/TikTok, ROAS, scaling', de: 'Meta/Google/TikTok, ROAS, Skalierung' } },
  { id: 'seo', name: 'Davide', role: 'SEO Specialist', gender: 'm', color: '#ffd60a', emoji: '🔍', tagline: { it: 'Organico, SEO tecnica, contenuti', en: 'Organic, technical SEO, content', es: 'Orgánico, SEO técnico, contenidos', fr: 'Organique, SEO technique, contenus', de: 'Organisch, technisches SEO, Content' } },
  { id: 'cro', name: 'Giulia', role: 'CRO Specialist', gender: 'f', color: '#bf5af2', emoji: '🧪', tagline: { it: 'Conversione, landing, A/B test', en: 'Conversion, landing pages, A/B tests', es: 'Conversión, landings, tests A/B', fr: 'Conversion, landing pages, tests A/B', de: 'Conversion, Landingpages, A/B-Tests' } },
  { id: 'data', name: 'Alessandro', role: 'Data Analyst', gender: 'm', color: '#64d2ff', emoji: '📈', tagline: { it: 'Metriche, coorti, attribuzione, anomalie', en: 'Metrics, cohorts, attribution, anomalies', es: 'Métricas, cohortes, atribución, anomalías', fr: 'Métriques, cohortes, attribution, anomalies', de: 'Kennzahlen, Kohorten, Attribution, Anomalien' } },
  { id: 'creative', name: 'Valentina', role: 'Creative Strategist', gender: 'f', color: '#ff9f0a', emoji: '🎨', tagline: { it: 'Angoli, hook, UGC, ad creative', en: 'Angles, hooks, UGC, ad creative', es: 'Ángulos, hooks, UGC, creatividades', fr: 'Angles, hooks, UGC, créas publicitaires', de: 'Angles, Hooks, UGC, Ad-Creatives' } },
]
function avatarAgente(colore, nome) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><defs><linearGradient id='a' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${colore}'/><stop offset='1' stop-color='#1c1c28'/></linearGradient></defs><circle cx='48' cy='48' r='48' fill='url(#a)'/><text x='48' y='62' font-family='Arial,Helvetica,sans-serif' font-size='40' font-weight='700' fill='#ffffff' text-anchor='middle'>${nome.slice(0, 1)}</text></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}
const tagAgente = a => `${a.name} · ${a.role}`
function demoTeamRoster(l = linguaDemo()) {
  return SQUADRA.map(a => ({
    id: a.id, name: a.name, role: a.role, gender: a.gender, color: a.color, emoji: a.emoji,
    tagline: tl(a.tagline, l), avatar: avatarAgente(a.color, a.name), voiceId: null, tag: tagAgente(a),
  }))
}
// Risposta dell'agente nella chat 1:1: l'intercettore non vede il corpo della
// richiesta (né l'agente né la domanda), quindi è una lettura dei numeri della
// demo che sta in bocca a chiunque della squadra.
const RISPOSTA_AGENTE = {
  it: 'Ho guardato gli ultimi 30 giorni: fatturato **+18%**, MER **3,5** e CAC in calo del 6%. Il retargeting Meta è il canale che rende di più (ROAS 4,3): lì c’è spazio per spingere. Da sistemare invece tre creative con frequenza sopra 5 e la taglia M della felpa, che finisce prima del riassortimento. Se vuoi, preparo il piano per la settimana di lancio.',
  en: 'I looked at the last 30 days: revenue **+18%**, MER **3.5**, CAC down 6%. Meta retargeting is your best performer (ROAS 4.3), so there’s room to push there. What needs fixing: three creatives with frequency above 5, and size M of the hoodie, which sells out before the restock arrives. Want me to draft the plan for launch week?',
  es: 'He revisado los últimos 30 días: facturación **+18 %**, MER **3,5** y CAC un 6 % más bajo. El retargeting de Meta es el canal que mejor rinde (ROAS 4,3): ahí hay margen para empujar. Hay que arreglar tres creatividades con frecuencia por encima de 5 y la talla M de la sudadera, que se agota antes de la reposición. ¿Te preparo el plan para la semana de lanzamiento?',
  fr: 'J’ai regardé les 30 derniers jours : CA **+18 %**, MER **3,5** et CAC en baisse de 6 %. Le retargeting Meta est le canal le plus rentable (ROAS 4,3) : il y a de la marge pour pousser. À corriger : trois créas avec une fréquence au-dessus de 5, et la taille M du sweat, qui sera épuisée avant le réassort. Tu veux que je prépare le plan de la semaine de lancement ?',
  de: 'Ich habe mir die letzten 30 Tage angesehen: Umsatz **+18 %**, MER **3,5**, CAC 6 % niedriger. Meta-Retargeting ist dein stärkster Kanal (ROAS 4,3), da ist noch Luft nach oben. Angehen sollten wir drei Creatives mit Frequenz über 5 und Größe M vom Hoodie, die vor dem Nachschub ausverkauft ist. Soll ich den Plan für die Launch-Woche vorbereiten?',
}

// ── Immagini finte (SVG in linea, nessuna rete) ─────────────────────────────
// Un annuncio vero ha marchio, titolo, sottotitolo e bottone: con il solo
// gradiente di gradImg le schede delle creatività sembravano segnaposto. Stessa
// tecnica, nelle proporzioni del formato; il titolo sta al centro perché la
// miniatura ritaglia il verticale in una fascia orizzontale.
const escSvg = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function adImg(a, b, titolo, sotto, cta, w, h) {
  const m = Math.min(w, h)
  const fsT = Math.round(Math.min(m * 0.15, (w * 0.84) / Math.max(1, String(titolo).length * 0.58)))
  const fsS = Math.round(Math.min(m * 0.058, (w * 0.84) / Math.max(1, String(sotto || '').length * 0.52)))
  const fsC = Math.round(m * 0.048), fsB = Math.round(m * 0.05)
  const pillW = Math.round(String(cta).length * fsC * 0.62 + fsC * 2.4), pillH = Math.round(fsC * 2.3)
  // Marchio, titolo, sottotitolo e bottone stanno in un blocco unico al centro:
  // la scheda mostra ogni formato ritagliato (148 px di altezza), e un bottone
  // in fondo o un marchio nell'angolo uscivano a metà dal ritaglio.
  const yT = Math.round(h / 2 + fsT * 0.35)
  const yB = Math.round(yT - fsT - fsB * 0.4)
  const yS = Math.round(yT + fsS * 1.7)
  const yP = Math.round(sotto ? yS + fsS * 0.9 : yT + fsT * 0.5)
  const testo = (x, y, fs, peso, extra, t) => `<text x='${x}' y='${y}' font-family='Arial,Helvetica,sans-serif' font-size='${fs}' font-weight='${peso}' text-anchor='middle' ${extra}>${escSvg(t)}</text>`
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>`
    + `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient>`
    + `<radialGradient id='r' cx='.78' cy='.22' r='.7'><stop offset='0' stop-color='#fff' stop-opacity='.34'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></radialGradient></defs>`
    + `<rect width='${w}' height='${h}' fill='url(#g)'/><rect width='${w}' height='${h}' fill='url(#r)'/>`
    + `<circle cx='${Math.round(w * 0.84)}' cy='${Math.round(h * 0.86)}' r='${Math.round(m * 0.34)}' fill='#fff' fill-opacity='.11'/>`
    + `<circle cx='${Math.round(w * 0.1)}' cy='${Math.round(h * 0.95)}' r='${Math.round(m * 0.18)}' fill='#000' fill-opacity='.08'/>`
    + testo(w / 2, yB, fsB, 700, `letter-spacing='4' fill='#fff' fill-opacity='.85'`, 'ACME')
    + testo(w / 2, yT, fsT, 800, `fill='#fff'`, titolo)
    + (sotto ? testo(w / 2, yS, fsS, 600, `fill='#fff' fill-opacity='.9'`, sotto) : '')
    + `<rect x='${Math.round(w / 2 - pillW / 2)}' y='${yP}' width='${pillW}' height='${pillH}' rx='${Math.round(pillH / 2)}' fill='#fff'/>`
    + testo(w / 2, Math.round(yP + pillH / 2 + fsC * 0.36), fsC, 700, `fill='${a}'`, cta)
    + `</svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}
// Moodboard dello shooting: sei riquadri di toni neutri, come una tavola vera.
function moodboardImg() {
  const toni = ['#d9d2c5', '#b8ab98', '#8c8479', '#e9e4dc', '#5f5a53', '#c9bfb1']
  const tile = toni.map((c, i) => `<rect x='${12 + (i % 3) * 156}' y='${12 + Math.floor(i / 3) * 154}' width='148' height='146' rx='10' fill='${c}'/>`).join('')
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='320' viewBox='0 0 480 320'><rect width='480' height='320' rx='14' fill='#f4f1ec'/>${tile}<circle cx='86' cy='86' r='34' fill='#fff' fill-opacity='.35'/><rect x='330' y='210' width='80' height='80' rx='40' fill='#fff' fill-opacity='.25'/></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}
const CTA_AD = { it: 'Scopri ora', en: 'Shop now', es: 'Comprar ahora', fr: 'Découvrir', de: 'Jetzt shoppen' }

// ── LyftTalk ────────────────────────────────────────────────────────────────
// Canali con i nomi nella lingua della demo; #generale è il primo e quindi quello
// che si apre: è il più ricco (persone e agenti, menzioni, reazioni, due thread,
// un messaggio fissato, un'immagine). I messaggi di oggi sono minuti prima di
// un'ancora fissata al primo uso (il poll ogni 5 secondi ritrova gli stessi
// messaggi con gli stessi orari, invece di vederli «nuovi» a ogni giro); quelli
// dei giorni prima cadono in giorni LAVORATIVI a orari d'ufficio: un
// «buongiorno» alle 13 di domenica non lo scrive nessuno.
const CANALI = [
  { id: 'c-gen', name: { it: 'generale', en: 'general', es: 'general', fr: 'general', de: 'allgemein' } },
  { id: 'c-mkt', name: 'marketing' },
  { id: 'c-ads', name: 'ads' },
  { id: 'c-launch', name: { it: 'lancio-collezione', en: 'collection-launch', es: 'lanzamiento-coleccion', fr: 'lancement-collection', de: 'kollektion-launch' }, privato: true, progetto: 'p-launch', membri: ['d-owner', 'd-cro', 'd-design', 'd-seo', 'd-ecom', 'd-adv'] },
  { id: 'c-seo', name: { it: 'seo-contenuti', en: 'seo-content', es: 'seo-contenidos', fr: 'seo-contenus', de: 'seo-content' } },
  { id: 'c-stock', name: { it: 'magazzino', en: 'inventory', es: 'almacen', fr: 'stocks', de: 'lager' } },
  { id: 'dm_d-owner_d-cro', dm: true, membri: ['d-owner', 'd-cro'] },
  { id: 'dm_d-owner_d-adv', dm: true, membri: ['d-owner', 'd-adv'] },
]
// Canali con attività nuova (pallino e contatore «Non letti»): nella demo lo
// stato di lettura non si salva, quindi si segnano solo quelli che devono esserlo.
const CANALI_NON_LETTI = ['c-ads', 'c-launch', 'dm_d-owner_d-adv']
let _ancoraChat = 0
const ancoraChat = () => _ancoraChat || (_ancoraChat = Date.now())
// t: minuti prima dell'ancora; [n, ora, minuti] = n giorni lavorativi fa a
// quell'ora; [0, ora, minuti] = lo scorso venerdì (i messaggi di Nico, che da
// lunedì è in ferie).
function istanteChat(t) {
  if (typeof t === 'number') return ancoraChat() - t * 60000
  const [n, h, min] = t
  const d = new Date(ancoraChat())
  if (n === 0) { const v = lunediDi(0); v.setDate(v.getDate() - 3); d.setTime(v.getTime()) }
  else for (let k = 0; k < n;) { d.setDate(d.getDate() - 1); if (d.getDay() !== 0 && d.getDay() !== 6) k++ }
  d.setHours(h, min || 0, 0, 0)
  return d.getTime()
}
const agente = id => SQUADRA.find(a => a.id === id)
// da: id di un membro oppure 'ag:<agente>'. radice: id del messaggio a cui risponde nel thread.
const MESSAGGI = [
  // #generale
  { id: 'g0', ch: 'c-gen', da: 'd-ecom', t: [0, 16, 10], r: { '👀': ['d-owner'], '🙏': ['d-adv'] },
    b: { it: '@Marco le taglie M e L della felpa coprono meno di due settimane di vendite. Ho già chiesto il riassortimento al fornitore.', en: '@Marco sizes M and L of the hoodie cover less than two weeks of sales. I’ve already asked the supplier to restock.', es: '@Marco las tallas M y L de la sudadera cubren menos de dos semanas de ventas. Ya he pedido la reposición al proveedor.', fr: '@Marco les tailles M et L du sweat couvrent moins de deux semaines de ventes. J’ai déjà demandé un réassort au fournisseur.', de: '@Marco Die Größen M und L vom Hoodie reichen für weniger als zwei Wochen. Die Nachbestellung beim Lieferanten läuft schon.' } },
  { id: 'g1', ch: 'c-gen', da: 'd-owner', t: [1, 9, 12], fissato: true, r: { '👍': ['d-cro', 'd-adv', 'd-seo'], '🔥': ['d-design'] },
    b: { it: 'Buongiorno a tutti ☀️ Settimane piene: **arriva il lancio della nuova collezione** e subito dopo partono i saldi di metà stagione. Date, task e scadenze sono nel progetto «Lancio nuova collezione».', en: 'Morning all ☀️ Busy weeks ahead: **the new collection launch is coming up**, and the mid-season sale starts right after. Dates, tasks and deadlines are in the “New collection launch” project.', es: '¡Buenos días a todos! ☀️ Semanas intensas: **se acerca el lanzamiento de la nueva colección** y justo después empiezan las rebajas de mitad de temporada. Fechas, tareas y plazos están en el proyecto «Lanzamiento nueva colección».', fr: 'Bonjour à tous ☀️ Des semaines chargées : **le lancement de la nouvelle collection approche**, et les soldes de mi-saison démarrent juste après. Dates, tâches et échéances sont dans le projet « Lancement nouvelle collection ».', de: 'Guten Morgen zusammen ☀️ Volle Wochen: **Der Launch der neuen Kollektion steht an**, direkt danach startet der Mid-Season-Sale. Termine, Aufgaben und Deadlines stehen im Projekt „Launch neue Kollektion“.' } },
  { id: 'g2', ch: 'c-gen', da: 'd-cro', t: [1, 9, 26], r: { '✅': ['d-owner'] },
    b: { it: 'La landing di lancio è quasi pronta: manca solo il blocco recensioni. Stasera la metto in revisione.', en: 'The launch landing page is almost ready, just the reviews block left. I’ll put it up for review tonight.', es: 'La landing de lanzamiento está casi lista: solo falta el bloque de reseñas. Esta tarde la paso a revisión.', fr: 'La landing de lancement est presque prête : il ne manque que le bloc d’avis. Je la passe en revue ce soir.', de: 'Die Launch-Landingpage ist fast fertig, nur der Bewertungsblock fehlt noch. Heute Abend geht sie in den Review.' } },
  { id: 'g3', ch: 'c-gen', da: 'ag:ceo', t: [1, 9, 31], r: { '🙌': ['d-owner', 'd-adv'] },
    b: { it: 'Ho guardato gli ultimi 30 giorni: fatturato **+18%**, MER **3,5** e CAC in calo del 6%. Per il lancio le priorità sono tre:\n1. budget sui due adset che convertono meglio\n2. email ai clienti VIP 48 ore prima\n3. scorte sotto controllo sulle taglie più vendute', en: 'I went through the last 30 days: revenue **+18%**, MER **3.5**, CAC down 6%. For the launch, three priorities:\n1. budget on the two best-converting ad sets\n2. VIP email 48 hours before\n3. stock under control on the best-selling sizes', es: 'He revisado los últimos 30 días: facturación **+18 %**, MER **3,5** y CAC un 6 % más bajo. Para el lanzamiento hay tres prioridades:\n1. presupuesto en los dos conjuntos de anuncios que mejor convierten\n2. email a los clientes VIP 48 horas antes\n3. stock controlado en las tallas más vendidas', fr: 'J’ai regardé les 30 derniers jours : CA **+18 %**, MER **3,5** et CAC en baisse de 6 %. Pour le lancement, trois priorités :\n1. le budget sur les deux ensembles de publicités qui convertissent le mieux\n2. l’e-mail aux clients VIP 48 h avant\n3. le stock sous contrôle sur les tailles les plus vendues', de: 'Ich habe mir die letzten 30 Tage angesehen: Umsatz **+18 %**, MER **3,5**, CAC 6 % niedriger. Für den Launch gibt es drei Prioritäten:\n1. Budget auf die zwei Anzeigengruppen mit der besten Conversion\n2. VIP-Mail 48 Stunden vorher\n3. Bestand bei den meistverkauften Größen im Blick behalten' } },
  { id: 'g3a', ch: 'c-gen', radice: 'g3', da: 'd-adv', t: [1, 9, 44],
    b: { it: 'D’accordo sul punto 1: sposto il 20% dal pubblico ampio al retargeting a 7 giorni.', en: 'Agree on point 1: I’ll move 20% from broad to 7-day retargeting.', es: 'De acuerdo con el punto 1: muevo el 20 % del público amplio al retargeting de 7 días.', fr: 'D’accord sur le point 1 : je déplace 20 % de l’audience large vers le retargeting 7 jours.', de: 'Einverstanden mit Punkt 1: Ich verschiebe 20 % von der breiten Zielgruppe ins 7-Tage-Retargeting.' } },
  { id: 'g3b', ch: 'c-gen', radice: 'g3', da: 'ag:ads', t: [1, 9, 45],
    b: { it: 'Ottimo. Tieni d’occhio la frequenza: sopra 4 le creative si stancano in fretta e il CPA sale.', en: 'Good call. Keep an eye on frequency: above 4, creatives wear out fast and CPA climbs.', es: 'Bien. Vigila la frecuencia: por encima de 4 las creatividades se desgastan rápido y el CPA sube.', fr: 'Très bien. Surveille la fréquence : au-delà de 4, les créas s’usent vite et le CPA grimpe.', de: 'Gut. Behalte die Frequenz im Auge: Über 4 nutzen sich Creatives schnell ab und der CPA steigt.' } },
  { id: 'g3c', ch: 'c-gen', radice: 'g3', da: 'd-owner', t: [1, 10, 2],
    b: { it: 'Perfetto, procediamo così 👍', en: 'Perfect, let’s go with that 👍', es: 'Perfecto, adelante 👍', fr: 'Parfait, on part là-dessus 👍', de: 'Perfekt, so machen wir’s 👍' } },
  { id: 'g4', ch: 'c-gen', da: 'd-adv', t: 190, r: { '🚀': ['d-owner', 'd-cro'] },
    b: { it: 'Numeri di ieri: ROAS Meta **4,1** sul retargeting, CPM stabile. Le nuove UGC partono oggi a mezzogiorno.', en: 'Yesterday’s numbers: Meta ROAS **4.1** on retargeting, CPM stable. The new UGC ads go live today at noon.', es: 'Números de ayer: ROAS de Meta **4,1** en retargeting, CPM estable. Los nuevos UGC salen hoy a mediodía.', fr: 'Chiffres d’hier : ROAS Meta **4,1** sur le retargeting, CPM stable. Les nouvelles UGC partent aujourd’hui à midi.', de: 'Zahlen von gestern: Meta-ROAS **4,1** im Retargeting, CPM stabil. Die neuen UGC-Ads gehen heute Mittag live.' } },
  { id: 'g5', ch: 'c-gen', da: 'd-design', t: 150, r: { '❤️': ['d-cro', 'd-seo'] }, file: 'banner',
    b: { it: 'Ecco la prima bozza del banner per i saldi 👇', en: 'Here’s the first draft of the sale banner 👇', es: 'Aquí va el primer borrador del banner de las rebajas 👇', fr: 'Voici le premier jet de la bannière des soldes 👇', de: 'Hier der erste Entwurf fürs Sale-Banner 👇' } },
  { id: 'g5a', ch: 'c-gen', radice: 'g5', da: 'd-cro', t: 145,
    b: { it: 'Su mobile il bottone lo farei più grande.', en: 'On mobile I’d make the button bigger.', es: 'En móvil haría el botón más grande.', fr: 'Sur mobile, je ferais le bouton plus grand.', de: 'Auf dem Handy würde ich den Button größer machen.' } },
  { id: 'g5b', ch: 'c-gen', radice: 'g5', da: 'd-design', t: 130,
    b: { it: 'Fatto, la v2 è nella task del banner.', en: 'Done, v2 is in the banner task.', es: 'Hecho, la v2 está en la tarea del banner.', fr: 'C’est fait, la v2 est dans la tâche de la bannière.', de: 'Erledigt, v2 liegt in der Banner-Aufgabe.' } },
  { id: 'g6', ch: 'c-gen', da: 'd-seo', t: 110,
    b: { it: '@Davide mi prepari le 5 query con più impression e CTR sotto il 2%? Ci riscrivo le meta description.', en: '@Davide can you pull the 5 queries with the most impressions and a CTR under 2%? I’ll rewrite their meta descriptions.', es: '@Davide ¿me preparas las 5 búsquedas con más impresiones y un CTR por debajo del 2 %? Les reescribo las meta descriptions.', fr: '@Davide tu peux me sortir les 5 requêtes avec le plus d’impressions et un CTR sous 2 % ? Je réécris leurs meta descriptions.', de: '@Davide Kannst du mir die 5 Suchanfragen mit den meisten Impressionen und einer CTR unter 2 % ziehen? Ich schreibe die Meta-Descriptions neu.' } },
  { id: 'g7', ch: 'c-gen', da: 'ag:seo', t: 109, r: { '🙏': ['d-seo'] },
    b: { it: 'Eccole, ultime 4 settimane:\n- leggings palestra · posizione 7,9 · CTR 1,4%\n- tappetino yoga · posizione 8,4 · CTR 1,2%\n- guanti palestra · posizione 9,3 · CTR 1,1%\n- scarpe running uomo · posizione 6,2 · CTR 1,8%\n- borraccia termica · posizione 5,1 · CTR 1,9%\nPartirei da «leggings palestra»: è quella con più clic da recuperare.', en: 'Here they are, last 4 weeks:\n- gym leggings · position 7.9 · CTR 1.4%\n- yoga mat · position 8.4 · CTR 1.2%\n- gym gloves · position 9.3 · CTR 1.1%\n- men’s running shoes · position 6.2 · CTR 1.8%\n- insulated water bottle · position 5.1 · CTR 1.9%\nI’d start with “gym leggings”: it has the most clicks to win back.', es: 'Aquí las tienes, últimas 4 semanas:\n- leggings gimnasio · posición 7,9 · CTR 1,4 %\n- esterilla yoga · posición 8,4 · CTR 1,2 %\n- guantes gimnasio · posición 9,3 · CTR 1,1 %\n- zapatillas running hombre · posición 6,2 · CTR 1,8 %\n- botella térmica · posición 5,1 · CTR 1,9 %\nEmpezaría por «leggings gimnasio»: es la que más clics puede recuperar.', fr: 'Les voici, 4 dernières semaines :\n- legging sport · position 7,9 · CTR 1,4 %\n- tapis de yoga · position 8,4 · CTR 1,2 %\n- gants de musculation · position 9,3 · CTR 1,1 %\n- chaussures running homme · position 6,2 · CTR 1,8 %\n- gourde isotherme · position 5,1 · CTR 1,9 %\nJe commencerais par « legging sport » : c’est là qu’il y a le plus de clics à récupérer.', de: 'Hier sind sie, letzte 4 Wochen:\n- Sportleggings · Position 7,9 · CTR 1,4 %\n- Yogamatte · Position 8,4 · CTR 1,2 %\n- Trainingshandschuhe · Position 9,3 · CTR 1,1 %\n- Laufschuhe Herren · Position 6,2 · CTR 1,8 %\n- Thermoflasche · Position 5,1 · CTR 1,9 %\nIch würde mit „Sportleggings“ anfangen: Da sind die meisten Klicks zu holen.' } },
  { id: 'g8', ch: 'c-gen', da: 'd-cro', t: 70, r: { '🎉': ['d-owner', 'd-adv', 'd-design'] },
    b: { it: 'Test A/B sul pulsante acquista chiuso: la variante vince con **+7,4%** di conversione. La mettiamo al 100%?', en: 'The buy-button A/B test is done: the variant wins with **+7.4%** conversion. Shall we roll it out to 100%?', es: 'Test A/B del botón de compra cerrado: la variante gana con un **+7,4 %** de conversión. ¿La ponemos al 100 %?', fr: 'Test A/B du bouton d’achat terminé : la variante gagne avec **+7,4 %** de conversion. On la passe à 100 % ?', de: 'Der A/B-Test am Kaufen-Button ist durch: Die Variante gewinnt mit **+7,4 %** Conversion. Stellen wir auf 100 % um?' } },
  { id: 'g9', ch: 'c-gen', da: 'd-owner', t: 66,
    b: { it: 'Sì, vai! 👏', en: 'Yes, go for it! 👏', es: '¡Sí, adelante! 👏', fr: 'Oui, vas-y ! 👏', de: 'Ja, mach! 👏' } },
  { id: 'g10', ch: 'c-gen', da: 'ag:data', t: 65, r: { '📈': ['d-owner'] },
    b: { it: 'Confermo: 14 giorni, 11.800 sessioni per variante, significatività al 97%. Sul mese vale circa **+2.900 €** di fatturato.', en: 'Confirmed: 14 days, 11,800 sessions per variant, 97% significance. That’s worth about **€2,900** in extra revenue per month.', es: 'Confirmado: 14 días, 11.800 sesiones por variante, significación del 97 %. Al mes supone unos **+2.900 €** de facturación.', fr: 'Je confirme : 14 jours, 11 800 sessions par variante, significativité à 97 %. Sur un mois, cela représente environ **+2 900 €** de CA.', de: 'Bestätigt: 14 Tage, 11.800 Sessions pro Variante, 97 % Signifikanz. Das sind rund **+2.900 €** Umsatz im Monat.' } },
  { id: 'g11', ch: 'c-gen', da: 'd-adv', t: 25, r: { '✅': ['d-owner'] },
    b: { it: 'Tra poco alzo il budget del retargeting del 20%: se qualcuno ha dubbi, scriva qui.', en: 'Raising the retargeting budget by 20% shortly. Any doubts, shout here.', es: 'En un rato subo un 20 % el presupuesto de retargeting: si alguien tiene dudas, que escriba aquí.', fr: 'Je vais augmenter le budget du retargeting de 20 % : si quelqu’un a un doute, dites-le ici.', de: 'Ich erhöhe gleich das Retargeting-Budget um 20 %. Wenn jemand Bedenken hat, bitte hier melden.' } },
  // #marketing
  { id: 'm1', ch: 'c-mkt', da: 'd-seo', t: [2, 16, 20], r: { '👍': ['d-owner'] },
    b: { it: 'Calendario editoriale del mese prossimo caricato nel progetto «SEO & blog» 📅 Otto articoli, due a settimana.', en: 'Next month’s editorial calendar is in the “SEO & blog” project 📅 Eight articles, two a week.', es: 'El calendario editorial del mes que viene ya está en el proyecto «SEO y blog» 📅 Ocho artículos, dos por semana.', fr: 'Le calendrier éditorial du mois prochain est dans le projet « SEO & blog » 📅 Huit articles, deux par semaine.', de: 'Der Redaktionsplan für nächsten Monat liegt im Projekt „SEO & Blog“ 📅 Acht Artikel, zwei pro Woche.' } },
  { id: 'm2', ch: 'c-mkt', da: 'd-owner', t: [1, 11, 5],
    b: { it: '@Valentina ci servono tre angoli per le creative dei saldi, pubblico 25-40 anni.', en: '@Valentina we need three angles for the sale creatives, audience aged 25–40.', es: '@Valentina necesitamos tres ángulos para las creatividades de las rebajas, público de 25 a 40 años.', fr: '@Valentina il nous faut trois angles pour les créas des soldes, cible 25-40 ans.', de: '@Valentina Wir brauchen drei Angles für die Sale-Creatives, Zielgruppe 25–40.' } },
  { id: 'm3', ch: 'c-mkt', da: 'ag:creative', t: [1, 11, 6], r: { '🔥': ['d-design', 'd-adv'] },
    b: { it: 'Ecco tre angoli da testare:\n1. **Il capo che usi tutti i giorni**: comfort e durata\n2. **Prima e dopo l’allenamento**: UGC girati in palestra\n3. **Ultimi pezzi**: scarsità vera sulle taglie che stanno finendo\nHook per il primo: «Lo metto da sei mesi e sembra nuovo».', en: 'Three angles to test:\n1. **The piece you wear every day**: comfort and durability\n2. **Before and after the workout**: UGC shot at the gym\n3. **Last pieces**: real scarcity on sizes that are running out\nHook for the first one: “I’ve worn it for six months and it still looks new.”', es: 'Tres ángulos para testear:\n1. **La prenda que usas todos los días**: comodidad y durabilidad\n2. **Antes y después del entreno**: UGC grabados en el gimnasio\n3. **Últimas unidades**: escasez real en las tallas que se agotan\nHook para el primero: «Lo llevo desde hace seis meses y parece nuevo».', fr: 'Trois angles à tester :\n1. **La pièce que tu portes tous les jours** : confort et durabilité\n2. **Avant et après la séance** : UGC tournés en salle\n3. **Dernières pièces** : vraie rareté sur les tailles qui partent\nHook pour le premier : « Je le porte depuis six mois et il est comme neuf. »', de: 'Drei Angles zum Testen:\n1. **Das Teil, das du jeden Tag trägst**: Komfort und Haltbarkeit\n2. **Vor und nach dem Training**: UGC, im Gym gedreht\n3. **Letzte Stücke**: echte Knappheit bei Größen, die ausgehen\nHook für den ersten: „Ich trage ihn seit sechs Monaten und er sieht aus wie neu.“' } },
  { id: 'm4', ch: 'c-mkt', da: 'd-design', t: [1, 11, 18],
    b: { it: 'Il secondo mi piace un sacco: preparo le statiche nei tre formati entro giovedì.', en: 'Love the second one: I’ll have the statics in all three formats by Thursday.', es: 'El segundo me encanta: preparo los estáticos en los tres formatos para el jueves.', fr: 'J’adore le deuxième : je prépare les visuels dans les trois formats d’ici jeudi.', de: 'Der zweite gefällt mir total: Ich baue die Statics bis Donnerstag in allen drei Formaten.' } },
  { id: 'm5', ch: 'c-mkt', da: 'ag:cmo', t: [1, 11, 19],
    b: { it: 'Bene. Ricordiamoci l’email ai VIP 48 ore prima: è il pubblico che compra di più al lancio.', en: 'Good. Let’s not forget the VIP email 48 hours before: they’re the ones who buy most at launch.', es: 'Bien. No olvidemos el email a los VIP 48 horas antes: son quienes más compran en el lanzamiento.', fr: 'Bien. N’oublions pas l’e-mail aux VIP 48 h avant : ce sont eux qui achètent le plus au lancement.', de: 'Gut. Denkt an die VIP-Mail 48 Stunden vorher: Das sind die, die beim Launch am meisten kaufen.' } },
  { id: 'm6', ch: 'c-mkt', da: 'd-cro', t: 95, r: { '👍': ['d-owner', 'd-seo'] },
    b: { it: 'Newsletter di martedì: oggetto A «Nuovi arrivi» contro B «L’hai già vista?». Vince B con il 44% di aperture.', en: 'Tuesday’s newsletter: subject A “New arrivals” vs B “Have you seen it yet?”. B wins with a 44% open rate.', es: 'Newsletter del martes: asunto A «Novedades» frente a B «¿Ya la has visto?». Gana B con un 44 % de aperturas.', fr: 'Newsletter de mardi : objet A « Nouveautés » contre B « Tu l’as déjà vue ? ». B gagne avec 44 % d’ouverture.', de: 'Newsletter vom Dienstag: Betreff A „Neu eingetroffen“ gegen B „Schon gesehen?“. B gewinnt mit 44 % Öffnungsrate.' } },
  // #ads
  { id: 'a1', ch: 'c-ads', da: 'd-adv', t: [1, 14, 10],
    b: { it: 'Frequenza sopra 5 su «Testimonial» e «Statico promo»: stasera le metto in pausa.', en: 'Frequency above 5 on “Testimonial” and “Promo static”: pausing them tonight.', es: 'Frecuencia por encima de 5 en «Testimonial» y «Estático promo»: esta noche las pauso.', fr: 'Fréquence au-dessus de 5 sur « Témoignage » et « Visuel promo » : je les mets en pause ce soir.', de: 'Frequenz über 5 bei „Testimonial“ und „Promo-Static“: Ich pausiere sie heute Abend.' } },
  { id: 'a2', ch: 'c-ads', da: 'ag:ads', t: [1, 14, 11], r: { '✅': ['d-adv'] },
    b: { it: 'Buona scelta: il CPA di quelle due è salito del 38% in dieci giorni. Sposterei il budget su «Reel UGC #3», che è a ROAS 4,1.', en: 'Good call: CPA on those two is up 38% in ten days. I’d move the budget to “UGC Reel #3”, which is at 4.1 ROAS.', es: 'Buena decisión: el CPA de esas dos ha subido un 38 % en diez días. Movería el presupuesto a «Reel UGC #3», que está en ROAS 4,1.', fr: 'Bon choix : le CPA de ces deux-là a pris 38 % en dix jours. Je basculerais le budget sur « Reel UGC #3 », à 4,1 de ROAS.', de: 'Gute Entscheidung: Der CPA der beiden ist in zehn Tagen um 38 % gestiegen. Ich würde das Budget auf „UGC-Reel #3“ schieben, das liegt bei ROAS 4,1.' } },
  { id: 'a3', ch: 'c-ads', da: 'd-owner', t: [1, 14, 25],
    b: { it: 'Ok. Budget massimo al giorno per il lancio?', en: 'OK. Max daily budget for the launch?', es: 'Vale. ¿Presupuesto máximo diario para el lanzamiento?', fr: 'OK. Budget max par jour pour le lancement ?', de: 'Okay. Maximales Tagesbudget für den Launch?' } },
  { id: 'a4', ch: 'c-ads', da: 'd-adv', t: [1, 14, 32], r: { '👍': ['d-owner'] }, file: 'csv',
    b: { it: 'Proposta: 450 € al giorno per sette giorni, poi rivediamo col MER. Dettaglio nel file.', en: 'Proposal: €450 a day for seven days, then we review against MER. Breakdown in the file.', es: 'Propuesta: 450 € al día durante siete días y luego revisamos con el MER. Detalle en el archivo.', fr: 'Proposition : 450 € par jour pendant sept jours, puis on revoit avec le MER. Détail dans le fichier.', de: 'Vorschlag: 450 € pro Tag für sieben Tage, danach prüfen wir mit dem MER. Details in der Datei.' } },
  { id: 'a5', ch: 'c-ads', da: 'd-owner', t: [1, 14, 40],
    b: { it: 'Approvato 👍', en: 'Approved 👍', es: 'Aprobado 👍', fr: 'Validé 👍', de: 'Freigegeben 👍' } },
  { id: 'a6', ch: 'c-ads', da: 'd-adv', t: 40,
    b: { it: 'Google Shopping: titoli nuovi nel feed, CTR +0,6 punti nei primi tre giorni.', en: 'Google Shopping: new titles are in the feed, CTR up 0.6 points in the first three days.', es: 'Google Shopping: títulos nuevos en el feed, CTR +0,6 puntos en los tres primeros días.', fr: 'Google Shopping : nouveaux titres dans le flux, CTR +0,6 point sur les trois premiers jours.', de: 'Google Shopping: Neue Titel sind im Feed, CTR +0,6 Punkte in den ersten drei Tagen.' } },
  // #lancio-collezione (privato, del progetto)
  { id: 'l1', ch: 'c-launch', da: 'd-design', t: [0, 11, 5], file: 'moodboard', r: { '😍': ['d-owner', 'd-cro'] },
    b: { it: 'Moodboard dello shooting: 24 capi, tre set, sfondo neutro.', en: 'Shoot moodboard: 24 items, three sets, neutral background.', es: 'Moodboard de la sesión: 24 prendas, tres sets, fondo neutro.', fr: 'Moodboard du shooting : 24 pièces, trois sets, fond neutre.', de: 'Moodboard fürs Shooting: 24 Teile, drei Sets, neutraler Hintergrund.' } },
  { id: 'l2', ch: 'c-launch', da: 'd-ecom', t: [0, 15, 30], r: { '🎉': ['d-owner', 'd-design', 'd-cro'] },
    b: { it: 'Stock della collezione arrivato: 1.240 pezzi caricati su Shopify.', en: 'Collection stock has arrived: 1,240 units loaded into Shopify.', es: 'Ha llegado el stock de la colección: 1.240 unidades cargadas en Shopify.', fr: 'Le stock de la collection est arrivé : 1 240 pièces chargées dans Shopify.', de: 'Die Ware der Kollektion ist da: 1.240 Stück in Shopify eingebucht.' } },
  { id: 'l3', ch: 'c-launch', da: 'd-cro', t: 300,
    b: { it: 'Landing in revisione. @Marco quando hai dieci minuti le dai un’occhiata?', en: 'The landing page is in review. @Marco when you have ten minutes, could you take a look?', es: 'Landing en revisión. @Marco ¿cuando tengas diez minutos le echas un vistazo?', fr: 'La landing est en revue. @Marco quand tu as dix minutes, tu y jettes un œil ?', de: 'Die Landingpage ist im Review. @Marco Schaust du mal drüber, wenn du zehn Minuten hast?' } },
  { id: 'l4', ch: 'c-launch', da: 'd-owner', t: 280,
    b: { it: 'Vista: ottima. Solo la foto hero, la vorrei più luminosa.', en: 'Looks great. Just the hero photo: I’d make it brighter.', es: 'Vista: genial. Solo la foto del hero, la haría más luminosa.', fr: 'Vu : très bien. Juste la photo du hero, je la voudrais plus lumineuse.', de: 'Gesehen: super. Nur das Hero-Foto hätte ich gern heller.' } },
  { id: 'l5', ch: 'c-launch', da: 'd-design', t: 200,
    b: { it: 'Foto hero schiarita e caricata ✨', en: 'Hero photo brightened and uploaded ✨', es: 'Foto del hero aclarada y subida ✨', fr: 'Photo du hero éclaircie et mise en ligne ✨', de: 'Hero-Foto aufgehellt und hochgeladen ✨' } },
  // #seo-contenuti
  { id: 's1', ch: 'c-seo', da: 'd-seo', t: [3, 10, 15],
    b: { it: 'Meta description delle categorie principali aggiornate: 14 pagine.', en: 'Meta descriptions updated on the main categories: 14 pages.', es: 'Actualizadas las meta descriptions de las categorías principales: 14 páginas.', fr: 'Meta descriptions des catégories principales mises à jour : 14 pages.', de: 'Meta-Descriptions der Hauptkategorien aktualisiert: 14 Seiten.' } },
  { id: 's2', ch: 'c-seo', da: 'ag:seo', t: [1, 17, 5],
    b: { it: 'Dopo il cambio URL Search Console segnala 12 pagine in 404. Ho messo l’elenco dei redirect nella task.', en: 'After the URL change, Search Console reports 12 pages returning 404. I’ve put the redirect list in the task.', es: 'Tras el cambio de URL, Search Console marca 12 páginas en 404. He dejado la lista de redirecciones en la tarea.', fr: 'Après le changement d’URL, la Search Console signale 12 pages en 404. J’ai mis la liste des redirections dans la tâche.', de: 'Nach der URL-Umstellung meldet die Search Console 12 Seiten mit 404. Die Redirect-Liste liegt in der Aufgabe.' } },
  { id: 's3', ch: 'c-seo', da: 'd-cro', t: [1, 17, 21],
    b: { it: 'Li sistemo io appena chiusa la landing.', en: 'I’ll fix them as soon as the landing page is done.', es: 'Los arreglo yo en cuanto cierre la landing.', fr: 'Je m’en occupe dès que la landing est bouclée.', de: 'Die mache ich, sobald die Landingpage fertig ist.' } },
  // #magazzino
  { id: 'k1', ch: 'c-stock', da: 'd-ecom', t: [0, 10, 0],
    b: { it: 'Riassortimento felpe confermato: arrivo previsto tra nove giorni.', en: 'Hoodie restock confirmed: expected in nine days.', es: 'Reposición de sudaderas confirmada: llegada prevista en nueve días.', fr: 'Réassort des sweats confirmé : arrivée prévue dans neuf jours.', de: 'Hoodie-Nachschub bestätigt: Lieferung in neun Tagen.' } },
  { id: 'k2', ch: 'c-stock', da: 'ag:data', t: [0, 10, 2],
    b: { it: 'Con il ritmo di vendita attuale la taglia M finisce tra sei giorni: restano tre giorni scoperti. Suggerisco di toglierla dalle campagne finché non arriva la merce.', en: 'At the current sales pace, size M runs out in six days, leaving a three-day gap. I suggest pulling it from the campaigns until the stock lands.', es: 'Al ritmo de venta actual, la talla M se agota en seis días: quedan tres días sin cubrir. Sugiero sacarla de las campañas hasta que llegue la mercancía.', fr: 'Au rythme de ventes actuel, la taille M sera épuisée dans six jours : il reste trois jours non couverts. Je suggère de la retirer des campagnes jusqu’à l’arrivée du stock.', de: 'Beim aktuellen Abverkauf ist Größe M in sechs Tagen weg, es bleiben drei Tage Lücke. Ich würde sie aus den Kampagnen nehmen, bis die Ware da ist.' } },
  { id: 'k3', ch: 'c-stock', da: 'd-owner', t: [0, 10, 30],
    b: { it: 'Ok. @Luca la togli dal catalogo delle ads finché non rientra?', en: 'OK. @Luca can you remove it from the ads catalogue until it’s back?', es: 'Vale. @Luca ¿la quitas del catálogo de anuncios hasta que vuelva?', fr: 'OK. @Luca tu la retires du catalogue des pubs jusqu’à son retour ?', de: 'Okay. @Luca Nimmst du sie aus dem Ads-Katalog, bis sie wieder da ist?' } },
  { id: 'k4', ch: 'c-stock', da: 'd-adv', t: [0, 10, 45], r: { '🙏': ['d-owner'] },
    b: { it: 'Fatto ✅', en: 'Done ✅', es: 'Hecho ✅', fr: 'C’est fait ✅', de: 'Erledigt ✅' } },
  // Messaggi diretti
  { id: 'd1', ch: 'dm_d-owner_d-cro', da: 'd-cro', t: 310,
    b: { it: 'Ciao Marco, ti ho messo in revisione la landing: riesci a guardarla oggi?', en: 'Hi Marco, I’ve sent you the landing page for review. Can you look at it today?', es: 'Hola Marco, te he pasado la landing a revisión. ¿Puedes mirarla hoy?', fr: 'Salut Marco, je t’ai envoyé la landing en revue. Tu peux la regarder aujourd’hui ?', de: 'Hi Marco, die Landingpage liegt bei dir im Review. Schaffst du es heute?' } },
  { id: 'd2', ch: 'dm_d-owner_d-cro', da: 'd-owner', t: 295,
    b: { it: 'Certo, la guardo subito dopo la call.', en: 'Sure, I’ll check it right after my call.', es: 'Claro, la miro justo después de la llamada.', fr: 'Bien sûr, je regarde juste après mon appel.', de: 'Klar, ich schaue direkt nach dem Call.' } },
  { id: 'd3', ch: 'dm_d-owner_d-cro', da: 'd-cro', t: 290,
    b: { it: 'Grazie! 🙏', en: 'Thanks! 🙏', es: '¡Gracias! 🙏', fr: 'Merci ! 🙏', de: 'Danke! 🙏' } },
  { id: 'd4', ch: 'dm_d-owner_d-adv', da: 'd-adv', t: 35,
    b: { it: 'Ho una proposta per il budget dei saldi, ti scrivo qui i numeri.', en: 'I have a proposal for the sale budget, here are the numbers.', es: 'Tengo una propuesta para el presupuesto de las rebajas, te dejo aquí los números.', fr: 'J’ai une proposition pour le budget des soldes, je te mets les chiffres ici.', de: 'Ich hab einen Vorschlag fürs Sale-Budget, hier die Zahlen.' } },
  { id: 'd5', ch: 'dm_d-owner_d-adv', da: 'd-adv', t: 34,
    b: { it: '- retargeting +30%\n- pubblico ampio −15%\n- test Advantage+ a 80 € al giorno\nStima: MER da 3,5 a 3,8 nelle due settimane.', en: '- retargeting +30%\n- broad audience −15%\n- Advantage+ test at €80 a day\nEstimate: MER from 3.5 to 3.8 over the two weeks.', es: '- retargeting +30 %\n- público amplio −15 %\n- test Advantage+ a 80 € al día\nEstimación: MER de 3,5 a 3,8 en las dos semanas.', fr: '- retargeting +30 %\n- audience large −15 %\n- test Advantage+ à 80 € par jour\nEstimation : MER de 3,5 à 3,8 sur les deux semaines.', de: '- Retargeting +30 %\n- breite Zielgruppe −15 %\n- Advantage+-Test mit 80 € pro Tag\nSchätzung: MER von 3,5 auf 3,8 in den zwei Wochen.' } },
]

// Allegati dei messaggi: immagini SVG in linea e un CSV scaricabile, niente rete.
const CSV_BUDGET = {
  it: 'giorno,meta,google,totale', en: 'day,meta,google,total', es: 'día,meta,google,total', fr: 'jour,meta,google,total', de: 'Tag,Meta,Google,Gesamt',
}
function allegatoChat(tipo, l) {
  const saldi = EVENTI.find(e => e.id === 'ev-saldi')
  if (tipo === 'banner') return { file_name: 'banner-v1.png', file_type: 'image/png', file_url: adImg('#ff375f', '#ff8a5b', '−20%', tl(saldi.t, l).replace(/\s*−20\s?%$/, ''), tl(CTA_AD, l), 480, 270) }
  if (tipo === 'moodboard') return { file_name: 'moodboard.png', file_type: 'image/png', file_url: moodboardImg() }
  if (tipo === 'csv') {
    const righe = [tl(CSV_BUDGET, l), ...[1, 2, 3, 4, 5, 6, 7].map(g => `${g},315,135,450`)]
    return { file_name: 'budget-launch.csv', file_type: 'text/csv', file_url: 'data:text/csv;charset=utf-8,' + encodeURIComponent(righe.join('\n')) }
  }
  return null
}
function nomeCanale(c, l) {
  return c.dm ? `dm_${c.membri.join('_')}` : tl(c.name, l)
}
function tuttiIMessaggi(l) {
  const risposte = {}
  for (const m of MESSAGGI) if (m.radice) risposte[m.radice] = (risposte[m.radice] || 0) + 1
  return MESSAGGI.map(m => {
    const ag = m.da.startsWith('ag:') ? agente(m.da.slice(3)) : null
    const file = m.file ? allegatoChat(m.file, l) : null
    return {
      id: m.id, channel_id: m.ch, workspace_id: 'demo',
      // Gli agenti scrivono con author_id nullo e il loro «tag» come nome: è
      // così che LyftTalk trova la loro foto.
      author_id: ag ? null : m.da, author_name: ag ? tagAgente(ag) : nomeDi(m.da),
      body: tl(m.b, l), created_at: iso(istanteChat(m.t)),
      reactions: m.r || {}, thread_root: m.radice || null, reply_count: risposte[m.id] || 0,
      pinned: !!m.fissato, reply_to: null, reply_author: null, reply_excerpt: null, audio_url: null,
      file_url: file ? file.file_url : null, file_name: file ? file.file_name : null, file_type: file ? file.file_type : null,
    }
  }).sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
}
function demoChannels(l = linguaDemo()) {
  const msgs = tuttiIMessaggi(l)
  const lastAt = {}
  for (const id of CANALI_NON_LETTI) { const ult = msgs.filter(m => m.channel_id === id && !m.thread_root).pop(); if (ult) lastAt[id] = ult.created_at }
  return {
    channels: CANALI.map(c => ({
      id: c.id, workspace_id: 'demo', name: nomeCanale(c, l), is_private: !!(c.privato || c.dm), is_dm: !!c.dm,
      project_id: c.progetto || null, created_at: iso(Date.now() - 120 * DAY),
    })),
    me: { memberId: 'd-owner', isAdmin: true },
    lastAt,
  }
}
function membriDelCanale(id) {
  const c = CANALI.find(x => x.id === id)
  return c && c.membri ? c.membri : MEMBERS.map(m => m.id)
}
function demoChannelMessages(search, l = linguaDemo()) {
  const q = k => (search && search.get && search.get(k)) || null
  const ch = q('channel_id'), after = q('after'), radice = q('thread_root')
  return tuttiIMessaggi(l).filter(m => m.channel_id === ch
    && (radice ? m.thread_root === radice : !m.thread_root)
    && (!after || m.created_at > after))
}
function demoChatFiles(l = linguaDemo()) {
  return tuttiIMessaggi(l).filter(m => m.file_url).reverse().map(m => {
    const c = CANALI.find(x => x.id === m.channel_id)
    return { id: m.id, channel_id: m.channel_id, channel_name: c ? nomeCanale(c, l) : '', author_name: m.author_name, file_url: m.file_url, file_name: m.file_name, file_type: m.file_type, audio_url: null, created_at: m.created_at }
  })
}

// ── Creatività ──────────────────────────────────────────────────────────────
// Dodici idee nei tre formati, divise per iniziativa (progetti e promo del
// calendario, come la route vera). La tab si apre su «da rivedere»: lì ce ne
// sono cinque, due con un formato ancora da caricare e una con un formato
// bocciato, così si vedono tutti i segni della scheda.
const FORMATI_DEMO = { '1:1': [360, 360, '1080x1080'], '9:16': [270, 480, '1080x1920'], '16:9': [480, 270, '1920x1080'] }
const CREATIVITA = [
  { id: 'cr-sale-static', promo: 'ev-saldi', st: 'da_rivisionare', by: 'd-design', c: 1, col: ['#ff375f', '#ff8a5b'], fmt: ['1:1', '9:16', '16:9'],
    n: { it: 'Saldi −20% · statica', en: 'Sale −20% · static', es: 'Rebajas −20 % · estático', fr: 'Soldes −20 % · visuel', de: 'Sale −20 % · Static' },
    h: '−20%', s: { it: 'Saldi di metà stagione', en: 'Mid-season sale', es: 'Rebajas de mitad de temporada', fr: 'Soldes de mi-saison', de: 'Mid-Season-Sale' } },
  { id: 'cr-sale-carousel', promo: 'ev-saldi', st: 'da_rivisionare', by: 'd-design', c: 1, col: ['#fbbf24', '#ff9f0a'], fmt: ['1:1', '9:16'],
    n: { it: 'Saldi · carosello bestseller', en: 'Sale · bestseller carousel', es: 'Rebajas · carrusel de los más vendidos', fr: 'Soldes · carrousel best-sellers', de: 'Sale · Bestseller-Karussell' },
    h: { it: 'Bestseller', en: 'Bestsellers', es: 'Los más vendidos', fr: 'Best-sellers', de: 'Bestseller' }, s: { it: 'Fino al −20%', en: 'Up to −20%', es: 'Hasta −20 %', fr: 'Jusqu’à −20 %', de: 'Bis zu −20 %' } },
  { id: 'cr-launch-hero', project: 'p-launch', st: 'da_rivisionare', by: 'd-design', c: 2, col: ['#7b5bff', '#5b8bff'], fmt: ['1:1', '9:16', '16:9'],
    n: { it: 'Nuova collezione · hero', en: 'New collection · hero', es: 'Nueva colección · hero', fr: 'Nouvelle collection · hero', de: 'Neue Kollektion · Hero' },
    h: { it: 'Nuova collezione', en: 'New collection', es: 'Nueva colección', fr: 'Nouvelle collection', de: 'Neue Kollektion' }, s: { it: 'Disponibile da giovedì', en: 'Available from Thursday', es: 'Disponible desde el jueves', fr: 'Disponible dès jeudi', de: 'Ab Donnerstag erhältlich' } },
  { id: 'cr-launch-teaser', project: 'p-launch', st: 'da_rivisionare', by: 'd-adv', c: 3, col: ['#0a84ff', '#64d2ff'], fmt: ['9:16', '1:1'],
    n: { it: 'Nuova collezione · teaser 6s', en: 'New collection · 6s teaser', es: 'Nueva colección · teaser de 6 s', fr: 'Nouvelle collection · teaser 6 s', de: 'Neue Kollektion · 6-Sek.-Teaser' },
    h: { it: 'Sta arrivando', en: 'Coming soon', es: 'Muy pronto', fr: 'Bientôt', de: 'Bald da' }, s: { it: 'La nuova collezione', en: 'The new collection', es: 'La nueva colección', fr: 'La nouvelle collection', de: 'Die neue Kollektion' } },
  { id: 'cr-ugc-before-after', project: 'p-ads', st: 'da_rivisionare', by: 'd-adv', c: 4, col: ['#bf5af2', '#7b5bff'], fmt: ['1:1', '9:16', '16:9'], bocciato: '16:9',
    n: { it: 'UGC · prima e dopo l’allenamento', en: 'UGC · before and after the workout', es: 'UGC · antes y después del entreno', fr: 'UGC · avant et après la séance', de: 'UGC · vor und nach dem Training' },
    h: { it: 'Prima / Dopo', en: 'Before / After', es: 'Antes / Después', fr: 'Avant / Après', de: 'Vorher / Nachher' }, s: { it: 'Allenati meglio', en: 'Train better', es: 'Entrena mejor', fr: 'Entraîne-toi mieux', de: 'Besser trainieren' } },
  { id: 'cr-reviews', project: 'p-ads', st: 'accettata', by: 'd-design', c: 9, col: ['#30d158', '#28b14c'], fmt: ['1:1', '9:16', '16:9'],
    n: { it: 'Recensioni 4,8/5 · social proof', en: '4.8/5 reviews · social proof', es: 'Reseñas 4,8/5 · prueba social', fr: 'Avis 4,8/5 · preuve sociale', de: 'Bewertungen 4,8/5 · Social Proof' },
    h: { it: '★ 4,8/5', en: '★ 4.8/5', es: '★ 4,8/5', fr: '★ 4,8/5', de: '★ 4,8/5' }, s: { it: 'Oltre 2.400 recensioni', en: 'Over 2,400 reviews', es: 'Más de 2.400 reseñas', fr: 'Plus de 2 400 avis', de: 'Über 2.400 Bewertungen' } },
  { id: 'cr-bundle', project: 'p-ads', st: 'accettata', by: 'd-design', c: 11, col: ['#64d2ff', '#0a84ff'], fmt: ['1:1', '9:16', '16:9'],
    n: { it: 'Bundle 3 prodotti', en: '3-product bundle', es: 'Pack de 3 productos', fr: 'Bundle 3 produits', de: '3er-Bundle' },
    h: { it: '3 prodotti, 1 prezzo', en: '3 products, 1 price', es: '3 productos, 1 precio', fr: '3 produits, 1 prix', de: '3 Produkte, 1 Preis' }, s: { it: 'Risparmi fino al 35%', en: 'Save up to 35%', es: 'Ahorra hasta un 35 %', fr: 'Jusqu’à 35 % d’économie', de: 'Bis zu 35 % sparen' } },
  { id: 'cr-free-shipping', promo: 'ev-ship', st: 'accettata', by: 'd-design', c: 6, col: ['#5b8bff', '#30d158'], fmt: ['1:1', '9:16', '16:9'],
    n: { it: 'Spedizione gratuita · weekend', en: 'Free shipping · weekend', es: 'Envío gratis · fin de semana', fr: 'Livraison offerte · week-end', de: 'Gratisversand · Wochenende' },
    h: { it: 'Spedizione gratis', en: 'Free shipping', es: 'Envío gratis', fr: 'Livraison offerte', de: 'Gratis Versand' }, s: { it: 'Solo questo weekend', en: 'This weekend only', es: 'Solo este fin de semana', fr: 'Ce week-end seulement', de: 'Nur dieses Wochenende' } },
  { id: 'cr-founder', project: 'p-ads', st: 'utilizzata', by: 'd-adv', c: 30, col: ['#ff6482', '#bf5af2'], fmt: ['1:1', '9:16', '16:9'],
    n: { it: 'La storia del fondatore', en: 'Founder story', es: 'La historia del fundador', fr: 'L’histoire du fondateur', de: 'Gründerstory' },
    h: { it: 'La nostra storia', en: 'Our story', es: 'Nuestra historia', fr: 'Notre histoire', de: 'Unsere Geschichte' }, s: { it: 'Perché l’abbiamo creato', en: 'Why we made it', es: 'Por qué lo creamos', fr: 'Pourquoi nous l’avons créé', de: 'Warum wir es gemacht haben' } },
  { id: 'cr-unboxing', project: 'p-ads', st: 'utilizzata', by: 'd-adv', c: 24, col: ['#64d2ff', '#5b8bff'], fmt: ['1:1', '9:16', '16:9'],
    n: { it: 'Unboxing', en: 'Unboxing', es: 'Unboxing', fr: 'Unboxing', de: 'Unboxing' },
    h: 'Unboxing', s: { it: 'Apri la box con noi', en: 'Open the box with us', es: 'Abre la caja con nosotros', fr: 'Ouvre la box avec nous', de: 'Pack die Box mit uns aus' } },
  { id: 'cr-last-pieces', promo: 'ev-saldi', st: 'bocciata', by: 'd-design', c: 2, col: ['#ef4444', '#f59e0b'], fmt: ['1:1', '9:16'],
    n: { it: 'Ultimi pezzi · countdown', en: 'Last pieces · countdown', es: 'Últimas unidades · cuenta atrás', fr: 'Dernières pièces · compte à rebours', de: 'Letzte Stücke · Countdown' },
    h: { it: 'Ultimi pezzi', en: 'Last pieces', es: 'Últimas unidades', fr: 'Dernières pièces', de: 'Letzte Stücke' }, s: { it: 'Finisce a mezzanotte', en: 'Ends at midnight', es: 'Termina a medianoche', fr: 'Fin à minuit', de: 'Endet um Mitternacht' },
    note: { it: 'Troppo aggressiva per il tono del brand.', en: 'Too pushy for the brand’s tone.', es: 'Demasiado agresiva para el tono de la marca.', fr: 'Trop agressive pour le ton de la marque.', de: 'Zu aufdringlich für den Ton der Marke.' } },
  { id: 'cr-newsletter-header', project: 'p-email', st: 'bocciata', by: 'd-seo', c: 5, col: ['#8e8e93', '#5b8bff'], fmt: ['16:9'],
    n: { it: 'Header newsletter · nuovi arrivi', en: 'Newsletter header · new arrivals', es: 'Cabecera newsletter · novedades', fr: 'Bandeau newsletter · nouveautés', de: 'Newsletter-Header · Neuheiten' },
    h: { it: 'Nuovi arrivi', en: 'New arrivals', es: 'Novedades', fr: 'Nouveautés', de: 'Neuheiten' }, s: { it: 'Scopri la collezione', en: 'Discover the collection', es: 'Descubre la colección', fr: 'Découvrez la collection', de: 'Entdecke die Kollektion' } },
]
function demoCreativeLibrary(l = linguaDemo()) {
  const ora = Date.now()
  const cta = tl(CTA_AD, l)
  const items = CREATIVITA.map(x => ({
    id: x.id, workspace_id: 'demo', campaign_id: null, project_id: x.project || null, promo_id: x.promo || null,
    name: tl(x.n, l), status: x.st, product: null, author: nomeDi(x.by), notes: tl(x.note, l),
    created_by: x.by, created_at: iso(ora - x.c * DAY), updated_at: iso(ora - x.c * DAY + 3600000),
    files: x.fmt.map(f => {
      const [w, h, px] = FORMATI_DEMO[f]
      return {
        id: `${x.id}-${px}`, item_id: x.id, workspace_id: 'demo', campaign_id: null, format: f, kind: 'statica',
        name: `${x.id.replace(/^cr-/, '')}_${px}.jpg`, mime: 'image/svg+xml', size: 180000 + w * 900, language: l,
        status: x.bocciato === f ? 'bocciata' : x.st, author: nomeDi(x.by), created_at: iso(ora - x.c * DAY),
        file_path: `demo/${x.id}/${px}.svg`, file_url: adImg(x.col[0], x.col[1], tl(x.h, l), tl(x.s, l), cta, w, h),
      }
    }),
  })).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  // Promo = voci promo del calendario (come la route vera), progetti = quelli attivi.
  const promos = EVENTI.filter(e => e.kind === 'promo_b2c' || e.kind === 'promo_negozi')
    .map(e => ({ id: e.id, title: tl(e.t, l), kind: e.kind, start_date: quando(e.da), end_date: quando(e.a) }))
    .sort((a, b) => (a.start_date < b.start_date ? 1 : -1))
  const projects = demoProjects(l).map(p => ({ id: p.id, name: p.name }))
  return { items, campaigns: [], projects, promos, needsSetup: false, can: { write: true } }
}

export function demoData(path, search, method = 'GET') {
  const p = path.replace(/\/$/, '')
  if (PREZZI_PATHS.has(p)) { const r = demoPrezzi(p, search, method, { DEMO_PRODUCTS, pimg, ymd, iso, DAY, google: () => demoData('/api/google') }); if (r !== undefined) return r }
  if (KPI_BRAIN_PATHS.has(p)) { const r = demoKpiBrain(p, search, method, { DEMO_PRODUCTS, pimg, ymd, iso, DAY, metrics: demoMetrics, google: () => demoData('/api/google') }); if (r !== undefined) return r }

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


  // Le vendite per giorno sono i 7 giorni della settimana, come nella route vera (prima: 30 date).
  if (p === '/api/metrics') { const m = demoMetrics(), g = giorniSettimana(m); return { ...m, shopifyDayBreakdown: g, kpiBrain: { ...m.kpiBrain, shopifyDayBreakdown: g, previous: { ...m.kpiBrain.previous, shopifyDayBreakdown: g } } } }
  if (p === '/api/incrementality') return demoIncrementality()
  if (p === '/api/geolift') return demoGeoLift()
  if (p === '/api/realtime') return {
    // Come il prodotto vero da settembre 2026: le sessioni vengono da Shopify, non da GA4.
    configured: true, fonte: 'shopify', ultimi30: 64,
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

  if (p === '/api/team-members') return { members: demoMembers(), roles: ['cro_specialist', 'ecommerce_manager', 'advertising_manager', 'data_analyst'], roleLabels: { admin: 'Admin', cro_specialist: 'CRO Specialist', ecommerce_manager: 'E-commerce Manager', advertising_manager: 'Advertising / Marketing / SEO', data_analyst: 'Data Analyst / Revisore' }, seats: { plan: 'scale', limit: null, used: MEMBERS.length }, me: { userId: 'd-owner', memberId: 'd-owner', roles: ['admin'], isAdmin: true, isMember: false } }
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

  // ── Productivity AI: Progetti & Task, Calendario, Ferie, Lyftimer, LyftTalk, Creatività, Squadra AI ──
  // Le letture danno i dati d'esempio nella lingua della demo. Le scritture rispondono
  // «fatto» senza toccare nulla: l'intercettore non vede il corpo della richiesta, quindi
  // non può ripeterlo. Dove fallire è più onesto (un messaggio in chat, un download) lo
  // dice nella lingua di chi guarda.
  if (p === '/api/tasks') return method === 'GET' ? { tasks: demoTasks(), me: { memberId: 'd-owner', roles: ['admin'], isAdmin: true } } : { ok: true }
  if (p === '/api/tasks/attachments') return method === 'GET' ? { ok: false, error: tl(AVVISO_FILE, linguaDemo()) } : { ok: true }
  if (p === '/api/projects') return method === 'GET' ? { projects: demoProjects() } : { ok: true }
  if (p === '/api/projects/members') return method === 'GET' ? demoProjectMembers(search) : { ok: true }
  if (p === '/api/projects/channel') return { channelId: CANALE_DEL_PROGETTO[search && search.get && search.get('projectId')] || 'c-gen' }
  if (p === '/api/task-comments') return method === 'GET' ? { comments: demoTaskComments(search) } : { ok: true }
  if (p === '/api/calendar') return method === 'GET' ? demoCalendar(search) : { ok: true }
  if (p === '/api/time-off') return method === 'GET' ? { requests: demoTimeOff(), me: { memberId: 'd-owner', isAdmin: true } } : { ok: true }
  if (p === '/api/time-entries') return method === 'GET' ? demoTimeEntries(search) : { ok: true }
  if (p === '/api/time-approvals') return method === 'GET' ? demoTimeApprovals(search) : { ok: true }

  if (p === '/api/channels') return method === 'GET' ? demoChannels() : { ok: false, error: tl(AVVISO_DEMO, linguaDemo()) }
  if (p === '/api/channel-members') return method === 'GET' ? { member_ids: membriDelCanale(search && search.get && search.get('channel_id')) } : { ok: true }
  if (p === '/api/channel-messages') {
    if (method === 'GET') return { messages: demoChannelMessages(search) }
    // Inviare non si può (il testo non arriva fin qui): meglio dirlo e lasciare il
    // testo nella casella che farlo sparire. Reazioni e fissati: nessun effetto.
    return method === 'POST' ? { ok: false, error: tl(AVVISO_CHAT, linguaDemo()) } : { ok: true }
  }
  if (p === '/api/chat-files') return { files: demoChatFiles() }
  if (p === '/api/team/channel-reply') return { ok: true, messages: [] }
  if (p === '/api/team-agent') return method === 'GET' ? { team: demoTeamRoster() } : { reply: tl(RISPOSTA_AGENTE, linguaDemo()) }
  if (p === '/api/creative-library/items') return method === 'GET' ? demoCreativeLibrary() : { ok: true }
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
  // ── Klaviyo: anteprima di un'email, consegna e clic, mappa di un flusso, liste e segmenti ──
  // Mancavano: la demo rispondeva {ok:true} senza contenuto e, al clic su una campagna o su
  // un'email di un flusso, la pagina intera cadeva ("Cannot read properties of undefined").
  if (p === '/api/klaviyo/campaign') return demoEmailAnteprima(search)
  if (p === '/api/klaviyo/campagna-clic') return demoEmailConsegna(search)
  if (p === '/api/klaviyo/flusso') return demoFlusso(search)
  if (p === '/api/klaviyo/pubblico') return demoPubblico(search)
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
  // Spesa Google «collegata»: prima la demo rispondeva {} e la Dashboard credeva Google non
  // collegato. Il periodo corrente lo prendeva allora da un percorso manuale che per il periodo
  // PRECEDENTE non esiste: spesa «prima» senza Google, spesa +96% e MER -38% in rosso nella prima
  // schermata. Qui la spesa giornaliera nasce dallo stesso fatturato settimanale del resto della
  // demo (buildWeeks), cosi' corrente e precedente vengono dalla stessa fonte.
  if (p === '/api/google') {
    const daily = []
    for (const w of buildWeeks()) {
      const fatGiorno = (Number(w.shop.fatturato) || 0) / 7
      for (let g = 0; g < 7; g++) {
        const d = new Date(`${w.shop.weekStart}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + g)
        if (d.getTime() > Date.now()) break
        const spend = Math.round(fatGiorno / DEMO_MER_META * 0.45 * 100) / 100
        // Anche impression, clic, conversioni e valore del giorno: KPI Brain li legge dal giornaliero
        // (senza, in demo mostrava ROAS Google 0,00x e CTR/CPC vuoti).
        const conversions = Math.round(spend / 38 * 10) / 10
        daily.push({ date: d.toISOString().slice(0, 10), spend, impressions: Math.round(spend * 190), clicks: Math.round(spend * 3.1), conversions, convValue: Math.round(conversions * 142) })
      }
    }
    const perMese = {}
    for (const x of daily) { const m = x.date.slice(0, 7); perMese[m] = (perMese[m] || 0) + x.spend }
    const monthly = Object.entries(perMese).map(([month, spend]) => ({ month, spend: Math.round(spend * 100) / 100, impressions: Math.round(spend * 190), clicks: Math.round(spend * 3.1), conversions: Math.round(spend / 38), convValue: Math.round(spend * 3.4) }))
    return { configured: true, monthly, daily }
  }
  // ── Competitor Intel / Price Comparison ──
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
