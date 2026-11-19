// Porting minimale di lib/tenant/nango.js di LyftAI: qui serve solo Meta.
// Nango gestisce il refresh → si chiede sempre il token fresco.
const HOST = process.env.NANGO_HOST || 'https://api.nango.dev'
const secret = () => process.env.NANGO_SECRET_KEY || ''
export const META_INTEGRATION = process.env.NANGO_INTEGRATION_META || 'facebook'

export async function getNangoToken({ integrationId, connectionId, timeoutMs = 9000 }) {
  if (!secret() || !integrationId || !connectionId) return null
  try {
    const url = `${HOST}/connection/${encodeURIComponent(connectionId)}`
      + `?provider_config_key=${encodeURIComponent(integrationId)}&refresh_token=true`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret()}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const conn = await res.json()
    return conn?.credentials?.access_token || null
  } catch { return null }
}
