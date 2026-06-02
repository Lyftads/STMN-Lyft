import { AsyncLocalStorage } from 'node:async_hooks'
import { getServerSupabase, getAdminSupabase } from '../supabase/server'

// ============================================================================
//  Tenant Credentials Helper — multi-tenant SaaS resolver.
//
//  Strategia: ogni route API che ha bisogno di credenziali integrazioni
//  (Shopify, Meta, GA4, Klaviyo) chiama getTenantCreds() per ottenere
//  prima quelle salvate sulla riga `companies` dell'utente loggato, e
//  fallback su env var solo se la company non ha valori popolati.
//
//  Questo permette:
//  - STMN (tenant beta, env var popolate) continua a funzionare senza
//    modifiche fino a quando popoliamo manualmente la sua riga companies.
//  - Nuovi tenant: appena il wizard di onboarding (Fase 3) salva le creds
//    nella riga companies, le route iniziano a leggerle da li' senza
//    altri cambi di codice.
//
//  IMPORTANTE: l'helper NON fa enforcement che le creds esistano —
//  ritorna null/undefined se nulla e' configurato, e la route decide
//  come gestire (errore 400, dato fittizio, etc).
// ============================================================================

// Cache in-memory per request: evita di rileggere la company piu' volte
// nella stessa request se la chiami da piu' helper.
// Chiave: userId. Valore: { creds, expiresAt }.
// TTL breve (5s) — la cache vive sul process Vercel, non e' problema
// di staleness perche' le creds cambiano raramente.
const cache = new Map()
const TTL_MS = 5_000

function readCachedCompany(userId) {
  const hit = cache.get(userId)
  if (hit && hit.expiresAt > Date.now()) return hit.company
  return null
}

function setCachedCompany(userId, company) {
  cache.set(userId, { company, expiresAt: Date.now() + TTL_MS })
}

// Risolve user_id corrente dalla sessione Supabase nei cookie.
// Ritorna null se non autenticato (route puo' decidere se fallback a env
// o restituire 401).
export async function getCurrentUserId() {
  try {
    const sb = getServerSupabase()
    const { data: { user } } = await sb.auth.getUser()
    return user?.id || null
  } catch {
    return null
  }
}

// Legge l'intera riga companies dell'utente loggato.
// Usa admin client per bypassare RLS (lecito: stiamo gia' filtrando per
// user_id risolto dalla sessione autenticata, quindi non c'e' rischio di
// cross-tenant leak).
async function getCompanyRow(userId) {
  if (!userId) return null
  const cached = readCachedCompany(userId)
  if (cached !== null) return cached
  const admin = getAdminSupabase()
  if (!admin) return null
  const { data } = await admin
    .from('companies')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  setCachedCompany(userId, data || null)
  return data || null
}

// Helper di lettura: ritorna il primo valore non-vuoto.
// Usata per "DB-first, env-fallback" in una riga sola.
const pick = (...vals) => vals.find(v => v != null && v !== '') || null

// ============================================================================
//  API pubblica — chiamala dalle route con: await getTenantCreds()
//
//  Ritorna un oggetto con tutte le credenziali risolte (DB-first, env-fallback)
//  + companyName + isBeta + userId per logging/multi-tenant context.
//
//  Esempio uso in una route:
//    const creds = await getTenantCreds()
//    if (!creds.shopify.storeUrl || !creds.shopify.adminToken) {
//      return NextResponse.json({ error: 'Shopify non configurato' }, { status: 400 })
//    }
//    const r = await fetch(`https://${creds.shopify.storeUrl}/admin/api/...`, {
//      headers: { 'X-Shopify-Access-Token': creds.shopify.adminToken }
//    })
// ============================================================================

