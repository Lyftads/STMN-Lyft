export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

async function snapGet(path) {
  const res = await fetch(`https://adsapi.snapchat.com/v1${path}`, {
    headers: { Authorization: `Bearer ${process.env.SNAPCHAT_ACCESS_TOKEN}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

export async function GET(request) {
  const hasConfig = process.env.SNAPCHAT_ACCESS_TOKEN && process.env.SNAPCHAT_AD_ACCOUNT_ID
  if (!hasConfig) {
    return NextResponse.json({ configured: false })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30', 10)
  const adAccountId = process.env.SNAPCHAT_AD_ACCOUNT_ID

  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  const fmt = d => d.toISOString().slice(0, 10)

  try {
    const stats = await snapGet(
      `/adaccounts/${adAccountId}/stats?granularity=DAY&start_time=${fmt(start)}T00:00:00.000Z&end_time=${fmt(now)}T23:59:59.000Z&fields=impressions,swipes,spend,conversion_purchases,conversion_purchases_value`
    )

    const rows = (stats?.timeseries_stats?.[0]?.timeseries || []).map(r => ({
      date: r.start_time?.slice(0, 10),
      spend: (r.stats?.spend || 0) / 1000000,
      impressions: r.stats?.impressions || 0,
      swipes: r.stats?.swipes || 0,
      conversions: r.stats?.conversion_purchases || 0,
      conversionValue: (r.stats?.conversion_purchases_value || 0) / 1000000,
    }))

    const totals = rows.reduce((acc, r) => {
      acc.spend += r.spend
      acc.impressions += r.impressions
      acc.swipes += r.swipes
      acc.conversions += r.conversions
      acc.conversionValue += r.conversionValue
      return acc
    }, { spend: 0, impressions: 0, swipes: 0, conversions: 0, conversionValue: 0 })

    totals.ctr = totals.impressions > 0 ? (totals.swipes / totals.impressions) * 100 : 0
    totals.roas = totals.spend > 0 ? totals.conversionValue / totals.spend : 0

    return NextResponse.json({ configured: true, totals, daily: rows, updatedAt: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ configured: false, error: e.message }, { status: 500 })
  }
}
