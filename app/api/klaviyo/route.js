export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getKlaviyo, getTenantInfo } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'

// Cache server-side: la tab fa molte chiamate Klaviyo (lente). 5 min TTL così
// riaprire la tab è istantaneo. ?force=1 bypassa.
const klaviyoCache = new Map()
const KLAVIYO_TTL_MS = 5 * 60_000

// Tenant-aware getter (env-only mode di default)
const klaviyoApiKey = () => getKlaviyo().apiKey
const BASE = 'https://a.klaviyo.com/api'
// Klaviyo accetta due schemi di auth diversi:
//  - Private API key  → "Klaviyo-API-Key <key>"
//  - OAuth (via Nango) → "Bearer <access_token>"
// getKlaviyo().isOAuth indica quale usare.
const buildHeaders = () => {
  const k = getKlaviyo()
  const token = k.apiKey || ''
  return {
    Authorization: k.isOAuth ? `Bearer ${token}` : `Klaviyo-API-Key ${token}`,
    accept: 'application/json',
    revision: '2024-10-15',
  }
}

async function klaviyoGet(path, retries = 3) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: buildHeaders(), cache: 'no-store', signal: AbortSignal.timeout(12000) })
      if (res.status === 429) { await new Promise(r => setTimeout(r, (i + 1) * 1500)); continue }
      if (!res.ok) return null
      return res.json()
    } catch { return null } // timeout/rete → non bloccare l'intera tab
  }
  return null
}

// Segue i cursori di paginazione Klaviyo. Necessario su /campaigns (default
// ~10 risultati/pagina): senza, la lista si fermava alla prima pagina e le
// campagne più vecchie sparivano dalla tab.
// NB: NIENTE page[size] custom — su alcuni account/connessioni l'endpoint
// campagne lo rifiuta con 400 e la lista risultava VUOTA. Si segue il
// page[cursor] dei link `next` generati da Klaviyo, con più pagine.
async function klaviyoGetPages(path, maxPages = 15) {
  const out = { data: [], included: [] }
  let next = path, guard = 0
  while (next && guard < maxPages) {
    guard++
    const page = await klaviyoGet(next)
    if (!page?.data) break
    out.data.push(...page.data)
    if (Array.isArray(page.included)) out.included.push(...page.included)
    next = page.links?.next || null
  }
  return out.data.length ? out : null
}

async function klaviyoPost(path, body, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { ...buildHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(20000), // i value-report sono più lenti
      })
      if (res.status === 429) { await new Promise(r => setTimeout(r, (i + 1) * 1500)); continue }
      if (!res.ok) return null
      return res.json()
    } catch { return null }
  }
  return null
}

async function getAccount() {
  const data = await klaviyoGet('/accounts')
  if (!data?.data?.[0]) return null
  const a = data.data[0].attributes
  const c = a.contact_information || {}
  return {
    name: c.organization_name,
    senderName: c.default_sender_name,
    email: c.default_sender_email,
    website: c.website_url,
    industry: a.industry,
    currency: a.preferred_currency,
    timezone: a.timezone,
  }
}

async function getLists() {
  const data = await klaviyoGetPages('/lists')
  return (data?.data || []).map(i => ({
    id: i.id,
    name: i.attributes?.name,
  }))
}

async function getSegments() {
  const data = await klaviyoGetPages('/segments')
  return (data?.data || []).map(i => ({
    id: i.id,
    name: i.attributes?.name,
    isActive: i.attributes?.is_active,
  }))
}

async function getCampaigns(status) {
  let filter = 'equals(messages.channel,"email")'
  if (status) filter += `,equals(status,"${status}")`
  const enc = encodeURIComponent(filter)
  // Includo i campaign-messages per ricavare il SUBJECT dell'email: il `name`
  // della campagna è spesso un nome interno generico ("Email 1") mentre il
  // subject è l'identificatore utile mostrato in tabella. Se l'include non è
  // supportato/permesso, fallback alla chiamata semplice (nessuna regressione).
  let data = await klaviyoGetPages(`/campaigns?filter=${enc}&include=campaign-messages`)
  if (!data?.data) data = await klaviyoGetPages(`/campaigns?filter=${enc}`)

  // messageId → subject dai record inclusi. Il path del subject cambia tra le
  // revision dell'API Klaviyo: provo tutte le forme note.
  const subjById = {}
  for (const inc of (data?.included || [])) {
    if (inc.type !== 'campaign-message') continue
    const a = inc.attributes || {}
    const subj =
      a.definition?.content?.subject ||
      a.content?.subject ||
      a.definition?.content?.preview_text ||
      a.content?.preview_text ||
      a.label ||
      null
    if (subj && String(subj).trim()) subjById[inc.id] = String(subj).trim()
  }

  return (data?.data || []).map(i => {
    const msgIds = (i.relationships?.['campaign-messages']?.data || []).map(m => m.id)
    const subject = msgIds.map(id => subjById[id]).find(Boolean) || null
    return {
      id: i.id,
      // Subject come display name; fallback al nome interno della campagna.
      name: subject || i.attributes?.name,
      campaignName: i.attributes?.name,
      status: i.attributes?.status,
      sendTime: i.attributes?.send_time,
    }
  })
}

