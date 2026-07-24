export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getGoogle, getShopify } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'
import { designGeoLift } from '../../../lib/incrementality/geolift'

// ── Google GA4 (fallback + proxy denso: geolocalizzazione via IP) ───────────
async function getAccessToken(g) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: g.clientId || '', client_secret: g.clientSecret || '', refresh_token: g.refreshToken || '', grant_type: 'refresh_token' }),
  })
  const data = await res.json().catch(() => ({}))
  return data.access_token || null
}

async function runReport(token, propertyId, body) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) return null
  return res.json().catch(() => null)
}

const ymd = (s) => String(s || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')

// ── Shopify (sorgente PRIMARIA: vendite reali per provincia di spedizione) ──
// Usa la dimensione ShopifyQL `shipping_region` che per l'Italia = le province
// (Roma, Milano, Torino…, ~107 unità → molto più granulare delle 20 regioni GA4
// e con volume distribuito, quindi meno bisogno di trimming). È aggregata → NON
// richiede l'accesso PCD agli indirizzi ordine. Stessa auth/retry di /api/cro.
const cleanMoney = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0 }

async function shopifyQL(store, token, query) {
  const gql = `query($q: String!) { shopifyqlQuery(query: $q) { tableData { columns { name } rows } parseErrors } }`
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`https://${store}/admin/api/2026-04/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token || '', 'Content-Type': 'application/json' },
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

// Restituisce regions = [{ region, daily:[{date,value}], total }] per le province
// italiane con più fatturato. Due query per tenere sotto controllo il volume di
// righe (provincia×giorno) ed evitare troncamenti silenziosi su store grandi.
async function shopifyProvinces(store, token, since, until) {
  // 1) Top province per fatturato (query leggera, ~una riga per provincia).
  const top = await shopifyQL(store, token,
    `FROM sales SHOW total_sales, orders WHERE shipping_country = 'Italy' GROUP BY shipping_region SINCE ${since} UNTIL ${until} ORDER BY total_sales DESC LIMIT 40`)
  const wanted = top
    .map(r => ({ region: String(r.shipping_region || '').trim(), total: cleanMoney(r.total_sales) }))
    .filter(r => r.region && r.total > 0)
    .slice(0, 30) // margine sopra il topK=16 del designer; contiene il volume di righe
  if (wanted.length < 4) return []

  // 2) Serie giornaliera SOLO per quelle province (cardinalità controllata).
  const inList = wanted.map(w => `'${w.region.replace(/'/g, "''")}'`).join(', ')
  const rows = await shopifyQL(store, token,
    `FROM sales SHOW total_sales WHERE shipping_country = 'Italy' AND shipping_region IN (${inList}) GROUP BY shipping_region, day SINCE ${since} UNTIL ${until} ORDER BY day ASC LIMIT 8000`)
  if (!rows.length || rows.length >= 8000) return [] // vuoto o possibile troncamento → lascia il fallback GA4

  const byRegion = new Map()
  for (const r of rows) {
    const region = String(r.shipping_region || '').trim()
    const date = String(r.day || '').slice(0, 10)
    if (!region || !date) continue
    if (!byRegion.has(region)) byRegion.set(region, { region, daily: [], total: 0 })
    const e = byRegion.get(region)
    const v = cleanMoney(r.total_sales)
    e.daily.push({ date, value: v }); e.total += v
  }
  return [...byRegion.values()]
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const g = getGoogle()
    const { storeUrl, adminToken } = getShopify()
    const hasGa4 = !!(g.ga4PropertyId && g.clientId && g.refreshToken)
    const hasShopify = !!(storeUrl && adminToken)
    if (!hasGa4 && !hasShopify) {
      return NextResponse.json({ ok: false, reason: 'no_source' })
    }

    const { searchParams } = new URL(req.url)
    const days = Math.min(180, Math.max(30, parseInt(searchParams.get('days') || '120', 10)))
    const locale = (searchParams.get('locale') || 'it').slice(0, 2)

    return swrSnapshot(req, { tab: `geolift_${days}_${locale}`, ttlMs: 6 * 3600 * 1000, compute: async () => {
      // 1) SORGENTE PRIMARIA: vendite reali Shopify per provincia (più unità, geo reale).
      if (hasShopify) {
        const until = new Date().toISOString().slice(0, 10)
        const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
        const regions = await shopifyProvinces(storeUrl, adminToken, since, until)
        if (regions.length >= 4) {
          const design = designGeoLift(regions, { metricNote: 'revenue' })
          if (design.ok) {
            return { ...design, metric: 'revenue', source: 'shopify_province', unit: 'province', range: { days }, updatedAt: new Date().toISOString() }
          }
        }
      }

      // 2) FALLBACK / PROXY DENSO: regioni GA4 (geoloc IP; ricavo>conversioni>sessioni).
      if (hasGa4) {
        const token = await getAccessToken(g)
        if (!token) return { __noCache: true, ok: false, reason: 'ga4_auth_failed' }

        const rep = await runReport(token, g.ga4PropertyId, {
          dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
          dimensions: [{ name: 'region' }, { name: 'date' }],
          metrics: [{ name: 'totalRevenue' }, { name: 'conversions' }, { name: 'sessions' }],
          limit: 100000,
        })
        const rows = rep?.rows || []
        if (!rows.length) return { __noCache: true, ok: false, reason: 'no_geo_data' }

        // Scegli la metrica con segnale: ricavo > conversioni > sessioni.
        const tot = { rev: 0, conv: 0, sess: 0 }
        for (const r of rows) { tot.rev += parseFloat(r.metricValues?.[0]?.value || '0'); tot.conv += parseFloat(r.metricValues?.[1]?.value || '0'); tot.sess += parseFloat(r.metricValues?.[2]?.value || '0') }
        const metricIdx = tot.rev > 0 ? 0 : tot.conv > 0 ? 1 : 2
        const metricKey = ['revenue', 'conversions', 'sessions'][metricIdx]

        const byRegion = new Map()
        for (const r of rows) {
          const region = r.dimensionValues?.[0]?.value || ''
          const date = ymd(r.dimensionValues?.[1]?.value)
          const val = parseFloat(r.metricValues?.[metricIdx]?.value || '0')
          if (!region || region === '(not set)' || !date) continue
          if (!byRegion.has(region)) byRegion.set(region, { region, daily: [], total: 0 })
          const e = byRegion.get(region)
          e.daily.push({ date, value: val }); e.total += val
        }
        const regions = [...byRegion.values()]

        const design = designGeoLift(regions, { metricNote: metricKey })
        if (!design.ok) return { __noCache: true, ...design, metric: metricKey, source: 'ga4_region', unit: 'region' }
        return { ...design, metric: metricKey, source: 'ga4_region', unit: 'region', range: { days }, updatedAt: new Date().toISOString() }
      }

      // Shopify c'è ma non ha prodotto abbastanza province, e GA4 non è collegato.
      return { __noCache: true, ok: false, reason: 'not_enough_regions' }
    } })
  })
}
