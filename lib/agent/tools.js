import { periodKPIs } from './brandSnapshot'
import { createHash } from 'crypto'

// ============================================================================
//  STRUMENTI degli agent: interrogano i dati del software (snapshot arricchito)
//  per rispondere a QUALSIASI domanda — KPI, creative, adset, competitor, task,
//  Lyftimer. In formato OpenAI function-calling. Usati da call e chat.
// ============================================================================

const PERIODS = ['today', 'yesterday', 'this_week', 'last_week', 'last_7d', 'last_14d', 'this_month', 'last_month', 'last_30d', 'last_90d', 'ytd']

export const TOOLS = [
  { type: 'function', function: { name: 'get_kpis', description: 'KPI completi del brand per un periodo: fatturato, ordini, AOV, nuovi/ritorno clienti, repeat rate, LTV, sessioni, conversion rate, resi, spesa ads, ROAS, MER, CTR, CPC, CPM, frequency, CAC.', parameters: { type: 'object', properties: { period: { type: 'string', enum: PERIODS } }, required: ['period'] } } },
  { type: 'function', function: { name: 'list_creatives', description: 'Performance pubblicitaria Meta a livello adset/creatività: spesa, ROAS, CTR link, CPC, acquisti e valore acquisti, per periodo.', parameters: { type: 'object', properties: { period: { type: 'string', enum: PERIODS }, name: { type: 'string', description: 'filtra per nome creatività' }, sort: { type: 'string', enum: ['spend', 'roas', 'ctr', 'purchases'] }, limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'list_adsets', description: 'Elenca adset/campagne Meta con i loro KPI: spesa, ROAS, CTR, CPC, frequency, acquisti, valore acquisti.', parameters: { type: 'object', properties: { period: { type: 'string', enum: PERIODS }, name: { type: 'string', description: 'filtra per nome adset o campagna' }, sort: { type: 'string', enum: ['spend', 'roas', 'ctr', 'purchases'] }, limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'list_tasks', description: 'Progetti e task del team: titolo, assegnatario, stato, priorità, scadenza.', parameters: { type: 'object', properties: { status: { type: 'string' }, assignee: { type: 'string' } } } } },
  { type: 'function', function: { name: 'get_time_tracking', description: 'Lyftimer: ore registrate dal team (per persona/progetto) e voci recenti.', parameters: { type: 'object', properties: { person: { type: 'string' } } } } },
  { type: 'function', function: { name: 'list_products', description: 'Top prodotti del brand per fatturato (Shopify).', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } } },
]

// ── TOOL AGGIUNTIVI (solo live: leggono le route interne on-demand) ─────────
export const LIVE_TOOLS = [
  { type: 'function', function: { name: 'get_google_campaigns', description: 'Campagne Google Ads con KPI reali: spesa, ROAS, conversioni, valore conv., CPA, CTR, CPC, impression, click, budget/giorno, stato.', parameters: { type: 'object', properties: { period: { type: 'string', enum: PERIODS }, limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'get_search_console', description: 'Dati REALI Google Search Console del sito: click, impression, CTR, posizione media (con delta vs periodo prec.), top query, opportunità SEO (query quasi in prima pagina, CTR basso).', parameters: { type: 'object', properties: { days: { type: 'integer', description: '7, 28, 90 o 180 (default 28)' } } } } },
  { type: 'function', function: { name: 'get_incrementality', description: 'Contributo incrementale dei canali ads (Meta/Google) vs baseline organica: ricavi incrementali reali, ROAS incrementale, saturazione, affidabilità della stima.', parameters: { type: 'object', properties: { days: { type: 'integer', description: 'finestra giorni (default 90)' } } } } },
  { type: 'function', function: { name: 'get_inventory', description: 'Inventario e rischi stockout per prodotto/taglia: giorni-a-stockout, taglie rotte, vendite perse stimate.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_ltv', description: 'LTV Lordo e Netto (proiettati a maturità), CAC e ratio LTV:CAC del brand.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_email_marketing', description: 'Email marketing (Klaviyo/Omnisend/Mailchimp): fatturato da email, campagne inviate con open/click/revenue, flussi automatici, liste e segmenti.', parameters: { type: 'object', properties: { days: { type: 'integer', description: 'finestra giorni (default 30)' } } } } },
  { type: 'function', function: { name: 'get_pnl', description: 'Conto economico (P&L) per mese: fatturato lordo/netto, IVA, sconti, resi, ordini, COGS e commissioni; margine medio. La spesa ads va chiesta ai tool Meta/Google.', parameters: { type: 'object', properties: { months: { type: 'integer', description: 'mesi indietro (default 6)' } } } } },
  { type: 'function', function: { name: 'get_cro', description: 'Funnel e conversione del sito giorno-preciso: sessioni, add-to-cart, checkout, acquisti, conversion rate, nuovi vs ritornanti.', parameters: { type: 'object', properties: { period: { type: 'string', enum: PERIODS } } } } },
  { type: 'function', function: { name: 'get_customers', description: 'Base clienti segmentata (RFM): nuovi, potenziali fedeli, fedeli, a rischio, dormienti — con numero clienti, valore medio, ordini medi e giorni tra ordini.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_ga4_traffic', description: 'Traffico GA4: sessioni, utenti, bounce rate e conversioni totali; canali, pagine più viste e paesi.', parameters: { type: 'object', properties: { days: { type: 'integer', description: 'finestra giorni (default 30)' } } } } },
]
export const ALL_TOOLS = [...TOOLS, ...LIVE_TOOLS]

// Subset VELOCE per i flussi generativi non-conversazionali (insight, azioni,
// note/to-do, report): esclude i tool lenti (competitor via Browserless,
// inventario via bulk Shopify) per non gonfiare la latenza dei job.
const SLOW_TOOL_NAMES = new Set(['get_inventory'])
export const FAST_TOOLS = ALL_TOOLS.filter(t => !SLOW_TOOL_NAMES.has(t.function.name))

// Mappa i periodi degli agent sui preset del timeframe picker delle tab.
const PRESET_MAP = { today: 'today', yesterday: 'yesterday', this_week: 'this_week', last_week: 'last_week', last_7d: 'last_7d', last_14d: 'last_14d', this_month: 'this_month', last_month: 'last_month', last_30d: 'last_30d', last_90d: 'last_90d', ytd: 'ytd' }
// Risolve il periodo del tool: preset noti, 'custom_<since>_<until>' passa
// così com'è (supportato da /api/metrics); ignoto → last_30d MA con nota jit
// esplicita (mai spacciare un periodo per un altro).
function resolvePeriod(period) {
  if (!period) return { preset: 'last_30d', note: null }
  if (PRESET_MAP[period]) return { preset: PRESET_MAP[period], note: null }
  if (/^custom_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/.test(period)) return { preset: period, note: null }
  return { preset: 'last_30d', note: `ATTENZIONE: periodo "${period}" non supportato — questi dati coprono last_30d. Dillo esplicitamente all'utente.` }
}

// ── EXECUTOR LIVE (stile Sidekick) ──────────────────────────────────────────
// I tool leggono le route interne ON-DEMAND con l'auth della richiesta
// (cookie di sessione, o CRON_SECRET per call vocali/job) → multi-tenant per
// costruzione, dati sempre freschi, prompt di sistema magro e stabile.
// Ogni risultato torna { data, jit }: le istruzioni di dominio viaggiano COL
// dato (Just-in-Time), non nel system prompt.
// Fallback: se il fetch live fallisce e c'è uno snapshot, si degrada al
// vecchio executeTool (con nota jit), così niente si rompe.
// Le route rispondono spesso 200 con { ok:false, error }: senza questo check
// il tool restituiva oggetti vuoti e l'agente diceva "non ci sono dati".
function routeError(d) {
  if (!d || typeof d !== 'object') return null
  if (d.ok === false || d.configured === false) return d.error || d.reason || 'fonte non disponibile'
  return null
}

async function ifetch(ctx, path) {
  const headers = {}
  if (ctx.cookie) headers.cookie = ctx.cookie
  // Call vocale: il token firmato del workspace autorizza i tool live con le
  // credenziali di QUEL tenant (senza, in call i clienti non avevano dati).
  if (ctx.callToken) headers['x-lyft-call-ws'] = ctx.callToken
  else if (ctx.cronSecret) headers['x-internal-cron'] = ctx.cronSecret
  const r = await fetch(`${ctx.origin}${path}`, { headers, cache: 'no-store', signal: AbortSignal.timeout(25000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}
const capArr = (a, n) => Array.isArray(a) ? a.slice(0, n) : a
const JIT_NUM = 'Copia i numeri LETTERALMENTE, senza arrotondare né stimare. Se un campo è null/assente, dillo.'


// Converte un preset in date esplicite (per le route che accettano since/until).
function presetToDates(period) {
  const d = new Date()
  const iso = (x) => x.toISOString().slice(0, 10)
  const back = (n) => { const c = new Date(d); c.setDate(c.getDate() - n); return c }
  const m = /^custom_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(period || '')
  if (m) return { since: m[1], until: m[2], label: 'periodo personalizzato' }
  switch (period) {
    case 'today': return { since: iso(d), until: iso(d), label: 'oggi' }
    case 'yesterday': return { since: iso(back(1)), until: iso(back(1)), label: 'ieri' }
    case 'this_week': { const c = new Date(d); const dow = (c.getDay() + 6) % 7; c.setDate(c.getDate() - dow); return { since: iso(c), until: iso(d), label: 'questa settimana' } }
    case 'last_week': { const c = new Date(d); const dow = (c.getDay() + 6) % 7; const end = new Date(c); end.setDate(c.getDate() - dow - 1); const st = new Date(end); st.setDate(end.getDate() - 6); return { since: iso(st), until: iso(end), label: 'settimana scorsa' } }
    case 'this_month': { const c = new Date(d.getFullYear(), d.getMonth(), 1); return { since: iso(c), until: iso(d), label: 'questo mese' } }
    case 'last_month': { const st = new Date(d.getFullYear(), d.getMonth() - 1, 1); const en = new Date(d.getFullYear(), d.getMonth(), 0); return { since: iso(st), until: iso(en), label: 'mese scorso' } }
    case 'last_7d': return { since: iso(back(6)), until: iso(d), label: 'ultimi 7 giorni' }
    case 'last_14d': return { since: iso(back(13)), until: iso(d), label: 'ultimi 14 giorni' }
    case 'last_90d': return { since: iso(back(89)), until: iso(d), label: 'ultimi 90 giorni' }
    case 'ytd': return { since: iso(new Date(d.getFullYear(), 0, 1)), until: iso(d), label: 'da inizio anno' }
    default: return { since: iso(back(29)), until: iso(d), label: 'ultimi 30 giorni' }
  }
}

async function liveResult(name, args, ctx) {
  if (name === 'get_kpis') {
    const { preset, note } = resolvePeriod(args.period)
    const d = await ifetch(ctx, `/api/metrics?preset=${preset}`)
    // COMPATTO: il payload intero di /api/metrics (weekly+monthly+daily) veniva
    // troncato prima dei TOTALI del periodo → il modello leggeva un JSON monco
    // e sommava a mano le settimane. Qui passiamo solo ciò che serve.
    const compact = d && typeof d === 'object' ? {
      periodo: preset,
      shopify: d.shopifyRange || null,
      shopifyPrecedente: d.shopifyPrevRange || null,
      meta: d.metaRange || null,
      metaPrecedente: d.metaPrevRange || null,
      
      aov30g: d.aovLive ?? null,   // finestra FISSA 30 giorni (non del preset)
      ordini30g: d.ordersLive ?? null,
      topProdotti: capArr(d.shopifyTopProducts || d.topProducts, 5),
      canali: capArr(d.shopifyMarketingSources, 5),
      fonti: d.sources || null,
    } : d
    return { data: compact, jit: `KPI live del periodo ${preset}. ${JIT_NUM} \`shopify\` e \`meta\` sono i totali ESATTI del periodo: non sommare nulla. ROAS/MER NON sono precalcolati: se servono, ricavali (ROAS = meta.purchaseValue / meta.spend; MER = shopify.revenue / meta.spend) e dì che è un calcolo. \`aov30g\`/\`ordini30g\` sono su finestra fissa 30 giorni: NON usarli come dato del periodo. Per la spesa Google usa get_google_campaigns.${note ? ' ' + note : ''}` }
  }
  if (name === 'list_creatives') {
    // Fonte creative-level VERA (/api/creative): con meta-detail?level=adsets
    // l'agente spacciava nomi di ADSET per creatività.
    const { preset, note } = resolvePeriod(args.period)
    const d = await ifetch(ctx, `/api/creative?preset=${preset}`)
    let rows = d?.rows || d?.creatives || d?.ads || []
    if (args.name) {
      const q = String(args.name).toLowerCase()
      const hit = rows.filter(r => `${r.name || ''} ${r.adset_name || ''} ${r.campaign_name || ''}`.toLowerCase().includes(q))
      if (hit.length) rows = hit
    }
    const SK = { ctr: 'ctr_link', cpc: 'cpc_link', purchases: 'purchases', spend: 'spend', roas: 'roas' }
    const k = SK[String(args.sort || 'spend').replace(/^-/, '')] || 'spend'
    rows = [...rows].sort((a, b) => (Number(b[k]) || 0) - (Number(a[k]) || 0))
    return {
      data: { rows: capArr(rows, Math.min(args.limit || 10, 25)), totals: d?.summary || null, periodo: preset },
      jit: `Creatività Meta live (periodo ${preset}). ${JIT_NUM} Cita i NOMI esatti delle creative.${note ? ' ' + note : ''}`,
    }
  }
  if (name === 'list_adsets') {
    const { preset, note } = resolvePeriod(args.period)
    // La route accetta 'campaigns' | 'adsets' | 'ads' (con adset_id): usare
    // 'ad'/'adset' dava 400 → l'agente rispondeva sempre "non ho i dati".
    const level = 'adsets'
    const d = await ifetch(ctx, `/api/meta-detail?level=${level}&preset=${preset}`)
    let rows = d?.campaigns || d?.rows || d?.data || []
    // Filtro per nome e ordinamento richiesti dal modello: prima venivano
    // applicati SOLO nel fallback snapshot → "non la trovo" su richieste per nome.
    if (args.name) {
      const q = String(args.name).toLowerCase()
      const hit = rows.filter(r => String(r.name || r.campaign_name || r.ad_name || '').toLowerCase().includes(q))
      if (hit.length) rows = hit
    }
    if (args.sort) {
      // le righe Meta usano ctr_link/cpc_link/purchase_value: mappa i nomi
      const MAP = { ctr: 'ctr_link', cpc: 'cpc_link', purchases: 'purchases', spend: 'spend', roas: 'roas' }
      const k = MAP[String(args.sort).replace(/^-/, '')] || String(args.sort)
      rows = [...rows].sort((a, b) => (Number(b[k]) || 0) - (Number(a[k]) || 0))
    }
    rows = capArr(rows, Math.min(args.limit || 10, 25))
    return { data: { rows, totals: d?.summary || null }, jit: `Meta Ads live (adset con le creative aggregate). ${JIT_NUM} Cita i NOMI esatti di campagne/adset/creative.${note ? ' ' + note : ''}` }
  }
  if (name === 'get_google_campaigns') {
    const { preset, note } = resolvePeriod(args.period)
    const d = await ifetch(ctx, `/api/google-detail?level=campaigns&preset=${preset}`)
    const rows = capArr(d?.rows || d?.campaigns || d?.data || [], Math.min(args.limit || 10, 25))
    const rerr = routeError(d)
    return { data: { rows, totals: d?.summary || null, errore: rerr }, jit: `${rerr ? `ATTENZIONE: la fonte Google ha risposto "${rerr}": dillo apertamente invece di concludere che non ci sono campagne. ` : ''}Google Ads live. ${JIT_NUM} ROAS Google = valore conv. ÷ spesa; le campagne PMAX non hanno breakdown keyword.${note ? ' ' + note : ''}` }
  }
  if (name === 'get_search_console') {
    const sites = await ifetch(ctx, '/api/gsc?action=sites')
    const site = sites?.saved || sites?.sites?.[0]?.siteUrl
    if (!site) return { data: { error: 'Search Console non collegata' }, jit: 'Suggerisci di collegare Google in Onboarding.' }
    const days = [7, 28, 90, 180].includes(args.days) ? args.days : 28
    const d = await ifetch(ctx, `/api/gsc?site=${encodeURIComponent(site)}&days=${days}`)
    return { data: { site, totals: d?.totals, deltas: d?.deltas, topQueries: capArr(d?.queries, 15), opportunities: { nearFirstPage: capArr(d?.opportunities?.nearFirstPage, 8), lowCtr: capArr(d?.opportunities?.lowCtr, 8) }, branded: d?.branded }, jit: `Search Console live (${days}g). ${JIT_NUM} "Posizione" più BASSA = migliore; delta position negativo = miglioramento.` }
  }
  if (name === 'get_incrementality') {
    const days = Number.isFinite(args.days) ? args.days : 90
    const d = await ifetch(ctx, `/api/incrementality?days=${days}`)
    const dc = d && typeof d === 'object' ? { ok: d.ok !== false, motivo: d.reason || null, canali: capArr(d.channels, 6), fatturatoTotale: d.totalRevenue ?? null, baseOrganica: d.baselineRevenue ?? null, affidabilita: d.confidence ?? d.r2 ?? null, giorni: days } : d
    return { data: dc, jit: `Incrementalità live. ${JIT_NUM} Il ROAS INCREMENTALE è più basso del ROAS di piattaforma per costruzione (esclude vendite che sarebbero arrivate comunque): NON confrontarli come se fossero la stessa metrica. Cita anche l'affidabilità della stima.` }
  }
  if (name === 'get_inventory') {
    const d = await ifetch(ctx, '/api/inventory')
    // Ordinati per PRIORITÀ: senza sort il cap prendeva le prime 20 righe
    // (tutte a rischio zero) e l'agente concludeva "nessun rischio stockout".
    const items = [...(d?.items || [])].sort((a, b) => (Number(b.priorityScore) || 0) - (Number(a.priorityScore) || 0))
    return { data: { kpi: d?.kpis || null, aRischio: capArr(items, 20), totale: (d?.items || []).length }, jit: `Inventario live. ${JIT_NUM} Le righe sono già ordinate per priorità (giorni a stockout + valore perso): cita le prime.` }
  }
  if (name === 'get_email_marketing') {
    const days = Number.isFinite(args.days) ? args.days : 30
    const [d, bd] = await Promise.all([
      ifetch(ctx, `/api/klaviyo?days=${days}`),
      ifetch(ctx, `/api/klaviyo?part=breakdown&days=${days}`).catch(() => null),
    ])
    const c = d && typeof d === 'object' ? {
      account: d.account?.name || null,
      kpi: d.kpis ? { inviate: d.kpis.received?.total, aperture: d.kpis.opened?.total, click: d.kpis.clicked?.total, openRate: d.kpis.openRate, clickRate: d.kpis.clickRate, fatturato: d.kpis.revenue?.total } : null,
      campagneInviate: capArr((bd?.revenueBreakdown?.campaigns?.rows || []).map(r => ({ nome: r.name, fatturato: r.revenue, destinatari: r.recipients, aperture: r.openRate, click: r.clickRate })), 10),
      flussiTop: capArr((bd?.revenueBreakdown?.flows?.rows || []).map(r => ({ nome: r.name, fatturato: r.revenue })), 8),
      flussi: capArr((d.flows || []).map(f => ({ nome: f.name, stato: f.status })), 10),
      liste: (d.lists || []).length, segmenti: (d.segments || []).length,
    } : d
    return { data: c, jit: `Email marketing live (${days}g). ${JIT_NUM} \`kpi.fatturato\` è il totale ordini del negozio nella finestra (metrica Placed Order), NON il fatturato attribuito alle email: per l'attribuzione usa \`campagneInviate[].fatturato\` e \`flussiTop[].fatturato\`.` }
  }
  if (name === 'get_pnl') {
    const months = Number.isFinite(args.months) ? Math.min(24, args.months) : 6
    const d = await ifetch(ctx, `/api/pnl?months=${months}`)
    const c = d && typeof d === 'object' ? { mesi: capArr(d.series, months), cogsPerMese: d.cogsByMonth || null, commissioniPerMese: d.feesByMonth || null, margineMedio: d.avgMargin ?? null, fonteCogs: d.cogsSource || null } : d
    return { data: c, jit: `Conto economico live (${months} mesi). ${JIT_NUM} EBIT e margine dipendono dai costi configurati: se mancano, dillo invece di stimare.` }
  }
  if (name === 'get_cro') {
    // /api/cro accetta SOLO since/until: col preset rispondeva sempre 30 giorni
    // etichettati col periodo chiesto (numeri sbagliati con sicurezza).
    const { since, until, label } = presetToDates(args.period)
    const d = await ifetch(ctx, `/api/cro?since=${since}&until=${until}`)
    const c = d && typeof d === 'object' ? { funnel: d.funnel || null, fatturato: d.totalRevenue, ordini: d.totalOrders, sessioni: d.sessions, nuoviClienti: d.newCustomers, ritornanti: d.returningCustomers, precedente: d.prev || null, periodo: d.range || { since, until } } : d
    return { data: c, jit: `Funnel sito live (${label}: ${since} → ${until}). ${JIT_NUM} Conversion rate = acquisti / sessioni.` }
  }
  if (name === 'get_customers') {
    const d = await ifetch(ctx, '/api/customers')
    const segs = d?.segments || {}
    const c = { kpi: d?.kpis || null, segmenti: Object.fromEntries(Object.entries(segs).map(([k, v]) => [k, { clienti: v?.count, valoreMedio: v?.customerValue, ordiniMedi: v?.avgOrders, giorniTraOrdini: v?.daysBetween }])) }
    return { data: c, jit: `Base clienti live (RFM). ${JIT_NUM} I segmenti a rischio sono quelli col valore recuperabile più alto: citali per primi se la domanda è su retention.` }
  }
  if (name === 'get_ga4_traffic') {
    const days = Number.isFinite(args.days) ? args.days : 30
    const d = await ifetch(ctx, `/api/ga4?days=${days}`)
    const c = d && typeof d === 'object' ? { totali: d.summary || null, canali: capArr(d.channels, 8), pagine: capArr(d.topPages, 8), paesi: capArr(d.topCountries, 6), configurato: d.configured !== false } : d
    return { data: c, jit: `Traffico GA4 live (${days}g). ${JIT_NUM} Le sessioni GA4 possono differire da quelle Shopify: sono strumenti di misura diversi, non sono un errore.` }
  }
  if (name === 'get_ltv') {
    const d = await ifetch(ctx, '/api/ltv-auto?months=24')
    return { data: d, jit: `LTV live. ${JIT_NUM} Attenzione: qui c'è solo l'LTV LORDO proiettato (projectedLtvGross), l'AOV e il repeat rate. LTV NETTO, CAC e ratio LTV:CAC NON sono in questi dati: per il netto serve il margine (get_pnl o costi prodotto) e per il CAC la spesa ads / nuovi clienti (get_kpis). Se li citi, dichiara che è un tuo calcolo.` }
  }
  if (name === 'list_products') {
    const d = await ifetch(ctx, '/api/product-performance')
    // Ordinati per ricavo: senza sort il cap prendeva 10 prodotti a caso su migliaia
    const all = [...(d?.products || d?.rows || [])].sort((a, b) => (Number(b.netRevenue) || 0) - (Number(a.netRevenue) || 0))
    const rows = capArr(all, Math.min(args.limit || 10, 20))
    return { data: { rows, totals: d?.totals || null }, jit: `Top prodotti per ricavo (P&L per prodotto). ${JIT_NUM} Guarda il margine operativo, non solo il ricavo.` }
  }
  return null // tool solo-snapshot (tasks, lyftimer)
}

// Micro-cache per-istanza dei risultati live (TTL 90s): nella stessa
// conversazione ridomandare un dato non rifà il fetch → round molto più rapidi.
const liveCache = new Map() // key → { out, ts }
const LIVE_TTL_MS = 90_000

export async function executeToolLive(name, args = {}, ctx = {}) {
  const canLive = ctx && ctx.origin && (ctx.cookie || ctx.cronSecret || ctx.callToken)
  if (canLive) {
    // Hash dell'INTERO cookie (l'active_workspace può stare ovunque nell'header:
    // gli ultimi 40 char mischiavano i workspace di un'agency entro i 90s) +
    // eventuale workspaceId esplicito del chiamante.
    const ident = createHash('sha1').update(String(ctx.cookie || ctx.callToken || ctx.cronSecret) + '|' + (ctx.workspaceId || '')).digest('hex')
    const key = `${ident}|${name}|${JSON.stringify(args)}`
    const hit = liveCache.get(key)
    if (hit && Date.now() - hit.ts < LIVE_TTL_MS) return hit.out
    try {
      const out = await liveResult(name, args, ctx)
      if (out) {
        if (liveCache.size > 300) liveCache.clear()
        liveCache.set(key, { out, ts: Date.now() })
        return out
      }
    } catch (e) {
      // live fallito → si degrada allo snapshot sotto
    }
  }
  if (ctx.snapshot) {
    const data = executeTool(name, args, ctx.snapshot)
    return { data, jit: 'Dato da snapshot (potrebbe non essere aggiornatissimo): se il numero è critico, dillo.' }
  }
  return { data: { error: 'dato non disponibile al momento' }, jit: 'Di\' onestamente che il dato non è raggiungibile ora, senza inventare.' }
}

const lc = s => String(s || '').toLowerCase()
const byNum = key => (a, b) => (Number(b[key]) || 0) - (Number(a[key]) || 0)

export function executeTool(name, args = {}, d = {}) {
  try {
    if (name === 'get_kpis') return periodKPIs(d, PERIODS.includes(args.period) ? args.period : 'last_30d')

    if (name === 'list_creatives') {
      let arr = Array.isArray(d.creatives) ? [...d.creatives] : []
      if (args.name) arr = arr.filter(c => lc(c.name).includes(lc(args.name)))
      const key = { spend: 'spend', roas: 'roas', ctr: 'ctr', purchases: 'purchases' }[args.sort] || 'spend'
      arr.sort(byNum(key))
      return arr.slice(0, Math.min(args.limit || 8, 20)).map(c => ({
        name: c.name, adset: c.adset, campaign: c.campaign, spend: Math.round(c.spend || 0),
        roas: c.roas, ctr: c.ctr, cpc: c.cpc, purchases: c.purchases,
        copy: c.copy ? String(c.copy).slice(0, 180) : null, cta: c.cta,
        products: Array.isArray(c.products) ? c.products.map(p => p.name).filter(Boolean).slice(0, 6) : [],
      }))
    }

    if (name === 'list_adsets') {
      let rows = Array.isArray(d.metaDetail?.campaigns) ? [...d.metaDetail.campaigns] : []
      if (args.name) rows = rows.filter(r => lc(r.adset_name).includes(lc(args.name)) || lc(r.campaign_name).includes(lc(args.name)) || lc(r.name).includes(lc(args.name)))
      const key = { spend: 'spend', roas: 'roas', ctr: 'ctr_link', purchases: 'purchases' }[args.sort] || 'spend'
      rows.sort(byNum(key))
      return rows.slice(0, Math.min(args.limit || 8, 25)).map(r => ({
        campaign: r.campaign_name, adset: r.adset_name, ad: r.ad_name || r.name,
        spend: Math.round(r.spend || 0), roas: r.roas, ctr: r.ctr_link, cpc: r.cpc_link,
        frequency: r.frequency, purchases: r.purchases, purchase_value: r.purchase_value, status: r.status,
      }))
    }

    if (name === 'list_tasks') {
      let tasks = Array.isArray(d._tasks) ? [...d._tasks] : []
      if (args.status) tasks = tasks.filter(t => lc(t.status) === lc(args.status))
      if (args.assignee) tasks = tasks.filter(t => lc(t.assignee_name || t.assignee).includes(lc(args.assignee)))
      return tasks.slice(0, 30).map(t => ({ title: t.title, status: t.status, priority: t.priority, assignee: t.assignee_name || t.assignee || null, due_date: t.due_date }))
    }

    if (name === 'get_time_tracking') {
      const lt = d._lyftimer || {}
      let entries = Array.isArray(lt.byPerson) ? lt.byPerson : (Array.isArray(lt.entries) ? lt.entries : [])
      if (args.person) entries = entries.filter(e => lc(e.name || e.person).includes(lc(args.person)))
      return { totalHours: lt.totalHours ?? null, byPerson: entries.slice(0, 30), byProject: (lt.byProject || []).slice(0, 30) }
    }

    if (name === 'list_products') {
      const arr = Array.isArray(d.shopify?.topProducts) ? d.shopify.topProducts : []
      return arr.slice(0, Math.min(args.limit || 10, 20)).map(p => ({ product: p.label || p.product, revenue: Math.round(p.revenue || 0), orders: p.orders, quantity: p.quantity }))
    }
  } catch (e) {
    return { error: e?.message || 'errore tool' }
  }
  return { error: 'strumento non disponibile in questo contesto (nessun dato live né snapshot): dillo esplicitamente invece di stimare' }
}
