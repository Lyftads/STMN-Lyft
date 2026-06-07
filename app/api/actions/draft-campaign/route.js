export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { resolveWorkspace } from '../../../../lib/team/workspace'
import { aiLangSystemMessage } from '../../../../lib/i18n/aiLang'

// Trasforma una descrizione in linguaggio naturale in una BOZZA strutturata di
// campagna Meta. Non crea nulla: restituisce la bozza, che l'utente rivede e
// accoda nella Coda Azioni (type=create_campaign) per l'approvazione.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM_PROMPT = `Sei un media buyer esperto di Meta Ads. Trasforma la richiesta dell'utente in una bozza di campagna Meta strutturata e realistica.
Rispondi SOLO con un oggetto JSON con ESATTAMENTE queste chiavi:
{
  "name": "nome breve della campagna",
  "objective": "uno tra: OUTCOME_SALES, OUTCOME_LEADS, OUTCOME_TRAFFIC, OUTCOME_AWARENESS, OUTCOME_ENGAGEMENT",
  "daily_budget_eur": numero (budget giornaliero in euro, intero ragionevole),
  "audience": "descrizione sintetica del targeting (geo, età, interessi)",
  "optimization_goal": "es. PURCHASE, LEAD, LINK_CLICKS, REACH",
  "summary": "una frase che riassume la campagna, NELLA LINGUA DELL'UTENTE"
}
Se mancano dati, scegli default sensati per un brand DTC. Non aggiungere testo fuori dal JSON.`

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY non configurata.' }, { status: 500 })

  let b = {}
  try { b = await req.json() } catch {}
  const prompt = String(b.prompt || '').trim()
  if (!prompt) return NextResponse.json({ ok: false, error: 'Descrizione mancante' }, { status: 400 })

  try {
    const langMsg = aiLangSystemMessage(b.locale)
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...(langMsg ? [langMsg] : []),
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(28000),
    })
    const j = await r.json()
    if (!r.ok) return NextResponse.json({ ok: false, error: j?.error?.message || `HTTP ${r.status}` }, { status: 502 })
    let draft = {}
    try { draft = JSON.parse(j.choices?.[0]?.message?.content || '{}') } catch {}
    // normalizzazione difensiva
    const out = {
      name: String(draft.name || 'Nuova campagna').slice(0, 120),
      objective: String(draft.objective || 'OUTCOME_SALES'),
      daily_budget_eur: Math.max(1, Math.round(Number(draft.daily_budget_eur) || 20)),
      audience: String(draft.audience || '').slice(0, 400),
      optimization_goal: String(draft.optimization_goal || 'PURCHASE'),
      summary: String(draft.summary || draft.name || 'Nuova campagna Meta').slice(0, 300),
    }
    return NextResponse.json({ ok: true, draft: out })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
