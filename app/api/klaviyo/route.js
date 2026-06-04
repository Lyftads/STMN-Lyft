export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getKlaviyo } from '../../../lib/tenant/credentials'

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
    const res = await fetch(url, { headers: buildHeaders(), cache: 'no-store' })
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, (i + 1) * 2000))
      continue
    }
    if (!res.ok) return null
    return res.json()
  }
  return null
}

async function klaviyoPost(path, body, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { ...buildHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, (i + 1) * 2000))
      continue
    }
    if (!res.ok) return null
    return res.json()
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
  const data = await klaviyoGet('/lists')
  return (data?.data || []).map(i => ({
    id: i.id,
    name: i.attributes?.name,
  }))
}

async function getSegments() {
  const data = await klaviyoGet('/segments')
  return (data?.data || []).map(i => ({
    id: i.id,
    name: i.attributes?.name,
    isActive: i.attributes?.is_active,
  }))
}

async function getCampaigns(status) {
  let filter = 'equals(messages.channel,"email")'
  if (status) filter += `,equals(status,"${status}")`
  const data = await klaviyoGet(`/campaigns?filter=${encodeURIComponent(filter)}`)
  return (data?.data || []).map(i => ({
    id: i.id,
    name: i.attributes?.name,
    status: i.attributes?.status,
    sendTime: i.attributes?.send_time,
  }))
}

async function getFlows() {
  const data = await klaviyoGet('/flows')
  return (data?.data || []).map(i => ({
    id: i.id,
    name: i.attributes?.name,
    status: i.attributes?.status,
    triggerType: i.attributes?.trigger_type,
  }))
}

async function getMetrics() {
  let all = []
  let url = '/metrics'
  while (url) {
    const data = await klaviyoGet(url)
    if (!data) break
    for (const i of (data.data || [])) {
      all.push({
        id: i.id,
        name: i.attributes?.name,
        integrationKey: i.attributes?.integration?.key || '',
        integrationName: i.attributes?.integration?.name || '',
      })
    }
    url = data.links?.next || null
  }
  return all
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
  for (const [key, { metric, measurement }] of Object.entries(targets)) {
    if (!metric) { results[key] = { total: 0, dates: [], values: [] }; continue }
    results[key] = await queryMetric(metric.id, measurement, days)
  }

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
  const placedOrderMetric = placedOrder?.id || 'RnKt7J'

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

  const campRows = (campRes?.data?.attributes?.results || []).map(r => {
    const g = r.groupings || {}
    const s = r.statistics || {}
    return {
      name: campaignMap[g.campaign_id] || g.campaign_id,
      revenue: s.conversion_value || 0,
      conversions: s.conversions || 0,
      recipients: s.recipients || 0,
      openRate: s.open_rate || 0,
      clickRate: s.click_rate || 0,
    }
  }).filter(r => r.revenue > 0).sort((a, b) => b.revenue - a.revenue)

  const flowRows = (flowRes?.data?.attributes?.results || []).map(r => {
    const g = r.groupings || {}
    const s = r.statistics || {}
    return {
      flowId: g.flow_id,
      name: flowMap[g.flow_id] || g.flow_name || g.flow_id,
      revenue: s.conversion_value || 0,
      conversions: s.conversions || 0,
      recipients: s.recipients || 0,
      openRate: s.open_rate || 0,
      clickRate: s.click_rate || 0,
    }
  }).filter(r => r.revenue > 0).sort((a, b) => b.revenue - a.revenue)

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

  try {
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
    const revenueBreakdown = await getRevenueBreakdown(sent, flows, days, metrics).catch(() => null)

    return NextResponse.json({
      account,
      lists,
      segments,
      campaigns: { sent, draft, scheduled },
      flows,
      metrics,
      kpis,
      revenueBreakdown,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
  })
}
