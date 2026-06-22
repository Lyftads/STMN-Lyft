export const dynamic = 'force-dynamic'
export const maxDuration = 45
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withTenantContext, getEmailProvider } from '../../../lib/tenant/credentials'
import { fetchOmnisend } from '../../../lib/email/omnisend'
import { fetchMailchimp } from '../../../lib/email/mailchimp'

// Route unificata della tab "Email Marketing".
//  - ?probe=1 → ritorna solo { provider } (per il wrapper, veloce)
//  - altrimenti, per Omnisend/Mailchimp ritorna il contratto normalizzato
//    (kpis, campaigns, flows). Per Klaviyo/none NON serve dati qui: il wrapper
//    monta la KlaviyoTab originale (che chiama /api/klaviyo).
export async function GET(req) {
  return withTenantContext(req, async () => {
    const provider = getEmailProvider()
    const { searchParams } = new URL(req.url)
    if (searchParams.get('probe')) return NextResponse.json({ provider: provider || null })

    const days = Math.max(1, Math.min(365, parseInt(searchParams.get('days') || '30', 10)))
    try {
      if (provider === 'omnisend') {
        const d = await fetchOmnisend(days)
        return NextResponse.json(d || { provider: 'omnisend', error: 'no_data' })
      }
      if (provider === 'mailchimp') {
        const d = await fetchMailchimp(days)
        return NextResponse.json(d || { provider: 'mailchimp', error: 'no_data' })
      }
      return NextResponse.json({ provider: provider || null })
    } catch (e) {
      return NextResponse.json({ provider, error: e?.message || 'fetch_failed' }, { status: 200 })
    }
  })
}
