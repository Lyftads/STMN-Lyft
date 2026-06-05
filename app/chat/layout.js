export const metadata = {
  title: 'LyftAI Chat',
  manifest: '/chat-manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'LyftAI Chat',
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
