// Scrubber PII per i dati che entrano nei prompt LLM (rete di sicurezza).
// Default: rimuove SOLO le email (zero falsi positivi sui numeri/metriche).
// I telefoni sono opt-in (phones:true) perché i pattern numerici rischiano di
// intercettare date/ID/metriche: da usare solo su testo libero, non su metriche.

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
// Telefoni: SOLO formati con prefisso internazionale esplicito (+..) per non
// toccare numeri di metriche/date.
const PHONE_RE = /\+\d[\d ().\-]{7,}\d/g

export function scrubPII(value, opts = {}) {
  const phones = !!opts.phones
  if (value == null) return value
  if (typeof value === 'string') {
    let out = value.replace(EMAIL_RE, '[email]')
    if (phones) out = out.replace(PHONE_RE, '[tel]')
    return out
  }
  if (Array.isArray(value)) return value.map(v => scrubPII(v, opts))
  if (typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value)) out[k] = scrubPII(value[k], opts)
    return out
  }
  return value
}
