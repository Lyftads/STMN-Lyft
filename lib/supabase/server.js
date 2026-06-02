import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-side Supabase client per API routes e Server Components.
// Legge la sessione utente dai cookie di Next.js.
export function getServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Chiamato da Server Component — Next.js non permette set() lì
            // ma e' OK se c'e' il middleware che refresha le sessioni.
          }
        },
      },
    }
  )
}

// Admin client con service_role key — bypass RLS, usalo SOLO server-side
// per operazioni amministrative (es. webhook Stripe che scrive su qualsiasi
// company senza il contesto utente).
import { createClient } from '@supabase/supabase-js'
let adminClient = null
export function getAdminSupabase() {
  if (adminClient) return adminClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return adminClient
}
