export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

async function fetchPageContent(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()
    return html.slice(0, 30000)
  } catch {
    return null
  }
}

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY non configurata' }, { status: 500 })
  }

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }

  const url = body?.url
  if (!url) return NextResponse.json({ error: 'URL mancante' }, { status: 400 })

  const html = await fetchPageContent(url)
  if (!html) return NextResponse.json({ error: 'Impossibile caricare la pagina' }, { status: 400 })

  const prompt = `Sei un esperto CRO (Conversion Rate Optimization) senior con 15 anni di esperienza in e-commerce.

Analizza questa pagina web e fornisci un report dettagliato in italiano. L'utente si chiama Marino.

URL: ${url}

Rispondi ESATTAMENTE in questo formato JSON (niente markdown, solo JSON puro):
{
  "score": <numero da 1 a 100>,
  "verdict": "<giudizio sintetico in una riga>",
  "strengths": ["<punto forte 1>", "<punto forte 2>", "<punto forte 3>"],
  "issues": [
    {"severity": "critical|high|medium|low", "title": "<titolo>", "description": "<cosa c'è che non va>", "fix": "<come risolverlo concretamente>"},
    ...
  ],
  "bottlenecks": [
    {"area": "<area del funnel>", "problem": "<il problema>", "impact": "<impatto stimato>", "solution": "<soluzione>"},
    ...
  ],
  "quickWins": [
    {"action": "<azione>", "effort": "low|medium|high", "impact": "low|medium|high", "expectedLift": "<es. +5-10% conversion>"},
    ...
  ],
  "recommendations": ["<raccomandazione strategica 1>", "<raccomandazione 2>", "<raccomandazione 3>"]
}

Analizza: struttura della pagina, UX/UI, copy, CTA, trust signals, velocità percepita, mobile readiness, accessibilità, SEO on-page, psicologia della conversione. Sii specifico e pratico nelle soluzioni.`

  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        messages: [
          { role: 'user', content: prompt },
          { role: 'user', content: `HTML della pagina (troncato):\n${html}` },
        ],
      }),
    })

    if (!r.ok) {
      const text = await r.text()
      return NextResponse.json({ error: `OpenAI ${r.status}: ${text.slice(0, 300)}` }, { status: 502 })
    }

    const json = await r.json()
    let reply = json?.choices?.[0]?.message?.content || ''

    reply = reply.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let analysis
    try { analysis = JSON.parse(reply) } catch {
      return NextResponse.json({ error: 'Risposta AI non parsabile', raw: reply.slice(0, 500) }, { status: 500 })
    }

    return NextResponse.json({ url, analysis, model: MODEL })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
