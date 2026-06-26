export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUserId } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// Stato delle connection OAuth del tenant: quali integration risultano
// collegate (chiavi di companies.nango_connections) + ad account Meta scelto.
export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ connected: [], metaAccountId: null })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ connected: [], metaAccountId: null })
  try {
    const { data } = await admin
      .from('companies')
      .select('nango_connections, meta_account_id, google_refresh_token, ga4_property_id, gsc_site_url, google_ads_customer_id, shopify_store_url')
      .eq('user_id', userId)
      .maybeSingle()
    const conns = (data?.nango_connections && typeof data.nango_connections === 'object') ? data.nango_connections : {}
    return NextResponse.json({
      connected: Object.keys(conns),
      isOwner: !!userId && userId === process.env.LYFT_OWNER_USER_ID,
      shopifyStore: !!data?.shopify_store_url || Object.keys(conns).includes('shopify'),
      metaAccountId: data?.meta_account_id || null,
      googleConnected: !!data?.google_refresh_token,
      ga4PropertyId: data?.ga4_property_id || null,
      gscSiteUrl: data?.gsc_site_url || null,
      adsCustomerId: data?.google_ads_customer_id || null,
    })
  } catch {
    return NextResponse.json({ connected: [], metaAccountId: null })
  }
}
