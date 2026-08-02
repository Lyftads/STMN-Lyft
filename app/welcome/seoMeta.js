const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://lyftai.io'

// Titolo e descrizione che compaiono NEI RISULTATI di ricerca, per lingua.
// Non sono le stringhe della pagina: hanno un mestiere diverso (stare nei
// ~60/155 caratteri di Google e far cliccare), quindi vivono separate.
export const SEO = {
  it: {
    title: 'LyftAI — il consulente AI per il tuo brand Shopify',
    description: 'Collega Shopify, Meta, Google e le email: LyftAI legge i tuoi dati e ti dice dove stai crescendo e dove stai bruciando budget. Per brand e-commerce e agenzie.',
  },
  en: {
    title: 'LyftAI — the AI advisor for your Shopify brand',
    description: 'Connect Shopify, Meta, Google and email: LyftAI reads your data and tells you where you are growing and where you are burning budget. For e-commerce brands and agencies.',
  },
  es: {
    title: 'LyftAI — el consultor con IA para tu marca Shopify',
    description: 'Conecta Shopify, Meta, Google y el email: LyftAI lee tus datos y te dice dónde estás creciendo y dónde estás quemando presupuesto. Para marcas de e-commerce y agencias.',
  },
  fr: {
    title: 'LyftAI — le consultant IA pour votre marque Shopify',
    description: 'Connectez Shopify, Meta, Google et vos emails : LyftAI lit vos données et vous dit où vous progressez et où vous brûlez du budget. Pour les marques e-commerce et les agences.',
  },
  de: {
    title: 'LyftAI — der KI-Berater für deine Shopify-Marke',
    description: 'Verbinde Shopify, Meta, Google und E-Mail: LyftAI liest deine Daten und zeigt dir, wo du wächst und wo du Budget verbrennst. Für E-Commerce-Marken und Agenturen.',
  },
}

// URL per lingua. L'italiano resta su /welcome (era gia' l'indirizzo pubblico,
// linkato e indicizzato: cambiarlo avrebbe buttato via quel poco di storico).
export const LANG_PATH = { it: '/welcome', en: '/en', es: '/es', fr: '/fr', de: '/de' }

// hreflang: dice a Google che queste cinque pagine sono LA STESSA pagina in
// lingue diverse. Senza, le versioni si fanno concorrenza tra loro e ne indicizza
// una sola. x-default = dove mandare chi non rientra in nessuna delle cinque.
export function landingMetadata(lang) {
  const s = SEO[lang] || SEO.it
  const languages = Object.fromEntries(Object.entries(LANG_PATH).map(([l, p]) => [l, SITE + p]))
  return {
    title: s.title,
    description: s.description,
    alternates: {
      canonical: SITE + LANG_PATH[lang],
      languages: { ...languages, 'x-default': SITE + LANG_PATH.en },
    },
    openGraph: {
      type: 'website',
      siteName: 'LyftAI',
      url: SITE + LANG_PATH[lang],
      title: s.title,
      description: s.description,
      locale: { it: 'it_IT', en: 'en_US', es: 'es_ES', fr: 'fr_FR', de: 'de_DE' }[lang],
      images: ['/icon-512.png'],
    },
    twitter: { card: 'summary_large_image', title: s.title, description: s.description, images: ['/icon-512.png'] },
  }
}
