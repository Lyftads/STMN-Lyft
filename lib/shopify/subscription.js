// ============================================================================
//  Shopify Managed Pricing — lettura abbonamento attivo (gate accesso)
//
//  L'app è una "Managed Pricing App": è Shopify a gestire i piani, gli addebiti,
//  i trial e le disdette. Noi NON creiamo charge via Billing API (Shopify la
//  blocca per le Managed Pricing App). Qui leggiamo SOLO l'abbonamento attivo del
//  merchant via Admin GraphQL e lo usiamo per concedere/negare l'accesso.
//
//  Multi-tenant: vale per OGNI store collegato (non solo STMN). Le creds del
//  tenant arrivano da getTenantCreds() (companies row + Nango).
// ============================================================================

import { getTenantCreds } from '../tenant/credentials'
import { getAdminSupabase } from '../supabase/server'

// Cache per-utente del risultato del check (riduce le chiamate Shopify nel gate,
// che viene interrogato spesso). In-memory per-istanza serverless.
const subCache = new Map() // userId -> { at, val }
const SUB_TTL_MS = 60_000

// Mappa il nome del piano gestito (es. "Starter", "Growth", "Scale") al planId
// interno usato dal resto dell'app per i gate di funzionalità.
export function planIdFromName(name = '') {
  const n = String(name).toLowerCase()
  if (n.includes('starter')) return 'starter'
  if (n.includes('growth')) return 'growth'
  if (n.includes('scale')) return 'scale'
  // Enterprise = tier più alto → eredita l'accesso di Scale (feature gate).
  if (n.includes('enterprise')) return 'scale'
  return null
}

// Query live: ritorna l'AppSubscription ATTIVA o null (nessuna).
// THROWS se la fetch fallisce → il chiamante distingue "nessun abbonamento"
// (null) da "errore transitorio" (throw) e non degrada un utente per sbaglio.
export async function fetchShopifyActiveSubscription(shopify) {
  if (!shopify?.storeUrl || !shopify?.adminToken) return null
  const q = `{ currentAppInstallation { activeSubscriptions { id name status test currentPeriodEnd } } }`
  const r = await fetch(`https://${shopify.storeUrl}/admin/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': shopify.adminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
    signal: AbortSignal.timeout(10000),
  })
  if (!r.ok) throw new Error(`Shopify ${r.status}`)
  const j = await r.json()
  if (j?.errors) throw new Error(j.errors[0]?.message || 'GraphQL error')
  const subs = j?.data?.currentAppInstallation?.activeSubscriptions || []
  return subs.find(s => s.status === 'ACTIVE') || null
}

// Check autorevole con cache + persistenza su companies.
//  - userId: per cache e upsert (può essere null → solo lettura, no persist)
//  - shopifyCreds: opzionale; se assente risolve via getTenantCreds()
// Ritorna { active, plan, name, id, fetched }.
//  fetched=false → la fetch Shopify è fallita: NON tocchiamo companies, il
//  chiamante può cadere sul valore memorizzato (shopify_subscription_status).
export async function checkTenantShopifySubscription(userId, shopifyCreds = null) {
  if (userId) {
    const hit = subCache.get(userId)
    if (hit && Date.now() - hit.at < SUB_TTL_MS) return hit.val
  }

  let val = { active: false, plan: null, name: null, id: null, fetched: false }
  let sub = null
  let fetched = false
  try {
    const shopify = shopifyCreds || (await getTenantCreds()).shopify
    if (shopify?.storeUrl && shopify?.adminToken) {
      sub = await fetchShopifyActiveSubscription(shopify)
      fetched = true
    }
  } catch {
    fetched = false
  }

  if (fetched) {
    val = sub
      ? { active: true, plan: planIdFromName(sub.name), name: sub.name, id: sub.id, fetched: true }
      : { active: false, plan: null, name: null, id: null, fetched: true }
    // Persisti su companies (solo se abbiamo letto davvero lo stato).
    try {
      const admin = getAdminSupabase()
      if (admin && userId) {
        const patch = sub
          ? { shopify_subscription_id: sub.id, shopify_subscription_status: 'active', shopify_subscription_plan: val.plan }
          : { shopify_subscription_status: 'inactive' }
        await admin.from('companies').update(patch).eq('user_id', userId)
      }
    } catch {}
  }

  if (userId) subCache.set(userId, { at: Date.now(), val })
  return val
}

// Invalida la cache del check (es. dopo un redirect di ritorno dalla pagina prezzi).
export function invalidateShopifySubCache(userId) {
  if (userId) subCache.delete(userId)
}

// URL della pagina prezzi gestita di Shopify per il merchant.
// Formato: https://admin.shopify.com/store/{store}/charges/{app-handle}/pricing_plans
// app-handle da env SHOPIFY_APP_HANDLE (lo riempiamo a pubblicazione fatta);
// store = subdomain dello store del tenant.
export function managedPricingUrl(storeUrl) {
  const store = String(storeUrl || '')
    .replace(/^https?:\/\//, '')
    .replace(/\.myshopify\.com$/, '')
    .trim()
  const handle = process.env.SHOPIFY_APP_HANDLE || 'lyftai'
  if (!store) return null
  return `https://admin.shopify.com/store/${store}/charges/${handle}/pricing_plans`
}
