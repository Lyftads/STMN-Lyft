export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { format, subDays } from 'date-fns'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN
const META_TOKEN = process.env.META_ACCESS_TOKEN
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID

const START_DATE = '2026-01-01'
const WEEKLY_START_DATE = '2025-12-29'

function shopifyAuth() {
  return {
    'X-Shopify-Access-Token': SHOPIFY_TOKEN || '',
  }
}

function shopifyGraphQLHeaders() {
  return {
    'X-Shopify-Access-Token': SHOPIFY_TOKEN || '',
    'Content-Type': 'application/json',
  }
}

function normalizeRawNumber(value) {
  if (value == null) return 0

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'object') {
    if ('amount' in value) return normalizeRawNumber(value.amount)
    if ('value' in value) return normalizeRawNumber(value.value)
    if ('decimal' in value) return normalizeRawNumber(value.decimal)
  }

  let raw = String(value)
    .trim()
    .replace(/[€\s]/g, '')
    .replace(/[^\d,.-]/g, '')

  if (!raw) return 0

  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')

  if (hasComma && hasDot) {
    // Italiano: 1.564,35
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
      raw = raw.replace(/\./g, '').replace(',', '.')
    } else {
      // Inglese: 1,564.35
      raw = raw.replace(/,/g, '')
    }
  } else if (hasComma && !hasDot) {
    raw = raw.replace(',', '.')
  } else if (hasDot && !hasComma) {
    const parts = raw.split('.')

    // 1.564.359 = separatori migliaia
    if (parts.length > 2) {
      raw = raw.replace(/\./g, '')
    }
  }

  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

function cleanCount(value) {
  return Math.round(normalizeRawNumber(value))
}

function cleanMoney(value) {
  let n = normalizeRawNumber(value)

  // [Inferenza] ShopifyQL tableData.rows può restituire money in centesimi.
  // Esempio: 1667395 => 16.673,95 €
  if (Number.isInteger(n) && Math.abs(n) >= 100000) {
    n = n / 100
  }

  return Math.round(n * 100) / 100
}

