import { NextResponse } from 'next/server'
import { callBrain } from '../../../lib/agent/gateway'
import { requireCaller } from '../../../lib/tenant/credentials'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// OPENAI_KEY serve ancora alla generazione immagine (gpt-image-1/dall-e-3) qui sotto.
const OPENAI_KEY = process.env.OPENAI_API_KEY

const SYSTEM = `Sei un Senior Creative Strategist. Il brand per cui lavori — categoria, catalogo, target, tono di voce — e' descritto nel CONTESTO BRAND che ricevi: usa SOLO quello. Non dare per scontato il settore e non inventare prodotti che non compaiono nel contesto.

Ti viene dato il testo di un'inserzione ATTIVA (di un concorrente o trovata in Ad Library). Devi fare REVERSE-ENGINEERING: capire perche' funziona e produrre un adattamento ON-BRAND — non copiare, ma riadattare l'angolo a un prodotto del brand che sia coerente.

Rispondi SOLO con JSON valido (nessun testo fuori dal JSON), in questa forma:
{
  "sourceAngle": "<l'angolo/leva persuasiva dell'ad originale, 1 frase>",
  "whyItWorks": "<perche' funziona: hook, formato, leva psicologica (Cialdini/Fogg), 1-2 frasi>",
  "product": "<quale prodotto del brand usare per riadattarlo, preso dal contesto>",
  "angle": "<l'angolo on-brand, 1 frase>",
  "hook": "<hook/prima riga ad alto impatto>",
  "primaryTexts": ["<variante copy 1>", "<variante 2>", "<variante 3>"],
  "headline": "<headline breve>",
  "visualBrief": "<direzione visiva dello scatto: soggetto, ambientazione, luce, mood, coerenti col brand>",
  "imagePrompt": "<prompt in INGLESE per generare un'immagine pubblicitaria fotorealistica on-brand; specifica prodotto, soggetto, ambientazione, luce, composizione, niente testo nell'immagine>"
}

Regole: copy concreti e performance-driven, coerenti con il tono di voce del brand, niente claim medici o promesse di risultato non verificabili. Sii specifico e azionabile.`

async function generateImage(prompt) {
  if (!OPENAI_KEY) return { error: 'OPENAI_API_KEY non configurata' }
  // gpt-image-1 → fallback dall-e-3
  for (const model of ['gpt-image-1', 'dall-e-3']) {
    try {
      const body = model === 'gpt-image-1'
        ? { model, prompt, size: '1024x1024' }
        : { model, prompt, size: '1024x1024', response_format: 'url' }
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(55000),
      })
      const json = await res.json()
      if (json.error) continue
      const d = json.data?.[0]
      const url = d?.url || (d?.b64_json ? `data:image/png;base64,${d.b64_json}` : null)
      if (url) return { url, model }
    } catch { /* prova il prossimo modello */ }
  }
  return { error: 'Generazione immagine fallita' }
}

export async function POST(req) {
  // Gate: route a pagamento (AI/PDF/voce) — mai anonima.
  const _gate = await requireCaller(req); if (_gate) return _gate
  if (!OPENAI_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY non configurata' }, { status: 500 })
  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  // Modalità 2: genera solo l'immagine da un prompt già pronto
  if (body?.generateImage && body?.imagePrompt) {
    const img = await generateImage(String(body.imagePrompt).slice(0, 1000))
    if (img.error) return NextResponse.json({ error: img.error }, { status: 502 })
    return NextResponse.json({ imageUrl: img.url, model: img.model })
  }

  // Modalità 1: reverse-engineering → brief on-brand
  const ad = body?.ad || {}
  const adText = [
    ad.pageName ? `Brand: ${ad.pageName}` : '',
    ad.title ? `Titolo: ${ad.title}` : '',
    Array.isArray(ad.bodies) && ad.bodies[0] ? `Copy: ${ad.bodies[0]}` : (ad.body ? `Copy: ${ad.body}` : ''),
  ].filter(Boolean).join('\n')

  if (!adText) return NextResponse.json({ error: 'Nessun testo dall\'inserzione da analizzare' }, { status: 400 })

  try {
    let res
    try {
      // Tool mode: il CONTESTO BRAND (+ memorie e knowledge) arriva da callBrain,
      // non piu' hardcoded nel prompt. Stesso tier 'smart' di prima.
      res = await callBrain({
        skill: { id: 'creative', json: true, systemPrompt: SYSTEM },
        query: 'creative strategy hook angoli copy advertising adattamento on-brand',
        messages: [{ role: 'user', content: `Inserzione attiva da riadattare on-brand:\n\n${adText}` }],
        locale: body?.locale,
        conversation: false,
        temperature: 0.6,
      })
    } catch (e) {
      return NextResponse.json({ error: `OpenAI ${e?.status || ''}: ${(e?.message || '').slice(0, 200)}` }, { status: 502 })
    }
    let brief
    try { brief = res?.parsed || JSON.parse(res?.content || '{}') } catch { brief = null }
    if (!brief) return NextResponse.json({ error: 'Risposta non valida' }, { status: 502 })
    return NextResponse.json({ brief, updatedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Errore OpenAI' }, { status: 500 })
  }
}
