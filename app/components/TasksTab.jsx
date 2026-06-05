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

const card = { background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }
const input = { background: 'var(--surface,#0d0d16)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 13, fontFamily: 'Barlow', width: '100%' }
const btn = { background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' }
const btnGhost = { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow' }

export default function TasksTab() {
  const [projects, setProjects] = useState([])
  const [members, setMembers] = useState([])
  const [tasks, setTasks] = useState([])
  const [me, setMe] = useState(null)
  const [activeProject, setActiveProject] = useState('all')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
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
    await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
  }

  const visible = tasks.filter(t => activeProject === 'all' || t.project_id === activeProject)

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
          <select value={activeProject} onChange={e => setActiveProject(e.target.value)} style={{ ...input, width: 'auto' }}>
            <option value="all">Tutti i progetti</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button style={btnGhost} onClick={addProject}>+ Progetto</button>
        </div>
      </div>

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
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(220px, 1fr))`, gap: 12, overflowX: 'auto' }}>
        {COLUMNS.map(col => {
          const items = visible.filter(t => (t.status || 'todo') === col.id)
          return (
            <div key={col.id} style={{ minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: col.color }} />
                <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 15, textTransform: 'uppercase', letterSpacing: '.05em' }}>{col.label}</span>
                <span style={{ color: '#86868b', fontSize: 12 }}>{items.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map(t => <TaskCard key={t.id} t={t} memberName={memberName} onPatch={patchTask} onDelete={deleteTask} />)}
                {items.length === 0 && <div style={{ color: '#48484a', fontSize: 12, padding: '8px 2px' }}>—</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskCard({ t, memberName, onPatch, onDelete }) {
  const prio = PRIORITIES.find(p => p.id === (t.priority || 'medium')) || PRIORITIES[1]
  const overdue = t.due_date && t.status !== 'done' && t.status !== 'approved' && new Date(t.due_date) < new Date(new Date().toDateString())
  return (
    <div style={{ ...card, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>{t.title}</div>
        <button onClick={() => onDelete(t.id)} title="Elimina" style={{ background: 'none', border: 'none', color: '#48484a', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: prio.color, border: `1px solid ${prio.color}55`, borderRadius: 6, padding: '2px 6px', textTransform: 'uppercase' }}>{prio.label}</span>
        {t.due_date && <span style={{ fontSize: 11, color: overdue ? '#ff375f' : '#86868b' }}>📅 {t.due_date}</span>}
      </div>
      <div style={{ fontSize: 12, color: '#86868b', marginTop: 8 }}>👤 {memberName(t.assignee_id)}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
        <select value={t.status || 'todo'} onChange={e => onPatch(t.id, { status: e.target.value })}
          style={{ ...input, width: 'auto', flex: 1, padding: '5px 8px', fontSize: 12 }}>
          {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        {t.status === 'in_review' && (
          <button onClick={() => onPatch(t.id, { status: 'approved' })}
            style={{ background: '#30d158', border: 'none', borderRadius: 7, padding: '6px 10px', color: '#04210f', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓ Approva</button>
        )}
      </div>
    </div>
  )
}
