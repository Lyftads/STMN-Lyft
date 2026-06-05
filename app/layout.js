import './globals.css'
import PWARegister from './components/PWARegister'

export const metadata = {
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
        {children}
        <PWARegister />
      </body>
    </html>
  )
}
