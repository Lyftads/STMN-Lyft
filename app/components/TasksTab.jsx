'use client'

import { useEffect, useState, useCallback } from 'react'

// Modulo Team → Progetti & Task (Fase 1). Board Kanban + creazione task/progetti,
// assegnazione, priorità, scadenze, approvazione (aperta a tutti).
// Visibile a tutti i ruoli. Niente dipendenze esterne: fetch verso /api/tasks,
// /api/projects, /api/team-members.

const COLUMNS = [
  { id: 'todo', label: 'Da fare', color: '#86868b' },
  { id: 'in_progress', label: 'In corso', color: '#0a84ff' },
  { id: 'in_review', label: 'In revisione', color: '#ff9f0a' },
  { id: 'approved', label: 'Approvato', color: '#30d158' },
  { id: 'done', label: 'Fatto', color: '#64d2ff' },
]
const PRIORITIES = [
  { id: 'low', label: 'Bassa', color: '#86868b' },
  { id: 'medium', label: 'Media', color: '#64d2ff' },
  { id: 'high', label: 'Alta', color: '#ff9f0a' },
  { id: 'urgent', label: 'Urgente', color: '#ff375f' },
]
// Colonne per il raggruppamento "Priorità" (dalla più alta alla più bassa).
const PRIORITY_COLUMNS = [
  { id: 'urgent', label: 'Urgente', color: '#ff375f' },
  { id: 'high', label: 'Alta', color: '#ff9f0a' },
  { id: 'medium', label: 'Media', color: '#64d2ff' },
  { id: 'low', label: 'Bassa', color: '#86868b' },
]

