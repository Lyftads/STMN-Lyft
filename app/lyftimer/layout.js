export const metadata = {
  title: 'Lyftimer',
  manifest: '/lyftimer-manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Lyftimer',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/lyftimer-192.png',
    apple: '/lyftimer-180.png',
  },
}

export default function LyftimerLayout({ children }) {
  return children
}
