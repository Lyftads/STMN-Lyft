// Mappa paese (ISO-3166 alpha-2) → locale supportato.
// Usata SOLO come fallback di auto-rilevamento quando la lingua del browser non
// è disponibile/utile. Locale supportati: it | en | es | fr | de. Default 'it'.

import { LOCALES, DEFAULT_LOCALE } from './locales'

const COUNTRY_LOCALE = {
  // Italiano
  IT: 'it', SM: 'it', VA: 'it',
  // Spagnolo (Spagna + LatAm principali)
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es',
  EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es',
  SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es', PR: 'es',
  // Francese
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr', SN: 'fr', CI: 'fr',
  // Tedesco
  DE: 'de', AT: 'de', CH: 'de', LI: 'de',
  // Inglese
  GB: 'en', US: 'en', IE: 'en', AU: 'en', NZ: 'en', CA: 'en', ZA: 'en',
  IN: 'en', SG: 'en',
}

// Normalizza una lingua del browser (es. "es-ES", "pt-BR") al locale supportato.
export function browserToLocale(navLang) {
  if (!navLang) return null
  const base = String(navLang).toLowerCase().split('-')[0]
  return LOCALES.includes(base) ? base : null
}

// Mappa un country code al locale supportato (o null se non mappato).
export function countryToLocale(cc) {
  if (!cc) return null
  const loc = COUNTRY_LOCALE[String(cc).toUpperCase()]
  return loc && LOCALES.includes(loc) ? loc : null
}

export { DEFAULT_LOCALE }