function roundMoney(n) {
  return Math.round(Number(n || 0) * 100) / 100
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

function monthRanges() {
  const startYear = parseInt(START_DATE.slice(0, 4), 10)
  const startMonth = parseInt(START_DATE.slice(5, 7), 10)

  const now = new Date()
  const endYear = now.getUTCFullYear()
  const endMonth = now.getUTCMonth() + 1
  const todayStr = format(now, 'yyyy-MM-dd')

  const months = []
  let y = startYear
  let m = startMonth

  while (y < endYear || (y === endYear && m <= endMonth)) {
    const monthStr = `${y}-${String(m).padStart(2, '0')}`
    const startDate = `${monthStr}-01`

    // ultimo giorno del mese in UTC
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const monthEnd = `${monthStr}-${String(lastDay).padStart(2, '0')}`

    // se è il mese corrente, fermati a oggi
    const endDate = monthEnd > todayStr ? todayStr : monthEnd

    months.push({ month: monthStr, start: startDate, end: endDate })

    m++
    if (m > 12) { m = 1; y++ }
  }

  return months
}

// ── ShopifyQL via GraphQL ─────────────────────────────────────
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

  try {
    const res = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2026-04/graphql.json`,
      {
        method: 'POST',
        headers: shopifyGraphQLHeaders(),
        body: JSON.stringify({
          query: gql,
          variables: { query },
        }),
      }
    )

    const json = await res.json()

    if (!res.ok || json.errors?.length) {
      console.log(
        'Shopify GraphQL error:',
        JSON.stringify(json.errors || json, null, 2)
      )
      return []
    }

    const payload = json.data?.shopifyqlQuery

    if (payload?.parseErrors?.length) {
      console.log(
        'ShopifyQL parse error:',
        JSON.stringify(payload.parseErrors, null, 2)
      )
      return []
    }

    const columns = payload?.tableData?.columns || []
    const rows = payload?.tableData?.rows || []

    return rows.map(row => {
      if (!Array.isArray(row)) return row

      const obj = {}

      columns.forEach((col, i) => {
        const key = col.name || col.displayName || `col_${i}`
        obj[key] = row[i]
      })

      return obj
    })
  } catch (e) {
    console.log('ShopifyQL error:', e.message)
    return []
  }
}

// ── Shopify sales per range arbitrario (settimana o mese) ─────
// IMPORTANTE: `total_sales` di Shopify è la voce "Vendite totali nel tempo".
// Formula Shopify: gross_sales − discounts − returns + shipping + duties + fees + taxes.
// Quindi `total_sales` è GIÀ al netto dei resi. Il campo `resi` qui sotto
// è solo informativo (per sapere quanto è stato rimborsato), NON va sottratto
// di nuovo da `fatturato`.
async function fetchShopifySalesRange(start, end) {
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
        total_sales,
        returns
      WHERE new_or_returning_customer IS NOT NULL
      SINCE ${start}
      UNTIL ${end}
      GROUP BY new_or_returning_customer
      WITH TOTALS, CURRENCY 'EUR'
      ORDER BY new_or_returning_customer ASC
      LIMIT 2
  `

  const rows = await shopifyQL(query)

  let fatturato = 0
  let fatturNC = 0
  let fatturRC = 0
  let resi = 0
  let resiNC = 0
  let resiRC = 0
  let ordini = 0
  let nc = 0
  let rc = 0

  for (const row of rows) {
    const segment = String(row.new_or_returning_customer || '').toLowerCase()

    const rowTotalSales = cleanMoney(row.total_sales)
    const rowOrders = cleanCount(row.orders)
    // Shopify restituisce `returns` come valore negativo (deduzione).
    // Normalizziamo a positivo per usarlo come importo dei resi.
    const rowReturns = Math.abs(cleanMoney(row.returns))

    fatturato += rowTotalSales
    resi += rowReturns
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
      const rowNC =
        cleanCount(row.new_customers) ||
        cleanCount(row.orders_first_time) ||
        cleanCount(row.customers) ||
        rowOrders

      const rowFatNC =
        cleanMoney(row.total_sales_first_time) ||
        rowTotalSales

      nc += rowNC
      fatturNC += rowFatNC
      resiNC += rowReturns
    }

    if (isReturning) {
      const rowRC =
        cleanCount(row.returning_customers) ||
        cleanCount(row.orders_returning) ||
        cleanCount(row.customers) ||
        rowOrders

      const rowFatRC =
        cleanMoney(row.total_sales_returning) ||
        rowTotalSales

      rc += rowRC
      fatturRC += rowFatRC
      resiRC += rowReturns
    }
  }

  if (fatturRC <= 0 && fatturato > 0 && fatturNC > 0) {
    fatturRC = Math.max(fatturato - fatturNC, 0)
  }

  return {
    // `fatturato` = total_sales Shopify ("Vendite totali nel tempo"),
    // già al netto di resi e sconti.
    fatturato: roundMoney(fatturato),
    resi: roundMoney(resi),

    fatturNC: roundMoney(fatturNC),
    resiNC: roundMoney(resiNC),

    fatturRC: roundMoney(fatturRC),
    resiRC: roundMoney(resiRC),

    ordini: cleanCount(ordini),
    nc: cleanCount(nc),
    rc: cleanCount(rc),
  }
}

// ── Shopify online store visitors per range arbitrario ────────
// [Non verificato] Uso online_store_visitors perché Shopify lo mostra come
// "visitatori del negozio online". Se ShopifyQL rifiuta la metrica, torna 0.
async function fetchShopifyVisitorsRange(start, end) {
  const candidates = [
    `
      FROM sessions
        SHOW online_store_visitors
        SINCE ${start}
        UNTIL ${end}
    `,
    `
      FROM sessions
        SHOW visitors
        SINCE ${start}
        UNTIL ${end}
    `,
    `
      FROM sessions
        SHOW unique_visitors
        SINCE ${start}
        UNTIL ${end}
    `,
    `
      FROM sessions
        SHOW sessions
        SINCE ${start}
        UNTIL ${end}
    `,
  ]

  for (const query of candidates) {
    const rows = await shopifyQL(query)

    if (!rows?.length) continue

    const row = rows[0] || {}

    const value =
      cleanCount(row.online_store_visitors) ||
      cleanCount(row.visitors) ||
      cleanCount(row.unique_visitors) ||
      cleanCount(row.sessions)

    if (value > 0) return value
  }

  return 0
}

