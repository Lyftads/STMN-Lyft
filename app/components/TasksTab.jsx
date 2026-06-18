'use client'

import { Fragment, useEffect, useState, useCallback } from 'react'
import Icon from './ui/Icon'
import Avatar from './Avatar'
import { useI18n } from '../../lib/i18n/I18nProvider'

const PALETTE = ['#7b5bff', '#5b8bff', '#30d158', '#ff9f0a', '#ff375f', '#64d2ff', '#bf5af2', '#ffd60a', '#5ac8fa', '#ff6482']

// Modulo Team → Progetti & Task (Fase 1). Board Kanban + creazione task/progetti,
// assegnazione, priorità, scadenze, approvazione (aperta a tutti).
// Visibile a tutti i ruoli. Niente dipendenze esterne: fetch verso /api/tasks,
// /api/projects, /api/team-members.

const COLUMNS = [
  { id: 'todo', key: 'tk.colTodo', en: 'To do', label: 'Da fare', color: '#b0b0bd' },
  { id: 'in_progress', key: 'tk.colInProgress', en: 'In progress', label: 'In corso', color: '#0a84ff' },
  { id: 'in_review', key: 'tk.colInReview', en: 'In review', label: 'In revisione', color: '#ff9f0a' },
  { id: 'approved', key: 'tk.colApproved', en: 'Approved', label: 'Approvato', color: '#30d158' },
  { id: 'done', key: 'tk.colDone', en: 'Done', label: 'Fatto', color: '#64d2ff' },
]
const PRIORITIES = [
  { id: 'low', key: 'tk.prioLow', en: 'Low', label: 'Bassa', color: '#30d158' },
  { id: 'medium', key: 'tk.prioMedium', en: 'Medium', label: 'Media', color: '#ffd60a' },
  { id: 'high', key: 'tk.prioHigh', en: 'High', label: 'Alta', color: '#ff9f0a' },
  { id: 'urgent', key: 'tk.prioUrgent', en: 'Urgent', label: 'Urgente', color: '#ff375f' },
]
// Righe per il raggruppamento "Priorità" (dalla più alta alla più bassa).
const PRIORITY_ROWS = [
  { id: 'urgent', key: 'tk.prioUrgent', en: 'Urgent', label: 'Urgente', color: '#ff375f' },
  { id: 'high', key: 'tk.prioHigh', en: 'High', label: 'Alta', color: '#ff9f0a' },
  { id: 'medium', key: 'tk.prioMedium', en: 'Medium', label: 'Media', color: '#ffd60a' },
  { id: 'low', key: 'tk.prioLow', en: 'Low', label: 'Bassa', color: '#30d158' },
]

