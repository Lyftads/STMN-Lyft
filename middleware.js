import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// Next.js middleware: gira su OGNI request matchata dal `matcher` sotto.
// Refresha la sessione Supabase (rinnova token) e redirecta a /login se
// l'utente non e' autenticato e sta cercando di accedere a una route
// protetta.

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/reset-password',
  '/reset-password/confirm',
  '/auth/callback',
]

export async function middleware(request) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))

  let response = NextResponse.next({ request: { headers: request.headers } })

  // Supabase non configurato (env mancanti) → lascia passare, non rompere
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: NON usare logica tra createServerClient() e auth.getUser()
  // Altrimenti la sessione non viene refreshata correttamente.
  const { data: { user } } = await supabase.auth.getUser()

  // Se non autenticato e route protetta → redirect a /login
  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Se gia' autenticato e cerca /login o /register → redirect alla dashboard
  if (user && (pathname === '/login' || pathname === '/register')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    // Salta API routes (gestiscono auth da soli) + Next static + image opt
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
