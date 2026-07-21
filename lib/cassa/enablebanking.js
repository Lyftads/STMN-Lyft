// ============================================================================
//  Open banking — Enable Banking (api.enablebanking.com).
//
//  Provider self-service post-2025: registrazione autonoma sul loro Control
//  Panel, tier "restricted production" gratuito per collegare i PROPRI conti,
//  contratto per il rollout ai clienti. Auth = JWT RS256 firmato in locale con
//  la chiave privata dell'applicazione (nessuno scambio token remoto).
//
//  Env richieste:
//    ENABLEBANKING_APP_ID              (Application ID dal Control Panel)
//    ENABLEBANKING_PRIVATE_KEY_B64     (chiave privata PEM in base64)
//    — in alternativa ENABLEBANKING_PRIVATE_KEY con i newline \n escapati —
//
//  Flusso: GET /aspsps?country=IT → POST /auth {aspsp, redirect_url, state}
//  → l'utente autorizza in banca → redirect con ?code&state → POST /sessions
//  {code} → account uids → GET balances/transactions per uid (validità 180g).
// ============================================================================

import crypto from 'node:crypto'

const BASE = 'https://api.enablebanking.com'

function privateKey() {
  if (process.env.ENABLEBANKING_PRIVATE_KEY_B64) {
    try { return Buffer.from(process.env.ENABLEBANKING_PRIVATE_KEY_B64, 'base64').toString('utf8') } catch { return null }
  }
  if (process.env.ENABLEBANKING_PRIVATE_KEY) {
    return String(process.env.ENABLEBANKING_PRIVATE_KEY).replace(/\\n/g, '\n')
  }
  return null
}

export function bankingConfigured() {
  return !!(process.env.ENABLEBANKING_APP_ID && privateKey())
}

// JWT RS256 firmato in locale, cache ~50 minuti.
let jwtCache = { token: null, at: 0 }
function appJwt() {
  if (jwtCache.token && Date.now() - jwtCache.at < 50 * 60e3) return jwtCache.token
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64u({ typ: 'JWT', alg: 'RS256', kid: process.env.ENABLEBANKING_APP_ID })}.${b64u({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600 })}`
  const s = crypto.createSign('RSA-SHA256')
  s.update(unsigned)
  const token = `${unsigned}.${s.sign(privateKey()).toString('base64url')}`
  jwtCache = { token, at: Date.now() }
  return token
}

async function api(path, { method = 'GET', body = null } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${appJwt()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) {
    const e = new Error(`open banking ${r.status}: ${String(j.message || j.detail || j.error || '').slice(0, 140)}`)
    e.status = r.status
    throw e
  }
  return j
}

// Lista banche per paese (cache 24h per-istanza). id = nome ASPSP (chiave EB).
const instCache = new Map()
export async function listInstitutions(country = 'IT') {
  const hit = instCache.get(country)
  if (hit && Date.now() - hit.at < 24 * 3600e3) return hit.list
  const j = await api(`/aspsps?country=${encodeURIComponent(country)}`)
  const out = (j.aspsps || []).map(a => ({
    id: a.name,
    name: a.name,
    logo: a.logo || null,
    country: a.country || country,
    psuTypes: Array.isArray(a.psu_types) ? a.psu_types : ['personal'],
  }))
  instCache.set(country, { at: Date.now(), list: out })
  return out
}

// Avvia l'autorizzazione → { link } (redirect dell'utente verso la banca).
export async function startAuth({ aspspName, country = 'IT', psuType = 'business', redirect, state }) {
  const validUntil = new Date(Date.now() + 180 * 86400e3).toISOString()
  const j = await api('/auth', {
    method: 'POST',
    body: {
      aspsp: { name: aspspName, country },
      redirect_url: redirect,
      state,
      access: { valid_until: validUntil },
      psu_type: psuType,
    },
  })
  return { link: j.url, authorizationId: j.authorization_id || null }
}

// Scambia il code del callback → { sessionId, accounts: [{uid, name, iban, currency}] }
export async function exchangeSession(code) {
  const j = await api('/sessions', { method: 'POST', body: { code } })
  const accounts = (j.accounts || []).map(a => ({
    uid: a.uid || a.account_uid || a.id,
    name: a.name || a.product || a.details || null,
    iban: a.account_id?.iban || a.iban || null,
    currency: a.currency || 'EUR',
  })).filter(a => a.uid)
  return { sessionId: j.session_id, accounts }
}

export async function getBalance(accountUid) {
  const j = await api(`/accounts/${encodeURIComponent(accountUid)}/balances`)
  const arr = j.balances || []
  const pick = arr.find(b => ['XPCD', 'ITAV', 'CLAV', 'interimAvailable', 'expected'].includes(b.balance_type)) || arr[0]
  return pick ? { amount: Number(pick.balance_amount?.amount), currency: pick.balance_amount?.currency || 'EUR' } : null
}

// Movimenti dal date_from (pagina con continuation_key, max 6 pagine).
export async function getTransactions(accountUid, dateFrom) {
  const out = []
  let cont = null
  for (let page = 0; page < 6; page++) {
    const q = new URLSearchParams()
    if (dateFrom) q.set('date_from', dateFrom)
    if (cont) q.set('continuation_key', cont)
    const j = await api(`/accounts/${encodeURIComponent(accountUid)}/transactions${q.size ? `?${q}` : ''}`)
    for (const t of (j.transactions || [])) {
      const sign = t.credit_debit_indicator === 'DBIT' ? -1 : 1
      const amt = Number(t.transaction_amount?.amount)
      const remit = Array.isArray(t.remittance_information) ? t.remittance_information.join(' ') : (t.remittance_information || null)
      const counterparty = sign < 0 ? (t.creditor?.name || null) : (t.debtor?.name || null)
      const bookingDate = t.booking_date || t.value_date || t.transaction_date
      if (!bookingDate || !Number.isFinite(amt)) continue
      out.push({
        providerId: t.entry_reference || t.reference_number || `${bookingDate}_${amt}_${String(remit || '').slice(0, 24)}`,
        bookingDate,
        amount: sign * Math.abs(amt),
        currency: t.transaction_amount?.currency || 'EUR',
        counterparty,
        description: remit,
      })
    }
    cont = j.continuation_key || null
    if (!cont) break
  }
  return out
}
