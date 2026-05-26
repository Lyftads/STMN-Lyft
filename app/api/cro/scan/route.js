export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

function extractUsefulContent(html) {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  const title = (html.match(/<title[^>]*>(.*?)<\/title>/i) || [])[1] || ''
  const metaDesc = (html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i) || [])[1] || ''
  const h1s = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, '')).join(' | ')
  const h2s = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gi)].map(m => m[1].replace(/<[^>]+>/g, '')).join(' | ')
  const buttons = [...html.matchAll(/<button[^>]*>(.*?)<\/button>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 10)
  const links = [...html.matchAll(/<a[^>]*>(.*?)<\/a>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(b => b.length > 1).slice(0, 20)
  const images = [...html.matchAll(/<img[^>]*alt=["'](.*?)["']/gi)].map(m => m[1]).filter(Boolean).slice(0, 15)
  const forms = html.match(/<form/gi)?.length || 0
  const inputs = html.match(/<input/gi)?.length || 0

  text = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)

  return `TITLE: ${title}
META DESCRIPTION: ${metaDesc}
H1: ${h1s}
H2: ${h2s}
BUTTONS/CTA: ${buttons.join(', ')}
NAVIGATION LINKS: ${links.join(', ')}
IMAGE ALT TEXTS: ${images.join(', ')}
FORMS: ${forms} | INPUT FIELDS: ${inputs}
BODY TEXT (excerpt): ${text}`
}

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY non configurata' }, { status: 500 })
  }

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }

  const url = body?.url
  if (!url) return NextResponse.json({ error: 'URL mancante' }, { status: 400 })

  let pageContent
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return NextResponse.json({ error: `Pagina non raggiungibile (HTTP ${res.status})` }, { status: 400 })
    const html = await res.text()
    pageContent = extractUsefulContent(html)
  } catch (e) {
    return NextResponse.json({ error: `Impossibile caricare la pagina: ${e.message}` }, { status: 400 })
  }

  const prompt = `Sei un consulente CRO (Conversion Rate Optimization) senior con 15 anni di esperienza in e-commerce fashion/fitness DTC. Parla in italiano. L'utente si chiama Marino, founder di STMN Fitness.

Analizza questa pagina in modo APPROFONDITO e rispondi SOLO con un JSON valido (niente testo prima o dopo, niente markdown).
Sii SPECIFICO e DETTAGLIATO in ogni campo — non scrivere cose generiche. Fai riferimento a elementi concreti della pagina (testi, CTA, immagini, layout).
Fornisci ALMENO 5-8 issues, 3-4 bottlenecks, 5-6 quickWins e 5 recommendations.

{
  "score": 65,
  "verdict": "Giudizio sintetico ma incisivo in una riga",
  "strengths": ["Punto forte specifico 1 con riferimento alla pagina", "Punto forte 2", "Punto forte 3", "Punto forte 4"],
  "issues": [
    {"severity": "critical|high|medium|low", "title": "Titolo chiaro", "description": "Descrizione dettagliata di cosa c'è che non va, con riferimento all'elemento specifico della pagina", "fix": "Soluzione concreta passo-passo: cosa fare, dove farlo, come implementarlo"}
  ],
  "bottlenecks": [
    {"area": "Es: Hero Section / PDP / Navigation / Checkout / Mobile", "problem": "Descrizione specifica del collo di bottiglia", "impact": "Impatto quantificato (es: ~15-20% degli utenti abbandona qui)", "solution": "Soluzione dettagliata e implementabile"}
  ],
  "quickWins": [
    {"action": "Azione specifica e implementabile in <1 giorno", "effort": "low|medium|high", "impact": "low|medium|high", "expectedLift": "+X-Y% su metrica specifica"}
  ],
  "attentionMap": [
    {"area": "Header/Banner", "attention": 95},
    {"area": "Hero Section", "attention": 85},
    {"area": "Primo Fold", "attention": 70},
    {"area": "Secondo Fold", "attention": 50},
    {"area": "Metà Pagina", "attention": 35},
    {"area": "Footer Area", "attention": 15}
  ],
  "recommendations": ["Raccomandazione strategica dettagliata 1", "Raccomandazione 2", "Raccomandazione 3", "Raccomandazione 4", "Raccomandazione 5"]
}

URL: ${url}
CONTENUTO PAGINA:
${pageContent}`

  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!r.ok) {
      const text = await r.text()
      return NextResponse.json({ error: `OpenAI errore ${r.status}` }, { status: 502 })
    }

    const json = await r.json()
    const reply = json?.choices?.[0]?.message?.content || '{}'

    let analysis
    try {
      analysis = JSON.parse(reply)
    } catch {
      return NextResponse.json({ error: 'Risposta AI non valida' }, { status: 500 })
    }

    return NextResponse.json({ url, analysis, model: MODEL })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
