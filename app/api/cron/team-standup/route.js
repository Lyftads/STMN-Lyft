export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { resolveWorkspace } from '../../../../lib/team/workspace'
import { callBrain } from '../../../../lib/agent/gateway'
import { TEAM, getTeamAgent, teamSkillPrompt } from '../../../../lib/agent/team'

// ============================================================================
//  STANDUP AUTONOMO QUOTIDIANO — la squadra AI si parla da sola in LyftTalk.
//
//  Ogni mattina Chiara (CEO) apre lo standup: guarda i dati reali del brand,
//  fissa 1-2 priorità e chiama 2-3 specialisti per nome. Ognuno riporta nel
//  suo dominio riferendosi a quanto detto (gerarchia: capo → team). Chiara
//  chiude con la priorità del giorno. Tutto postato nel canale come messaggi
//  degli agenti (author_id null, author_name "Nome · Ruolo").
//
//  Auth: Vercel cron (Bearer CRON_SECRET) → workspace = owner (STMN), dati via
//  x-internal-cron. Oppure owner loggato (resolveWorkspace) → trigger manuale
//  per test, dati via cookie di sessione.
// ============================================================================

function isAuthorizedCron(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`
}

// Trova gli agenti (non-CEO) nominati per nome nel testo di Chiara.
function specialistsMentioned(text) {
  const s = String(text || '').toLowerCase()
  return TEAM.filter(a => a.id !== 'ceo' &&
    new RegExp(`(^|[^a-zà-ù])${a.name.toLowerCase()}([^a-zà-ù]|$)`, 'i').test(s))
}

// Riassunto dati compatto per il blocco creative (ads/creative citano roba vera).
function buildCreativeBlock(liveData) {
  if (!Array.isArray(liveData?.creatives) || !liveData.creatives.length) return ''
  const top = [...liveData.creatives].sort((a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0)).slice(0, 15)
  return 'CREATIVE REALI di questo brand (puoi citare SOLO questi nomi):\n' + top.map(c => {
    let line = `• "${c.name || '?'}" — spend €${Math.round(Number(c.spend) || 0)}, ROAS ${c.roas ?? '-'}, CTR ${c.ctr ?? '-'}%`
    if (c.cta) line += ` · CTA ${c.cta}`
    return line
  }).join('\n')
}

export async function GET(req) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY assente' }, { status: 500 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'no admin' }, { status: 500 })

  // ── Auth + risoluzione workspace/auth-dati ───────────────────────────────
  let workspaceId, memberId = null, dataAuthHeaders
  if (isAuthorizedCron(req)) {
    workspaceId = process.env.LYFT_OWNER_USER_ID
    if (!workspaceId) return NextResponse.json({ ok: false, error: 'LYFT_OWNER_USER_ID assente' }, { status: 500 })
    dataAuthHeaders = { 'x-internal-cron': process.env.CRON_SECRET || '' }
  } else {
    const ws = await resolveWorkspace()
    if (!ws) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 })
    workspaceId = ws.workspaceId
    memberId = ws.memberId || null
    const cookie = req.headers.get('cookie') || ''
    dataAuthHeaders = cookie ? { cookie } : {}
  }

  // ── Canale di destinazione: 'generale' del workspace (creato se manca) ────
  let channelId
  {
    const { data: chans } = await admin
      .from('channels').select('id, name')
      .eq('workspace_id', workspaceId).order('created_at', { ascending: true })
    const general = (chans || []).find(c => (c.name || '').toLowerCase() === 'generale') || (chans || [])[0]
    if (general) channelId = general.id
    else {
      const { data: created } = await admin.from('channels')
        .insert({ workspace_id: workspaceId, name: 'generale', created_by: memberId })
        .select('id').single()
      channelId = created?.id
    }
  }
  if (!channelId) return NextResponse.json({ ok: false, error: 'nessun canale' }, { status: 500 })

  // ── Dati live reali del brand ─────────────────────────────────────────────
  const origin = new URL(req.url).origin
  let liveData = null
  try {
    const r = await fetch(`${origin}/api/agent-context?preset=last_30d&days=30`, { cache: 'no-store', headers: dataAuthHeaders })
    if (r.ok) liveData = await r.json()
  } catch {}
  const creativeBlock = buildCreativeBlock(liveData)

  // Posta un messaggio come agente nel canale.
  const post = async (agent, text) => {
    const t = String(text || '').trim()
    if (!t) return null
    const tag = `${agent.name} · ${agent.role}`
    const { data } = await admin.from('channel_messages').insert({
      channel_id: channelId, workspace_id: workspaceId, author_id: null, author_name: tag, body: t,
    }).select('id, author_name, body, created_at').single()
    return data
  }

  // Conversazione progressiva: tutti i messaggi già detti dello standup, come
  // input per il prossimo agente (sono "altri" → role user col nome davanti).
  const transcript = [] // { name, role, text }
  const asConversation = () => transcript.map(m => ({ role: 'user', content: `${m.name} (${m.role}): ${m.text}` }))
  const dataArgs = {
    data: liveData,
    dataLabel: 'DATI LIVE del brand (numeri e nomi REALI — cita SOLO questi):',
    dataMax: 45000,
  }
  const guard = 'REGOLA ANTI-INVENZIONE: ogni nome (campagna, adset, creative, prodotto, flusso) e ogni numero che citi DEVE essere presente nei DATI LIVE. Se un dato non c\'è, dillo — non inventare MAI.'

  const posted = []
  try {
    const ceo = getTeamAgent('ceo')

    // ── 1) Chiara apre lo standup ──────────────────────────────────────────
    const openRes = await callBrain({
      skill: { id: 'team-ceo', systemPrompt: teamSkillPrompt(ceo), guard },
      query: 'Apri lo standup mattutino della squadra in LyftTalk.',
      ...dataArgs,
      extraSystem: creativeBlock ? [{ role: 'system', content: creativeBlock }] : [],
      temperature: 0.5,
      guardTail: 'Sei Chiara (CEO). Apri lo standup quotidiano del team davanti a tutti, in 2-4 frasi: (1) un saluto breve e una lettura sintetica di come sta andando il brand sui DATI LIVE (cita 1-2 numeri reali), (2) la priorità n.1 di oggi, (3) chiama per NOME 2 specialisti del team chiedendo loro un check specifico nel loro dominio (es. "Sofia, dammi il punto sulle creative in fatica; Alessandro, controlla l\'anomalia su…"). Umana, diretta, da leader. Niente elenchi puntati.',
    })
    const openText = String(openRes.content || '').trim()
    const om = await post(ceo, openText)
    if (om) { posted.push(om); transcript.push({ name: ceo.name, role: ceo.role, text: openText }) }

    // ── 2) Gli specialisti chiamati riportano (max 3) ──────────────────────
    let specialists = specialistsMentioned(openText).slice(0, 3)
    if (!specialists.length) specialists = ['data', 'ads', 'creative'].map(getTeamAgent)
    for (const agent of specialists) {
      const block = (agent.id === 'ads' || agent.id === 'creative') && creativeBlock
        ? [{ role: 'system', content: creativeBlock }] : []
      const res = await callBrain({
        skill: { id: `team-${agent.id}`, systemPrompt: teamSkillPrompt(agent), guard },
        query: `Rispondi allo standup: Chiara ti ha chiamato. Riporta nel tuo dominio (${agent.role}).`,
        ...dataArgs,
        extraSystem: block,
        messages: asConversation(),
        temperature: 0.45,
        guardTail: `Sei ${agent.name} (${agent.role}). Stai rispondendo allo standup del team: rivolgiti a Chiara per nome e riporta il tuo check nel tuo dominio in 1-3 frasi, con 1-2 numeri/nomi REALI dai DATI LIVE. Puoi avere dubbi o segnalare un rischio. Continua la conversazione in modo naturale, NON risalutare tutti, niente elenchi. Sii concreto: cosa vedi e cosa proponi.`,
      })
      const text = String(res.content || '').trim()
      const m = await post(agent, text)
      if (m) { posted.push(m); transcript.push({ name: agent.name, role: agent.role, text }) }
    }

    // ── 3) Chiara chiude con la decisione/priorità del giorno ──────────────
    const closeRes = await callBrain({
      skill: { id: 'team-ceo', systemPrompt: teamSkillPrompt(ceo), guard },
      query: 'Chiudi lo standup.',
      ...dataArgs,
      messages: asConversation(),
      temperature: 0.5,
      guardTail: 'Sei Chiara (CEO). Hai sentito i report del team qui sopra. Chiudi lo standup in 1-2 frasi: sintetizza e fissa LA priorità operativa di oggi (chi fa cosa), riferendoti ai colleghi per nome. Decisa, breve, NON risalutare.',
    })
    const closeText = String(closeRes.content || '').trim()
    const cm = await post(ceo, closeText)
    if (cm) posted.push(cm)

    return NextResponse.json({ ok: true, channel_id: channelId, messages: posted.length, posted })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'Errore', posted }, { status: 500 })
  }
}
