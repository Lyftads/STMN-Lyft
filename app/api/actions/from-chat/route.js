export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { resolveWorkspace } from '../../../../lib/team/workspace'
import { callBrain } from '../../../../lib/agent/gateway'

// Estrae dalla CONVERSAZIONE col cervello le azioni concrete eseguibili, da
// proporre nella Coda Azioni. NON esegue nulla: ritorna proposte che l'utente
// aggiunge alla coda (status 'pending') e poi approva/esegue manualmente.

const CHANNELS = ['meta', 'klaviyo', 'google', 'shopify', 'other']
const TYPES = ['pause_campaign', 'resume_campaign', 'scale_budget', 'shift_budget', 'refresh_creative', 'create_campaign', 'create_ad', 'custom']

const SYSTEM = `Dalla CONVERSAZIONE tra il founder e il suo consulente, estrai SOLO le azioni concrete ed eseguibili realmente emerse o raccomandate (max 4), da mettere nella Coda Azioni per l'approvazione.
Rispondi SOLO con JSON: { "actions": [ { "channel": "...", "type": "...", "target_name": "...", "summary": "...", "why": "..." } ] }
- channel ∈ ${CHANNELS.join(' | ')}
- type ∈ ${TYPES.join(' | ')}
- "summary" = l'azione all'imperativo, breve e specifica, NELLA LINGUA DELL'UTENTE (es. "Metti in pausa l'adset X", "Sposta il 30% del budget da A a B")
- "target_name" = nome dell'oggetto citato (campagna/adset/flusso/prodotto), altrimenti null
- "why" = 1 frase sul motivo, basata su ciò che è stato detto nella conversazione
- SOLO azioni davvero discusse o consigliate. Niente azioni inventate. Se nessuna azione concreta è emersa: { "actions": [] }
Non aggiungere testo fuori dal JSON.`

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY non configurata' }, { status: 500 })

  let b = {}
  try { b = await req.json() } catch {}
  const messages = Array.isArray(b.messages) ? b.messages : []
  if (!messages.length) return NextResponse.json({ ok: true, actions: [] })

  try {
    const { parsed } = await callBrain({
      skill: { id: 'performance', json: true, systemPrompt: SYSTEM },
      query: 'azioni concrete da accodare dalla conversazione',
      messages,
      locale: b.locale || null,
      conversation: false,
      temperature: 0.2,
    })
    const raw = Array.isArray(parsed?.actions) ? parsed.actions : []
    const actions = raw.map(a => ({
      channel: CHANNELS.includes(a.channel) ? a.channel : 'other',
      type: TYPES.includes(a.type) ? a.type : 'custom',
      target_name: a.target_name ? String(a.target_name).slice(0, 160) : null,
      summary: String(a.summary || '').slice(0, 300),
      why: a.why ? String(a.why).slice(0, 300) : null,
    })).filter(a => a.summary).slice(0, 4)
    return NextResponse.json({ ok: true, actions })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'Errore' }, { status: 500 })
  }
}
