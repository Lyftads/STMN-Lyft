export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getNangoToken, NANGO_INTEGRATIONS, nangoConfigured } from '../../../lib/tenant/nango'

// Diagnostico TEMPORANEO: verifica che getNangoToken legga la connection.
// Ritorna solo un boolean + anteprima di 6 char (mai il token intero).
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const integration = searchParams.get('integration') || NANGO_INTEGRATIONS.klaviyo
  const connection = searchParams.get('connection') || 'stmn'
  const token = await getNangoToken({ integrationId: integration, connectionId: connection })
  return NextResponse.json({
    nangoConfigured: nangoConfigured(),
    integration,
    connection,
    hasToken: !!token,
    tokenPreview: token ? `${String(token).slice(0, 6)}…` : null,
  })
}