const card = { background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }
const input = { background: '#14141d', border: '1px solid #3d3d4c', borderRadius: 8, padding: '9px 11px', color: 'var(--text)', fontSize: 14, fontFamily: 'Barlow', width: '100%' }
const PANEL = { background: '#15151f', border: '1px solid #3d3d4c', borderRadius: 12, padding: 18 }
const btn = { background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 8, padding: '8px 14px', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' }
const btnGhost = { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow' }

export default function TasksTab() {
  const { t, intlLocale } = useI18n()
  const [projects, setProjects] = useState([])
  const [members, setMembers] = useState([])
  const [seats, setSeats] = useState(null)
  const [tasks, setTasks] = useState([])
  const [me, setMe] = useState(null)
  const [rolesCatalog, setRolesCatalog] = useState([])
  const [roleLabels, setRoleLabels] = useState({})
  const [showTeam, setShowTeam] = useState(false)
  const [view, setView] = useState('board')
  const [activeProject, setActiveProject] = useState('all')
  const [personProject, setPersonProject] = useState('all')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [form, setForm] = useState({ title: '', assignee_id: '', priority: 'medium', due_date: '', project_id: '' })

  const memberName = useCallback((id) => {
    const m = members.find(x => x.id === id)
    if (!m) return '—'
    return m.full_name || m.email
  }, [members])

  const load = useCallback(async () => {
    try {
      const [p, mem, t] = await Promise.all([
        fetch('/api/projects', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        fetch('/api/team-members', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        fetch('/api/tasks', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
      ])
      setProjects(p.projects || [])
      setMembers(mem.members || [])
      setSeats(mem.seats || null)
      setRolesCatalog(mem.roles || [])
      setRoleLabels(mem.roleLabels || {})
      setMe(t.me || mem.me || null)
      setTasks(t.tasks || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function addProject() {
    const name = prompt(t('tk.promptProjectName', null, 'Project name:'))
    if (!name || !name.trim()) return
    const r = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(x => x.json())
    if (r.ok && r.project) { setProjects(prev => [...prev, r.project]); setActiveProject(r.project.id) }
  }

  async function deleteProject(id) {
    if (!confirm(t('tk.confirmDeleteProject', null, 'Delete the project? Tasks will remain (as "No project").'))) return
    setProjects(prev => prev.filter(p => p.id !== id))
    setTasks(prev => prev.map(t => t.project_id === id ? { ...t, project_id: null } : t))
    if (activeProject === id) setActiveProject('all')
    await fetch(`/api/projects?id=${id}`, { method: 'DELETE' })
  }

  async function createTask() {
    if (!form.title.trim()) return
    setCreating(true)
    try {
      const body = {
        title: form.title.trim(),
        assignee_id: form.assignee_id || null,
        priority: form.priority,
        due_date: form.due_date || null,
        project_id: form.project_id || (activeProject !== 'all' ? activeProject : null),
      }
      const r = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json())
      if (r.ok && r.task) {
        setTasks(prev => [r.task, ...prev])
        setForm({ title: '', assignee_id: '', priority: 'medium', due_date: '', project_id: '' })
        setDetailId(r.task.id) // apri subito il dettaglio per scrivere note/allegare file
      }
    } finally {
      setCreating(false)
    }
  }

  async function patchTask(id, patch) {
    // ottimistico
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
    const r = await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) }).then(x => x.json())
    if (r.ok && r.task) setTasks(prev => prev.map(t => t.id === id ? r.task : t))
  }

  async function deleteTask(id) {
    if (!confirm(t('tk.confirmDeleteTask', null, 'Delete the task?'))) return
    setTasks(prev => prev.filter(t => t.id !== id))
    if (detailId === id) setDetailId(null)
    await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
  }

  async function uploadFile(taskId, file) {
    const fd = new FormData()
    fd.append('taskId', taskId)
    fd.append('file', file)
    const r = await fetch('/api/tasks/attachments', { method: 'POST', body: fd })
      .then(x => x.json()).catch(() => ({ ok: false, error: t('tk.netError', null, 'Network error') }))
    if (r.ok && r.task) setTasks(prev => prev.map(t => t.id === taskId ? r.task : t))
    else alert(r.error || t('tk.uploadFailed', null, 'Upload failed'))
    return r
  }

  async function downloadAttachment(path) {
    const r = await fetch(`/api/tasks/attachments?path=${encodeURIComponent(path)}`)
      .then(x => x.json()).catch(() => ({}))
    if (r.ok && r.url) window.open(r.url, '_blank')
    else alert(r.error || t('tk.downloadUnavailable', null, 'Download unavailable'))
  }

  async function deleteAttachment(taskId, path) {
    if (!confirm(t('tk.confirmDeleteFile', null, 'Delete the file?'))) return
    const r = await fetch(`/api/tasks/attachments?taskId=${taskId}&path=${encodeURIComponent(path)}`, { method: 'DELETE' })
      .then(x => x.json()).catch(() => ({}))
    if (r.ok && r.task) setTasks(prev => prev.map(t => t.id === taskId ? r.task : t))
  }

  async function inviteMember(email, roles) {
    const r = await fetch('/api/team-members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, roles }) })
      .then(x => x.json()).catch(() => ({ ok: false, error: t('tk.netError', null, 'Network error') }))
    if (r.ok && r.member) {
      setMembers(prev => {
        const i = prev.findIndex(m => m.email === r.member.email)
        if (i >= 0) { const c = [...prev]; c[i] = r.member; return c }
        return [...prev, r.member]
      })
    } else alert(r.error || t('tk.inviteError', null, 'Invite error'))
    return r
  }

  async function updateMemberRoles(id, roles) {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, roles } : m))
    await fetch('/api/team-members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, roles }) })
  }

  async function removeMember(id) {
    if (!confirm(t('tk.confirmRemoveMember', null, 'Remove the member from the team?'))) return
    setMembers(prev => prev.filter(m => m.id !== id))
    await fetch(`/api/team-members?id=${id}`, { method: 'DELETE' })
  }

  const visible = tasks.filter(t =>
    activeProject === 'all' ? true : activeProject === 'none' ? !t.project_id : t.project_id === activeProject)
  const detailTask = detailId ? tasks.find(t => t.id === detailId) : null
  const myTasks = tasks.filter(t => me?.memberId && t.assignee_id === me.memberId)

  if (loading) {
    return <div style={{ padding: 40, color: '#b0b0bd', fontFamily: 'Barlow' }}>{t('tk.loadingBoard', null, 'Loading board…')}</div>
  }

  return (
    <div style={{ fontFamily: 'Barlow', color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Barlow Condensed', fontSize: 28, fontWeight: 700 }}>{t('tk.title', null, 'Projects & Tasks')}</h2>
          <div style={{ color: '#b0b0bd', fontSize: 13 }}>{t('tk.subtitle', null, 'Team assignment, deadlines, review and approval')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, background: '#14141d', borderRadius: 10, padding: 4 }}>
            <button onClick={() => setView(view === 'mine' ? 'mine' : 'board')} style={{ ...btnGhost, border: 'none', background: view !== 'overview' ? 'linear-gradient(135deg,#7b5bff,#5b8bff)' : 'transparent', fontWeight: view !== 'overview' ? 700 : 400 }}>{t('tk.board', null, 'Board')}</button>
            <button onClick={() => setView('overview')} style={{ ...btnGhost, border: 'none', background: view === 'overview' ? 'linear-gradient(135deg,#7b5bff,#5b8bff)' : 'transparent', fontWeight: view === 'overview' ? 700 : 400 }}><Icon name="chart-bar" size={14} /> {t('tk.charts', null, 'Charts')}</button>
          </div>
          {me?.isAdmin && <button style={btnGhost} onClick={() => setShowTeam(true)}><Icon name="users" size={14} /> {t('tk.teamMgmt', null, 'Team management')}</button>}
        </div>
      </div>

      {(view === 'board' || view === 'mine') && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Sidebar progetti */}
          <aside style={{ ...PANEL, width: 220, flexShrink: 0, padding: 10 }}>
            <div style={{ fontSize: 11, color: '#b0b0bd', textTransform: 'uppercase', letterSpacing: '.08em', padding: '4px 8px 8px' }}>{t('tk.projects', null, 'Projects')}</div>
            <SideItem label={t('tk.allProjects', null, 'All projects')} count={tasks.length} active={view === 'board' && activeProject === 'all'} onClick={() => { setActiveProject('all'); setView('board') }} />
            {projects.map(p => (
              <SideItem key={p.id} label={p.name} color={p.color || '#7b5bff'} count={tasks.filter(t => t.project_id === p.id).length}
                active={view === 'board' && activeProject === p.id} onClick={() => { setActiveProject(p.id); setView('board') }} onDelete={() => deleteProject(p.id)} />
            ))}
            {tasks.some(t => !t.project_id) && (
              <SideItem label={t('tk.noProject', null, 'No project')} count={tasks.filter(t => !t.project_id).length} active={view === 'board' && activeProject === 'none'} onClick={() => { setActiveProject('none'); setView('board') }} />
            )}
            <button style={{ ...btnGhost, width: '100%', marginTop: 10 }} onClick={addProject}>+ {t('tk.newProject', null, 'New project')}</button>
            <div style={{ height: 1, background: 'var(--border)', margin: '12px 4px' }} />
            <SideItem label={`✅ ${t('tk.myTasks', null, 'My tasks')}`} count={myTasks.length} active={view === 'mine'} onClick={() => setView('mine')} />
          </aside>

          {/* Contenuto */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {view === 'mine' && (
              <>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 20, marginBottom: 14 }}>{t('tk.myTasks', null, 'My tasks')} · {myTasks.length}</div>
                <SwimlaneBoard tasks={myTasks} memberName={memberName} onPatch={patchTask} onDelete={deleteTask} onOpen={setDetailId} />
              </>
            )}
            {view === 'board' && (<>
            {/* Nuovo task */}
            <div style={{ ...card, marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 240px' }}>
                <label style={{ fontSize: 11, color: '#b0b0bd', textTransform: 'uppercase', letterSpacing: '.08em' }}>{t('tk.newTask', null, 'New task')}</label>
                <input style={input} placeholder={t('tk.taskTitlePlaceholder', null, 'Task title…')} value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') createTask() }} />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label style={{ fontSize: 11, color: '#b0b0bd' }}>{t('tk.assignee', null, 'Assignee')}</label>
                <select style={input} value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}>
                  <option value="">{t('tk.none', null, 'None')}</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ fontSize: 11, color: '#b0b0bd' }}>{t('tk.priority', null, 'Priority')}</label>
                <select style={input} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p.id} value={p.id}>{t(p.key, null, p.en)}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 130px' }}>
                <label style={{ fontSize: 11, color: '#b0b0bd' }}>{t('tk.dueDate', null, 'Due date')}</label>
                <input type="date" style={input} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <button style={{ ...btn, opacity: creating ? 0.6 : 1 }} disabled={creating} onClick={createTask}>+ {t('tk.create', null, 'Create')}</button>
            </div>

            {/* Griglia: colonne di stato × righe di priorità */}
            <SwimlaneBoard tasks={visible} memberName={memberName} onPatch={patchTask} onDelete={deleteTask} onOpen={setDetailId} />
            </>)}
          </div>
        </div>
      )}

      {view === 'overview' && (() => {
        const isDone = t => t.status === 'done' || t.status === 'approved'
        const compDate = t => t.approved_at || t.updated_at || t.created_at
        const isLate = t => isDone(t) && t.due_date && new Date(compDate(t)) > new Date(t.due_date + 'T23:59:59')
        // distribuzione per stato
        const byStatus = COLUMNS.map(c => ({ label: t(c.key, null, c.en), color: c.color, value: tasks.filter(t => t.status === c.id).length }))
        const totalTasks = tasks.length
        const doneTasks = tasks.filter(isDone)
        const lateTasks = doneTasks.filter(isLate)
        const onTime = doneTasks.length - lateTasks.length
        const openTasks = totalTasks - doneTasks.length
        const punct = [
          { label: t('tk.onTime', null, 'On time'), color: '#30d158', value: onTime },
          { label: t('tk.late', null, 'Late'), color: '#ff375f', value: lateTasks.length },
          { label: t('tk.stillOpen', null, 'Still open'), color: '#5b6b7b', value: openTasks },
        ]
        // progetti
        const projRows = [...projects.map(p => ({ id: p.id, name: p.name, color: p.color || '#7b5bff' })), { id: 'none', name: t('tk.noProject', null, 'No project'), color: '#5b6b7b' }]
          .map(p => {
            const ts = tasks.filter(t => (p.id === 'none' ? !t.project_id : t.project_id === p.id))
            const done = ts.filter(isDone)
            const late = done.some(isLate)
            return { ...p, total: ts.length, done: done.length, pct: ts.length ? Math.round(done.length / ts.length * 100) : 0, completed: ts.length > 0 && done.length === ts.length, late }
          }).filter(p => p.total > 0)
        const projDone = projRows.filter(p => p.completed)
        const projLate = projDone.filter(p => p.late)
        const pctOf = (n, d) => d ? Math.round(n / d * 100) : 0
        // completamenti nel tempo (ultimi 14 giorni, cumulativo)
        const days = []
        for (let i = 13; i >= 0; i--) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i); days.push({ d, label: `${d.getDate()}/${d.getMonth() + 1}`, value: 0 }) }
        for (const t of doneTasks) { const cd = new Date(compDate(t)); cd.setHours(0, 0, 0, 0); for (const day of days) if (cd <= day.d) day.value++ }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <MiniStat label={t('tk.totalProjects', null, 'Total projects')} value={projRows.length} />
              <MiniStat label={t('tk.completedProjects', null, 'Completed projects')} value={projDone.length} sub={t('tk.pctOfTotal', { pct: pctOf(projDone.length, projRows.length) }, '{pct}% of total')} color="#30d158" />
              <MiniStat label={t('tk.completedLate', null, 'Completed late')} value={projLate.length} sub={t('tk.pctOfCompleted', { pct: pctOf(projLate.length, projDone.length) }, '{pct}% of completed')} color="#ff375f" />
              <MiniStat label={t('tk.completedTasks', null, 'Completed tasks')} value={doneTasks.length} sub={t('tk.pctOfN', { pct: pctOf(doneTasks.length, totalTasks), total: totalTasks }, '{pct}% of {total}')} color="#5b8bff" />
            </div>

            {/* Donut: stato task + puntualità */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
              <div style={{ ...card }}>
                <div style={{ fontSize: 13, color: '#b0b0bd', fontWeight: 700, marginBottom: 12 }}>{t('tk.tasksByStatus', null, 'Tasks by status')}</div>
                <DonutLegend data={byStatus} total={totalTasks} />
              </div>
              <div style={{ ...card }}>
                <div style={{ fontSize: 13, color: '#b0b0bd', fontWeight: 700, marginBottom: 12 }}>{t('tk.completionPunctuality', null, 'Completion punctuality')}</div>
                <DonutLegend data={punct} total={totalTasks} />
              </div>
            </div>

            {/* Avanzamento progetti */}
            <div style={{ ...card }}>
              <div style={{ fontSize: 13, color: '#b0b0bd', fontWeight: 700, marginBottom: 14 }}>{t('tk.projectProgress', null, 'Project progress')}</div>
              {projRows.length === 0 ? <div style={{ color: '#b0b0bd', fontSize: 13 }}>{t('tk.noTask', null, 'No tasks.')}</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {projRows.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                      <span style={{ width: 150, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}{p.completed && <span title={p.late ? t('tk.completedLateTip', null, 'Completed late') : t('tk.completedTip', null, 'Completed')} style={{ marginLeft: 5 }}>{p.late ? <Icon name="warning" size={12} /> : <Icon name="check-circle" size={12} />}</span>}</span>
                      <div style={{ flex: 1, height: 14, background: '#14141d', borderRadius: 7, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ width: `${p.pct}%`, height: '100%', background: p.late && p.completed ? 'linear-gradient(90deg,#ff9f0a,#ff375f)' : 'linear-gradient(90deg,#7b5bff,#5b8bff)' }} />
                      </div>
                      <span style={{ width: 96, textAlign: 'right', fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{p.pct}% · {p.done}/{p.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Analisi per persona (filtrabile per progetto) */}
            {(() => {
              const ppTasks = personProject === 'all' ? tasks : tasks.filter(t => personProject === 'none' ? !t.project_id : t.project_id === personProject)
              const peopleRows = [...members.map(m => ({ id: m.id, name: m.full_name || m.email, avatar: m.avatar_url })), { id: 'none', name: t('tk.notAssigned', null, 'Unassigned'), avatar: null }]
                .map(m => {
                  const ts = ppTasks.filter(t => (m.id === 'none' ? !t.assignee_id : t.assignee_id === m.id))
                  const done = ts.filter(isDone); const late = done.filter(isLate)
                  return { ...m, total: ts.length, done: done.length, late: late.length, pct: ts.length ? Math.round(done.length / ts.length * 100) : 0 }
                }).filter(m => m.total > 0).sort((a, b) => b.total - a.total)
              const ppDonut = peopleRows.map((m, i) => ({ label: m.name, color: PALETTE[i % PALETTE.length], value: m.total }))
              return (
                <div style={{ ...card }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, color: '#b0b0bd', fontWeight: 700, flex: 1 }}>{t('tk.perPersonAnalysis', null, 'Per-person analysis')}</div>
                    <select style={{ ...input, width: 'auto' }} value={personProject} onChange={e => setPersonProject(e.target.value)}>
                      <option value="all">{t('tk.allProjects', null, 'All projects')}</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      <option value="none">{t('tk.noProject', null, 'No project')}</option>
                    </select>
                  </div>
                  {peopleRows.length === 0 ? <div style={{ color: '#b0b0bd', fontSize: 13 }}>{t('tk.noTasksAssigned', null, 'No tasks assigned.')}</div> : (
                    <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: 11.5, color: '#b0b0bd', marginBottom: 8 }}>{t('tk.taskDistributionPerPerson', null, 'Task distribution per person')}</div>
                        <DonutLegend data={ppDonut} total={ppTasks.length} />
                      </div>
                      <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {peopleRows.map((m, i) => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar name={m.name} url={m.avatar} size={30} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{m.name}</span>
                                <span style={{ color: '#b0b0bd', fontVariantNumeric: 'tabular-nums' }}>{m.done}/{m.total} · {m.pct}%{m.late > 0 ? ` · {m.late}` : ''}</span>
                              </div>
                              <div style={{ height: 9, background: '#14141d', borderRadius: 5, overflow: 'hidden' }}>
                                <div style={{ width: `${m.pct}%`, height: '100%', background: PALETTE[i % PALETTE.length] }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Linea: completamenti cumulativi */}
            <div style={{ ...card }}>
              <div style={{ fontSize: 13, color: '#b0b0bd', fontWeight: 700, marginBottom: 6 }}>{t('tk.tasksCompletedOverTime', null, 'Tasks completed over time')} <span style={{ fontWeight: 400 }}>· {t('tk.last14Cumulative', null, 'last 14 days (cumulative)')}</span></div>
              <LineChart days={days} />
            </div>
          </div>
        )
      })()}

      {detailTask && (
        <TaskDetail
          task={detailTask}
          memberName={memberName}
          onClose={() => setDetailId(null)}
          onPatch={patchTask}
          onUpload={uploadFile}
          onDownload={downloadAttachment}
          onDeleteAttachment={deleteAttachment}
        />
      )}

      {showTeam && (
        <TeamModal
          members={members}
          rolesCatalog={rolesCatalog}
          roleLabels={roleLabels}
          ownerUserId={me?.userId}
          onClose={() => setShowTeam(false)}
          seats={seats}
          onInvite={inviteMember}
          onUpdateRoles={updateMemberRoles}
          onRemove={removeMember}
        />
      )}
    </div>
  )
}

function TaskCard({ t, memberName, onPatch, onDelete, onOpen }) {
  const { t: tr } = useI18n()
  const prio = PRIORITIES.find(p => p.id === (t.priority || 'medium')) || PRIORITIES[1]
  const overdue = t.due_date && t.status !== 'done' && t.status !== 'approved' && new Date(t.due_date) < new Date(new Date().toDateString())
  return (
    <div onClick={onOpen} title={tr('tk.openForNotes', null, 'Open for notes, details and attachments')} style={{ ...card, padding: 12, cursor: 'pointer', borderLeft: `4px solid ${prio.color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>{t.title}</div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(t.id) }} title={tr('tk.delete', null, 'Delete')} style={{ background: 'none', border: 'none', color: '#48484a', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: prio.color, border: `1px solid ${prio.color}55`, borderRadius: 6, padding: '2px 6px', textTransform: 'uppercase' }}>{tr(prio.key, null, prio.en)}</span>
        {t.due_date && <span style={{ fontSize: 11, color: overdue ? '#ff375f' : '#b0b0bd' }}><Icon name="calendar" size={12} /> {t.due_date}</span>}
        {t.description && <span title={tr('tk.containsNotes', null, 'Contains notes')} style={{ fontSize: 11, color: '#b0b0bd' }}><Icon name="file" size={12} /></span>}
        {Array.isArray(t.attachments) && t.attachments.length > 0 && <span title={tr('tk.attachments', null, 'Attachments')} style={{ fontSize: 11, color: '#b0b0bd' }}><Icon name="paperclip" size={12} /> {t.attachments.length}</span>}
      </div>
      <div style={{ fontSize: 12, color: '#b0b0bd', marginTop: 8 }}><Icon name="user" size={12} /> {memberName(t.assignee_id)}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
        <select value={t.status || 'todo'} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); onPatch(t.id, { status: e.target.value }) }}
          style={{ ...input, width: 'auto', flex: 1, padding: '5px 8px', fontSize: 12 }}>
          {COLUMNS.map(c => <option key={c.id} value={c.id}>{tr(c.key, null, c.en)}</option>)}
        </select>
        {t.status === 'in_review' && (
          <button onClick={(e) => { e.stopPropagation(); onPatch(t.id, { status: 'approved' }) }}
            style={{ background: '#30d158', border: 'none', borderRadius: 7, padding: '6px 10px', color: '#04210f', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}><Icon name="check" size={13} /> {tr('tk.approve', null, 'Approve')}</button>
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#7b5bff', fontWeight: 600 }}><Icon name="file" size={12} /> {tr('tk.openForNotesShort', null, 'Open for notes & attachments')}</div>
    </div>
  )
}

function fmtSize(b) {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function TaskDetail({ task, memberName, onClose, onPatch, onUpload, onDownload, onDeleteAttachment }) {
  const { t, intlLocale } = useI18n()
  const [desc, setDesc] = useState(task.description || '')
  const [uploading, setUploading] = useState(false)
  useEffect(() => { setDesc(task.description || '') }, [task.id])

  const saveDesc = () => { if (desc !== (task.description || '')) onPatch(task.id, { description: desc }) }
  const saveAndClose = () => { saveDesc(); onClose() }

  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  useEffect(() => {
    let alive = true
    fetch(`/api/task-comments?task_id=${task.id}`, { cache: 'no-store' })
      .then(r => r.json()).then(d => { if (alive) setComments(d.comments || []) }).catch(() => {})
    return () => { alive = false }
  }, [task.id])

  async function addComment() {
    const body = newComment.trim()
    if (!body) return
    setNewComment('')
    const r = await fetch('/api/task-comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_id: task.id, body }) })
      .then(x => x.json()).catch(() => ({}))
    if (r.ok && r.comment) setComments(prev => [...prev, r.comment])
  }

  const attachments = Array.isArray(task.attachments) ? task.attachments : []

  async function onPick(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try { await onUpload(task.id, file) } finally { setUploading(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ ...PANEL, padding: 0, width: 'min(640px, 100%)', maxWidth: 640, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ overflowY: 'auto', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <input
            defaultValue={task.title}
            onBlur={e => { const v = e.target.value.trim(); if (v && v !== task.title) onPatch(task.id, { title: v }) }}
            style={{ ...input, fontSize: 18, fontWeight: 700, fontFamily: 'Barlow Condensed', border: 'none', padding: '4px 0', background: 'transparent' }}
          />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#b0b0bd', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: '#b0b0bd', marginBottom: 12 }}>{t('tk.assignedTo', { name: memberName(task.assignee_id) }, 'Assigned to {name}')}</div>

        <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#b0b0bd' }}>
            {t('tk.priority', null, 'Priority')}
            <select value={task.priority || 'medium'} onChange={e => onPatch(task.id, { priority: e.target.value })} style={{ ...input, width: 'auto', padding: '5px 8px', fontSize: 12 }}>
              {PRIORITIES.map(p => <option key={p.id} value={p.id}>{t(p.key, null, p.en)}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#b0b0bd' }}>
            {t('tk.status', null, 'Status')}
            <select value={task.status || 'todo'} onChange={e => onPatch(task.id, { status: e.target.value })} style={{ ...input, width: 'auto', padding: '5px 8px', fontSize: 12 }}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{t(c.key, null, c.en)}</option>)}
            </select>
          </label>
        </div>

        {/* Note / dettagli */}
        <label style={{ fontSize: 12, color: '#d0d0d8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>{t('tk.notesDetails', null, 'Notes / details · what to do')}</label>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onBlur={saveDesc}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveAndClose() } }}
          placeholder={t('tk.notesPlaceholder', null, 'Write description, to-do, instructions here…  (Ctrl/Cmd + Enter to save)')}
          rows={6}
          style={{ ...input, marginTop: 6, resize: 'vertical', lineHeight: 1.55 }}
        />

        {/* Allegati */}
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: 11, color: '#b0b0bd', textTransform: 'uppercase', letterSpacing: '.08em' }}>{t('tk.attachments', null, 'Attachments')}</label>
          <label style={{ ...btnGhost, cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
            {uploading ? t('tk.loading', null, 'Loading…') : `+ ${t('tk.attachFile', null, 'Attach file')}`}
            <input type="file" hidden disabled={uploading} onChange={onPick}
              accept=".pdf,.csv,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.doc,.docx,.txt" />
          </label>
        </div>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attachments.length === 0 && <div style={{ color: '#48484a', fontSize: 12 }}>{t('tk.noAttachments', null, 'No attachments. PDF, CSV, images, Excel, Word (max ~4MB).')}</div>}
          {attachments.map(a => (
            <div key={a.path} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Icon name="file" size={13} /> {a.name}</span>
              <span style={{ fontSize: 11, color: '#b0b0bd' }}>{fmtSize(a.size)}</span>
              <button onClick={() => onDownload(a.path)} style={{ ...btnGhost, padding: '4px 10px' }}>{t('tk.download', null, 'Download')}</button>
              <button onClick={() => onDeleteAttachment(task.id, a.path)} title={t('tk.delete', null, 'Delete')} style={{ background: 'none', border: 'none', color: '#ff375f', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>

        {/* Commenti */}
        <div style={{ marginTop: 18 }}>
          <label style={{ fontSize: 12, color: '#d0d0d8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>{t('tk.comments', null, 'Comments')}</label>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {comments.length === 0 && <div style={{ color: '#48484a', fontSize: 12 }}>{t('tk.noComments', null, 'No comments.')}</div>}
            {comments.map(c => (
              <div key={c.id} style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#b0b0bd', marginBottom: 2 }}>
                  <b style={{ color: 'var(--text)' }}>{c.author_name || t('tk.user', null, 'User')}</b> · {new Date(c.created_at).toLocaleString(intlLocale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{c.body}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input style={input} placeholder={t('tk.commentPlaceholder', null, 'Write a comment…')} value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() } }} />
            <button style={btn} onClick={addComment}>{t('tk.send', null, 'Send')}</button>
          </div>
        </div>

        </div>{/* fine corpo scrollabile */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 18px', borderTop: '1px solid var(--border)', background: '#15151f' }}>
          <button onClick={onClose} style={btnGhost}>{t('tk.close', null, 'Close')}</button>
          <button onClick={saveAndClose} style={btn}><Icon name="check" size={13} /> {t('tk.saveAndClose', null, 'Save and close')}</button>
        </div>
      </div>
    </div>
  )
}

const STATUS_BADGE = {
  invited: { key: 'tk.statusInvited', en: 'Invited', label: 'Invitato', color: '#ff9f0a' },
  active: { key: 'tk.statusActive', en: 'Active', label: 'Attivo', color: '#30d158' },
  disabled: { key: 'tk.statusDisabled', en: 'Disabled', label: 'Disattivato', color: '#b0b0bd' },
}

function TeamModal({ members, rolesCatalog, roleLabels, ownerUserId, seats, onClose, onInvite, onUpdateRoles, onRemove }) {
  const { t } = useI18n()
  const atLimit = seats && seats.limit != null && seats.used >= seats.limit
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState([])
  const [sending, setSending] = useState(false)
  const [created, setCreated] = useState(null)

  const toggle = (arr, r) => arr.includes(r) ? arr.filter(x => x !== r) : [...arr, r]

  async function submit() {
    if (!email.trim() || !email.includes('@')) { alert(t('tk.invalidEmail', null, 'Enter a valid email')); return }
    setSending(true)
    setCreated(null)
    try {
      const target = email.trim().toLowerCase()
      const r = await onInvite(target, roles)
      if (r && r.ok) {
        setEmail(''); setRoles([])
        setCreated({ email: target, password: r.tempPassword, emailSent: r.emailSent })
      }
    } finally { setSending(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ ...PANEL, width: 'min(680px, 100%)', maxWidth: 680, maxHeight: '86vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 700 }}>{t('tk.teamMgmt', null, 'Team management')}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#b0b0bd', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {/* Contatore posti del piano */}
        {seats && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, border: `1px solid ${atLimit ? 'rgba(255,55,95,0.4)' : 'var(--border)'}`, background: atLimit ? 'rgba(255,55,95,0.08)' : 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span style={{ fontWeight: 700 }}>{t('tk.teamUsersLabel', null, 'Team users:')} {seats.used}{seats.limit != null ? ` / ${seats.limit}` : ''}</span>
            <span style={{ color: '#b0b0bd' }}>{seats.limit == null ? t('tk.unlimitedPlan', null, 'unlimited on your plan') : atLimit ? t('tk.limitReached', null, '· limit reached, upgrade to add more') : t('tk.planLabel', { plan: seats.plan || '' }, '· {plan} plan')}</span>
          </div>
        )}

        {/* Invita */}
        <div style={{ marginTop: 16, padding: 14, border: '1px solid var(--border)', borderRadius: 10, opacity: atLimit ? 0.55 : 1 }}>
          <div style={{ fontSize: 12, color: '#b0b0bd', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{t('tk.inviteCollaborator', null, 'Invite a collaborator')}</div>
          <input style={input} placeholder={t('tk.emailPlaceholder', null, 'email@example.com')} value={email} onChange={e => setEmail(e.target.value)} disabled={atLimit} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {rolesCatalog.map(r => (
              <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 10px', border: `1px solid ${roles.includes(r) ? '#5b8bff' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={roles.includes(r)} onChange={() => setRoles(prev => toggle(prev, r))} />
                {roleLabels[r] || r}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <button style={{ ...btn, opacity: (sending || atLimit) ? 0.6 : 1 }} disabled={sending || atLimit} onClick={submit}>
              {sending ? t('tk.creatingAccess', null, 'Creating access…') : atLimit ? t('tk.planLimitReached', null, 'Plan limit reached') : t('tk.createAccessInvite', null, 'Create access & invite')}
            </button>
          </div>

          {created && (
            <div style={{ marginTop: 12, padding: 14, border: '1px solid #30d158', borderRadius: 10, background: 'rgba(48,209,88,0.08)' }}>
              <div style={{ fontWeight: 700, color: '#30d158', marginBottom: 6 }}><Icon name="check" size={13} /> {t('tk.accessReadyFor', { email: created.email }, 'Access ready for {email}')}</div>
              <div style={{ fontSize: 14 }}>{t('tk.tempPassword', null, 'Temporary password:')} <b style={{ fontFamily: 'monospace', userSelect: 'all', background: 'var(--surface)', padding: '2px 6px', borderRadius: 5 }}>{created.password}</b></div>
              <div style={{ fontSize: 12, color: '#b0b0bd', marginTop: 8 }}>
                {created.emailSent ? t('tk.emailSentToo', null, 'Also sent via email. ') : t('tk.emailNotSent', null, 'Email not sent: share these credentials yourself. ')}
                {t('tk.loginInstructions', null, 'The collaborator logs in at /login and can change the password from the reset page.')}
              </div>
            </div>
          )}
        </div>

        {/* Membri */}
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map(m => {
            const isOwner = m.user_id && m.user_id === ownerUserId || (m.roles || []).includes('admin')
            const badge = STATUS_BADGE[m.status] || STATUS_BADGE.invited
            return (
              <div key={m.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{m.full_name || m.email}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: badge.color, border: `1px solid ${badge.color}55`, borderRadius: 6, padding: '2px 6px', textTransform: 'uppercase' }}>{isOwner ? t('tk.admin', null, 'Admin') : t(badge.key, null, badge.en)}</span>
                  {!isOwner && (
                    <button
                      onClick={async () => {
                        const r = await onInvite(m.email, m.roles || [])
                        if (r && r.ok) setCreated({ email: m.email, password: r.tempPassword, emailSent: r.emailSent })
                      }}
                      title={t('tk.resendAccessTip', null, 'Regenerate and resend the password')}
                      style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }}
                    ><Icon name="key" size={12} /> {t('tk.resendAccess', null, 'Resend access')}</button>
                  )}
                  {!isOwner && <button onClick={() => onRemove(m.id)} title={t('tk.removeTip', null, 'Remove')} style={{ background: 'none', border: 'none', color: '#ff375f', cursor: 'pointer', fontSize: 16 }}>×</button>}
                </div>
                {m.full_name && <div style={{ fontSize: 12, color: '#b0b0bd' }}>{m.email}</div>}
                {!isOwner && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {rolesCatalog.map(r => {
                      const on = (m.roles || []).includes(r)
                      return (
                        <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 8px', border: `1px solid ${on ? '#5b8bff' : 'var(--border)'}`, borderRadius: 7, cursor: 'pointer' }}>
                          <input type="checkbox" checked={on} onChange={() => onUpdateRoles(m.id, toggle(m.roles || [], r))} />
                          {roleLabels[r] || r}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ProjectsView({ projects, tasks, onOpen, onAdd, onDelete }) {
  const { t } = useI18n()
  const stat = (pid) => {
    const items = tasks.filter(t => t.project_id === pid)
    const done = items.filter(t => t.status === 'done' || t.status === 'approved').length
    const review = items.filter(t => t.status === 'in_review').length
    return { total: items.length, done, review }
  }
  const noProject = tasks.filter(t => !t.project_id).length
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
      {projects.map(p => {
        const s = stat(p.id)
        return (
          <div key={p.id} onClick={() => onOpen(p.id)} style={{ ...card, cursor: 'pointer', borderTop: `3px solid ${p.color || '#7b5bff'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ fontFamily: 'Barlow Condensed', fontSize: 18, fontWeight: 700 }}>{p.name}</div>
              <button onClick={(e) => { e.stopPropagation(); onDelete(p.id) }} title={t('tk.deleteProject', null, 'Delete project')} style={{ background: 'none', border: 'none', color: '#ff375f', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
            {p.description && <div style={{ fontSize: 13, color: '#b0b0bd', marginTop: 4 }}>{p.description}</div>}
            <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 12, color: '#b0b0bd', flexWrap: 'wrap' }}>
              <span><b style={{ color: 'var(--text)' }}>{s.total}</b> {t('tk.task', null, 'tasks')}</span>
              {s.review > 0 && <span style={{ color: '#ff9f0a' }}>{t('tk.inReviewCount', { count: s.review }, '{count} in review')}</span>}
              <span style={{ color: '#30d158' }}>{t('tk.completedCount', { count: s.done }, '{count} completed')}</span>
            </div>
          </div>
        )
      })}
      {noProject > 0 && (
        <div onClick={() => onOpen('all')} style={{ ...card, cursor: 'pointer', borderTop: '3px solid #48484a' }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: 18, fontWeight: 700 }}>{t('tk.noProject', null, 'No project')}</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 12, color: '#b0b0bd' }}><span><b style={{ color: 'var(--text)' }}>{noProject}</b> {t('tk.task', null, 'tasks')}</span></div>
        </div>
      )}
      <div onClick={onAdd} style={{ ...card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b0b0bd', border: '1px dashed var(--border)', minHeight: 90 }}>+ {t('tk.newProject', null, 'New project')}</div>
    </div>
  )
}

// Card statistica compatta (numero grande + sottotitolo).
function MiniStat({ label, value, sub, color = 'var(--text)' }) {
  return (
    <div style={{ ...card }}>
      <div style={{ fontSize: 11.5, color: '#b0b0bd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#b0b0bd' }}>{sub}</div>}
    </div>
  )
}

// Donut + legenda con % e numero per ciascuna voce.
function DonutLegend({ data = [], total = 0, size = 150 }) {
  const { t } = useI18n()
  const sum = data.reduce((s, d) => s + d.value, 0) || 0
  const r = size / 2 - 12, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r
  let acc = 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#14141d" strokeWidth="14" />
        {sum > 0 && data.map((d, i) => {
          if (!d.value) return null
          const frac = d.value / sum, len = frac * C, off = acc * C
          acc += frac
          return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="14" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform={`rotate(-90 ${cx} ${cy})`} />
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--text)">{sum}</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize="10" fill="#b0b0bd">{t('tk.totalLower', null, 'total')}</text>
      </svg>
      <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: '#d0d0d8' }}>{d.label}</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{d.value}</span>
            <span style={{ color: '#b0b0bd', width: 42, textAlign: 'right' }}>{sum ? Math.round(d.value / sum * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Grafico lineare (area + linea) su una serie di {label, value}.
function LineChart({ days = [], h = 150 }) {
  const { t } = useI18n()
  if (!days || days.length < 2) return <div style={{ color: '#b0b0bd', fontSize: 13 }}>{t('tk.insufficientData', null, 'Insufficient data.')}</div>
  const w = 680, padL = 28, padB = 20, padT = 8
  const max = Math.max(1, ...days.map(d => d.value))
  const innerW = w - padL, innerH = h - padB - padT
  const x = i => padL + (innerW * i) / (days.length - 1)
  const y = v => padT + innerH - (v / max) * innerH
  const line = days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(days.length - 1).toFixed(1)} ${padT + innerH} L${padL} ${padT + innerH} Z`
  const ticks = [0, Math.ceil(max / 2), max]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="tk-line" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b8bff" stopOpacity="0.35" /><stop offset="1" stopColor="#5b8bff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((tk, i) => (
        <g key={i}>
          <line x1={padL} y1={y(tk)} x2={w} y2={y(tk)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={2} y={y(tk) + 3} fontSize="9" fill="#8e8e9e">{tk}</text>
        </g>
      ))}
      <path d={area} fill="url(#tk-line)" />
      <path d={line} fill="none" stroke="#5b8bff" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {days.map((d, i) => (i % 2 === 0 || i === days.length - 1) ? <text key={i} x={x(i)} y={h - 5} fontSize="9" fill="#8e8e9e" textAnchor="middle">{d.label}</text> : null)}
      <circle cx={x(days.length - 1)} cy={y(days[days.length - 1].value)} r="3" fill="#5b8bff" />
    </svg>
  )
}

function SideItem({ label, count, color, active, onClick, onDelete }) {
  const { t } = useI18n()
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: active ? 'rgba(123,91,255,0.18)' : 'transparent', border: active ? '1px solid rgba(123,91,255,0.5)' : '1px solid transparent', marginBottom: 2 }}>
      {color && <span style={{ width: 8, height: 8, borderRadius: 3, background: color, flexShrink: 0 }} />}
      <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? 'var(--text)' : '#d0d0d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: 11, color: '#b0b0bd' }}>{count}</span>
      {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete() }} title={t('tk.deleteProject', null, 'Delete project')} style={{ background: 'none', border: 'none', color: '#ff375f', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>}
    </div>
  )
}

// Griglia "tutto in uno": righe = priorità (Urgente/Alta/Media/Bassa),
// colonne = stato (Da fare/In corso/...). I task finiscono all'incrocio
// priorità×stato. Usata sia dalla board sia da "Le mie attività".
function SwimlaneBoard({ tasks, memberName, onPatch, onDelete, onOpen }) {
  const { t: tr } = useI18n()
  const gridCols = `120px repeat(${COLUMNS.length}, minmax(180px, 1fr))`
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, minWidth: 980 }}>
        {/* intestazione colonne (stato) */}
        <div />
        {COLUMNS.map(col => (
          <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px' }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: col.color }} />
            <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '.05em' }}>{tr(col.key, null, col.en)}</span>
          </div>
        ))}
        {/* righe per priorità */}
        {PRIORITY_ROWS.map(row => (
          <Fragment key={row.id}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 10, borderLeft: `4px solid ${row.color}`, background: `${row.color}14`, borderRadius: 8 }}>
              <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 15, color: row.color, textTransform: 'uppercase' }}>{tr(row.key, null, row.en)}</div>
              <div style={{ fontSize: 11, color: '#b0b0bd' }}>{tasks.filter(t => (t.priority || 'medium') === row.id).length} {tr('tk.task', null, 'tasks')}</div>
            </div>
            {COLUMNS.map(col => {
              const items = tasks.filter(t => (t.priority || 'medium') === row.id && (t.status || 'todo') === col.id)
              return (
                <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8, background: `${row.color}0a`, borderRadius: 8, minHeight: 60 }}>
                  {items.map(t => <TaskCard key={t.id} t={t} memberName={memberName} onPatch={onPatch} onDelete={onDelete} onOpen={() => onOpen(t.id)} />)}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
