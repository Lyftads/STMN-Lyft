const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lyftai.io'

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/welcome'],
        // Aree private/funzionali: non indicizzare.
        disallow: ['/api/', '/onboarding', '/billing-required', '/reset-password', '/auth/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