async function fetchShopifyWeekly() {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return []

  try {
    const ranges = weekRanges()

    const rows = await Promise.all(
      ranges.map(async ({ start, end }) => {
        const [sales, uniqueSessions] = await Promise.all([
          fetchShopifySalesRange(start, end),
          fetchShopifyVisitorsRange(start, end),
        ])

        return {
          date: start,

          fatturato: sales.fatturato,
          resi: sales.resi,

          fatturNC: sales.fatturNC,
          resiNC: sales.resiNC,

          fatturRC: sales.fatturRC,
          resiRC: sales.resiRC,

          ordini: sales.ordini,
          nc: sales.nc,
          rc: sales.rc,

          uniqueSessions,
        }
      })
    )

    return rows.filter(
      w =>
        w.fatturato > 0 ||
        w.fatturNC > 0 ||
        w.fatturRC > 0 ||
        w.ordini > 0 ||
        w.nc > 0 ||
        w.rc > 0 ||
        w.uniqueSessions > 0
    )
  } catch (e) {
    console.log('Shopify weekly error:', e.message)
    return []
  }
}

// ── Shopify monthly (calendar month: 1 → ultimo giorno) ───────
async function fetchShopifyMonthly() {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return []

  try {
    const ranges = monthRanges()

    const rows = await Promise.all(
      ranges.map(async ({ month, start, end }) => {
        const [sales, uniqueSessions] = await Promise.all([
          fetchShopifySalesRange(start, end),
          fetchShopifyVisitorsRange(start, end),
        ])

        return {
          month,
          date: start, // compat: alcuni componenti leggono `date`

          fatturato: sales.fatturato,
          resi: sales.resi,

          fatturNC: sales.fatturNC,
          resiNC: sales.resiNC,

          fatturRC: sales.fatturRC,
          resiRC: sales.resiRC,

          ordini: sales.ordini,
          nc: sales.nc,
          rc: sales.rc,

          uniqueSessions,
        }
      })
    )

    return rows.filter(
      r =>
        r.fatturato > 0 ||
        r.fatturNC > 0 ||
        r.fatturRC > 0 ||
        r.ordini > 0 ||
        r.nc > 0 ||
        r.rc > 0 ||
        r.uniqueSessions > 0
    )
  } catch (e) {
    console.log('Shopify monthly error:', e.message)
    return []
  }
}