const card = { background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }
const input = { background: 'var(--surface,#0d0d16)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 13, fontFamily: 'Barlow', width: '100%' }
const btn = { background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' }
const btnGhost = { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow' }

export default function TasksTab() {
  const [projects, setProjects] = useState([])
  const [members, setMembers] = useState([])
  const [tasks, setTasks] = useState([])
  const [me, setMe] = useState(null)
  const [rolesCatalog, setRolesCatalog] = useState([])
  const [roleLabels, setRoleLabels] = useState({})
  const [showTeam, setShowTeam] = useState(false)
  const [view, setView] = useState('board')
  const [groupBy, setGroupBy] = useState('status')
  const [activeProject, setActiveProject] = useState('all')
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
    const name = prompt('Nome del progetto:')
    if (!name || !name.trim()) return
    const r = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(x => x.json())
    if (r.ok && r.project) { setProjects(prev => [...prev, r.project]); setActiveProject(r.project.id) }
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
    if (!confirm('Eliminare il task?')) return
    setTasks(prev => prev.filter(t => t.id !== id))
    if (detailId === id) setDetailId(null)
    await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
  }

  async function uploadFile(taskId, file) {
    const fd = new FormData()
    fd.append('taskId', taskId)
    fd.append('file', file)
    const r = await fetch('/api/tasks/attachments', { method: 'POST', body: fd })
      .then(x => x.json()).catch(() => ({ ok: false, error: 'Errore di rete' }))
    if (r.ok && r.task) setTasks(prev => prev.map(t => t.id === taskId ? r.task : t))
    else alert(r.error || 'Upload fallito')
    return r
  }

  async function downloadAttachment(path) {
    const r = await fetch(`/api/tasks/attachments?path=${encodeURIComponent(path)}`)
      .then(x => x.json()).catch(() => ({}))
    if (r.ok && r.url) window.open(r.url, '_blank')
    else alert(r.error || 'Download non disponibile')
  }

  async function deleteAttachment(taskId, path) {
    if (!confirm('Eliminare il file?')) return
    const r = await fetch(`/api/tasks/attachments?taskId=${taskId}&path=${encodeURIComponent(path)}`, { method: 'DELETE' })
      .then(x => x.json()).catch(() => ({}))
    if (r.ok && r.task) setTasks(prev => prev.map(t => t.id === taskId ? r.task : t))
  }

  async function inviteMember(email, roles) {
    const r = await fetch('/api/team-members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, roles }) })
      .then(x => x.json()).catch(() => ({ ok: false, error: 'Errore di rete' }))
    if (r.ok && r.member) {
      setMembers(prev => {
        const i = prev.findIndex(m => m.email === r.member.email)
        if (i >= 0) { const c = [...prev]; c[i] = r.member; return c }
        return [...prev, r.member]
      })
      if (!r.emailSent) alert('Membro aggiunto, ma email non inviata: ' + (r.emailError || 'configura RESEND_API_KEY'))
    } else alert(r.error || 'Errore invito')
    return r
  }

  async function updateMemberRoles(id, roles) {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, roles } : m))
    await fetch('/api/team-members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, roles }) })
  }

  async function removeMember(id) {
    if (!confirm('Rimuovere il membro dal team?')) return
    setMembers(prev => prev.filter(m => m.id !== id))
    await fetch(`/api/team-members?id=${id}`, { method: 'DELETE' })
  }

  const visible = tasks.filter(t => activeProject === 'all' || t.project_id === activeProject)
  const detailTask = detailId ? tasks.find(t => t.id === detailId) : null
  const boardColumns = groupBy === 'priority' ? PRIORITY_COLUMNS : COLUMNS
  const colKeyOf = (t) => groupBy === 'priority' ? (t.priority || 'medium') : (t.status || 'todo')

  if (loading) {
    return <div style={{ padding: 40, color: '#86868b', fontFamily: 'Barlow' }}>Caricamento board…</div>
  }

  return (
    <div style={{ fontFamily: 'Barlow', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Barlow Condensed', fontSize: 28, fontWeight: 700 }}>Progetti &amp; Task</h2>
          <div style={{ color: '#86868b', fontSize: 13 }}>Assegna, scadenze, revisione e approvazione del team</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 2, border: '1px solid var(--border)', borderRadius: 9, padding: 3 }}>
            {[['board', 'Board'], ['projects', 'Progetti']].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} style={{ border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 13, fontWeight: view === v ? 700 : 500, cursor: 'pointer', fontFamily: 'Barlow', background: view === v ? 'var(--glass)' : 'transparent', color: view === v ? '#fff' : '#86868b' }}>{l}</button>
            ))}
          </div>
          {view === 'board' && (<>
            <select value={activeProject} onChange={e => setActiveProject(e.target.value)} style={{ ...input, width: 'auto' }}>
              <option value="all">Tutti i progetti</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 2, border: '1px solid var(--border)', borderRadius: 9, padding: 3 }} title="Raggruppa le task">
              {[['status', 'Stato'], ['priority', 'Priorità']].map(([g, l]) => (
                <button key={g} onClick={() => setGroupBy(g)} style={{ border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: groupBy === g ? 700 : 500, cursor: 'pointer', fontFamily: 'Barlow', background: groupBy === g ? 'var(--glass)' : 'transparent', color: groupBy === g ? '#fff' : '#86868b' }}>{l}</button>
              ))}
            </div>
          </>)}
          <button style={btnGhost} onClick={addProject}>+ Progetto</button>
          {me?.isAdmin && <button style={btnGhost} onClick={() => setShowTeam(true)}>👥 Gestione team</button>}
        </div>
      </div>

      {view === 'board' && (<>
      {/* Nuovo task */}
      <div style={{ ...card, marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 240px' }}>
          <label style={{ fontSize: 11, color: '#86868b', textTransform: 'uppercase', letterSpacing: '.08em' }}>Nuovo task</label>
          <input style={input} placeholder="Titolo del task…" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') createTask() }} />
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <label style={{ fontSize: 11, color: '#86868b' }}>Assegnatario</label>
          <select style={input} value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}>
            <option value="">Nessuno</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label style={{ fontSize: 11, color: '#86868b' }}>Priorità</label>
          <select style={input} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
            {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <label style={{ fontSize: 11, color: '#86868b' }}>Scadenza</label>
          <input type="date" style={input} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
        </div>
        <button style={{ ...btn, opacity: creating ? 0.6 : 1 }} disabled={creating} onClick={createTask}>+ Crea</button>
      </div>

      {/* Board */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${boardColumns.length}, minmax(220px, 1fr))`, gap: 12, overflowX: 'auto' }}>
        {boardColumns.map(col => {
          const items = visible.filter(t => colKeyOf(t) === col.id)
          return (
            <div key={col.id} style={{ minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: col.color }} />
                <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 15, textTransform: 'uppercase', letterSpacing: '.05em' }}>{col.label}</span>
                <span style={{ color: '#86868b', fontSize: 12 }}>{items.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map(t => <TaskCard key={t.id} t={t} memberName={memberName} onPatch={patchTask} onDelete={deleteTask} onOpen={() => setDetailId(t.id)} />)}
                {items.length === 0 && <div style={{ color: '#48484a', fontSize: 12, padding: '8px 2px' }}>—</div>}
              </div>
            </div>
          )
        })}
      </div>
      </>)}

      {view === 'projects' && (
        <ProjectsView
          projects={projects}
          tasks={tasks}
          onOpen={(id) => { setActiveProject(id); setView('board') }}
          onAdd={addProject}
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

      {showTeam && (
        <TeamModal
          members={members}
          rolesCatalog={rolesCatalog}
          roleLabels={roleLabels}
          ownerUserId={me?.userId}
          onClose={() => setShowTeam(false)}
          onInvite={inviteMember}
          onUpdateRoles={updateMemberRoles}
          onRemove={removeMember}
        />
      )}
    </div>
  )
}

function TaskCard({ t, memberName, onPatch, onDelete, onOpen }) {
  const prio = PRIORITIES.find(p => p.id === (t.priority || 'medium')) || PRIORITIES[1]
  const overdue = t.due_date && t.status !== 'done' && t.status !== 'approved' && new Date(t.due_date) < new Date(new Date().toDateString())
  return (
    <div onClick={onOpen} title="Apri per note, dettagli e allegati" style={{ ...card, padding: 12, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>{t.title}</div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(t.id) }} title="Elimina" style={{ background: 'none', border: 'none', color: '#48484a', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: prio.color, border: `1px solid ${prio.color}55`, borderRadius: 6, padding: '2px 6px', textTransform: 'uppercase' }}>{prio.label}</span>
        {t.due_date && <span style={{ fontSize: 11, color: overdue ? '#ff375f' : '#86868b' }}>📅 {t.due_date}</span>}
        {t.description && <span title="Contiene note" style={{ fontSize: 11, color: '#86868b' }}>📝</span>}
        {Array.isArray(t.attachments) && t.attachments.length > 0 && <span title="Allegati" style={{ fontSize: 11, color: '#86868b' }}>📎 {t.attachments.length}</span>}
      </div>
      <div style={{ fontSize: 12, color: '#86868b', marginTop: 8 }}>👤 {memberName(t.assignee_id)}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
        <select value={t.status || 'todo'} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); onPatch(t.id, { status: e.target.value }) }}
          style={{ ...input, width: 'auto', flex: 1, padding: '5px 8px', fontSize: 12 }}>
          {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        {t.status === 'in_review' && (
          <button onClick={(e) => { e.stopPropagation(); onPatch(t.id, { status: 'approved' }) }}
            style={{ background: '#30d158', border: 'none', borderRadius: 7, padding: '6px 10px', color: '#04210f', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓ Approva</button>
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#7b5bff', fontWeight: 600 }}>📝 Apri per note &amp; allegati</div>
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
  const [desc, setDesc] = useState(task.description || '')
  const [uploading, setUploading] = useState(false)
  useEffect(() => { setDesc(task.description || '') }, [task.id])

  const attachments = Array.isArray(task.attachments) ? task.attachments : []

  async function onPick(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try { await onUpload(task.id, file) } finally { setUploading(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, width: 'min(640px, 100%)', maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <input
            defaultValue={task.title}
            onBlur={e => { const v = e.target.value.trim(); if (v && v !== task.title) onPatch(task.id, { title: v }) }}
            style={{ ...input, fontSize: 18, fontWeight: 700, fontFamily: 'Barlow Condensed', border: 'none', padding: '4px 0', background: 'transparent' }}
          />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#86868b', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: '#86868b', marginBottom: 12 }}>Assegnato a {memberName(task.assignee_id)}</div>

        <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#86868b' }}>
            Priorità
            <select value={task.priority || 'medium'} onChange={e => onPatch(task.id, { priority: e.target.value })} style={{ ...input, width: 'auto', padding: '5px 8px', fontSize: 12 }}>
              {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#86868b' }}>
            Stato
            <select value={task.status || 'todo'} onChange={e => onPatch(task.id, { status: e.target.value })} style={{ ...input, width: 'auto', padding: '5px 8px', fontSize: 12 }}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
        </div>

        {/* Note / dettagli */}
        <label style={{ fontSize: 11, color: '#86868b', textTransform: 'uppercase', letterSpacing: '.08em' }}>Note / dettagli</label>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onBlur={() => { if (desc !== (task.description || '')) onPatch(task.id, { description: desc }) }}
          placeholder="Scrivi qui descrizione, dettagli, istruzioni…"
          rows={6}
          style={{ ...input, marginTop: 6, resize: 'vertical', lineHeight: 1.5 }}
        />

        {/* Allegati */}
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: 11, color: '#86868b', textTransform: 'uppercase', letterSpacing: '.08em' }}>Allegati</label>
          <label style={{ ...btnGhost, cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
            {uploading ? 'Caricamento…' : '+ Allega file'}
            <input type="file" hidden disabled={uploading} onChange={onPick}
              accept=".pdf,.csv,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.doc,.docx,.txt" />
          </label>
        </div>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attachments.length === 0 && <div style={{ color: '#48484a', fontSize: 12 }}>Nessun allegato. PDF, CSV, immagini, Excel, Word (max ~4MB).</div>}
          {attachments.map(a => (
            <div key={a.path} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {a.name}</span>
              <span style={{ fontSize: 11, color: '#86868b' }}>{fmtSize(a.size)}</span>
              <button onClick={() => onDownload(a.path)} style={{ ...btnGhost, padding: '4px 10px' }}>Scarica</button>
              <button onClick={() => onDeleteAttachment(task.id, a.path)} title="Elimina" style={{ background: 'none', border: 'none', color: '#ff375f', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const STATUS_BADGE = {
  invited: { label: 'Invitato', color: '#ff9f0a' },
  active: { label: 'Attivo', color: '#30d158' },
  disabled: { label: 'Disattivato', color: '#86868b' },
}

function TeamModal({ members, rolesCatalog, roleLabels, ownerUserId, onClose, onInvite, onUpdateRoles, onRemove }) {
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState([])
  const [sending, setSending] = useState(false)
  const [sentMsg, setSentMsg] = useState('')

  const toggle = (arr, r) => arr.includes(r) ? arr.filter(x => x !== r) : [...arr, r]

  async function submit() {
    if (!email.trim() || !email.includes('@')) { alert('Inserisci una email valida'); return }
    setSending(true)
    setSentMsg('')
    try {
      const target = email.trim().toLowerCase()
      const r = await onInvite(target, roles)
      if (r && r.ok) {
        setEmail(''); setRoles([])
        setSentMsg(r.emailSent ? `✓ Invito inviato a ${target}` : `✓ Membro aggiunto a ${target} (email non inviata)`)
        setTimeout(() => setSentMsg(''), 6000)
      }
    } finally { setSending(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, width: 'min(680px, 100%)', maxWidth: 680 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 700 }}>Gestione team</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#86868b', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {/* Invita */}
        <div style={{ marginTop: 16, padding: 14, border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: '#86868b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Invita un collaboratore</div>
          <input style={input} placeholder="email@esempio.com" value={email} onChange={e => setEmail(e.target.value)} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {rolesCatalog.map(r => (
              <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 10px', border: `1px solid ${roles.includes(r) ? '#5b8bff' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={roles.includes(r)} onChange={() => setRoles(prev => toggle(prev, r))} />
                {roleLabels[r] || r}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <button style={{ ...btn, opacity: sending ? 0.6 : 1 }} disabled={sending} onClick={submit}>
              {sending ? 'Invio…' : '✉ Invia invito'}
            </button>
            {sentMsg && <span style={{ color: '#30d158', fontSize: 13, fontWeight: 600 }}>{sentMsg}</span>}
          </div>
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
                  <span style={{ fontSize: 10, fontWeight: 700, color: badge.color, border: `1px solid ${badge.color}55`, borderRadius: 6, padding: '2px 6px', textTransform: 'uppercase' }}>{isOwner ? 'Admin' : badge.label}</span>
                  {!isOwner && <button onClick={() => onRemove(m.id)} title="Rimuovi" style={{ background: 'none', border: 'none', color: '#ff375f', cursor: 'pointer', fontSize: 16 }}>×</button>}
                </div>
                {m.full_name && <div style={{ fontSize: 12, color: '#86868b' }}>{m.email}</div>}
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

function ProjectsView({ projects, tasks, onOpen, onAdd }) {
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
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: 18, fontWeight: 700 }}>{p.name}</div>
            {p.description && <div style={{ fontSize: 13, color: '#86868b', marginTop: 4 }}>{p.description}</div>}
            <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 12, color: '#86868b', flexWrap: 'wrap' }}>
              <span><b style={{ color: '#fff' }}>{s.total}</b> task</span>
              {s.review > 0 && <span style={{ color: '#ff9f0a' }}>{s.review} in revisione</span>}
              <span style={{ color: '#30d158' }}>{s.done} completati</span>
            </div>
          </div>
        )
      })}
      {noProject > 0 && (
        <div onClick={() => onOpen('all')} style={{ ...card, cursor: 'pointer', borderTop: '3px solid #48484a' }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: 18, fontWeight: 700 }}>Senza progetto</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 12, color: '#86868b' }}><span><b style={{ color: '#fff' }}>{noProject}</b> task</span></div>
        </div>
      )}
      <div onClick={onAdd} style={{ ...card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#86868b', border: '1px dashed var(--border)', minHeight: 90 }}>+ Nuovo progetto</div>
    </div>
  )
}
