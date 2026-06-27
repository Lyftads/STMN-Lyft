export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getMeta, getKlaviyo, getGoogle, getEmailProvider, getEffectiveTenantId } from '../../../lib/tenant/credentials'

// Stato integrazioni del WORKSPACE EFFETTIVO (cliente agency se switchato).
// PRIMA leggeva solo process.env (= credenziali di STMN) → OGNI workspace, anche
// un cliente nuovo, vedeva le integrazioni di STMN come "Connected" (leak).
// Ora risolve le creds del tenant via withTenantContext: env solo per l'owner,
// per i clienti contano SOLO le loro connection (Nango / token salvati).
export async function GET(req) {
  return withTenantContext(req, async () => {
    const shop = getShopify()
    const meta = getMeta()
    const google = getGoogle()
    const klaviyo = getKlaviyo()
    const emailProvider = getEmailProvider()

    const integrations = [
      {
        id: 'shopify',
        name: 'Shopify',
        description: 'Sync store data, orders, and customers',
        category: 'Commerce',
        domain: 'shopify.com',
        active: !!(shop?.storeUrl && shop?.adminToken),
        setupUrl: 'https://admin.shopify.com/store/YOUR_STORE/settings/apps/development',
        scope: 'workspace',
      },
      {
        id: 'meta',
        name: 'Meta Ads',
        description: 'Connect Facebook and Instagram ad accounts',
        category: 'Advertising',
        domain: 'meta.com',
        active: !!meta?.accessToken,
        setupUrl: 'https://business.facebook.com/settings/system-users',
        scope: 'workspace',
      },
      {
        id: 'klaviyo',
        name: 'Klaviyo',
        description: 'Sync email campaigns, flows, and segments',
        category: 'Email Marketing',
        domain: 'klaviyo.com',
        active: !!klaviyo?.apiKey || emailProvider === 'klaviyo',
        setupUrl: 'https://www.klaviyo.com/settings/account/api-keys',
        scope: 'workspace',
      },
      {
        id: 'google_ads',
        name: 'Google Ads',
        description: 'Track Google Ads campaigns and conversions',
        category: 'Advertising',
        domain: 'ads.google.com',
        active: !!(google?.refreshToken && google?.adsCustomerId),
        setupUrl: 'https://ads.google.com/aw/apicenter',
        scope: 'workspace',
      },
      {
        id: 'ga4',
        name: 'Google Analytics',
        description: 'Connect GA4 for website analytics',
        category: 'Analytics',
        domain: 'analytics.google.com',
        active: !!(google?.refreshToken && google?.ga4PropertyId),
        setupUrl: 'https://analytics.google.com/analytics/web/',
        scope: 'workspace',
      },
      {
        id: 'tiktok_ads',
        name: 'TikTok Ads',
        description: 'Track TikTok ad performance and spend',
        category: 'Advertising',
        domain: 'tiktok.com',
        active: false, // nessuna connessione TikTok per-tenant ancora
        setupUrl: 'https://business-api.tiktok.com/portal/apps',
        scope: 'workspace',
      },
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'AI agents, performance analysis, creative generation',
        category: 'AI',
        domain: 'openai.com',
        // OpenAI = backend AI dell'APP, condiviso da tutti i tenant (non è una
        // connection privata del cliente) → attivo se l'app ha la chiave.
        active: !!process.env.OPENAI_API_KEY,
        setupUrl: 'https://platform.openai.com/api-keys',
        scope: 'app',
      },
    ]

    const active = integrations.filter(i => i.active)
    const available = integrations.filter(i => !i.active)

    // ownerWorkspace = workspace EFFETTIVO è quello dell'owner (STMN). I blocchi
    // "Connected"/"Available" in basso (stato env-based) servono solo a STMN; i
    // clienti vedono solo la sezione "Collega via OAuth" sopra.
    const tenant = await getEffectiveTenantId().catch(() => null)
    const ownerWorkspace = !!tenant && tenant === process.env.LYFT_OWNER_USER_ID

    return NextResponse.json({ active, available, ownerWorkspace })
  })
}
