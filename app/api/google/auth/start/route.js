export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../../../lib/supabase/server'

// ============================================================================
//  Google OAuth — Start flow
//
//  Genera la URL di autorizzazione Google e redirect l'utente.
//  Scope: analytics.readonly (GA4 reporting) + userinfo.email.
//  access_type=offline + prompt=consent garantiscono refresh_token.
//  state: token CSRF con user_id + ts firmati (base64).
//
//  Setup necessario su Vercel:
//    GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
//    GOOGLE_CLIENT_SECRET=xxx
//    NEXT_PUBLIC_APP_URL=https://lyftai.io  (opzionale, usa header host fallback)
// ============================================================================

const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',   // GA4 reporting + Realtime
  'https://www.googleapis.com/auth/adwords',              // Google Ads
  'https://www.googleapis.com/auth/webmasters.readonly',  // Search Console
  'https://www.googleapis.com/auth/bigquery.readonly',    // User Path (export GA4 → BigQuery)
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

export async function GET(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID non configurato su Vercel' }, { status: 500 })
  }

  // Verifica utente loggato per associare il refresh_token al suo account
  const sb = getServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Devi essere loggato' }, { status: 401 })
  }

  // Origin per redirect_uri — deve combaciare con quello settato in Google Cloud
  const origin =
    req.headers.get('origin') ||
    (req.headers.get('host') ? `https://${req.headers.get('host')}` : null) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://lyftai.io'

  const redirectUri = `${origin}/api/google/auth/callback`

  // Step di onboarding da cui si è partiti → il callback ci riporta lì.
  let step = null
  try { step = new URL(req.url).searchParams.get('step') || null } catch {}

  // State CSRF: base64 del JSON {user_id, ts, step}. Verifichiamo nel callback.
  const state = Buffer.from(JSON.stringify({
    uid: user.id,
    ts: Date.now(),
    step,
  })).toString('base64url')

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state', state)

  return NextResponse.redirect(url.toString())
}