async function getFlows() {
  const data = await klaviyoGetPages('/flows')
  return (data?.data || []).map(i => ({
    id: i.id,
    name: i.attributes?.name,
    status: i.attributes?.status,
    triggerType: i.attributes?.trigger_type,
  }))
}

async function getMetrics() {
  // Paginato: le metriche standard (Received/Opened/Clicked Email, Placed
  // Order) possono stare OLTRE la prima pagina → KPI a zero in silenzio.
  const data = await klaviyoGetPages('/metrics')
  return (data?.data || []).map(i => ({
    id: i.id,
    name: i.attributes?.name,
    integrationKey: i.attributes?.integration?.key || '',
    integrationName: i.attributes?.integration?.name || '',
  }))
}

async function queryMetric(metricId, measurement, days) {
  const now = new Date()
  const start = new Date(now)
  if (days === 0) {
    // "Oggi": da mezzanotte (locale Europe/Rome ~UTC+2 estate) a now.
    start.setHours(0, 0, 0, 0)
  } else {
    start.setDate(start.getDate() - days)
  }

  const body = {
    data: {
      type: 'metric-aggregate',
      attributes: {
        metric_id: metricId,
        measurements: [measurement],
        interval: 'day',
        filter: [
          `greater-or-equal(datetime,${start.toISOString()})`,
          `less-than(datetime,${now.toISOString()})`,
        ],
        timezone: 'Europe/Rome',
      },
    },
  }
  const data = await klaviyoPost('/metric-aggregates', body)
  const attrs = data?.data?.attributes || {}
  const dates = attrs.dates || []
  const row = (attrs.data || [])[0]
  const values = row?.measurements?.[measurement] || []
  const total = values.reduce((a, v) => a + (v || 0), 0)
  return { dates, values, total }
}

async function getEmailKPIs(days, metrics) {
  const find = (name, integration) => metrics.find(m =>
    m.name.toLowerCase() === name.toLowerCase() &&
    (!integration || m.integrationKey === integration)
  )

  const targets = {
    received: { metric: find('Received Email', 'klaviyo'), measurement: 'count' },
    opened: { metric: find('Opened Email', 'klaviyo'), measurement: 'count' },
    clicked: { metric: find('Clicked Email', 'klaviyo'), measurement: 'count' },
    bounced: { metric: find('Bounced Email', 'klaviyo'), measurement: 'count' },
    unsubscribed: { metric: find('Unsubscribed from List', 'klaviyo'), measurement: 'count' },
    revenue: { metric: find('Placed Order', 'shopify'), measurement: 'sum_value' },
  }

  const results = {}
  // Query metriche IN PARALLELO (prima erano 6 chiamate sequenziali → lentissimo)
  const entries = Object.entries(targets)
  const fetched = await Promise.all(entries.map(([, { metric, measurement }]) =>
    metric ? queryMetric(metric.id, measurement, days) : Promise.resolve({ total: 0, dates: [], values: [] })
  ))
  entries.forEach(([key], i) => { results[key] = fetched[i] })

  const r = results.received.total
  const o = results.opened.total
  const c = results.clicked.total

  results.openRate = r > 0 ? (o / r) * 100 : 0
  results.clickRate = r > 0 ? (c / r) * 100 : 0
  results.ctor = o > 0 ? (c / o) * 100 : 0

  return results
}

