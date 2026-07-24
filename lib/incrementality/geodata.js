// ============================================================================
//  Geo data layer — LyftAI. Sorgenti geografiche condivise dal designer geo-lift
//  (/api/geolift) e dal readout post-test (/api/geolift/tests/[id]).
//
//  Due sorgenti, stessa forma di output — regions = [{ region, daily:[{date,value}], total }]:
//   · Shopify: vendite reali per PROVINCIA di spedizione (ShopifyQL shipping_region,
//     per l'IT = ~107 province). Aggregato → niente accesso PCD agli indirizzi.
//   · GA4: ricavo/conversioni/sessioni per REGIONE (geoloc IP) — fallback/proxy denso.
// ============================================================================

export const cleanMoney = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0 }
export const ymd = (s) => String(s || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')

// ── Shopify ────────────────────────────────────────────────────────────────
export async function shopifyQL(store, token, query) {
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

const inList = (regions) => regions.map(r => `'${String(r).replace(/'/g, "''")}'`).join(', ')

// Scopre le top province italiane per fatturato e ne restituisce la serie giornaliera.
// Due query per contenere il volume di righe provincia×giorno (anti-troncamento).
export async function discoverProvinces(store, token, since, until) {
  const top = await shopifyQL(store, token,
    `FROM sales SHOW total_sales, orders WHERE shipping_country = 'Italy' GROUP BY shipping_region SINCE ${since} UNTIL ${until} ORDER BY total_sales DESC LIMIT 40`)
  const wanted = top
    .map(r => ({ region: String(r.shipping_region || '').trim(), total: cleanMoney(r.total_sales) }))
    .filter(r => r.region && r.total > 0)
    .slice(0, 30)
  if (wanted.length < 4) return []
  return provinceSeries(store, token, wanted.map(w => w.region), since, until)
}

// Serie giornaliera per un insieme di province NOTE (usata dal readout post-test).
export async function provinceSeries(store, token, regions, since, until) {
  if (!regions?.length) return []
  const rows = await shopifyQL(store, token,
    `FROM sales SHOW total_sales WHERE shipping_country = 'Italy' AND shipping_region IN (${inList(regions)}) GROUP BY shipping_region, day SINCE ${since} UNTIL ${until} ORDER BY day ASC LIMIT 8000`)
  if (!rows.length || rows.length >= 8000) return []
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

// ── GA4 ──────────────────────────────────────────────────────────────────────
export async function getAccessToken(g) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: g.clientId || '', client_secret: g.clientSecret || '', refresh_token: g.refreshToken || '', grant_type: 'refresh_token' }),
  })
  const data = await res.json().catch(() => ({}))
  return data.access_token || null
}

export async function runReport(token, propertyId, body) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) return null
  return res.json().catch(() => null)
}

// Serie GA4 per regione. Sceglie la metrica con segnale (ricavo>conversioni>sessioni)
// se metricKey non è forzata. Restituisce { regions, metricKey }.
export async function ga4Regions(g, days, metricKey = null) {
  const token = await getAccessToken(g)
  if (!token) return { regions: [], metricKey: null, error: 'ga4_auth_failed' }
  const rep = await runReport(token, g.ga4PropertyId, {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'region' }, { name: 'date' }],
    metrics: [{ name: 'totalRevenue' }, { name: 'conversions' }, { name: 'sessions' }],
    limit: 100000,
  })
  const rows = rep?.rows || []
  if (!rows.length) return { regions: [], metricKey: null, error: 'no_geo_data' }
  let idx
  if (metricKey) idx = ['revenue', 'conversions', 'sessions'].indexOf(metricKey)
  if (idx == null || idx < 0) {
    const tot = { rev: 0, conv: 0, sess: 0 }
    for (const r of rows) { tot.rev += parseFloat(r.metricValues?.[0]?.value || '0'); tot.conv += parseFloat(r.metricValues?.[1]?.value || '0'); tot.sess += parseFloat(r.metricValues?.[2]?.value || '0') }
    idx = tot.rev > 0 ? 0 : tot.conv > 0 ? 1 : 2
  }
  const key = ['revenue', 'conversions', 'sessions'][idx]
  const byRegion = new Map()
  for (const r of rows) {
    const region = r.dimensionValues?.[0]?.value || ''
    const date = ymd(r.dimensionValues?.[1]?.value)
    const val = parseFloat(r.metricValues?.[idx]?.value || '0')
    if (!region || region === '(not set)' || !date) continue
    if (!byRegion.has(region)) byRegion.set(region, { region, daily: [], total: 0 })
    const e = byRegion.get(region)
    e.daily.push({ date, value: val }); e.total += val
  }
  return { regions: [...byRegion.values()], metricKey: key }
}

// ── Utility per il readout: somma le serie di due gruppi di regioni, allineate per data.
// Restituisce { dates, dailyTest, dailyControl, testStartIdx } dato lo start del test.
export function alignGroups(regions, testRegions, controlRegions, testStartDate) {
  const tSet = new Set(testRegions), cSet = new Set(controlRegions)
  const dates = [...new Set(regions.flatMap(r => r.daily.map(d => d.date)))].sort()
  const idxOf = new Map(dates.map((d, i) => [d, i]))
  const dailyTest = new Array(dates.length).fill(0)
  const dailyControl = new Array(dates.length).fill(0)
  for (const r of regions) {
    const bucket = tSet.has(r.region) ? dailyTest : cSet.has(r.region) ? dailyControl : null
    if (!bucket) continue
    for (const d of r.daily) { const i = idxOf.get(d.date); if (i != null) bucket[i] += Number(d.value) || 0 }
  }
  let testStartIdx = dates.findIndex(d => d >= testStartDate)
  if (testStartIdx < 0) testStartIdx = dates.length
  return { dates, dailyTest, dailyControl, testStartIdx }
}
