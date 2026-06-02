export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { getServerSupabase, getAdminSupabase } from '../../../../lib/supabase/server'

// ============================================================================
//  Google Analytics Admin API — Lista GA4 properties dell'utente
//
//  Usa il refresh_token salvato in companies per ottenere access_token,
//  poi chiama analyticsadmin.accountSummaries.list (cross-account view
//  con property summaries inclusi).
//
//  GET → { properties: [{ id, displayName, accountName }] }
// ============================================================================

async function getAccessToken({ refreshToken, clientId, clientSecret }) {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const json = await res.json()
    return json?.access_token || null
  } catch {
    return null
  }
}

export async function GET() {
  const sb = getServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  const { data: company } = await admin
    .from('companies')
    .select('google_refresh_token, google_client_id, google_client_secret')
    .eq('user_id', user.id)
    .maybeSingle()

  const refreshToken = company?.google_refresh_token
  const clientId = company?.google_client_id || process.env.GOOGLE_CLIENT_ID
  const clientSecret = company?.google_client_secret || process.env.GOOGLE_CLIENT_SECRET

  if (!refreshToken || !clientId || !clientSecret) {
    return NextResponse.json({ error: 'Google non connesso', notConnected: true }, { status: 400 })
  }

  const token = await getAccessToken({ refreshToken, clientId, clientSecret })
  if (!token) {
    return NextResponse.json({ error: 'Token Google scaduto, riconnetti' }, { status: 401 })
  }

  // Lista accountSummaries — include propertySummaries per ogni account
  try {
    const res = await fetch(
      'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200',
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) }
    )
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Google API ${res.status}: ${text.slice(0, 200)}` }, { status: 502 })
    }
    const json = await res.json()

    const properties = []
    for (const acc of (json.accountSummaries || [])) {
      for (const p of (acc.propertySummaries || [])) {
        // p.property formato 'properties/XXXXXX' — estraiamo solo l'ID numerico
        const id = String(p.property || '').split('/').pop()
        if (!id) continue
        properties.push({
          id,
          displayName: p.displayName || `Property ${id}`,
          accountName: acc.displayName || '—',
          propertyType: p.propertyType || null,
        })
      }
    }

    return NextResponse.json({ properties, count: properties.length })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Errore Google' }, { status: 500 })
  }
}
