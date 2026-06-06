'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

// Lyftimer — time tracking stile Hubstaff. Ogni membro avvia un timer scegliendo
// progetto, (opz.) task e una descrizione di cosa sta facendo. Allo stop la voce
// viene salvata nel timesheet con la durata. Totali per giorno/settimana e
// riepilogo per progetto. L'admin può vedere il tempo di tutto il team.
// Fetch verso /api/time-entries, /api/projects, /api/tasks.

const card = { background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }
const input = { background: '#14141d', border: '1px solid #3d3d4c', borderRadius: 8, padding: '9px 11px', color: '#fff', fontSize: 14, fontFamily: 'Barlow', width: '100%' }
const btn = { background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 8, padding: '10px 18px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' }
const btnStop = { ...btn, background: 'linear-gradient(135deg,#ff375f,#ff5f7a)' }
const btnGhost = { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow' }
const MUTED = '#8e8e9e'

function fmtHMS(sec) {
  sec = Math.max(0, Math.floor(sec || 0))
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
function fmtDur(sec) {
  sec = Math.max(0, Math.floor(sec || 0))
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m`
  return `${sec}s`
}
function dayLabel(iso) {
  const d = new Date(iso); const today = new Date(); const yest = new Date(); yest.setDate(yest.getDate() - 1)
  const same = (a, b) => a.toDateString() === b.toDateString()
  if (same(d, today)) return 'Oggi'
  if (same(d, yest)) return 'Ieri'
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}
function timeOf(iso) { return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) }

export default function TimeTrackingTab() {
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [entries, setEntries] = useState([])
  const [running, setRunning] = useState(null)
  const [me, setMe] = useState(null)
  const [period, setPeriod] = useState('week')
  const [scope, setScope] = useState('me')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ project_id: '', task_id: '', description: '' })
  const [now, setNow] = useState(Date.now())
  const tick = useRef(null)

  const load = useCallback(async () => {
    try {
      const [p, t, e] = await Promise.all([
        fetch('/api/projects', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        fetch('/api/tasks', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        fetch(`/api/time-entries?period=${period}&scope=${scope}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
      ])
      setProjects(p.projects || [])
      setTasks(t.tasks || [])
      setEntries(e.entries || [])
      setRunning(e.running || null)
      setMe(e.me || null)
    } finally { setLoading(false) }
  }, [period, scope])

  useEffect(() => { load() }, [load])

  // Tick al secondo per il cronometro live
  useEffect(() => {
    tick.current = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick.current)
  }, [])

  async function start() {
    const r = await fetch('/api/time-entries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: form.project_id || null, task_id: form.task_id || null, description: form.description }),
    }).then(r => r.json()).catch(() => ({}))
    if (r.ok) { setForm({ project_id: '', task_id: '', description: '' }); load() }
  }
  async function stop() {
    await fetch('/api/time-entries', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stop: true }) })
    load()
  }
  async function del(id) {
    if (!confirm('Eliminare questa registrazione?')) return
    await fetch(`/api/time-entries?id=${id}`, { method: 'DELETE' })
    load()
  }

  const runningSec = running ? (now - new Date(running.started_at).getTime()) / 1000 : 0
  const tasksForProject = form.project_id ? tasks.filter(t => t.project_id === form.project_id) : tasks

  // Totali periodo + per progetto
  const totalSec = entries.reduce((s, e) => s + (e.duration_seconds || 0), 0) + (running && scope !== 'all' ? runningSec : 0)
  const byProject = {}
  for (const e of entries) {
    const k = e.project_id || '__none'
    if (!byProject[k]) byProject[k] = { name: e.project_name || 'Senza progetto', color: e.project_color, sec: 0 }
    byProject[k].sec += (e.duration_seconds || 0)
  }
  const projectRows = Object.values(byProject).sort((a, b) => b.sec - a.sec)

  // Raggruppa per giorno
  const groups = []
  const seen = {}
  for (const e of entries) {
    const key = new Date(e.started_at).toDateString()
    if (!seen[key]) { seen[key] = { key, label: dayLabel(e.started_at), items: [], sec: 0 } ; groups.push(seen[key]) }
    seen[key].items.push(e); seen[key].sec += (e.duration_seconds || 0)
  }

  const projName = (id) => projects.find(p => p.id === id)?.name
  const projColor = (id) => projects.find(p => p.id === id)?.color || '#7b5bff'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <LyftimerLogo size={34} />
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Lyftimer</h2>
          <div style={{ color: MUTED, fontSize: 13 }}>Traccia il tempo sui tuoi progetti e task</div>
        </div>
      </div>

      {/* Timer */}
      <div style={{ ...card, padding: 20 }}>
        {running ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff375f', boxShadow: '0 0 0 0 rgba(255,55,95,.6)', animation: 'lt-pulse 1.4s infinite' }} />
              <span style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>{fmtHMS(runningSec)}</span>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{running.description || 'Senza descrizione'}</div>
              <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>
                {running.project_name ? <span style={{ color: running.project_color || '#7b5bff' }}>● {running.project_name}</span> : 'Nessun progetto'}
                {running.task_title ? ` · ${running.task_title}` : ''} · iniziato {timeOf(running.started_at)}
              </div>
            </div>
            <button style={btnStop} onClick={stop}>■ Ferma</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input style={input} placeholder="Su cosa stai lavorando?" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') start() }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <select style={{ ...input, width: 'auto', minWidth: 180 }} value={form.project_id}
                onChange={e => setForm({ ...form, project_id: e.target.value, task_id: '' })}>
                <option value="">— Progetto —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select style={{ ...input, width: 'auto', minWidth: 180 }} value={form.task_id}
                onChange={e => setForm({ ...form, task_id: e.target.value })}>
                <option value="">— Task (opzionale) —</option>
                {tasksForProject.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: MUTED }}>00:00:00</span>
              <button style={btn} onClick={start}>▶ Avvia</button>
            </div>
          </div>
        )}
      </div>

      {/* Filtri + totali */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, background: '#14141d', borderRadius: 10, padding: 4 }}>
          {[['today', 'Oggi'], ['week', 'Settimana'], ['all', 'Tutto']].map(([id, lbl]) => (
            <button key={id} onClick={() => setPeriod(id)} style={{ ...btnGhost, border: 'none', background: period === id ? 'linear-gradient(135deg,#7b5bff,#5b8bff)' : 'transparent', fontWeight: period === id ? 700 : 400 }}>{lbl}</button>
          ))}
        </div>
        {me?.isAdmin && (
          <div style={{ display: 'flex', gap: 6, background: '#14141d', borderRadius: 10, padding: 4 }}>
            {[['me', 'Solo io'], ['all', 'Tutto il team']].map(([id, lbl]) => (
              <button key={id} onClick={() => setScope(id)} style={{ ...btnGhost, border: 'none', background: scope === id ? 'linear-gradient(135deg,#7b5bff,#5b8bff)' : 'transparent', fontWeight: scope === id ? 700 : 400 }}>{lbl}</button>
            ))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: MUTED, fontSize: 12 }}>Totale {period === 'today' ? 'oggi' : period === 'week' ? 'settimana' : 'complessivo'}</div>
          <div style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(totalSec)}</div>
        </div>
      </div>

      {/* Riepilogo per progetto */}
      {projectRows.length > 0 && (
        <div style={{ ...card }}>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 10, fontWeight: 700 }}>Per progetto</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {projectRows.map((r, i) => {
              const pct = totalSec > 0 ? Math.round((r.sec / (totalSec || 1)) * 100) : 0
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: r.color || '#7b5bff', flexShrink: 0 }} />
                  <span style={{ width: 160, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  <div style={{ flex: 1, height: 8, background: '#14141d', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: r.color || '#7b5bff' }} />
                  </div>
                  <span style={{ width: 70, textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(r.sec)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Timesheet */}
      {loading ? (
        <div style={{ color: MUTED }}>Caricamento…</div>
      ) : groups.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: MUTED, padding: 40 }}>
          Nessuna registrazione nel periodo selezionato. Avvia il timer per iniziare.
        </div>
      ) : (
        groups.map(g => (
          <div key={g.key} style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{g.label}</span>
              <span style={{ color: MUTED, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(g.sec)}</span>
            </div>
            {g.items.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.project_color || '#3d3d4c', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || 'Senza descrizione'}</div>
                  <div style={{ color: MUTED, fontSize: 12 }}>
                    {scope === 'all' && me?.isAdmin && e.member_name ? <b style={{ color: '#b9b9c8' }}>{e.member_name} · </b> : ''}
                    {e.project_name || 'Nessun progetto'}{e.task_title ? ` · ${e.task_title}` : ''}
                  </div>
                </div>
                <div style={{ color: MUTED, fontSize: 12, whiteSpace: 'nowrap' }}>{timeOf(e.started_at)}{e.ended_at ? `–${timeOf(e.ended_at)}` : ''}</div>
                <span style={{ width: 70, textAlign: 'right', fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{e.ended_at ? fmtDur(e.duration_seconds) : '—'}</span>
                <button onClick={() => del(e.id)} title="Elimina" style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}>×</button>
              </div>
            ))}
          </div>
        ))
      )}

      <style>{`@keyframes lt-pulse{0%{box-shadow:0 0 0 0 rgba(255,55,95,.6)}70%{box-shadow:0 0 0 10px rgba(255,55,95,0)}100%{box-shadow:0 0 0 0 rgba(255,55,95,0)}}`}</style>
    </div>
  )
}

// Logo Lyftimer: cronometro stilizzato con la lancetta a forma di freccia "Lyft".
function LyftimerLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="lt-g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7b5bff" /><stop offset="1" stopColor="#5b8bff" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#lt-g)" />
      <line x1="24" y1="6.5" x2="24" y2="10.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="26" r="13" stroke="#fff" strokeWidth="2.4" fill="none" opacity="0.55" />
      {/* lancette: ore (corta) + freccia ascendente (Lyft) */}
      <path d="M24 26 L24 18" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M24 26 L31 23 L27.5 27.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="24" cy="26" r="2.4" fill="#fff" />
    </svg>
  )
}
