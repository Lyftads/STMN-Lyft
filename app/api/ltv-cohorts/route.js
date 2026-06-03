export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'

// ── LTV & Coorti (additivo, isolato, tenant-aware) ──────────────────────────
// Analizza gli ordini Shopify per coorte di acquisizione (mese del 1° ordine):
// retention mensile, repeat rate, tempo al 2° ordine, curva LTV cumulata.
// Fetch diretta all'Admin API (no self-fetch) → robusta sui preview protetti.

const storeUrl = () => getShopify().storeUrl
const token = () => getShopify().adminToken

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(num(n) * 100) / 100

function monthKey(d) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` }
function monthIdxFromDate(d) { return d.getUTCFullYear() * 12 + d.getUTCMonth() }
function monthIdxFromKey(k) { const [y, m] = k.split('-').map(Number); return y * 12 + (m - 1) }
function median(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

async function fetchOrders(since) {
  if (!storeUrl() || !token()) return { orders: [], truncated: false }
  const out = []
  let url = `https://${storeUrl()}/admin/api/2024-01/orders.json`
    + `?status=any&financial_status=paid`
    + `&created_at_min=${encodeURIComponent(`${since}T00:00:00Z`)}`
    + `&limit=250&fields=id,created_at,total_price,customer`
  let pages = 0
  const MAX_PAGES = 160
  let truncated = false
  while (url && pages < MAX_PAGES) {
    pages++
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': token() || '' }, signal: AbortSignal.timeout(20000) })
    if (!res.ok) break
    const data = await res.json()
    out.push(...(data.orders || []))
    const link = res.headers.get('link') || ''
    const next = link.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
    if (url && pages >= MAX_PAGES) truncated = true
  }
  return { orders: out, truncated }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    if (!storeUrl() || !token()) return NextResponse.json({ error: 'Shopify non configurato', cohorts: [] }, { status: 200 })

    const { searchParams } = new URL(req.url)
    const months = Math.min(36, Math.max(3, Number(searchParams.get('months') || 12)))
    const MAX_OFFSET = 12 // colonne M0..M12

    const now = new Date()
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))
    const sinceStr = start.toISOString().slice(0, 10)
    const currentIdx = monthIdxFromDate(now)

    let truncated = false
    try {
      const r = await fetchOrders(sinceStr)
      truncated = r.truncated

      // Raggruppa ordini per cliente
      const byCustomer = new Map()
      for (const o of r.orders) {
        const cid = o.customer?.id
        if (!cid) continue
        const ts = new Date(o.created_at).getTime()
        if (!Number.isFinite(ts)) continue
        const amount = num(o.total_price)
        if (!byCustomer.has(cid)) byCustomer.set(cid, [])
        byCustomer.get(cid).push({ ts, amount })
      }

      // Coorti
      const cohortMap = new Map() // key 'YYYY-MM' → { size, active: Map<offset,Set>, rev: Map<offset,number> }
      const daysTo2nd = []
      let totalRevenue = 0, totalOrders = 0, repeatCustomers = 0
      const customerCount = byCustomer.size

      for (const [cid, ordersRaw] of byCustomer) {
        const orders = ordersRaw.sort((a, b) => a.ts - b.ts)
        const firstDate = new Date(orders[0].ts)
        const firstIdx = monthIdxFromDate(firstDate)
        const cohortKey = monthKey(firstDate)
        totalOrders += orders.length
        if (orders.length >= 2) {
          repeatCustomers++
          daysTo2nd.push((orders[1].ts - orders[0].ts) / 86400000)
        }
        if (!cohortMap.has(cohortKey)) cohortMap.set(cohortKey, { size: 0, active: new Map(), rev: new Map() })
        const co = cohortMap.get(cohortKey)
        co.size++
        for (const ord of orders) {
          totalRevenue += ord.amount
          const offset = monthIdxFromDate(new Date(ord.ts)) - firstIdx
          if (offset < 0 || offset > MAX_OFFSET) continue
          if (!co.active.has(offset)) co.active.set(offset, new Set())
          co.active.get(offset).add(cid)
          co.rev.set(offset, (co.rev.get(offset) || 0) + ord.amount)
        }
      }

      // Costruisci righe coorte (ultimi `months`, ordine cronologico desc)
      const cohortKeys = [...cohortMap.keys()].sort().slice(-months)
      const cohorts = cohortKeys.map(key => {
        const co = cohortMap.get(key)
        const baseIdx = monthIdxFromKey(key)
        const retention = []
        const ltv = []
        let cum = 0
        for (let k = 0; k <= MAX_OFFSET; k++) {
          const reached = baseIdx + k <= currentIdx
          const activeN = co.active.get(k)?.size || 0
          cum += co.rev.get(k) || 0
          retention.push({ m: k, pct: reached ? Math.round((activeN / co.size) * 1000) / 10 : null, active: reached ? activeN : null })
          ltv.push({ m: k, value: reached ? r2(cum / co.size) : null })
        }
        return { cohort: key, size: co.size, retention, ltv }
      }).reverse() // più recente in alto

      // Curve medie pesate per offset (solo coorti che hanno raggiunto l'offset)
      const retentionAvg = []
      const ltvCurve = []
      for (let k = 0; k <= MAX_OFFSET; k++) {
        let wActive = 0, wRev = 0, wSize = 0
        for (const key of cohortKeys) {
          const co = cohortMap.get(key)
          if (monthIdxFromKey(key) + k > currentIdx) continue
          wSize += co.size
          wActive += co.active.get(k)?.size || 0
          // somma cumulata fino a k
          let cum = 0
          for (let j = 0; j <= k; j++) cum += co.rev.get(j) || 0
          wRev += cum
        }
        retentionAvg.push({ m: k, pct: wSize > 0 ? Math.round((wActive / wSize) * 1000) / 10 : null })
        ltvCurve.push({ m: k, value: wSize > 0 ? r2(wRev / wSize) : null })
      }

      const summary = {
        customers: customerCount,
        repeatCustomers,
        repeatRate: customerCount > 0 ? Math.round((repeatCustomers / customerCount) * 1000) / 10 : 0,
        avgOrders: customerCount > 0 ? Math.round((totalOrders / customerCount) * 100) / 100 : 0,
        avgLtv: customerCount > 0 ? r2(totalRevenue / customerCount) : 0,
        medianDaysTo2nd: Math.round(median(daysTo2nd)),
        ordersTotal: totalOrders,
        revenueTotal: r2(totalRevenue),
      }

      return NextResponse.json({
        months, maxOffset: MAX_OFFSET, since: sinceStr, truncated,
        summary, cohorts, retentionAvg, ltvCurve,
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      return NextResponse.json({ error: err?.message || 'Errore', cohorts: [] }, { status: 200 })
    }
  })
}
