export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getMeta, getGoogle } from '../../../lib/tenant/credentials'

// ── Performance prodotti (B2C) ──
// P&L per prodotto: ricavo netto, COGS, ADS (Meta+Google allocati in proporzione
// al ricavo), margine operativo, ROAS e Δ vs periodo precedente. Read-only.

const CACHE_TTL = 5 * 60 * 1000
const __cache = new Map()

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const isoDay = (d) => d.toISOString().slice(0, 10)

// ── Shopify: ordini con line items nel range ──
async function fetchOrders(store, token, sinceISO, untilISO) {
  const byProduct = new Map() // productId -> { units, revenue, cogsUnits:Map(variantId->qty) }
  let url = `https://${store}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${encodeURIComponent(sinceISO)}&created_at_max=${encodeURIComponent(untilISO)}&limit=250&fields=id,created_at,line_items`
  for (let page = 0; page < 120 && url; page++) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': token }, cache: 'no-store' })
    if (!res.ok) break
    const data = await res.json()
    for (const o of (data.orders || [])) {
      for (const li of (o.line_items || [])) {
        const pid = li.product_id != null ? String(li.product_id) : null
        if (!pid) continue
        const qty = num(li.quantity)
        const rev = num(li.price) * qty - num(li.total_discount)
        if (!byProduct.has(pid)) byProduct.set(pid, { productId: pid, title: li.title || '', units: 0, revenue: 0, variantQty: new Map() })
        const p = byProduct.get(pid)
        p.units += qty
        p.revenue += rev
        if (li.variant_id != null) { const vid = String(li.variant_id); p.variantQty.set(vid, (p.variantQty.get(vid) || 0) + qty) }
      }
    }
    const link = res.headers.get('Link') || res.headers.get('link')
    const m = link && link.includes('rel="next"') ? link.match(/<([^>]+)>;\s*rel="next"/) : null
    url = m ? m[1] : null
  }
  return byProduct
}

// ── Shopify: mappa prodotto/variante → costo (COGS), immagine, titolo ──
async function fetchProductMeta(store, token) {
  const costByVariant = new Map()
  const meta = new Map() // productId -> { title, image }
  let cursor = null
  for (let page = 0; page < 30; page++) {
    const after = cursor ? `, after: "${cursor}"` : ''
    const res = await fetch(`https://${store}/admin/api/2024-04/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ query: `{
        products(first: 100${after}, query: "status:active") {
          pageInfo { hasNextPage endCursor }
          edges { node {
            legacyResourceId title isGiftCard featuredImage { url }
            variants(first: 100) { edges { node { legacyResourceId inventoryItem { unitCost { amount } requiresShipping } } } }
          }}
        }
      }` }),
    })
    if (!res.ok) break
    const json = await res.json()
    const conn = json?.data?.products
    for (const { node: p } of (conn?.edges || [])) {
      if (p.isGiftCard) continue
      meta.set(String(p.legacyResourceId), { title: p.title, image: p.featuredImage?.url || null })
      for (const { node: v } of (p.variants?.edges || [])) {
        if (v.inventoryItem?.requiresShipping === false) continue
        const c = v.inventoryItem?.unitCost?.amount
        if (c != null) costByVariant.set(String(v.legacyResourceId), parseFloat(c))
      }
    }
    if (!conn?.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
  }
  return { costByVariant, meta }
}

// ── Meta: spesa totale account nel range ──
async function fetchMetaSpend(since, until) {
  const { accessToken, adAccountId } = getMeta()
  if (!accessToken || !adAccountId) return 0
  const accounts = String(adAccountId).split(',').map(s => s.trim()).filter(Boolean).map(a => a.startsWith('act_') ? a : `act_${a}`)
  let total = 0
  for (const acc of accounts) {
    try {
      const u = new URL(`https://graph.facebook.com/v19.0/${acc}/insights`)
      u.searchParams.set('fields', 'spend')
      u.searchParams.set('level', 'account')
      u.searchParams.set('time_range', JSON.stringify({ since, until }))
      u.searchParams.set('access_token', accessToken)
      const r = await fetch(u, { cache: 'no-store' })
      const j = await r.json()
      total += num(j?.data?.[0]?.spend)
    } catch {}
  }
  return total
}

