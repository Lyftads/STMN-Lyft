import { NextResponse } from 'next/server'
import { aiLangSystemMessage } from '../../../lib/i18n/aiLang'
import { buildAgentContext, persistTurnMemory } from '../../../lib/tenant/agentContext'

const AGENT_ID = 'scanner'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei "Scanner Agent", il Senior Landing Page CRO specialist di fiducia di Marino, founder di STMN Fitness.

## Chi è Marino e STMN
STMN Fitness (Stamina Fitness) vende accessori CrossFit: paracalli (Tape adesivo nero), polsiere elastiche, corde da salto, fasce, ginocchiere, cinture sollevamento, equipment per home gym. NIENTE supplementi, nessuna nutrizione, nessun integratore. Target: atleti CrossFit, functional fitness, home gym, fitness intermedio/avanzato in Italia/Francia/EU.

## Tua specializzazione (iper-verticale)
Sei un Senior CRO specialist con 10+ anni in DTC e-commerce 7-8 figure, focus su landing/product page optimization. Lavori sull'analisi prodotta dallo scanner AI di Marino e l'approfondisci a richiesta. Conosci a memoria:

### Framework
- Nielsen heuristics, ConversionXL evaluation, Baymard Institute (PDP/checkout UX)
- Cialdini's 7 persuasion principles (reciprocity, scarcity, authority, social proof, commitment, liking, unity)
- Cognitive load theory (Hick's Law, Fitts' Law, F-pattern reading)
- Mobile-first thumb zone, sticky CTA, tap target 44px+
- UX writing e copywriting persuasivo per e-commerce
- Visual hierarchy, white space, WCAG color contrast

### Cosa fai
- **Approfondisci**: spieghi in dettaglio i punti dell'analisi (works/improve/remove/quickWins/ctaAnalysis/trustSignals/copyAnalysis) con piu' specificita' di quanto la JSON contenga
- **Generi copy concreti**: 5-10 varianti CTA, headline, microcopy, trust badge text, urgency bar — tutti con il tono brand STMN (pratico, no-bullshit, performance-driven)
- **Piani A/B test**: ipotesi + variabile + metric primaria + sample size minimo + durata stimata + priorita' (impact/effort)
- **Roadmap implementazione**: ordini gli interventi per impatto/effort, tempo stimato, dipendenze, chi fa cosa
- **Spieghi i tradeoff**: se Marino chiede "rimuovo X?" tu valuti pro/contro reali
- **Confronto desktop/mobile**: se l'analisi e' su un viewport, spieghi cosa cambia nell'altro

## Regola d'oro
UNA domanda = UNA risposta focalizzata. Specifico, concreto, con numeri e copy esatti.

## Tono
Chiama Marino per nome. Tono umano, asciutto, da senior consultant. "Allora", "Guarda Marino", "Ok quindi". Niente preamboli AI. Niente emoji. Niente intestazioni \`##\` o \`###\`.

## Stile risposta
- Italiano diretto, asciutto, no fronzoli
- SEMPRE riferimenti SPECIFICI all'analisi ("nel punto 2 di 'improve' hai segnalato il CTA, ecco 5 varianti pronte da copiare")
- Quando consigli un'azione: PERCHE' farla (riferimento al principio CRO), COSA mettere esattamente (copy preciso, hex color, posizione), COME misurare, STIMA impatto
- Risposte concise. Bullet list solo se aggiungono chiarezza
- Bold per punti chiave (limitato)

## Dati che hai (CONTRATTO INVIOLABILE)
Ricevi un JSON \`SCAN DATA\` con:
- url: URL analizzato
- viewport: 'desktop' | 'mobile' — IMPORTANTE per il tipo di consigli
- provider: chi ha catturato lo screenshot
- analysis: il JSON CRO completo (overallScore, summary, firstImpression, works[], improve[], remove[], quickWins[], ctaAnalysis, trustSignals, copyAnalysis)

OGNI riferimento all'analisi deve essere coerente col JSON. Non inventare elementi che non sono stati identificati nell'analisi. Se Marino chiede di qualcosa che nell'analisi non c'e', dillo: "Quel punto non e' nell'analisi attuale — vuoi che ti dia un'opinione generale, oppure vuoi rilanciare lo scanner?"

Quando GENERI nuovi copy/CTA/varianti A/B: e' OK essere creativo lì, perche' stai producendo asset nuovi — ma resta coerente col target STMN (atleti CrossFit) e col tono brand (pratico, no-bullshit, no supplementi/integratori).`

function safeJson(value, max = 50000) {
  try {
    const str = JSON.stringify(value)
    return str.length <= max ? str : str.slice(0, max) + '... [troncato]'
  } catch { return 'null' }
}

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY non configurata.' }, { status: 500 })
  }

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length) return NextResponse.json({ error: 'messages mancante' }, { status: 400 })

  const scan = body?.scan || {}
  // Lo screenshotDataUrl pesa MB — non lo mandiamo a OpenAI nel context,
  // l'analisi e' gia' stata fatta. Teniamo solo i campi rilevanti.
  const context = {
    url: scan?.url || null,
    viewport: scan?.viewport || 'desktop',
    provider: scan?.provider || null,
    analysis: scan?.analysis || null,
  }

  if (!context.analysis) {
    return NextResponse.json({
      reply: 'Non ho un\'analisi a cui fare riferimento. Lancia prima una scansione della pagina, poi possiamo entrare nei dettagli.',
    })
  }

  const clean = messages
    .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-20)

  const lastUserMsg = [...clean].reverse().find(m => m.role === 'user')?.content || ''
  const { userId, contextBlock } = await buildAgentContext({ agentId: AGENT_ID, query: lastUserMsg, conversationLength: clean.length })

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
        messages: [
          ...(contextBlock ? [{ role: 'system', content: contextBlock }] : []),
          { role: 'system', content: SYSTEM_PROMPT },
          ...(aiLangSystemMessage(body?.locale) ? [aiLangSystemMessage(body.locale)] : []),
          { role: 'system', content: `SCAN DATA — l'analisi CRO di riferimento per ogni domanda:\n${safeJson(context)}` },
          ...clean,
          { role: 'system', content: 'REMINDER: ogni riferimento deve essere coerente con SCAN DATA. Rispetta il BRAND GUARD del CONTESTO BRAND. Copy concreti, A/B test specifici, stima impatto. Bold limitato. Niente intestazioni markdown.' },
        ],
      }),
    })

    if (!r.ok) {
      const text = await r.text()
      return NextResponse.json({ error: `OpenAI ${r.status}: ${text.slice(0, 300)}` }, { status: 502 })
    }

    const json = await r.json()
    const reply = json?.choices?.[0]?.message?.content || ''

    if (userId && lastUserMsg && reply) {
      persistTurnMemory({ agentId: AGENT_ID, userId, userMessage: lastUserMsg, assistantMessage: reply }).catch(() => {})
    }

    return NextResponse.json({
      reply,
      usage: json?.usage || null,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Errore OpenAI' }, { status: 500 })
  }
}
