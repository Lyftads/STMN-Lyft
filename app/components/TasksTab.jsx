'use client'

import { avvisa } from '../../lib/client/avviso'
import { Fragment, useEffect, useState, useCallback } from 'react'
import Icon from './ui/Icon'
import ProjectMembers from './ProjectMembers'
import ChatTab from './ChatTab'
import Avatar from './Avatar'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { MEMBER_TABS, TAB_LABELS } from '../../lib/team/roleTabs'

const PALETTE = ['#7b5bff', '#5b8bff', '#22c55e', '#f59e0b', '#ef4444', '#64d2ff', '#bf5af2', '#ffd60a', '#5ac8fa', '#ff6482']

// Modulo Team → Progetti & Task (Fase 1). Board Kanban + creazione task/progetti,
// assegnazione, priorità, scadenze, approvazione (aperta a tutti).
// Visibile a tutti i ruoli. Niente dipendenze esterne: fetch verso /api/tasks,
// /api/projects, /api/team-members.

const COLUMNS = [
  { id: 'todo', key: 'tk.colTodo', en: 'To do', label: 'Da fare', color: 'var(--text2)' },
  { id: 'in_progress', key: 'tk.colInProgress', en: 'In progress', label: 'In corso', color: '#0a84ff' },
  { id: 'in_review', key: 'tk.colInReview', en: 'In review', label: 'In revisione', color: '#f59e0b' },
  { id: 'approved', key: 'tk.colApproved', en: 'Approved', label: 'Approvato', color: '#22c55e' },
  { id: 'done', key: 'tk.colDone', en: 'Done', label: 'Fatto', color: 'var(--text)' },
]
const PRIORITIES = [
  { id: 'low', key: 'tk.prioLow', en: 'Low', label: 'Bassa', color: '#22c55e' },
  { id: 'medium', key: 'tk.prioMedium', en: 'Medium', label: 'Media', color: '#ffd60a' },
  { id: 'high', key: 'tk.prioHigh', en: 'High', label: 'Alta', color: '#f59e0b' },
  { id: 'urgent', key: 'tk.prioUrgent', en: 'Urgent', label: 'Urgente', color: '#ef4444' },
]
// Righe per il raggruppamento "Priorità" (dalla più alta alla più bassa).
const PRIORITY_ROWS = [
  { id: 'urgent', key: 'tk.prioUrgent', en: 'Urgent', label: 'Urgente', color: '#ef4444' },
  { id: 'high', key: 'tk.prioHigh', en: 'High', label: 'Alta', color: '#f59e0b' },
  { id: 'medium', key: 'tk.prioMedium', en: 'Medium', label: 'Media', color: '#ffd60a' },
  { id: 'low', key: 'tk.prioLow', en: 'Low', label: 'Bassa', color: '#22c55e' },
]

