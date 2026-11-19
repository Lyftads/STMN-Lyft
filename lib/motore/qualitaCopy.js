import { chiaveCliente } from './workspace'
// ============================================================================
//  Qualita' della COPY prima di spendere in immagini.
//
//  Due livelli, e la distinzione regge tutto il modulo:
//    · DIFETTI — fatti verificabili in codice: headline troppo lunga, attacco
//      debole, numero che non esiste nei dati, CTA che non e' un'azione. Non
//      si chiede a un modello cio' che si puo' contare.
//    · PUNTEGGIO — cio' che solo un modello giudica: il gancio ferma lo
//      scroll? suona come un cliente o come un brand? scioglie un'esitazione
//      vera? Cinque dimensioni da 1 a 5, totale 25. Sotto 15 non si
//      renderizza: una scena costa venti volte una copy, e giudicare il testo
//      prima di pagare l'immagine e' il risparmio piu' semplice della pipeline.
//
//  Il punteggio si SALVA (ce_creatives.punteggio_copy): serve dopo, quando i
//  numeri veri dicono quali copy hanno reso. Se le copy da 22 rendono come
//  quelle da 16, e' il giudice a sbagliare — vedi lib/calibrazione.js.
// ============================================================================

export const MAX_PAROLE_HEADLINE = 8
export const MAX_PAROLE_SUB = 18
export const MAX_PAROLE_CTA = 3
export const SOGLIA_RENDER = 15
export const DIMENSIONI = ['gancio', 'lingua', 'obiezione', 'chiarezza', 'chiusura']

// Attacchi che non fermano nessuno: articoli, possessivi, imperativi da
// catalogo. La headline e' l'elemento piu' grande della creativita' e deve
// reggere da sola: "Il nostro olio..." e' la prima riga di qualunque sito.
const ATTACCO_DEBOLE = /^(il|lo|la|l'|i|gli|le|un|uno|una|un'|noi|nostro|nostra|nostri|nostre|scopri|approfitta|vivi|assapora|regalati)\b/i

const parole = (s) => String(s || '').trim().split(/\s+/).filter(Boolean)

// "29,90" e "29.9" sono lo stesso numero; "30.000" e' trentamila, non trenta.
function norm(s) {
  s = String(s).trim()
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return s.replace(/\./g, '')
  s = s.replace(',', '.')
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return s
}

// I numeri che la copy PUO' usare: prezzo, misure nel nome e nella specifica
// del prodotto, prove del brand, conteggi delle recensioni. Tutto il resto e'
// inventato, per quanto plausibile suoni.
export function numeriAmmessi({ prodotto, brand, temi = [] } = {}) {
  const testo = [
    // Il nome del brand puo' contenere un numero ("dal 1925"): e' un fatto, non una cifra inventata.
    brand?.nome, prodotto?.name, prodotto?.nome_breve, prodotto?.specifica_fisica,
    brand?.prove ? JSON.stringify(brand.prove) : '',
    ...temi.map(t => `${t.n ?? ''} ${t.citazione || ''}`),
  ].join(' ')
  const set = new Set()
  for (const m of testo.matchAll(/\d+(?:[.,]\d+)?/g)) set.add(norm(m[0]))
  if (prodotto?.price != null && Number.isFinite(Number(prodotto.price))) {
    set.add(norm(String(prodotto.price)))
    set.add(String(Math.round(Number(prodotto.price))))
  }
  return set
}

// I difetti che si contano. Restituisce frasi gia' pronte per il modello: la
// rigenerazione funziona solo se dice ESATTAMENTE cosa non andava.
export function difetti(copy, { ammessi = new Set() } = {}) {
  const out = []
  const h = parole(copy?.headline)
  if (!h.length) out.push('headline mancante')
  else {
    if (h.length > MAX_PAROLE_HEADLINE) out.push(`headline di ${h.length} parole: massimo ${MAX_PAROLE_HEADLINE}`)
    if (ATTACCO_DEBOLE.test(String(copy.headline).trim())) {
      out.push(`headline che comincia con "${h[0]}": articoli, possessivi e imperativi da catalogo non fermano nessuno`)
    }
  }
  const s = parole(copy?.sub)
  if (s.length > MAX_PAROLE_SUB) out.push(`sottotitolo di ${s.length} parole: e' una riga di supporto, massimo ${MAX_PAROLE_SUB}`)
  const c = parole(copy?.cta)
  if (!c.length) out.push('CTA mancante')
  else if (c.length > MAX_PAROLE_CTA) out.push(`CTA di ${c.length} parole: un'azione, massimo ${MAX_PAROLE_CTA}`)

  // Ogni cifra deve venire dai dati. Le piccole quantita' intere (fino a 10)
  // passano — "3 motivi", "2 scatole" sono enumerazioni, non statistiche —
  // ma una percentuale e' sempre una statistica, e va provata.
  const testo = [copy?.headline, copy?.sub, copy?.primary_text].filter(Boolean).join(' ')
  const visti = new Set()
  for (const m of testo.matchAll(/(\d+(?:[.,]\d+)?)(\s*%)?/g)) {
    const grezzo = m[0].trim()
    if (visti.has(grezzo)) continue
    visti.add(grezzo)
    const n = norm(m[1]), pct = !!m[2]
    if (ammessi.has(n)) continue
    if (!pct && Number.isInteger(Number(n)) && Number(n) <= 10) continue
    out.push(`numero "${grezzo}" che non e' fra i dati forniti: non inventare cifre`)
  }
  return out
}

