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
    .select('author_id, author_name, body, created_at')
    .eq('workspace_id', ws.workspaceId)
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(14)
  const recent = (rows || []).reverse().filter(m => m.body)

  // Quale agente risponde:
  // 1) agentId esplicito, 2) nome menzionato nell'ultimo messaggio,
  // 3) CONTINUA la conversazione con l'ultimo agente che ha scritto (author_id null).
  if (!agent) {
    const last = [...recent].reverse().find(m => m.body)
    agent = findMentionedAgent(last?.body || '')
  }
  if (!agent) {
    const lastAgentMsg = [...recent].reverse().find(m => !m.author_id && m.author_name)
    if (lastAgentMsg) agent = findMentionedAgent(lastAgentMsg.author_name)
  }
  if (!agent) return NextResponse.json({ ok: false, error: 'Nessun agente in conversazione' }, { status: 400 })

  const tag = `${agent.name} · ${agent.role}`
  // Mappa lo storico canale in conversazione: i messaggi dell'agente = assistant,
  // tutto il resto = user (prefissato col nome di chi scrive).
  const conversation = recent.map(m => (
    m.author_name === tag
      ? { role: 'assistant', content: m.body }
      : { role: 'user', content: `${String(m.author_name || 'Utente').split(' ')[0]}: ${m.body}` }
  ))
  const lastUserMsg = [...conversation].reverse().find(m => m.role === 'user')?.content || ''

  // Dati reali cross-dominio (numeri e NOMI veri: campagne, adset, prodotti, flussi…)
  // così l'agente cita SOLO dati reali e non inventa. Inoltra il cookie di sessione.
  const origin = new URL(req.url).origin
  const cookie = req.headers.get('cookie') || ''
  let liveData = null
  try {
    const cr = await fetch(`${origin}/api/agent-context?preset=last_30d&days=30`, { cache: 'no-store', headers: cookie ? { cookie } : {} })
    if (cr.ok) liveData = await cr.json()
  } catch {}

  try {
    const { content: reply } = await callBrain({
      skill: {
        id: `team-${agent.id}`,
        systemPrompt: teamSkillPrompt(agent),
        guard: 'REGOLA CRITICA ANTI-INVENZIONE: ogni NOME (campagna, adset, creative, prodotto, flusso) e ogni numero/percentuale che citi DEVE essere presente LETTERALMENTE nei DATI LIVE. È VIETATO inventare o ipotizzare nomi e numeri. Se il dato chiesto non è nei DATI LIVE (es. i nomi delle singole creative potrebbero non esserci), dillo onestamente ("non ho qui i nomi delle singole creative, guardiamole insieme nella tab Creative") — NON inventare MAI.',
      },
      query: lastUserMsg,
      data: liveData,
      dataLabel: 'DATI LIVE (numeri e nomi REALI del brand — puoi citare SOLO questi):',
      dataMax: 70000,
      messages: conversation,
      locale: b.locale || null,
      temperature: 0.3,
      guardTail: 'Sei in una chat di team (LyftTalk), non in un report. Rispondi SOLO ed ESATTAMENTE a ciò che ti è stato chiesto, come un collega vero che scrive in chat: 1-3 frasi brevi, tono naturale e umano. VIETATO riassumere il tuo ruolo o elencare cosa sai fare, vietati elenchi puntati e preamboli. Se non hai un dato, dillo invece di inventarlo. Se serve approfondire, proponi di vederlo insieme.',
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
