export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

async function pinterestGet(path) {
  const res = await fetch(`https://api.pinterest.com/v5${path}`, {
    headers: { Authorization: `Bearer ${process.env.PINTEREST_ACCESS_TOKEN}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

export async function GET(request) {
  const hasConfig = process.env.PINTEREST_ACCESS_TOKEN && process.env.PINTEREST_AD_ACCOUNT_ID
  if (!hasConfig) {
    return NextResponse.json({ configured: false })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30', 10)
  const adAccountId = process.env.PINTEREST_AD_ACCOUNT_ID

  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  const fmt = d => d.toISOString().slice(0, 10)

  try {
    const report = await pinterestGet(
      `/ad_accounts/${adAccountId}/analytics?start_date=${fmt(start)}&end_date=${fmt(now)}&granularity=DAY&columns=SPEND_IN_MICRO_DOLLAR,IMPRESSION_1,CLICKTHROUGH_1,CTR_1,ECPC_IN_MICRO_DOLLAR,TOTAL_CONVERSIONS,TOTAL_CONVERSIONS_VALUE_IN_MICRO_DOLLAR`
    )

    const rows = (Array.isArray(report) ? report : []).map(r => ({
      date: r.DATE,
      spend: (r.SPEND_IN_MICRO_DOLLAR || 0) / 1000000,
      impressions: r.IMPRESSION_1 || 0,
      clicks: r.CLICKTHROUGH_1 || 0,
      ctr: r.CTR_1 || 0,
      conversions: r.TOTAL_CONVERSIONS || 0,
      conversionValue: (r.TOTAL_CONVERSIONS_VALUE_IN_MICRO_DOLLAR || 0) / 1000000,
    }))

    const totals = rows.reduce((acc, r) => {
      acc.spend += r.spend
      acc.impressions += r.impressions
      acc.clicks += r.clicks
      acc.conversions += r.conversions
      acc.conversionValue += r.conversionValue
      return acc
    }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0 })

    totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
    totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
    totals.roas = totals.spend > 0 ? totals.conversionValue / totals.spend : 0

    return NextResponse.json({ configured: true, totals, daily: rows, updatedAt: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ configured: false, error: e.message }, { status: 500 })
  }
}
