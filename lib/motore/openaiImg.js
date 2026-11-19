import { chiaveCliente } from './workspace'
// ============================================================================
//  Generazione delle scene con gpt-image-2 (OpenAI).
//
//  Sostituisce Higgsfield. Provato il 3 settembre 2026 sullo stesso prodotto,
//  con lo stesso prompt e lo stesso packshot di riferimento:
//
//    - la cima della bag esce CHIUSA E PIATTA, senza la maniglia inventata che
//      il cliente aveva bocciato due volte
//    - due scatole quando il prodotto e' un due pezzi, non una
//    - il testo stampato e' quello vero, "BAG IN BOX" e "5 L e" leggibili
//    - la scala rispetto alla persona in scena e' giusta al primo colpo
//    - 0,023-0,026 dollari a immagine, contro 3 crediti Higgsfield
//
//  IL FORMATO, che era il punto in cui poteva rompersi: gpt-image-1 accetta
//  solo 1024x1024, 1024x1536 e 1536x1024 — niente 9:16, e per il verticale
//  avremmo dovuto ritagliare, cioe' rischiare di tagliare il prodotto.
//  gpt-image-2 accetta QUALUNQUE dimensione con entrambi i lati multipli di 16,
//  quindi 1008x1792 e' un 9:16 esatto e il problema non esiste.
//
//  Due cose che gpt-image-2 NON ha: `input_fidelity` (lo rifiuta) e un endpoint
//  asincrono. La generazione e' sincrona e prende 18-25 secondi.
// ============================================================================

// 9:16 e 1:1 esatti, con i lati multipli di 16 come pretende il modello.
export const DIMENSIONI = { '1x1': '1024x1024', '9x16': '1008x1792' }

// Le tariffe pubblicate per milione di token, per stimare quanto costa un giro.
// E' una stima dichiarata: l'API restituisce i token, non gli euro.
const TARIFFE = { testoIn: 5, immagineIn: 10, immagineOut: 40 }

export function costoStimato(usage) {
  if (!usage) return null
  const t = usage.input_tokens_details?.text_tokens || 0
  const i = usage.input_tokens_details?.image_tokens || 0
  const o = usage.output_tokens || 0
  return (t * TARIFFE.testoIn + i * TARIFFE.immagineIn + o * TARIFFE.immagineOut) / 1e6
}

async function scarica(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) })
  if (!r.ok) throw new Error(`packshot HTTP ${r.status}`)
  const tipo = r.headers.get('content-type') || 'image/jpeg'
  return { buf: Buffer.from(await r.arrayBuffer()), tipo }
}

// Restituisce { buffer, usage, costo }. Il buffer, non un URL: a differenza di
// Higgsfield qui l'immagine torna nel corpo della risposta, e va messa su
// Storage da chi chiama.
// La qualita' predefinita e' MEDIUM, e non e' un risparmio a occhio: misurata
// sullo stesso prompt e sullo stesso packshot, sul 9:16 verticale —
//
//   low      19s   $0,023   testo del packaging sgranato
//   medium   39s   $0,067   cima chiusa, due scatole, testo giusto, scala giusta
//   high     94s   $0,215   differenza che non si vede in un feed
//
// E i 94 secondi contano quanto i soldi: la funzione ha un tetto di 300, e con
// due formati e i ritentativi di scala alta non ci si sta.
export async function generaScena({ prompt, riferimenti = [], ratio = '9x16', qualita = process.env.OPENAI_IMAGE_QUALITY || 'medium', chiave = chiaveCliente('openai')?.chiave }) {
  if (!chiave) throw new Error('ChatGPT non collegato: inserisci la chiave nella tab Integrazioni')
  const size = DIMENSIONI[ratio]
  if (!size) throw new Error(`formato non gestito: ${ratio}`)

  const form = new FormData()
  // gpt-image-2.5-sunburst dal 17 settembre 2026, scelto da Marino sulla
  // stessa scena Saracino con lo stesso packshot: 21s e $0,028 contro 35s e
  // $0,065 di gpt-image-2, e la scritta piccola del packaging ("100%
  // italiano") resa nitida dove gpt-image-2 la sfocava e flare la ometteva.
  // Stesso endpoint, stesse dimensioni multiple di 16, stesso `image[]`.
  form.append('model', process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst')
  form.append('prompt', prompt)
  form.append('size', size)
  form.append('quality', qualita)

  // Senza packshot il modello disegna un prodotto generico: e' il difetto gia'
  // visto in produzione, dove nella scena del frantoio compariva un cartone
  // marrone qualunque al posto della bag.
  const usati = riferimenti.filter(Boolean).slice(0, 4)
  if (!usati.length) throw new Error('nessun packshot di riferimento: la scena uscirebbe con un prodotto inventato')
  for (const u of usati) {
    const { buf, tipo } = await scarica(u)
    form.append('image[]', new Blob([buf], { type: tipo }), 'packshot.jpg')
  }

  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chiave}` },
    body: form,
    // Sincrona e lenta: 18-25 secondi nella prova, ma un timeout stretto
    // trasformerebbe una generazione riuscita in un errore e in un credito
    // speso per niente.
    signal: AbortSignal.timeout(180000),
  })
  const testo = await r.text()
  if (!r.ok) {
    let m = testo
    try { m = JSON.parse(testo).error?.message || testo } catch {}
    throw new Error(`OpenAI immagini ${r.status}: ${String(m).slice(0, 220)}`)
  }
  const j = JSON.parse(testo)
  const b64 = j.data?.[0]?.b64_json
  if (!b64) throw new Error('risposta senza immagine')
  return { buffer: Buffer.from(b64, 'base64'), usage: j.usage, costo: costoStimato(j.usage) }
}
