export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

const BASE = 'https://business-api.tiktok.com/open_api/v1.3'

async function tiktokGet(path, params = {}) {
  const url = new URL(`${BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v))
  const res = await fetch(url.toString(), {
    headers: {
      'Access-Token': process.env.TIKTOK_ACCESS_TOKEN,
    },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.code === 0 ? data.data : null
}

export async function GET(request) {
  const hasConfig = process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_ADVERTISER_ID
  if (!hasConfig) {
    return NextResponse.json({ configured: false })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30', 10)

  const advertiserId = process.env.TIKTOK_ADVERTISER_ID
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  const fmt = d => d.toISOString().slice(0, 10)

  try {
    const report = await tiktokGet('/report/integrated/get/', {
      advertiser_id: advertiserId,
      report_type: 'BASIC',
      data_level: 'AUCTION_ADVERTISER',
      dimensions: JSON.stringify(['stat_time_day']),
      metrics: JSON.stringify([
        'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm',
        'conversions', 'cost_per_conversion', 'conversion_rate',
        'reach', 'frequency',
      ]),
      start_date: fmt(start),
      end_date: fmt(now),
      page_size: 90,
    })

    const rows = (report?.list || []).map(r => ({
      date: r.dimensions?.stat_time_day,
      spend: parseFloat(r.metrics?.spend || '0'),
      impressions: parseInt(r.metrics?.impressions || '0', 10),
      clicks: parseInt(r.metrics?.clicks || '0', 10),
      ctr: parseFloat(r.metrics?.ctr || '0'),
      cpc: parseFloat(r.metrics?.cpc || '0'),
      cpm: parseFloat(r.metrics?.cpm || '0'),
      conversions: parseInt(r.metrics?.conversions || '0', 10),
      costPerConversion: parseFloat(r.metrics?.cost_per_conversion || '0'),
      conversionRate: parseFloat(r.metrics?.conversion_rate || '0'),
      reach: parseInt(r.metrics?.reach || '0', 10),
    }))

    const totals = rows.reduce((acc, r) => {
      acc.spend += r.spend
      acc.impressions += r.impressions
      acc.clicks += r.clicks
      acc.conversions += r.conversions
      acc.reach += r.reach
      return acc
    }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, reach: 0 })

    totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
    totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
    totals.cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0

    const campaigns = await tiktokGet('/campaign/get/', {
      advertiser_id: advertiserId,
      filtering: JSON.stringify({ status: 'CAMPAIGN_STATUS_ENABLE' }),
      page_size: 20,
    })

    const campaignList = (campaigns?.list || []).map(c => ({
      id: c.campaign_id,
      name: c.campaign_name,
      objective: c.objective_type,
      budget: parseFloat(c.budget || '0'),
      status: c.operation_status,
    }))

    return NextResponse.json({
      configured: true,
      totals,
      daily: rows,
      campaigns: campaignList,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ configured: false, error: e.message }, { status: 500 })
  }
}
