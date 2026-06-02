'use client'

import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client (per pagine 'use client').
// Usa la anon key — RLS protegge i dati a livello DB.
let cachedClient = null
export function getBrowserSupabase() {
  if (cachedClient) return cachedClient
  cachedClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  return cachedClient
}
