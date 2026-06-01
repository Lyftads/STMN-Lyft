import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

// thum.io: screenshot gratuito senza API key. Restituisce direttamente
// l'immagine; il browser e OpenAI vision possono usarla come URL diretto.
function buildScreenshotUrl(target, { width = 1440 } = {}) {
  let url = target.trim()
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  // Crop fissa a 2400px così non scarichiamo pagine smisurate
  return `https://image.thum.io/get/width/${width}/crop/2400/${url}`
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

  const screenshotUrl = buildScreenshotUrl(normalized)

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
                text: `Analizza CRO questa landing page.\nURL: ${normalized}\nCliente: STMN Fitness — e-commerce accessori CrossFit (paracalli, polsiere, corde da salto, tape adesivo nero, ginocchiere). Target: atleti CrossFit intermedio/avanzato, home gym.\n\nFornisci analisi dettagliata in JSON secondo lo schema specificato.`,
              },
              {
                type: 'image_url',
                image_url: { url: screenshotUrl, detail: 'high' },
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
        screenshotUrl,
      }, { status: 502 })
    }

    const json = await r.json()
    const raw = json?.choices?.[0]?.message?.content || ''
    let analysis = null
    try { analysis = JSON.parse(raw) } catch {
      // fallback: ritorna il testo grezzo se non parseable
      return NextResponse.json({
        screenshotUrl,
        url: normalized,
        analysis: null,
        rawText: raw,
        error: 'Analisi non parseable come JSON',
      }, { status: 200 })
    }

    return NextResponse.json({
      url: normalized,
      screenshotUrl,
      analysis,
      usage: json?.usage || null,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({
      error: err?.message || 'Errore scansione',
      screenshotUrl,
    }, { status: 500 })
  }
}