export async function getTenantCreds() {
  const userId = await getCurrentUserId()
  const company = userId ? await getCompanyRow(userId) : null

  return {
    userId,
    companyName: company?.company_name || null,
    isBeta: company?.is_beta === true,

    shopify: {
      storeUrl:   pick(company?.shopify_store_url,   process.env.SHOPIFY_STORE_URL),
      adminToken: pick(company?.shopify_admin_token, process.env.SHOPIFY_ADMIN_TOKEN),
    },

    meta: {
      // META_ACCESS_TOKEN ha alias storici nel codebase (FACEBOOK_*, FB_*)
      accessToken: pick(
        company?.meta_access_token,
        process.env.META_ACCESS_TOKEN,
        process.env.FACEBOOK_ACCESS_TOKEN,
        process.env.FB_ACCESS_TOKEN,
      ),
      adAccountId: pick(company?.meta_account_id, process.env.META_AD_ACCOUNT_ID),
      // Graph version e' globale (versione API Meta), non per-tenant
      graphVersion: process.env.META_GRAPH_VERSION || 'v20.0',
    },

    google: {
      // Client ID/Secret possono essere shared (app OAuth Lyft) o per-tenant
      // se l'azienda preferisce usare la propria app Google. DB-first per
      // entrambi.
      clientId:     pick(company?.google_client_id,     process.env.GOOGLE_CLIENT_ID),
      clientSecret: pick(company?.google_client_secret, process.env.GOOGLE_CLIENT_SECRET),
      // Refresh token e' SEMPRE per-tenant (e' la chiave che permette accesso
      // ai dati GA4 dell'azienda specifica)
      refreshToken: pick(company?.google_refresh_token, process.env.GOOGLE_REFRESH_TOKEN),
      ga4PropertyId: pick(company?.ga4_property_id, process.env.GA4_PROPERTY_ID),
    },

    klaviyo: {
      apiKey: pick(company?.klaviyo_api_key, process.env.KLAVIYO_API_KEY),
    },
  }
}

// ============================================================================
//  AsyncLocalStorage — contesto richiesta per le route con tanti helper
//
//  Pattern: la route fa await withTenantContext(req, async () => { ...lavoro... })
//  e poi qualsiasi helper chiamato dentro puo' leggere le creds del tenant
//  corrente tramite getShopify() / getMeta() / getGoogle() / getKlaviyo()
//  senza dover ricevere creds come parametro (utile per file con 30+ call
//  site come /api/metrics).
//
//  Fuori dal contesto (es. test, helper isolato), i getter fallback su env.
//  Safe per concorrenza: ALS isola lo store per ogni catena async.
// ============================================================================

const tenantStore = new AsyncLocalStorage()

// Wrappa il body di una route in un contesto tenant. Risolve le creds
// (DB + env fallback) e le mette nello store, poi esegue fn().
export async function withTenantContext(_reqOrIgnored, fn) {
  const creds = await getTenantCreds()
  return tenantStore.run(creds, fn)
}

// Getter per le route che usano AsyncLocalStorage.
// Se chiamato fuori da withTenantContext, fa fallback su env (preserva il
// comportamento pre-refactor per script/cron/test).
function getStore() {
  return tenantStore.getStore() || null
}

export function getShopify() {
  const ctx = getStore()
  if (ctx) return ctx.shopify
  return {
    storeUrl:   process.env.SHOPIFY_STORE_URL   || null,
    adminToken: process.env.SHOPIFY_ADMIN_TOKEN || null,
  }
}

export function getMeta() {
  const ctx = getStore()
  if (ctx) return ctx.meta
  return {
    accessToken:  process.env.META_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN || process.env.FB_ACCESS_TOKEN || null,
    adAccountId:  process.env.META_AD_ACCOUNT_ID || null,
    graphVersion: process.env.META_GRAPH_VERSION || 'v20.0',
  }
}

export function getGoogle() {
  const ctx = getStore()
  if (ctx) return ctx.google
  return {
    clientId:      process.env.GOOGLE_CLIENT_ID     || null,
    clientSecret:  process.env.GOOGLE_CLIENT_SECRET || null,
    refreshToken:  process.env.GOOGLE_REFRESH_TOKEN || null,
    ga4PropertyId: process.env.GA4_PROPERTY_ID      || null,
  }
}

export function getKlaviyo() {
  const ctx = getStore()
  if (ctx) return ctx.klaviyo
  return { apiKey: process.env.KLAVIYO_API_KEY || null }
}

export function getTenantInfo() {
  const ctx = getStore()
  return {
    userId:      ctx?.userId      ?? null,
    companyName: ctx?.companyName ?? null,
    isBeta:      ctx?.isBeta      ?? false,
  }
}

// Variante "fail-fast": se manca una credenziale richiesta, ritorna null
// invece di un oggetto parzialmente popolato. Comodo per route che DEVONO
// avere certe creds per funzionare.
//
// Esempio:
//   const shopify = await requireTenantCreds('shopify')
//   if (!shopify) return NextResponse.json({ error: 'Shopify non configurato' }, { status: 400 })
export async function requireTenantCreds(integration) {
  const creds = await getTenantCreds()
  const block = creds[integration]
  if (!block) return null
  // Tutti i campi essenziali devono essere presenti
  const required = {
    shopify: ['storeUrl', 'adminToken'],
    meta:    ['accessToken'],
    google:  ['refreshToken'],
    klaviyo: ['apiKey'],
  }[integration] || []
  const missing = required.filter(k => !block[k])
  if (missing.length > 0) return null
  return { ...block, _tenant: { userId: creds.userId, companyName: creds.companyName, isBeta: creds.isBeta } }
}
