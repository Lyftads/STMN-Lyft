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
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
      raw = raw.replace(/\./g, '').replace(',', '.')
    } else {
      raw = raw.replace(/,/g, '')
    }
  } else if (hasComma && !hasDot) {
    raw = raw.replace(',', '.')
  } else if (hasDot && !hasComma) {
    const parts = raw.split('.')

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

function toDateString(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date, amount) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + amount)
  return d
}

function getPresetRange(preset = 'last_90d') {
  const today = new Date()
  const until = toDateString(today)

  if (preset === 'today') {
    return { since: until, until, label: 'Oggi' }
  }

  if (preset === 'yesterday') {
    const y = toDateString(addDays(today, -1))
    return { since: y, until: y, label: 'Ieri' }
  }

  // Shopify "Ultimi N giorni" = [oggi-N, oggi] (verificato sul report: last_7d
  // = 26/05 → 02/06, cioe' oggi-7 → oggi). Allineiamo tutti i preset relativi.
  if (preset === 'last_7d') {
    return { since: toDateString(addDays(today, -7)), until, label: 'Ultimi 7 giorni' }
  }

  if (preset === 'last_14d') {
    return { since: toDateString(addDays(today, -14)), until, label: 'Ultimi 14 giorni' }
  }

  if (preset === 'last_28d') {
    return { since: toDateString(addDays(today, -28)), until, label: 'Ultimi 28 giorni' }
  }

  if (preset === 'last_30d') {
    return { since: toDateString(addDays(today, -30)), until, label: 'Ultimi 30 giorni' }
  }

  if (preset === 'last_90d') {
    return { since: toDateString(addDays(today, -90)), until, label: 'Ultimi 90 giorni' }
  }

  if (preset === 'current_month' || preset === 'mtd') {
    return { since: `${until.slice(0, 7)}-01`, until, label: 'Mese corrente' }
  }

  if (preset === 'last_month') {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const end = new Date(today.getFullYear(), today.getMonth(), 0)
    return { since: toDateString(d), until: toDateString(end), label: 'Mese scorso' }
  }

  if (preset === 'ytd') {
    return { since: `${until.slice(0, 4)}-01-01`, until, label: 'Anno corrente' }
  }

  // quarter_YYYY-Qn → full calendar quarter
  if (typeof preset === 'string' && preset.startsWith('quarter_')) {
    const qKey = preset.slice(8) // YYYY-Qn
    const match = qKey.match(/^(\d{4})-Q([1-4])$/)
    if (match) {
      const y = Number(match[1])
      const q = Number(match[2])
      const startMonth = (q - 1) * 3 + 1
      const endMonth = startMonth + 2
      const startRaw = `${y}-${String(startMonth).padStart(2, '0')}-01`
      const lastDay = new Date(y, endMonth, 0).getDate()
      const endRaw = `${y}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      const end = endRaw > until ? until : endRaw
      return { since: startRaw, until: end, label: `Q${q} ${y}` }
    }
  }

  // year_YYYY → full calendar year (capped a oggi se in corso)
  if (typeof preset === 'string' && preset.startsWith('year_')) {
    const yKey = preset.slice(5)
    const match = yKey.match(/^(\d{4})$/)
    if (match) {
      const y = Number(match[1])
      const startRaw = `${y}-01-01`
      const endRaw = `${y}-12-31`
      const end = endRaw > until ? until : endRaw
      return { since: startRaw, until: end, label: `${y}` }
    }
  }

  // month_YYYY-MM → full calendar month
  if (typeof preset === 'string' && preset.startsWith('month_')) {
    const m = preset.slice(6) // YYYY-MM
    const [y, mm] = m.split('-').map(Number)
    if (y && mm) {
      const start = `${m}-01`
      const lastDay = new Date(y, mm, 0).getDate()
      const endRaw = `${m}-${String(lastDay).padStart(2, '0')}`
      const end = endRaw > until ? until : endRaw
      const monthNames = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
      return { since: start, until: end, label: `${monthNames[mm-1]} ${y}` }
    }
  }

  return { since: toDateString(addDays(today, -89)), until, label: 'Ultimi 90 giorni' }
}

function getPreviousRange(range, preset) {
  if (!range?.since || !range?.until) {
    return {
      since: null,
      until: null,
      label: 'Periodo precedente',
    }
  }

  // Per quarter_YYYY-Qn: previous = quarter calendario precedente intero
  if (typeof preset === 'string' && preset.startsWith('quarter_')) {
    const qKey = preset.slice(8)
    const match = qKey.match(/^(\d{4})-Q([1-4])$/)
    if (match) {
      let y = Number(match[1])
      let q = Number(match[2]) - 1
      if (q < 1) { q = 4; y -= 1 }
      const startMonth = (q - 1) * 3 + 1
      const endMonth = startMonth + 2
      const since = `${y}-${String(startMonth).padStart(2,'0')}-01`
      const lastDay = new Date(y, endMonth, 0).getDate()
      const until = `${y}-${String(endMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
      return { since, until, label: `Q${q} ${y}` }
    }
  }

  // Per year_YYYY: previous = anno calendario precedente INTERO
  if (typeof preset === 'string' && preset.startsWith('year_')) {
    const yKey = preset.slice(5)
    const match = yKey.match(/^(\d{4})$/)
    if (match) {
      const py = Number(match[1]) - 1
      return { since: `${py}-01-01`, until: `${py}-12-31`, label: `${py}` }
    }
  }

  // Per month_YYYY-MM: previous = mese calendario precedente intero
  if (typeof preset === 'string' && preset.startsWith('month_')) {
    const m = preset.slice(6)
    const [y, mm] = m.split('-').map(Number)
    if (y && mm) {
      let py = y, pm = mm - 1
      if (pm < 1) { pm = 12; py -= 1 }
      const since = `${py}-${String(pm).padStart(2,'0')}-01`
      const lastDay = new Date(py, pm, 0).getDate()
      const until = `${py}-${String(pm).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
      return { since, until, label: `${py}-${String(pm).padStart(2,'0')}` }
    }
  }

  const sinceDate = new Date(`${range.since}T00:00:00Z`)
  const untilDate = new Date(`${range.until}T00:00:00Z`)
  const days = Math.max(
    1,
    Math.round((untilDate.getTime() - sinceDate.getTime()) / 86400000) + 1
  )

  const previousUntil = addDays(sinceDate, -1)
  const previousSince = addDays(previousUntil, -(days - 1))

  return {
    since: toDateString(previousSince),
    until: toDateString(previousUntil),
    label: 'Periodo precedente',
  }
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

    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const monthEnd = `${monthStr}-${String(lastDay).padStart(2, '0')}`

    const endDate = monthEnd > todayStr ? todayStr : monthEnd

    months.push({ month: monthStr, start: startDate, end: endDate })

    m++
    if (m > 12) {
      m = 1
      y++
    }
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

// ── Fallback NC/RC via REST Orders ─────────────────────────────
// Usato quando ShopifyQL breakdown ritorna 0 ordini classificati
// (tipico per range cortissimi recenti come oggi/ieri/last_7d).
// classifyOrder() robusto: gestisce orders_count null per ordini
// freschissimi (counter aggiornato asincronamente da Shopify).
function classifyOrderRest(o) {
  const c = o?.customer
  if (!c || !c.id) return null // guest checkout
  const cnt = c.orders_count
  if (typeof cnt === 'number' && cnt > 0) return cnt === 1 ? 'NC' : 'RC'
  // Fallback heuristic quando orders_count e' null:
  // customer.created_at vicino a order.created_at → cliente nuovo
  const orderTs = Date.parse(o.created_at || '')
  const custTs = Date.parse(c.created_at || '')
  if (Number.isFinite(orderTs) && Number.isFinite(custTs)) {
    return Math.abs(orderTs - custTs) / 1000 < 300 ? 'NC' : 'RC'
  }
  return 'NC' // conservativo: customer esiste ma niente date utili
}

async function fetchNcRcFromOrdersRest(start, end, { timeoutMs = 12000 } = {}) {
  const sinceIso = `${start}T00:00:00Z`
  const endDate = new Date(`${end}T00:00:00Z`)
  endDate.setUTCDate(endDate.getUTCDate() + 1)
  const untilIso = endDate.toISOString()

  // Timeout globale: se Shopify e' lento, abortiamo per non bloccare l'intera
  // response /api/metrics (maxDuration 30s, ma vogliamo tornare prima
  // anche con dati parziali piuttosto che con un 504).
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)

  let orders = []
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${sinceIso}&created_at_max=${untilIso}&limit=250&fields=id,created_at,total_price,customer`
  let safety = 0
  try {
    while (url && safety < 50) {
      safety++
      const res = await fetch(url, {
        headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN },
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!res.ok) break
      const data = await res.json()
      orders = orders.concat(data.orders || [])
      const link = res.headers.get('Link')
      if (link && link.includes('rel="next"')) {
        const m = link.match(/<([^>]+)>;\s*rel="next"/)
        url = m ? m[1] : null
      } else url = null
    }
  } catch (e) {
    // Abort o errore di rete → ritorna quello che abbiamo raccolto
  } finally {
    clearTimeout(t)
  }

  let nc = 0, rc = 0, fatturNC = 0, fatturRC = 0
  for (const o of orders) {
    const cls = classifyOrderRest(o)
    const rev = parseFloat(o.total_price || 0)
    if (cls === 'NC') { nc++; fatturNC += rev }
    else if (cls === 'RC') { rc++; fatturRC += rev }
  }
  return { nc, rc, fatturNC: roundMoney(fatturNC), fatturRC: roundMoney(fatturRC), partial: !!url }
}

// ── Admin Orders via GraphQL — NC/RC real-time per i giorni recenti ─────
// ShopifyQL `sales` ha latenza di aggregazione (ultimi ~5-7 giorni), quindi
// per le finestre recenti torna 0/parziale. L'oggetto customer REST incorporato
// nell'ordine NON contiene orders_count (snapshot ridotto), ma la GraphQL
// Admin API espone customer.numberOfOrders (conteggio lifetime) → numberOfOrders
// <= 1 ⇒ nuovo cliente, > 1 ⇒ cliente di ritorno. Combacia con la dashboard.
async function fetchShopifyOrdersAdminGQL(start, end, maxPages = 20) {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return null

  const gql = `
    query($q: String!, $cursor: String) {
      orders(first: 100, query: $q, after: $cursor, sortKey: CREATED_AT) {
        edges {
          cursor
          node {
            currentTotalPriceSet { shopMoney { amount } }
            totalRefundedSet { shopMoney { amount } }
            customer { numberOfOrders }
          }
        }
        pageInfo { hasNextPage }
      }
    }
  `
  const q = `created_at:>=${start}T00:00:00Z created_at:<=${end}T23:59:59Z financial_status:paid`

  let cursor = null
  let pages = 0
  let ordini = 0, nc = 0, rc = 0
  let fatturato = 0, fatturNC = 0, fatturRC = 0
  let resi = 0, resiNC = 0, resiRC = 0

  try {
    while (pages < maxPages) {
      const res = await fetch(
        `https://${SHOPIFY_STORE}/admin/api/2024-01/graphql.json`,
        {
          method: 'POST',
          headers: shopifyGraphQLHeaders(),
          body: JSON.stringify({ query: gql, variables: { q, cursor } }),
        }
      )
      if (!res.ok) break
      const json = await res.json()
      if (json.errors?.length) {
        console.log('Admin GQL orders error:', JSON.stringify(json.errors).slice(0, 200))
        break
      }
      const conn = json.data?.orders
      const edges = conn?.edges || []
      for (const e of edges) {
        const n = e.node
        const total = parseFloat(n.currentTotalPriceSet?.shopMoney?.amount || 0)
        const refund = Math.abs(parseFloat(n.totalRefundedSet?.shopMoney?.amount || 0))
        const num = Number(n.customer?.numberOfOrders || 0)
        const isNew = num <= 1
        ordini += 1
        fatturato += total
        resi += refund
        if (isNew) { nc += 1; fatturNC += total; resiNC += refund }
        else { rc += 1; fatturRC += total; resiRC += refund }
      }
      pages++
      if (!conn?.pageInfo?.hasNextPage) break
      cursor = edges[edges.length - 1]?.cursor
      if (!cursor) break
    }
    return {
      fatturato: roundMoney(fatturato),
      resi: roundMoney(resi),
      fatturNC: roundMoney(fatturNC),
      resiNC: roundMoney(resiNC),
      fatturRC: roundMoney(fatturRC),
      resiRC: roundMoney(resiRC),
      ordini, nc, rc,
    }
  } catch (e) {
    console.log('Admin GQL orders exception:', e.message)
    return null
  }
}

// ── Shopify sales per range arbitrario ─────────────────────────
async function fetchShopifySalesRange(start, end) {
  // 1) Query non filtrata per il totale ACCURATO (include guest checkouts
  //    e ordini senza classificazione NC/RC che la WHERE escludeva).
  const totalsQuery = `
    FROM sales
      SHOW orders, total_sales, returns
      SINCE ${start}
      UNTIL ${end}
      WITH TOTALS, CURRENCY 'EUR'
  `

  // 2) Query filtrata solo per la suddivisione NC/RC
  const breakdownQuery = `
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

  // Sequenziale (non Promise.all) per evitare rate-limit GraphQL su range
  // lunghi (year_YYYY) dove totals o breakdown spariscono random
  const totalsRows = await shopifyQL(totalsQuery)
  const rows = await shopifyQL(breakdownQuery)

  // Totali reali dalla query non filtrata
  let fatturato = 0, ordini = 0, resi = 0
  for (const row of (totalsRows || [])) {
    fatturato += cleanMoney(row.total_sales)
    ordini += cleanCount(row.orders)
    resi += Math.abs(cleanMoney(row.returns))
  }

  // Suddivisione NC/RC dalla query filtrata
  let fatturNC = 0, fatturRC = 0
  let resiNC = 0, resiRC = 0
  let nc = 0, rc = 0

  for (const row of rows) {
    const segment = String(row.new_or_returning_customer || '').toLowerCase()

    const rowTotalSales = cleanMoney(row.total_sales)
    const rowOrders = cleanCount(row.orders)
    const rowReturns = Math.abs(cleanMoney(row.returns))

    const isNew =
      segment.includes('new') ||
      segment.includes('first') ||
      segment.includes('nuov')

    const isReturning =
      segment.includes('return') ||
      segment.includes('ritorn') ||
      segment.includes('recurr')

    if (isNew) {
      // "ordini da nuovi clienti" = tutti gli ordini fatti da clienti new
      // nel segmento (incluso repeat purchases nello stesso periodo).
      // row.orders nel gruppo new_or_returning_customer='new' è già quello.
      nc += rowOrders
      fatturNC += rowTotalSales
      resiNC += rowReturns
    }

    if (isReturning) {
      // "ordini da clienti di ritorno" = tutti gli ordini fatti da clienti
      // returning nel segmento. row.orders nel gruppo è già quello.
      rc += rowOrders
      fatturRC += rowTotalSales
      resiRC += rowReturns
    }
  }

  if (fatturRC <= 0 && fatturato > 0 && fatturNC > 0) {
    fatturRC = Math.max(fatturato - fatturNC, 0)
  }

  // Cross-fallback per range lunghi (es. year_) dove una delle due query
  // può fallire silenziosamente per rate limit / cost ShopifyQL.
  // Se totals=0 ma breakdown ha dati → ricostruisce totals da NC+RC
  // (escludendo guest checkouts ma meglio di "—").
  if (fatturato <= 0 && (fatturNC > 0 || fatturRC > 0)) {
    fatturato = fatturNC + fatturRC
  }
  if (ordini <= 0 && (nc > 0 || rc > 0)) {
    ordini = nc + rc
  }
  if (resi <= 0 && (resiNC > 0 || resiRC > 0)) {
    resi = resiNC + resiRC
  }

  // Retry del breakdown quando totals esiste ma NC/RC sono 0
  // (succede sui range lunghi quando solo la query GROUP BY fallisce)
  if ((nc === 0 && rc === 0) && fatturato > 0) {
    const retryRows = await shopifyQL(breakdownQuery)
    for (const row of retryRows) {
      const segment = String(row.new_or_returning_customer || '').toLowerCase()
      const rowTotalSales = cleanMoney(row.total_sales)
      const rowOrders = cleanCount(row.orders)
      const rowReturns = Math.abs(cleanMoney(row.returns))
      const isNew = segment.includes('new') || segment.includes('first') || segment.includes('nuov')
      const isReturning = segment.includes('return') || segment.includes('ritorn') || segment.includes('recurr')
      if (isNew) { nc += rowOrders; fatturNC += rowTotalSales; resiNC += rowReturns }
      if (isReturning) { rc += rowOrders; fatturRC += rowTotalSales; resiRC += rowReturns }
    }
    if (fatturRC <= 0 && fatturato > 0 && fatturNC > 0) {
      fatturRC = Math.max(fatturato - fatturNC, 0)
    }
  }

  // [Fallback REST disabilitato — stava bloccando last_7d ed e' opt-in
  //  solo se davvero serve, attiva con ENABLE_NCRC_REST_FALLBACK=true]
  const enableRestFallback = process.env.ENABLE_NCRC_REST_FALLBACK === 'true'
  if (enableRestFallback) {
    const shopifyClassified = (nc || 0) + (rc || 0)
    const isIncomplete = ordini > 0 && shopifyClassified < ordini * 0.85
    if ((isIncomplete || (nc === 0 && rc === 0)) && fatturato > 0 && SHOPIFY_STORE && SHOPIFY_TOKEN) {
      try {
        const restCounts = await fetchNcRcFromOrdersRest(start, end, { timeoutMs: 8000 })
        const restClassified = (restCounts?.nc || 0) + (restCounts?.rc || 0)
        if (restCounts && restClassified > shopifyClassified) {
          nc = restCounts.nc
          rc = restCounts.rc
          fatturNC = restCounts.fatturNC
          fatturRC = restCounts.fatturRC
        }
      } catch {}
    }
  }

  // NB: questa funzione restituisce SEMPRE i dati ShopifyQL (total_sales, gia'
  // al netto dei resi, IVA/spedizione incluse) — coerente col report Shopify.
  // L'eventuale override real-time per le finestre piccole e recenti vive in
  // safeShopifyRange, cosi' tocca SOLO le card KPI e non Weekly/Monthly (che
  // restano interamente su ShopifyQL).
  return {
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
async function fetchShopifyOrdersSince(startDate = START_DATE, endDate = null) {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return []

  const orders = []
  const createdAtMin = `${startDate}T00:00:00Z`
  const createdAtMax = endDate ? `${endDate}T23:59:59Z` : null

  let url =
    `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json` +
    `?status=any` +
    `&financial_status=paid` +
    `&created_at_min=${encodeURIComponent(createdAtMin)}` +
    (createdAtMax ? `&created_at_max=${encodeURIComponent(createdAtMax)}` : '') +
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
async function fetchShopifyTopProducts(start = START_DATE, end = null) {
  const orders = await fetchShopifyOrdersSince(start, end)
  const map = {}

  for (const order of orders) {
    const lineItems = order.line_items || []

    for (const item of lineItems) {
      const title =
        item.title ||
        item.product_title ||
        item.name ||
        item.variant_title ||
        item.sku ||
        'Prodotto sconosciuto'

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
          label: title,
          revenue: 0,
          value: 0,
          orders: 0,
          quantity: 0,
        }
      }

      map[title].revenue += revenue
      map[title].value += revenue
      map[title].orders += 1
      map[title].quantity += quantity
    }
  }

  return Object.values(map)
    .map(row => ({
      ...row,
      revenue: roundMoney(row.revenue),
      value: roundMoney(row.value),
      orders: cleanCount(row.orders),
      quantity: cleanCount(row.quantity),
    }))
    .filter(row => row.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
}

// ── KPI Brain: vendite attribuite al marketing ─────────────────
async function fetchShopifyMarketingSources(start = START_DATE, end = null) {
  const orders = await fetchShopifyOrdersSince(start, end)
  const map = {}

  for (const order of orders) {
    if (!isMarketingSource(order)) continue

    const label = getSourceLabel(order)
    const revenue = getOrderRevenue(order)

    if (!map[label]) {
      map[label] = {
        source: label,
        label,
        revenue: 0,
        value: 0,
        orders: 0,
      }
    }

    map[label].revenue += revenue
    map[label].value += revenue
    map[label].orders += 1
  }

  return Object.values(map)
    .map(row => ({
      ...row,
      revenue: roundMoney(row.revenue),
      value: roundMoney(row.value),
      orders: cleanCount(row.orders),
    }))
    .filter(row => row.revenue > 0 || row.orders > 0)
    .sort((a, b) => b.revenue - a.revenue)
}

// ── KPI Brain: revenue e ordini per giorno settimana ───────────
async function fetchShopifyDayBreakdown(start = START_DATE, end = null) {
  const orders = await fetchShopifyOrdersSince(start, end)

  const days = [
    { key: 1, label: 'Lunedì' },
    { key: 2, label: 'Martedì' },
    { key: 3, label: 'Mercoledì' },
    { key: 4, label: 'Giovedì' },
    { key: 5, label: 'Venerdì' },
    { key: 6, label: 'Sabato' },
    { key: 0, label: 'Domenica' },
  ]

  const map = {}

  for (const day of days) {
    map[day.key] = {
      day: day.label,
      label: day.label,
      revenue: 0,
      value: 0,
      orders: 0,
    }
  }

  for (const order of orders) {
    const date = new Date(order.created_at)
    const day = date.getDay()

    if (!map[day]) continue

    const revenue = getOrderRevenue(order)

    map[day].revenue += revenue
    map[day].value += revenue
    map[day].orders += 1
  }

  return days.map(day => ({
    day: map[day.key].day,
    label: map[day.key].label,
    revenue: roundMoney(map[day.key].revenue),
    value: roundMoney(map[day.key].value),
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

// Direct Admin REST API — accurate, matches Shopify dashboard exactly
async function fetchShopifyOrdersAdmin(start, end, maxPages = 20) {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return null
  try {
    const sinceIso = `${start}T00:00:00Z`
    const untilIso = `${end}T23:59:59Z`
    let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${sinceIso}&created_at_max=${untilIso}&limit=250&fields=id,total_price,subtotal_price,customer,refunds,cancelled_at`
    let revenue = 0, orders = 0, resi = 0
    let fatturNC = 0, fatturRC = 0, nc = 0, rc = 0
    let resiNC = 0, resiRC = 0
    let page = 0
    let truncated = false
    while (url && page < maxPages) {
      const res = await fetch(url, { headers: shopifyAuth() })
      if (!res.ok) break
      const data = await res.json()
      for (const o of (data.orders || [])) {
        if (o.cancelled_at) continue
        const total = parseFloat(o.total_price || 0)
        const isNew = !o.customer?.orders_count || Number(o.customer.orders_count) <= 1
        revenue += total
        orders += 1
        if (isNew) { fatturNC += total; nc += 1 }
        else { fatturRC += total; rc += 1 }
        for (const refund of (o.refunds || [])) {
          for (const t of (refund.transactions || [])) {
            const amt = Math.abs(parseFloat(t.amount || 0))
            resi += amt
            if (isNew) resiNC += amt; else resiRC += amt
          }
        }
      }
      const linkHeader = res.headers.get('link') || ''
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
      url = nextMatch ? nextMatch[1] : null
      page += 1
      if (page >= maxPages && url) truncated = true
    }
    return { fatturato: revenue, fatturNC, fatturRC, resi, resiNC, resiRC, ordini: orders, nc, rc, truncated }
  } catch (e) {
    console.log('Admin orders error:', e.message)
    return null
  }
}

async function safeShopifyRange(range) {
  if (!range?.since || !range?.until) return null

  // ShopifyQL is PRIMARY — uses Shopify's native NC/RC classification
  // based on order time (not current customer state), and standardized
  // total_sales field that matches the Admin dashboard.
  const [salesQL, sessions] = await Promise.all([
    fetchShopifySalesRange(range.since, range.until).catch(e => { console.log('salesQL err:', e?.message); return null }),
    fetchShopifyVisitorsRange(range.since, range.until).catch(e => { console.log('visitors err:', e?.message); return 0 }),
  ])

  let sales = salesQL

  // Override real-time SOLO per le card KPI su finestre piccole e recenti
  // (oggi, ieri, ultimi 7 giorni) e SOLO finche' ShopifyQL non ha ancora
  // consolidato la classificazione new/returning (job notturno). Appena ShopifyQL
  // ha i dati classificati li usiamo (combaciano ESATTAMENTE col report Shopify);
  // l'Admin GraphQL (stima via numberOfOrders) interviene solo come ripiego quando
  // ShopifyQL e' ancora a 0. Non tocca Weekly/Monthly (interamente ShopifyQL).
  const classificationMissing = ((salesQL?.nc || 0) + (salesQL?.rc || 0)) === 0
  const endsRecently =
    Date.now() - new Date(`${range.until}T23:59:59Z`).getTime() < 9 * 86400000
  const windowDays =
    Math.round(
      (new Date(`${range.until}T00:00:00Z`).getTime() -
        new Date(`${range.since}T00:00:00Z`).getTime()) /
        86400000
    ) + 1
  if (classificationMissing && endsRecently && windowDays <= 10 && SHOPIFY_STORE && SHOPIFY_TOKEN) {
    const admin = await fetchShopifyOrdersAdminGQL(range.since, range.until)
    if (admin && admin.ordini > 0) {
      sales = admin
    }
  }

  if (!sales) {
    sales = { fatturato: 0, fatturNC: 0, fatturRC: 0, resi: 0, resiNC: 0, resiRC: 0, ordini: 0, nc: 0, rc: 0 }
  }

  return {
    since: range.since,
    until: range.until,
    revenue: sales.fatturato || 0,
    fatturNC: sales.fatturNC || 0,
    fatturRC: sales.fatturRC || 0,
    resi: sales.resi || 0,
    resiNC: sales.resiNC || 0,
    resiRC: sales.resiRC || 0,
    orders: sales.ordini || 0,
    nc: sales.nc || 0,
    rc: sales.rc || 0,
    sessions: sessions || 0,
  }
}

async function safeMetaRange(range) {
  try {
    if (!META_TOKEN || !META_ACCOUNT) return null
    if (!range?.since || !range?.until) return null
    const accounts = META_ACCOUNT.split(',').map(s => s.trim()).filter(Boolean)
    const fields = 'spend,impressions,reach,frequency,cpm,ctr,outbound_clicks,cost_per_outbound_click'
    let spend = 0, impressions = 0, reach = 0, clicks = 0
    for (const id of accounts) {
      const url = `https://graph.facebook.com/v19.0/${id}/insights?fields=${fields}&time_range={"since":"${range.since}","until":"${range.until}"}&access_token=${META_TOKEN}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.error) continue
      for (const d of (data.data || [])) {
        spend += parseFloat(d.spend || 0)
        impressions += parseInt(d.impressions || 0)
        reach += parseInt(d.reach || 0)
        clicks += Array.isArray(d.outbound_clicks)
          ? parseInt(d.outbound_clicks.find(x => x.action_type === 'outbound_click')?.value || 0)
          : 0
      }
    }
    return {
      since: range.since,
      until: range.until,
      spend: Math.round(spend * 100) / 100,
      impressions,
      reach,
      clicks,
    }
  } catch (e) {
    console.log('metaRange error:', e.message)
    return null
  }
}

async function safeShopifyTopProducts(range) {
  try {
    return await fetchShopifyTopProducts(range?.since || START_DATE, range?.until || null)
  } catch (e) {
    console.log('KPI Brain top products error:', e.message)
    return []
  }
}

async function safeShopifyMarketingSources(range) {
  try {
    return await fetchShopifyMarketingSources(range?.since || START_DATE, range?.until || null)
  } catch (e) {
    console.log('KPI Brain marketing sources error:', e.message)
    return []
  }
}

async function safeShopifyDayBreakdown(range) {
  try {
    return await fetchShopifyDayBreakdown(range?.since || START_DATE, range?.until || null)
  } catch (e) {
    console.log('KPI Brain day breakdown error:', e.message)
    return []
  }
}

// ── API Route ─────────────────────────────────────────────────
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('preset') || 'last_90d'

    const range = getPresetRange(preset)
    const previousRange = getPreviousRange(range, preset)

    const [
      aovData,
      shopifyWeekly,
      shopifyMonthly,
      metaMonthly,
      metaWeekly,
      shopifyTopProducts,
      shopifyMarketingSources,
      shopifyDayBreakdown,
      previousShopifyTopProducts,
      previousShopifyMarketingSources,
      previousShopifyDayBreakdown,
      shopifyRange,
      shopifyPrevRange,
      metaRange,
      metaPrevRange,
    ] = await Promise.all([
      fetchAOV(),
      fetchShopifyWeekly(),
      fetchShopifyMonthly(),
      fetchMeta(),
      fetchMetaWeekly(),
      safeShopifyTopProducts(range),
      safeShopifyMarketingSources(range),
      safeShopifyDayBreakdown(range),
      safeShopifyTopProducts(previousRange),
      safeShopifyMarketingSources(previousRange),
      safeShopifyDayBreakdown(previousRange),
      safeShopifyRange(range),
      safeShopifyRange(previousRange),
      safeMetaRange(range),
      safeMetaRange(previousRange),
    ])

    const metaTotal = metaMonthly.reduce(
      (sum, row) => sum + row.spend,
      0
    )

    return NextResponse.json({
      aovLive: Math.round(aovData.aov * 100) / 100,
      ordersLive: aovData.orders,

      shopifyWeekly,
      shopifyMonthly,

      shopifyTopProducts,
      shopifyMarketingSources,
      shopifyDayBreakdown,

      shopifyRange,
      shopifyPrevRange,
      metaRange,
      metaPrevRange,

      kpiBrain: {
        preset,
        range,
        previousRange,
        previous: {
          shopifyTopProducts: previousShopifyTopProducts,
          shopifyMarketingSources: previousShopifyMarketingSources,
          shopifyDayBreakdown: previousShopifyDayBreakdown,
        },
      },

      metaSpend: Math.round(metaTotal * 100) / 100,
      metaMonthly,
      metaWeekly,

      sources: {
        shopify:
          aovData.orders > 0 ||
          shopifyWeekly.length > 0 ||
          shopifyMonthly.length > 0 ||
          shopifyTopProducts.length > 0 ||
          shopifyMarketingSources.length > 0 ||
          shopifyDayBreakdown.some(row => row.revenue > 0 || row.orders > 0),
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
        previous: {
          shopifyTopProducts: [],
          shopifyMarketingSources: [],
          shopifyDayBreakdown: [],
        },
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
