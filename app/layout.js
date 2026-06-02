import './globals.css'

export const metadata = {
  title: 'LyftAI — Dashboard',
  description: 'LyftAI — analytics LTV, CAC, retention e creative intel per brand Shopify.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
