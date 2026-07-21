// ============================================================================
//  Open banking — GoCardless Bank Account Data (ex Nordigen).
//
//  Copre le banche EU/IT via PSD2 con licenza AISP del provider: il cliente
//  autorizza la sua banca su un link hosted (stesso pattern OAuth di Nango) e
//  noi leggiamo SOLO in lettura saldi e movimenti. Env richieste:
//    GOCARDLESS_SECRET_ID / GOCARDLESS_SECRET_KEY
//  (account gratuito su bankaccountdata.gocardless.com → User secrets)
//
//  Rate limit del provider: pochi call/giorno per conto sugli endpoint dati →
//  MAI chiamare a ogni pageview: la route sincronizza al massimo ogni 6h e
//  serve sempre dal DB (bank_balances / bank_transactions).
// ============================================================================

const BASE = 'https://bankaccountdata.gocardless.com/api/v2'

export function gocardlessConfigured() {
  return !!(process.env.GOCARDLESS_SECRET_ID && process.env.GOCARDLESS_SECRET_KEY)
}

// Access token (24h) con cache per-istanza; rigenerato a ~23h.
let tokenCache = { token: null, at: 0 }
async function accessToken() {
  if (tokenCache.token && Date.now() - tokenCache.at < 23 * 3600e3) return tokenCache.token
  const r = await fetch(`${BASE}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret_id: process.env.GOCARDLESS_SECRET_ID, secret_key: process.env.GOCARDLESS_SECRET_KEY }),
    signal: AbortSignal.timeout(15000),
  })
  const j = await r.json()
  if (!r.ok || !j.access) throw new Error(`open banking auth: ${j.summary || j.detail || r.status}`)
  tokenCache = { token: j.access, at: Date.now() }
  return j.access
}

async function api(path, { method = 'GET', body = null } = {}) {
  const t = await accessToken()
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) {
    const e = new Error(`open banking ${r.status}: ${(j.summary || j.detail || '').slice(0, 140)}`)
    e.status = r.status
    throw e
  }
  return j
}

// Lista banche per paese (cache 24h per-istanza: cambia di rado).
const instCache = new Map() // country → { at, list }
export async function listInstitutions(country = 'IT') {
  const hit = instCache.get(country)
  if (hit && Date.now() - hit.at < 24 * 3600e3) return hit.list
  const list = await api(`/institutions/?country=${encodeURIComponent(country)}`)
  const out = (Array.isArray(list) ? list : []).map(i => ({ id: i.id, name: i.name, logo: i.logo }))
  instCache.set(country, { at: Date.now(), list: out })
  return out
}

// Crea la richiesta di collegamento → { requisitionId, link } (redirect utente).
export async function createRequisition({ institutionId, redirect, reference, language = 'IT' }) {
  // Agreement: 90 giorni di storico, accesso valido 180 giorni (max PSD2).
  const agreement = await api('/agreements/enduser/', {
    method: 'POST',
    body: { institution_id: institutionId, max_historical_days: 90, access_valid_for_days: 180, access_scope: ['balances', 'details', 'transactions'] },
  })
  const req = await api('/requisitions/', {
    method: 'POST',
    body: { redirect, institution_id: institutionId, reference, agreement: agreement.id, user_language: language },
  })
  return { requisitionId: req.id, link: req.link }
}

// Stato requisition → { status, accounts: [id] } (status 'LN' = linked).
export async function getRequisition(requisitionId) {
  const r = await api(`/requisitions/${requisitionId}/`)
  return { status: r.status, accounts: r.accounts || [] }
}

export async function getAccountDetails(accountId) {
  const r = await api(`/accounts/${accountId}/details/`)
  const a = r.account || {}
  return { name: a.name || a.product || null, iban: a.iban || null, currency: a.currency || 'EUR' }
}

export async function getBalance(accountId) {
  const r = await api(`/accounts/${accountId}/balances/`)
  const arr = r.balances || []
  // Preferisci il saldo "disponibile", fallback al primo.
  const pick = arr.find(b => ['interimAvailable', 'expected', 'closingBooked'].includes(b.balanceType)) || arr[0]
  return pick ? { amount: Number(pick.balanceAmount?.amount), currency: pick.balanceAmount?.currency || 'EUR' } : null
}

export async function getTransactions(accountId, dateFrom) {
  const q = dateFrom ? `?date_from=${dateFrom}` : ''
  const r = await api(`/accounts/${accountId}/transactions/${q}`)
  const booked = r.transactions?.booked || []
  return booked.map(t => ({
    providerId: t.transactionId || t.internalTransactionId || `${t.bookingDate}_${t.transactionAmount?.amount}_${(t.remittanceInformationUnstructured || '').slice(0, 24)}`,
    bookingDate: t.bookingDate || t.valueDate,
    amount: Number(t.transactionAmount?.amount),
    currency: t.transactionAmount?.currency || 'EUR',
    counterparty: t.creditorName || t.debtorName || null,
    description: t.remittanceInformationUnstructured || (Array.isArray(t.remittanceInformationUnstructuredArray) ? t.remittanceInformationUnstructuredArray.join(' ') : null) || t.additionalInformation || null,
    raw: t,
  })).filter(t => t.bookingDate && Number.isFinite(t.amount))
}
