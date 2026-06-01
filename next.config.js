/** @type {import('next').NextConfig} */
const nextConfig = {
  // puppeteer-core va trattato come external (non bundlato da Next).
  // Lo usiamo solo come client WebSocket verso Browserless.io.
  experimental: {
    serverComponentsExternalPackages: ['puppeteer-core'],
  },
}
module.exports = nextConfig
