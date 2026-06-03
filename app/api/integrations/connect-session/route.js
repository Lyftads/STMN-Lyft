export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUserId } from '../../../../lib/tenant/credentials'

// Crea una Connect session di Nango per il tenant loggato.
// Il frontend usa il session token con @nangohq/frontend per aprire la
// Connect UI e collegare un provider.
const NANGO_HOST = process.env.NANGO_HOST || 'https://api.nango.dev'
const SECRET = () => process.env.NANGO_SECRET_KEY || ''

export async function POST(req) {
  if (!SECRET()) return NextResponse.json({ error: 'Nango non configurato' }, { status: 500 })
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body = {}
  try { body = await req.json() } catch {}
  const allowed = Array.isArray(body.allowedIntegrations) && body.allowedIntegrations.length
    ? body.allowedIntegrations
    : undefined

  try {
    const res = await fetch(`${NANGO_HOST}/connect/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        end_user: { id: String(userId) },
        ...(allowed ? { allowed_integrations: allowed } : {}),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    const j = await res.json().catch(() => null)
    if (!res.ok) {
      return NextResponse.json({ error: j?.error?.message || j?.message || `Nango ${res.status}` }, { status: 502 })
    }
    const token = j?.data?.token || j?.token || null
    if (!token) return NextResponse.json({ error: 'Session token mancante' }, { status: 502 })
    return NextResponse.json({ sessionToken: token })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Errore Nango' }, { status: 500 })
  }
}
