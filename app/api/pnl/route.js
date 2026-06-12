export const dynamic = 'force-dynamic'
export const maxDuration = 60
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'

const storeUrl = () => getShopify().storeUrl
const token = () => getShopify().adminToken
const num = (v) => {
  if (v == null) return 0
  if (typeof v === 'object') v = v.amount ?? v.value ?? 0
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const r2 = (n) => Math.round(num(n) * 100) / 100
// estrae 'YYYY-MM' dalla riga ShopifyQL (la dimensione mese può avere nomi diversi)
const monthOfRow = (row) => {
  const v = row.month || row.billing_month || Object.values(row).find(x => typeof x === 'string' && /^\d{4}-\d{2}/.test(x)) || ''
  return String(v).slice(0, 7)
}

// ── ShopifyQL (stesso pattern di /api/metrics, con retry sul throttling) ──
async function shopifyQL(query) {
  if (!storeUrl() || !token()) return []
  const gql = `query($q: String!) { shopifyqlQuery(query: $q) { tableData { columns { name displayName } rows } parseErrors } }`
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`https://${storeUrl()}/admin/api/2026-04/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token() || '', 'Content-Type': 'application/json' },
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
        cols.forEach((c, i) => { o[c.name || c.displayName || `c${i}`] = row[i] })
        return o
      })
    } catch { if (attempt < 4) { await sleep(900 * attempt); continue } return [] }
  }
  return []
}

// ── Fee reali da Shopify Payments (best-effort; richiede Shopify Payments +
//    scope read_shopify_payments_payouts). Aggrega le fee per mese. ──
async function fetchFeesByMonth(sinceISO) {
  if (!storeUrl() || !token()) return null
  const byMonth = {}
  let url = `https://${storeUrl()}/admin/api/2024-01/shopify_payments/balance/transactions.json?limit=250`
  let pages = 0
  try {
    while (url && pages < 40) {
      pages++
      const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': token() || '' } })
      if (!res.ok) return null // 403/404 → niente Shopify Payments o scope mancante
      const j = await res.json().catch(() => null)
      const txs = j?.transactions || []
      let oldest = null
      for (const t of txs) {
        const d = t.processed_at || t.payout_date || t.created_at
        if (!d) continue
        oldest = d
        if (new Date(d) < new Date(sinceISO)) continue
        const key = String(d).slice(0, 7) // YYYY-MM
        byMonth[key] = (byMonth[key] || 0) + Math.abs(num(t.fee))
      }
      // paginazione via Link header
      const link = res.headers.get('link') || ''
      const next = /<([^>]+)>;\s*rel="next"/.exec(link)
      url = next ? next[1] : null
      if (oldest && new Date(oldest) < new Date(sinceISO)) break
    }
    for (const k in byMonth) byMonth[k] = r2(byMonth[k])
    return byMonth
  } catch { return null }
}

// ── Ripartizione del fatturato per gateway di pagamento (ultimi ~60 giorni di
//    ordini, limite Shopify senza read_all_orders). Usata per stimare le fee dei
//    gateway esterni (PayPal/Klarna/Scalapay/…) per cui Shopify non dà la fee. ──
async function fetchGatewayMix() {
  if (!storeUrl() || !token()) return null
  const sinceISO = new Date(Date.now() - 60 * 86400000).toISOString()
  const mix = {}
  let total = 0, pages = 0
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  let url = `https://${storeUrl()}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${encodeURIComponent(sinceISO)}&limit=250&fields=id,current_total_price,total_price,payment_gateway_names,gateway`
  try {
    while (url && pages < 60) {
      pages++
      let res = null
      for (let a = 0; a < 5; a++) {
        res = await fetch(url, { headers: { 'X-Shopify-Access-Token': token() || '' } })
        if (res.status === 429 || res.status === 430) { await sleep((Number(res.headers.get('Retry-After')) || 2) * 1000); continue }
        break
      }
      if (!res || !res.ok) break
      const j = await res.json().catch(() => null)
      for (const o of (j?.orders || [])) {
        const amt = num(o.current_total_price ?? o.total_price)
        if (!amt) continue
        const gws = (Array.isArray(o.payment_gateway_names) && o.payment_gateway_names.length) ? o.payment_gateway_names : [o.gateway || 'unknown']
        const per = amt / gws.length // split equo se multi-gateway (raro)
        for (const g of gws) { const k = String(g || 'unknown'); mix[k] = (mix[k] || 0) + per; total += per }
      }
      const link = res.headers.get('link') || ''
      const next = /<([^>]+)>;\s*rel="next"/.exec(link)
      url = next ? next[1] : null
    }
    for (const k in mix) mix[k] = r2(mix[k])
    return total > 0 ? { mix, total: r2(total) } : null
  } catch { return null }
}

// COGS reale mensile dalle analitiche Shopify. Provo i nomi metrica possibili
// (variano per versione ShopifyQL); query SEPARATA → se un nome non esiste,
// parseError isolato e non rompe la serie principale.
async function fetchCogsByMonth(since, until) {
  const monthOf = (row) => {
    const v = row.month || Object.values(row).find(x => typeof x === 'string' && /^\d{4}-\d{2}/.test(x)) || ''
    return String(v).slice(0, 7)
  }
  const candidates = [
    // sintassi confermata dal report Shopify del merchant (cost_of_goods_sold + cost_is_recorded)
    { q: `FROM sales SHOW cost_of_goods_sold WHERE cost_is_recorded = true GROUP BY month SINCE ${since} UNTIL ${until} ORDER BY month ASC`, pick: r => Math.abs(r2(r.cost_of_goods_sold)) },
    { q: `FROM sales SHOW cost_of_goods_sold GROUP BY month SINCE ${since} UNTIL ${until} ORDER BY month ASC`, pick: r => Math.abs(r2(r.cost_of_goods_sold)) },
    { q: `FROM sales SHOW total_cost GROUP BY month SINCE ${since} UNTIL ${until} ORDER BY month ASC`, pick: r => Math.abs(r2(r.total_cost)) },
    { q: `FROM sales SHOW net_sales, gross_profit GROUP BY month SINCE ${since} UNTIL ${until} ORDER BY month ASC`, pick: r => r2(num(r.net_sales) - num(r.gross_profit)) },
  ]
  for (const c of candidates) {
    const rows = await shopifyQL(c.q)
    if (rows && rows.length) {
      const map = {}
      for (const row of rows) { const m = monthOf(row); if (m) map[m] = c.pick(row) }
      if (Object.keys(map).length) return { map, field: c.show }
    }
  }
  return null
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    if (!storeUrl() || !token()) return NextResponse.json({ configured: false, error: 'Shopify non configurato' }, { status: 200 })

    const { searchParams } = new URL(req.url)
    const months = Math.min(36, Math.max(3, Number(searchParams.get('months') || 12)))
    const now = new Date()
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))
    const since = start.toISOString().slice(0, 10)
    const until = now.toISOString().slice(0, 10)
    const origin = new URL(req.url).origin
    const cookie = req.headers.get('cookie') || '' // sessione utente → fetch interni autenticati (post-fix multi-tenant)

    return swrSnapshot(req, { tab: 'pnl', compute: async () => {
    try {
      // Interrogo OGNI metrica separatamente (query a singola metrica = robuste:
      // se un nome non è valido in questa versione ShopifyQL non azzera le altre).
      const metricOf = async (metric) => {
        const rows = await shopifyQL(`FROM sales SHOW ${metric} GROUP BY month SINCE ${since} UNTIL ${until} ORDER BY month ASC`)
        const map = {}
        for (const row of rows) { const m = monthOfRow(row); if (m) map[m] = row[metric] }
        return map
      }
      const NAMES = ['total_sales', 'net_sales', 'gross_sales', 'discounts', 'returns', 'taxes', 'shipping', 'orders']
      const maps = {}
      // SEQUENZIALI (non in parallelo): 8 query ShopifyQL in burst venivano
      // throttlate da Shopify → metriche vuote in modo intermittente/variabile.
      for (const n of NAMES) { maps[n] = await metricOf(n) }

      // diagnostica: quante righe ha restituito ogni metrica (per capire quali nomi sono validi)
      const metricRows = {}
      for (const n of NAMES) metricRows[n] = Object.keys(maps[n]).length

      const allMonths = new Set()
      for (const n of NAMES) Object.keys(maps[n]).forEach(m => allMonths.add(m))
      const series = [...allMonths].sort().map(month => {
        const netSales = r2(maps.net_sales[month])
        const taxes = r2(maps.taxes[month])
        const shipping = r2(maps.shipping[month])
        const ts = r2(maps.total_sales[month])
        // Fatturato (incl. IVA): total_sales se valorizzato, altrimenti ricostruito
        // da net_sales + IVA + spedizione (total_sales a volte torna 0 in ShopifyQL)
        const totalSales = ts > 0 ? ts : r2(netSales + taxes + shipping)
        return {
          month,
          totalSales, netSales, taxes, shipping,
          grossSales: r2(maps.gross_sales[month]),
          discounts: r2(maps.discounts[month]),
          returns: Math.abs(r2(maps.returns[month])),
          orders: Math.round(num(maps.orders[month])),
        }
      })

      // COGS ratio reale dai costi prodotto Shopify
      let cogsRatio = null, avgMargin = null
      try {
        const pc = await fetch(`${origin}/api/product-costs`, { cache: 'no-store', headers: cookie ? { cookie } : {} }).then(r => r.json())
        if (pc?.summary?.avgMargin != null) { avgMargin = pc.summary.avgMargin; cogsRatio = r2(1 - avgMargin / 100) }
        else if (pc?.avgMargin != null) { avgMargin = pc.avgMargin; cogsRatio = r2(1 - avgMargin / 100) }
      } catch {}

      // COGS reale mensile da Shopify (preferito), altrimenti ratio dai costi prodotto
      const cogsRes = await fetchCogsByMonth(since, until)
      const cogsSource = cogsRes ? 'shopify' : (cogsRatio != null ? 'ratio' : 'none')

      // Fee reali (best-effort) + ripartizione fatturato per gateway
      const [feesByMonth, gatewayMix] = await Promise.all([fetchFeesByMonth(since), fetchGatewayMix()])

      return {
        configured: true, months, since, until,
        series, metricRows,
        cogsByMonth: cogsRes?.map || null, cogsSource, cogsRatio, avgMargin,
        feesByMonth, feesSource: feesByMonth ? 'shopify-payments' : 'none',
        gatewayMix,
        updatedAt: new Date().toISOString(),
      }
    } catch (err) {
      return { __noCache: true, configured: false, error: err?.message || 'Errore' }
    }
    } })
  })
}
