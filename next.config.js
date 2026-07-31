/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        // frame-ancestors 'self': l'iframe /demo della landing resta permesso
        { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
      ],
    }]
  },
  // puppeteer-core va trattato come external (non bundlato da Next).
  // Lo usiamo solo come client WebSocket verso Browserless.io.
  experimental: {
    serverComponentsExternalPackages: ['puppeteer-core'],
  },
}
module.exports = nextConfig
