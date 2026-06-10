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
