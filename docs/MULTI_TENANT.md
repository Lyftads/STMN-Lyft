# Multi-tenant — readiness & rollout

> Obiettivo: far registrare clienti reali, ognuno con i **propri** dati, senza
> mai esporre i dati del tenant beta (STMN) o di altri tenant.

## Come funziona già (fondamenta pronte)
`lib/tenant/credentials.js` risolve le credenziali **DB-first, env-fallback, per-campo**:
- `getTenantCreds()` legge la riga `companies` dell'utente loggato (PK `user_id`) e, per ogni campo mancante, ripiega su env. Supporta token **Nango** per-tenant (Meta/Klaviyo).
- `withTenantContext(req, fn)` + getter `getShopify()/getMeta()/getGoogle()/getKlaviyo()` danno le creds del tenant corrente a qualsiasi helper dentro la route.
- Flag **`LYFT_MULTI_TENANT`**: se ≠ `true` → **env-only** (STMN invariato, zero lookup). Se `true` → risoluzione per-tenant con degrade graceful a env.

➡️ Quindi una route che usa **solo** il resolver è già multi-tenant safe.

## Il rischio: route che leggono creds da `process.env` (bypass resolver)
Una route che fa `const TOKEN = process.env.META_ACCESS_TOKEN` (soprattutto come
**const a livello di modulo**) servirebbe i dati di STMN a **tutti** i tenant.
Queste vanno migrate al resolver **prima** di accendere il flag.

### ✅ Sicure — credenziali APP condivise (NON migrare)
Sono segreti dell'app, uguali per tutti i tenant:
- `app/api/auth/route.js` — `SHOPIFY_CLIENT_ID/SECRET` (OAuth app)
- `app/api/google/auth/*` — `GOOGLE_CLIENT_ID/SECRET` (OAuth app)
- `app/api/shopify/webhooks/compliance/route.js` — `SHOPIFY_APP_API_SECRET`
- `app/api/creative-lab/route.js` — `GOOGLE_AI_API_KEY`/`GEMINI_API_KEY`
- `app/api/google/route.js` — `GOOGLE_ADS_DEVELOPER_TOKEN`

### ⚠️ Da migrare — credenziali PER-TENANT (leak risk)
| Route | Env letti | Stato |
|---|---|---|
| `app/api/product-costs/route.js` | SHOPIFY_STORE_URL/ADMIN_TOKEN | ✅ **migrata (template)** |
| `app/api/report/route.js` | META_ACCESS_TOKEN, META_AD_ACCOUNT_ID | ✅ **migrata** (getMeta nelle 3 fn + GET wrappato) |
| `app/api/creative/route.js` | META token + account(s) | ⏳ |
| `app/api/creative-lab/route.js` | SHOPIFY_STORE_URL/ADMIN_TOKEN | ✅ **migrata** (GET+POST wrappati, getShopify in fetchShopifyProducts) |
| `app/api/cro/route.js` | SHOPIFY_STORE_URL/ADMIN_TOKEN, GA4_PROPERTY_ID, GOOGLE_REFRESH_TOKEN (const modulo) | ⏳ (Google già via resolver, Shopify/GA4 no) |
| `app/api/adlibrary-page/route.js` | META token | ✅ **migrata** |
| `app/api/product-images/route.js` | SHOPIFY_STORE_URL (+ fallback hardcoded!) | ✅ **migrata** (rimosso fallback STMN) |
| `app/api/google/route.js` | GOOGLE_ADS_CUSTOMER_ID / MCC_ID | ⏳ (verifica: per-tenant) |
| `app/api/debug/route.js` | SHOPIFY_STORE_URL/ADMIN_TOKEN | ⏳ (o limitare al solo beta) |

## Pattern di migrazione (sicuro, STMN invariato)
In **env-only mode** `getShopify()/getMeta()/…` ritornano esattamente i valori
env → comportamento **identico** per STMN. Esempio (vedi `product-costs/route.js`):

```js
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'

async function shopifyGql(store, token, query) { /* usa i parametri, non const globali */ }

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { storeUrl: STORE, adminToken: TOKEN } = getShopify()
    if (!STORE || !TOKEN) return NextResponse.json({ error: 'Shopify not configured' }, { status: 500 })
    // ...resto invariato, passando STORE/TOKEN agli helper
  })
}
```

Regole:
1. Mai `const CRED = process.env.X` a livello di modulo per creds per-tenant.
2. Risolvi le creds **dentro** `withTenantContext`, all'inizio dell'handler.
3. Passa le creds come **parametri** agli helper (niente lettura globale).
4. La versione API/Graph e gli ID app condivisi possono restare da env.

## Checklist di rollout (in ordine)
1. **Migrare** tutte le route ⚠️ sopra al resolver (una per commit, validata).
2. **Registrazione → companies row**: assicurarsi che alla registrazione venga creata una riga `companies` con `user_id` (così il resolver ha dove leggere).
3. **Onboarding/Integrazioni scrivono sulla companies row** del tenant:
   - Shopify: salva `shopify_store_url` + `shopify_admin_token`.
   - Meta/Klaviyo: salva la connection Nango in `companies.nango_connections` (jsonb).
   - Google: salva `google_refresh_token` + `ga4_property_id` (OAuth callback).
   - Invalidare la cache tenant dopo il salvataggio (`invalidateTenantCache(userId)`).
4. **Isolamento tabelle Supabase**: ogni tabella dati-tenant filtra per `workspace_id`/`user_id` (già ok: `action_queue`, `tasks`, `time_entries`, `notifications`, `companies`).
5. **Test su preview** con un 2° tenant finto (creds proprie) PRIMA della produzione: verifica che NON veda dati STMN.
6. **Accendere `LYFT_MULTI_TENANT=true`** in produzione e monitorare. Rollback = rimuovere il flag (torna env-only).

## Stato
- Fondamenta resolver: ✅ pronte.
- Route migrate: `product-costs` ✅, `product-images` ✅, `report` ✅ — restanti ⚠️ da fare (creative/creative-lab/cro/adlibrary/google/debug), una alla volta con test a runtime.
- Flag in produzione: **OFF** (env-only, STMN invariato).
