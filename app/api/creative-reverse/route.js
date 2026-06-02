import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM = `Sei un Senior Creative Strategist di STMN Fitness (Stamina Fitness), brand di accessori CrossFit di alta qualità: paracalli/grips, polsiere, corde da salto, fasce, ginocchiere, cinture. NIENTE supplementi/integratori/nutrizione. Target: atleti CrossFit/functional/home gym in IT, FR, EU. Tono: pratico, no-bullshit, performance-driven.

Ti viene dato il testo di un'inserzione ATTIVA (di un competitor o trovata in Ad Library). Devi fare REVERSE-ENGINEERING: capire perché funziona e produrre un adattamento ON-BRAND per STMN — non copiare, ma riadattare l'angolo a un prodotto STMN coerente.

Rispondi SOLO con JSON valido (nessun testo fuori dal JSON), in questa forma:
{
  "sourceAngle": "<l'angolo/leva persuasiva dell'ad originale, 1 frase>",
  "whyItWorks": "<perché funziona: hook, formato, leva psicologica (Cialdini/Fogg), 1-2 frasi>",
  "stmnProduct": "<quale prodotto STMN usare per riadattarlo (es. paracalli, corda, polsiere)>",
  "angle": "<l'angolo on-brand per STMN, 1 frase>",
  "hook": "<hook/prima riga ad alto impatto in italiano>",
  "primaryTexts": ["<variante copy 1 IT>", "<variante 2>", "<variante 3>"],
  "headline": "<headline breve IT>",
  "visualBrief": "<direzione visiva dello scatto/video: soggetto, ambientazione, luce, mood>",
  "imagePrompt": "<prompt in INGLESE per generare un'immagine pubblicitaria fotorealistica on-brand del prodotto STMN; specifica prodotto, atleta CrossFit, ambientazione box/home gym, luce, composizione, niente testo nell'immagine>"
}

Regole: copy in italiano, concreti e performance-driven, nessun integratore/nutrizione, niente claim medici. Sii specifico e azionabile.`

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
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Inserzione attiva da riadattare on-brand per STMN:\n\n${adText}` },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) {
      const t = await res.text()
      return NextResponse.json({ error: `OpenAI ${res.status}: ${t.slice(0, 200)}` }, { status: 502 })
    }
    const json = await res.json()
    let brief
    try { brief = JSON.parse(json?.choices?.[0]?.message?.content || '{}') } catch { brief = null }
    if (!brief) return NextResponse.json({ error: 'Risposta non valida' }, { status: 502 })
    return NextResponse.json({ brief, updatedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Errore OpenAI' }, { status: 500 })
  }
}
