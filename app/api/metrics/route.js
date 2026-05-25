export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { format, subDays } from 'date-fns'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN
const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID

const START_DATE = '2026-04-01'
const WEEKLY_START_DATE = '2025-12-29'

function shopifyAuth() {
  return {
    'X-Shopify-Access-Token': SHOPIFY_TOKEN || '',
  }
}

function graphQLHeaders() {
  return {
    'X-Shopify-Access-Token': SHOPIFY_TOKEN || '',
    'Content-Type': 'application/json',
  }
}

function cleanNumber(value) {
  if (value == null) return 0

  if (typeof value === 'number') return value

  if (typeof value === 'object') {
    if ('amount' in value) return cleanNumber(value.amount)
    if ('value' in value) return cleanNumber(value.value)
  }

  const n = parseFloat(
    String(value)
      .replace(/[€\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
  )

  return Number.isFinite(n) ? n : 0
}

function weekRanges() {
  const weeks = []
  let d = new Date(`${WEEKLY_START_DATE}T00:00:00Z`)
  const now = new Date()

  while (d <= now) {
    const start = new Date(d)
    const end = new Date(d)
    end.setUTCDate(end.getUTCDate() + 6)

    weeks.push({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    })

    d = new Date(d)
    d.setUTCDate(d.getUTCDate() + 7)
  }

  return weeks
}

// ── Shopify GraphQL / ShopifyQL ───────────────────────────────
async function shopifyQL(query) {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return []

  const gql = `
    query ShopifyQLReport($query: String!) {
      shopifyqlQuery(query: $query) {
        tableData {
          columns {
            name
            dataType
            displayName
          }
          rows
        }
        parseErrors
      }
    }
  `

  const res = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2026-04/graphql.json`,
    {
      method: 'POST',
      headers: graphQLHeaders(),
      body: JSON.stringify({
        query: gql,
        variables: { query },
      }),
    }
  )

  const json = await res.json()

  if (!res.ok || json.errors?.length) {
    console.log('Shopify GraphQL error:', JSON.stringify(json.errors || json, null, 2))
    return []
  }

  const payload = json.data?.shopifyqlQuery

  if (payload?.parseErrors?.length) {
    console.log('ShopifyQL parse error:', JSON.stringify(payload.parseErrors, null, 2))
    return []
  }

  return payload?.tableData?.rows || []
}

// ── Shopify dati settimanali: fatturato, fatturato NC, ordini, NC, RC ──
async function fetchShopifyWeekly() {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return []

  try {
    const ranges = weekRanges()

    const rows = await Promise.all(
      ranges.map(async ({ start, end }) => {
        const query = `
          FROM sales
            SHOW customers,
              new_customers,
              orders_first_time,
              total_sales_first_time,
              returning_customers,
              orders_returning,
              total_sales_returning,
              orders,
              total_sales
            WHERE new_or_returning_customer IS NOT NULL
            SINCE ${start}
            UNTIL ${end}
            GROUP BY new_or_returning_customer
            WITH TOTALS, CURRENCY 'EUR'
            ORDER BY new_or_returning_customer ASC
            LIMIT 2
        `

        const data = await shopifyQL(query)

        let fatturato = 0
        let fatturNC = 0
        let ordini = 0
        let nc = 0
        let rc = 0

        for (const row of data) {
          const segment = String(row.new_or_returning_customer || '').toLowerCase()

          const rowTotalSales = cleanNumber(row.total_sales)
          const rowOrders = cleanNumber(row.orders)

          fatturato += rowTotalSales
          ordini += rowOrders

          const isNew =
            segment.includes('new') ||
            segment.includes('first') ||
            segment.includes('nuov')

          const isReturning =
            segment.includes('return') ||
            segment.includes('ritorn') ||
            segment.includes('recurr')

          if (isNew) {
            nc += cleanNumber(row.new_customers || row.customers || row.orders_first_time || rowOrders)
            fatturNC += cleanNumber(row.total_sales_first_time || rowTotalSales)
          }

          if (isReturning) {
            rc += cleanNumber(row.returning_customers || row.orders_returning || row.customers || rowOrders)
          }
        }

        return {
          date: start,
          fatturato: Math.round(fatturato * 100) / 100,
          fatturNC: Math.round(fatturNC * 100) / 100,
          ordini: Math.round(ordini),
          nc: Math.round(nc),
          rc: Math.round(rc),
        }
      })
    )

    return rows.filter(
      w =>
        w.fatturato > 0 ||
        w.fatturNC > 0 ||
        w.ordini > 0 ||
        w.nc > 0 ||
        w.rc > 0
    )
  } catch (e) {
    console.log('Shopify weekly error:', e.message)
    return []
  }
}

// ── AOV ultimi 30 giorni ──────────────────────────────────────
async function fetchAOV() {
  try {
    const since = subDays(new Date(), 30).toISOString()

    const res = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250&fields=total_price`,
      {
        headers: shopifyAuth(),
      }
    )

    if (!res.ok) return { aov: 0, orders: 0 }

    const data = await res.json()
    const orders = data.orders || []

    const revenue = orders.reduce(
      (sum, order) => sum + parseFloat(order.total_price || 0),
      0
    )

    return {
      aov: orders.length > 0 ? revenue / orders.length : 0,
      orders: orders.length,
    }
  } catch {
    return { aov: 0, orders: 0 }
  }
}

