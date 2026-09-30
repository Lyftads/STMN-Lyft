export const metadata = {
  title: 'LyftAI — quanto vendi, quanto spendi, quanto ti resta',
  description: 'Vendite, pubblicità e margine del tuo negozio Shopify in un conto solo, con un’AI che ti dice cosa fare. Per negozi e agenzie.',
  alternates: { canonical: 'https://lyftai.io/welcome' },
  openGraph: {
    title: 'LyftAI — quanto vendi, quanto spendi, quanto ti resta',
    description: 'Vendite, pubblicità, margine e clienti del tuo negozio Shopify, in un posto solo.',
    url: 'https://lyftai.io/welcome',
    siteName: 'LyftAI',
  },
}

export default function WelcomeLayout({ children }) {
  return (
    <>
      {/* (30 set) La posa del globo e i puntini dei continenti partono col primo HTML. */}
      <link rel="preload" as="image" href="/landing/globo-posa.webp" fetchPriority="high" />
      <link rel="preload" as="fetch" href="/geo/punti-globo.bin" crossOrigin="anonymous" />
      {children}
    </>
  )
}