const card = { background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }
const input = { background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', width: '100%' }
const PANEL = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }
const btn = { background: 'var(--btn-primario)', border: 'none', borderRadius: 8, padding: '8px 14px', color: 'var(--btn-primario-testo)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost = { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }

export default function TasksTab() {
  const { t, intlLocale } = useI18n()
  const [projects, setProjects] = useState([])
  const [members, setMembers] = useState([])
  const [seats, setSeats] = useState(null)
  const [tasks, setTasks] = useState([])
  const [me, setMe] = useState(null)
  const [rolesCatalog, setRolesCatalog] = useState([])
  const [roleLabels, setRoleLabels] = useState({})
  const [hiddenTabs, setHiddenTabs] = useState([])
  async function saveHiddenTabs(next) {
    setHiddenTabs(next)
    await fetch('/api/team-members', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hiddenTabs: next }) }).catch(() => {})
  }
  const [view, setView] = useState('projects')
  // Sotto-tab del progetto aperto: attività · chat · membri.
  const [projView, setProjView] = useState('tasks')
  const [projChannel, setProjChannel] = useState(null)
  const [projMemberCount, setProjMemberCount] = useState(null)
  const [activeProject, setActiveProject] = useState('all')
  const [personProject, setPersonProject] = useState('all')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', assignee_id: '', assignees: [], priority: 'medium', due_date: '', project_id: '' })
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  // Chi è assente oggi: assegnare una task a chi non c'è è l'errore che il
  // bollino serve a evitare. Arriva dallo stesso registro di Ferie e permessi.
  const [onLeave, setOnLeave] = useState({})

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
      setHiddenTabs(Array.isArray(mem.hiddenTabs) ? mem.hiddenTabs : [])
      setMe(t.me || mem.me || null)
      setTasks(t.tasks || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let alive = true
    fetch('/api/projects/members', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!alive || !j) return
        setOnLeave(Object.fromEntries((j.team || []).filter(m => m.leave).map(m => [m.id, m.leave])))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // Canale LyftTalk del progetto: serve solo quando si apre la sua chat.
  useEffect(() => {
    if (projView !== 'chat' || !activeProject || activeProject === 'all' || activeProject === 'none') return
    let alive = true
    setProjChannel(null)
    fetch(`/api/projects/channel?projectId=${activeProject}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (alive) setProjChannel(j?.channelId || (j?.needsSetup ? 'needsSetup' : null)) })
      .catch(() => {})
    return () => { alive = false }
  }, [projView, activeProject])

  useEffect(() => { setProjMemberCount(null) }, [activeProject])

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
        description: form.description.trim() || null,
        assignee_id: form.assignee_id || form.assignees[0] || null,
        assignees: form.assignees.length ? form.assignees : (form.assignee_id ? [form.assignee_id] : []),
        priority: form.priority,
        due_date: form.due_date || null,
        project_id: form.project_id || (activeProject !== 'all' ? activeProject : null),
      }
      const r = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json())
      if (r.ok && r.task) {
        setTasks(prev => [r.task, ...prev])
        setForm({ title: '', description: '', assignee_id: '', assignees: [], priority: 'medium', due_date: '', project_id: '' })
        setNewTaskOpen(false)
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
    else avvisa(r.error || t('tk.uploadFailed', null, 'Upload failed'), 'errore')
    return r
  }

  async function downloadAttachment(path) {
    const r = await fetch(`/api/tasks/attachments?path=${encodeURIComponent(path)}`)
      .then(x => x.json()).catch(() => ({}))
    if (r.ok && r.url) window.open(r.url, '_blank')
    else avvisa(r.error || t('tk.downloadUnavailable', null, 'Download unavailable'), 'errore')
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
    } else avvisa(r.error || t('tk.inviteError', null, 'Invite error'), 'errore')
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
  const createdByMe = tasks.filter(t => me?.memberId && t.created_by === me.memberId)

  // Riepilogo per progetto: avanzamento, persone coinvolte e conteggio task.
  // Le "persone" sono i responsabili distinti delle task del progetto: qui i
  // progetti non hanno una lista membri propria, e inventarne una avrebbe
  // mostrato un numero che non corrisponde a nulla.
  const projectStats = (id) => {
    const ts = tasks.filter(x => (id === 'none' ? !x.project_id : x.project_id === id))
    const done = ts.filter(x => x.status === 'done' || x.status === 'approved').length
    const people = new Set(ts.map(x => x.assignee_id).filter(Boolean)).size
    return { total: ts.length, done, people, pct: ts.length ? Math.round((done / ts.length) * 100) : 0 }
  }

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text2)', fontFamily: 'inherit' }}>{t('tk.loadingBoard', null, 'Loading board…')}</div>
  }

  return (
    <div style={{ fontFamily: 'inherit', color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'inherit', fontSize: 20, fontWeight: 600 }}>{t('tk.title', null, 'Projects & Tasks')}</h2>
          <div style={{ color: 'var(--text2)', fontSize: 13 }}>{t('tk.subtitle', null, 'Team assignment, deadlines, review and approval')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, background: 'var(--glass)', borderRadius: 12, padding: 4 }}>
            <button onClick={() => { setView('projects'); setActiveProject('all') }} style={{ ...btnGhost, border: 'none', background: view === 'projects' ? 'var(--btn-primario)' : 'transparent', color: view === 'projects' ? 'var(--btn-primario-testo)' : 'var(--text)' }}>{t('tk.projects', null, 'Progetti')}</button>
            <button onClick={() => setView(view === 'mine' ? 'mine' : 'board')} style={{ ...btnGhost, border: 'none', background: (view === 'board' || view === 'mine') ? 'var(--btn-primario)' : 'transparent', color: (view === 'board' || view === 'mine') ? 'var(--btn-primario-testo)' : 'var(--text)', fontWeight: (view === 'board' || view === 'mine') ? 700 : 400 }}>{t('tk.board', null, 'Board')}</button>
            <button onClick={() => setView('overview')} style={{ ...btnGhost, border: 'none', background: view === 'overview' ? 'var(--btn-primario)' : 'transparent', color: view === 'overview' ? 'var(--btn-primario-testo)' : 'var(--text)', fontWeight: view === 'overview' ? 700 : 400 }}><Icon name="chart-bar" size={14} /> {t('tk.charts', null, 'Charts')}</button>
          </div>
        </div>
      </div>

      {view === 'projects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Le mie task: due scorciatoie prima dei progetti */}
          <div style={{ ...PANEL }}>
            <div style={{ fontSize: 11.5, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
              {t('tk.myTasksBlock', null, 'Le mie task')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <button type="button" onClick={() => setView('mine')} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
                <Icon name="clipboard" size={16} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t('tk.assignedToMe', null, 'Assegnate a me')}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{t('tk.assignedToMeSub', null, 'Devo eseguirle io')}</div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 640 }}>{myTasks.length}</span>
              </button>
              <button type="button" onClick={() => { setActiveProject('all'); setView('board') }} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
                <Icon name="edit" size={16} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t('tk.allTasks', null, 'Tutte le task')}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{t('tk.createdByMe', null, 'Create da me')}: {createdByMe.length}</div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 640 }}>{tasks.length}</span>
              </button>
            </div>
          </div>

          {/* Elenco progetti */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'inherit', fontWeight: 600, fontSize: 20 }}>
              {t('tk.projectsTitle', null, 'Progetti')}
              <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 400, fontFamily: 'inherit', marginLeft: 10 }}>
                {t('tk.projectsSub', null, 'Spazi condivisi con attività e responsabili')}
              </span>
            </div>
            <button style={btn} onClick={addProject}>+ {t('tk.newProject', null, 'Nuovo progetto')}</button>
          </div>

          {projects.length === 0 && !tasks.some(x => !x.project_id) ? (
            <div style={{ ...PANEL, textAlign: 'center', color: 'var(--text2)', padding: 40, fontSize: 13 }}>
              {t('tk.noProjectsYet', null, 'Nessun progetto ancora. Creane uno per raggruppare le attività.')}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {[...projects.map(p => ({ id: p.id, name: p.name, description: p.description, color: p.color || '#7b5bff', owner: p.created_by })),
                ...(tasks.some(x => !x.project_id) ? [{ id: 'none', name: t('tk.noProject', null, 'Senza progetto'), color: '#8e8e8e', owner: null }] : [])
              ].map(p => {
                const st = projectStats(p.id)
                return (
                  <button key={p.id} type="button" onClick={() => { setActiveProject(p.id); setView('board'); setProjView('tasks') }}
                    style={{ ...PANEL, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: p.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 640, fontSize: 15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    </div>
                    {p.description && (
                      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.45, whiteSpace: 'pre-line' }}>{p.description}</div>
                    )}
                    <div style={{ height: 5, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ width: `${st.pct}%`, height: '100%', background: st.pct === 100 ? '#22c55e' : p.color, transition: 'width .3s' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: 'var(--text2)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Icon name="users" size={12} /> {t('tk.peopleN', { n: st.people }, `${st.people} persone`)}
                      </span>
                      <span style={{ marginLeft: 'auto' }}>{st.done}/{st.total} task</span>
                    </div>
                    {p.owner && (
                      <div style={{ fontSize: 11.5, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="user" size={12} /> {memberName(p.owner)}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {(view === 'board' || view === 'mine') && (() => {
        const openProject = activeProject !== 'all' && activeProject !== 'none'
          ? projects.find(x => x.id === activeProject) : null
        return (
        <>
        {/* Intestazione del progetto aperto, con il ritorno all'elenco */}
        {view !== 'mine' && (openProject || activeProject === 'none') && (
          <div style={{ marginBottom: 16 }}>
            <button type="button" onClick={() => { setView('projects'); setActiveProject('all') }}
              style={{ ...btnGhost, border: 'none', padding: '4px 0', color: 'var(--text2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              ← {t('tk.backToProjects', null, 'Progetti')}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: openProject?.color || '#8e8e8e' }} />
              <h3 style={{ margin: 0, fontFamily: 'inherit', fontSize: 20, fontWeight: 600 }}>
                {openProject ? openProject.name : t('tk.noProject', null, 'Senza progetto')}
              </h3>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                {(() => { const st = projectStats(activeProject); return `${st.done}/${st.total} task` })()}
              </span>
            </div>
            {openProject?.description && (
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4, whiteSpace: 'pre-line' }}>{openProject.description}</div>
            )}
            {(openProject?.start_date || openProject?.end_date) && (
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
                {[openProject.start_date, openProject.end_date].filter(Boolean).join(' → ')}
              </div>
            )}

            {/* Attività · Chat · Membri: il progetto è uno spazio, non solo una board */}
            {openProject && (
              <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--glass)', border: '1px solid var(--border)', marginTop: 12 }}>
                {[
                  ['tasks', t('tk.projTasks', null, 'Attività'), 'kanban'],
                  ['chat', t('tk.projChat', null, 'Chat'), 'chat'],
                  ['members', t('tk.projMembers', null, 'Membri') + (projMemberCount != null ? ` (${projMemberCount})` : ''), 'users'],
                ].map(([id, label, icon]) => (
                  <button key={id} type="button" onClick={() => setProjView(id)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
                    fontWeight: projView === id ? 800 : 600,
                    background: projView === id ? 'var(--btn-primario)' : 'transparent',
                    color: projView === id ? 'var(--btn-primario-testo)' : 'var(--text)',
                  }}>
                    <Icon name={icon} size={13} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat e Membri sostituiscono la board: stesso progetto, altra vista */}
        {openProject && projView === 'members' && (
          <ProjectMembers projectId={activeProject} onCountChange={setProjMemberCount} />
        )}
        {openProject && projView === 'chat' && (
          projChannel === 'needsSetup' ? (
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,159,10,0.10)', border: '1px solid rgba(255,159,10,0.35)', fontSize: 13, lineHeight: 1.5 }}>
              <strong style={{ color: '#ffb340', fontWeight: 640 }}>{t('tk.chatSetupTitle', null, 'Chat di progetto non attiva')}</strong>
              <div style={{ color: 'var(--text3)', marginTop: 3 }}>{t('tk.chatSetupBody', null, 'Esegui supabase/project_workspace.sql: il gruppo su LyftTalk nasce insieme al progetto.')}</div>
            </div>
          ) : projChannel ? (
            <ChatTab initialChannelId={projChannel} hideSidebar />
          ) : (
            <div style={{ padding: 30, color: 'var(--text2)', fontSize: 13 }}>{t('tk.chatLoading', null, 'Apro la chat del progetto…')}</div>
          )
        )}
        <div className="m-cols" style={{ display: (openProject && projView !== 'tasks') ? 'none' : 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Sidebar progetti */}
          <aside className="m-sidenav" style={{ ...PANEL, width: 220, flexShrink: 0, padding: 10 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '4px 8px 8px' }}>{t('tk.projects', null, 'Projects')}</div>
            <SideItem label={t('tk.allProjects', null, 'All projects')} count={tasks.length} active={view === 'board' && activeProject === 'all'} onClick={() => { setActiveProject('all'); setView('board') }} />
            {projects.map(p => (
              <SideItem key={p.id} label={p.name} color={p.color || '#7b5bff'} count={tasks.filter(t => t.project_id === p.id).length}
                active={view === 'board' && activeProject === p.id} onClick={() => { setActiveProject(p.id); setView('board'); setProjView('tasks') }} onDelete={() => deleteProject(p.id)} />
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
                <div style={{ fontFamily: 'inherit', fontWeight: 600, fontSize: 20, marginBottom: 14 }}>{t('tk.myTasks', null, 'My tasks')} · {myTasks.length}</div>
                <TaskBoard tasks={myTasks} memberName={memberName} onPatch={patchTask} onDelete={deleteTask} onOpen={setDetailId} />
              </>
            )}
            {view === 'board' && (<>
            {/* Nuova task: un pulsante, e la finestra chiede tutto in una volta.
                La barra sempre aperta occupava spazio a ogni sguardo e non
                aveva posto per la descrizione. */}
            <button type="button" onClick={() => setNewTaskOpen(true)} style={{
              ...btn, display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '10px 18px', fontSize: 13, marginBottom: 18,
            }}>
              <Icon name="plus" size={13} /> {t('tk.newTask', null, 'Nuova task')}
            </button>

            {/* Griglia: colonne di stato × righe di priorità */}
            <TaskBoard tasks={visible} memberName={memberName} onPatch={patchTask} onDelete={deleteTask} onOpen={setDetailId} />
            </>)}
          </div>
        </div>
        </>
        )
      })()}

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
          { label: t('tk.onTime', null, 'On time'), color: '#22c55e', value: onTime },
          { label: t('tk.late', null, 'Late'), color: '#ef4444', value: lateTasks.length },
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
              <MiniStat label={t('tk.completedProjects', null, 'Completed projects')} value={projDone.length} sub={t('tk.pctOfTotal', { pct: pctOf(projDone.length, projRows.length) }, '{pct}% of total')} color="#22c55e" />
              <MiniStat label={t('tk.completedLate', null, 'Completed late')} value={projLate.length} sub={t('tk.pctOfCompleted', { pct: pctOf(projLate.length, projDone.length) }, '{pct}% of completed')} color="#ef4444" />
              <MiniStat label={t('tk.completedTasks', null, 'Completed tasks')} value={doneTasks.length} sub={t('tk.pctOfN', { pct: pctOf(doneTasks.length, totalTasks), total: totalTasks }, '{pct}% of {total}')} color="#5b8bff" />
            </div>

            {/* Donut: stato task + puntualità */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
              <div style={{ ...card }}>
                <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600, marginBottom: 12 }}>{t('tk.tasksByStatus', null, 'Tasks by status')}</div>
                <DonutLegend data={byStatus} total={totalTasks} />
              </div>
              <div style={{ ...card }}>
                <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600, marginBottom: 12 }}>{t('tk.completionPunctuality', null, 'Completion punctuality')}</div>
                <DonutLegend data={punct} total={totalTasks} />
              </div>
            </div>

            {/* Avanzamento progetti */}
            <div style={{ ...card }}>
              <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600, marginBottom: 14 }}>{t('tk.projectProgress', null, 'Project progress')}</div>
              {projRows.length === 0 ? <div style={{ color: 'var(--text2)', fontSize: 13 }}>{t('tk.noTask', null, 'No tasks.')}</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {projRows.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                      <span style={{ width: 150, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}{p.completed && <span title={p.late ? t('tk.completedLateTip', null, 'Completed late') : t('tk.completedTip', null, 'Completed')} style={{ marginLeft: 5 }}>{p.late ? <Icon name="warning" size={12} /> : <Icon name="check-circle" size={12} />}</span>}</span>
                      <div style={{ flex: 1, height: 14, background: 'var(--glass)', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ width: `${p.pct}%`, height: '100%', background: p.late && p.completed ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg,#7b5bff,#5b8bff)' }} />
                      </div>
                      <span style={{ width: 96, textAlign: 'right', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{p.pct}% · {p.done}/{p.total}</span>
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
                    <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600, flex: 1 }}>{t('tk.perPersonAnalysis', null, 'Per-person analysis')}</div>
                    <select style={{ ...input, width: 'auto' }} value={personProject} onChange={e => setPersonProject(e.target.value)}>
                      <option value="all">{t('tk.allProjects', null, 'All projects')}</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      <option value="none">{t('tk.noProject', null, 'No project')}</option>
                    </select>
                  </div>
                  {peopleRows.length === 0 ? <div style={{ color: 'var(--text2)', fontSize: 13 }}>{t('tk.noTasksAssigned', null, 'No tasks assigned.')}</div> : (
                    <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: 11.5, color: 'var(--text2)', marginBottom: 8 }}>{t('tk.taskDistributionPerPerson', null, 'Task distribution per person')}</div>
                        <DonutLegend data={ppDonut} total={ppTasks.length} />
                      </div>
                      <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {peopleRows.map((m, i) => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar name={m.name} url={m.avatar} size={30} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{m.name}</span>
                                <span style={{ color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>{m.done}/{m.total} · {m.pct}%{m.late > 0 ? ` · {m.late}` : ''}</span>
                              </div>
                              <div style={{ height: 9, background: 'var(--glass)', borderRadius: 6, overflow: 'hidden' }}>
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
              <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600, marginBottom: 6 }}>{t('tk.tasksCompletedOverTime', null, 'Tasks completed over time')} <span style={{ fontWeight: 400 }}>· {t('tk.last14Cumulative', null, 'last 14 days (cumulative)')}</span></div>
              <LineChart days={days} />
            </div>
          </div>
        )
      })()}

      {newTaskOpen && (
        <NewTaskModal
          form={form} setForm={setForm} creating={creating}
          members={members} onLeave={onLeave}
          projects={projects}
          openProjectId={activeProject !== 'all' && activeProject !== 'none' ? activeProject : null}
          onClose={() => setNewTaskOpen(false)}
          onCreate={createTask}
        />
      )}

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

    </div>
  )
}

// ── Nuova task ─────────────────────────────────────────────────────────────
// Chiede tutto in una volta e nell'ordine in cui si pensa: cosa va fatto, i
// dettagli, quanto stringe, entro quando, e solo alla fine chi lo fa. Gli
// assegnatari stanno in fondo perche' si decide a chi darla quando si e' gia'
// capito che cos'e'.
// Riquadro di un campo del modale. Sta QUI FUORI, non dentro NewTaskModal:
// definito nel corpo del componente diventava una funzione nuova a ogni render,
// quindi a ogni lettera digitata React smontava e rimontava tutti i campi. Si
// perdeva il fuoco e l'autoFocus del titolo ripartiva: scrivendo nella
// descrizione il cursore tornava da solo sul Titolo.
function Campo({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: hint ? 2 : 6 }}>{label}</label>
      {hint && <div style={{ fontSize: 11.5, color: '#8b8b8b', marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  )
}

function NewTaskModal({ form, setForm, creating, members, onLeave, projects, openProjectId, onClose, onCreate }) {
  const { t } = useI18n()
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  return (
    <div className="mobile-modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 16px',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        ...PANEL, padding: 0, width: 'min(520px, 100%)', maxHeight: '92dvh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 20px 12px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, fontFamily: 'inherit', letterSpacing: '-.01em' }}>
              {t('tk.newTask', null, 'Nuova task')}
            </h3>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>
              {t('tk.newTaskSub', null, 'Crea una task personale o all’interno di un progetto.')}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('tk.cancel', null, 'Annulla')}
            style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ padding: '0 20px', overflowY: 'auto', flex: 1 }}>
          <Campo label={t('tk.taskTitle', null, 'Titolo')}>
            <input autoFocus style={input} value={form.title}
              placeholder={t('tk.taskTitlePlaceholder', null, 'Cosa va fatto?')}
              onChange={e => set('title', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && form.title.trim()) onCreate() }} />
          </Campo>

          <Campo label={t('tk.description', null, 'Descrizione')}>
            <textarea rows={3} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} value={form.description}
              placeholder={t('tk.taskDescPlaceholder', null, 'Dettagli, contesto, link…')}
              onChange={e => set('description', e.target.value)} />
          </Campo>

          {/* Il progetto si sceglie solo quando non si e' gia' dentro a uno:
              dentro un progetto la risposta e' ovvia e chiederla e' rumore. */}
          {!openProjectId && projects.length > 0 && (
            <Campo label={t('tk.project', null, 'Progetto')}>
              <select style={input} value={form.project_id} onChange={e => set('project_id', e.target.value)}>
                <option value="">{t('tk.personalTask', null, 'Task personale · senza progetto')}</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Campo>
          )}

          <Campo label={t('tk.priority', null, 'Priorità')}>
            <select style={{ ...input, width: 'auto', minWidth: 170 }} value={form.priority} onChange={e => set('priority', e.target.value)}>
              {PRIORITIES.map(p => <option key={p.id} value={p.id}>{t(p.key, null, p.en)}</option>)}
            </select>
          </Campo>

          <Campo label={t('tk.dueDate', null, 'Scadenza')}>
            <input type="date" style={input} value={form.due_date} onChange={e => set('due_date', e.target.value)} />
          </Campo>

          <Campo label={t('tk.assignees', null, 'Assegna a')}
            hint={t('tk.assigneesHint', null, 'Puoi selezionare più persone contemporaneamente.')}>
            <div style={{ maxHeight: 132, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--glass)', padding: 6 }}>
              {members.length === 0 && <div style={{ fontSize: 13, color: '#8b8b8b', padding: 6 }}>{t('tk.noMembers', null, 'Nessun membro')}</div>}
              {members.map(m => {
                const on = form.assignees.includes(m.id)
                const leave = onLeave[m.id]
                return (
                  <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 5px', fontSize: 13, cursor: 'pointer', borderRadius: 8 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <input type="checkbox" checked={on}
                      onChange={() => set('assignees', on ? form.assignees.filter(x => x !== m.id) : [...form.assignees, m.id])} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name || m.email}</span>
                    {/* Chi e' via si vede PRIMA di assegnare, non dopo: e' il
                        momento in cui la cosa cambia una decisione. */}
                    {leave && (
                      <span style={{ fontSize: 10, fontWeight: 640, padding: '2px 7px', borderRadius: 999, background: 'rgba(255,159,10,0.18)', color: '#ffb340', whiteSpace: 'nowrap' }}>
                        {t(`tk.leave.${leave.type}`, null, leave.type === 'ferie' ? 'In ferie' : leave.type === 'permesso' ? 'In permesso' : 'In malattia')}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </Campo>
        </div>

        <div style={{ padding: '12px 20px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--border)' }}>
          <button type="button" onClick={onClose} style={btnGhost}>{t('tk.cancel', null, 'Annulla')}</button>
          <button type="button" onClick={onCreate} disabled={creating || !form.title.trim()}
            style={{ ...btn, opacity: (creating || !form.title.trim()) ? 0.5 : 1, cursor: (creating || !form.title.trim()) ? 'default' : 'pointer' }}>
            {creating ? t('tk.creating', null, 'Creo…') : t('tk.createTask', null, 'Crea task')}
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskCard({ t, memberName, onPatch, onDelete, onOpen }) {
  const { t: tr } = useI18n()
  const prio = PRIORITIES.find(p => p.id === (t.priority || 'medium')) || PRIORITIES[1]
  const overdue = t.due_date && t.status !== 'done' && t.status !== 'approved' && new Date(t.due_date) < new Date(new Date().toDateString())
  return (
    <div onClick={onOpen} title={tr('tk.openForNotes', null, 'Open for notes, details and attachments')} style={{ ...card, padding: 12, cursor: 'pointer' }}>
      {/* La priorita' e' un'etichetta in cima, non piu' una fascia colorata sul
          bordo: dice la stessa cosa senza tingere tutta la card. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: prio.color, background: `${prio.color}1f`, border: `1px solid ${prio.color}40`, borderRadius: 999, padding: '3px 9px', lineHeight: 1.2 }}>{tr(prio.key, null, prio.en)}</span>
        <button onClick={(e) => { e.stopPropagation(); onDelete(t.id) }} title={tr('tk.delete', null, 'Delete')} style={{ background: 'none', border: 'none', color: '#48484a', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>{t.title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
        {t.due_date && <span style={{ fontSize: 11.5, color: overdue ? '#ef4444' : 'var(--text2)' }}><Icon name="calendar" size={12} /> {t.due_date}</span>}
        {t.description && <span title={tr('tk.containsNotes', null, 'Contains notes')} style={{ fontSize: 11.5, color: 'var(--text2)' }}><Icon name="file" size={12} /></span>}
        {Array.isArray(t.attachments) && t.attachments.length > 0 && <span title={tr('tk.attachments', null, 'Attachments')} style={{ fontSize: 11.5, color: 'var(--text2)' }}><Icon name="paperclip" size={12} /> {t.attachments.length}</span>}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8 }}><Icon name="user" size={12} /> {memberName(t.assignee_id)}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
        <select value={t.status || 'todo'} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); onPatch(t.id, { status: e.target.value }) }}
          style={{ ...input, width: 'auto', flex: 1, padding: '5px 8px', fontSize: 13 }}>
          {COLUMNS.map(c => <option key={c.id} value={c.id}>{tr(c.key, null, c.en)}</option>)}
        </select>
        {t.status === 'in_review' && (
          <button onClick={(e) => { e.stopPropagation(); onPatch(t.id, { status: 'approved' }) }}
            style={{ background: '#22c55e', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#04210f', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}><Icon name="check" size={13} /> {tr('tk.approve', null, 'Approve')}</button>
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--accent)', fontWeight: 600 }}><Icon name="file" size={12} /> {tr('tk.openForNotesShort', null, 'Open for notes & attachments')}</div>
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
    <div className="mobile-modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ ...PANEL, padding: 0, width: 'min(640px, 100%)', maxWidth: 640, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ overflowY: 'auto', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <input
            defaultValue={task.title}
            onBlur={e => { const v = e.target.value.trim(); if (v && v !== task.title) onPatch(task.id, { title: v }) }}
            style={{ ...input, fontSize: 20, fontWeight: 600, fontFamily: 'inherit', border: 'none', padding: '4px 0', background: 'transparent' }}
          />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>{t('tk.assignedTo', { name: memberName(task.assignee_id) }, 'Assigned to {name}')}</div>

        <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)' }}>
            {t('tk.priority', null, 'Priority')}
            <select value={task.priority || 'medium'} onChange={e => onPatch(task.id, { priority: e.target.value })} style={{ ...input, width: 'auto', padding: '5px 8px', fontSize: 13 }}>
              {PRIORITIES.map(p => <option key={p.id} value={p.id}>{t(p.key, null, p.en)}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)' }}>
            {t('tk.status', null, 'Status')}
            <select value={task.status || 'todo'} onChange={e => onPatch(task.id, { status: e.target.value })} style={{ ...input, width: 'auto', padding: '5px 8px', fontSize: 13 }}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{t(c.key, null, c.en)}</option>)}
            </select>
          </label>
        </div>

        {/* Note / dettagli */}
        <label style={{ fontSize: 13, color: '#d1d1d1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>{t('tk.notesDetails', null, 'Notes / details · what to do')}</label>
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
          <label style={{ fontSize: 11.5, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{t('tk.attachments', null, 'Attachments')}</label>
          <label style={{ ...btnGhost, cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
            {uploading ? t('tk.loading', null, 'Loading…') : `+ ${t('tk.attachFile', null, 'Attach file')}`}
            <input type="file" hidden disabled={uploading} onChange={onPick}
              accept=".pdf,.csv,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.doc,.docx,.txt" />
          </label>
        </div>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attachments.length === 0 && <div style={{ color: '#48484a', fontSize: 13 }}>{t('tk.noAttachments', null, 'No attachments. PDF, CSV, images, Excel, Word (max ~4MB).')}</div>}
          {attachments.map(a => (
            <div key={a.path} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Icon name="file" size={13} /> {a.name}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text2)' }}>{fmtSize(a.size)}</span>
              <button onClick={() => onDownload(a.path)} style={{ ...btnGhost, padding: '4px 10px' }}>{t('tk.download', null, 'Download')}</button>
              <button onClick={() => onDeleteAttachment(task.id, a.path)} title={t('tk.delete', null, 'Delete')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 17 }}>×</button>
            </div>
          ))}
        </div>

        {/* Commenti */}
        <div style={{ marginTop: 18 }}>
          <label style={{ fontSize: 13, color: '#d1d1d1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>{t('tk.comments', null, 'Comments')}</label>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {comments.length === 0 && <div style={{ color: '#48484a', fontSize: 13 }}>{t('tk.noComments', null, 'No comments.')}</div>}
            {comments.map(c => (
              <div key={c.id} style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 2 }}>
                  <b style={{ color: 'var(--text)' }}>{c.author_name || t('tk.user', null, 'User')}</b> · {new Date(c.created_at).toLocaleString(intlLocale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: 15, whiteSpace: 'pre-wrap' }}>{c.body}</div>
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
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <button onClick={onClose} style={btnGhost}>{t('tk.close', null, 'Close')}</button>
          <button onClick={saveAndClose} style={btn}><Icon name="check" size={13} /> {t('tk.saveAndClose', null, 'Save and close')}</button>
        </div>
      </div>
    </div>
  )
}

const STATUS_BADGE = {
  invited: { key: 'tk.statusInvited', en: 'Invited', label: 'Invitato', color: '#f59e0b' },
  active: { key: 'tk.statusActive', en: 'Active', label: 'Attivo', color: '#22c55e' },
  disabled: { key: 'tk.statusDisabled', en: 'Disabled', label: 'Disattivato', color: 'var(--text2)' },
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
              <div style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: 600 }}>{p.name}</div>
              <button onClick={(e) => { e.stopPropagation(); onDelete(p.id) }} title={t('tk.deleteProject', null, 'Delete project')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 17, lineHeight: 1 }}>×</button>
            </div>
            {p.description && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{p.description}</div>}
            <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 13, color: 'var(--text2)', flexWrap: 'wrap' }}>
              <span><b style={{ color: 'var(--text)' }}>{s.total}</b> {t('tk.task', null, 'tasks')}</span>
              {s.review > 0 && <span style={{ color: '#f59e0b' }}>{t('tk.inReviewCount', { count: s.review }, '{count} in review')}</span>}
              <span style={{ color: '#22c55e' }}>{t('tk.completedCount', { count: s.done }, '{count} completed')}</span>
            </div>
          </div>
        )
      })}
      {noProject > 0 && (
        <div onClick={() => onOpen('all')} style={{ ...card, cursor: 'pointer', borderTop: '3px solid #48484a' }}>
          <div style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: 600 }}>{t('tk.noProject', null, 'No project')}</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 13, color: 'var(--text2)' }}><span><b style={{ color: 'var(--text)' }}>{noProject}</b> {t('tk.task', null, 'tasks')}</span></div>
        </div>
      )}
      <div onClick={onAdd} style={{ ...card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', border: '1px dashed var(--border)', minHeight: 90 }}>+ {t('tk.newProject', null, 'New project')}</div>
    </div>
  )
}

// Card statistica compatta (numero grande + sottotitolo).
function MiniStat({ label, value, sub, color = 'var(--text)' }) {
  return (
    <div style={{ ...card }}>
      <div style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 640, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--text2)' }}>{sub}</div>}
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
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="14" />
        {sum > 0 && data.map((d, i) => {
          if (!d.value) return null
          const frac = d.value / sum, len = frac * C, off = acc * C
          acc += frac
          return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="14" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform={`rotate(-90 ${cx} ${cy})`} />
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--text)">{sum}</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize="10" fill="#b1b1b1">{t('tk.totalLower', null, 'total')}</text>
      </svg>
      <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 6, background: d.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: '#d1d1d1' }}>{d.label}</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{d.value}</span>
            <span style={{ color: 'var(--text2)', width: 42, textAlign: 'right' }}>{sum ? Math.round(d.value / sum * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Grafico lineare (area + linea) su una serie di {label, value}.
function LineChart({ days = [], h = 150 }) {
  const { t } = useI18n()
  if (!days || days.length < 2) return <div style={{ color: 'var(--text2)', fontSize: 13 }}>{t('tk.insufficientData', null, 'Insufficient data.')}</div>
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
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: active ? 'var(--neutro-bg)' : 'transparent', border: active ? '1px solid rgba(123,91,255,0.5)' : '1px solid transparent', marginBottom: 2 }}>
      {color && <span style={{ width: 8, height: 8, borderRadius: 6, background: color, flexShrink: 0 }} />}
      <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? 'var(--text)' : '#d1d1d1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: 11.5, color: 'var(--text2)' }}>{count}</span>
      {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete() }} title={t('tk.deleteProject', null, 'Delete project')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>}
    </div>
  )
}

// Board a colonne: una colonna per stato (Da fare / In corso / ...), le task
// impilate dentro. Prima le righe erano le priorita', con una fascia colorata
// per ognuna: quattro bande di colore incrociate con le colonne facevano
// leggere il colore prima del contenuto, e una colonna mezza vuota sembrava un
// problema quando era solo una priorita' poco usata. La priorita' ora sta dove
// serve, cioe' sulla task, come una piccola etichetta.
function TaskBoard({ tasks, memberName, onPatch, onDelete, onOpen }) {
  const { t: tr } = useI18n()
  return (
    // Su telefono le colonne non si stringono: scorrono di lato DENTRO questo
    // riquadro (una colonna per schermata), cosi' la board non sborda dalla
    // pagina. Le regole stanno nel foglio mobile, classi tk-board-*.
    <div className="tk-board-scroll" style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <div className="tk-board-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(240px, 1fr))`, gap: 12, minWidth: 980, alignItems: 'start' }}>
        {COLUMNS.map(col => {
          const items = tasks.filter(t => (t.status || 'todo') === col.id)
          return (
            <div key={col.id} className="tk-board-col" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10, background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 12, minHeight: 80 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 6px' }}>
                <span style={{ width: 8, height: 8, borderRadius: 6, background: col.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontFamily: 'inherit', fontWeight: 600, fontSize: 15, textTransform: 'uppercase', letterSpacing: '.05em' }}>{tr(col.key, null, col.en)}</span>
                <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>{items.length}</span>
              </div>
              {items.map(t => <TaskCard key={t.id} t={t} memberName={memberName} onPatch={onPatch} onDelete={onDelete} onOpen={() => onOpen(t.id)} />)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
