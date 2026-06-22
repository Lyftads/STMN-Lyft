// ============================================================================
//  Nango helper — risolve i token OAuth per-tenant tramite Nango Cloud.
//
//  Modello: una "connection" Nango = (integrationId, connectionId).
//  - integrationId = il provider config key su Nango (es. 'facebook',
//    'klaviyo', 'google-ads'…). Override via env NANGO_INTEGRATION_*.
//  - connectionId  = identificativo del tenant (lo salviamo su
//    companies.nango_connection_id; tipicamente l'id azienda/utente).
//
//  Nango gestisce il refresh: chiediamo sempre il token fresco.
//  Tutto best-effort: in caso di errore/timeout torniamo null → il chiamante
//  fa fallback (token salvato su companies, poi env). Zero impatto su STMN
//  (env-only) perché viene invocato solo quando esiste un connectionId.
// ============================================================================

const NANGO_HOST = process.env.NANGO_HOST || 'https://api.nango.dev'
const secret = () => process.env.NANGO_SECRET_KEY || ''

// Provider config key su Nango per ciascun servizio (override via env).
export const NANGO_INTEGRATIONS = {
  meta:      process.env.NANGO_INTEGRATION_META      || 'facebook',
  googleAds: process.env.NANGO_INTEGRATION_GOOGLE_ADS || 'google-ads',
  ga4:       process.env.NANGO_INTEGRATION_GA4       || 'google-analytics',
  klaviyo:   process.env.NANGO_INTEGRATION_KLAVIYO   || 'klaviyo-oauth',
  omnisend:  process.env.NANGO_INTEGRATION_OMNISEND  || 'omnisend',
  mailchimp: process.env.NANGO_INTEGRATION_MAILCHIMP || 'mailchimp',
  tiktok:    process.env.NANGO_INTEGRATION_TIKTOK    || 'tiktok-ads',
  gmail:     process.env.NANGO_INTEGRATION_GMAIL     || 'google-mail',
  slack:     process.env.NANGO_INTEGRATION_SLACK     || 'slack',
  shopify:   process.env.NANGO_INTEGRATION_SHOPIFY   || 'shopify',
}

// Recupera l'intera connection da Nango (credentials + metadata + config).
export async function getNangoConnection({ integrationId, connectionId, timeoutMs = 4000 }) {
  if (!secret() || !integrationId || !connectionId) return null
  try {
    const url = `${NANGO_HOST}/connection/${encodeURIComponent(connectionId)}`
      + `?provider_config_key=${encodeURIComponent(integrationId)}&refresh_token=true`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret()}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Solo l'access token (Bearer) della connection, o null.
export async function getNangoToken(args) {
  const conn = await getNangoConnection(args)
  return conn?.credentials?.access_token
    || conn?.credentials?.apiKey
    || conn?.credentials?.api_key
    || null
}

export function nangoConfigured() {
  return !!secret()
}
