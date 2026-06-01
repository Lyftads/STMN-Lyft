import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

// Microlink screenshot service: rispetta query string (variant=…), gestisce
// redirect, supporta header Accept-Language. Free tier ~50 req/giorno.
function buildMicrolinkUrl(target, { embed = false } = {}) {
  let url = target.trim()
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  const params = new URLSearchParams({
    url,
    screenshot: 'true',
    meta: 'false',
    'viewport.width': '1440',
    'viewport.height': '1800',
    'viewport.deviceScaleFactor': '1',
    waitUntil: 'networkidle0',
    headers: JSON.stringify({
      'Accept-Language': 'it-IT,it;q=0.9,en;q=0.6',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }),
  })
  if (embed) params.set('embed', 'screenshot.url')
  return `https://api.microlink.io/?${params.toString()}`
}

// Scarica lo screenshot e lo converte in data URL base64 così OpenAI
// non deve fetchare nulla (evita timeout)
async function fetchScreenshotAsDataUrl(target) {
  const url = buildMicrolinkUrl(target, { embed: true })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 35000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timer)
    if (!res.ok) {
      throw new Error(`Microlink ${res.status}: ${res.statusText}`)
    }
    const contentType = res.headers.get('content-type') || 'image/png'
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0) throw new Error('Screenshot vuoto')
    return {
      dataUrl: `data:${contentType};base64,${buf.toString('base64')}`,
      publicUrl: url, // per il preview client
      bytes: buf.length,
    }
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

