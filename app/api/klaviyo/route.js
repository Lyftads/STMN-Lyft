export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'

const API_KEY = process.env.KLAVIYO_API_KEY
const BASE = 'https://a.klaviyo.com/api'
const HEADERS = {
  Authorization: `Klaviyo-API-Key ${API_KEY}`,
  accept: 'application/json',
  revision: '2024-10-15',
}

async function klaviyoGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS, cache: 'no-store' })
  if (!res.ok) return null
  return res.json()
}

async function klaviyoPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { ...HEADERS, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
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
  const data = await klaviyoGet('/metrics')
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
  start.setDate(start.getDate() - days)

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

export async function GET(request) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'KLAVIYO_API_KEY not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30', 10)

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

    return NextResponse.json({
      account,
      lists,
      segments,
      campaigns: { sent, draft, scheduled },
      flows,
      metrics,
      kpis,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