// ── Meta weekly ───────────────────────────────────────────────
async function fetchMetaWeekly() {
  if (!META_TOKEN || !META_ACCOUNT) return []

  const accounts = META_ACCOUNT.split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const since = '2025-12-29'
  const until = format(new Date(), 'yyyy-MM-dd')

  const fields =
    'spend,impressions,reach,frequency,cpm,ctr,outbound_clicks,cost_per_outbound_click'

  try {
    const results = await Promise.all(
      accounts.map(async id => {
        const url =
          `https://graph.facebook.com/v19.0/${id}/insights` +
          `?fields=${fields}` +
          `&time_range={"since":"${since}","until":"${until}"}` +
          `&time_increment=7` +
          `&access_token=${META_TOKEN}`

        const res = await fetch(url)
        const data = await res.json()

        if (data.error) {
          console.log('Meta weekly:', data.error.message)
          return []
        }

        return (data.data || []).map(d => ({
          date: d.date_start,
          spend: parseFloat(d.spend || 0),
          impressions: parseInt(d.impressions || 0),
          reach: parseInt(d.reach || 0),
          frequency: parseFloat(d.frequency || 0),
          cpm: parseFloat(d.cpm || 0),
          ctr: parseFloat(d.ctr || 0),

          linkClicks: Array.isArray(d.outbound_clicks)
            ? parseInt(
                d.outbound_clicks.find(
                  x => x.action_type === 'outbound_click'
                )?.value || 0
              )
            : 0,

          cpcLink: Array.isArray(d.cost_per_outbound_click)
            ? parseFloat(
                d.cost_per_outbound_click.find(
                  x => x.action_type === 'outbound_click'
                )?.value || 0
              )
            : 0,
        }))
      })
    )

    const map = {}

    for (const rows of results) {
      for (const r of rows) {
        if (!map[r.date]) {
          map[r.date] = {
            date: r.date,
            spend: 0,
            impressions: 0,
            reach: 0,
            freq: [],
            cpm: [],
            ctr: [],
            cpcLink: [],
            linkClicks: 0,
          }
        }

        map[r.date].spend += r.spend
        map[r.date].impressions += r.impressions
        map[r.date].reach += r.reach
        map[r.date].linkClicks += r.linkClicks

        if (r.frequency > 0) map[r.date].freq.push(r.frequency)
        if (r.cpm > 0) map[r.date].cpm.push(r.cpm)
        if (r.ctr > 0) map[r.date].ctr.push(r.ctr)
        if (r.cpcLink > 0) map[r.date].cpcLink.push(r.cpcLink)
      }
    }

    const avg = arr =>
      arr.length > 0
        ? arr.reduce((a, b) => a + b, 0) / arr.length
        : 0

    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(w => ({
        date: w.date,
        spend: Math.round(w.spend * 100) / 100,
        impressions: w.impressions,
        reach: w.reach,
        frequency: Math.round(avg(w.freq) * 100) / 100,
        cpm: Math.round(avg(w.cpm) * 100) / 100,
        ctr: Math.round(avg(w.ctr) * 1000) / 1000,
        linkClicks: w.linkClicks,
        cpcLink: Math.round(avg(w.cpcLink) * 100) / 100,
      }))
  } catch (e) {
    console.log('Meta weekly error:', e.message)
    return []
  }
}

// ── Meta monthly spend ────────────────────────────────────────
async function fetchMeta() {
  if (!META_TOKEN || !META_ACCOUNT) return []

  const accounts = META_ACCOUNT.split(',')
    .map(s => s.trim())
    .filter(Boolean)

  try {
    const results = await Promise.all(
      accounts.map(async id => {
        const url =
          `https://graph.facebook.com/v19.0/${id}/insights` +
          `?fields=spend` +
          `&time_range={"since":"${START_DATE}","until":"${format(new Date(), 'yyyy-MM-dd')}"}` +
          `&time_increment=monthly` +
          `&access_token=${META_TOKEN}`

        const res = await fetch(url)
        const data = await res.json()

        if (data.error) {
          console.log('Meta:', data.error.message)
          return []
        }

        return data.data || []
      })
    )

    const map = {}

    for (const rows of results) {
      for (const d of rows) {
        const month = d.date_start?.slice(0, 7)

        if (month) {
          map[month] =
            (map[month] || 0) +
            parseFloat(d.spend || 0)
        }
      }
    }

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, spend]) => ({
        month,
        spend: Math.round(spend * 100) / 100,
      }))
  } catch {
    return []
  }
}

// ── API Route ─────────────────────────────────────────────────
export async function GET() {
  try {
    const [
      aovData,
      shopifyWeekly,
      metaMonthly,
      metaWeekly,
    ] = await Promise.all([
      fetchAOV(),
      fetchShopifyWeekly(),
      fetchMeta(),
      fetchMetaWeekly(),
    ])

    const metaTotal = metaMonthly.reduce(
      (sum, row) => sum + row.spend,
      0
    )

    return NextResponse.json({
      aovLive: Math.round(aovData.aov * 100) / 100,
      ordersLive: aovData.orders,

      shopifyWeekly,

      metaSpend: Math.round(metaTotal * 100) / 100,
      metaMonthly,
      metaWeekly,

      sources: {
        shopify: aovData.orders > 0 || shopifyWeekly.length > 0,
        meta: metaMonthly.length > 0 || metaWeekly.length > 0,
      },

      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: err.message,
      },
      {
        status: 500,
      }
    )
  }
}
