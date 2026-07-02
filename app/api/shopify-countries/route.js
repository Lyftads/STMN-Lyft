export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'

// Vendite per paese via ShopifyQL (stessa fonte del resto dell'app → numeri
// coerenti, e NON richiede l'accesso all'address del cliente: usa la dimensione
// aggregata `billing_country`). Prima usava l'Orders API `billingAddress.country`
// che richiede il PCD address. Output shape invariato (country, country_code,
// revenue, orders, ncOrders, rcOrders, ncRevenue, rcRevenue) → frontend intatto.

const cleanMoney = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0 }
const cleanCount = (v) => { const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : 0 }

// ShopifyQL con retry sul throttling (stesso pattern di /api/cro, /api/metrics).
async function shopifyQL(query) {
  const { storeUrl: STORE, adminToken: TOKEN } = getShopify()
  if (!STORE || !TOKEN) return []
  const gql = `query($q: String!) { shopifyqlQuery(query: $q) { tableData { columns { name } rows } parseErrors } }`
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`https://${STORE}/admin/api/2026-04/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': TOKEN || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: gql, variables: { q: query } }),
      })
      const json = await res.json().catch(() => null)
      const errs = json?.errors || []
      const ts = json?.extensions?.cost?.throttleStatus
      const throttled = res.status === 429 || errs.some(e => /throttl/i.test(e?.message || '') || e?.extensions?.code === 'THROTTLED') || (ts && ts.currentlyAvailable === 0)
      if (throttled && attempt < 4) { await sleep(900 * attempt); continue }
      if (!res.ok || errs.length) return []
      const payload = json?.data?.shopifyqlQuery
      if (payload?.parseErrors?.length) return []
      const cols = payload?.tableData?.columns || []
      return (payload?.tableData?.rows || []).map(row => {
        if (!Array.isArray(row)) return row
        const o = {}
        cols.forEach((c, i) => { o[c.name || `c${i}`] = row[i] })
        return o
      })
    } catch { if (attempt < 4) { await sleep(900 * attempt); continue } return [] }
  }
  return []
}

// Nome paese inglese (come lo restituisce ShopifyQL billing_country) → ISO 3166-1
// alpha-2 (per bandiere e drill giornaliero). Copre i paesi e-commerce comuni.
const NAME_TO_CODE = {
  'Italy': 'IT', 'France': 'FR', 'Spain': 'ES', 'Germany': 'DE', 'Portugal': 'PT',
  'Switzerland': 'CH', 'Austria': 'AT', 'Belgium': 'BE', 'Netherlands': 'NL', 'Luxembourg': 'LU',
  'United Kingdom': 'GB', 'Ireland': 'IE', 'Denmark': 'DK', 'Sweden': 'SE', 'Norway': 'NO',
  'Finland': 'FI', 'Iceland': 'IS', 'Poland': 'PL', 'Czechia': 'CZ', 'Czech Republic': 'CZ',
  'Slovakia': 'SK', 'Slovenia': 'SI', 'Hungary': 'HU', 'Romania': 'RO', 'Bulgaria': 'BG',
  'Croatia': 'HR', 'Greece': 'GR', 'Cyprus': 'CY', 'Malta': 'MT', 'Estonia': 'EE',
  'Latvia': 'LV', 'Lithuania': 'LT', 'United States': 'US', 'Canada': 'CA', 'Mexico': 'MX',
  'Brazil': 'BR', 'Argentina': 'AR', 'Chile': 'CL', 'Colombia': 'CO', 'Australia': 'AU',
  'New Zealand': 'NZ', 'Japan': 'JP', 'China': 'CN', 'Hong Kong SAR': 'HK', 'Hong Kong': 'HK',
  'Singapore': 'SG', 'South Korea': 'KR', 'India': 'IN', 'United Arab Emirates': 'AE',
  'Saudi Arabia': 'SA', 'Israel': 'IL', 'Turkey': 'TR', 'South Africa': 'ZA', 'Russia': 'RU',
  'Ukraine': 'UA', 'Serbia': 'RS', 'Monaco': 'MC', 'Andorra': 'AD', 'San Marino': 'SM',
  'Thailand': 'TH', 'Vietnam': 'VN', 'Indonesia': 'ID', 'Malaysia': 'MY', 'Philippines': 'PH',
}
const CODE_TO_NAME = Object.fromEntries(Object.entries(NAME_TO_CODE).map(([n, c]) => [c, n]))

const SHOW = 'total_sales, orders, orders_first_time, orders_returning, total_sales_first_time, total_sales_returning'

export async function GET(request) {
  return withTenantContext(request, async () => {
    const { storeUrl, adminToken } = getShopify()
    if (!storeUrl || !adminToken) {
      return NextResponse.json({ error: 'Shopify non configurato', countries: [], total: { revenue: 0, orders: 0 } }, { status: 200 })
    }

    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')
    const until = searchParams.get('until')
    const countryFilter = (searchParams.get('country') || '').toUpperCase() || null
    const breakdown = searchParams.get('breakdown') || null
    if (!since || !until) {
      return NextResponse.json({ error: 'Parametri since e until obbligatori (YYYY-MM-DD)' }, { status: 400 })
    }

    // ── Dettaglio giornaliero di UN paese (drill-down) ──────────────────────
    if (breakdown === 'daily') {
      const name = countryFilter ? CODE_TO_NAME[countryFilter] : null
      const where = name ? `WHERE billing_country = '${name.replace(/'/g, '')}'` : ''
      const rows = await shopifyQL(`FROM sales SHOW ${SHOW} ${where} GROUP BY day SINCE ${since} UNTIL ${until} ORDER BY day ASC`)
      const byDate = new Map()
      for (const r of rows) {
        const date = String(r.day || r.date || '').slice(0, 10)
        if (!date) continue
        byDate.set(date, {
          date,
          revenue: cleanMoney(r.total_sales),
          orders: cleanCount(r.orders),
          ncOrders: cleanCount(r.orders_first_time),
          rcOrders: cleanCount(r.orders_returning),
          ncRevenue: cleanMoney(r.total_sales_first_time),
          rcRevenue: cleanMoney(r.total_sales_returning),
        })
      }
      // Genera tutte le date (anche a 0) per una linea continua.
      const daily = []
      const cursor = new Date(`${since}T00:00:00Z`)
      const last = new Date(`${until}T00:00:00Z`)
      while (cursor <= last) {
        const ymd = cursor.toISOString().slice(0, 10)
        daily.push(byDate.get(ymd) || { date: ymd, revenue: 0, orders: 0, ncOrders: 0, rcOrders: 0, ncRevenue: 0, rcRevenue: 0 })
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
      return NextResponse.json({ since, until, country: countryFilter, daily, updatedAt: new Date().toISOString() })
    }

    // ── Vendite per paese (aggregato del periodo) ───────────────────────────
    const rows = await shopifyQL(`FROM sales SHOW ${SHOW} GROUP BY billing_country SINCE ${since} UNTIL ${until} ORDER BY total_sales DESC`)
    const countries = []
    let totRevenue = 0, totOrders = 0
    for (const r of rows) {
      const rawName = String(r.billing_country || '').trim()
      const displayName = rawName || 'Sconosciuto'
      const code = NAME_TO_CODE[rawName] || null
      const revenue = cleanMoney(r.total_sales)
      const orders = cleanCount(r.orders)
      if (revenue === 0 && orders === 0) continue
      countries.push({
        country: displayName,
        country_code: code,
        revenue,
        orders,
        ncOrders: cleanCount(r.orders_first_time),
        rcOrders: cleanCount(r.orders_returning),
        ncRevenue: cleanMoney(r.total_sales_first_time),
        rcRevenue: cleanMoney(r.total_sales_returning),
      })
      totRevenue += revenue
      totOrders += orders
    }

    return NextResponse.json({
      since,
      until,
      total: { revenue: Math.round(totRevenue * 100) / 100, orders: totOrders },
      countries,
      updatedAt: new Date().toISOString(),
    })
  })
}
