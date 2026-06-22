'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Icon from './ui/Icon'
import Avatar from './Avatar'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Lyftimer — time tracking professionale. Ogni membro avvia un timer scegliendo
// progetto, (opz.) task e una descrizione di cosa sta facendo. Allo stop la voce
// viene salvata nel timesheet con la durata. Totali per giorno/settimana e
// riepilogo per progetto. L'admin può vedere il tempo di tutto il team.
// Fetch verso /api/time-entries, /api/projects, /api/tasks.

const card = { background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }
const input = { background: '#14141d', border: '1px solid #3d3d4c', borderRadius: 8, padding: '9px 11px', color: 'var(--text)', fontSize: 14, fontFamily: 'Barlow', width: '100%' }
const btn = { background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 8, padding: '10px 18px', color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' }
const btnStop = { ...btn, background: 'linear-gradient(135deg,#ff375f,#ff5f7a)' }
const btnGhost = { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: 'var(--text)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow' }
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
// Locale + funzione di traduzione condivisi con gli helper module-level
// (impostati a ogni render del componente, così i call-site restano invariati).
let _LOC = 'it-IT'
let _T = (k, v, f) => f
function dayLabel(iso) {
  const d = new Date(iso); const today = new Date(); const yest = new Date(); yest.setDate(yest.getDate() - 1)
  const same = (a, b) => a.toDateString() === b.toDateString()
  if (same(d, today)) return _T('lt.dayToday', null, 'Today')
  if (same(d, yest)) return _T('lt.dayYesterday', null, 'Yesterday')
  return d.toLocaleDateString(_LOC, { weekday: 'long', day: 'numeric', month: 'long' })
}
function timeOf(iso) { return new Date(iso).toLocaleTimeString(_LOC, { hour: '2-digit', minute: '2-digit' }) }

export default function TimeTrackingTab({ standalone = false }) {
  const { t, intlLocale } = useI18n()
  _LOC = intlLocale; _T = t
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [entries, setEntries] = useState([])
  const [running, setRunning] = useState(null)
  const [summary, setSummary] = useState(null)
  const [me, setMe] = useState(null)
  const [period, setPeriod] = useState('week')
  const [scope, setScope] = useState('me')
  const [section, setSection] = useState('dashboard')
  const mondayOf = (d) => { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x }
  const [approveWeek, setApproveWeek] = useState(() => { const x = new Date(); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x.toISOString().slice(0, 10) })
  const [approvals, setApprovals] = useState({ rows: [], loaded: false })
  const [attDay, setAttDay] = useState(() => new Date().toISOString().slice(0, 10))
  const [attendance, setAttendance] = useState({ rows: [], loaded: false })
  const [timeoff, setTimeoff] = useState([])
  const [showOff, setShowOff] = useState(false)
  const [offForm, setOffForm] = useState({ type: 'ferie', start_date: '', end_date: '', note: '', member_id: '' })
  const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
  const todayStr = () => new Date().toISOString().slice(0, 10)
  const [range, setRange] = useState({ from: monthStart(), to: todayStr() })
  const [groupBy, setGroupBy] = useState('project')
  const [report, setReport] = useState([])
  const [reportLoading, setReportLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ project_id: '', task_input: '', description: '', billable: true })
  const [showStart, setShowStart] = useState(false)
  const [budget, setBudget] = useState({ entries: [], loaded: false })
  const [members, setMembers] = useState([])
  const [now, setNow] = useState(Date.now())
  const tick = useRef(null)

  const load = useCallback(async () => {
    try {
      const [p, t, e, mem] = await Promise.all([
        fetch('/api/projects', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        fetch('/api/tasks', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        fetch(`/api/time-entries?period=${period}&scope=${scope}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        fetch('/api/team-members', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
      ])
      setProjects(p.projects || [])
      setMembers(mem.members || [])
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
      body: JSON.stringify({ project_id: form.project_id || null, task_id, task_name, description: form.description, billable: form.billable !== false }),
    }).then(r => r.json()).catch(() => ({}))
    if (r.ok) { setForm({ project_id: '', task_input: '', description: '', billable: true }); setShowStart(false); load() }
  }
  async function stop() {
    await fetch('/api/time-entries', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stop: true }) })
    load()
  }
  async function del(id) {
    if (!confirm(t('lt.confirmDeleteEntry', null, 'Delete this entry?'))) return
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

  // Budget: tutte le voci (costo = ore × tariffa membro, lato API)
  const loadBudget = useCallback(async () => {
    const r = await fetch('/api/time-entries?from=2000-01-01T00:00:00&scope=all', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
    setBudget({ entries: r.entries || [], loaded: true })
  }, [])
  useEffect(() => { if (section === 'budget') loadBudget() }, [section, loadBudget])

  async function saveProjectBudget(id, patch) {
    await fetch('/api/projects', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
    fetch('/api/projects', { cache: 'no-store' }).then(r => r.json()).then(d => setProjects(d.projects || [])).catch(() => {})
  }
  async function saveMemberRate(id, hourly_rate) {
    await fetch('/api/team-members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, hourly_rate }) })
    loadBudget()
  }

  // Approvazione ore: aggrega le ore della settimana per membro + stato approvazione
  const loadApprovals = useCallback(async () => {
    const from = `${approveWeek}T00:00:00`
    const end = new Date(approveWeek + 'T00:00:00'); end.setDate(end.getDate() + 6)
    const to = `${end.toISOString().slice(0, 10)}T23:59:59`
    const [e, a] = await Promise.all([
      fetch(`/api/time-entries?from=${from}&to=${to}&scope=all`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
      fetch(`/api/time-approvals?week=${approveWeek}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
    ])
    const agg = {}
    for (const x of (e.entries || [])) {
      const k = x.member_id; if (!k) continue
      if (!agg[k]) agg[k] = { sec: 0, cost: 0 }
      agg[k].sec += x.duration_seconds || 0; if (x.cost != null) agg[k].cost += x.cost
    }
    const appMap = {}; (a.approvals || []).forEach(x => { appMap[x.member_id] = x })
    const base = members.length ? members.map(m => ({ id: m.id, name: m.full_name || m.email, avatar: m.avatar_url })) : []
    // includi anche eventuali membri presenti solo nelle voci
    for (const k of Object.keys(agg)) if (!base.find(b => b.id === k)) base.push({ id: k, name: '—', avatar: null })
    const rows = base.map(m => ({ ...m, sec: agg[m.id]?.sec || 0, cost: agg[m.id]?.cost || 0, approval: appMap[m.id] || null }))
      .filter(r => me?.isAdmin || r.id === a.me?.memberId)
      .sort((x, y) => y.sec - x.sec)
    setApprovals({ rows, loaded: true })
  }, [approveWeek, members, me])
  useEffect(() => { if (section === 'approvals') loadApprovals() }, [section, loadApprovals])

  async function setApproval(member_id, status, sec) {
    await fetch('/api/time-approvals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_id, week_start: approveWeek, status, total_seconds: sec }) })
    loadApprovals()
  }
  async function resetApproval(member_id) {
    await fetch(`/api/time-approvals?member_id=${member_id}&week=${approveWeek}`, { method: 'DELETE' })
    loadApprovals()
  }
  function shiftWeek(delta) {
    const d = new Date(approveWeek + 'T00:00:00'); d.setDate(d.getDate() + delta * 7)
    setApproveWeek(d.toISOString().slice(0, 10))
  }

  // Presenze (dal timer) + ferie/permessi
  const loadAttendance = useCallback(async () => {
    const from = `${attDay}T00:00:00`, to = `${attDay}T23:59:59`
    const [e, off] = await Promise.all([
      fetch(`/api/time-entries?from=${from}&to=${to}&scope=all`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
      fetch('/api/time-off', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
    ])
    const agg = {}
    for (const x of (e.entries || [])) {
      const k = x.member_id; if (!k) continue
      if (!agg[k]) agg[k] = { name: x.member_name || '—', avatar: x.member_avatar, firstIn: x.started_at, lastOut: x.ended_at, sec: 0, running: false }
      if (x.started_at < agg[k].firstIn) agg[k].firstIn = x.started_at
      if (!x.ended_at) agg[k].running = true
      else if (!agg[k].lastOut || x.ended_at > agg[k].lastOut) agg[k].lastOut = x.ended_at
      agg[k].sec += x.duration_seconds || 0
    }
    setAttendance({ rows: Object.values(agg).sort((a, b) => b.sec - a.sec), loaded: true })
    setTimeoff(off.requests || [])
  }, [attDay])
  useEffect(() => { if (section === 'attendance') loadAttendance() }, [section, loadAttendance])

  async function submitTimeOff() {
    if (!offForm.start_date || !offForm.end_date) return
    const r = await fetch('/api/time-off', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(offForm) }).then(r => r.json()).catch(() => ({}))
    if (r.ok) { setShowOff(false); setOffForm({ type: 'ferie', start_date: '', end_date: '', note: '', member_id: '' }); loadAttendance() }
  }
  async function setOffStatus(id, status) {
    await fetch('/api/time-off', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    loadAttendance()
  }
  async function delTimeOff(id) {
    if (!confirm(t('lt.confirmDeleteRequest', null, 'Delete this request?'))) return
    await fetch(`/api/time-off?id=${id}`, { method: 'DELETE' })
    loadAttendance()
  }

  // Controlli finestra (come LyftTalk)
  function winClose() { try { window.close() } catch {}; try { if (!window.closed) window.location.href = '/' } catch {} }
  function winMin() { try { if (document.fullscreenElement) document.exitFullscreen() } catch {} }
  function winFull() { try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen() } catch {} }

  function exportCSV() {
    const head = [t('lt.csvDate', null, 'Date'), t('lt.csvStart', null, 'Start'), t('lt.csvEnd', null, 'End'), t('lt.csvDuration', null, 'Duration (h)'), t('lt.csvPerson', null, 'Person'), t('lt.csvProject', null, 'Project'), t('lt.csvTask', null, 'Task'), t('lt.csvDescription', null, 'Description')]
    const rows = [head]
    for (const e of report) rows.push([
      new Date(e.started_at).toLocaleDateString(intlLocale), timeOf(e.started_at), e.ended_at ? timeOf(e.ended_at) : '',
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
    const grpHead = groupBy === 'project' ? t('lt.project', null, 'Project') : groupBy === 'person' ? t('lt.person', null, 'Person') : t('lt.task', null, 'Task')
    const grpWord = groupBy === 'project' ? t('lt.projectLower', null, 'project') : groupBy === 'person' ? t('lt.personLower', null, 'person') : t('lt.taskLower', null, 'task')
    const body = groups.map(g => `<tr><td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${g.color};margin-right:6px"></span>${esc(g.label)}</td><td style="text-align:right">${g.count}</td><td style="text-align:right">${fmtDur(g.sec)}</td><td style="text-align:right">${tot ? Math.round(g.sec / tot * 100) : 0}%</td></tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lyftimer Report</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;color:#1a1a2e;padding:32px}h1{margin:0 0 4px}.sub{color:#777;margin-bottom:20px}table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:9px 10px;border-bottom:1px solid #e6e6ee;text-align:left}th{color:#888;font-size:12px;text-transform:uppercase}tfoot td{font-weight:700;border-top:2px solid #333}</style></head>
      <body><h1>Lyftimer — ${t('lt.pdfReport', null, 'Report')}</h1><div class="sub">${range.from} → ${range.to} · ${t('lt.groupedBy', null, 'grouped by')} ${grpWord}</div>
      <table><thead><tr><th>${grpHead}</th><th style="text-align:right">${t('lt.entries', null, 'Entries')}</th><th style="text-align:right">${t('lt.time', null, 'Time')}</th><th style="text-align:right">%</th></tr></thead>
      <tbody>${body}</tbody><tfoot><tr><td>${t('lt.total', null, 'Total')}</td><td style="text-align:right">${report.length}</td><td style="text-align:right">${fmtDur(tot)}</td><td style="text-align:right">100%</td></tr></tfoot></table></body></html>`
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
    if (!byProject[k]) byProject[k] = { name: e.project_name || t('lt.noProjectLabel', null, 'No project'), color: e.project_color, sec: 0 }
    byProject[k].sec += (e.duration_seconds || 0)
  }
  const projectRows = Object.values(byProject).sort((a, b) => b.sec - a.sec)

  // Resoconto per persona → progetto (ore totali)
  const byMember = {}
  for (const e of entries) {
    const mk = e.member_id || '__me'
    if (!byMember[mk]) byMember[mk] = { name: e.member_name || me?.name || t('lt.you', null, 'You'), avatar: e.member_avatar || (me && e.member_id === me.memberId ? me.avatar : null), sec: 0, projects: {} }
    byMember[mk].sec += (e.duration_seconds || 0)
    const pk = e.project_id || '__none'
    if (!byMember[mk].projects[pk]) byMember[mk].projects[pk] = { name: e.project_name || t('lt.noProjectLabel', null, 'No project'), color: e.project_color, sec: 0 }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: standalone ? 'none' : 1000, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginRight: 4 }}>
          <button onClick={winClose} title={t('lt.winClose', null, 'Close')} style={{ width: 13, height: 13, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#ff5f57' }} />
          <button onClick={winMin} title={t('lt.winMin', null, 'Minimize (exit full screen)')} style={{ width: 13, height: 13, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#febc2e' }} />
          <button onClick={winFull} title={t('lt.winFull', null, 'Full screen')} style={{ width: 13, height: 13, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#28c840' }} />
        </div>
        <LyftimerLogo size={34} />
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Lyftimer</h2>
          <div style={{ color: MUTED, fontSize: 13 }}>{t('lt.subtitle', null, 'Track time on your projects and tasks')}</div>
        </div>
        <div style={{ flex: 1 }} />
        {!standalone && <a href="/lyftimer" target="_blank" rel="noopener" style={{ ...btn, textDecoration: 'none', fontSize: 13, display: 'inline-flex', alignItems: 'center' }}>↗ {t('lt.openAsApp', null, 'Open as app')}</a>}
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
              <div style={{ fontSize: 15, fontWeight: 700 }}>{running.description || t('lt.noDescription', null, 'No description')}</div>
              <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>
                {running.project_name ? <span style={{ color: running.project_color || '#7b5bff' }}>● {running.project_name}</span> : t('lt.noProject', null, 'No project')}
                {running.task_title ? ` · ${running.task_title}` : ''} · {t('lt.startedAt', { time: timeOf(running.started_at) }, 'started {time}')}
              </div>
            </div>
            <button style={btnStop} onClick={stop}>■ {t('lt.stop', null, 'Stop')}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <Avatar name={me?.name} url={me?.avatar} size={46} />
            <span style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: 1, color: MUTED }}>00:00:00</span>
            <div style={{ flex: 1, minWidth: 160, color: MUTED, fontSize: 14 }}>{t('lt.readyToTrack', null, 'Ready to track time')}</div>
            <button style={{ ...btn, padding: '12px 22px', fontSize: 15 }} onClick={() => setShowStart(true)}>▶ {t('lt.startTimer', null, 'Start timer')}</button>
          </div>
        )}
      </div>

      {/* Popup avvio: descrizione dettagliata + progetto + task (anche manuale) */}
      {showStart && (
        <div onClick={() => setShowStart(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px, 100%)', background: '#15151f', border: '1px solid #3d3d4c', borderRadius: 16, padding: 22, boxShadow: '0 24px 70px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <LyftimerLogo size={28} />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, flex: 1 }}>{t('lt.startNewTimer', null, 'Start a new timer')}</h3>
              <button onClick={() => setShowStart(false)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            <label style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{t('lt.whatDoing', null, 'What exactly are you working on?')}</label>
            <textarea autoFocus style={{ ...input, marginTop: 6, marginBottom: 14, minHeight: 90, resize: 'vertical', lineHeight: 1.4 }}
              placeholder={t('lt.descPlaceholder', null, 'Describe in detail the activity you are working on…')}
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

            <label style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{t('lt.project', null, 'Project')}</label>
            <select style={{ ...input, marginTop: 6, marginBottom: 14 }} value={form.project_id}
              onChange={e => setForm({ ...form, project_id: e.target.value, task_input: '' })}>
              <option value="">{t('lt.noneProject', null, '— No project —')}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <label style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{t('lt.task', null, 'Task')} <span style={{ fontWeight: 400 }}>{t('lt.taskHint', null, '(pick one or type a new one by hand)')}</span></label>
            <input list="lt-tasks" style={{ ...input, marginTop: 6 }}
              placeholder={t('lt.taskPlaceholder', null, 'Select or type a task…')}
              value={form.task_input} onChange={e => setForm({ ...form, task_input: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') start() }} />
            <datalist id="lt-tasks">
              {tasksForProject.map(t => <option key={t.id} value={t.title} />)}
            </datalist>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.billable !== false} onChange={e => setForm({ ...form, billable: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#7b5bff' }} />
              {t('lt.billable', null, 'Billable')} <span style={{ color: MUTED, fontSize: 12 }}>{t('lt.billableHint', null, '(counts toward cost/billing)')}</span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button style={btnGhost} onClick={() => setShowStart(false)}>{t('common.cancel', null, 'Cancel')}</button>
              <button style={btn} onClick={start}>▶ {t('lt.start', null, 'Start')}</button>
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
          <StatCard label={t('lt.workToday', null, 'Work today')} value={fmtDur((summary.todaySec || 0) + liveTodaySec)} spark={liveSpark} accent="#ff375f" />
          <StatCard label={t('lt.workWeek', null, 'Work this week')} value={fmtDur((summary.weekSec || 0) + liveTodaySec)} spark={liveSpark} accent="#5b8bff" />
          <StatCard label={t('lt.workProjects', null, 'Work across projects')} value={fmtDur((summary.total7 || 0) + liveTodaySec)} sub={`${(summary.projects || []).length} ${(summary.projects || []).length === 1 ? t('lt.projectWord', null, 'project') : t('lt.projectsWord', null, 'projects')} · ${t('lt.sevenDays', null, '7 days')}`} spark={liveSpark} accent="#30d158" />
        </div>
      )}

      {/* Members + Recent Activity affiancati */}
      {section === 'dashboard' && summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {/* Members */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>{t('lt.members', null, 'Members')}</div>
            {(summary.members || []).length === 0 ? (
              <div style={{ padding: 20, color: MUTED, fontSize: 13 }}>{t('lt.noActivity7', null, 'No activity in the last 7 days.')}</div>
            ) : (() => {
              const max = Math.max(1, ...summary.members.map(m => m.weekSec || 0))
              return summary.members.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < summary.members.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <Avatar name={m.name} url={m.avatar} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    <div style={{ height: 5, background: '#14141d', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round((m.weekSec / max) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#7b5bff,#5b8bff)' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(m.todaySec)}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{t('lt.todayLower', null, 'today')}</div>
                  </div>
                </div>
              ))
            })()}
          </div>

          {/* Recent Activity */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>{t('lt.recentActivity', null, 'Recent Activity')}</div>
            {entries.length === 0 ? (
              <div style={{ padding: 20, color: MUTED, fontSize: 13 }}>{t('lt.noRecentEntries', null, 'No recent entries.')}</div>
            ) : (() => {
              const recent = entries.slice(0, 6)
              const max = Math.max(1, ...recent.map(e => e.duration_seconds || 0))
              return recent.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: e.project_color || '#3d3d4c', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || e.task_title || e.project_name || t('lt.activity', null, 'Activity')}</div>
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
          {[['today', t('lt.tabToday', null, 'Today')], ['week', t('lt.tabWeek', null, 'Week')], ['all', t('lt.tabAll', null, 'All')]].map(([id, lbl]) => (
            <button key={id} onClick={() => setPeriod(id)} style={{ ...btnGhost, border: 'none', background: period === id ? 'linear-gradient(135deg,#7b5bff,#5b8bff)' : 'transparent', fontWeight: period === id ? 700 : 400 }}>{lbl}</button>
          ))}
        </div>
        {me?.isAdmin && (
          <div style={{ display: 'flex', gap: 6, background: '#14141d', borderRadius: 10, padding: 4 }}>
            {[['me', t('lt.onlyMe', null, 'Only me')], ['all', t('lt.wholeTeam', null, 'Whole team')]].map(([id, lbl]) => (
              <button key={id} onClick={() => setScope(id)} style={{ ...btnGhost, border: 'none', background: scope === id ? 'linear-gradient(135deg,#7b5bff,#5b8bff)' : 'transparent', fontWeight: scope === id ? 700 : 400 }}>{lbl}</button>
            ))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: MUTED, fontSize: 12 }}>{t('lt.totalLabel', { period: period === 'today' ? t('lt.periodToday', null, 'today') : period === 'week' ? t('lt.periodWeek', null, 'week') : t('lt.periodOverall', null, 'overall') }, 'Total {period}')}</div>
          <div style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(totalSec)}</div>
        </div>
      </div>
      )}

      {/* Riepilogo per progetto */}
      {section === 'activity' && projectRows.length > 0 && (
        <div style={{ ...card }}>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 10, fontWeight: 700 }}>{t('lt.byProject', null, 'By project')}</div>
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
            {t('lt.byPersonReport', null, 'Per-person report')} <span style={{ color: MUTED, fontWeight: 400, fontSize: 12 }}>· {t('lt.totalHoursPerProject', null, 'total hours per project')}</span>
          </div>
          {memberRows.map((m, i) => (
            <div key={i} style={{ padding: '14px 16px', borderBottom: i < memberRows.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <Avatar name={m.name} url={m.avatar} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
                  <div style={{ color: MUTED, fontSize: 12 }}>{m.projects.length} {m.projects.length === 1 ? t('lt.projectWord', null, 'project') : t('lt.projectsWord', null, 'projects')}</div>
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
        <div style={{ color: MUTED }}>{t('lt.loading', null, 'Loading…')}</div>
      ) : groups.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: MUTED, padding: 40 }}>
          {t('lt.noEntriesPeriodStart', null, 'No entries in the selected period. Start the timer to get going.')}
        </div>
      ) : (
        groups.map(g => (
          <div key={g.key} style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--glass)' }}>
              <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{g.label}</span>
              <span style={{ color: MUTED, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(g.sec)}</span>
            </div>
            {g.items.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.project_color || '#3d3d4c', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || t('lt.noDescription', null, 'No description')}</div>
                  <div style={{ color: MUTED, fontSize: 12 }}>
                    {scope === 'all' && me?.isAdmin && e.member_name ? <b style={{ color: '#b9b9c8' }}>{e.member_name} · </b> : ''}
                    {e.project_name || t('lt.noProject', null, 'No project')}{e.task_title ? ` · ${e.task_title}` : ''}
                  </div>
                </div>
                <div style={{ color: MUTED, fontSize: 12, whiteSpace: 'nowrap' }}>{timeOf(e.started_at)}{e.ended_at ? `–${timeOf(e.ended_at)}` : ''}</div>
                <span style={{ width: 70, textAlign: 'right', fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{e.ended_at ? fmtDur(e.duration_seconds) : '—'}</span>
                <button onClick={() => del(e.id)} title={t('lt.delete', null, 'Delete')} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}>×</button>
              </div>
            ))}
          </div>
        ))
      ))}

      {/* People */}
      {section === 'people' && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>{t('lt.people', null, 'People')} <span style={{ color: MUTED, fontWeight: 400, fontSize: 12 }}>· {t('lt.timeTracked7', null, 'time tracked (7 days)')}</span></div>
          {!(summary?.members || []).length ? (
            <div style={{ padding: 20, color: MUTED, fontSize: 13 }}>{t('lt.noActivity7', null, 'No activity in the last 7 days.')}</div>
          ) : summary.members.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < summary.members.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <Avatar name={m.name} url={m.avatar} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                <div style={{ color: MUTED, fontSize: 12 }}>{t('lt.todayLower', null, 'today')} {fmtDur(m.todaySec)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(m.weekSec)}</div>
                <div style={{ fontSize: 11, color: MUTED }}>{t('lt.week', null, 'week')}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      {section === 'projects' && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>{t('lt.projects', null, 'Projects')} <span style={{ color: MUTED, fontWeight: 400, fontSize: 12 }}>· {t('lt.timeTracked7', null, 'time tracked (7 days)')}</span></div>
          {!(summary?.projects || []).length ? (
            <div style={{ padding: 20, color: MUTED, fontSize: 13 }}>{t('lt.noActivity7', null, 'No activity in the last 7 days.')}</div>
          ) : (() => {
            const tot = Math.max(1, summary.projects.reduce((s, p) => s + (p.sec || 0), 0))
            return summary.projects.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < summary.projects.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
        const grpLabel = groupBy === 'project' ? t('lt.project', null, 'Project') : groupBy === 'person' ? t('lt.person', null, 'Person') : t('lt.task', null, 'Task')
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Controlli range + export */}
            <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{t('lt.fromDate', null, 'From')}</label>
              <input type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} style={{ ...input, width: 'auto' }} />
              <label style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{t('lt.toDate', null, 'to')}</label>
              <input type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} style={{ ...input, width: 'auto' }} />
              <div style={{ display: 'flex', gap: 6, background: '#14141d', borderRadius: 10, padding: 4 }}>
                {[['project', t('lt.project', null, 'Project')], ['person', t('lt.person', null, 'Person')], ['task', t('lt.task', null, 'Task')]].map(([id, lbl]) => (
                  <button key={id} onClick={() => setGroupBy(id)} style={{ ...btnGhost, border: 'none', background: groupBy === id ? 'linear-gradient(135deg,#7b5bff,#5b8bff)' : 'transparent', fontWeight: groupBy === id ? 700 : 400 }}>{lbl}</button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <button style={btnGhost} onClick={exportCSV}>⬇ CSV</button>
              <button style={btn} onClick={exportPDF}>⬇ PDF</button>
            </div>

            {reportLoading ? (
              <div style={{ color: MUTED }}>{t('lt.loading', null, 'Loading…')}</div>
            ) : report.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: MUTED, padding: 40 }}>{t('lt.noEntriesPeriod', null, 'No entries in the selected period.')}</div>
            ) : (
              <>
                {/* Totale + Donut + barre giornaliere */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                  <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 18 }}>
                    <Donut data={groups} size={140} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: MUTED, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{t('lt.total', null, 'Total')} {range.from} → {range.to}</div>
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
                    <div style={{ fontSize: 13, color: MUTED, marginBottom: 12, fontWeight: 700 }}>{t('lt.hoursPerDay', null, 'Hours per day')}</div>
                    <DailyBars days={daily} />
                  </div>
                </div>

                {/* Tabella raggruppata */}
                <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 60px', padding: '10px 16px', borderBottom: '1px solid var(--border)', color: MUTED, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                    <span>{grpLabel}</span><span style={{ textAlign: 'right' }}>{t('lt.entries', null, 'Entries')}</span><span style={{ textAlign: 'right' }}>{t('lt.time', null, 'Time')}</span><span style={{ textAlign: 'right' }}>%</span>
                  </div>
                  {groups.map((g, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 60px', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: g.color, flexShrink: 0 }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span></span>
                      <span style={{ textAlign: 'right', color: MUTED, fontSize: 13 }}>{g.count}</span>
                      <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(g.sec)}</span>
                      <span style={{ textAlign: 'right', color: MUTED, fontSize: 13 }}>{tot ? Math.round(g.sec / tot * 100) : 0}%</span>
                    </div>
                  ))}
                </div>

                {/* Tempo di lavoro per persona (sempre visibile) */}
                {(() => {
                  const people = reportGroups(report, 'person')
                  const ptot = people.reduce((s, x) => s + x.sec, 0)
                  return (
                    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>{t('lt.workTimePerPerson', null, 'Work time per person')}</div>
                      {people.map((g, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < people.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <Avatar name={g.label} size={32} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</div>
                            <div style={{ height: 6, background: '#14141d', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
                              <div style={{ width: `${ptot ? Math.round(g.sec / ptot * 100) : 0}%`, height: '100%', background: 'linear-gradient(90deg,#7b5bff,#5b8bff)' }} />
                            </div>
                          </div>
                          <span style={{ color: MUTED, fontSize: 13 }}>{t('lt.entriesCount', { count: g.count }, '{count} entries')}</span>
                          <span style={{ width: 80, textAlign: 'right', fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(g.sec)}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )
      })()}

      {/* Budget & costi progetto */}
      {section === 'budget' && (() => {
        const isAdmin = !!me?.isAdmin
        const spent = {}
        for (const e of budget.entries) {
          const k = e.project_id || '__none'
          if (!spent[k]) spent[k] = { sec: 0, cost: 0, bsec: 0, anyRate: false }
          spent[k].sec += e.duration_seconds || 0
          if (e.cost != null) { spent[k].cost += e.cost; spent[k].anyRate = true }
          if (e.billable !== false) spent[k].bsec += e.duration_seconds || 0
        }
        const rows = projects.map(p => ({ ...p, ...(spent[p.id] || { sec: 0, cost: 0, bsec: 0, anyRate: false }) }))
        const totCost = rows.reduce((s, r) => s + (r.cost || 0), 0)
        const totSec = rows.reduce((s, r) => s + (r.sec || 0), 0)
        const euro = n => '€' + (Math.round((n || 0) * 100) / 100).toLocaleString(intlLocale)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <StatCard label={t('lt.totalHoursTracked', null, 'Total hours tracked')} value={fmtDur(totSec)} accent="#5b8bff" spark={[]} />
              <StatCard label={t('lt.totalCost', null, 'Total cost')} value={euro(totCost)} sub={t('lt.hoursTimesRate', null, 'hours × hourly rate')} accent="#30d158" spark={[]} />
            </div>

            {/* Budget per progetto */}
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>{t('lt.budgetPerProject', null, 'Budget per project')} {!isAdmin && <span style={{ color: MUTED, fontWeight: 400, fontSize: 12 }}>· {t('lt.onlyAdminEdit', null, 'only the Admin can edit')}</span>}</div>
              {rows.length === 0 ? <div style={{ padding: 20, color: MUTED, fontSize: 13 }}>{t('lt.noProjectsCreate', null, 'No projects. Create them in Projects & Tasks.')}</div> : rows.map(r => {
                const spentH = (r.sec || 0) / 3600
                const pct = r.budget_hours ? Math.min(100, Math.round(spentH / r.budget_hours * 100))
                  : r.budget_amount && r.cost ? Math.min(100, Math.round(r.cost / r.budget_amount * 100)) : 0
                const over = (r.budget_hours && spentH > r.budget_hours) || (r.budget_amount && r.cost > r.budget_amount)
                return (
                  <div key={r.id} style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ width: 11, height: 11, borderRadius: '50%', background: r.color || '#7b5bff', flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 120 }}>{r.name}</span>
                      <span style={{ fontSize: 13, color: MUTED }}>{t('lt.spent', null, 'spent')} <b style={{ color: 'var(--text)' }}>{fmtDur(r.sec)}</b>{r.anyRate ? ` · ${euro(r.cost)}` : ''}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        {t('lt.budgetWord', null, 'budget')}
                        {isAdmin ? <input key={'h' + r.id} type="number" min="0" defaultValue={r.budget_hours ?? ''} placeholder={t('lt.hoursPlaceholder', null, 'hours')} onBlur={e => saveProjectBudget(r.id, { budget_hours: e.target.value })} style={{ ...input, width: 64, padding: '5px 7px' }} /> : <b>{r.budget_hours ?? '—'}</b>}h
                        {isAdmin ? <input key={'a' + r.id} type="number" min="0" defaultValue={r.budget_amount ?? ''} placeholder="€" onBlur={e => saveProjectBudget(r.id, { budget_amount: e.target.value })} style={{ ...input, width: 80, padding: '5px 7px' }} /> : <b>{r.budget_amount != null ? euro(r.budget_amount) : '—'}</b>}
                      </span>
                    </div>
                    {(r.budget_hours || r.budget_amount) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                        <div style={{ flex: 1, height: 8, background: '#14141d', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: over ? 'linear-gradient(90deg,#ff375f,#ff5f7a)' : 'linear-gradient(90deg,#7b5bff,#5b8bff)' }} />
                        </div>
                        <span style={{ fontSize: 12, color: over ? '#ff5f7a' : MUTED, fontWeight: 700, width: 90, textAlign: 'right' }}>{pct}%{over ? ` · ${t('lt.overBudget', null, 'over budget')}` : ''}</span>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>

            {/* Tariffe orarie membri */}
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>{t('lt.hourlyRates', null, 'Hourly rates')} {!isAdmin && <span style={{ color: MUTED, fontWeight: 400, fontSize: 12 }}>· {t('lt.onlyAdminEdit', null, 'only the Admin can edit')}</span>}</div>
              {members.length === 0 ? <div style={{ padding: 20, color: MUTED, fontSize: 13 }}>{t('lt.noMembers', null, 'No members.')}</div> : members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
                  <Avatar name={m.full_name || m.email} url={m.avatar_url} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name || m.email}</div>
                  </div>
                  {isAdmin ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>€
                      <input key={m.id + (m.hourly_rate ?? '')} type="number" min="0" defaultValue={m.hourly_rate ?? ''} placeholder="0" onBlur={e => saveMemberRate(m.id, e.target.value)} style={{ ...input, width: 80, padding: '5px 7px' }} />/h
                    </div>
                  ) : <span style={{ fontSize: 14, fontWeight: 700 }}>{m.hourly_rate != null ? `€${m.hourly_rate}/h` : '—'}</span>}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Approvazione ore */}
      {section === 'approvals' && (() => {
        const wEnd = new Date(approveWeek + 'T00:00:00'); wEnd.setDate(wEnd.getDate() + 6)
        const fmtD = d => d.toLocaleDateString(intlLocale, { day: 'numeric', month: 'short' })
        const badge = (st) => st === 'approved' ? { t: t('lt.approved', null, 'Approved'), c: '#30d158' } : st === 'rejected' ? { t: t('lt.rejected', null, 'Rejected'), c: '#ff375f' } : { t: t('lt.pending', null, 'Pending'), c: '#ff9f0a' }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button style={btnGhost} onClick={() => shiftWeek(-1)}>←</button>
              <div style={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>{t('lt.weekWord', null, 'Week')} {fmtD(new Date(approveWeek + 'T00:00:00'))} – {fmtD(wEnd)}</div>
              <button style={btnGhost} onClick={() => shiftWeek(1)}>→</button>
            </div>
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
                {t('lt.hoursToApprove', null, 'Hours to approve')} {!me?.isAdmin && <span style={{ color: MUTED, fontWeight: 400, fontSize: 12 }}>· {t('lt.onlyAdminApprove', null, 'only the Admin approves')}</span>}
              </div>
              {!approvals.loaded ? <div style={{ padding: 20, color: MUTED }}>{t('lt.loading', null, 'Loading…')}</div>
                : approvals.rows.length === 0 ? <div style={{ padding: 20, color: MUTED, fontSize: 13 }}>{t('lt.noMembers', null, 'No members.')}</div>
                : approvals.rows.map(r => {
                  const st = r.approval?.status || null
                  const bd = badge(st)
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                      <Avatar name={r.name} url={r.avatar} size={36} />
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div>
                        <div style={{ color: MUTED, fontSize: 12 }}>{fmtDur(r.sec)}{r.cost ? ` · €${Math.round(r.cost)}` : ''}</div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: bd.c, background: bd.c + '22', padding: '4px 10px', borderRadius: 20 }}>{bd.t}</span>
                      {me?.isAdmin && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          {st === 'approved'
                            ? <button style={btnGhost} onClick={() => resetApproval(r.id)}>↩ {t('lt.undo', null, 'Undo')}</button>
                            : <button style={{ ...btn, padding: '7px 12px', background: 'linear-gradient(135deg,#30d158,#28b14c)' }} onClick={() => setApproval(r.id, 'approved', r.sec)}><Icon name="check" size={13} /> {t('lt.approve', null, 'Approve')}</button>}
                          {st === 'rejected'
                            ? <button style={btnGhost} onClick={() => resetApproval(r.id)}>↩ {t('lt.undo', null, 'Undo')}</button>
                            : <button style={{ ...btnGhost, color: '#ff8095', borderColor: 'rgba(255,55,95,0.4)' }} onClick={() => setApproval(r.id, 'rejected', r.sec)}><Icon name="close" size={13} /> {t('lt.reject', null, 'Reject')}</button>}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        )
      })()}

      {/* Presenze & ferie */}
      {section === 'attendance' && (() => {
        const isAdmin = !!me?.isAdmin
        const tBadge = ty => ty === 'permesso' ? { c: '#bf5af2', t: t('lt.permit', null, 'Leave') } : ty === 'malattia' ? { c: '#ff9f0a', t: t('lt.sick', null, 'Sick leave') } : { c: '#5b8bff', t: t('lt.vacation', null, 'Vacation') }
        const sBadge = s => s === 'approved' ? { c: '#30d158', t: t('lt.approved', null, 'Approved') } : s === 'rejected' ? { c: '#ff375f', t: t('lt.rejected', null, 'Rejected') } : { c: '#ff9f0a', t: t('lt.pending', null, 'Pending') }
        const fmtD = s => new Date(s + 'T00:00:00').toLocaleDateString(intlLocale, { day: 'numeric', month: 'short', year: 'numeric' })
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Presenze del giorno */}
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{t('lt.attendance', null, 'Attendance')}</span>
                <input type="date" value={attDay} onChange={e => setAttDay(e.target.value)} style={{ ...input, width: 'auto', padding: '6px 9px' }} />
              </div>
              {!attendance.loaded ? <div style={{ padding: 20, color: MUTED }}>{t('lt.loading', null, 'Loading…')}</div>
                : attendance.rows.length === 0 ? <div style={{ padding: 20, color: MUTED, fontSize: 13 }}>{t('lt.noAttendance', null, 'No attendance recorded on this date.')}</div>
                : attendance.rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
                    <Avatar name={r.name} url={r.avatar} size={34} online={r.running ? true : undefined} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ color: MUTED, fontSize: 12 }}>{t('lt.checkIn', null, 'in')} {timeOf(r.firstIn)} · {t('lt.checkOut', null, 'out')} {r.running ? <span style={{ color: '#30d158' }}>{t('lt.inProgress', null, 'in progress')}</span> : (r.lastOut ? timeOf(r.lastOut) : '—')}</div>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(r.sec)}</span>
                  </div>
                ))}
            </div>

            {/* Ferie & permessi */}
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{t('lt.vacationPermits', null, 'Vacation & leave')}</span>
                <button style={{ ...btn, padding: '7px 14px', fontSize: 13 }} onClick={() => setShowOff(true)}>+ {t('lt.requestAbsence', null, 'Request absence')}</button>
              </div>
              {timeoff.length === 0 ? <div style={{ padding: 20, color: MUTED, fontSize: 13 }}>{t('lt.noRequests', null, 'No requests.')}</div>
                : timeoff.map(o => {
                  const tb = tBadge(o.type), sb = sBadge(o.status)
                  return (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: tb.c, background: tb.c + '22', padding: '4px 10px', borderRadius: 20 }}>{tb.t}</span>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        {isAdmin && <div style={{ fontWeight: 600, fontSize: 13 }}>{o.member_name || '—'}</div>}
                        <div style={{ fontSize: 13 }}>{fmtD(o.start_date)} → {fmtD(o.end_date)}</div>
                        {o.note && <div style={{ color: MUTED, fontSize: 12 }}>{o.note}</div>}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: sb.c, background: sb.c + '22', padding: '4px 10px', borderRadius: 20 }}>{sb.t}</span>
                      {isAdmin && o.status !== 'approved' && <button style={{ ...btn, padding: '6px 11px', fontSize: 12, background: 'linear-gradient(135deg,#30d158,#28b14c)' }} onClick={() => setOffStatus(o.id, 'approved')}><Icon name="check" size={13} /></button>}
                      {isAdmin && o.status !== 'rejected' && <button style={{ ...btnGhost, padding: '6px 11px', fontSize: 12, color: '#ff8095' }} onClick={() => setOffStatus(o.id, 'rejected')}><Icon name="close" size={13} /></button>}
                      <button style={{ ...btnGhost, padding: '6px 9px', fontSize: 12 }} onClick={() => delTimeOff(o.id)}><Icon name="trash" size={13} /></button>
                    </div>
                  )
                })}
            </div>

            {/* Modal richiesta */}
            {showOff && (
              <div onClick={() => setShowOff(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <div onClick={e => e.stopPropagation()} style={{ width: 'min(480px,100%)', background: '#15151f', border: '1px solid #3d3d4c', borderRadius: 16, padding: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, flex: 1 }}>{t('lt.requestAbsence', null, 'Request absence')}</h3>
                    <button onClick={() => setShowOff(false)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 22 }}>×</button>
                  </div>
                  {isAdmin && (
                    <>
                      <label style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{t('lt.member', null, 'Member')}</label>
                      <select style={{ ...input, marginTop: 6, marginBottom: 12 }} value={offForm.member_id} onChange={e => setOffForm({ ...offForm, member_id: e.target.value })}>
                        <option value="">{t('lt.meOption', null, '— Me —')}</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                      </select>
                    </>
                  )}
                  <label style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{t('lt.type', null, 'Type')}</label>
                  <select style={{ ...input, marginTop: 6, marginBottom: 12 }} value={offForm.type} onChange={e => setOffForm({ ...offForm, type: e.target.value })}>
                    <option value="ferie">{t('lt.vacation', null, 'Vacation')}</option><option value="permesso">{t('lt.permit', null, 'Leave')}</option><option value="malattia">{t('lt.sick', null, 'Sick leave')}</option>
                  </select>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{t('lt.fromDate', null, 'From')}</label>
                      <input type="date" style={{ ...input, marginTop: 6 }} value={offForm.start_date} onChange={e => setOffForm({ ...offForm, start_date: e.target.value, end_date: offForm.end_date || e.target.value })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{t('lt.toDate', null, 'to')}</label>
                      <input type="date" style={{ ...input, marginTop: 6 }} value={offForm.end_date} onChange={e => setOffForm({ ...offForm, end_date: e.target.value })} />
                    </div>
                  </div>
                  <label style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{t('lt.noteOptional', null, 'Note (optional)')}</label>
                  <textarea style={{ ...input, marginTop: 6, minHeight: 70, resize: 'vertical' }} value={offForm.note} onChange={e => setOffForm({ ...offForm, note: e.target.value })} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                    <button style={btnGhost} onClick={() => setShowOff(false)}>{t('common.cancel', null, 'Cancel')}</button>
                    <button style={btn} onClick={submitTimeOff}>{t('lt.sendRequest', null, 'Send request')}</button>
                  </div>
                </div>
              </div>
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

// Menu laterale di Lyftimer (professionale).
function LyftSidebar({ section, setSection }) {
  const { t } = useI18n()
  const items = [
    ['dashboard', t('lt.navDashboard', null, 'Dashboard'), 'grid'],
    ['timesheets', t('lt.navTimesheets', null, 'Timesheets'), 'clock'],
    ['activity', t('lt.navActivity', null, 'Activity'), 'chart'],
    ['report', t('lt.navReport', null, 'Report'), 'report'],
    ['approvals', t('lt.navApprovals', null, 'Approvals'), 'check'],
    ['attendance', t('lt.navAttendance', null, 'Attendance & leave'), 'calendar'],
    ['budget', t('lt.navBudget', null, 'Budget & costs'), 'budget'],
    ['people', t('lt.navPeople', null, 'People'), 'people'],
    ['projects', t('lt.navProjects', null, 'Projects'), 'folder'],
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
            color: active ? 'var(--text)' : '#b9b9c8',
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
    case 'budget': return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M14.5 9a2.5 2 0 0 0-2.5-1.5c-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1 2-2.5 2A2.5 2 0 0 1 9.5 15" /><path d="M12 6v1.5M12 16.5V18" /></svg>
    case 'check': return <svg {...p}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
    case 'calendar': return <svg {...p}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>
    default: return <svg {...p}><circle cx="12" cy="12" r="9" /></svg>
  }
}

// Aggregazioni report
function reportGroups(entries, groupBy) {
  const m = {}
  for (const e of entries) {
    const label = groupBy === 'project' ? (e.project_name || _T('lt.noProjectLabel', null, 'No project')) : groupBy === 'person' ? (e.member_name || '—') : (e.task_title || _T('lt.noTaskLabel', null, 'No task'))
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
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--text)">{fmtDur(total)}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#8e8e9e">{_T('lt.totalLower', null, 'total')}</text>
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
      <line x1="24" y1="6.5" x2="24" y2="10.5" stroke="var(--text)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="26" r="13" stroke="var(--text)" strokeWidth="2.4" fill="none" opacity="0.55" />
      {/* lancette: ore (corta) + freccia ascendente (Lyft) */}
      <path d="M24 26 L24 18" stroke="var(--text)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M24 26 L31 23 L27.5 27.5" stroke="var(--text)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="24" cy="26" r="2.4" fill="var(--text)" />
    </svg>
  )
}
