export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { getServerSupabase, getAdminSupabase } from '../../../lib/supabase/server'
import { invalidateTenantCache } from '../../../lib/tenant/credentials'

// ============================================================================
//  Onboarding API
//
//  GET → ritorna lo stato di onboarding dell'utente loggato
//        { completed, steps: { shopify, meta, ga4, klaviyo } }
//  POST → salva un singolo step. Body: { step: 'shopify'|'meta'|'ga4'|'klaviyo',
//         values: {...} }. Valida + salva nella riga companies.
//  PATCH ?action=complete → marca onboarding come completato
// ============================================================================

async function getUserId() {
  const sb = getServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  return user?.id || null
}

const STEP_FIELDS = {
  shopify:  ['shopify_store_url', 'shopify_admin_token'],
  meta:     ['meta_account_id', 'meta_access_token'],
  ga4:      ['ga4_property_id', 'google_client_id', 'google_client_secret', 'google_refresh_token'],
  klaviyo:  ['klaviyo_api_key'],
  omnisend: ['omnisend_api_key'],
}

function stepCompleted(row, step) {
  const fields = STEP_FIELDS[step] || []
  // Per ogni step, almeno il primo campo deve essere popolato per considerarlo "fatto"
  // (es: shopify_store_url e admin_token entrambi richiesti). Logica semplificata:
  // tutti i campi essenziali presenti = completo.
  const required = {
    shopify: ['shopify_store_url', 'shopify_admin_token'],
    meta:    ['meta_access_token'],            // adAccountId opzionale al primo step
    ga4:     ['ga4_property_id', 'google_refresh_token'],
    klaviyo: ['klaviyo_api_key'],
  }[step] || []
  return required.every(f => row?.[f] && String(row[f]).trim().length > 0)
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  const { data, error } = await admin
    .from('companies')
    .select('shopify_store_url, shopify_admin_token, meta_account_id, meta_access_token, ga4_property_id, google_client_id, google_client_secret, google_refresh_token, klaviyo_api_key, onboarding_completed_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const steps = {
    shopify: stepCompleted(data, 'shopify'),
    meta:    stepCompleted(data, 'meta'),
    ga4:     stepCompleted(data, 'ga4'),
    klaviyo: stepCompleted(data, 'klaviyo'),
  }

  return NextResponse.json({
    completed: !!data?.onboarding_completed_at,
    steps,
  })
}

export async function POST(req) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const step = body?.step
  const values = body?.values
  if (!step || !STEP_FIELDS[step]) {
    return NextResponse.json({ error: `step non valido: ${step}` }, { status: 400 })
  }
  if (!values || typeof values !== 'object') {
    return NextResponse.json({ error: 'values mancante' }, { status: 400 })
  }

  // Filtra solo i campi consentiti per lo step
  const allowedFields = STEP_FIELDS[step]
  const updates = {}
  for (const k of allowedFields) {
    if (typeof values[k] === 'string') {
      updates[k] = values[k].trim() || null
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nessun campo valido' }, { status: 400 })
  }

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  const { error } = await admin
    .from('companies')
    .update(updates)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Le nuove credenziali devono valere SUBITO (no stale fino al TTL cache).
  invalidateTenantCache(userId)

  return NextResponse.json({ ok: true, step, saved: Object.keys(updates) })
}

export async function PATCH(req) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'complete') {
    const admin = getAdminSupabase()
    if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

    const { error } = await admin
      .from('companies')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('user_id', userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'skip') {
    // Skip = onboarding completato senza dati. L'utente potra' compilare
    // dopo da Brand Identity. Salviamo il timestamp comunque.
    const admin = getAdminSupabase()
    if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

    const { error } = await admin
      .from('companies')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('user_id', userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, skipped: true })
  }

  return NextResponse.json({ error: 'action non valida (use ?action=complete|skip)' }, { status: 400 })
}