async function getRevenueBreakdown(campaigns, flowsList, days, metrics) {
  const campaignMap = {}
  for (const c of campaigns) { campaignMap[c.id] = c.name }
  const flowMap = {}
  for (const f of flowsList) { flowMap[f.id] = f.name }

  const placedOrder = metrics.find(m =>
    m.name.toLowerCase() === 'placed order' && m.integrationKey === 'shopify'
  )
  // Metric ID hardcoded = di UN account specifico: su altri tenant produceva
  // breakdown vuoto cachato come valido. Senza metric → null → __noCache.
  if (!placedOrder?.id) return null
  const placedOrderMetric = placedOrder.id

  const now = new Date()
  const start = new Date(now)
  if (days === 0) {
    start.setHours(0, 0, 0, 0)
  } else {
    start.setDate(start.getDate() - days)
  }
  const timeframe = {
    start: start.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
  }

  // NB: niente group_by (non accettato da questi report → 400 → vuoto).
  // I report tornano righe per messaggio/canale → aggrego per id lato server.
  const campRes = await klaviyoPost('/campaign-values-reports', {
    data: {
      type: 'campaign-values-report',
      attributes: {
        statistics: ['conversion_value', 'conversions', 'recipients', 'open_rate', 'click_rate'],
        timeframe,
        conversion_metric_id: placedOrderMetric,
      },
    },
  })

  const flowRes = await klaviyoPost('/flow-values-reports', {
    data: {
      type: 'flow-values-report',
      attributes: {
        statistics: ['conversion_value', 'conversions', 'recipients', 'open_rate', 'click_rate'],
        timeframe,
        conversion_metric_id: placedOrderMetric,
      },
    },
  })

  // Aggrega le righe per id (somma revenue/conv/destinatari; tassi pesati sui destinatari)
  const aggregate = (results, idKey, nameMap) => {
    const map = {}
    for (const r of (results || [])) {
      const g = r.groupings || {}
      const s = r.statistics || {}
      const id = g[idKey]
      if (!id) continue
      if (!map[id]) map[id] = { id, name: nameMap[id] || g.flow_name || g.campaign_name || id, revenue: 0, conversions: 0, recipients: 0, wOpen: 0, wClick: 0 }
      const rec = s.recipients || 0
      const m = map[id]
      m.revenue += s.conversion_value || 0
      m.conversions += s.conversions || 0
      m.recipients += rec
      m.wOpen += (s.open_rate || 0) * rec
      m.wClick += (s.click_rate || 0) * rec
    }
    return Object.values(map).map(m => ({
      [idKey === 'campaign_id' ? 'campaignId' : 'flowId']: m.id,
      name: m.name,
      revenue: m.revenue,
      conversions: m.conversions,
      recipients: m.recipients,
      revenuePerRecipient: m.recipients > 0 ? m.revenue / m.recipients : 0,
      openRate: m.recipients > 0 ? (m.wOpen / m.recipients) * 100 : 0,
      clickRate: m.recipients > 0 ? (m.wClick / m.recipients) * 100 : 0,
    // Tengo anche le righe SENZA revenue: sono la fonte di open/click/
    // destinatari della tabella campagne (prima sparivano tutte le stats
    // delle campagne senza vendite attribuite).
    })).filter(r => r.revenue > 0 || r.recipients > 0 || r.conversions > 0)
      .sort((a, b) => b.revenue - a.revenue)
  }

  const campRows = aggregate(campRes?.data?.attributes?.results, 'campaign_id', campaignMap)
  const flowRows = aggregate(flowRes?.data?.attributes?.results, 'flow_id', flowMap)

  return {
    campaigns: {
      rows: campRows,
      total: campRows.reduce((a, r) => a + r.revenue, 0),
      totalConversions: campRows.reduce((a, r) => a + r.conversions, 0),
    },
    flows: {
      rows: flowRows,
      total: flowRows.reduce((a, r) => a + r.revenue, 0),
      totalConversions: flowRows.reduce((a, r) => a + r.conversions, 0),
    },
  }
}

export async function GET(request) {
  return withTenantContext(request, async () => {
  if (!klaviyoApiKey()) {
    return NextResponse.json({ error: 'KLAVIYO_API_KEY not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)

  const daysParam = searchParams.get('days')
  const days = daysParam != null ? parseInt(daysParam, 10) : 30

  // I value-report (revenue breakdown) sono LENTI → serviti su una chiamata
  // separata (?part=breakdown) così la tab carica subito i dati veloci.
  const part = searchParams.get('part') || 'main'

  // tab key versionata 'klaviyo4': invalida sia le liste troncate a 1 pagina
  // sia gli snapshot VUOTI cachati quando page[size] veniva rifiutato (400).
  return swrSnapshot(request, { tab: 'klaviyo4', compute: async () => {
    try {
      if (part === 'breakdown') {
        const [flows, metrics, sent] = await Promise.all([getFlows(), getMetrics(), getCampaigns('Sent')])
        const revenueBreakdown = await getRevenueBreakdown(sent, flows, days, metrics).catch(() => null)
        // breakdown nullo (timeout/limite) → non cachare, così si riprova
        return revenueBreakdown ? { revenueBreakdown } : { __noCache: true, revenueBreakdown: null }
      }

      // MAIN: solo dati veloci (niente value-report)
      const [account, lists, segments, sent, draft, scheduled, flows, metrics] = await Promise.all([
        getAccount(),
        getLists(),
        getSegments(),
        getCampaigns('Sent'),
        getCampaigns('Draft'),
        getCampaigns('Scheduled'),
        getFlows(),
        getMetrics(),
      ])
      const kpis = await getEmailKPIs(days, metrics)

      return {
        account, lists, segments,
        campaigns: { sent, draft, scheduled },
        flows, metrics, kpis,
      }
    } catch (e) {
      return { __noCache: true, error: e.message }
    }
  } })
  })
}
