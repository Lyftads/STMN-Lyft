export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSupabase, getAdminSupabase } from '../../../../../lib/supabase/server'

// ============================================================================
//  Google OAuth — Callback
//
//  Riceve code da Google, lo scambia per refresh_token, salva in
//  companies.google_refresh_token + google_client_id/secret (per-tenant
//  OAuth context). Redirect a /onboarding?gaConnected=1 (o /billing-required
//  se onboarding gia' completo).
//
//  Errors: redirect a /onboarding?gaError=<reason>.
// ============================================================================

function decodeState(state) {
  try {
    const json = Buffer.from(state, 'base64url').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

function redirectWithError(origin, reason) {
  return NextResponse.redirect(`${origin}/onboarding?gaError=${encodeURIComponent(reason)}`)
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const origin =
    req.headers.get('origin') ||
    (req.headers.get('host') ? `https://${req.headers.get('host')}` : null) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://lyftai.io'

  if (error) return redirectWithError(origin, error)
  if (!code || !state) return redirectWithError(origin, 'missing_code')

  // Verifica state
  const stateData = decodeState(state)
  if (!stateData?.uid) return redirectWithError(origin, 'invalid_state')

  // Match utente loggato
  const sb = getServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user || user.id !== stateData.uid) {
    return redirectWithError(origin, 'auth_mismatch')
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return redirectWithError(origin, 'oauth_not_configured')
  }

  const redirectUri = `${origin}/api/google/auth/callback`

  // Exchange code per refresh_token + access_token
  let tokens
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    tokens = await res.json()
    if (!res.ok || !tokens.refresh_token) {
      console.log('[oauth/google] token exchange error:', tokens)
      return redirectWithError(origin, tokens.error || 'token_exchange_failed')
    }
  } catch (e) {
    return redirectWithError(origin, 'network_error')
  }

  // Salva refresh_token in companies (per-tenant)
  const admin = getAdminSupabase()
  if (!admin) return redirectWithError(origin, 'db_not_configured')

  const { error: updError } = await admin
    .from('companies')
    .update({
      google_refresh_token: tokens.refresh_token,
      google_client_id: clientId,
      google_client_secret: clientSecret,
    })
    .eq('user_id', user.id)

  if (updError) {
    console.log('[oauth/google] DB update error:', updError.message)
    return redirectWithError(origin, 'db_save_failed')
  }

  // Successo: redirect a /onboarding con flag (per evidenziare lo step GA4 completato)
  return NextResponse.redirect(`${origin}/onboarding?gaConnected=1`)
}
