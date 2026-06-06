'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Avatar from './Avatar'

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

export default function TimeTrackingTab({ standalone = false }) {
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [entries, setEntries] = useState([])
  const [running, setRunning] = useState(null)
  const [summary, setSummary] = useState(null)
  const [me, setMe] = useState(null)
  const [period, setPeriod] = useState('week')
  const [scope, setScope] = useState('me')
  const [section, setSection] = useState('dashboard')
  const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
  const todayStr = () => new Date().toISOString().slice(0, 10)
  const [range, setRange] = useState({ from: monthStart(), to: todayStr() })
  const [groupBy, setGroupBy] = useState('project')
  const [report, setReport] = useState([])
  const [reportLoading, setReportLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ project_id: '', task_input: '', description: '' })
  const [showStart, setShowStart] = useState(false)
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
      setSummary(e.summary || null)
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
    // Risolvi il task: se il testo combacia con un task esistente uso il suo id,
    // altrimenti lo salvo come task manuale (testo libero).
    const label = (form.task_input || '').trim()
    let task_id = null, task_name = null
    if (label) {
      const pool = form.project_id ? tasks.filter(t => t.project_id === form.project_id) : tasks
      const match = pool.find(t => (t.title || '').trim().toLowerCase() === label.toLowerCase())
      if (match) task_id = match.id; else task_name = label
    }
    const r = await fetch('/api/time-entries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: form.project_id || null, task_id, task_name, description: form.description }),
    }).then(r => r.json()).catch(() => ({}))
    if (r.ok) { setForm({ project_id: '', task_input: '', description: '' }); setShowStart(false); load() }
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

  // Report: carica le voci nel range (fine giornata inclusa)
  const loadReport = useCallback(async () => {
    setReportLoading(true)
    try {
      const to = `${range.to}T23:59:59`
      const r = await fetch(`/api/time-entries?from=${range.from}T00:00:00&to=${to}&scope=${scope}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
      setReport(r.entries || [])
    } finally { setReportLoading(false) }
  }, [range, scope])
  useEffect(() => { if (section === 'report') loadReport() }, [section, loadReport])

  // Controlli finestra (come LyftTalk)
  function winClose() { try { window.close() } catch {}; try { if (!window.closed) window.location.href = '/' } catch {} }
  function winMin() { try { if (document.fullscreenElement) document.exitFullscreen() } catch {} }
  function winFull() { try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen() } catch {} }

  function exportCSV() {
    const head = ['Data', 'Inizio', 'Fine', 'Durata (h)', 'Persona', 'Progetto', 'Task', 'Descrizione']
    const rows = [head]
    for (const e of report) rows.push([
      new Date(e.started_at).toLocaleDateString('it-IT'), timeOf(e.started_at), e.ended_at ? timeOf(e.ended_at) : '',
      ((e.duration_seconds || 0) / 3600).toFixed(2), e.member_name || '', e.project_name || '', e.task_title || '', (e.description || '').replace(/\s+/g, ' '),
    ])
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `lyftimer_${range.from}_${range.to}.csv`; a.click()
  }
  function exportPDF() {
    const groups = reportGroups(report, groupBy)
    const tot = groups.reduce((s, g) => s + g.sec, 0)
    const esc = s => String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
    const body = groups.map(g => `<tr><td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${g.color};margin-right:6px"></span>${esc(g.label)}</td><td style="text-align:right">${g.count}</td><td style="text-align:right">${fmtDur(g.sec)}</td><td style="text-align:right">${tot ? Math.round(g.sec / tot * 100) : 0}%</td></tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lyftimer Report</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;color:#1a1a2e;padding:32px}h1{margin:0 0 4px}.sub{color:#777;margin-bottom:20px}table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:9px 10px;border-bottom:1px solid #e6e6ee;text-align:left}th{color:#888;font-size:12px;text-transform:uppercase}tfoot td{font-weight:700;border-top:2px solid #333}</style></head>
      <body><h1>Lyftimer — Report</h1><div class="sub">${range.from} → ${range.to} · raggruppato per ${groupBy === 'project' ? 'progetto' : groupBy === 'person' ? 'persona' : 'task'}</div>
      <table><thead><tr><th>${groupBy === 'project' ? 'Progetto' : groupBy === 'person' ? 'Persona' : 'Task'}</th><th style="text-align:right">Voci</th><th style="text-align:right">Tempo</th><th style="text-align:right">%</th></tr></thead>
      <tbody>${body}</tbody><tfoot><tr><td>Totale</td><td style="text-align:right">${report.length}</td><td style="text-align:right">${fmtDur(tot)}</td><td style="text-align:right">100%</td></tr></tfoot></table></body></html>`
    const w = window.open('', '_blank'); if (!w) return
    w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 350)
  }

  const runningSec = running ? (now - new Date(running.started_at).getTime()) / 1000 : 0
  const tasksForProject = form.project_id ? tasks.filter(t => t.project_id === form.project_id) : tasks

  // Live: somma il timer in corso a oggi e all'ultimo punto dello sparkline
  const liveTodaySec = running ? runningSec : 0
  const liveSpark = summary ? (() => { const s = [...(summary.spark || [])]; if (s.length) s[s.length - 1] += liveTodaySec; return s })() : []

  // Totali periodo + per progetto
  const totalSec = entries.reduce((s, e) => s + (e.duration_seconds || 0), 0) + (running && scope !== 'all' ? runningSec : 0)
  const byProject = {}
  for (const e of entries) {
    const k = e.project_id || '__none'
    if (!byProject[k]) byProject[k] = { name: e.project_name || 'Senza progetto', color: e.project_color, sec: 0 }
    byProject[k].sec += (e.duration_seconds || 0)
  }
  const projectRows = Object.values(byProject).sort((a, b) => b.sec - a.sec)

  // Resoconto per persona → progetto (ore totali)
  const byMember = {}
  for (const e of entries) {
    const mk = e.member_id || '__me'
    if (!byMember[mk]) byMember[mk] = { name: e.member_name || me?.name || 'Tu', avatar: e.member_avatar || (me && e.member_id === me.memberId ? me.avatar : null), sec: 0, projects: {} }
    byMember[mk].sec += (e.duration_seconds || 0)
    const pk = e.project_id || '__none'
    if (!byMember[mk].projects[pk]) byMember[mk].projects[pk] = { name: e.project_name || 'Senza progetto', color: e.project_color, sec: 0 }
    byMember[mk].projects[pk].sec += (e.duration_seconds || 0)
  }
  const memberRows = Object.values(byMember)
    .map(m => ({ ...m, projects: Object.values(m.projects).sort((a, b) => b.sec - a.sec) }))
    .sort((a, b) => b.sec - a.sec)

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
        <div style={{ display: 'flex', gap: 8, marginRight: 4 }}>
          <button onClick={winClose} title="Chiudi" style={{ width: 13, height: 13, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#ff5f57' }} />
          <button onClick={winMin} title="Riduci (esci da schermo intero)" style={{ width: 13, height: 13, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#febc2e' }} />
          <button onClick={winFull} title="Schermo intero" style={{ width: 13, height: 13, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#28c840' }} />
        </div>
        <LyftimerLogo size={34} />
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Lyftimer</h2>
          <div style={{ color: MUTED, fontSize: 13 }}>Traccia il tempo sui tuoi progetti e task</div>
        </div>
        <div style={{ flex: 1 }} />
        {!standalone && <a href="/lyftimer" target="_blank" rel="noopener" style={{ ...btn, textDecoration: 'none', fontSize: 13, display: 'inline-flex', alignItems: 'center' }}>↗ Apri come app</a>}
      </div>

      {/* Timer */}
      <div style={{ ...card, padding: 20 }}>
        {running ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18 }}>
            <Avatar name={me?.name} url={me?.avatar} size={46} />
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
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <Avatar name={me?.name} url={me?.avatar} size={46} />
            <span style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: 1, color: MUTED }}>00:00:00</span>
            <div style={{ flex: 1, minWidth: 160, color: MUTED, fontSize: 14 }}>Pronto a tracciare il tempo</div>
            <button style={{ ...btn, padding: '12px 22px', fontSize: 15 }} onClick={() => setShowStart(true)}>▶ Avvia timer</button>
          </div>
        )}
      </div>

      {/* Popup avvio: descrizione dettagliata + progetto + task (anche manuale) */}
      {showStart && (
        <div onClick={() => setShowStart(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px, 100%)', background: '#15151f', border: '1px solid #3d3d4c', borderRadius: 16, padding: 22, boxShadow: '0 24px 70px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <LyftimerLogo size={28} />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, flex: 1 }}>Avvia un nuovo timer</h3>
              <button onClick={() => setShowStart(false)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            <label style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>Cosa stai facendo nello specifico?</label>
            <textarea autoFocus style={{ ...input, marginTop: 6, marginBottom: 14, minHeight: 90, resize: 'vertical', lineHeight: 1.4 }}
              placeholder="Descrivi nel dettaglio l'attività su cui stai lavorando…"
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

            <label style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>Progetto</label>
            <select style={{ ...input, marginTop: 6, marginBottom: 14 }} value={form.project_id}
              onChange={e => setForm({ ...form, project_id: e.target.value, task_input: '' })}>
              <option value="">— Nessun progetto —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <label style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>Task <span style={{ fontWeight: 400 }}>(scegline uno o scrivine uno nuovo a mano)</span></label>
            <input list="lt-tasks" style={{ ...input, marginTop: 6 }}
              placeholder="Seleziona o digita un task…"
              value={form.task_input} onChange={e => setForm({ ...form, task_input: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') start() }} />
            <datalist id="lt-tasks">
              {tasksForProject.map(t => <option key={t.id} value={t.title} />)}
            </datalist>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button style={btnGhost} onClick={() => setShowStart(false)}>Annulla</button>
              <button style={btn} onClick={start}>▶ Avvia</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <LyftSidebar section={section} setSection={setSection} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Card riepilogo con sparkline */}
      {section === 'dashboard' && summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <StatCard label="Lavoro oggi" value={fmtDur((summary.todaySec || 0) + liveTodaySec)} spark={liveSpark} accent="#ff375f" />
          <StatCard label="Lavoro questa settimana" value={fmtDur((summary.weekSec || 0) + liveTodaySec)} spark={liveSpark} accent="#5b8bff" />
          <StatCard label="Lavoro per progetti" value={fmtDur((summary.total7 || 0) + liveTodaySec)} sub={`${(summary.projects || []).length} progett${(summary.projects || []).length === 1 ? 'o' : 'i'} · 7 giorni`} spark={liveSpark} accent="#30d158" />
        </div>
      )}

      {/* Members + Recent Activity affiancati */}
      {section === 'dashboard' && summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {/* Members */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>Members</div>
            {(summary.members || []).length === 0 ? (
              <div style={{ padding: 20, color: MUTED, fontSize: 13 }}>Nessuna attività nei 7 giorni.</div>
            ) : (() => {
              const max = Math.max(1, ...summary.members.map(m => m.weekSec || 0))
              return summary.members.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < summary.members.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <Avatar name={m.name} url={m.avatar} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    <div style={{ height: 5, background: '#14141d', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round((m.weekSec / max) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#7b5bff,#5b8bff)' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(m.todaySec)}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>oggi</div>
                  </div>
                </div>
              ))
            })()}
          </div>

          {/* Recent Activity */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>Recent Activity</div>
            {entries.length === 0 ? (
              <div style={{ padding: 20, color: MUTED, fontSize: 13 }}>Nessuna registrazione recente.</div>
            ) : (() => {
              const recent = entries.slice(0, 6)
              const max = Math.max(1, ...recent.map(e => e.duration_seconds || 0))
              return recent.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < recent.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: e.project_color || '#3d3d4c', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || e.task_title || e.project_name || 'Attività'}</div>
                    <div style={{ height: 5, background: '#14141d', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round(((e.duration_seconds || 0) / max) * 100)}%`, height: '100%', background: e.project_color || '#5b8bff' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{e.ended_at ? fmtDur(e.duration_seconds) : '▶'}</div>
                </div>
              ))
            })()}
          </div>
        </div>
      )}

      {/* Filtri + totali */}
      {(section === 'timesheets' || section === 'activity') && (
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
      )}

      {/* Riepilogo per progetto */}
      {section === 'activity' && projectRows.length > 0 && (
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

      {/* Resoconto per persona → progetto (ore totali) */}
      {section === 'activity' && memberRows.length > 0 && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
            Resoconto per persona <span style={{ color: MUTED, fontWeight: 400, fontSize: 12 }}>· ore totali per progetto</span>
          </div>
          {memberRows.map((m, i) => (
            <div key={i} style={{ padding: '14px 16px', borderBottom: i < memberRows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <Avatar name={m.name} url={m.avatar} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
                  <div style={{ color: MUTED, fontSize: 12 }}>{m.projects.length} progett{m.projects.length === 1 ? 'o' : 'i'}</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(m.sec)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingLeft: 50 }}>
                {m.projects.map((p, j) => {
                  const pct = m.sec > 0 ? Math.round((p.sec / m.sec) * 100) : 0
                  return (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.color || '#7b5bff', flexShrink: 0 }} />
                      <span style={{ width: 150, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <div style={{ flex: 1, height: 6, background: '#14141d', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: p.color || '#7b5bff' }} />
                      </div>
                      <span style={{ width: 66, textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(p.sec)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timesheet */}
      {section === 'timesheets' && (loading ? (
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
      ))}

      {/* People */}
      {section === 'people' && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>Persone <span style={{ color: MUTED, fontWeight: 400, fontSize: 12 }}>· tempo tracciato (7 giorni)</span></div>
          {!(summary?.members || []).length ? (
            <div style={{ padding: 20, color: MUTED, fontSize: 13 }}>Nessuna attività nei 7 giorni.</div>
          ) : summary.members.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < summary.members.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <Avatar name={m.name} url={m.avatar} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                <div style={{ color: MUTED, fontSize: 12 }}>oggi {fmtDur(m.todaySec)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(m.weekSec)}</div>
                <div style={{ fontSize: 11, color: MUTED }}>settimana</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      {section === 'projects' && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>Progetti <span style={{ color: MUTED, fontWeight: 400, fontSize: 12 }}>· tempo tracciato (7 giorni)</span></div>
          {!(summary?.projects || []).length ? (
            <div style={{ padding: 20, color: MUTED, fontSize: 13 }}>Nessuna attività nei 7 giorni.</div>
          ) : (() => {
            const tot = Math.max(1, summary.projects.reduce((s, p) => s + (p.sec || 0), 0))
            return summary.projects.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < summary.projects.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: p.color || '#7b5bff', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ height: 6, background: '#14141d', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((p.sec / tot) * 100)}%`, height: '100%', background: p.color || '#7b5bff' }} />
                  </div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtDur(p.sec)}</span>
              </div>
            ))
          })()}
        </div>
      )}

      {/* Report con grafici + export */}
      {section === 'report' && (() => {
        const groups = reportGroups(report, groupBy)
        const daily = reportDaily(report, range.from, range.to)
        const tot = groups.reduce((s, g) => s + g.sec, 0)
        const grpLabel = groupBy === 'project' ? 'Progetto' : groupBy === 'person' ? 'Persona' : 'Task'
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Controlli range + export */}
            <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>Dal</label>
              <input type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} style={{ ...input, width: 'auto' }} />
              <label style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>al</label>
              <input type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} style={{ ...input, width: 'auto' }} />
              <div style={{ display: 'flex', gap: 6, background: '#14141d', borderRadius: 10, padding: 4 }}>
                {[['project', 'Progetto'], ['person', 'Persona'], ['task', 'Task']].map(([id, lbl]) => (
                  <button key={id} onClick={() => setGroupBy(id)} style={{ ...btnGhost, border: 'none', background: groupBy === id ? 'linear-gradient(135deg,#7b5bff,#5b8bff)' : 'transparent', fontWeight: groupBy === id ? 700 : 400 }}>{lbl}</button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <button style={btnGhost} onClick={exportCSV}>⬇ CSV</button>
              <button style={btn} onClick={exportPDF}>⬇ PDF</button>
            </div>

            {reportLoading ? (
              <div style={{ color: MUTED }}>Caricamento…</div>
            ) : report.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: MUTED, padding: 40 }}>Nessuna registrazione nel periodo selezionato.</div>
            ) : (
              <>
                {/* Totale + Donut + barre giornaliere */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                  <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 18 }}>
                    <Donut data={groups} size={140} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: MUTED, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Totale {range.from} → {range.to}</div>
                      <div style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginBottom: 8 }}>{fmtDur(tot)}</div>
                      {groups.slice(0, 5).map((g, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 3 }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
                          <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(g.sec)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ ...card }}>
                    <div style={{ fontSize: 13, color: MUTED, marginBottom: 12, fontWeight: 700 }}>Ore per giorno</div>
                    <DailyBars days={daily} />
                  </div>
                </div>

                {/* Tabella raggruppata */}
                <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 60px', padding: '10px 16px', borderBottom: '1px solid var(--border)', color: MUTED, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                    <span>{grpLabel}</span><span style={{ textAlign: 'right' }}>Voci</span><span style={{ textAlign: 'right' }}>Tempo</span><span style={{ textAlign: 'right' }}>%</span>
                  </div>
                  {groups.map((g, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 60px', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: g.color, flexShrink: 0 }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span></span>
                      <span style={{ textAlign: 'right', color: MUTED, fontSize: 13 }}>{g.count}</span>
                      <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(g.sec)}</span>
                      <span style={{ textAlign: 'right', color: MUTED, fontSize: 13 }}>{tot ? Math.round(g.sec / tot * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })()}

        </div>
      </div>

      <style>{`@keyframes lt-pulse{0%{box-shadow:0 0 0 0 rgba(255,55,95,.6)}70%{box-shadow:0 0 0 10px rgba(255,55,95,0)}100%{box-shadow:0 0 0 0 rgba(255,55,95,0)}}`}</style>
    </div>
  )
}

// Menu laterale di Lyftimer (stile Hubstaff).
function LyftSidebar({ section, setSection }) {
  const items = [
    ['dashboard', 'Dashboard', 'grid'],
    ['timesheets', 'Timesheets', 'clock'],
    ['activity', 'Attività', 'chart'],
    ['report', 'Report', 'report'],
    ['people', 'Persone', 'people'],
    ['projects', 'Progetti', 'folder'],
  ]
  return (
    <aside style={{ width: 192, flexShrink: 0, ...card, padding: 8, position: 'sticky', top: 12, alignSelf: 'flex-start' }}>
      {items.map(([id, label, icon]) => {
        const active = section === id
        return (
          <button key={id} onClick={() => setSection(id)} style={{
            display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
            padding: '10px 12px', marginBottom: 2, borderRadius: 9, border: 'none', cursor: 'pointer',
            fontFamily: 'Barlow', fontSize: 14, fontWeight: active ? 700 : 500,
            background: active ? 'linear-gradient(135deg,rgba(123,91,255,0.22),rgba(91,139,255,0.22))' : 'transparent',
            color: active ? '#fff' : '#b9b9c8',
          }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
            <SideIcon name={icon} active={active} />
            {label}
          </button>
        )
      })}
    </aside>
  )
}

function SideIcon({ name, active }) {
  const p = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: active ? '#7b9bff' : 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (name) {
    case 'grid': return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
    case 'clock': return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
    case 'chart': return <svg {...p}><path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 4-5" /></svg>
    case 'report': return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 17v-3M12 17v-5M16 17v-2" /></svg>
    case 'people': return <svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.9" /><path d="M17.5 20a5.5 5.5 0 0 0-3-4.9" /></svg>
    case 'folder': return <svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
    default: return <svg {...p}><circle cx="12" cy="12" r="9" /></svg>
  }
}

// Aggregazioni report
function reportGroups(entries, groupBy) {
  const m = {}
  for (const e of entries) {
    const label = groupBy === 'project' ? (e.project_name || 'Senza progetto') : groupBy === 'person' ? (e.member_name || '—') : (e.task_title || 'Senza task')
    const color = groupBy === 'project' ? (e.project_color || '#7b5bff') : '#7b5bff'
    if (!m[label]) m[label] = { label, color, sec: 0, count: 0 }
    m[label].sec += (e.duration_seconds || 0); m[label].count++
  }
  return Object.values(m).sort((a, b) => b.sec - a.sec)
}
function reportDaily(entries, from, to) {
  const days = []; const d0 = new Date(from + 'T00:00:00'); const d1 = new Date(to + 'T00:00:00')
  let guard = 0
  for (let d = new Date(d0); d <= d1 && guard < 200; d.setDate(d.getDate() + 1), guard++) days.push({ key: d.toDateString(), label: `${d.getDate()}/${d.getMonth() + 1}`, sec: 0 })
  const idx = {}; days.forEach((x, i) => { idx[x.key] = i })
  for (const e of entries) { const k = new Date(e.started_at).toDateString(); if (idx[k] !== undefined) days[idx[k]].sec += (e.duration_seconds || 0) }
  return days
}

// Donut: distribuzione tempo per gruppo.
function Donut({ data = [], size = 140 }) {
  const total = data.reduce((s, d) => s + d.sec, 0)
  const r = size / 2 - 12, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r
  let acc = 0
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#14141d" strokeWidth="14" />
      {total > 0 && data.map((d, i) => {
        const frac = d.sec / total, len = frac * C, off = acc * C
        acc += frac
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="14"
          strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off}
          transform={`rotate(-90 ${cx} ${cy})`} />
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">{fmtDur(total)}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#8e8e9e">totale</text>
    </svg>
  )
}

// Barre verticali ore/giorno.
function DailyBars({ days = [] }) {
  const max = Math.max(1, ...days.map(d => d.sec))
  const show = days.length > 31 ? days.filter((_, i) => i % Math.ceil(days.length / 31) === 0) : days
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: show.length > 20 ? 2 : 5, height: 130 }}>
      {show.map((d, i) => (
        <div key={i} title={`${d.label}: ${fmtDur(d.sec)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <div style={{ width: '100%', height: 100, display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', height: `${Math.round((d.sec / max) * 100)}%`, minHeight: d.sec > 0 ? 3 : 0, background: 'linear-gradient(180deg,#7b5bff,#5b8bff)', borderRadius: '3px 3px 0 0' }} />
          </div>
          {show.length <= 16 && <span style={{ fontSize: 9, color: '#8e8e9e', whiteSpace: 'nowrap' }}>{d.label}</span>}
        </div>
      ))}
    </div>
  )
}

// Card riepilogo: etichetta, valore grande, sparkline.
function StatCard({ label, value, sub, spark, accent = '#5b8bff' }) {
  return (
    <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ color: MUTED, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <Sparkline data={spark} accent={accent} />
      </div>
      {sub && <div style={{ color: MUTED, fontSize: 12 }}>{sub}</div>}
    </div>
  )
}

// Sparkline SVG: polilinea + area sfumata sugli ultimi N valori.
function Sparkline({ data = [], accent = '#5b8bff', w = 96, h = 32 }) {
  if (!data || data.length < 2) return <svg width={w} height={h} />
  const max = Math.max(1, ...data)
  const step = w / (data.length - 1)
  const pts = data.map((v, i) => [i * step, h - 3 - (v / max) * (h - 6)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${w} ${h} L0 ${h} Z`
  const id = 'sk' + Math.round(max) + data.length
  return (
    <svg width={w} height={h} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.35" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={accent} />
    </svg>
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
