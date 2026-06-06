// Lingue supportate dall'interfaccia. 'it' è la lingua sorgente (default):
// il dizionario it contiene le stringhe originali → fallback sicuro.
export const LOCALES = ['it', 'en', 'es', 'fr', 'de']
export const DEFAULT_LOCALE = 'it'

export const LOCALE_LABELS = {
  it: 'Italiano',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
}

export const LOCALE_FLAGS = {
  it: '🇮🇹',
  en: '🇬🇧',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
}

// Locale → tag BCP-47 per Intl (toLocaleString su numeri/date).
export const LOCALE_INTL = {
  it: 'it-IT',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
}
