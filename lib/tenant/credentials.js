import { AsyncLocalStorage } from 'node:async_hooks'
import { getServerSupabase, getAdminSupabase } from '../supabase/server'
import { getNangoToken, NANGO_INTEGRATIONS } from './nango'

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

// Cache in-memory: company row keyed by userId.
// TTL 5 minuti — le creds di un tenant cambiano raramente (onboarding,
// rotazione token), 5min di stale e' accettabile e taglia 99% dei DB hit
// sul warm container Vercel.
const cache = new Map()
const TTL_MS = 30 * 60_000 // 30 min — creds cambiano raramente, riduce hit DB

function readCachedCompany(userId) {
  const hit = cache.get(userId)
  if (hit && hit.expiresAt > Date.now()) return hit.company
  return null
}

function setCachedCompany(userId, company) {
  cache.set(userId, { company, expiresAt: Date.now() + TTL_MS })
}

// Cache delle CREDS risolte (incl. token Nango) per ridurre il lavoro per
// richiesta: senza, ogni chiamata API in multi-tenant rifà lookup Supabase +
// fetch token Nango → latenza che aggrava throttle/timeout su route pesanti
// come /api/metrics. TTL breve: i token restano validi molto più a lungo.
const credsCache = new Map()
const CREDS_TTL_MS = 120_000 // 2 min

