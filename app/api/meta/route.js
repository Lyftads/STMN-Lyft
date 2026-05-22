export const dynamic = 'force-dynamic'
// app/api/meta/route.js
// Pulls ad spend from Meta Marketing API — supporta più account pubblicitari
import { NextResponse } from 'next/server'
import { subDays, format } from 'date-fns'

const META_TOKEN    = process.env.META_ACCESS_TOKEN
// Supporta più account separati da virgola: act_111,act_222
const META_ACCOUNTS = (process.env.META_AD_ACCOUNT_ID || '').split(',').map(s => s.trim()).filter(Boolean)

async function fetchAccountSpend(accountId, since, until) {
  const url = `https://graph.facebook.com/v19.0/${accountId}/insights?` +
    `fields=spend,impressions,clicks&` +
    `time_range={"since":"${since}","until":"${until}"}&` +
    `time_increment=monthly&` +
    `access_token=${META_TOKEN}`

  const res  = await fetch(url, { next: { revalidate: 3600 } })
  const data = await res.json()
  if (data.error) throw new Error(`[${accountId}] ${data.error.message}`)
  return data.data || []
}

export async function GET() {
  try {
    if (!META_TOKEN || META_ACCOUNTS.length === 0) {
      return NextResponse.json({ error: 'Meta non configurato' }, { status: 500 })
    }

    const since = format(subDays(new Date(), 365), 'yyyy-MM-dd')
    const until = format(new Date(), 'yyyy-MM-dd')

    // Fetch tutti gli account in parallelo
    const results = await Promise.all(META_ACCOUNTS.map(id => fetchAccountSpend(id, since, until)))

    // Aggrega per mese sommando tutti gli account
    const monthlyMap = {}
    for (const accountData of results) {
      for (const d of accountData) {
        const month = d.date_start?.slice(0,7)
        if (!month) continue
        if (!monthlyMap[month]) monthlyMap[month] = { spend: 0, impressions: 0, clicks: 0 }
        monthlyMap[month].spend       += parseFloat(d.spend || 0)
        monthlyMap[month].impressions += parseInt(d.impressions || 0)
        monthlyMap[month].clicks      += parseInt(d.clicks || 0)
      }
    }

    const monthly = Object.entries(monthlyMap)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month,
        spend:       Math.round(d.spend * 100) / 100,
        impressions: d.impressions,
        clicks:      d.clicks,
      }))

    const totalSpend = monthly.reduce((s, m) => s + m.spend, 0)

    return NextResponse.json({
      totalSpend:   Math.round(totalSpend * 100) / 100,
      monthly,
      accounts:     META_ACCOUNTS,
      currency:     'EUR',
      updatedAt:    new Date().toISOString(),
    })
  } catch (err) {
    console.error('Meta error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
