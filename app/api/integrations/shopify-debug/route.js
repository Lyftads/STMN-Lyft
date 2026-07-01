export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getCurrentUserId, getEffectiveTenantId } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { getNangoConnection, NANGO_INTEGRATIONS, nangoConfigured } from '../../../../lib/tenant/nango'

// Diagnostica risoluzione Shopify per il workspace EFFETTIVO (owner-only).
// Mostra se la connection 'shopify' è salvata e se Nango la risolve in token+store.
export async function GET(req) {
  const realUid = await getCurrentUserId()
  if (!realUid || realUid !== process.env.LYFT_OWNER_USER_ID) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return withTenantContext(req, async () => {
    const tenant = await getEffectiveTenantId()
    const admin = getAdminSupabase()
    const { data: company } = await admin
      .from('companies')
      .select('nango_connections, shopify_store_url, shopify_admin_token, is_beta')
      .eq('user_id', tenant)
      .maybeSingle()

    const conns = (company?.nango_connections && typeof company.nango_connections === 'object') ? company.nango_connections : {}
    const connShopify = conns[NANGO_INTEGRATIONS.shopify] || company?.nango_connection_id || null

    let nangoResolve = null
    if (connShopify) {
      try {
        const c = await getNangoConnection({ integrationId: NANGO_INTEGRATIONS.shopify, connectionId: connShopify, timeoutMs: 9000 })
        nangoResolve = c
          ? {
              ok: true,
              hasToken: !!c?.credentials?.access_token,
              subdomain: c?.connection_config?.subdomain || c?.connection_config?.shop || c?.connection_config?.['shop-subdomain'] || null,
              connectionConfigKeys: Object.keys(c?.connection_config || {}),
            }
          : { ok: false, note: 'getNangoConnection ha restituito null (timeout o connection inesistente su Nango)' }
      } catch (e) {
        nangoResolve = { error: String(e?.message || e) }
      }
    }

    const sh = getShopify()
    return NextResponse.json({
      tenant,
      nangoConfigured: nangoConfigured(),
      nangoIntegrationIdShopify: NANGO_INTEGRATIONS.shopify,
      nangoConnectionsKeys: Object.keys(conns),
      connShopify,
      savedManualStoreUrl: company?.shopify_store_url || null,
      savedManualToken: !!company?.shopify_admin_token,
      isBeta: company?.is_beta === true,
      nangoResolve,
      getShopifyResult: { storeUrl: sh.storeUrl, hasToken: !!sh.adminToken },
    })
  })
}
