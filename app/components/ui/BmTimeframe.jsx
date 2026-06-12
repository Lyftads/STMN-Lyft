'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ============================================================================
//  BmTimeframe — selettore periodo stile Meta Business Manager.
//  Sidebar preset + calendario doppio mese (selezione range) + Confronta +
//  Annulla/Aggiorna. Emette onChange({ preset, since, until }) su "Aggiorna".
//
//  Props:
//   - value: { preset, since, until }
//   - onChange(next)
//   - accent: colore accento (default blu Meta)
//   - disabled
// ============================================================================

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const DOW = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']

const PRESETS = [
  { id: 'today', label: 'Oggi' },
  { id: 'yesterday', label: 'Ieri' },
  { id: 'today_yesterday', label: 'Oggi e ieri' },
  { id: 'last_7d', label: 'Ultimi 7 giorni' },
  { id: 'last_14d', label: 'Ultimi 14 giorni' },
  { id: 'last_28d', label: 'Ultimi 28 giorni' },
  { id: 'last_30d', label: 'Ultimi 30 giorni' },
  { id: 'this_week', label: 'Questa settimana' },
  { id: 'last_week', label: 'Settimana scorsa' },
  { id: 'this_month', label: 'Questo mese' },
  { id: 'last_month', label: 'Mese scorso' },
]

const pad = n => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1) }
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
const todayIso = () => iso(new Date())
const mondayOf = (s) => { const d = parse(s); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return iso(d) }
const firstOfMonth = (s) => { const d = parse(s); return iso(new Date(d.getFullYear(), d.getMonth(), 1)) }

// Mirror client-side di lib/metaRange.getRange (per riempire il calendario).
function presetRange(id) {
  const t = todayIso()
  switch (id) {
    case 'today': return { since: t, until: t }
    case 'yesterday': { const y = addDays(t, -1); return { since: y, until: y } }
    case 'today_yesterday': return { since: addDays(t, -1), until: t }
    case 'last_7d': return { since: addDays(t, -7), until: t }
    case 'last_14d': return { since: addDays(t, -14), until: t }
    case 'last_28d': return { since: addDays(t, -28), until: t }
    case 'last_30d': return { since: addDays(t, -30), until: t }
    case 'this_week': return { since: mondayOf(t), until: t }
    case 'last_week': { const e = addDays(mondayOf(t), -1); return { since: addDays(e, -6), until: e } }
    case 'this_month': return { since: firstOfMonth(t), until: t }
    case 'last_month': {
      const d = parse(firstOfMonth(t)); d.setDate(0)
      return { since: firstOfMonth(iso(d)), until: iso(d) }
    }
    default: return { since: addDays(t, -28), until: t }
  }
}

