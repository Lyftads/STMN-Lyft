import { periodKPIs } from './brandSnapshot'

// ============================================================================
//  STRUMENTI degli agent: interrogano i dati del software (snapshot arricchito)
//  per rispondere a QUALSIASI domanda — KPI, creative, adset, competitor, task,
//  Lyftimer. In formato OpenAI function-calling. Usati da call e chat.
// ============================================================================

const PERIODS = ['today', 'yesterday', 'this_week', 'last_week', 'last_7d', 'last_14d', 'this_month', 'last_month', 'last_30d']

export const TOOLS = [
  { type: 'function', function: { name: 'get_kpis', description: 'KPI completi del brand per un periodo: fatturato, ordini, AOV, nuovi/ritorno clienti, repeat rate, LTV, sessioni, conversion rate, resi, spesa ads, ROAS, MER, CTR, CPC, CPM, frequency, CAC.', parameters: { type: 'object', properties: { period: { type: 'string', enum: PERIODS } }, required: ['period'] } } },
  { type: 'function', function: { name: 'list_creatives', description: 'Elenca le creatività (ads) con i loro KPI: spesa, ROAS, CTR, CPC, acquisti, copy, CTA, prodotti del carosello.', parameters: { type: 'object', properties: { name: { type: 'string', description: 'filtra per nome creatività' }, sort: { type: 'string', enum: ['spend', 'roas', 'ctr', 'purchases'] }, limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'list_adsets', description: 'Elenca adset/campagne Meta con i loro KPI: spesa, ROAS, CTR, CPC, frequency, acquisti, valore acquisti.', parameters: { type: 'object', properties: { name: { type: 'string', description: 'filtra per nome adset o campagna' }, sort: { type: 'string', enum: ['spend', 'roas', 'ctr', 'purchases'] }, limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'get_competitors', description: 'Dati competitor: prodotti, prezzi, categorie, promozioni e creatività dei competitor.', parameters: { type: 'object', properties: { name: { type: 'string', description: 'nome competitor (opzionale)' } } } } },
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
]
export const ALL_TOOLS = [...TOOLS, ...LIVE_TOOLS]

// Subset VELOCE per i flussi generativi non-conversazionali (insight, azioni,
// note/to-do, report): esclude i tool lenti (competitor via Browserless,
// inventario via bulk Shopify) per non gonfiare la latenza dei job.
const SLOW_TOOL_NAMES = new Set(['get_competitors', 'get_inventory'])
export const FAST_TOOLS = ALL_TOOLS.filter(t => !SLOW_TOOL_NAMES.has(t.function.name))

// Mappa i periodi degli agent sui preset del timeframe picker delle tab.
const PRESET_MAP = { today: 'today', yesterday: 'yesterday', this_week: 'this_week', last_week: 'last_week', last_7d: 'last_7d', last_14d: 'last_14d', this_month: 'this_month', last_month: 'last_month', last_30d: 'last_30d' }

// ── EXECUTOR LIVE (stile Sidekick) ──────────────────────────────────────────
// I tool leggono le route interne ON-DEMAND con l'auth della richiesta
// (cookie di sessione, o CRON_SECRET per call vocali/job) → multi-tenant per
// costruzione, dati sempre freschi, prompt di sistema magro e stabile.
// Ogni risultato torna { data, jit }: le istruzioni di dominio viaggiano COL
// dato (Just-in-Time), non nel system prompt.
// Fallback: se il fetch live fallisce e c'è uno snapshot, si degrada al
// vecchio executeTool (con nota jit), così niente si rompe.
async function ifetch(ctx, path) {
  const headers = {}
  if (ctx.cookie) headers.cookie = ctx.cookie
  else if (ctx.cronSecret) headers['x-internal-cron'] = ctx.cronSecret
  const r = await fetch(`${ctx.origin}${path}`, { headers, cache: 'no-store', signal: AbortSignal.timeout(25000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}
const capArr = (a, n) => Array.isArray(a) ? a.slice(0, n) : a
const JIT_NUM = 'Copia i numeri LETTERALMENTE, senza arrotondare né stimare. Se un campo è null/assente, dillo.'

async function liveResult(name, args, ctx) {
  if (name === 'get_kpis') {
    const preset = PRESET_MAP[args.period] || 'last_30d'
    const d = await ifetch(ctx, `/api/metrics?preset=${preset}`)
    return { data: d, jit: `KPI live del periodo ${preset}. ${JIT_NUM} ROAS/MER già calcolati: non ricalcolarli.` }
  }
  if (name === 'list_creatives' || name === 'list_adsets') {
    const preset = PRESET_MAP[args.period] || 'last_30d'
    const level = name === 'list_creatives' ? 'ad' : 'adset'
    const d = await ifetch(ctx, `/api/meta-detail?level=${level}&preset=${preset}`)
    const rows = capArr(d?.campaigns || d?.rows || d?.data || [], Math.min(args.limit || 10, 25))
    return { data: { rows, totals: d?.totals || null }, jit: `Meta Ads live (level ${level}). ${JIT_NUM} Cita i NOMI esatti di campagne/adset/creative.` }
  }
  if (name === 'get_google_campaigns') {
    const preset = PRESET_MAP[args.period] || 'last_30d'
    const d = await ifetch(ctx, `/api/google-detail?level=campaign&preset=${preset}`)
    const rows = capArr(d?.campaigns || d?.rows || d?.data || [], Math.min(args.limit || 10, 25))
    return { data: { rows, totals: d?.totals || null }, jit: `Google Ads live. ${JIT_NUM} ROAS Google = valore conv. ÷ spesa; le campagne PMAX non hanno breakdown keyword.` }
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
    return { data: d, jit: `Incrementalità live. ${JIT_NUM} Il ROAS INCREMENTALE è più basso del ROAS di piattaforma per costruzione (esclude vendite che sarebbero arrivate comunque): NON confrontarli come se fossero la stessa metrica. Cita anche l'affidabilità della stima.` }
  }
  if (name === 'get_inventory') {
    const d = await ifetch(ctx, '/api/inventory')
    return { data: { items: capArr(d?.items || d?.products || d?.rows || d, 20), summary: d?.summary || d?.totals || null }, jit: `Inventario live. ${JIT_NUM} Priorità: prodotti con pochi giorni a stockout e taglie rotte sui bestseller.` }
  }
  if (name === 'get_ltv') {
    const d = await ifetch(ctx, '/api/ltv-auto?months=24')
    return { data: d, jit: `LTV live (pool 24 mesi, proiettato a maturità). ${JIT_NUM} LTV Netto = già moltiplicato per il margine reale. Ratio LTV:CAC sano ≥ 3.` }
  }
  if (name === 'list_products') {
    const d = await ifetch(ctx, '/api/product-performance')
    const rows = capArr(d?.rows || d?.products || [], Math.min(args.limit || 10, 20))
    return { data: { rows, totals: d?.totals || null }, jit: `Performance prodotti live (P&L per prodotto). ${JIT_NUM} Guarda il margine operativo, non solo il ricavo.` }
  }
  if (name === 'get_competitors') {
    const d = await ifetch(ctx, '/api/competitor-intel')
    const results = capArr((d?.results || []).map(c => ({ name: c.name, website: c.websiteUrl, adsActive: c.adLibrary?.count ?? null, products: c.websiteData?.stats?.totalProducts ?? null, avgPrice: c.websiteData?.stats?.avgPrice ?? null, onSalePct: c.websiteData?.stats?.onSalePct ?? null, social: c.social ? { igFollowers: c.social.instagram?.followers ?? null, fbFans: c.social.facebook?.fans ?? null } : null })), 6)
    return { data: { competitors: results }, jit: `Competitor live. ${JIT_NUM} "adsActive" null = dato non leggibile ora, non "zero ads".` }
  }
  return null // tool solo-snapshot (tasks, lyftimer)
}

// Micro-cache per-istanza dei risultati live (TTL 90s): nella stessa
// conversazione ridomandare un dato non rifà il fetch → round molto più rapidi.
const liveCache = new Map() // key → { out, ts }
const LIVE_TTL_MS = 90_000

export async function executeToolLive(name, args = {}, ctx = {}) {
  const canLive = ctx && ctx.origin && (ctx.cookie || ctx.cronSecret)
  if (canLive) {
    const key = `${String(ctx.cookie || ctx.cronSecret).slice(-40)}|${name}|${JSON.stringify(args)}`
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

    if (name === 'get_competitors') {
      const comp = d._competitors || {}
      let products = Array.isArray(comp.products) ? comp.products : (Array.isArray(d.competitors) ? d.competitors : [])
      if (args.name) products = products.filter(p => lc(p.competitor || p.brand || p.name).includes(lc(args.name)))
      return {
        priceComparison: (comp.rows || comp.items || products).slice(0, 25),
        marketIntel: d.marketIntel || comp.marketIntel || null,
        competitorIntel: d.competitorIntel || comp.intel || null,
      }
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
  return { error: 'tool sconosciuto' }
}