// Invalida la cache company + creds di un tenant (es. dopo aver collegato un provider).
export function invalidateTenantCache(userId) {
  if (userId) { cache.delete(userId); credsCache.delete(userId) }
  else { cache.clear(); credsCache.clear() }
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
//
// Wrappato in try/catch: errori DB (timeout, rate limit, schema mismatch)
// NON devono mai rompere la route — degradiamo a "company null" → fallback
// su env var. Logghiamo per diagnostica.
async function getCompanyRow(userId) {
  if (!userId) return null
  // Cache hit: ritorna anche se valore e' null (significa "abbiamo gia'
  // controllato, non esiste riga"). readCachedCompany ritorna null sia su
  // miss che su valore null — distinguiamo con Map.has.
  if (cache.has(userId)) {
    const hit = cache.get(userId)
    if (hit.expiresAt > Date.now()) return hit.company
  }
  const admin = getAdminSupabase()
  if (!admin) return null
  try {
    const { data, error } = await admin
      .from('companies')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      console.log('[tenant] companies fetch error:', error.message)
      setCachedCompany(userId, null) // cache anche il null per evitare retry storm
      return null
    }
    setCachedCompany(userId, data || null)
    return data || null
  } catch (e) {
    console.log('[tenant] companies fetch threw:', e?.message || e)
    setCachedCompany(userId, null)
    return null
  }
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
  if (userId) {
    const hit = credsCache.get(userId)
    if (hit && hit.expiresAt > Date.now()) return hit.creds
  }
  const company = userId ? await getCompanyRow(userId) : null

  // ── Token via Nango (solo se il tenant ha una connection collegata) ──
  // company.nango_connection_id e' il connectionId del tenant su Nango.
  // Se la colonna non esiste ancora nello schema → undefined → nessuna
  // chiamata → comportamento invariato (STMN/env-only non toccati).
  // Mappa provider→connectionId salvata su companies.nango_connections (jsonb).
  // Fallback legacy: companies.nango_connection_id (singolo id condiviso).
  const conns = (company?.nango_connections && typeof company.nango_connections === 'object') ? company.nango_connections : {}
  const legacy = company?.nango_connection_id || null
  const connMeta    = conns[NANGO_INTEGRATIONS.meta]    || legacy || null
  const connKlaviyo = conns[NANGO_INTEGRATIONS.klaviyo] || legacy || null
  let nangoMeta = null, nangoKlaviyo = null
  if (connMeta || connKlaviyo) {
    ;[nangoMeta, nangoKlaviyo] = await Promise.all([
      connMeta    ? getNangoToken({ integrationId: NANGO_INTEGRATIONS.meta,    connectionId: connMeta }).catch(() => null)    : Promise.resolve(null),
      connKlaviyo ? getNangoToken({ integrationId: NANGO_INTEGRATIONS.klaviyo, connectionId: connKlaviyo }).catch(() => null) : Promise.resolve(null),
    ])
  }

  // ── Isolamento multi-tenant (anti data-leak) ───────────────────────────
  // Le env var (SHOPIFY_*, META_*, KLAVIYO_*, GOOGLE_REFRESH_TOKEN, GA4_*)
  // contengono le credenziali di STMN, il tenant beta/owner. Devono poter
  // fare da fallback SOLO per l'azienda owner (is_beta=true). Per QUALSIASI
  // altro tenant le env NON vanno mai esposte: se la sua riga companies non
  // ha quella credenziale (non l'ha ancora collegata), resta null → la route
  // mostra "non configurato"/onboarding, MAI i dati di STMN.
  //
  // Eccezioni che restano condivise (sono config a livello di APP, non dati
  // di un tenant): google_client_id/secret = app OAuth Lyft usata da tutti
  // per il flusso di connessione; meta graphVersion = versione API globale.
  const isOwner = company?.is_beta === true
  const envT = (v) => (isOwner ? (v ?? null) : null) // env solo per l'owner

  const creds = {
    userId,
    companyName: company?.company_name || null,
    isBeta: company?.is_beta === true,

    shopify: {
      storeUrl:   pick(company?.shopify_store_url,   envT(process.env.SHOPIFY_STORE_URL)),
      adminToken: pick(company?.shopify_admin_token, envT(process.env.SHOPIFY_ADMIN_TOKEN)),
    },

    meta: {
      // Priorita': token Nango (refresh gestito) → token salvato → env (solo owner).
      // META_ACCESS_TOKEN ha alias storici nel codebase (FACEBOOK_*, FB_*)
      accessToken: pick(
        nangoMeta,
        company?.meta_access_token,
        envT(process.env.META_ACCESS_TOKEN),
        envT(process.env.FACEBOOK_ACCESS_TOKEN),
        envT(process.env.FB_ACCESS_TOKEN),
      ),
      adAccountId: pick(company?.meta_account_id, envT(process.env.META_AD_ACCOUNT_ID)),
      // Graph version e' globale (versione API Meta), non per-tenant → condivisa
      graphVersion: process.env.META_GRAPH_VERSION || 'v20.0',
      // Consente alle route di usare la catena env Meta (multi-account STMN)
      // SOLO per l'owner. Per i tenant non-owner restano i loro account.
      allowEnv: isOwner,
    },

    google: {
      // Client ID/Secret = app OAuth Lyft, condivisa da tutti i tenant per il
      // flusso di connessione (NON sono un dato del cliente) → fallback env ok.
      clientId:     pick(company?.google_client_id,     process.env.GOOGLE_CLIENT_ID),
      clientSecret: pick(company?.google_client_secret, process.env.GOOGLE_CLIENT_SECRET),
      // Refresh token e' SEMPRE per-tenant (e' la chiave che permette accesso
      // ai dati GA4 dell'azienda specifica) → env solo per l'owner.
      refreshToken: pick(company?.google_refresh_token, envT(process.env.GOOGLE_REFRESH_TOKEN)),
      ga4PropertyId: pick(company?.ga4_property_id, envT(process.env.GA4_PROPERTY_ID)),
      // Google Ads account (per-tenant). Developer token resta shared (env).
      adsCustomerId: pick(company?.google_ads_customer_id, envT(process.env.GOOGLE_ADS_CUSTOMER_ID)),
      adsMccId: pick(company?.google_ads_mcc_id, envT(process.env.GOOGLE_ADS_MCC_ID)),
    },

    klaviyo: {
      apiKey: pick(nangoKlaviyo, company?.klaviyo_api_key, envT(process.env.KLAVIYO_API_KEY)),
      // Se il token arriva da Nango è un access token OAuth → header Bearer.
      isOAuth: !!nangoKlaviyo,
    },
  }

  if (userId) credsCache.set(userId, { creds, expiresAt: Date.now() + CREDS_TTL_MS })
  return creds
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

// Wrappa il body di una route in un contesto tenant.
//
// MODALITA':
// - default (env-only): NON fa lookup Supabase, usa creds direttamente
//   da env. Zero overhead per il tenant beta (STMN). Comportamento
//   identico al codice pre-Fase 2.
// - multi-tenant (LYFT_MULTI_TENANT=true su Vercel): fa lookup
//   companies row per risolvere creds DB-first con env fallback.
//   Da attivare quando un secondo tenant si registra e popola le sue
//   credenziali nella riga companies.
//
// Defensive: in modalita' multi-tenant se getTenantCreds() fallisce per
// qualsiasi motivo (Supabase down, network blip), cadiamo su env-only
// invece di propagare l'errore. STMN continua a funzionare anche se
// Supabase ha un hiccup.
// Riconosce una richiesta proveniente da un job cron interno autorizzato.
// Vercel cron diretti → header 'authorization: Bearer <CRON_SECRET>'.
// Fetch interni (auto-scan, scheduled-reports) → 'x-internal-cron: <CRON_SECRET>'.
// Se CRON_SECRET non e' impostata → mai autorizzato (fail-safe).
function isAuthorizedCron(req) {
  try {
    const secret = process.env.CRON_SECRET
    if (!secret) return false
    const h = req?.headers
    if (!h || typeof h.get !== 'function') return false
    return h.get('authorization') === `Bearer ${secret}` || h.get('x-internal-cron') === secret
  } catch {
    return false
  }
}

export async function withTenantContext(req, fn) {
  // Fast path #1: env-only mode (flag non 'true').
  // Le env contengono le credenziali di STMN, collegato VIA CODICE (non OAuth).
  // Le esponiamo SOLO a: (a) l'owner loggato (LYFT_OWNER_USER_ID), (b) i job
  // cron interni autorizzati col CRON_SECRET. Chiunque altro — cliente
  // loggato non-owner OPPURE richiesta anonima pubblica — riceve creds vuote
  // → onboarding, MAI i dati di STMN (chiude anche il leak da curl anonimo).
  // Se LYFT_OWNER_USER_ID non e' impostata → comportamento legacy invariato.
  if (process.env.LYFT_MULTI_TENANT !== 'true') {
    const owner = process.env.LYFT_OWNER_USER_ID || null
    let creds = envOnlyCreds()
    if (owner) {
      if (!isAuthorizedCron(req)) {
        const uid = await getCurrentUserId()
        // Solo l'owner vede le env di STMN. Non-owner E anonimo → vuoto.
        if (uid !== owner) creds = emptyCreds()
      }
    }
    return tenantStore.run(creds, fn)
  }
  // Multi-tenant mode: prova lookup DB veloce, fallback su env in caso di
  // problemi o latency. Usa Promise.race per garantire risposta entro 800ms:
  // se Supabase non risponde in tempo, cadiamo su env-only e non blocchiamo
  // la route (e.g. /api/metrics con query Shopify gia' lunghe).
  let creds
  try {
    // 5s: copre il lookup companies + l'eventuale risoluzione token Nango
    // (refresh gestito da Nango). Se sfora → degrade graceful a env-only.
    creds = await Promise.race([
      getTenantCreds(),
      new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
    ])
    if (!creds) {
      // Timeout o nessun lookup → degrade graceful. NON esporre STMN a tutti:
      // env-only solo se l'utente loggato e' l'owner configurato, altrimenti
      // creds vuote (meglio "non configurato" che un leak cross-tenant).
      creds = await degradeCreds()
    }
  } catch (e) {
    console.log('[tenant] withTenantContext getTenantCreds fallita:', e?.message || e)
    creds = await degradeCreds()
  }
  return tenantStore.run(creds, fn)
}

// Degrade sicuro: usato quando il lookup tenant fallisce/scade. Espone le env
// (= STMN) SOLO all'owner identificato da LYFT_OWNER_USER_ID; per ogni altro
// utente (o se la var non e' impostata) ritorna creds vuote → nessun leak.
async function degradeCreds() {
  try {
    const uid = await getCurrentUserId()
    const owner = process.env.LYFT_OWNER_USER_ID || null
    if (uid && owner && uid === owner) return envOnlyCreds()
  } catch {}
  return emptyCreds()
}

// Creds completamente vuote (tutto null). Forza le route nello stato
// "non configurato"/onboarding senza mai esporre credenziali altrui.
function emptyCreds() {
  return {
    userId: null,
    companyName: null,
    isBeta: false,
    shopify: { storeUrl: null, adminToken: null },
    meta: { accessToken: null, adAccountId: null, graphVersion: process.env.META_GRAPH_VERSION || 'v20.0', allowEnv: false },
    google: { clientId: process.env.GOOGLE_CLIENT_ID || null, clientSecret: process.env.GOOGLE_CLIENT_SECRET || null, refreshToken: null, ga4PropertyId: null, adsCustomerId: null, adsMccId: null },
    klaviyo: { apiKey: null, isOAuth: false },
  }
}

// Creds derivate solo da env. Usato come fallback quando il DB lookup
// fallisce o quando una route gira fuori dal contesto utente (cron).
function envOnlyCreds() {
  return {
    userId: null,
    companyName: null,
    isBeta: false,
    shopify: {
      storeUrl:   process.env.SHOPIFY_STORE_URL   || null,
      adminToken: process.env.SHOPIFY_ADMIN_TOKEN || null,
    },
    meta: {
      accessToken:  process.env.META_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN || process.env.FB_ACCESS_TOKEN || null,
      adAccountId:  process.env.META_AD_ACCOUNT_ID || null,
      graphVersion: process.env.META_GRAPH_VERSION || 'v20.0',
      allowEnv: true, // env-only = owner/cron STMN → catena env Meta consentita
    },
    google: {
      clientId:      process.env.GOOGLE_CLIENT_ID     || null,
      clientSecret:  process.env.GOOGLE_CLIENT_SECRET || null,
      refreshToken:  process.env.GOOGLE_REFRESH_TOKEN || null,
      ga4PropertyId: process.env.GA4_PROPERTY_ID      || null,
      adsCustomerId: process.env.GOOGLE_ADS_CUSTOMER_ID || null,
      adsMccId:      process.env.GOOGLE_ADS_MCC_ID      || null,
    },
    klaviyo: { apiKey: process.env.KLAVIYO_API_KEY || null, isOAuth: false },
  }
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
    allowEnv: true, // fuori-contesto = cron/script STMN → catena env consentita
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
    adsCustomerId: process.env.GOOGLE_ADS_CUSTOMER_ID || null,
    adsMccId:      process.env.GOOGLE_ADS_MCC_ID      || null,
  }
}

export function getKlaviyo() {
  const ctx = getStore()
  if (ctx) return ctx.klaviyo
  return { apiKey: process.env.KLAVIYO_API_KEY || null, isOAuth: false }
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
