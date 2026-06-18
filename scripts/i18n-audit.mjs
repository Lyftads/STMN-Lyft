#!/usr/bin/env node
// Audit i18n: trova stringhe italiane user-facing HARDCODED (non in t(), non commenti).
//   node scripts/i18n-audit.mjs            → lista file:linea:testo
//   node scripts/i18n-audit.mjs --count    → solo conteggio per file
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DIRS = ['app/components', 'app']
const SKIP = /node_modules|i18n\/dictionaries|content\.translations|\.next/

// Parole italiane "forti" (poco ambigue) + accenti.
const IT_WORDS = /\b(seleziona|scegli|salva|salvo|salvato|modifica|elimina|aggiungi|nessun[ao]?|errore|genera|genero|carica|carico|caricato|conferma|annulla|cerca|invia|inviato|impostazioni|azienda|aziende|prodotto|prodotti|cliente|clienti|periodo|giorni|settimana|mese|anno|oggi|ieri|attiv[oai]|disattiv|collegat|scollegat|aggiorna|chiudi|apri|indietro|avanti|successivo|precedente|caricamento|attendere|riprova|esempio|nuovo|nuova|tutti|tutte|nessuno|spesa|ricav|vendite|acquist|ordini|fattur|abbonament|pagament|gratis|gratuito|mostra|nascondi|copia|copiato|scarica|esporta|importa|elaborazione|in corso|completato|fallito|disponibile|richiesto|obbligatorio|facoltativo)\b/i
const ACCENT = /[àèéìòùÀÈÉÌÒÙ]/

function stripComments(src) {
  // rimuove /* */ e // (grezzo, sufficiente per heuristica)
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => {
    const i = l.indexOf('//')
    // non togliere // dentro stringhe/url: solo se // preceduto da spazio o inizio
    if (i >= 0 && !/https?:$/.test(l.slice(0, i))) {
      // euristica: se prima del // non ci sono apici aperti dispari, taglia
      const before = l.slice(0, i)
      const q = (before.match(/['"`]/g) || []).length
      if (q % 2 === 0) return before
    }
    return l
  })
}

function looksItalian(s) { return ACCENT.test(s) || IT_WORDS.test(s) }

// È plausibilmente user-facing? JSX text >...<, oppure attributi placeholder/title/label/alt/aria-label,
// oppure stringhe passate a setError/alert/toast.
function candidates(line) {
  const out = []
  // JSX text node
  for (const m of line.matchAll(/>([^<>{}]*[A-Za-zàèéìòù][^<>{}]*)</g)) {
    const t = m[1].trim()
    if (t && looksItalian(t)) out.push(t)
  }
  // attributi/stringhe note
  for (const m of line.matchAll(/(placeholder|title|label|alt|aria-label|setError|alert|confirm)\s*[=(]\s*['"]([^'"]+)['"]/g)) {
    if (looksItalian(m[2])) out.push(m[2])
  }
  return out
}

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (SKIP.test(p)) continue
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(jsx|js)$/.test(e.name) && !/route\.js$/.test(e.name)) acc.push(p)
  }
}

const files = []
for (const d of DIRS) { const full = path.join(ROOT, d); if (fs.existsSync(full)) walk(full, files) }
const uniq = [...new Set(files)]

const countOnly = process.argv.includes('--count')
const perFile = []
for (const f of uniq) {
  const src = fs.readFileSync(f, 'utf8')
  const lines = stripComments(src)
  const hits = []
  lines.forEach((l, i) => {
    if (l.includes('t(')) return // riga che usa t() → probabilmente già tradotta
    for (const c of candidates(l)) hits.push({ line: i + 1, text: c })
  })
  if (hits.length) perFile.push({ file: path.relative(ROOT, f), hits })
}

perFile.sort((a, b) => b.hits.length - a.hits.length)
let total = 0
for (const pf of perFile) {
  total += pf.hits.length
  if (countOnly) console.log(`${String(pf.hits.length).padStart(3)}  ${pf.file}`)
  else { console.log(`\n### ${pf.file} (${pf.hits.length})`); for (const h of pf.hits) console.log(`  ${h.line}: ${h.text.slice(0, 90)}`) }
}
console.log(`\nTOTALE: ${total} stringhe in ${perFile.length} file`)
