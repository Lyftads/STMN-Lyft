export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../../lib/supabase/server'
import { resolveWorkspace } from '../../../../../lib/team/workspace'
import { callBrain } from '../../../../../lib/agent/gateway'
import { getTeamAgent } from '../../../../../lib/agent/team'
import { rememberBatch } from '../../../../../lib/tenant/agentMemory'
import { notifyAssignment, sendEmail } from '../../../../../lib/team/notify'

// ============================================================================
//  POST-CALL: trascrive la call, estrae e ESEGUE le azioni (task, promemoria,
//  analisi, decisioni) e SALVA tutto in memoria (agent_memories) → gli agent
//  ricordano anche nelle call/chat successive. Chiamato dal client a fine call.
// ============================================================================

const AGENT_ROLE = { ads: 'advertising_manager', creative: 'advertising_manager', cro: 'cro_specialist', data: 'data_analyst', seo: 'cro_specialist', cmo: 'ecommerce_manager', cfo: 'ecommerce_manager', ceo: 'admin' }
const PRIORITIES = ['low', 'medium', 'high', 'urgent']

async function fetchTranscript(conversationId, key) {
  // La trascrizione può non essere pronta subito: piccolo retry.
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, { headers: { 'xi-api-key': key }, cache: 'no-store' })
      if (r.ok) {
        const d = await r.json()
        const turns = (d.transcript || []).filter(t => t && t.message)
        if (turns.length || d.status === 'done') return turns.map(t => ({ role: t.role === 'agent' ? 'agent' : 'user', text: String(t.message) }))
      }
    } catch {}
    await new Promise(r => setTimeout(r, 2500))
  }
  return []
}

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  const key = process.env.ELEVENLABS_API_KEY
  if (!admin || !key) return NextResponse.json({ ok: false, error: 'config mancante' }, { status: 500 })

  let b = {}
  try { b = await req.json() } catch {}
  const conversationId = String(b.conversationId || '').trim()
  const entryAgent = getTeamAgent(b.agentId) || getTeamAgent('ceo')
  if (!conversationId) return NextResponse.json({ ok: false, error: 'conversationId mancante' }, { status: 400 })

  try {
  // Evita doppi processi della stessa call.
  const { data: existing } = await admin.from('call_sessions').select('id').eq('conversation_id', conversationId).maybeSingle()
  if (existing) return NextResponse.json({ ok: true, already: true })

  const transcript = await fetchTranscript(conversationId, key)
  if (!transcript.length) return NextResponse.json({ ok: false, error: 'trascrizione non disponibile' })
  const transcriptText = transcript.map(t => `${t.role === 'agent' ? 'Agente' : 'Marino'}: ${t.text}`).join('\n')

  // ── Estrazione azioni (LLM, JSON) ─────────────────────────────────────────
  let plan = {}
  try {
    const res = await callBrain({
      skill: { id: 'call-finalizer', systemPrompt: 'Analizzi la trascrizione di una call tra l\'utente e la Squadra AI di un brand e-commerce ed estrai cosa è stato deciso e cosa va fatto.', guard: 'Estrai solo ciò che emerge DAVVERO dalla call. Non inventare.' },
      query: 'Estrai sintesi e azioni dalla call.',
      data: { transcript: transcriptText }, dataLabel: 'TRASCRIZIONE DELLA CALL:', dataMax: 30000,
      json: true, temperature: 0.3,
      guardTail: 'Restituisci SOLO JSON: {"summary": string (3-5 frasi, cosa si è detto e deciso), "decisions": string[] (decisioni prese), "tasks": [{"title": string, "description": string, "priority": "low"|"medium"|"high"|"urgent", "agent": string (id agente competente tra ceo/cfo/cmo/ads/seo/cro/data/creative), "due_in_days": number}], "reminders": [{"text": string, "in_days": number}], "analyses": string[] (analisi da fare)}. Se una sezione è vuota, usa []. Italiano.',
    })
    plan = (typeof res.content === 'string') ? JSON.parse(res.content) : (res.content || {})
  } catch { plan = {} }

  // ── Membri per assegnazione task (per ruolo) ──────────────────────────────
  const { data: membersRaw } = await admin.from('team_members').select('id, email, full_name, roles, status').eq('workspace_id', ws.workspaceId).in('status', ['active', 'invited'])
  const members = membersRaw || []
  const ownerMember = members.find(m => (m.roles || []).includes('admin') || m.user_id === ws.workspaceId) || members[0] || null
  const eligible = members.filter(m => !(m.roles || []).includes('guest'))
  const load = {}
  const pick = (agentId) => {
    const role = AGENT_ROLE[agentId] || 'ecommerce_manager'
    let c = eligible.filter(m => (m.roles || []).includes(role))
    if (!c.length) c = eligible.filter(m => (m.roles || []).includes('admin'))
    if (!c.length) c = ownerMember ? [ownerMember] : eligible
    if (!c.length) return null
    c.sort((a, b) => (load[a.id] || 0) - (load[b.id] || 0)); const x = c[0]; load[x.id] = (load[x.id] || 0) + 1; return x
  }
  const origin = new URL(req.url).origin
  const createdTasks = []

  // Task + promemoria → task nel board, assegnati e notificati via email.
  const toCreate = [
    ...(Array.isArray(plan.tasks) ? plan.tasks : []),
    ...(Array.isArray(plan.reminders) ? plan.reminders.map(r => ({ title: 'Promemoria: ' + (r.text || '').slice(0, 80), description: r.text, priority: 'medium', agent: 'ceo', due_in_days: r.in_days || 3 })) : []),
    ...(Array.isArray(plan.analyses) ? plan.analyses.map(a => ({ title: 'Analisi: ' + String(a).slice(0, 80), description: a, priority: 'medium', agent: 'data', due_in_days: 5 })) : []),
  ].slice(0, 12)

  for (const t of toCreate) {
    const title = String(t.title || '').trim(); if (!title) continue
    const proposer = getTeamAgent(t.agent); const assignee = pick(t.agent)
    const days = Math.min(21, Math.max(1, Number(t.due_in_days) || 5))
    const due = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
    try {
      const { data } = await admin.from('tasks').insert({
        workspace_id: ws.workspaceId, title,
        description: `${t.description || ''}\n\n— dalla call con ${proposer ? proposer.name : 'la Squadra AI'}`.trim(),
        status: 'todo', priority: PRIORITIES.includes(t.priority) ? t.priority : 'medium',
        assignee_id: assignee?.id || null, due_date: due, created_by: ownerMember?.id || null,
      }).select('*').single()
      if (data) {
        createdTasks.push({ title: data.title, assignee: assignee?.full_name || assignee?.email || '—', due_date: due })
        if (data.assignee_id) await notifyAssignment({ workspaceId: ws.workspaceId, task: data, origin }).catch(() => {})
      }
    } catch {}
  }

  // ── MEMORIA: sintesi + decisioni salvate come agent_memories (recall futuro) ─
  const memItems = []
  const ownerUser = process.env.LYFT_OWNER_USER_ID || ws.workspaceId
  if (plan.summary) memItems.push({ userId: ownerUser, agentId: 'team-call', content: `[Call ${new Date().toLocaleDateString('it-IT')}] ${plan.summary}`, role: 'insight', importance: 8, source: 'call' })
  for (const d of (Array.isArray(plan.decisions) ? plan.decisions : [])) memItems.push({ userId: ownerUser, agentId: 'team-call', content: `[Decisione in call] ${d}`, role: 'fact', importance: 7, source: 'call' })
  if (memItems.length) await rememberBatch(memItems).catch(() => {})

  // ── Salva la sessione ──────────────────────────────────────────────────────
  await admin.from('call_sessions').insert({
    workspace_id: ws.workspaceId, agent_id: entryAgent.id, conversation_id: conversationId,
    transcript, summary: plan.summary || null, actions: { decisions: plan.decisions || [], tasks: createdTasks, reminders: plan.reminders || [], analyses: plan.analyses || [] },
  }).catch(() => {})

  // ── Recap in LYFTTALK (Chiara posta sintesi + decisioni + task per agente) ──
  let postedRecap = false
  try {
    const { data: chans } = await admin.from('channels').select('id, name').eq('workspace_id', ws.workspaceId).order('created_at', { ascending: true })
    const general = (chans || []).find(c => (c.name || '').toLowerCase() === 'generale') || (chans || [])[0]
    if (general && (plan.summary || createdTasks.length)) {
      const ceo = getTeamAgent('ceo')
      const decLines = (plan.decisions || []).slice(0, 6).map(d => `• ${d}`).join('\n')
      const taskLines = createdTasks.map(t => `• ${t.title} → ${t.assignee} (scad. ${t.due_date})`).join('\n')
      const body = `📞 *Recap della call*\n${plan.summary || ''}` +
        (decLines ? `\n\n*Decisioni:*\n${decLines}` : '') +
        (taskLines ? `\n\n*Task creati e programmati:*\n${taskLines}` : '') +
        `\n\nLi trovate in Progetti & Task. Procediamo, squadra. 💪`
      await admin.from('channel_messages').insert({
        channel_id: general.id, workspace_id: ws.workspaceId, author_id: null, author_name: `${ceo.name} · ${ceo.role}`, body,
      })
      postedRecap = true
    }
  } catch {}

  // ── Recap email all'owner ──────────────────────────────────────────────────
  try {
    if (ownerMember?.email && (plan.summary || createdTasks.length)) {
      const taskRows = createdTasks.map(t => `<li>${t.title} → <b>${t.assignee}</b> (scad. ${t.due_date})</li>`).join('')
      const decRows = (plan.decisions || []).map(d => `<li>${d}</li>`).join('')
      await sendEmail({
        to: ownerMember.email, subject: '📞 Recap della call con la Squadra AI',
        html: `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px">
          <h2>Recap call</h2>
          ${plan.summary ? `<p style="color:#444">${plan.summary}</p>` : ''}
          ${decRows ? `<h3>Decisioni</h3><ul>${decRows}</ul>` : ''}
          ${taskRows ? `<h3>Task creati e assegnati</h3><ul>${taskRows}</ul>` : ''}
          <p style="font-size:12px;color:#888;margin-top:14px">La Squadra AI ricorderà questa call nelle prossime conversazioni.</p>
        </div>`,
      }).catch(() => {})
    }
  } catch {}

  return NextResponse.json({ ok: true, summary: plan.summary || null, tasks: createdTasks.length, decisions: (plan.decisions || []).length, remembered: memItems.length, postedRecap })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'errore finalize', stack: String(e?.stack || '').slice(0, 300) }, { status: 200 })
  }
}
