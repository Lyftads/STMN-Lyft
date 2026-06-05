export const metadata = {
  title: 'LyftTalk',
  manifest: '/chat-manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'LyftTalk',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/chat-192.png',
    apple: '/chat-180.png',
  },
}

export default function ChatLayout({ children }) {
  return children
}
