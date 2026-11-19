import { db } from './db'

// Il refresh token è PER-TENANT (sta su companies): è la chiave che dà accesso
// ai dati GA4 e Google Ads di quel cliente. Client id/secret sono invece
// dell'app OAuth, condivisi.
export async function getGoogleCreds(workspaceId) {
  const { data } = await db().from('companies').select('*').eq('user_id', workspaceId).maybeSingle()
  return {
    clientId: data?.google_client_id || process.env.GOOGLE_CLIENT_ID || null,
    clientSecret: data?.google_client_secret || process.env.GOOGLE_CLIENT_SECRET || null,
    refreshToken: data?.google_refresh_token || null,
    ga4PropertyId: data?.ga4_property_id || null,
    adsCustomerId: (data?.google_ads_customer_id || '').replace(/-/g, '') || null,
    adsMccId: (data?.google_ads_mcc_id || process.env.GOOGLE_ADS_MCC_ID || '').replace(/-/g, '') || null,
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || null,
  }
}

export async function accessToken({ clientId, clientSecret, refreshToken }) {
  if (!clientId || !clientSecret || !refreshToken) return null
  const body = new URLSearchParams({
    client_id: clientId, client_secret: clientSecret,
    refresh_token: refreshToken, grant_type: 'refresh_token',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', body, signal: AbortSignal.timeout(15000),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error_description || j?.error || `OAuth HTTP ${res.status}`)
  return j.access_token || null
}

// ---------------------------------------------------------------- GA4 -----
// Sessioni e acquisti per giorno → tasso di conversione giorno per giorno.
// È il freno: se il CR scende, aumentare il budget porta più traffico che
// converte peggio e amplifica il problema invece di risolverlo.
export async function fetchGa4Daily({ token, propertyId, since, until }) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: since, endDate: until }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'sessions' }, { name: 'ecommercePurchases' }],
      limit: 500,
    }),
    signal: AbortSignal.timeout(30000),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error?.message || `GA4 HTTP ${res.status}`)
  const out = {}
  for (const r of j.rows || []) {
    const d = r.dimensionValues?.[0]?.value           // YYYYMMDD
    if (!d || d.length !== 8) continue
    const day = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`
    const sessions = Number(r.metricValues?.[0]?.value) || 0
    const purchases = Number(r.metricValues?.[1]?.value) || 0
    out[day] = { sessions, purchases, cr: sessions ? (purchases / sessions) * 100 : 0 }
  }
  return out
}

// ---------------------------------------------------- Google Ads (REST) ----
// Via REST invece di google-ads-node: evita gRPC e le sue dipendenze.
// GOTCHA: i campi tornano in snake_case e cost_micros è un int64 che arriva
// come STRINGA — va convertito, non usato com'è.
export async function fetchGoogleAdsSpendDaily({ token, developerToken, customerId, mccId, since, until }) {
  const query = `SELECT segments.date, metrics.cost_micros FROM campaign `
    + `WHERE segments.date BETWEEN '${since}' AND '${until}'`
  const res = await fetch(`https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': developerToken,
      ...(mccId ? { 'login-customer-id': mccId } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(45000),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) {
    const e = j?.[0]?.error || j?.error
    throw new Error(e?.message || `Google Ads HTTP ${res.status}`)
  }
  const out = {}
  for (const chunk of (Array.isArray(j) ? j : [j])) {
    for (const row of chunk?.results || []) {
      const d = row?.segments?.date
      if (!d) continue
      const micros = Number(row?.metrics?.costMicros ?? row?.metrics?.cost_micros ?? 0)
      out[d] = (out[d] || 0) + micros / 1e6
    }
  }
  return out
}

// Sessioni e acquisti per ORA del giorno: da qui esce il tasso di conversione
// orario, che dice in quale fascia il traffico converte davvero — e quindi
// quando ha senso spingere e quando si comprano solo visite.
export async function fetchGa4PerOra({ token, propertyId, since, until }) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: since, endDate: until }],
      dimensions: [{ name: 'hour' }],
      metrics: [{ name: 'sessions' }, { name: 'ecommercePurchases' }],
      limit: 50,
    }),
    signal: AbortSignal.timeout(30000),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error?.message || `GA4 HTTP ${res.status}`)
  const out = {}
  for (const r of j.rows || []) {
    const h = Number(r.dimensionValues?.[0]?.value)
    if (Number.isNaN(h)) continue
    const sessions = Number(r.metricValues?.[0]?.value) || 0
    const purchases = Number(r.metricValues?.[1]?.value) || 0
    out[h] = { sessions, purchases, cr: sessions ? (purchases / sessions) * 100 : 0 }
  }
  return out
}
