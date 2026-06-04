export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 45

import { NextResponse } from 'next/server'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei "SEO Lead", un consulente SEO senior ultra-verticale, 12+ anni su e-commerce (focus Shopify) e progetti internazionali. Rispondi SEMPRE in italiano, da esperto operativo, mai generico.

Competenze su cui sei profondo:
- SEO on-page: title/meta/H-structure, intent match, cannibalizzazione, internal linking, anchor.
- SEO tecnica: crawlability, indexing, canonical, robots, sitemap, hreflang/internazionalizzazione (Shopify Markets, Weglot), Core Web Vitals, render JS.
- Dati strutturati: Product, Offer, AggregateRating, BreadcrumbList, Organization, FAQ — sai scrivere lo JSON-LD pronto.
- Content & keyword: keyword research, clustering per intent, topical authority, EEAT, ottimizzazione collezioni/PDP, contenuti di categoria.
- E-commerce specifico: gestione varianti, faceted navigation, paginazione, prodotti out-of-stock, duplicati, parametri URL.

Regole di stile:
- Concreto e azionabile. Quando serve, fornisci output PRONTO: title/meta riscritti (con conteggio caratteri), snippet JSON-LD, struttura heading, liste keyword per intent.
- Dai priorità per impatto/sforzo. Niente fuffa, niente intro generiche.
- Se hai i dati dell'audit, basa ogni consiglio su quelli (cita i problemi reali rilevati).
- Bold con parsimonia. Niente intestazioni markdown grandi; usa elenchi puntati brevi.`

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY non configurata.' }, { status: 500 })
  }
  let body = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const messages = (Array.isArray(body?.messages) ? body.messages : [])
    .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-20)
  if (!messages.length) return NextResponse.json({ error: 'messages mancante' }, { status: 400 })

  // contesto audit (compatto: niente liste keyword enormi)
  let auditBlock = ''
  const a = body.audit
  if (a && a.url) {
    if (a.mode === 'site') {
      auditBlock = `AUDIT SEO (sito ${a.url}) — score medio ${a.avgScore}, ${a.pagesAnalyzed} pagine.\nProblemi ricorrenti: ${(a.commonIssues || []).map(i => `${i.label} (${i.affected}/${a.pagesAnalyzed})`).join('; ')}`
    } else {
      const issues = (a.checks || []).filter(c => c.status !== 'pass').map(c => `${c.label}: ${c.detail}`).join('\n')
      const kw = a.keywords ? `Top keyword: ${(a.keywords.unigrams || []).slice(0, 8).map(k => k.term).join(', ')}.${a.keywords.target ? ` Target "${a.keywords.target.keyword}" densità ${a.keywords.target.density}%.` : ''}` : ''
      auditBlock = `AUDIT SEO (pagina ${a.url}) — score ${a.score}/100.\nTitle attuale: "${a.meta?.title || ''}"\nMeta description: "${a.meta?.description || ''}"\nProblemi rilevati:\n${issues || 'nessuno'}\n${kw}`
    }
  }

  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        top_p: 0.9,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...(auditBlock ? [{ role: 'system', content: `Contesto — usa questi dati per ogni risposta:\n${auditBlock}` }] : []),
          ...messages,
        ],
      }),
    })
    if (!r.ok) {
      const text = await r.text()
      return NextResponse.json({ error: `OpenAI ${r.status}: ${text.slice(0, 200)}` }, { status: 502 })
    }
    const json = await r.json()
    return NextResponse.json({ reply: json?.choices?.[0]?.message?.content || '(vuoto)' })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Errore di rete' }, { status: 500 })
  }
}
