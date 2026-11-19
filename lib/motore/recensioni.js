import { clienteMotore } from './workspace'
// ============================================================================
//  Le recensioni come fonte degli angoli.
//
//  Gli angoli si decidono su quello che le persone dicono davvero, non su
//  quello che sembra buono a noi. Una cosa ripetuta in novanta recensioni è un
//  angolo già validato dal mercato: se non esiste una creatività che la dice,
//  quello è un buco — e vale più di un'idea nuova.
//
//  I temi NEGATIVI si conservano apposta. Non diventano angoli: dicono cosa
//  NON promettere. Vantare la consegna veloce mentre qualche pacco arriva
//  aperto è il modo di trasformare una recensione tiepida in una furiosa.
// ============================================================================

const OPENAI = 'https://api.openai.com/v1/chat/completions'

async function chiedi(prompt, chiave, temperatura = 0.2) {
  const r = await fetch(OPENAI, {
    method: 'POST',
    headers: { Authorization: `Bearer ${chiave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o', temperature: temperatura,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const j = await r.json()
  if (!j.choices?.[0]) throw new Error(`openai: ${JSON.stringify(j).slice(0, 180)}`)
  return JSON.parse(j.choices[0].message.content)
}

const riga = (r, i) => `[${i}] ${r.stelle}★ ${(r.titolo || '').trim()} — ${(r.testo || '').replace(/\s+/g, ' ').slice(0, 280)}`

// Passo 1: da un campione si ricava la TASSONOMIA dei temi.
export async function trovaTemi(recensioni, chiave, campione = 120) {
  const c = recensioni.slice(0, campione)
  const out = await chiedi(
`Ecco ${c.length} recensioni di ${clienteMotore()?.descrizione || 'un negozio che vende online'}.

Raggruppale in TEMI RICORRENTI: cosa dicono davvero le persone, con le loro parole.
Preferisci temi SPECIFICI a temi generici: "arriva in 48 ore" dice più di "buon servizio".
Punta a 8-14 temi. Non inventarne che non ci sono.
Includi i temi NEGATIVI se presenti: servono a sapere cosa non promettere.

Per ogni tema: slug (MAIUSCOLO-CON-TRATTINI), nome (2-4 parole), descrizione (una frase),
sentiment (positivo|negativo|misto), citazione (VERBATIM dalle recensioni, breve),
angolo (l'angolo pubblicitario che ne deriva, MAIUSCOLO-CON-TRATTINI; per i temi
negativi metti null: un problema non è un angolo).

Rispondi SOLO con JSON: {"temi":[...]}

${c.map(riga).join('\n')}`, chiave)
  return out.temi || []
}

// Passo 2: OGNI recensione viene assegnata ai temi che tocca.
//
// Serve perché i conteggi stimati a occhio escono a numeri tondi — 150, 100,
// 90 — e su numeri tondi non si decide niente. Se un tema pesa il 45% o il 12%
// cambia se valga la pena produrci sopra.
export async function assegnaTemi(recensioni, temi, chiave, lotto = 25) {
  const elenco = temi.map(t => `${t.slug}: ${t.descrizione}`).join('\n')
  const per = new Map()
  for (let i = 0; i < recensioni.length; i += lotto) {
    const c = recensioni.slice(i, i + lotto)
    try {
      const out = await chiedi(
`Temi disponibili:
${elenco}

Assegna a ogni recensione i temi che tocca (da zero a tre). Usa SOLO gli slug elencati.
Rispondi SOLO con JSON: {"assegnazioni":[{"i":0,"temi":["SLUG",...]},...]}

${c.map((r, k) => riga(r, k)).join('\n')}`, chiave, 0)
      for (const a of (out.assegnazioni || [])) {
        const r = c[a.i]; if (!r) continue
        per.set(r.id, (a.temi || []).filter(s => temi.some(t => t.slug === s)))
      }
    } catch { /* un lotto perso non deve far cadere l'analisi intera */ }
  }
  return per
}

// Sotto questa quota un tema non diventa un brief: due recensioni su duecento
// non sono un segnale, sono due recensioni.
export const QUOTA_MINIMA = 0.05

// Quale angolo GIÀ IN PRODUZIONE copre ogni tema.
//
// Il confronto non può essere testuale. "OLIO-DI-ALTA-QUALITA" e "QUALITA"
// sono la stessa cosa e nessun confronto fra stringhe se ne accorge: il motore
// annunciava buchi inesistenti — "nessuna creatività lo dice" su un angolo con
// undici creatività attive. Un output plausibile e falso è peggio di nessun
// output, perché ci si produce sopra.
// `angoliInUso` sono oggetti {slug, esempi:[headline]}: si giudica su COSA
// DICONO le creatività, non sul nome dell'angolo. Col solo nome il modello ha
// dato per coperta la consegna rapida perché esisteva un angolo "URGENZA" —
// che però dice "Non aspettare, olio pronto", cioè urgenza d'acquisto, e di
// spedizione non parla affatto. Giudicare un angolo dalla sua etichetta è come
// giudicare un libro dal titolo.
export async function mappaSuAngoli(temi, angoliInUso, chiave) {
  if (!temi.length || !angoliInUso.length) return temi
  const descrizione = angoliInUso.map(a => {
    const es = (a.esempi || []).filter(Boolean).slice(0, 3)
    return `- ${a.slug}${es.length ? `: dice cose come ${es.map(e => `"${e}"`).join(', ')}` : ' (nessuna creatività con testo)'}`
  }).join('\n')
  const out = await chiedi(
`Angoli comunicativi GIÀ in produzione, con quello che dicono davvero:
${descrizione}

Temi ricavati dalle recensioni:
${temi.map(t => `${t.slug} — ${t.descrizione}`).join('\n')}

Per ogni tema dimmi quale angolo esistente lo copre GIÀ. Giudica da quello che
le creatività DICONO, non dal nome dell'angolo: un angolo chiamato "URGENZA"
che dice "non aspettare, ordina ora" NON copre il tema della consegna veloce,
perché parla di fretta nell'acquisto e non di tempi di spedizione.
Se nessun angolo lo copre davvero, metti null.
Sbagliare in un senso fa produrre creatività doppie; sbagliare nell'altro fa
perdere un argomento che i clienti citano di continuo. Non forzare in nessuna
delle due direzioni.

Rispondi SOLO con JSON: {"mappa":[{"tema":"SLUG","coperto_da":"ANGOLO oppure null"}]}`, chiave, 0)
  // Il modello a volte scrive la STRINGA "null" invece del valore nullo, e
  // "null" || null vale "null": una stringa piena, quindi ogni tema risultava
  // «coperto da null» e l'elenco degli scoperti usciva sempre vuoto. Un bug
  // che non dà errore e restituisce zero — il modo migliore di non accorgersene.
  const vuoto = (v) => {
    const t = String(v ?? '').trim().toLowerCase()
    return !t || t === 'null' || t === 'none' || t === 'nessuno' || t === 'nessun angolo' || t === '-'
  }
  const per = new Map((out.mappa || []).map(m => [m.tema, vuoto(m.coperto_da) ? null : m.coperto_da]))
  return temi.map(t => ({ ...t, copertoDa: per.get(t.slug) ?? null }))
}

// I temi che nessun angolo in produzione copre. È il punto dell'esercizio.
export function temiScoperti(temi) {
  return temi
    .filter(t => t.sentiment !== 'negativo' && t.angolo)
    .filter(t => !t.copertoDa)
    .filter(t => (t.quota || 0) >= QUOTA_MINIMA)
    .sort((a, b) => (b.n || 0) - (a.n || 0))
}
