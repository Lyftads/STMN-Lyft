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
//
//  NON OGNI FALLIMENTO E' UNO SCOLLEGAMENTO (Marino, 24 set 2026: «spesso
//  arrivano notifiche del genere ma non sono vere»). Ad Anna Virgili era
//  partita l'email «Klaviyo si e' scollegato» con dentro, nel dettaglio
//  tecnico, «Request was throttled. Expected available in 1 second»: un
//  limite di frequenza, cioe' l'esatto contrario di una chiave morta. Quindi
//  ogni esito porta un `tipo`:
//    · 'credenziali' → la chiave non vale piu' (scaduta, revocata, permesso
//      tolto): il cliente DEVE ricollegare, e si avvisa.
//    · 'passeggero'  → limite di frequenza, provider giu', rete, timeout:
//      si riprova subito e, se resta, si registra senza avvisare nessuno.
//  Nel dubbio si sceglie 'passeggero': una mail sbagliata che dice al cliente
//  che i suoi dati sono fermi costa piu' di un avviso in ritardo di un giorno.
// ============================================================================

const TIMEOUT = 15000
const TENTATIVI = 3                 // un intoppo passeggero non deve diventare un avviso
const ATTESE = [1500, 5000]         // fra un tentativo e l'altro (il throttle dura secondi)

const pausa = (ms) => new Promise(r => setTimeout(r, ms))

function short(msg, n = 300) {
  return String(msg || 'errore sconosciuto').slice(0, n)
}

// Solo 401/403 sono "la chiave non vale piu'". 429 (troppe chiamate), 5xx
// (provider giu'), 408/425 e tutto il resto sono intoppi del momento.
function daHttp(status) {
  return status === 401 || status === 403 ? 'credenziali' : 'passeggero'
}

// Timeout, DNS, connessione rifiutata: non dicono NULLA sulle credenziali.
const daEccezione = () => 'passeggero'

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT), ...opts })
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

// ── Meta: /me con il token. Se scade o perde i permessi, qui si vede subito.
//    I codici: 190 token non valido/scaduto, 102 sessione, 10 e 200 permesso
//    mancante → credenziali. 4/17/32/613/80000+ sono i limiti di frequenza,
//    1 e 2 guasti temporanei di Facebook → passeggeri.
const META_CREDENZIALI = new Set([190, 102, 10, 200, 272, 294])
export async function checkMeta(creds) {
  const token = creds?.meta?.accessToken
  if (!token) return { configured: false }
  const v = creds.meta.graphVersion || 'v20.0'
  try {
    const { res, data } = await jsonFetch(
      `https://graph.facebook.com/${v}/me?fields=id&access_token=${encodeURIComponent(token)}`)
    if (data?.error) {
      const c = Number(data.error.code)
      const tipo = META_CREDENZIALI.has(c) ? 'credenziali' : 'passeggero'
      return { configured: true, ok: false, error: short(data.error.message), tipo }
    }
    if (!res.ok) return { configured: true, ok: false, error: short(`HTTP ${res.status}`), tipo: daHttp(res.status) }
    return { configured: true, ok: true }
  } catch (e) {
    return { configured: true, ok: false, error: short(e?.message), tipo: daEccezione() }
  }
}

// ── Google: si prova a rinnovare l'access token. Se il refresh token e' stato
//    revocato (password cambiata, accesso rimosso) la risposta e' invalid_grant.
//    Un 429 o un 500 di Google non vogliono dire che l'accesso e' finito.
// `invalid_request` resta fuori di proposito: quasi sempre e' una richiesta
// malfatta da parte nostra, non un accesso revocato — non si manda a ricollegare
// il cliente per un nostro errore.
const GOOGLE_CREDENZIALI = new Set(['invalid_grant', 'unauthorized_client', 'invalid_client'])
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
      const codice = String(data?.error || '')
      const tipo = GOOGLE_CREDENZIALI.has(codice) ? 'credenziali' : daHttp(res.status)
      return { configured: true, ok: false, error: short(data?.error_description || data?.error || `HTTP ${res.status}`), tipo }
    }
    return { configured: true, ok: true }
  } catch (e) {
    return { configured: true, ok: false, error: short(e?.message), tipo: daEccezione() }
  }
}

// ── Shopify: shop.json e' l'endpoint piu' leggero che richiede un token valido.
//    402 (negozio sospeso) e 423 (bloccato) non sono un problema di chiave: li
//    lasciamo passeggeri, li risolve il negoziante e non c'e' niente da ricollegare.
export async function checkShopify(creds) {
  const s = creds?.shopify || {}
  const store = String(s.storeUrl || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!store || !s.adminToken) return { configured: false }
  try {
    const { res, data } = await jsonFetch(`https://${store}/admin/api/2026-04/shop.json`, {
      headers: { 'X-Shopify-Access-Token': s.adminToken },
    })
    if (!res.ok) return { configured: true, ok: false, error: short(data?.errors || `HTTP ${res.status}`), tipo: daHttp(res.status) }
    return { configured: true, ok: true }
  } catch (e) {
    return { configured: true, ok: false, error: short(e?.message), tipo: daEccezione() }
  }
}

// ── Klaviyo: /accounts richiede una chiave valida e non consuma quota utile.
//    Klaviyo ha limiti stretti (vedi [limiti_api]): il 429 «Request was
//    throttled» qui arrivava come "scollegato". Ora e' passeggero.
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
      return { configured: true, ok: false, error: short(detail), tipo: daHttp(res.status) }
    }
    return { configured: true, ok: true }
  } catch (e) {
    return { configured: true, ok: false, error: short(e?.message), tipo: daEccezione() }
  }
}

// Esegue un controllo e, se il guasto e' passeggero, riprova: quasi sempre al
// secondo colpo il limite di frequenza e' gia' passato. Una credenziale morta
// invece non guarisce riprovando, quindi si torna subito.
export async function controlla(run, creds) {
  let out
  for (let i = 0; i < TENTATIVI; i++) {
    try { out = await run(creds) }
    catch (e) { out = { configured: true, ok: false, error: short(e?.message), tipo: 'passeggero' } }
    if (!out?.configured || out.ok || out.tipo === 'credenziali') return out
    if (i < TENTATIVI - 1) await pausa(ATTESE[i])
  }
  return { ...out, tentativi: TENTATIVI }
}

export const CHECKS = [
  { provider: 'meta', run: checkMeta },
  { provider: 'google', run: checkGoogle },
  { provider: 'shopify', run: checkShopify },
  { provider: 'klaviyo', run: checkKlaviyo },
]
