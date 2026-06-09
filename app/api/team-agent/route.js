export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { callBrain } from '../../../lib/agent/gateway'
import { getTeamAgent, teamRoster } from '../../../lib/agent/team'
import { persistTurnMemory } from '../../../lib/tenant/agentContext'

const GUARD = 'REGOLA CRITICA: ogni numero, nome prodotto, nome campagna, percentuale che citi DEVE essere copiato letteralmente dal blocco DATI LIVE. Vietato inventare/stimare. Se manca un dato dillo. Rispetta il BRAND GUARD del CONTESTO BRAND.'

function safeJson(value, max = 70000) {
  try { const s = JSON.stringify(value); return s.length <= max ? s : s.slice(0, max) + '… [troncato]' } catch { return 'null' }
}

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY non configurata.' }, { status: 500 })

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const agent = getTeamAgent(body?.agentId)
  if (!agent) return NextResponse.json({ error: 'Agente non valido' }, { status: 400 })

  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length) return NextResponse.json({ error: 'messages mancante' }, { status: 400 })

  const preset = body?.preset || 'last_30d'
  const agentContext = body?.agentContext || null
  const context = { preset, updatedAt: new Date().toISOString(), ...(agentContext || {}) }

  const cleanMessages = messages
    .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-20)
  const lastUserMsg = [...cleanMessages].reverse().find(m => m.role === 'user')?.content || ''

  // Ogni agente conosce i colleghi (per poter "passare la palla" al team).
  const rosterNote = 'Fai parte di una squadra. Colleghi: ' +
    teamRoster().filter(r => r.id !== agent.id).map(r => `${r.name} (${r.role})`).join(', ') +
    '. Se una richiesta è chiaramente di competenza di un collega, puoi dirlo e suggerire di chiederlo a [nome].'

  // Persona del team = skill inline su callBrain (chat mode → ha persona + brand
  // + memorie + knowledge + i DATI LIVE cross-dominio).
  const skillPrompt = `${agent.systemPrompt}\n\n${rosterNote}\n\nParli SEMPRE in prima persona come ${agent.name} (${agent.role}). Tono umano, come una persona vera al telefono/in call — niente preamboli da AI, niente "come assistente". Rispondi nella lingua dell'utente.`

  try {
    const { userId, content: reply, usage } = await callBrain({
      skill: { id: `team-${agent.id}`, systemPrompt: skillPrompt, guard: GUARD },
      query: lastUserMsg,
      data: context,
      dataLabel: `DATI LIVE (periodo: ${preset}):`,
      dataMax: 70000,
      messages: cleanMessages,
      locale: body?.locale,
      temperature: 0.4,
    })

    if (userId && lastUserMsg && reply) {
      persistTurnMemory({ agentId: `team-${agent.id}`, userId, userMessage: lastUserMsg, assistantMessage: reply }).catch(() => {})
    }

    return NextResponse.json({
      reply,
      agent: { id: agent.id, name: agent.name, role: agent.role },
      usage: usage || null,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    const status = err?.status ? 502 : 500
    return NextResponse.json({ error: err?.message || 'Errore' }, { status })
  }
}

// GET → roster (per il frontend, senza i prompt).
export async function GET() {
  return NextResponse.json({ team: teamRoster() })
}
