import './globals.css'
// Il sistema di design portato da lyft-av: sei fogli, nell'ordine in cui si scavalcano.
import './tema-chiaro.css'
import './white-system.css'
import './theme-controls.css'
import './component-system.css'
import './lyft-system.css'
import './mobile-system.css'
// Resta per ULTIMO: tiene le poche regole per telefono che qui servono ancora e che in lyft-av
// non esistono piu' (.kb-metric-row, che il KPI Brain di questo repo usa tuttora).
import './mobile-report.css'
import PWARegister from './components/PWARegister'
import CookieConsent from './components/CookieConsent'
import { I18nProvider } from '../lib/i18n/I18nProvider'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lyftai.io'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'LyftAI — Dashboard',
  description: 'LyftAI — analytics LTV, CAC, retention e creative intel per brand Shopify.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'LyftAI',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-180.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'LyftAI',
    url: SITE_URL,
    title: 'LyftAI — il consulente AI che conosce il tuo brand',
    description: 'Connetti Shopify, Meta e Klaviyo. LyftAI legge i tuoi dati e ogni mattina ti dice dove crescere e dove stai bruciando budget.',
    images: ['/icon-512.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LyftAI — il consulente AI che conosce il tuo brand',
    description: 'Analytics, ads, SEO e AI advisor per brand Shopify, in un\'unica piattaforma.',
    images: ['/icon-512.png'],
  },
}

export const viewport = {
  themeColor: '#0b0b14',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>
        <I18nProvider>
          {children}
          <CookieConsent />
        </I18nProvider>
        <PWARegister />
      </body>
    </html>
  )
}
