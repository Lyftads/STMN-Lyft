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

  const origin = new URL(req.url).origin
  const cookie = req.headers.get('cookie') || ''
  const H = cookie ? { cookie } : {}

  // Posta un messaggio come l'agente nel canale.
  const post = async (text) => {
    const t = String(text || '').trim()
    if (!t) return null
    const { data } = await admin.from('channel_messages').insert({
      channel_id: channelId, workspace_id: ws.workspaceId, author_id: null, author_name: tag, body: t,
    }).select('*').single()
    return data
  }
  const done = (data) => NextResponse.json({ ok: !!data, message: data || null, agent: { id: agent.id, name: agent.name, role: agent.role } })

  try {
    // ── 1) TRIAGE veloce (senza dati): o risponde subito (chiacchiera), o manda
    //      un ack immediato e poi va a cercare i dati. Evita l'attesa al buio.
    const triage = await callBrain({
      skill: { id: `team-${agent.id}`, systemPrompt: teamSkillPrompt(agent) },
      query: lastUserMsg,
      messages: conversation,
      locale: b.locale || null,
      temperature: 0.4,
      guardTail: 'Decidi in base all\'ultima richiesta. Se per rispondere ti servono DATI del brand (creative, campagne, adset, numeri, prodotti, performance, vendite…), NON rispondere nel merito: scrivi SOLO una frase brevissima e naturale, in prima persona, che stai andando a controllare (es. "Dammi un attimo Marino, controllo le creative migliori 👀"). Se invece è un saluto o chiacchiera che NON richiede dati, rispondi direttamente e fai iniziare il messaggio ESATTAMENTE con "DIRETTO: " seguito dalla risposta breve.',
    })
    const tr = String(triage.content || '').trim()

    // Chiacchiera/saluto → risposta diretta, una volta sola (veloce).
    if (/^DIRETTO:/i.test(tr)) {
      return done(await post(tr.replace(/^DIRETTO:\s*/i, '').trim()))
    }

    // Domanda che richiede dati → posta SUBITO l'ack, poi cerca i dati.
    await post(tr || 'Un attimo, controllo i dati…')

    // ── 2) Dati reali (agent-context include già le creative con i nomi) ──
    let liveData = null, creativeBlock = ''
    try {
      const ctxRes = await fetch(`${origin}/api/agent-context?preset=last_30d&days=30`, { cache: 'no-store', headers: H })
      if (ctxRes.ok) liveData = await ctxRes.json()
    } catch {}
    if (Array.isArray(liveData?.creatives) && liveData.creatives.length) {
      creativeBlock = 'CREATIVE REALI di questo brand (nomi ESATTI — puoi citare SOLO questi):\n' + liveData.creatives.slice(0, 40).map(c =>
        `• "${c.name || '?'}" · adset "${c.adset || '?'}" · campagna "${c.campaign || '?'}" — spend €${Math.round(Number(c.spend) || 0)}, ROAS ${c.roas ?? '-'}, CTR ${c.ctr ?? '-'}%`
      ).join('\n')
    }

    // ── 3) Risposta VERA con i dati ──
    const { content: reply } = await callBrain({
      skill: {
        id: `team-${agent.id}`,
        systemPrompt: teamSkillPrompt(agent),
        guard: 'REGOLA CRITICA ANTI-INVENZIONE: ogni NOME (campagna, adset, creative, prodotto, flusso) e ogni numero/percentuale che citi DEVE essere presente LETTERALMENTE nei DATI LIVE o nel blocco CREATIVE REALI. È VIETATO inventare o ipotizzare nomi e numeri. Se proprio un dato non c\'è, dillo onestamente — NON inventare MAI.',
      },
      query: lastUserMsg,
      data: liveData,
      dataLabel: 'DATI LIVE (numeri e nomi REALI del brand — puoi citare SOLO questi):',
      dataMax: 70000,
      extraSystem: creativeBlock ? [{ role: 'system', content: creativeBlock }] : [],
      messages: conversation,
      locale: b.locale || null,
      temperature: 0.3,
      guardTail: 'Hai appena detto che stavi controllando: ORA dai la risposta vera e diretta a ciò che ti è stato chiesto, con i dati reali. Sei in chat (LyftTalk): 1-3 frasi brevi, naturale, niente riassunti del ruolo né elenchi. Cita SOLO nomi/numeri reali; se un dato non c\'è, dillo.',
    })
    const answerMsg = await post(reply)

    // ── 4) Allega le IMMAGINI delle creative menzionate (o richieste) ──
    try {
      const creatives = Array.isArray(liveData?.creatives) ? liveData.creatives.filter(c => c.image) : []
      if (creatives.length) {
        const r = String(reply || '')
        // creative i cui nomi compaiono nella risposta dell'agente
        let toShow = creatives.filter(c => c.name && r.includes(c.name))
        // se l'utente ha chiesto di VEDERLE e non ne abbiamo agganciate dal testo → top per spesa
        const wantsImages = /mostr|fammi veder|farmi veder|vedere|immagin|allega|screenshot|come sono fatt|fammele/i.test(lastUserMsg)
        if (wantsImages && toShow.length === 0) {
          toShow = [...creatives].sort((a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0))
        }
        for (const c of toShow.slice(0, 3)) {
          await admin.from('channel_messages').insert({
            channel_id: channelId, workspace_id: ws.workspaceId, author_id: null, author_name: tag,
            body: c.name || 'Creative',
            file_url: c.image, file_type: 'image/jpeg',
            file_name: `${String(c.name || 'creative').slice(0, 60)}.jpg`,
          })
        }
      }
    } catch {}

    return done(answerMsg)
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'Errore' })
  }
}
