// ============================================================================
//  Lingua di OUTPUT per gli AI agent (server-side).
//
//  I system prompt degli agent restano in italiano (e i dati live pure): qui
//  iniettiamo SOLO un'istruzione finale che impone all'LLM di rispondere nella
//  lingua del cliente. Numeri, nomi prodotto/campagna e metriche restano invariati.
//
//  Regola di sicurezza: per locale 'it' (o sconosciuto) → null → nessun cambiamento
//  (zero rischio per i clienti italiani / STMN).
// ============================================================================

import { LOCALES, DEFAULT_LOCALE } from './locales'

const LANG_NAME = {
  it: 'italiano',
  en: 'English',
  es: 'español',
  fr: 'français',
  de: 'Deutsch',
}

// Istruzione scritta nella lingua target (più affidabile del darla in italiano).
const DIRECTIVE = {
  en: 'CRITICAL OUTPUT LANGUAGE: Reply ONLY in English. Every part of your output — text, headings, bullet points, recommendations, labels — must be in English, even though the data and the instructions above are in Italian. Do NOT translate or alter: product names, brand names, campaign names, metric names, URLs, and numbers/percentages (keep them exactly as in the data).',
  es: 'IDIOMA DE SALIDA CRÍTICO: Responde SOLO en español. Todo tu output —texto, títulos, viñetas, recomendaciones, etiquetas— debe estar en español, aunque los datos y las instrucciones anteriores estén en italiano. NO traduzcas ni alteres: nombres de producto, marca, campaña, nombres de métricas, URLs ni números/porcentajes (déjalos exactamente como en los datos).',
  fr: "LANGUE DE SORTIE CRITIQUE : Réponds UNIQUEMENT en français. Tout ton output — texte, titres, puces, recommandations, libellés — doit être en français, même si les données et les instructions ci-dessus sont en italien. NE traduis PAS et NE modifie PAS : noms de produit, de marque, de campagne, noms de métriques, URLs et nombres/pourcentages (laisse-les exactement comme dans les données).",
  de: 'KRITISCHE AUSGABESPRACHE: Antworte NUR auf Deutsch. Dein gesamter Output — Text, Überschriften, Aufzählungen, Empfehlungen, Labels — muss auf Deutsch sein, obwohl die Daten und die Anweisungen oben auf Italienisch sind. Übersetze oder ändere NICHT: Produkt-, Marken-, Kampagnennamen, Metriknamen, URLs und Zahlen/Prozentwerte (lasse sie exakt wie in den Daten).',
}

// Normalizza/valida un locale (es. "en-US" → "en"); ritorna null se non supportato.
export function normalizeLocale(loc) {
  if (!loc) return null
  const base = String(loc).toLowerCase().split('-')[0]
  return LOCALES.includes(base) ? base : null
}

// Catena: locale dal body del client → lingua company (DB) → default 'it'.
export function resolveAiLocale(bodyLocale, companyLanguage) {
  return normalizeLocale(bodyLocale) || normalizeLocale(companyLanguage) || DEFAULT_LOCALE
}

// Messaggio `system` (stringa) che impone la lingua di output.
// Ritorna null per 'it'/sconosciuto → l'agent resta identico a prima.
export function aiLangDirective(locale) {
  const loc = normalizeLocale(locale)
  if (!loc || loc === 'it') return null
  return DIRECTIVE[loc] || null
}

// Comodo: oggetto messaggio pronto da spingere in `messages` (o null).
export function aiLangSystemMessage(locale) {
  const content = aiLangDirective(locale)
  return content ? { role: 'system', content } : null
}

export { LANG_NAME }
