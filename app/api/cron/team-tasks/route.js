export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { resolveWorkspace } from '../../../../lib/team/workspace'
import { callBrain } from '../../../../lib/agent/gateway'
import { getTeamAgent, teamSkillPrompt, teamRoster } from '../../../../lib/agent/team'
import { notifyAssignment, sendEmail } from '../../../../lib/team/notify'

// ============================================================================
//  TASK AUTOMATICI DELLA SQUADRA AI — gli agenti trasformano i dati reali in
//  task concreti, li creano nel board (tab Progetti & Task) e li assegnano ai
//  membri invitati (per ruolo). Ogni assegnatario riceve l'email automatica
//  (notifyAssignment). Chiara annuncia in LyftTalk e l'owner riceve un report.
//
//  Auth: cron Bearer CRON_SECRET (workspace = LYFT_OWNER_USER_ID, dati via
//  x-internal-cron) OPPURE owner loggato (resolveWorkspace, dati via cookie).
// ============================================================================

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

function isAuthorizedCron(req) {
  const secret = process.env.CRON_SECRET
  return !!secret && (req.headers.get('authorization') || '') === `Bearer ${secret}`
}

export async function GET(req) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY assente' }, { status: 500 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'no admin' }, { status: 500 })

  // ── Auth + workspace ──────────────────────────────────────────────────────
  let workspaceId, dataAuthHeaders
  if (isAuthorizedCron(req)) {
    workspaceId = process.env.LYFT_OWNER_USER_ID
    if (!workspaceId) return NextResponse.json({ ok: false, error: 'LYFT_OWNER_USER_ID assente' }, { status: 500 })
    dataAuthHeaders = { 'x-internal-cron': process.env.CRON_SECRET || '' }
  } else {
    const ws = await resolveWorkspace()
    if (!ws) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 })
    workspaceId = ws.workspaceId
    const cookie = req.headers.get('cookie') || ''
    dataAuthHeaders = cookie ? { cookie } : {}
  }

  // ── Membri assegnabili (attivi o invitati) ────────────────────────────────
  const { data: membersRaw } = await admin
    .from('team_members').select('id, email, full_name, roles, status, user_id')
    .eq('workspace_id', workspaceId).in('status', ['active', 'invited'])
  const members = membersRaw || []
  const ownerMember = members.find(m => (m.roles || []).includes('admin') || m.user_id === workspaceId) || members[0] || null
  const byEmail = new Map(members.map(m => [(m.email || '').toLowerCase(), m]))
  const memberList = members.length
    ? members.map(m => `- ${m.full_name || m.email} <${m.email}> · ruoli: ${(m.roles || []).join(', ') || '—'}`).join('\n')
    : '(nessun collaboratore invitato: assegna tutto a "owner")'

  // ── Dati reali del brand ──────────────────────────────────────────────────
  const origin = new URL(req.url).origin
  let liveData = null
  try {
    const r = await fetch(`${origin}/api/agent-context?preset=last_30d&days=30`, { cache: 'no-store', headers: dataAuthHeaders })
    if (r.ok) liveData = await r.json()
  } catch {}

  // Task aperti esistenti → evita duplicati + permette agli agent di "controllare".
  const { data: openTasks } = await admin
    .from('tasks').select('title, status, due_date, priority')
    .eq('workspace_id', workspaceId).in('status', ['todo', 'in_progress', 'in_review'])
    .order('created_at', { ascending: false }).limit(40)
  const openList = (openTasks || []).map(t => `- "${t.title}" [${t.status}${t.due_date ? ', scad. ' + t.due_date : ''}]`).join('\n') || '(nessuno)'

  // ── Pianificazione: Chiara orchestra il team → tasks concreti (JSON) ───────
  const ceo = getTeamAgent('ceo')
  const roster = teamRoster()
  const planSkill = `${teamSkillPrompt(ceo)}

Stai facendo la pianificazione operativa della settimana per il team. Trasforma le evidenze dei DATI LIVE in task CONCRETI, specifici e azionabili, e assegna ognuno alla persona giusta del team (per ruolo).`
  const guardTail = `Produci SOLO JSON valido con questo schema:
{"summary": string, "tasks": [{"title": string, "description": string, "priority": "low"|"medium"|"high"|"urgent", "agent": string, "assignee_email": string, "due_in_days": number}]}
Regole:
- 3-5 task, ognuno nato da un'evidenza REALE dei DATI LIVE (cita il numero/nome reale nella description). NIENTE task inventati o generici.
- NON ricreare task già aperti (lista qui sotto).
- "agent" = id dell'agente che propone il task tra: ${roster.map(r => `${r.id} (${r.name}, ${r.role})`).join(', ')}.
- "assignee_email" = l'email di un collaboratore della lista MEMBRI a cui assegnare il task (scegli per ruolo/competenza); se nessuno è adatto usa esattamente "owner".
- "title" breve e operativo; "description" 1-2 frasi con il PERCHÉ (dato reale) e il COSA fare; "due_in_days" tra 1 e 14.
MEMBRI:
${memberList}
TASK GIÀ APERTI (non duplicare):
${openList}`

  let plan = null
  try {
    const res = await callBrain({
      skill: { id: 'team-planner', systemPrompt: planSkill, guard: 'Ogni nome/numero citato DEVE essere nei DATI LIVE. Non inventare.' },
      query: 'Pianifica i task operativi della settimana per il team a partire dai dati reali.',
      data: liveData,
      dataLabel: 'DATI LIVE del brand (numeri e nomi REALI):',
      dataMax: 45000,
      json: true,
      temperature: 0.4,
      guardTail,
    })
    plan = res.content
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'planning fallito' }, { status: 500 })
  }
  // Il modello può mettere l'array sotto chiavi diverse o al top level.
  const rawTasks = Array.isArray(plan) ? plan
    : Array.isArray(plan?.tasks) ? plan.tasks
    : Array.isArray(plan?.task) ? plan.task
    : Array.isArray(plan?.items) ? plan.items
    : Array.isArray(plan?.plan) ? plan.plan : []
  const proposed = rawTasks.slice(0, 5)
  if (!proposed.length) {
    const debug = new URL(req.url).searchParams.get('debug')
    return NextResponse.json({
      ok: true, created: 0, note: 'nessun task proposto', summary: plan?.summary || null,
      ...(debug ? { _planType: Array.isArray(plan) ? 'array' : typeof plan, _planKeys: plan && !Array.isArray(plan) ? Object.keys(plan) : null, _plan: plan, _members: members.length, _hasData: !!liveData } : {}),
    })
  }

  // ── Crea i task + assegna + email ─────────────────────────────────────────
  const created = []
  for (const t of proposed) {
    const title = String(t.title || '').trim()
    if (!title) continue
    const proposer = getTeamAgent(t.agent)
    const assignee = byEmail.get(String(t.assignee_email || '').toLowerCase()) || ownerMember
    const days = Math.min(14, Math.max(1, Number(t.due_in_days) || 7))
    const due = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
    const desc = `${t.description || ''}\n\n— Proposto da ${proposer ? `${proposer.name} (${proposer.role})` : 'Squadra AI'}`.trim()
    const row = {
      workspace_id: workspaceId, title,
      description: desc,
      status: 'todo',
      priority: PRIORITIES.includes(t.priority) ? t.priority : 'medium',
      assignee_id: assignee?.id || null,
      due_date: due,
      created_by: ownerMember?.id || null,
    }
    try {
      const { data, error } = await admin.from('tasks').insert(row).select('*').single()
      if (error) throw error
      created.push({ id: data.id, title: data.title, priority: data.priority, due_date: data.due_date, assignee: assignee?.full_name || assignee?.email || '—', proposer: proposer?.name || 'AI' })
      if (data.assignee_id) await notifyAssignment({ workspaceId, task: data, origin }).catch(() => {})
    } catch {}
  }

  // ── Annuncio in LyftTalk (Chiara) ─────────────────────────────────────────
  if (created.length) {
    try {
      const { data: chans } = await admin.from('channels').select('id, name')
        .eq('workspace_id', workspaceId).order('created_at', { ascending: true })
      const general = (chans || []).find(c => (c.name || '').toLowerCase() === 'generale') || (chans || [])[0]
      if (general) {
        const lines = created.map(c => `• ${c.title} → ${c.assignee} (scad. ${c.due_date})`).join('\n')
        await admin.from('channel_messages').insert({
          channel_id: general.id, workspace_id: workspaceId, author_id: null,
          author_name: `${ceo.name} · ${ceo.role}`,
          body: `Ho preparato i task della settimana per il team:\n${lines}\nLi trovate in Progetti & Task. Procediamo. 💪`,
        })
      }
    } catch {}
  }

  // ── Report email all'owner ────────────────────────────────────────────────
  if (created.length && ownerMember?.email) {
    const rows = created.map(c => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${c.title}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${c.assignee}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${c.priority}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${c.due_date}</td></tr>`).join('')
    await sendEmail({
      to: ownerMember.email,
      subject: `🤖 La Squadra AI ha creato ${created.length} task`,
      html: `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px">
        <h2 style="margin:0 0 8px">Task della settimana dalla Squadra AI</h2>
        <p style="color:#444">${plan?.summary ? String(plan.summary) : 'Task operativi generati dai dati reali del brand.'}</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px"><thead><tr>
          <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #333">Task</th>
          <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #333">Assegnato a</th>
          <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #333">Priorità</th>
          <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #333">Scadenza</th>
        </tr></thead><tbody>${rows}</tbody></table>
        <p style="margin-top:16px"><a href="${origin}" style="background:#7c5cff;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Apri il board</a></p>
      </div>`,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, created: created.length, summary: plan?.summary || null, tasks: created })
}
