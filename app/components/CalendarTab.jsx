'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Icon from './ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'

// ============================================================================
//  Calendario — ferie, permessi, malattia, promo e eventi in una vista sola.
//
//  Le date sono trattate SEMPRE come stringhe 'YYYY-MM-DD', mai come Date:
//  una voce di ferie è un giorno di calendario, non un istante. Convertirla in
//  Date la sposterebbe di un giorno a ogni cambio di fuso.
// ============================================================================

const KINDS = ['ferie', 'permesso', 'malattia', 'promo_b2c', 'promo_negozi', 'evento', 'meeting']
const ABSENCE_KINDS = ['ferie', 'permesso', 'malattia']

const KIND_COLOR = {
  ferie:        '#2997ff',
  permesso:     '#bf5af2',
  malattia:     '#ff9f0a',
  promo_b2c:    '#ff375f',
  promo_negozi: '#30d158',
  evento:       '#5b8bff',
  meeting:      '#8e8e93',
}

const KIND_FALLBACK = {
  ferie: 'Ferie', permesso: 'Permessi', malattia: 'Malattia',
  promo_b2c: 'Promo B2C', promo_negozi: 'Promo negozi',
  evento: 'Eventi', meeting: 'Meeting',
}

// ── Date: aritmetica su stringhe, nessun fuso di mezzo ──────────────────────
const pad = n => String(n).padStart(2, '0')
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const todayISO = () => { const n = new Date(); return iso(n.getFullYear(), n.getMonth(), n.getDate()) }
const parse = s => { const [y, m, d] = s.split('-').map(Number); return { y, m: m - 1, d } }
const addDays = (s, n) => { const { y, m, d } = parse(s); const t = new Date(Date.UTC(y, m, d + n)); return iso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) }
// Lunedì della settimana che contiene `s` (in Europa la settimana inizia lunedì)
const weekStart = (s) => { const { y, m, d } = parse(s); const dow = new Date(Date.UTC(y, m, d)).getUTCDay(); return addDays(s, dow === 0 ? -6 : 1 - dow) }
const monthStart = (s) => { const { y, m } = parse(s); return iso(y, m, 1) }
const addMonths = (s, n) => { const { y, m } = parse(s); const t = new Date(Date.UTC(y, m + n, 1)); return iso(t.getUTCFullYear(), t.getUTCMonth(), 1) }
const daysBetween = (a, b) => {
  const A = parse(a), B = parse(b)
  return Math.round((Date.UTC(B.y, B.m, B.d) - Date.UTC(A.y, A.m, A.d)) / 86400000)
}
const overlaps = (e, from, to) => e.start <= to && e.end >= from

