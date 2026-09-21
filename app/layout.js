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
import AutoTheme from './components/AutoTheme'
import ViewportFrame from './components/ViewportFrame'
import CookieConsent from './components/CookieConsent'
import { I18nProvider } from '../lib/i18n/I18nProvider'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lyftai.io'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'LyftAI — Dashboard',
  description: 'LyftAI — vendite, pubblicità e margine del tuo negozio Shopify in un conto solo, con un’AI che ti dice cosa fare.',
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
    description: 'Collega Shopify, Meta, Google e le email: LyftAI mette in fila vendite, spesa e margine, e ti dice cosa fare dopo.',
    images: ['/icon-512.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LyftAI — il consulente AI che conosce il tuo brand',
    description: 'Vendite, pubblicità, margine e clienti del tuo negozio Shopify, in un posto solo.',
    images: ['/icon-512.png'],
  },
}

export const viewport = {
  themeColor: '#f5f5f5',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

// Il tema si applica PRIMA del primo disegno, leggendo la scelta salvata: senza, la pagina nasce
// col tema di partenza del CSS (scuro) e poi scatta. Il prodotto parte in CHIARO.
//
// Nel SaaS questo script e <AutoTheme /> mancavano (c'erano solo sul fork, lyft-av): la scelta
// fatta dal pop-up del profilo valeva finche' non si ricaricava la pagina, poi tutto tornava
// scuro — «lo switch del tema da giorno a notte» che non teneva. Trovato il 21 set 2026 rifacendo
// la landing: anche la demo pubblica usciva scura, perche' nessuno applicava il tema.
const themeBootstrap = `
(function () {
  try {
    var savedTheme = localStorage.getItem('lyft-theme');
    var theme = savedTheme === 'auto' ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : (savedTheme === 'dark' ? 'dark' : 'light');
    var root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch (_) {}
})();
`

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: lo script qui sotto cambia data-theme prima che React arrivi.
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ViewportFrame />
        <AutoTheme />
        <I18nProvider>
          {children}
          <CookieConsent />
        </I18nProvider>
        <PWARegister />
      </body>
    </html>
  )
}
