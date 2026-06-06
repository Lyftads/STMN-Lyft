'use client'

// ============================================================================
//  i18n leggero e a prova di errore per la dashboard (client-heavy, SPA-like).
//
//  - Locale di default = 'it' (lingua sorgente). Il dizionario it contiene le
//    stringhe ORIGINALI → quando locale='it' l'output è identico a prima.
//  - t(key, vars, fallback): cerca key nella lingua attiva → poi in italiano →
//    poi `fallback` → poi la key stessa. Una traduzione mancante mostra
//    l'italiano, MAI una stringa vuota o un crash.
//  - Nessun routing per locale (niente /en/...): la lingua sta in stato React +
//    localStorage, e (best-effort) sul profilo per il binding "per cliente".
// ============================================================================

import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { LOCALES, DEFAULT_LOCALE, LOCALE_INTL } from './locales'
import it from './dictionaries/it'
import en from './dictionaries/en'
import es from './dictionaries/es'
import fr from './dictionaries/fr'
import de from './dictionaries/de'

const DICTS = { it, en, es, fr, de }
const STORAGE_KEY = 'lyft_lang'

const I18nContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (k, _v, fb) => fb ?? k,
  intlLocale: LOCALE_INTL[DEFAULT_LOCALE],
})

export function I18nProvider({ children, initialLocale }) {
  // SSR e primo render client = DEFAULT_LOCALE → nessun mismatch di idratazione.
  const [locale, setLocaleState] = useState(
    initialLocale && LOCALES.includes(initialLocale) ? initialLocale : DEFAULT_LOCALE
  )

  // Dopo il mount: se non forzato da prop, leggi la preferenza salvata.
  useEffect(() => {
    if (initialLocale) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && LOCALES.includes(saved)) setLocaleState(saved)
    } catch {}
  }, [initialLocale])

  const setLocale = useCallback((next) => {
    if (!LOCALES.includes(next)) return
    setLocaleState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    // Persisti sul profilo (per-cliente) — best effort, non blocca nulla.
    try {
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: next }),
      }).catch(() => {})
    } catch {}
    if (typeof document !== 'undefined') {
      try { document.documentElement.lang = next } catch {}
    }
  }, [])

  const t = useCallback((key, vars, fallback) => {
    const active = DICTS[locale] || DICTS[DEFAULT_LOCALE]
    let str = active[key]
    if (str == null) str = DICTS[DEFAULT_LOCALE][key]
    if (str == null) str = fallback != null ? fallback : key
    if (vars) {
      for (const k of Object.keys(vars)) {
        str = str.split(`{${k}}`).join(String(vars[k]))
      }
    }
    return str
  }, [locale])

  const value = { locale, setLocale, t, intlLocale: LOCALE_INTL[locale] || LOCALE_INTL[DEFAULT_LOCALE] }
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}

// Hook comodo quando serve solo la funzione di traduzione.
export function useT() {
  return useContext(I18nContext).t
}