// ---------------------------------------------------------------------------
//  Il punteggio. Cinque dimensioni, ognuna una domanda secca.
//
//  Il modello giudica a temperatura zero e con un metro dichiarato severo:
//  senza, dava 4 a tutto e la soglia non serviva a niente.
//  Se la chiamata fallisce si restituisce l'errore e NON si blocca: un
//  giudizio in meno e' meglio di una creativita' in meno, la stessa regola del
//  cancello MCP sulle immagini.
// ---------------------------------------------------------------------------
function promptGiudice({ brief, prodotto, brand }) {
  return `Sei il direttore creativo che giudica la copy di una statica Meta PRIMA che venga prodotta l'immagine. Scala: 5 = eccellente, da produrre subito · 4 = buona · 3 = accettabile, farebbe il suo lavoro · 2 = debole, non regge la spesa · 1 = da rifare. Il 5 e' raro; il 3 non e' un voto di cortesia: e' una copy che funzionerebbe. Sotto ${SOGLIA_RENDER} su 25 la creativita' non viene prodotta.

BRAND: ${brand?.nome || 'non indicato'}${brand?.tono ? ` — tono: ${brand.tono}` : ''}
PRODOTTO: ${prodotto?.nome_breve || prodotto?.name || 'non indicato'}${prodotto?.price ? ` (€${prodotto.price})` : ''}
ANGOLO: ${brief?.angolo || 'libero'} · FORMATO: ${brief?.formato || 'libero'} · FASE: ${brief?.funnel || 'MOFU'}${brief?.persona ? ` · PARLA A: ${brief.persona}` : ''}

Dai un voto da 1 a 5 a ciascuna dimensione:
1. gancio — la HEADLINE ferma lo scroll in un secondo e mezzo e costringe a leggere il sottotitolo? (e' l'elemento piu' grande: deve reggere da sola)
2. lingua — suona come una persona che parla a un'amica, o come un brand che si descrive?
3. obiezione — nomina e scioglie un'esitazione VERA di chi compra (prezzo, quantita', fiducia, "e' come gli altri")?
4. chiarezza — si capisce subito COSA si compra e PERCHE' questo e non un altro?
5. chiusura — la CTA e' coerente con la fase del funnel e non forza la vendita?

La copy deve rispettare regole FISSE, e la tua correzione deve rispettarle anche lei: headline di massimo ${MAX_PAROLE_HEADLINE} parole che NON comincia con un articolo, un possessivo ("Il nostro...") o un imperativo da catalogo ("Scopri...", "Approfitta..."); nessun numero o percentuale che non stia gia' nella copy o nei dati del prodotto. Una correzione che viola queste regole fa perdere un tentativo.

Rispondi SOLO JSON:
{"gancio":n,"lingua":n,"obiezione":n,"chiarezza":n,"chiusura":n,"verdetto":"una riga","debole":"la dimensione piu' debole","correzione":"come alzarla, una frase concreta"}`
}

export async function punteggioCopy(copy, { brief, prodotto, brand } = {}) {
  const key = chiaveCliente('openai')?.chiave
  if (!key || process.env.COPY_PUNTEGGIO === 'off') return null
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Il giudice ha il suo modello: cambiare lo scrittore non deve cambiare
        // il metro con cui lo si misura, o la taratura confronta mele e pere.
        model: process.env.OPENAI_MODEL_GIUDICE || process.env.OPENAI_MODEL || 'gpt-4o',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: promptGiudice({ brief, prodotto, brand }) },
          { role: 'user', content: `HEADLINE: ${copy.headline}\nSOTTOTITOLO: ${copy.sub || '—'}\nCTA: ${copy.cta}\nTESTO PRIMARIO: ${copy.primary_text || '—'}` },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) return { errore: `giudice HTTP ${res.status}` }
    const j = await res.json()
    const p = JSON.parse(j.choices?.[0]?.message?.content || '{}')
    const voti = {}
    let totale = 0
    for (const d of DIMENSIONI) {
      const v = Math.max(1, Math.min(5, Math.round(Number(p[d]) || 1)))
      voti[d] = v; totale += v
    }
    return {
      ...voti, totale, soglia: SOGLIA_RENDER,
      verdetto: String(p.verdetto || '').slice(0, 200),
      debole: DIMENSIONI.includes(p.debole) ? p.debole : DIMENSIONI.reduce((a, b) => (voti[a] <= voti[b] ? a : b)),
      correzione: String(p.correzione || '').slice(0, 240),
      il: new Date().toISOString(),
    }
  } catch (e) {
    return { errore: String(e?.message || e).slice(0, 140) }
  }
}
