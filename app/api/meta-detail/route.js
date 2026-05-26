export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { format } from 'date-fns'

const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID

const START_DATE = '2026-04-01'

// ── Helper ────────────────────────────────────────────────────
const round2 = n => Math.round(Number(n || 0) * 100) / 100
const round3 = n => Math.round(Number(n || 0) * 1000) / 1000

function getAccounts() {
  return (META_ACCOUNT || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function avg(arr) {
  return arr.length > 0
    ? arr.reduce((a, b) => a + b, 0) / arr.length
    : 0
}

// ── Meta mensile ──────────────────────────────────────────────
async function fetchMetaMonthly() {
  if (!META_TOKEN || !META_ACCOUNT) return []

  const accounts = getAccounts()
  const until = format(new Date(), 'yyyy-MM-dd')

  try {
    const results = await Promise.all(
      accounts.map(async accountId => {
        const url =
          `https://graph.facebook.com/v19.0/${accountId}/insights` +
          `?fields=spend,impressions,reach,frequency,cpm,ctr,outbound_clicks,cost_per_outbound_click` +
          `&time_range={"since":"${START_DATE}","until":"${until}"}` +
          `&time_increment=monthly` +
          `&access_token=${META_TOKEN}`

        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()

        if (data.error) {
          console.log('Meta monthly error:', data.error.message)
          return []
        }

        return data.data || []
      })
    )

    const map = {}

    for (const rows of results) {
      for (const d of rows) {
        const month = d.date_start?.slice(0, 7)
        if (!month) continue

        if (!map[month]) {
          map[month] = {
            month,
            spend: 0,
            impressions: 0,
            reach: 0,
            frequency: [],
            cpm: [],
            ctr: [],
            linkClicks: 0,
            cpcLink: [],
          }
        }

        const outboundClicks = Array.isArray(d.outbound_clicks)
          ? Number(
              d.outbound_clicks.find(x => x.action_type === 'outbound_click')
                ?.value || 0
            )
          : 0

        const outboundCpc = Array.isArray(d.cost_per_outbound_click)
          ? Number(
              d.cost_per_outbound_click.find(
                x => x.action_type === 'outbound_click'
              )?.value || 0
            )
          : 0

        map[month].spend += Number(d.spend || 0)
        map[month].impressions += Number(d.impressions || 0)
        map[month].reach += Number(d.reach || 0)
        map[month].linkClicks += outboundClicks

        if (Number(d.frequency || 0) > 0) {
          map[month].frequency.push(Number(d.frequency))
        }

        if (Number(d.cpm || 0) > 0) {
          map[month].cpm.push(Number(d.cpm))
        }

        if (Number(d.ctr || 0) > 0) {
          map[month].ctr.push(Number(d.ctr))
        }

        if (outboundCpc > 0) {
          map[month].cpcLink.push(outboundCpc)
        }
      }
    }

    return Object.values(map)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        month: m.month,
        spend: round2(m.spend),
        impressions: Math.round(m.impressions),
        reach: Math.round(m.reach),
        frequency: round2(avg(m.frequency)),
        cpm: round2(avg(m.cpm)),
        ctr: round3(avg(m.ctr)),
        linkClicks: Math.round(m.linkClicks),
        cpcLink: round2(avg(m.cpcLink)),
      }))
  } catch (e) {
    console.log('Meta monthly catch:', e.message)
    return []
  }
}

// ── Meta settimanale ──────────────────────────────────────────
async function fetchMetaWeekly() {
  if (!META_TOKEN || !META_ACCOUNT) return []

  const accounts = getAccounts()
  const since = '2025-12-29'
  const until = format(new Date(), 'yyyy-MM-dd')

  try {
    const results = await Promise.all(
      accounts.map(async accountId => {
        const url =
          `https://graph.facebook.com/v19.0/${accountId}/insights` +
          `?fields=spend,impressions,reach,frequency,cpm,ctr,outbound_clicks,cost_per_outbound_click` +
          `&time_range={"since":"${since}","until":"${until}"}` +
          `&time_increment=7` +
          `&access_token=${META_TOKEN}`

        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()

        if (data.error) {
          console.log('Meta weekly error:', data.error.message)
          return []
        }

        return data.data || []
      })
    )

    const map = {}

    for (const rows of results) {
      for (const d of rows) {
        const date = d.date_start
        if (!date) continue

        if (!map[date]) {
          map[date] = {
            date,
            spend: 0,
            impressions: 0,
            reach: 0,
            frequency: [],
            cpm: [],
            ctr: [],
            linkClicks: 0,
            cpcLink: [],
          }
        }

        const outboundClicks = Array.isArray(d.outbound_clicks)
          ? Number(
              d.outbound_clicks.find(x => x.action_type === 'outbound_click')
                ?.value || 0
            )
          : 0

        const outboundCpc = Array.isArray(d.cost_per_outbound_click)
          ? Number(
              d.cost_per_outbound_click.find(
                x => x.action_type === 'outbound_click'
              )?.value || 0
            )
          : 0

        map[date].spend += Number(d.spend || 0)
        map[date].impressions += Number(d.impressions || 0)
        map[date].reach += Number(d.reach || 0)
        map[date].linkClicks += outboundClicks

        if (Number(d.frequency || 0) > 0) {
          map[date].frequency.push(Number(d.frequency))
        }

        if (Number(d.cpm || 0) > 0) {
          map[date].cpm.push(Number(d.cpm))
        }

        if (Number(d.ctr || 0) > 0) {
          map[date].ctr.push(Number(d.ctr))
        }

        if (outboundCpc > 0) {
          map[date].cpcLink.push(outboundCpc)
        }
      }
    }

    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(w => ({
        date: w.date,
        spend: round2(w.spend),
        impressions: Math.round(w.impressions),
        reach: Math.round(w.reach),
        frequency: round2(avg(w.frequency)),
        cpm: round2(avg(w.cpm)),
        ctr: round3(avg(w.ctr)),
        linkClicks: Math.round(w.linkClicks),
        cpcLink: round2(avg(w.cpcLink)),
      }))
  } catch (e) {
    console.log('Meta weekly catch:', e.message)
    return []
  }
}

// ── API Route ─────────────────────────────────────────────────
export async function GET() {
  try {
    const [metaMonthly, metaWeekly] = await Promise.all([
      fetchMetaMonthly(),
      fetchMetaWeekly(),
    ])

    const metaSpend = metaMonthly.reduce(
      (sum, row) => sum + Number(row.spend || 0),
      0
    )

    return NextResponse.json({
      metaSpend: round2(metaSpend),
      metaMonthly,
      metaWeekly,
      sources: {
        meta: metaMonthly.length > 0 || metaWeekly.length > 0,
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: err.message || 'Errore sconosciuto',
      },
      {
        status: 500,
      }
    )
  }
}