export default function CalendarTab() {
  const { t, locale } = useI18n()
  const L = locale || 'it'
  const tr = (k, f, vars) => t(k, vars || null, f)
  const kindLabel = k => tr(`cal.kind.${k}`, KIND_FALLBACK[k] || k)

  const [view, setView] = useState('month')          // month | week | agenda
  const [cursor, setCursor] = useState(() => monthStart(todayISO()))
  const [data, setData] = useState({ entries: [], members: [], me: null, needsSetup: false })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')
  const [off, setOff] = useState([])                  // tipi disattivati
  const [onlyMine, setOnlyMine] = useState(false)
  const [showDrafts, setShowDrafts] = useState(false) // "da valutare" spente di default
  const [editing, setEditing] = useState(null)        // voce aperta nel modulo

  // Intervallo visibile: la griglia mensile mostra anche code del mese prima e
  // dopo, quindi si chiedono al server anche quelle (altrimenti le voci a
  // cavallo sparirebbero dalle celle di bordo).
  const range = useMemo(() => {
    if (view === 'week') { const s = weekStart(cursor); return { from: s, to: addDays(s, 6) } }
    const gridStart = weekStart(monthStart(cursor))
    return { from: gridStart, to: addDays(gridStart, 41) }
  }, [cursor, view])

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const r = await fetch(`/api/calendar?from=${range.from}&to=${range.to}`, { cache: 'no-store' })
      if (r.status === 401) { setErr('auth'); setData(d => ({ ...d, entries: [] })); return }
      const j = await r.json()
      setData({ entries: j.entries || [], members: j.members || [], me: j.me || null, needsSetup: !!j.needsSetup })
    } catch (e) {
      setErr(e?.message || 'network')
    } finally { setLoading(false) }
  }, [range.from, range.to])

  useEffect(() => { load() }, [load])

  const canWrite = !!data.me?.canWrite
  const myId = data.me?.memberId || null

  // Filtri applicati una volta sola: la griglia, la settimana e l'agenda
  // leggono tutte da qui, così non possono divergere fra loro.
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (data.entries || []).filter(e => {
      if (off.includes(e.kind)) return false
      if (!showDrafts && e.status === 'draft') return false
      if (e.status === 'rejected') return false
      if (onlyMine && e.memberId !== myId) return false
      if (needle) {
        const hay = `${e.title || ''} ${e.person || ''} ${kindLabel(e.kind)}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [data.entries, off, showDrafts, onlyMine, myId, q, locale])

  const counts = useMemo(() => {
    const c = {}
    for (const e of (data.entries || [])) {
      if (!showDrafts && e.status === 'draft') continue
      if (e.status === 'rejected') continue
      c[e.kind] = (c[e.kind] || 0) + 1
    }
    return c
  }, [data.entries, showDrafts])

  const draftCount = useMemo(
    () => (data.entries || []).filter(e => e.status === 'draft').length,
    [data.entries]
  )

  const monthLabel = useMemo(() => {
    const { y, m } = parse(cursor)
    try {
      return new Intl.DateTimeFormat(L === 'it' ? 'it-IT' : L, { month: 'long', year: 'numeric' })
        .format(new Date(Date.UTC(y, m, 1)))
    } catch { return `${m + 1}/${y}` }
  }, [cursor, L])

  const weekLabel = useMemo(() => {
    const s = weekStart(cursor), e = addDays(s, 6)
    const f = d => { const { y, m, d: dd } = parse(d); try { return new Intl.DateTimeFormat(L === 'it' ? 'it-IT' : L, { day: 'numeric', month: 'short' }).format(new Date(Date.UTC(y, m, dd))) } catch { return d } }
    return `${f(s)} – ${f(e)}`
  }, [cursor, L])

  const dayNames = useMemo(() => {
    const base = weekStart('2026-01-05') // un lunedì qualsiasi
    return Array.from({ length: 7 }, (_, i) => {
      const { y, m, d } = parse(addDays(base, i))
      try { return new Intl.DateTimeFormat(L === 'it' ? 'it-IT' : L, { weekday: 'short' }).format(new Date(Date.UTC(y, m, d))) } catch { return '' }
    })
  }, [L])

  const goToday = () => setCursor(view === 'week' ? todayISO() : monthStart(todayISO()))
  const step = (n) => setCursor(c => view === 'week' ? addDays(c, n * 7) : addMonths(c, n))
  const toggleKind = (k) => setOff(o => o.includes(k) ? o.filter(x => x !== k) : [...o, k])
  const resetFilters = () => { setOff([]); setQ(''); setOnlyMine(false); setShowDrafts(false) }

  const openNew = (kind = 'promo_b2c', date = null) => {
    const d = date || todayISO()
    setEditing({ isNew: true, kind, title: '', start: d, end: d, note: '', status: 'confirmed', memberId: myId, source: null })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {data.needsSetup && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 12,
          background: 'rgba(255,159,10,0.10)', border: '1px solid rgba(255,159,10,0.35)',
          position: 'relative', zIndex: 2,
        }}>
          <span style={{ color: '#ff9f0a', flexShrink: 0, marginTop: 1 }}><Icon name="warning" size={16} /></span>
          <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
            <strong style={{ color: '#ffb340', fontWeight: 800 }}>{tr('cal.setupTitle', 'Tabella del calendario mancante')}</strong>
            <div style={{ color: 'var(--text3)', marginTop: 3 }}>
              {tr('cal.setupBody', 'Ferie e permessi funzionano già. Per salvare promo ed eventi esegui supabase/calendar_events.sql sul database.')}
            </div>
          </div>
        </div>
      )}

      {/* ── Filtri ─────────────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', display: 'flex' }}>
              <Icon name="search" size={14} />
            </span>
            <input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder={tr('cal.search', 'Cerca persona, evento, promo…')}
              style={{
                width: '100%', padding: '10px 12px 10px 34px', borderRadius: 10,
                background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 13, outline: 'none',
              }}
            />
          </div>
          <button type="button" onClick={() => setOnlyMine(v => !v)} style={pillStyle(onlyMine)}>
            {tr('cal.onlyMe', 'Solo io')}
          </button>
          <button type="button" onClick={() => setShowDrafts(v => !v)} style={pillStyle(showDrafts)}>
            {tr('cal.showDrafts', 'Da valutare')}{draftCount > 0 ? ` ${draftCount}` : ''}
          </button>
          <button type="button" onClick={resetFilters} style={{ ...pillStyle(false), border: 'none', background: 'none', color: 'var(--text3)' }}>
            {tr('cal.reset', 'Reset')}
          </button>
          {canWrite && (
            <button type="button" onClick={() => openNew()} style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '10px 16px', borderRadius: 10, cursor: 'pointer', border: 'none',
              background: 'linear-gradient(135deg, #7b5bff, #5b8bff)', color: '#fff', fontSize: 13, fontWeight: 800,
            }}>
              <Icon name="plus" size={14} /> {tr('cal.new', 'Nuova voce')}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {KINDS.map(k => {
            const active = !off.includes(k)
            return (
              <button key={k} type="button" onClick={() => toggleKind(k)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: active ? `${KIND_COLOR[k]}1f` : 'transparent',
                border: `1px solid ${active ? KIND_COLOR[k] + '66' : 'var(--border)'}`,
                color: active ? 'var(--text)' : 'var(--text3)',
                opacity: active ? 1 : 0.55,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: KIND_COLOR[k], flexShrink: 0 }} />
                {kindLabel(k)}
                <span style={{ color: 'var(--text3)', fontWeight: 600 }}>{counts[k] || 0}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Vista ──────────────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ borderRadius: 14, padding: 16, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 10, background: 'var(--glass)', border: '1px solid var(--border)' }}>
            {[['month', tr('cal.month', 'Mese')], ['week', tr('cal.week', 'Settimana')], ['agenda', tr('cal.agenda', 'Agenda')]].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setView(id)} style={{
                padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800,
                background: view === id ? 'var(--text)' : 'transparent',
                color: view === id ? '#0a0a14' : 'var(--text2)',
              }}>{label}</button>
            ))}
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text3)', fontSize: 12 }}>
            <Icon name="calendar" size={13} /> {tr('cal.entries', '{n} voci', { n: visible.length })}
          </span>
          {loading && <span style={{ color: 'var(--text3)', fontSize: 12 }}>{tr('cal.loading', 'Carico…')}</span>}
          <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={goToday} style={{ ...pillStyle(false), padding: '6px 12px' }}>{tr('cal.today', 'Oggi')}</button>
            <button type="button" onClick={() => step(-1)} aria-label="←" style={navBtn}><Chevron dir="left" /></button>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', minWidth: 150, textAlign: 'center', textTransform: 'capitalize' }}>
              {view === 'week' ? weekLabel : monthLabel}
            </span>
            <button type="button" onClick={() => step(1)} aria-label="→" style={navBtn}><Chevron dir="right" /></button>
          </div>
        </div>

        {err === 'auth' ? (
          <Empty text={tr('cal.authErr', 'Sessione scaduta: ricarica la pagina.')} />
        ) : view === 'agenda' ? (
          <AgendaView entries={visible} L={L} tr={tr} kindLabel={kindLabel} onOpen={setEditing} />
        ) : (
          <Grid
            weeks={view === 'week' ? 1 : 6}
            start={view === 'week' ? weekStart(cursor) : weekStart(monthStart(cursor))}
            month={parse(cursor).m}
            entries={visible}
            dayNames={dayNames}
            tr={tr}
            onOpen={setEditing}
            onNewOn={canWrite ? (d => openNew('promo_b2c', d)) : null}
          />
        )}
      </div>

      {editing && (
        <EntryModal
          entry={editing}
          members={data.members}
          me={data.me}
          tr={tr}
          kindLabel={kindLabel}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

// ── Griglia mese/settimana ─────────────────────────────────────────────────
// Ogni riga è una settimana; le voci diventano barre che coprono più giorni.
// Le barre sono impilate in "corsie": la prima libera, così due voci dello
// stesso periodo non si sovrappongono mai.
function Grid({ weeks, start, month, entries, dayNames, tr, onOpen, onNewOn }) {
  const today = todayISO()
  const rows = []
  for (let w = 0; w < weeks; w++) {
    const ws = addDays(start, w * 7)
    const we = addDays(ws, 6)
    const inWeek = entries.filter(e => overlaps(e, ws, we))
    const lanes = []
    const bars = []
    for (const e of inWeek) {
      const from = e.start < ws ? ws : e.start
      const to = e.end > we ? we : e.end
      const col = daysBetween(ws, from)
      const span = daysBetween(from, to) + 1
      let lane = lanes.findIndex(l => l.every(b => b.col + b.span <= col || col + span <= b.col))
      if (lane === -1) { lanes.push([]); lane = lanes.length - 1 }
      lanes[lane].push({ col, span })
      bars.push({ e, col, span, lane, continuesLeft: e.start < ws, continuesRight: e.end > we })
    }
    rows.push({ ws, bars, laneCount: lanes.length })
  }

  const BAR_H = 20, BAR_GAP = 3, HEAD = 32 // spazio sotto il numero del giorno
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 720 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
          {dayNames.map((d, i) => (
            <div key={i} style={{
              padding: '8px 10px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text3)', textAlign: 'left',
            }}>{d}</div>
          ))}
        </div>
        {rows.map((row, ri) => {
          const h = HEAD + Math.max(1, row.laneCount) * (BAR_H + BAR_GAP) + 8
          return (
            <div key={ri} style={{ position: 'relative', height: weeks === 1 ? Math.max(h, 260) : Math.max(h, 96) }}>
              {/* celle */}
              <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {Array.from({ length: 7 }, (_, i) => {
                  const d = addDays(row.ws, i)
                  const outside = parse(d).m !== month
                  const isToday = d === today
                  return (
                    <div key={i}
                      onDoubleClick={onNewOn ? () => onNewOn(d) : undefined}
                      title={onNewOn ? tr('cal.dblNew', 'Doppio clic per aggiungere') : undefined}
                      style={{
                        borderTop: '1px solid var(--border)',
                        borderRight: i === 6 ? 'none' : '1px solid var(--border)',
                        background: outside ? 'rgba(255,255,255,0.012)' : 'transparent',
                        padding: '6px 8px', cursor: onNewOn ? 'cell' : 'default',
                      }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 20, height: 20, borderRadius: 999, fontSize: 11.5, fontWeight: isToday ? 900 : 600,
                        background: isToday ? 'var(--text)' : 'transparent',
                        color: isToday ? '#0a0a14' : (outside ? 'var(--text4, #6b7280)' : 'var(--text2)'),
                      }}>{parse(d).d}</span>
                    </div>
                  )
                })}
              </div>
              {/* barre */}
              {row.bars.map((b, bi) => (
                <button key={bi} type="button" onClick={() => onOpen(toEditable(b.e))} title={barTitle(b.e)}
                  style={{
                    position: 'absolute',
                    left: `calc(${(b.col / 7) * 100}% + 4px)`,
                    width: `calc(${(b.span / 7) * 100}% - 8px)`,
                    top: HEAD + b.lane * (BAR_H + BAR_GAP),
                    height: BAR_H,
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '0 8px', cursor: 'pointer', textAlign: 'left',
                    borderRadius: 999,
                    borderTopLeftRadius: b.continuesLeft ? 3 : 999,
                    borderBottomLeftRadius: b.continuesLeft ? 3 : 999,
                    borderTopRightRadius: b.continuesRight ? 3 : 999,
                    borderBottomRightRadius: b.continuesRight ? 3 : 999,
                    background: KIND_COLOR[b.e.kind] || '#8e8e93',
                    border: b.e.status === 'draft' ? '1px dashed rgba(255,255,255,0.75)' : 'none',
                    opacity: b.e.status === 'draft' ? 0.75 : 1,
                    color: '#fff', fontSize: 11.5, fontWeight: 700,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b.e.person && !ABSENCE_KINDS.includes(b.e.kind) ? `${b.e.person} · ` : ''}{b.e.title}
                  </span>
                </button>
              ))}
            </div>
          )
        })}
        <div style={{ borderTop: '1px solid var(--border)' }} />
      </div>
    </div>
  )
}

function AgendaView({ entries, L, tr, kindLabel, onOpen }) {
  if (!entries.length) return <Empty text={tr('cal.empty', 'Nessuna voce nel periodo selezionato.')} />
  const byDay = {}
  for (const e of entries) (byDay[e.start] = byDay[e.start] || []).push(e)
  const days = Object.keys(byDay).sort()
  const fmt = d => {
    const { y, m, dd } = { ...parse(d), dd: parse(d).d }
    try { return new Intl.DateTimeFormat(L === 'it' ? 'it-IT' : L, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(Date.UTC(y, m, dd))) } catch { return d }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {days.map(d => (
        <div key={d}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>
            {fmt(d)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {byDay[d].map(e => (
              <button key={`${e.source}-${e.id}`} type="button" onClick={() => onOpen(toEditable(e))} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: 'var(--glass)', border: '1px solid var(--border)',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: KIND_COLOR[e.kind], flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.title}{e.person && !ABSENCE_KINDS.includes(e.kind) ? ` · ${e.person}` : ''}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                  {kindLabel(e.kind)}{e.end !== e.start ? ` · ${tr('cal.until', 'fino al')} ${e.end}` : ''}
                </span>
                {e.status === 'draft' && (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,159,10,0.16)', color: '#ffb340' }}>
                    {tr('cal.draft', 'Da valutare')}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Modulo di inserimento / modifica ───────────────────────────────────────
function EntryModal({ entry, members, me, tr, kindLabel, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    kind: entry.kind, title: entry.title || '', start: entry.start, end: entry.end,
    note: entry.note || '', status: entry.status || 'confirmed',
    memberId: entry.memberId || me?.memberId || null,
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const isAbsence = ABSENCE_KINDS.includes(f.kind)
  const canEdit = entry.isNew || entry.canEdit
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const save = async () => {
    setError(null)
    if (!isAbsence && !f.title.trim()) { setError(tr('cal.errTitle', 'Serve un titolo.')); return }
    if (f.end < f.start) { setError(tr('cal.errDates', 'La data di fine precede quella di inizio.')); return }
    setBusy(true)
    try {
      const body = { kind: f.kind, title: isAbsence ? '' : f.title.trim(), start: f.start, end: f.end, note: f.note, status: f.status, memberId: f.memberId }
      const r = entry.isNew
        ? await fetch('/api/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/calendar', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, id: entry.id, source: entry.source }) })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.ok) { setError(j?.error || tr('cal.errSave', 'Salvataggio non riuscito.')); setBusy(false); return }
      onSaved()
    } catch (e) { setError(e?.message || 'network'); setBusy(false) }
  }

  const remove = async () => {
    if (!window.confirm(tr('cal.deleteConfirm', 'Eliminare questa voce?'))) return
    setBusy(true)
    try {
      await fetch(`/api/calendar?id=${encodeURIComponent(entry.id)}&source=${entry.source}`, { method: 'DELETE' })
      onSaved()
    } catch { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 460, borderRadius: 16, padding: 22,
        background: 'linear-gradient(180deg, rgba(12,12,24,0.98), rgba(0,0,0,0.99))',
        border: '1px solid var(--border2)', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: KIND_COLOR[f.kind] }} />
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', flex: 1 }}>
            {entry.isNew ? tr('cal.new', 'Nuova voce') : tr('cal.edit', 'Modifica voce')}
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <Field label={tr('cal.type', 'Tipo')}>
          <select value={f.kind} onChange={e => set('kind', e.target.value)} disabled={!canEdit || !entry.isNew} style={inputStyle}>
            {KINDS.map(k => <option key={k} value={k} style={{ background: '#0d0d16' }}>{kindLabel(k)}</option>)}
          </select>
        </Field>

        {isAbsence ? (
          <Field label={tr('cal.member', 'Persona')}>
            <select value={f.memberId || ''} onChange={e => set('memberId', e.target.value || null)} disabled={!me?.isAdmin} style={inputStyle}>
              <option value="" style={{ background: '#0d0d16' }}>{me?.name || tr('cal.meLabel', 'Io')}</option>
              {(members || []).map(m => <option key={m.id} value={m.id} style={{ background: '#0d0d16' }}>{m.name}</option>)}
            </select>
          </Field>
        ) : (
          <Field label={tr('cal.title', 'Titolo')}>
            <input value={f.title} onChange={e => set('title', e.target.value)} disabled={!canEdit}
              placeholder={tr('cal.titlePh', 'Es. Saldi estivi · 30%')} style={inputStyle} />
          </Field>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Field label={tr('cal.from', 'Dal')} grow>
            <input type="date" value={f.start} onChange={e => { set('start', e.target.value); if (f.end < e.target.value) set('end', e.target.value) }} disabled={!canEdit} style={inputStyle} />
          </Field>
          <Field label={tr('cal.to', 'Al')} grow>
            <input type="date" value={f.end} min={f.start} onChange={e => set('end', e.target.value)} disabled={!canEdit} style={inputStyle} />
          </Field>
        </div>

        {!isAbsence && (
          <Field label={tr('cal.status', 'Stato')}>
            <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 10, background: 'var(--glass)', border: '1px solid var(--border)' }}>
              {[['confirmed', tr('cal.confirmed', 'Confermata')], ['draft', tr('cal.draft', 'Da valutare')]].map(([id, label]) => (
                <button key={id} type="button" onClick={() => canEdit && set('status', id)} style={{
                  padding: '6px 14px', borderRadius: 7, border: 'none', cursor: canEdit ? 'pointer' : 'default', fontSize: 12.5, fontWeight: 800,
                  background: f.status === id ? 'var(--text)' : 'transparent',
                  color: f.status === id ? '#0a0a14' : 'var(--text2)',
                }}>{label}</button>
              ))}
            </div>
          </Field>
        )}

        <Field label={tr('cal.note', 'Nota')}>
          <textarea value={f.note} onChange={e => set('note', e.target.value)} disabled={!canEdit} rows={2}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </Field>

        {error && (
          <div style={{ fontSize: 12, color: '#fca5a5', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)', padding: '8px 12px', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
          {!entry.isNew && entry.canEdit && (
            <button type="button" onClick={remove} disabled={busy} style={{
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 800,
              background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171',
            }}>{tr('cal.delete', 'Elimina')}</button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={{ ...pillStyle(false), padding: '10px 16px' }}>{tr('cal.cancel', 'Annulla')}</button>
          {canEdit && (
            <button type="button" onClick={save} disabled={busy} style={{
              padding: '10px 18px', borderRadius: 10, cursor: busy ? 'wait' : 'pointer', border: 'none',
              background: 'linear-gradient(135deg, #7b5bff, #5b8bff)', color: '#fff', fontSize: 13, fontWeight: 800,
            }}>{busy ? tr('cal.saving', 'Salvo…') : tr('cal.save', 'Salva')}</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pezzi minori ───────────────────────────────────────────────────────────
function Field({ label, children, grow }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: grow ? 1 : undefined }}>
      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</span>
      {children}
    </label>
  )
}

function Empty({ text }) {
  return (
    <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{text}</div>
  )
}

function Chevron({ dir }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points={dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
    </svg>
  )
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 13, outline: 'none',
}

const navBtn = {
  width: 30, height: 30, borderRadius: 9, cursor: 'pointer',
  background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}

function pillStyle(active) {
  return {
    padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
    background: active ? 'var(--text)' : 'var(--glass)',
    border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`,
    color: active ? '#0a0a14' : 'var(--text2)',
    whiteSpace: 'nowrap',
  }
}

function toEditable(e) {
  return {
    isNew: false, id: e.id, source: e.source, kind: e.kind, title: e.title,
    start: e.start, end: e.end, note: e.note || '', status: e.status,
    memberId: e.memberId, canEdit: e.canEdit,
  }
}

function barTitle(e) {
  return `${e.title}${e.person ? ' · ' + e.person : ''} (${e.start}${e.end !== e.start ? ' → ' + e.end : ''})`
}
