// ============================================================================
//  pickEnum — confronto TOLLERANTE fra il valore di enum prodotto da un LLM e
//  la lista dei valori ammessi.
//
//  Perche' esiste: i modelli restituiscono regolarmente la stessa enum con
//  maiuscole o spazi diversi da quelli chiesti nel prompt ("Meta" invece di
//  "meta", " OUTCOME_SALES"). Un controllo `ALLOWED.includes(v)` secco non
//  fallisce in modo visibile: a seconda del sito o degrada il valore a un
//  fallback (l'azione finisce nel canale sbagliato) o SCARTA la riga (la
//  raccomandazione sparisce). In entrambi i casi l'utente vede un output
//  plausibile e sbagliato, senza alcun errore.
//
//  Confronto case-insensitive; ritorna sempre il valore CANONICO preso da
//  `allowed` (cosi' il resto del codice continua a confrontare con ===), o
//  `fallback` se non c'e' corrispondenza.
//
//  Verificato sul banco di prova modelli del 1/8/2026: era il modo di fallire
//  piu' frequente sia dei modelli locali sia, occasionalmente, di gpt-4o.
// ============================================================================

export function pickEnum(value, allowed, fallback = null) {
  const v = String(value ?? '').trim().toLowerCase()
  if (!v) return fallback
  const hit = (allowed || []).find(a => String(a).trim().toLowerCase() === v)
  return hit === undefined ? fallback : hit
}
