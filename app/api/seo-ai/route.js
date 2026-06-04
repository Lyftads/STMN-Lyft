export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 45

import { NextResponse } from 'next/server'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const UA = 'Mozilla/5.0 (compatible; LyftAI-SEO/1.0; +https://lyftai.io)'

async function chat(system, user) {
  const r = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL, temperature: 0.5, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  })
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return JSON.parse((await r.json()).choices?.[0]?.message?.content || '{}')
}

// estrae title + heading + estratto testo da una URL (per il brief editoriale)
async function pageDigest(url) {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000)
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: ctrl.signal })
    clearTimeout(t)
    const html = await res.text()
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/\s+/g, ' ').trim() || ''
    const headings = [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 25)
    const text = (html.match(/<body[\s\S]*?<\/body>/i) || [html])[0].replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return { url, title, headings, words: text ? text.split(' ').length : 0, excerpt: text.slice(0, 1200) }
  } catch { return { url, error: true } }
}

export async function POST(request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY non configurata.' }, { status: 500 })
  let body = {}
  try { body = await request.json() } catch {}
  const mode = body.mode

  try {
    // ---- 1) KEYWORD AI (à la Neil Patel) --------------------------------
    if (mode === 'keyword') {
      const kw = (body.keyword || '').trim()
      if (!kw) return NextResponse.json({ error: 'keyword mancante' }, { status: 400 })
      const data = await chat(
        `Sei un keyword strategist SEO senior (e-commerce). Italiano. Per una keyword restituisci SOLO JSON:
{"keyword":"...","intent":"informativo|commerciale|transazionale|navigazionale","intentNote":"breve","difficulty":{"level":"bassa|media|alta","note":"perché"},"volumeHint":"stima qualitativa (es. medio-alto in IT)","aiOverview":{"likely":true|false,"note":"perché Google mostrerebbe o no un AI Overview"},"related":[{"term":"...","intent":"..."}],"questions":["domanda PAA",...],"contentIdeas":[{"title":"titolo articolo/pagina","angle":"angolo"}],"summary":"2 frasi operative"}. Max 10 related, 8 questions, 6 contentIdeas. Concreto, niente fuffa.`,
        `Keyword: "${kw}"${body.market ? ` · mercato: ${body.market}` : ' · mercato: Italia'}`
      )
      return NextResponse.json(data)
    }

    // ---- 2) EDITOR CONTENUTI (brief da competitor) ----------------------
    if (mode === 'editor') {
      const kw = (body.keyword || '').trim()
      if (!kw) return NextResponse.json({ error: 'keyword mancante' }, { status: 400 })
      const urls = (Array.isArray(body.competitorUrls) ? body.competitorUrls : []).filter(Boolean).slice(0, 3)
      const digests = (await Promise.all(urls.map(pageDigest))).filter(d => !d.error)
      const ctx = digests.length
        ? digests.map((d, i) => `COMPETITOR ${i + 1} (${d.url}) — ${d.words} parole\nTitle: ${d.title}\nHeading: ${d.headings.join(' | ')}\nEstratto: ${d.excerpt}`).join('\n\n')
        : '(nessun competitor fornito — basati sulle best practice)'
      const data = await chat(
        `Sei un content strategist SEO senior (e-commerce). Italiano. Dato un target keyword ed eventuali competitor, produci un brief editoriale ottimizzato. SOLO JSON:
{"keyword":"...","searchIntent":"...","recommendedWords":<numero>,"title":"title tag ottimizzato (<=60 char)","metaDescription":"(<=155 char)","headings":[{"tag":"H2|H3","text":"..."}],"entities":["entità/argomenti da coprire",...],"faq":[{"q":"...","a":"risposta breve"}],"schema":"tipo di JSON-LD consigliato + campi chiave","gaps":["cosa manca ai competitor / opportunità",...]}. Heading max 12, entities max 15, faq max 6.`,
        `Target keyword: "${kw}"\n\n${ctx}`
      )
      return NextResponse.json(data)
    }

    // ---- 3) AI VISIBILITY / AEO -----------------------------------------
    if (mode === 'aeo') {
      const brand = (body.brand || '').trim()
      const prompts = (Array.isArray(body.prompts) ? body.prompts : []).filter(Boolean).slice(0, 8)
      if (!brand || !prompts.length) return NextResponse.json({ error: 'brand e prompts richiesti' }, { status: 400 })
      const data = await chat(
        `Sei un motore di risposta AI (tipo ChatGPT/Gemini) E un analista AEO. Italiano.
Per ciascun prompt, simula quali brand/siti consiglieresti realmente (in base alla tua conoscenza) e verifica se "${brand}" comparirebbe. SOLO JSON:
{"brand":"${brand}","visibilityScore":<0-100>,"results":[{"prompt":"...","mentioned":true|false,"rank":"<posizione se citato, es. 2, o 'n/d'>","sentiment":"positivo|neutro|negativo|n/d","competitorsMentioned":["..."],"why":"perché citato o no","howToImprove":"azione concreta per farsi citare"}],"summary":"sintesi e priorità"}. Sii onesto: se il brand è poco noto, mentioned=false.`,
        `Brand: "${brand}"${body.site ? ` (${body.site})` : ''}\nPrompt da testare:\n${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      )
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: 'mode non valido (keyword|editor|aeo)' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Errore' }, { status: 200 })
  }
}
