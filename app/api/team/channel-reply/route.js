export const dynamic = 'force-dynamic'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { resolveWorkspace } from '../../../../lib/team/workspace'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { callBrain } from '../../../../lib/agent/gateway'
import { getTeamAgent, findMentionedAgent, teamSkillPrompt } from '../../../../lib/agent/team'

// Genera la risposta di un agente del team a una menzione in un canale LyftTalk,
// e la posta nel canale come messaggio dell'agente. Chiamato dal frontend dopo
// che un utente ha scritto un messaggio che nomina un agente.

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY non configurata' }, { status: 500 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

  let b = {}
  try { b = await req.json() } catch {}
  const channelId = b.channel_id
  if (!channelId) return NextResponse.json({ ok: false, error: 'channel_id mancante' }, { status: 400 })

  // L'agente: esplicito dal frontend, altrimenti rilevato dall'ultimo messaggio.
  let agent = getTeamAgent(b.agentId)

  // Ultimi messaggi del canale per dare contesto alla risposta.
  const { data: rows } = await admin
    .from('channel_messages')
    .select('author_name, body, created_at')
    .eq('workspace_id', ws.workspaceId)
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(14)
  const recent = (rows || []).reverse().filter(m => m.body)

  if (!agent) {
    const last = [...recent].reverse().find(m => m.body)
    agent = findMentionedAgent(last?.body || '')
  }
  if (!agent) return NextResponse.json({ ok: false, error: 'Nessun agente menzionato' }, { status: 400 })

  const tag = `${agent.name} · ${agent.role}`
  // Mappa lo storico canale in conversazione: i messaggi dell'agente = assistant,
  // tutto il resto = user (prefissato col nome di chi scrive).
  const conversation = recent.map(m => (
    m.author_name === tag
      ? { role: 'assistant', content: m.body }
      : { role: 'user', content: `${m.author_name || 'Utente'}: ${m.body}` }
  ))
  const lastUserMsg = [...conversation].reverse().find(m => m.role === 'user')?.content || ''

  try {
    const { content: reply } = await callBrain({
      skill: { id: `team-${agent.id}`, systemPrompt: teamSkillPrompt(agent) },
      query: lastUserMsg,
      messages: conversation,
      locale: b.locale || null,
      temperature: 0.5,
    })
    const text = String(reply || '').trim()
    if (!text) return NextResponse.json({ ok: false, error: 'Risposta vuota' })

    const { data, error } = await admin.from('channel_messages').insert({
      channel_id: channelId, workspace_id: ws.workspaceId,
      author_id: null, author_name: tag, body: text,
    }).select('*').single()
    if (error) throw error
    return NextResponse.json({ ok: true, message: data, agent: { id: agent.id, name: agent.name, role: agent.role } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'Errore' })
  }
}