const fmtShort = (s) => { const d = parse(s); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` }
const fmtFull = (s) => `${fmtShort(s)} ${parse(s).getFullYear()}`
function rangeLabel(value) {
  if (!value?.since || !value?.until) return 'Seleziona periodo'
  const p = PRESETS.find(x => x.id === value.preset)
  if (p) return p.label
  return value.since === value.until ? fmtFull(value.since) : `${fmtShort(value.since)} - ${fmtFull(value.until)}`
}

export default function BmTimeframe({ value, onChange, accent = '#2997ff', disabled = false }) {
  const val = typeof value === 'string' ? { preset: value, ...presetRange(value) } : (value || { preset: 'last_28d', ...presetRange('last_28d') })
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(val)
  const [anchor, setAnchor] = useState(null) // primo click del range
  const [viewM, setViewM] = useState(() => { const d = parse(val.until || todayIso()); return { y: d.getFullYear(), m: d.getMonth() } })
  const [compare, setCompare] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const ref = useRef(null)
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (ref.current?.contains(e.target) || popoverRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const openPanel = () => {
    if (disabled) return
    setDraft(val)
    setAnchor(null)
    const d = parse(val.until || todayIso())
    setViewM({ y: d.getFullYear(), m: d.getMonth() })
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
    setOpen(true)
  }

  const pickPreset = (id) => {
    const r = presetRange(id)
    setDraft({ preset: id, ...r })
    setAnchor(null)
    const d = parse(r.until)
    setViewM({ y: d.getFullYear(), m: d.getMonth() })
  }

  const pickDay = (dayIso) => {
    if (!anchor) { setAnchor(dayIso); setDraft({ preset: 'custom', since: dayIso, until: dayIso }); return }
    const since = dayIso < anchor ? dayIso : anchor
    const until = dayIso < anchor ? anchor : dayIso
    setDraft({ preset: 'custom', since, until })
    setAnchor(null)
  }

  const apply = () => { onChange?.({ preset: draft.preset, since: draft.since, until: draft.until }); setOpen(false) }

  const shiftMonth = (delta) => setViewM(v => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } })

  const prevCmp = compare ? (() => {
    const days = Math.round((parse(draft.until) - parse(draft.since)) / 86400000) + 1
    const pu = addDays(draft.since, -1)
    return { since: addDays(pu, -(days - 1)), until: pu }
  })() : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button ref={triggerRef} type="button" onClick={openPanel} disabled={disabled} style={{
        background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text)',
        borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        display: 'flex', alignItems: 'center', gap: 8, minWidth: 160,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
        <span style={{ flex: 1, textAlign: 'left' }}>{rangeLabel(val)}</span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
      </button>

      {open && typeof document !== 'undefined' && createPortal((
        <div ref={popoverRef} style={{
          position: 'fixed', top: pos.top, right: pos.right, zIndex: 2147483000,
          background: 'var(--surface, #0d0d16)', border: '1px solid var(--border)', borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.55)', display: 'flex', overflow: 'hidden',
          maxWidth: '94vw', maxHeight: 'calc(100vh - 90px)', overflowY: 'auto',
        }}>
          {/* Sidebar preset */}
          <div style={{ width: 210, borderRight: '1px solid var(--border)', padding: '14px 10px', maxHeight: 420, overflowY: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px 8px' }}>Periodo</div>
            {PRESETS.map(p => {
              const on = draft.preset === p.id
              return (
                <button key={p.id} type="button" onClick={() => pickPreset(p.id)} style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: on ? `${accent}1f` : 'transparent', color: on ? accent : 'var(--text2)',
                  fontSize: 13, fontWeight: on ? 800 : 600,
                }}>
                  <span style={{ width: 14, height: 14, borderRadius: 999, border: `2px solid ${on ? accent : 'var(--text3)'}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {on && <span style={{ width: 6, height: 6, borderRadius: 999, background: accent }} />}
                  </span>
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* Calendari */}
          <div style={{ padding: 16, minWidth: 540 }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <CalNav onPrev={() => shiftMonth(-1)} side="left" />
              <Month y={viewM.y} m={viewM.m} draft={draft} onPick={pickDay} accent={accent} />
              <Month y={new Date(viewM.y, viewM.m + 1, 1).getFullYear()} m={new Date(viewM.y, viewM.m + 1, 1).getMonth()} draft={draft} onPick={pickDay} accent={accent} />
              <CalNav onNext={() => shiftMonth(1)} side="right" />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />
              Confronta
              {prevCmp && <span style={{ color: 'var(--text3)', fontSize: 12 }}>· {fmtShort(prevCmp.since)} - {fmtFull(prevCmp.until)}</span>}
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, gap: 12 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 700 }}>
                {draft.since === draft.until ? fmtFull(draft.since) : `${fmtShort(draft.since)} → ${fmtFull(draft.until)}`}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setOpen(false)} style={{ background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 9, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Annulla</button>
                <button type="button" onClick={apply} style={{ background: accent, border: 'none', color: '#0a0a14', borderRadius: 9, padding: '8px 22px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Aggiorna</button>
              </div>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  )
}

function CalNav({ onPrev, onNext, side }) {
  return (
    <button type="button" onClick={side === 'left' ? onPrev : onNext} style={{ background: 'transparent', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 18, padding: '4px 2px', marginTop: 2 }}>
      {side === 'left' ? '‹' : '›'}
    </button>
  )
}

function Month({ y, m, draft, onPick, accent }) {
  const first = new Date(y, m, 1)
  const startDow = (first.getDay() + 6) % 7 // 0 = lunedì
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const today = todayIso()
  const inRange = (dIso) => draft.since && draft.until && dIso >= draft.since && dIso <= draft.until
  const isEdge = (dIso) => dIso === draft.since || dIso === draft.until

  return (
    <div style={{ width: 232 }}>
      <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>{MONTHS[m]} {y}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {DOW.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text3)', padding: '2px 0' }}>{d}</div>)}
        {cells.map((d, i) => {
          if (d == null) return <div key={i} />
          const dIso = `${y}-${pad(m + 1)}-${pad(d)}`
          const future = dIso > today
          const edge = isEdge(dIso)
          const within = inRange(dIso)
          return (
            <button key={i} type="button" disabled={future} onClick={() => onPick(dIso)} style={{
              padding: '7px 0', fontSize: 12.5, borderRadius: 7, border: 'none', cursor: future ? 'not-allowed' : 'pointer',
              fontWeight: edge ? 800 : 600,
              background: edge ? accent : within ? `${accent}22` : 'transparent',
              color: future ? 'var(--text3)' : edge ? '#0a0a14' : within ? accent : 'var(--text)',
              opacity: future ? 0.35 : 1,
            }}>{d}</button>
          )
        })}
      </div>
    </div>
  )
}
