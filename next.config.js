/** @type {import('next').NextConfig} */
const nextConfig = {
  // @sparticuz/chromium e puppeteer-core devono essere trattati come
  // external (non bundlati da Next) altrimenti il binary Chromium si
  // perde durante il file tracing di Vercel.
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  },
  // Vercel bundla solo i file effettivamente referenziati dalla route.
  // Il binary brotli-compresso del Chromium e' caricato a runtime quindi
  // Next non lo include automaticamente — bisogna dirgli esplicitamente.
  outputFileTracingIncludes: {
    '/api/website-scanner': [
      './node_modules/@sparticuz/chromium/**/*',
    ],
  },
}
module.exports = nextConfig
