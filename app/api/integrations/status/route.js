export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { tipoNegozio } from '../../../../lib/team/tipoNegozio'
import { getCurrentUserId, getEffectiveTenantId } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// Stato delle connection OAuth del WORKSPACE EFFETTIVO (cliente agency se
// switchato): quali integration risultano collegate (chiavi di
// companies.nango_connections) + ad account Meta scelto. isOwner resta basato
// sull'utente REALE (gate Creative Studio).
export async function GET() {
  const realUid = await getCurrentUserId()
  const userId = await getEffectiveTenantId()
  if (!userId) return NextResponse.json({ connected: [], metaAccountId: null })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ connected: [], metaAccountId: null })
  try {
    const { data } = await admin
      .from('companies')
      .select('nango_connections, meta_account_id, google_refresh_token, ga4_property_id, gsc_site_url, google_ads_customer_id, shopify_store_url, multimarca, marchi_rilevati, quota_primo_marchio, canali_esclusi, negozi_fisici, etichetta_negozi_fisici')
      .eq('user_id', userId)
      .maybeSingle()
    const conns = (data?.nango_connections && typeof data.nango_connections === 'object') ? data.nango_connections : {}
    return NextResponse.json({
      connected: Object.keys(conns),
      isOwner: !!realUid && realUid === process.env.LYFT_OWNER_USER_ID,
      // ownerWorkspace = il workspace EFFETTIVO è quello dell'owner (STMN), cioè
      // l'owner NON ha switchato su un cliente. Gate Creative Studio: deve essere
      // attiva SOLO su STMN, bloccata per tutti i clienti (incluso quando l'owner
      // è dentro un workspace cliente come Saracino).
      ownerWorkspace: !!userId && userId === process.env.LYFT_OWNER_USER_ID,
      shopifyStore: !!data?.shopify_store_url || Object.keys(conns).includes('shopify'),
      metaAccountId: data?.meta_account_id || null,
      googleConnected: !!data?.google_refresh_token,
      ga4PropertyId: data?.ga4_property_id || null,
      gscSiteUrl: data?.gsc_site_url || null,
      adsCustomerId: data?.google_ads_customer_id || null,
      // Che tipo di negozio e': decide quali funzioni ha senso mostrare a QUESTO cliente.
      // Un brand che vende solo i suoi prodotti non ha niente da confrontare coi concorrenti —
      // nessun altro vende quegli articoli — e il pannello dei marchi gli disegna una barra sola
      // al 100%. Vedi lib/team/tipoNegozio.js e supabase/tipo_negozio.sql.
      // Se le colonne non ci sono ancora (migrazione non eseguita) Supabase manda l'intera select
      // in errore: `data` resta null e tipoNegozio() risponde "tutto spento", che e' il ripiego
      // giusto — nessuno perde una funzione che oggi non esiste.
      tipoNegozio: tipoNegozio(data || {}),
    })
  } catch {
    return NextResponse.json({ connected: [], metaAccountId: null })
  }
}
