/** @type {import('next').NextConfig} */
const nextConfig = {
  // @sparticuz/chromium e puppeteer-core devono essere trattati come
  // external (non bundlati da Next) altrimenti il binary Chromium si
  // perde durante il file tracing di Vercel.
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium-min', 'puppeteer-core'],
  },
}
module.exports = nextConfig