// ── AOV ultimi 30 giorni ──────────────────────────────────────
async function fetchAOV() {
  try {
    if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) {
      return { aov: 0, orders: 0 }
    }

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
// ── Shopify orders REST pagination ─────────────────────────────
async function fetchShopifyOrdersSince(startDate = START_DATE) {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return []

  const orders = []
  let url =
    `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json` +
    `?status=any` +
    `&financial_status=paid` +
    `&created_at_min=${startDate}T00:00:00Z` +
    `&limit=250` +
    `&fields=id,created_at,total_price,source_name,landing_site,referring_site,line_items`

  try {
    while (url) {
      const res = await fetch(url, {
        headers: shopifyAuth(),
      })

      if (!res.ok) {
        console.log('Shopify orders error:', await res.text())
        break
      }

      const data = await res.json()
      orders.push(...(data.orders || []))

      const link = res.headers.get('link') || ''
      const nextMatch = link.match(/<([^>]+)>;\s*rel="next"/)

      url = nextMatch ? nextMatch[1] : null
    }

    return orders
  } catch (e) {
    console.log('Shopify orders pagination error:', e.message)
    return []
  }
}

function getOrderRevenue(order) {
  return roundMoney(normalizeRawNumber(order.total_price))
}

function getSourceLabel(order) {
  const landing = String(order.landing_site || '')
  const referrer = String(order.referring_site || '')
  const sourceName = String(order.source_name || '')

  const combined = `${landing} ${referrer} ${sourceName}`.toLowerCase()

  const utmSource =
    landing.match(/[?&]utm_source=([^&]+)/i)?.[1] ||
    referrer.match(/[?&]utm_source=([^&]+)/i)?.[1]

  const utmMedium =
    landing.match(/[?&]utm_medium=([^&]+)/i)?.[1] ||
    referrer.match(/[?&]utm_medium=([^&]+)/i)?.[1]

  const utmCampaign =
    landing.match(/[?&]utm_campaign=([^&]+)/i)?.[1] ||
    referrer.match(/[?&]utm_campaign=([^&]+)/i)?.[1]

  if (utmSource) {
    return decodeURIComponent(utmSource).replace(/\+/g, ' ')
  }

  if (combined.includes('facebook') || combined.includes('fbclid')) return 'Facebook'
  if (combined.includes('instagram') || combined.includes('igshid')) return 'Instagram'
  if (combined.includes('google') || combined.includes('gclid')) return 'Google'
  if (combined.includes('tiktok')) return 'TikTok'
  if (combined.includes('klaviyo')) return 'Klaviyo'
  if (combined.includes('email') || utmMedium === 'email') return 'Email'
  if (utmCampaign) return decodeURIComponent(utmCampaign).replace(/\+/g, ' ')

  if (referrer) {
    try {
      const host = new URL(referrer).hostname.replace('www.', '')
      return host || 'Referral'
    } catch {
      return 'Referral'
    }
  }

  if (sourceName && sourceName !== 'web') return sourceName

  return 'Direct / Unknown'
}

function isMarketingSource(order) {
  const landing = String(order.landing_site || '')
  const referrer = String(order.referring_site || '')
  const sourceName = String(order.source_name || '')
  const combined = `${landing} ${referrer} ${sourceName}`.toLowerCase()

  return (
    combined.includes('utm_') ||
    combined.includes('fbclid') ||
    combined.includes('gclid') ||
    combined.includes('ttclid') ||
    combined.includes('facebook') ||
    combined.includes('instagram') ||
    combined.includes('google') ||
    combined.includes('tiktok') ||
    combined.includes('klaviyo') ||
    combined.includes('email') ||
    Boolean(referrer && !referrer.includes(SHOPIFY_STORE))
  )
}

// ── KPI Brain: Top 10 prodotti per revenue ─────────────────────
async function fetchShopifyTopProducts() {
  const orders = await fetchShopifyOrdersSince(START_DATE)
  const map = {}

  for (const order of orders) {
    const lineItems = order.line_items || []

    for (const item of lineItems) {
      const title = item.title || item.name || 'Prodotto sconosciuto'
      const quantity = cleanCount(item.quantity)
      const unitPrice = normalizeRawNumber(item.price)

      const discounts = Array.isArray(item.discount_allocations)
        ? item.discount_allocations.reduce(
            (sum, discount) => sum + normalizeRawNumber(discount.amount),
            0
          )
        : 0

      const revenue = Math.max(unitPrice * quantity - discounts, 0)

      if (!map[title]) {
        map[title] = {
          product: title,
          revenue: 0,
          orders: 0,
          quantity: 0,
        }
      }

      map[title].revenue += revenue
      map[title].orders += 1
      map[title].quantity += quantity
    }
  }

  return Object.values(map)
    .map(row => ({
      ...row,
      revenue: roundMoney(row.revenue),
      orders: cleanCount(row.orders),
      quantity: cleanCount(row.quantity),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
}

// ── KPI Brain: vendite attribuite al marketing ─────────────────
async function fetchShopifyMarketingSources() {
  const orders = await fetchShopifyOrdersSince(START_DATE)
  const map = {}

  for (const order of orders) {
    if (!isMarketingSource(order)) continue

    const label = getSourceLabel(order)
    const revenue = getOrderRevenue(order)

    if (!map[label]) {
      map[label] = {
        source: label,
        revenue: 0,
        orders: 0,
      }
    }

    map[label].revenue += revenue
    map[label].orders += 1
  }

  return Object.values(map)
    .map(row => ({
      ...row,
      revenue: roundMoney(row.revenue),
      orders: cleanCount(row.orders),
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

// ── KPI Brain: revenue e ordini per giorno settimana ───────────
async function fetchShopifyDayBreakdown() {
  const orders = await fetchShopifyOrdersSince(START_DATE)

  const days = [
    { key: 0, label: 'Sun' },
    { key: 1, label: 'Mon' },
    { key: 2, label: 'Tue' },
    { key: 3, label: 'Wed' },
    { key: 4, label: 'Thu' },
    { key: 5, label: 'Fri' },
    { key: 6, label: 'Sat' },
  ]

  const map = {}

  for (const day of days) {
    map[day.key] = {
      day: day.label,
      revenue: 0,
      orders: 0,
    }
  }

  for (const order of orders) {
    const date = new Date(order.created_at)
    const day = date.getDay()

    map[day].revenue += getOrderRevenue(order)
    map[day].orders += 1
  }

  return days.map(day => ({
    day: map[day.key].day,
    revenue: roundMoney(map[day.key].revenue),
    orders: cleanCount(map[day.key].orders),
  }))
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
async function safeShopifyTopProducts(range) {
  try {
    if (typeof fetchShopifyTopProducts !== 'function') return []
    return await fetchShopifyTopProducts(range?.since, range?.until)
  } catch (e) {
    console.log('KPI Brain top products error:', e.message)
    return []
  }
}
async function safeShopifyDayBreakdown(range) {
  try {
    if (typeof fetchShopifyDayBreakdown !== 'function') return []
    return await fetchShopifyDayBreakdown(range?.since, range?.until)
  } catch (e) {
    console.log('KPI Brain day breakdown error:', e.message)
    return []
  }
}
// ── API Route ─────────────────────────────────────────────────
// ── API Route ─────────────────────────────────────────────────
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('preset') || 'last_90d'

    const fallbackRange = {
      since: '2025-12-29',
      until: new Date().toISOString().slice(0, 10),
      label: 'Ultimi 90 giorni',
    }

    const range =
      typeof getPresetRange === 'function'
        ? getPresetRange(preset)
        : fallbackRange

    const previousRange =
      typeof getPreviousRange === 'function'
        ? getPreviousRange(range)
        : {
            since: null,
            until: null,
            label: 'Periodo precedente',
          }

    const [
      aovData,
      shopifyWeekly,
      shopifyMonthly,
      metaMonthly,
      metaWeekly,
    ] = await Promise.all([
      fetchAOV(),
      fetchShopifyWeekly(),
      fetchShopifyMonthly(),
      fetchMeta(),
      fetchMetaWeekly(),
    ])

    const metaTotal = metaMonthly.reduce(
      (sum, row) => sum + row.spend,
      0
    )

  const shopifyTopProducts =
  typeof safeShopifyTopProducts === 'function'
    ? await safeShopifyTopProducts(range)
    : []

const shopifyDayBreakdown =
  typeof safeShopifyDayBreakdown === 'function'
    ? await safeShopifyDayBreakdown(range)
    : []

    return NextResponse.json({
      aovLive: Math.round(aovData.aov * 100) / 100,
      ordersLive: aovData.orders,

      shopifyWeekly,
      shopifyMonthly,

      shopifyTopProducts,
      shopifyMarketingSources: [],
      shopifyDayBreakdown,

      kpiBrain: {
        preset,
        range,
        previousRange,
      },

      metaSpend: Math.round(metaTotal * 100) / 100,
      metaMonthly,
      metaWeekly,

      sources: {
        shopify:
          aovData.orders > 0 ||
          shopifyWeekly.length > 0 ||
          shopifyMonthly.length > 0,
        meta: metaMonthly.length > 0 || metaWeekly.length > 0,
      },

      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.log('Metrics API error:', err.message)

    return NextResponse.json({
      aovLive: 0,
      ordersLive: 0,

      shopifyWeekly: [],
      shopifyMonthly: [],

      shopifyTopProducts: [],
      shopifyMarketingSources: [],
      shopifyDayBreakdown: [],

      kpiBrain: {
        preset: 'last_90d',
        range: null,
        previousRange: null,
      },

      metaSpend: 0,
      metaMonthly: [],
      metaWeekly: [],

      sources: {
        shopify: false,
        meta: false,
      },

      error: err.message,
      updatedAt: new Date().toISOString(),
    })
  }
}
