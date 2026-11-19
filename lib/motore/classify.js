import { chiaveCliente } from './workspace'
import sharp from 'sharp'
import { NOMI_FORMATI, FORMATI } from './formati'

// Il CDN di Meta risponde 403 ai fetcher esterni: OpenAI NON riesce a scaricare
// le immagini da un URL scontent.*.fbcdn.net, anche se sono pubbliche.
// Vanno scaricate qui e passate come dati. Si ridimensionano a 640px prima di
// spedirle: per riconoscere angolo e formato basta, e un PNG da 1MB per 134
// creatività sarebbe banda e costo buttati.
async function immagineInline(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) throw new Error(`immagine HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const jpg = await sharp(buf).resize(640, 640, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78 }).toBuffer()
  return `data:image/jpeg;base64,${jpg.toString('base64')}`
}

// Legge l'angolo comunicativo GUARDANDO la creatività, non solo il copy.
// Su queste inserzioni l'angolo vive soprattutto nell'immagine: headline
// stampate sopra, contesto d'uso, confronti, bollini. Classificare dal solo
// testo del copy avrebbe letto metà del messaggio.
//
// Per i VIDEO si dispone di un solo fotogramma (la thumbnail Meta): la
// classificazione è dichiarata come tale, perché un frame non racconta un video.
const SISTEMA = `Sei un analista di creatività pubblicitarie DTC. Ti vengono mostrati l'IMMAGINE di
un'inserzione Meta e il suo testo. Devi capire l'ANGOLO COMUNICATIVO che usa.

Guarda l'immagine con attenzione: il testo stampato sopra, cosa mostra, come è composta,
che emozione o obiezione tocca. Spesso l'angolo vero è nell'immagine, non nel copy.

ANGOLO = la leva persuasiva, non l'argomento. 1-2 parole in MAIUSCOLO senza spazi.
Esempi: CONVENIENZA, ORIGINE, QUALITA, ANTI-FRODE, GARANZIA, PRATICITA, HERITAGE,
PROVA-SOCIALE, URGENZA, SALUTE, REGALO, SCORTA.
Riusa gli angoli già in uso quando il senso coincide: servono a raggruppare la spesa,
non a distinguere ogni singola creatività.

FORMATO visivo, uno di:
${FORMATI.map(f => `- ${f[0]} (${f[1]}): ${f[2]}`).join('\n')}

FUNNEL: TOFU (attira sconosciuti), MOFU (educa/convince), BOFU (chiude).
PERSONA: a chi parla, 1-3 parole (es. FAMIGLIA, SMART-SHOPPER, DIFFIDENTE, GOURMET).

PRODOTTO: quale prodotto del catalogo è mostrato. Guarda la confezione: formato, colore,
nome stampato sopra. Se non lo riconosci con ragionevole certezza metti null — un prodotto
sbagliato falsa l'allocazione del budget, che è peggio di un campo vuoto.

Se l'immagine non è leggibile o non basta a capirlo, metti null e abbassa la confidenza.
Non tirare a indovinare: su queste etichette si decide cosa produrre.

Rispondi SOLO JSON:
{"angolo":"...","formato":"...","funnel":"...","persona":"...","descrizione_visiva":"cosa si vede, 1 frase","prodotto_slug":"...|null","confidenza":0-1}`

export async function classificaLotto(creativita, angoliNoti = [], catalogo = []) {
  const key = chiaveCliente('openai')?.chiave
  if (!key) throw new Error('ChatGPT non collegato: inserisci la chiave nella tab Integrazioni')
  const modello = process.env.OPENAI_VISION_MODEL || 'gpt-4o'
  const out = []

  for (const c of creativita) {
    const src = c.storage_url || c.thumb_url
    if (!src) { out.push({ id: c.id, angolo: null, motivo: 'nessuna immagine' }); continue }
    let img
    try { img = await immagineInline(src) }
    catch (e) { out.push({ id: c.id, angolo: null, motivo: `immagine: ${e.message}` }); continue }

    const testo = [
      c.name ? `Nome inserzione: ${c.name}` : '',
      c.headline ? `Titolo: ${c.headline}` : '',
      c.body ? `Copy: ${c.body}` : '',
      c.description ? `Descrizione: ${c.description}` : '',
      c.cta ? `CTA: ${c.cta}` : '',
      c.media_type === 'video'
        ? 'ATTENZIONE: è un VIDEO e stai vedendo UN SOLO FOTOGRAMMA. Giudica con prudenza e abbassa la confidenza.'
        : '',
    ].filter(Boolean).join('\n') || '(nessun testo disponibile: giudica dall\'immagine)'

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modello,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SISTEMA },
            ...(angoliNoti.length ? [{ role: 'system', content: `Angoli già in uso: ${angoliNoti.join(', ')}` }] : []),
            ...(catalogo.length ? [{ role: 'system', content:
              `Catalogo prodotti (usa lo slug esatto, o null se non riconosci):\n`
              + catalogo.map(p => `- ${p.slug}: ${p.name}`).join('\n') }] : []),
            { role: 'user', content: [
              { type: 'text', text: testo },
              { type: 'image_url', image_url: { url: img, detail: 'low' } },
            ] },
          ],
        }),
        signal: AbortSignal.timeout(60000),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        out.push({ id: c.id, angolo: null, motivo: `openai ${res.status}: ${t.slice(0, 90)}` })
        continue
      }
      const j = await res.json()
      let p = {}
      try { p = JSON.parse(j.choices?.[0]?.message?.content || '{}') } catch {}
      out.push({
        id: c.id,
        angolo: p.angolo || null,
        formato: NOMI_FORMATI.includes(p.formato) ? p.formato : null,
        funnel: ['TOFU','MOFU','BOFU'].includes(p.funnel) ? p.funnel : null,
        persona: p.persona || null,
        descrizione: p.descrizione_visiva || null,
        confidenza: typeof p.confidenza === 'number' ? p.confidenza : null,
        prodotto: p.prodotto_slug || null,
        base: c.media_type === 'video' ? 'fotogramma' : 'immagine',
      })
    } catch (e) {
      out.push({ id: c.id, angolo: null, motivo: e?.message?.slice(0, 90) || 'errore' })
    }
  }
  return out
}
