// app/api/meta/route.js
// Pulls ad spend from Meta Marketing API
import { NextResponse } from 'next/server'
import { subDays, format } from 'date-fns'

const META_TOKEN      = process.env.META_ACCESS_TOKEN   // Token permanente da Meta for Developers
const META_AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID  // act_XXXXXXXXXX

export async function GET() {
  try {
    const since = format(subDays(new Date(), 365), 'yyyy-MM-dd')
    const until = format(new Date(), 'yyyy-MM-dd')

    // ── Spesa totale ultimo anno ──────────────────────────────
    const url = `https://graph.facebook.com/v19.0/${META_AD_ACCOUNT}/insights?` +
      `fields=spend,impressions,clicks,cpc,cpm,reach&` +
      `time_range={"since":"${since}","until":"${until}"}&` +
      `time_increment=monthly&` +
      `access_token=${META_TOKEN}`

    const res  = await fetch(url, { next: { revalidate: 3600 } })
    const data = await res.json()

    if (data.error) throw new Error(data.error.message)

    const monthly = (data.data || []).map(d => ({
      month:       d.date_start?.slice(0,7),
      spend:       Math.round(parseFloat(d.spend || 0) * 100) / 100,
      impressions: parseInt(d.impressions || 0),
      clicks:      parseInt(d.clicks || 0),
      cpc:         Math.round(parseFloat(d.cpc || 0) * 100) / 100,
    }))

    const totalSpend = monthly.reduce((s, m) => s + m.spend, 0)

    return NextResponse.json({
      totalSpend:      Math.round(totalSpend * 100) / 100,
      monthly,
      currency:        'EUR',
      updatedAt:       new Date().toISOString(),
    })
  } catch (err) {
    console.error('Meta error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
