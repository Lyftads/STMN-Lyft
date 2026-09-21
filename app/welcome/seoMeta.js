const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://lyftai.io'

// Titolo e descrizione che compaiono NEI RISULTATI di ricerca, per lingua.
// Non sono le stringhe della pagina: hanno un mestiere diverso (stare nei
// ~60/155 caratteri di Google e far cliccare), quindi vivono separate.
export const SEO = {
  it: {
    title: 'LyftAI — Quanto vendi, quanto spendi, quanto ti resta',
    description: 'Vendite, spesa pubblicitaria e margine da Shopify, Meta, Google e email in un conto solo, e un’AI che ti dice cosa fare dopo. Per brand Shopify e agenzie.',
  },
  en: {
    title: 'LyftAI — What you sell, what you spend, what you keep',
    description: 'Sales, ad spend and margin from Shopify, Meta, Google and email in one place, and an AI that tells you what to do next. For Shopify brands and agencies.',
  },
  es: {
    title: 'LyftAI — Cuánto vendes, cuánto gastas, cuánto te queda',
    description: 'Ventas, gasto publicitario y margen de Shopify, Meta, Google y email, todo junto, y una IA que te dice qué hacer después. Para marcas Shopify y agencias.',
  },
  fr: {
    title: 'LyftAI — Ce que vous vendez, dépensez et ce qu’il vous reste',
    description: 'Ventes, budget pub et marge de Shopify, Meta, Google et email au même endroit, et une IA qui vous dit quoi faire ensuite. Pour marques Shopify et agences.',
  },
  de: {
    title: 'LyftAI — Was du verkaufst, ausgibst und was dir bleibt',
    description: 'Umsatz, Werbekosten und Marge aus Shopify, Meta, Google und E-Mail an einem Ort, plus eine KI für den nächsten Schritt. Für Shopify-Marken und Agenturen.',
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
      // L'anteprima nei link condivisi e' il prodotto vero, nella lingua della pagina.
      images: [{ url: `/landing/${lang}/dashboard.webp`, width: 1920, height: 1200 }],
    },
    twitter: { card: 'summary_large_image', title: s.title, description: s.description, images: [`/landing/${lang}/dashboard.webp`] },
  }
}
