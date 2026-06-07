export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { aiLangSystemMessage } from '../../../lib/i18n/aiLang'

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

  // contesto generico: qualsiasi tab SEO passa { type, data }
  // (retro-compat: body.audit → page/site audit)
  const safe = (o, max = 4500) => { try { const s = JSON.stringify(o); return s.length > max ? s.slice(0, max) + '…(troncato)' : s } catch { return '' } }
  function buildContext(ctx) {
    if (!ctx || !ctx.data) return ''
    const d = ctx.data
    switch (ctx.type) {
      case 'site-audit':
        return `AUDIT SEO (sito ${d.url}) — score medio ${d.avgScore}, ${d.pagesAnalyzed} pagine.\nProblemi ricorrenti: ${(d.commonIssues || []).map(i => `${i.label} (${i.affected}/${d.pagesAnalyzed})`).join('; ')}`
      case 'page-audit': {
        const issues = (d.checks || []).filter(c => c.status !== 'pass').map(c => `${c.label}: ${c.detail}`).join('\n')
        const kw = d.keywords ? `Top keyword: ${(d.keywords.unigrams || []).slice(0, 8).map(k => k.term).join(', ')}.` : ''
        return `AUDIT SEO (pagina ${d.url}) — score ${d.score}/100.\nTitle: "${d.meta?.title || ''}"\nMeta: "${d.meta?.description || ''}"\nProblemi:\n${issues || 'nessuno'}\n${kw}`
      }
      case 'keyword':
        return `ANALISI KEYWORD "${d.keyword}": intent ${d.intent}, difficoltà ${d.difficulty?.level}. Correlate: ${(d.related || []).map(r => r.term).join(', ')}. Domande: ${(d.questions || []).join(' | ')}.`
      case 'editor':
        return `BRIEF EDITORIALE keyword "${d.keyword}":\n${safe(d)}`
      case 'competitor':
        return `CONFRONTO COMPETITOR ON-PAGE:\n${safe(d.rows || d)}`
      case 'aeo':
        return `AI VISIBILITY brand "${d.brand}" (score ${d.visibilityScore}):\n${safe(d.results)}`
      case 'gsc':
        return `GOOGLE SEARCH CONSOLE (${d.site}) — totali click ${d.totals?.clicks}, impr ${d.totals?.impressions}, CTR ${(d.totals?.ctr * 100 || 0).toFixed(1)}%, pos ${d.totals?.position?.toFixed(1)}.\nOpportunità: ${safe(d.opportunities)}\nTop query: ${safe((d.queries || []).slice(0, 30))}`
      default:
        return safe(d)
    }
  }
  const ctx = body.context || (body.audit ? { type: body.audit.mode === 'site' ? 'site-audit' : 'page-audit', data: body.audit } : null)
  const auditBlock = buildContext(ctx)

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
          ...(aiLangSystemMessage(body?.locale) ? [aiLangSystemMessage(body.locale)] : []),
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
