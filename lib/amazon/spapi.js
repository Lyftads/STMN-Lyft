// ============================================================================
//  Amazon SP-API — adapter minimale (Fase 1).
//
//  Oggi: credenziali sandbox da env (app "Lyft AI", Solution Provider Portal),
//  endpoint statico sandbox EU. In produzione le credenziali per-tenant
//  arriveranno da Nango (provider `amazon-selling-partner`) e basterà passare
//  `creds` a spapiFetch senza toccare i chiamanti.
//
//  Env: AMZ_SPAPI_SANDBOX_CLIENT_ID / AMZ_SPAPI_SANDBOX_CLIENT_SECRET /
//       AMZ_SPAPI_SANDBOX_REFRESH_TOKEN · AMZ_SPAPI_ENV=sandbox|production
//
//  Gotcha sandbox statico: risponde solo a parametri "magici" (es. Orders con
//  CreatedAfter=TEST_CASE_200) e restituisce payload fissi.
// ============================================================================

const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token'

const BASE = {
  sandbox: 'https://sandbox.sellingpartnerapi-eu.amazon.com',
  production: 'https://sellingpartnerapi-eu.amazon.com',
}

export function amazonEnv() {
  return process.env.AMZ_SPAPI_ENV === 'production' ? 'production' : 'sandbox'
}

function envCreds() {
  return {
    clientId: process.env.AMZ_SPAPI_SANDBOX_CLIENT_ID,
    clientSecret: process.env.AMZ_SPAPI_SANDBOX_CLIENT_SECRET,
    refreshToken: process.env.AMZ_SPAPI_SANDBOX_REFRESH_TOKEN,
  }
}

export function amazonConfigured() {
  const c = envCreds()
  return Boolean(c.clientId && c.clientSecret && c.refreshToken)
}

// Cache access token in-memory (scade a 60min, rinnovo a 55).
let tokenCache = { token: null, exp: 0, key: '' }

async function getAccessToken(creds) {
  const c = creds || envCreds()
  const key = c.clientId
  if (tokenCache.token && tokenCache.key === key && Date.now() < tokenCache.exp) return tokenCache.token
  const res = await fetch(LWA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: c.refreshToken,
      client_id: c.clientId,
      client_secret: c.clientSecret,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw new Error(`LWA ${res.status}: ${data.error || ''} ${data.error_description || ''}`.trim())
  }
  tokenCache = { token: data.access_token, exp: Date.now() + 55 * 60e3, key }
  return data.access_token
}

export async function spapiFetch(path, { query, creds } = {}) {
  const token = await getAccessToken(creds)
  const url = new URL(BASE[amazonEnv()] + path)
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }
  const res = await fetch(url, {
    headers: { 'x-amz-access-token': token, 'Content-Type': 'application/json' },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.errors?.[0]?.message || JSON.stringify(body).slice(0, 200)
    throw new Error(`SP-API ${res.status} ${path}: ${msg}`)
  }
  return body
}

// ── Operazioni ──────────────────────────────────────────────────────────────

export async function getMarketplaceParticipations(creds) {
  const data = await spapiFetch('/sellers/v1/marketplaceParticipations', { creds })
  return (data.payload || []).map(p => ({
    id: p.marketplace?.id,
    country: p.marketplace?.countryCode,
    name: p.marketplace?.name,
    currency: p.marketplace?.defaultCurrencyCode,
    store: p.storeName,
  }))
}

export async function getOrders({ createdAfter, marketplaceIds, creds } = {}) {
  // Sandbox statico: CreatedAfter=TEST_CASE_200 + MarketplaceIds=ATVPDKIKX0DER
  const sandbox = amazonEnv() === 'sandbox'
  const data = await spapiFetch('/orders/v0/orders', {
    creds,
    query: {
      CreatedAfter: sandbox ? 'TEST_CASE_200' : createdAfter,
      MarketplaceIds: sandbox ? 'ATVPDKIKX0DER' : (marketplaceIds || []).join(','),
    },
  })
  return data.payload?.Orders || []
}
