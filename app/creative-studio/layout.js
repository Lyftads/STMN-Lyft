export const metadata = {
  title: 'Creative Studio',
  icons: { icon: '/creative-studio-logo.svg', apple: '/creative-studio-logo.svg' },
  appleWebApp: {
    capable: true,
    title: 'Creative Studio',
    statusBarStyle: 'black-translucent',
  },
}

export default function CreativeStudioLayout({ children }) {
  return children
}
