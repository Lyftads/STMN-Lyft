export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUserId } from '../../../../lib/tenant/credentials'
import { getServerSupabase, getAdminSupabase } from '../../../../lib/supabase/server'

// GDPR — Diritto di accesso/portabilità (art. 15/20): esporta i dati dell'account
// dell'utente LOGGATO (il suo profilo/azienda, brand identity, integrazioni
// collegate). NON include i token segreti (sono credenziali, non dati personali).
export async function GET() {
  const uid = await getCurrentUserId()
  if (!uid) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const sb = getServerSupabase()
  const { data: { user } } = await sb.auth.getUser()

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Servizio non disponibile' }, { status: 500 })

  const { data: company } = await admin
    .from('companies')
    .select('company_name, language, plan, brand_identity, brand_assets, nango_connections, ga4_property_id, gsc_site_url, google_ads_customer_id, meta_account_id, shopify_store_url, onboarding_completed_at, created_at')
    .eq('user_id', uid)
    .maybeSingle()

  const conns = (company?.nango_connections && typeof company.nango_connections === 'object') ? Object.keys(company.nango_connections) : []
  const connectedIntegrations = [...conns]
  if (company?.shopify_store_url) connectedIntegrations.push('shopify')
  if (company?.meta_account_id) connectedIntegrations.push('meta')
  if (company?.ga4_property_id) connectedIntegrations.push('ga4')
  if (company?.google_ads_customer_id) connectedIntegrations.push('google_ads')
  if (company?.gsc_site_url) connectedIntegrations.push('search_console')

  const payload = {
    exportedAt: new Date().toISOString(),
    account: { userId: uid, email: user?.email || null, createdAt: user?.created_at || null },
    company: company ? {
      name: company.company_name, language: company.language, plan: company.plan,
      onboardingCompletedAt: company.onboarding_completed_at, createdAt: company.created_at,
    } : null,
    brandIdentity: company?.brand_identity || null,
    brandAssets: Array.isArray(company?.brand_assets) ? company.brand_assets : [],
    connectedIntegrations: [...new Set(connectedIntegrations)],
    note: 'Token e credenziali di accesso sono esclusi per sicurezza. Titolare: Lyft SRL — info@lyftads.agency.',
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="lyftai-my-data-${uid.slice(0, 8)}.json"`,
    },
  })
}
