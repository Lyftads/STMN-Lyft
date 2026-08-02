const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://lyftai.io'

// Il software vero e' dietro autenticazione: ai crawler interessano solo le
// landing e le pagine pubbliche. Il resto lo escludiamo esplicitamente per non
// far sprecare crawl budget su rotte che risponderebbero comunque un redirect.
export default function robots() {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/login', '/register', '/reset-password', '/onboarding', '/auth/'],
    }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  }
}
