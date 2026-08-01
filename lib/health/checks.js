// ============================================================================
//  Health check delle integrazioni — una chiamata MINIMA per provider, fatta
//  solo per verificare che le credenziali siano ancora valide.
//
//  Regole di progetto:
//   - la chiamata piu' economica possibile (nessuna metrica, nessun range):
//     serve a distinguere "credenziale morta" da "nessun dato", non a leggere.
//   - `configured: false` quando l'integrazione non e' collegata → NON e' un
//     guasto, va ignorata (non si avvisa un cliente per qualcosa che non usa).
//   - il messaggio del provider viene restituito COSI' COM'E' (troncato): e'
//     l'unica cosa che permette di capire se e' scadenza, permesso revocato o
//     throttling. Vedi [meta-kpi] per cosa succede quando lo si ingoia.
// ============================================================================

const TIMEOUT = 15000

function short(msg, n = 300) {
  return String(msg || 'errore sconosciuto').slice(0, n)
}

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT), ...opts })
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

// ── Meta: /me con il token. Se scade o perde i permessi, qui si vede subito.
export async function checkMeta(creds) {
  const token = creds?.meta?.accessToken
  if (!token) return { configured: false }
  const v = creds.meta.graphVersion || 'v20.0'
  try {
    const { res, data } = await jsonFetch(
      `https://graph.facebook.com/${v}/me?fields=id&access_token=${encodeURIComponent(token)}`)
    if (data?.error) return { configured: true, ok: false, error: short(data.error.message) }
    if (!res.ok) return { configured: true, ok: false, error: short(`HTTP ${res.status}`) }
    return { configured: true, ok: true }
  } catch (e) {
    return { configured: true, ok: false, error: short(e?.message) }
  }
}

// ── Google: si prova a rinnovare l'access token. Se il refresh token e' stato
//    revocato (password cambiata, accesso rimosso) la risposta e' invalid_grant.
export async function checkGoogle(creds) {
  const g = creds?.google || {}
  if (!g.refreshToken || !g.clientId || !g.clientSecret) return { configured: false }
  try {
    const { res, data } = await jsonFetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: g.clientId, client_secret: g.clientSecret,
        refresh_token: g.refreshToken, grant_type: 'refresh_token',
      }),
    })
    if (!res.ok || !data?.access_token) {
      return { configured: true, ok: false, error: short(data?.error_description || data?.error || `HTTP ${res.status}`) }
    }
    return { configured: true, ok: true }
  } catch (e) {
    return { configured: true, ok: false, error: short(e?.message) }
  }
}

// ── Shopify: shop.json e' l'endpoint piu' leggero che richiede un token valido.
export async function checkShopify(creds) {
  const s = creds?.shopify || {}
  const store = String(s.storeUrl || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!store || !s.adminToken) return { configured: false }
  try {
    const { res, data } = await jsonFetch(`https://${store}/admin/api/2026-04/shop.json`, {
      headers: { 'X-Shopify-Access-Token': s.adminToken },
    })
    if (!res.ok) return { configured: true, ok: false, error: short(data?.errors || `HTTP ${res.status}`) }
    return { configured: true, ok: true }
  } catch (e) {
    return { configured: true, ok: false, error: short(e?.message) }
  }
}

// ── Klaviyo: /accounts richiede una chiave valida e non consuma quota utile.
export async function checkKlaviyo(creds) {
  const k = creds?.klaviyo || {}
  if (!k.apiKey) return { configured: false }
  const auth = k.isOAuth ? `Bearer ${k.apiKey}` : `Klaviyo-API-Key ${k.apiKey}`
  try {
    const { res, data } = await jsonFetch('https://a.klaviyo.com/api/accounts/', {
      headers: { Authorization: auth, revision: '2024-10-15', accept: 'application/json' },
    })
    if (!res.ok) {
      const detail = data?.errors?.[0]?.detail || `HTTP ${res.status}`
      return { configured: true, ok: false, error: short(detail) }
    }
    return { configured: true, ok: true }
  } catch (e) {
    return { configured: true, ok: false, error: short(e?.message) }
  }
}

export const CHECKS = [
  { provider: 'meta', run: checkMeta },
  { provider: 'google', run: checkGoogle },
  { provider: 'shopify', run: checkShopify },
  { provider: 'klaviyo', run: checkKlaviyo },
]