// ── Google Ads: spesa totale nel range (REST searchStream, no grpc) ──
async function fetchGoogleSpend(since, until) {
  const g = getGoogle()
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const customerId = (g.adsCustomerId || '').replace(/-/g, '')
  const mcc = (g.adsMccId || '').replace(/-/g, '')
  if (!devToken || !customerId || !g.refreshToken || !g.clientId || !g.clientSecret) return 0
  try {
    const tok = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: g.clientId, client_secret: g.clientSecret, refresh_token: g.refreshToken, grant_type: 'refresh_token' }),
    }).then(r => r.json())
    if (!tok.access_token) return 0
    const headers = { Authorization: `Bearer ${tok.access_token}`, 'developer-token': devToken, 'Content-Type': 'application/json' }
    if (mcc) headers['login-customer-id'] = mcc
    const res = await fetch(`https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ query: `SELECT metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${since}' AND '${until}'` }),
    })
    if (!res.ok) return 0
    const arr = await res.json()
    let micros = 0
    for (const chunk of (Array.isArray(arr) ? arr : [])) for (const row of (chunk.results || [])) micros += num(row.metrics?.costMicros ?? row.metrics?.cost_micros)
    return micros / 1e6
  } catch { return 0 }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { storeUrl: store, adminToken: token } = getShopify()
    if (!store || !token) return NextResponse.json({ ok: false, error: 'Shopify non configurato' }, { status: 400 })

    const sp = new URL(req.url).searchParams
    const until = sp.get('until') || isoDay(new Date())
    const since = sp.get('since') || isoDay(new Date(Date.now() - 90 * 86400000))
    const force = sp.get('refresh') === '1'
    const cacheKey = `${store}:${since}:${until}`
    const hit = __cache.get(cacheKey)
    if (!force && hit && hit.exp > Date.now()) return NextResponse.json({ ...hit.data, cached: true })

    // periodo precedente di pari durata
    const days = Math.max(1, Math.round((new Date(until) - new Date(since)) / 86400000) + 1)
    const prevUntil = isoDay(new Date(new Date(since).getTime() - 86400000))
    const prevSince = isoDay(new Date(new Date(since).getTime() - days * 86400000))

    try {
      const [cur, prev, pmeta, metaSpend, googleSpend] = await Promise.all([
        fetchOrders(store, token, since + 'T00:00:00Z', until + 'T23:59:59Z'),
        fetchOrders(store, token, prevSince + 'T00:00:00Z', prevUntil + 'T23:59:59Z'),
        fetchProductMeta(store, token),
        fetchMetaSpend(since, until),
        fetchGoogleSpend(since, until),
      ])

      const adsTotal = metaSpend + googleSpend
      const totalRevenue = [...cur.values()].reduce((s, p) => s + p.revenue, 0)

      let costCovered = 0, costTotal = 0
      const products = [...cur.values()].map(p => {
        const m = pmeta.meta.get(p.productId) || {}
        let cogs = 0, hasCost = false
        for (const [vid, qty] of p.variantQty) {
          const c = pmeta.costByVariant.get(vid)
          if (c != null) { cogs += c * qty; hasCost = true }
        }
        costTotal++; if (hasCost) costCovered++
        const allocAds = totalRevenue > 0 ? adsTotal * (p.revenue / totalRevenue) : 0
        const marginOp = p.revenue - cogs - allocAds
        const prevRev = prev.get(p.productId)?.revenue || 0
        const deltaNet = prevRev > 0 ? ((p.revenue - prevRev) / prevRev) * 100 : null
        return {
          productId: p.productId,
          title: m.title || p.title || '—',
          image: m.image || null,
          units: p.units,
          netRevenue: Math.round(p.revenue * 100) / 100,
          cogs: Math.round(cogs * 100) / 100,
          ads: Math.round(allocAds * 100) / 100,
          marginOp: Math.round(marginOp * 100) / 100,
          marginPct: p.revenue > 0 ? Math.round((marginOp / p.revenue) * 1000) / 10 : 0,
          roas: allocAds > 0 ? Math.round((p.revenue / allocAds) * 100) / 100 : null,
          deltaNet: deltaNet != null ? Math.round(deltaNet * 10) / 10 : null,
          hasCost,
        }
      })

      const data = {
        ok: true,
        range: { since, until }, prevRange: { since: prevSince, until: prevUntil },
        currency: 'EUR',
        updatedAt: new Date().toISOString(),
        totals: {
          netRevenue: Math.round(totalRevenue * 100) / 100,
          ads: Math.round(adsTotal * 100) / 100,
          metaSpend: Math.round(metaSpend * 100) / 100,
          googleSpend: Math.round(googleSpend * 100) / 100,
          marginOp: Math.round(products.reduce((s, p) => s + p.marginOp, 0) * 100) / 100,
          units: products.reduce((s, p) => s + p.units, 0),
          roas: adsTotal > 0 ? Math.round((totalRevenue / adsTotal) * 100) / 100 : null,
          costCoverage: costTotal ? Math.round((costCovered / costTotal) * 100) : 0,
        },
        products,
      }
      __cache.set(cacheKey, { exp: Date.now() + CACHE_TTL, data })
      return NextResponse.json(data)
    } catch (e) {
      return NextResponse.json({ ok: false, error: e.message || 'Errore performance prodotti' }, { status: 500 })
    }
  })
}