const SYSTEM_PROMPT = `Sei un Senior CRO Specialist con 10+ anni di esperienza in ottimizzazione conversione e-commerce e landing page. Hai lavorato per brand DTC con fatturati 7-8 figure. La tua analisi è basata su:

- Heuristic evaluation framework (Nielsen, ConversionXL, Baymard Institute)
- Persuasion principles (Cialdini: reciprocity, scarcity, authority, social proof, commitment, liking)
- Cognitive load theory (Hick's Law, Fitts' Law, F-pattern reading)
- E-commerce best practices: above-the-fold value proposition, trust signals, friction reduction, CTA hierarchy, urgency, social proof, FAQ posizionate, prezzi chiari, garanzie
- Mobile-first patterns (anche se lo screenshot è desktop, considera implicazioni mobile)
- UX writing e copywriting persuasivo
- Visual hierarchy, white space, typography, color contrast (WCAG)
- Page speed signals visibili (immagini ottimizzate, layout shift)
- Conversion funnel design

## Compito
Analizzi lo SCREENSHOT di una landing page o pagina prodotto fornito da Marino, founder di STMN Fitness (e-commerce accessori CrossFit). Restituisci un'analisi CRO PROFESSIONALE, AZIONABILE, CON ESEMPI CONCRETI. Marino deve poter modificare la pagina basandosi sui tuoi insight senza dover chiedere chiarimenti.

## Output (DEVE essere JSON valido con questa struttura esatta)
{
  "overallScore": <numero 0-100 score CRO complessivo>,
  "scoreLabel": "<etichetta breve: 'Eccellente' / 'Buono' / 'Da ottimizzare' / 'Critico'>",
  "summary": "<2-3 frasi panoramica generale onesta>",
  "firstImpression": "<descrivi cosa vede un visitatore nei primi 3 secondi: hero, claim, CTA principale, trust signals visibili>",
  "works": [
    {
      "title": "<elemento che funziona>",
      "details": "<perché funziona dal punto di vista CRO, riferimento al principio (es. social proof, F-pattern, ecc.)>",
      "impact": "<low|medium|high>"
    }
  ],
  "improve": [
    {
      "title": "<elemento da migliorare>",
      "current": "<descrizione precisa di cosa c'è ora nella pagina>",
      "suggestion": "<azione concreta e specifica con valori reali — es. 'Cambia CTA da \\"Compra ora\\" a \\"Compra ora con il 15% di sconto · Spedizione gratis\\" e usa #FF3B30 invece del grigio attuale'>",
      "example": "<esempio testuale del nuovo copy / del nuovo elemento>",
      "priority": "<low|medium|high|critical>",
      "expectedImpact": "<stima realistica: es. '+0.5-1.5pp CR' / '+15% click-through CTA' / '-20% bounce rate'>"
    }
  ],
  "remove": [
    {
      "title": "<elemento da rimuovere o ridurre>",
      "reason": "<perché aumenta friction o cognitive load o riduce conversione>",
      "alternative": "<cosa metterci al posto, se serve qualcosa>"
    }
  ],
  "quickWins": [
    "<azione veloce e ad alto impatto, max 1 frase>",
    "<azione 2>",
    "<azione 3>",
    "<azione 4>",
    "<azione 5>"
  ],
  "ctaAnalysis": {
    "primaryCta": "<copy attuale del CTA principale, se visibile>",
    "position": "<sopra/sotto la fold + commento posizione>",
    "contrast": "<basso/medio/alto>",
    "verdict": "<2 frasi sulla qualità complessiva del CTA>"
  },
  "trustSignals": {
    "present": ["<lista trust signals visibili nello screenshot>"],
    "missing": ["<lista trust signals importanti che non vedi e dovrebbero esserci>"]
  },
  "copyAnalysis": {
    "headline": "<copy dell'headline principale + verdetto>",
    "valueProposition": "<chiara | confusa | assente + spiegazione>",
    "tone": "<descrivi il tono e se è coerente con il target>"
  }
}

## Regole inviolabili
- TUTTI gli esempi devono essere SPECIFICI (con copy preciso, colori esadecimali, posizioni esatte, numeri reali)
- MAI generico ("migliora il CTA"). SEMPRE "Cambia il CTA 'X' in 'Y' perché Z, aspettati impatto W"
- Identifica SEMPRE almeno 3 cose che funzionano, 3 da migliorare, 1-3 da rimuovere
- L'overallScore deve essere onesto: solo le pagine eccellenti meritano >85
- Concentrati su CRO, NON su SEO, performance tecnica o branding generico
- Se vedi placeholder/lorem ipsum/immagini stock generiche, evidenziali
- Considera il target STMN: atleti CrossFit, functional fitness, home gym intermedio/avanzato. NIENTE supplementi
- Italiano professionale, asciutto, da consulente senior
- Output SOLO JSON valido, niente markdown wrapping, niente preamboli`

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY non configurata.' }, { status: 500 })
  }

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const targetUrl = (body?.url || '').trim()
  if (!targetUrl) {
    return NextResponse.json({ error: 'URL mancante.' }, { status: 400 })
  }

  // Validazione URL minimale
  let normalized = targetUrl
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized
  try { new URL(normalized) } catch {
    return NextResponse.json({ error: 'URL non valido.' }, { status: 400 })
  }

  // URL per il preview client (il browser fetcha direttamente)
  const previewUrl = buildMicrolinkUrl(normalized, { embed: true })

  // Scarico io l'immagine e la passo a OpenAI come base64 → niente timeout
  let dataUrl
  try {
    const shot = await fetchScreenshotAsDataUrl(normalized)
    dataUrl = shot.dataUrl
  } catch (err) {
    return NextResponse.json({
      error: `Impossibile catturare lo screenshot: ${err?.message || 'errore'}. Verifica che l'URL sia accessibile pubblicamente.`,
      screenshotUrl: previewUrl,
    }, { status: 502 })
  }

  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        top_p: 0.9,
        response_format: { type: 'json_object' },
        max_tokens: 4000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analizza CRO questa landing page.\nURL: ${normalized}\nCliente: STMN Fitness — e-commerce accessori CrossFit (paracalli, polsiere, corde da salto, tape adesivo nero, ginocchiere). Target: atleti CrossFit intermedio/avanzato, home gym.\n\nLo screenshot in allegato è la versione desktop italiana della pagina. Fornisci analisi dettagliata in JSON secondo lo schema specificato.`,
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl, detail: 'high' },
              },
            ],
          },
        ],
      }),
    })

    if (!r.ok) {
      const text = await r.text()
      return NextResponse.json({
        error: `OpenAI ${r.status}: ${text.slice(0, 300)}`,
        screenshotUrl: previewUrl,
      }, { status: 502 })
    }

    const json = await r.json()
    const raw = json?.choices?.[0]?.message?.content || ''
    let analysis = null
    try { analysis = JSON.parse(raw) } catch {
      return NextResponse.json({
        screenshotUrl: previewUrl,
        url: normalized,
        analysis: null,
        rawText: raw,
        error: 'Analisi non parseable come JSON',
      }, { status: 200 })
    }

    return NextResponse.json({
      url: normalized,
      screenshotUrl: previewUrl,
      analysis,
      usage: json?.usage || null,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({
      error: err?.message || 'Errore scansione',
      screenshotUrl: previewUrl,
    }, { status: 500 })
  }
}
