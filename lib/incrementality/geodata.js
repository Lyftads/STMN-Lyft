// ============================================================================
//  Geo data layer — LyftAI. Sorgenti geografiche condivise dal designer geo-lift
//  (/api/geolift) e dal readout post-test (/api/geolift/tests/[id]).
//
//  Due sorgenti, stessa forma di output — regions = [{ region, daily:[{date,value}], total }]:
//   · Shopify: vendite reali per PROVINCIA di spedizione (ShopifyQL shipping_region,
//     per l'IT = ~107 province). Aggregato → niente accesso PCD agli indirizzi.
//   · GA4: ricavo/conversioni/sessioni per REGIONE (geoloc IP) — fallback/proxy denso.
// ============================================================================

import { REGIONI_ITALIANE, provinceDiRegione, regioneDiProvincia, regioneCanonica } from '../geo/regioniItalia'
import { KOONGO_EXCLUDE } from '../shopify/koongo'

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

// ── Shopify, per REGIONE ────────────────────────────────────────────────────
//  Perche' esistono anche le regioni, e non solo le province.
//
//  Il disegno del test si fa sull'unita' che la PUBBLICITA' sa colpire e, soprattutto, sa RILEGGERE.
//  Verificato sull'account Meta (vedi lib/geo/regioniItalia.js e il modulo province del fork
//  Anna Virgili): **Meta non scende sotto la regione** — l'unico spaccato disponibile e'
//  `breakdowns=region`. Un test disegnato sulle province resta quindi illeggibile su Meta: si puo'
//  spendere, ma non si puo' misurare. Google invece arriva alla provincia.
//  Le venti regioni italiane sono anche un pannello piu' fitto per unita': meno rumore per area,
//  quindi una differenza piu' piccola diventa misurabile.
//
//  I MARKETPLACE restano fuori: un ordine Amazon ha un indirizzo di spedizione ma nessuna domanda
//  generata dalla pubblicita'. Dentro il pannello e' rumore puro, e peggiora la sensibilita' del test.
//
//  Le province che non si riconoscono NON si buttano in una regione a caso e non spariscono: si
//  contano a parte e si restituiscono, cosi' chi guarda sa quanto fatturato e' rimasto fuori.
export async function discoverRegions(store, token, since, until) {
  const top = await shopifyQL(store, token,
    `FROM sales SHOW total_sales, orders WHERE shipping_country = 'Italy' AND ${KOONGO_EXCLUDE} GROUP BY shipping_region SINCE ${since} UNTIL ${until} ORDER BY total_sales DESC LIMIT 120`)
  const province = top
    .map(r => ({ provincia: String(r.shipping_region || '').trim(), total: cleanMoney(r.total_sales) }))
    .filter(r => r.provincia && r.total > 0)
  if (!province.length) return { regions: [], fuori: null }
  const regioni = new Set(), senzaRegione = []
  for (const p of province) {
    const reg = regioneDiProvincia(p.provincia)
    if (reg) regioni.add(reg); else senzaRegione.push(p)
  }
  if (regioni.size < 4) return { regions: [], fuori: null }
  const regions = await regionSeries(store, token, [...regioni], since, until)
  return {
    regions,
    fuori: senzaRegione.length
      ? { province: senzaRegione.map(p => p.provincia), fatturato: Math.round(senzaRegione.reduce((t, p) => t + p.total, 0) * 100) / 100 }
      : null,
  }
}

// Serie giornaliera per un insieme di REGIONI note (serve anche al readout dopo il test).
// Si interrogano le province e si sommano qui: ShopifyQL non conosce le regioni italiane.
export async function regionSeries(store, token, regioni, since, until) {
  if (!regioni?.length) return []
  const volute = new Set(regioni.map(r => regioneCanonica(r) || r))
  const province = []
  for (const r of volute) province.push(...provinceDiRegione(r))
  if (!province.length) return []
  const rows = await shopifyQL(store, token,
    `FROM sales SHOW total_sales WHERE shipping_country = 'Italy' AND ${KOONGO_EXCLUDE} AND shipping_region IN (${inList(province)}) GROUP BY shipping_region, day SINCE ${since} UNTIL ${until} ORDER BY day ASC LIMIT 8000`)
  // 8000 righe tonde vuol dire che la risposta e' stata tagliata: meglio niente pannello che uno
  // a cui mancano giorni senza dirlo (stessa regola di provinceSeries).
  if (!rows.length || rows.length >= 8000) return []
  const perRegione = new Map()
  for (const r of rows) {
    const reg = regioneDiProvincia(String(r.shipping_region || '').trim())
    const date = String(r.day || '').slice(0, 10)
    if (!reg || !date || !volute.has(reg)) continue
    if (!perRegione.has(reg)) perRegione.set(reg, { region: reg, giorni: new Map(), total: 0 })
    const e = perRegione.get(reg)
    const v = cleanMoney(r.total_sales)
    e.giorni.set(date, (e.giorni.get(date) || 0) + v)   // piu' province nello stesso giorno: si sommano
    e.total += v
  }
  return [...perRegione.values()].map(e => ({
    region: e.region,
    daily: [...e.giorni.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([date, value]) => ({ date, value })),
    total: Math.round(e.total * 100) / 100,
  }))
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
