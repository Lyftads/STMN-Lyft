'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../../lib/i18n/I18nProvider'

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
//
//  i18n: mesi/giorni risolti via Intl (intlLocale), label preset/bottoni via t().
// ============================================================================

// Nomi mesi/giorni localizzati via Intl (anno fittizio fisso).
const monthLong = (loc, m) => new Intl.DateTimeFormat(loc, { month: 'long' }).format(new Date(2021, m, 1))
const monthShort = (loc, m) => new Intl.DateTimeFormat(loc, { month: 'short' }).format(new Date(2021, m, 1)).replace('.', '')
// Giorni della settimana (lunedì→domenica), abbreviati, localizzati.
const dowShort = (loc) => { const out = []; for (let i = 0; i < 7; i++) { const d = new Date(2021, 10, 1 + i); out.push(new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(d).replace('.', '')) } return out } // 1 nov 2021 = lunedì

const PRESET_IDS = ['today', 'yesterday', 'today_yesterday', 'last_7d', 'last_14d', 'last_28d', 'last_30d', 'this_week', 'last_week', 'this_month', 'last_month']

// id preset → chiave i18n
const PRESET_KEY = {
  today: 'tf.today', yesterday: 'tf.yesterday', today_yesterday: 'tf.todayYesterday',
  last_7d: 'tf.last7d', last_14d: 'tf.last14d', last_28d: 'tf.last28d', last_30d: 'tf.last30d', last_90d: 'tf.last90d',
  this_week: 'tf.thisWeek', last_week: 'tf.lastWeek',
  this_month: 'tf.thisMonth', current_month: 'tf.thisMonth', last_month: 'tf.lastMonth', ytd: 'tf.ytd',
}
const PRESET_FALLBACK = {
  today: 'Today', yesterday: 'Yesterday', today_yesterday: 'Today & yesterday',
  last_7d: 'Last 7 days', last_14d: 'Last 14 days', last_28d: 'Last 28 days', last_30d: 'Last 30 days', last_90d: 'Last 90 days',
  this_week: 'This week', last_week: 'Last week',
  this_month: 'This month', current_month: 'This month', last_month: 'Last month', ytd: 'Year to date',
}

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
    case 'last_90d': return { since: addDays(t, -90), until: t }
    case 'this_week': return { since: mondayOf(t), until: t }
    case 'last_week': { const e = addDays(mondayOf(t), -1); return { since: addDays(e, -6), until: e } }
    case 'this_month':
    case 'current_month': return { since: firstOfMonth(t), until: t }
    case 'ytd': return { since: `${parse(t).getFullYear()}-01-01`, until: t }
    case 'last_month': {
      const d = parse(firstOfMonth(t)); d.setDate(0)
      return { since: firstOfMonth(iso(d)), until: iso(d) }
    }
    default: return { since: addDays(t, -28), until: t }
  }
}

const fmtShort = (loc, s) => { const d = parse(s); return `${d.getDate()} ${monthShort(loc, d.getMonth())}` }
const fmtFull = (loc, s) => `${fmtShort(loc, s)} ${parse(s).getFullYear()}`

function rangeLabel(value, t, loc) {
  if (value?.preset && value.preset !== 'custom' && PRESET_KEY[value.preset]) return t(PRESET_KEY[value.preset], null, PRESET_FALLBACK[value.preset])
  if (!value?.since || !value?.until) return t('tf.selectPeriod', null, 'Select period')
  return value.since === value.until ? fmtFull(loc, value.since) : `${fmtShort(loc, value.since)} - ${fmtFull(loc, value.until)}`
}

export default function BmTimeframe({ value, onChange, accent = '#2997ff', disabled = false }) {
  const { t, intlLocale } = useI18n()
  const loc = intlLocale || 'en-US'
  const val = (() => {
    if (typeof value === 'string') return { preset: value, ...presetRange(value) }
    if (value && value.since && value.until) return value
    if (value && value.preset) return { ...value, ...presetRange(value.preset) } // risolvi il range per evitare NaN
    return { preset: 'last_28d', ...presetRange('last_28d') }
  })()
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
    // Chiudi sullo scroll della PAGINA, ma NON quando si scrolla DENTRO il popover
    // (sidebar preset / calendario hanno overflow proprio).
    const onScroll = (e) => { if (popoverRef.current?.contains(e.target)) return; setOpen(false) }
    const onResize = () => setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
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
        <span style={{ flex: 1, textAlign: 'left' }}>{rangeLabel(val, t, loc)}</span>
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
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px 8px' }}>{t('tf.period', null, 'Period')}</div>
            {PRESET_IDS.map(id => {
              const on = draft.preset === id
              return (
                <button key={id} type="button" onClick={() => pickPreset(id)} style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: on ? `${accent}1f` : 'transparent', color: on ? accent : 'var(--text2)',
                  fontSize: 13, fontWeight: on ? 800 : 600,
                }}>
                  <span style={{ width: 14, height: 14, borderRadius: 999, border: `2px solid ${on ? accent : 'var(--text3)'}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {on && <span style={{ width: 6, height: 6, borderRadius: 999, background: accent }} />}
                  </span>
                  {t(PRESET_KEY[id], null, PRESET_FALLBACK[id])}
                </button>
              )
            })}
          </div>

          {/* Calendari */}
          <div style={{ padding: 16, minWidth: 540 }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <CalNav onPrev={() => shiftMonth(-1)} side="left" />
              <Month y={viewM.y} m={viewM.m} draft={draft} onPick={pickDay} accent={accent} loc={loc} />
              <Month y={new Date(viewM.y, viewM.m + 1, 1).getFullYear()} m={new Date(viewM.y, viewM.m + 1, 1).getMonth()} draft={draft} onPick={pickDay} accent={accent} loc={loc} />
              <CalNav onNext={() => shiftMonth(1)} side="right" />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />
              {t('tf.compare', null, 'Compare')}
              {prevCmp && <span style={{ color: 'var(--text3)', fontSize: 12 }}>· {fmtShort(loc, prevCmp.since)} - {fmtFull(loc, prevCmp.until)}</span>}
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, gap: 12 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 700 }}>
                {draft.since === draft.until ? fmtFull(loc, draft.since) : `${fmtShort(loc, draft.since)} → ${fmtFull(loc, draft.until)}`}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setOpen(false)} style={{ background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 9, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t('tf.cancel', null, 'Cancel')}</button>
                <button type="button" onClick={apply} style={{ background: accent, border: 'none', color: '#0a0a14', borderRadius: 9, padding: '8px 22px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{t('tf.update', null, 'Update')}</button>
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

function Month({ y, m, draft, onPick, accent, loc }) {
  const first = new Date(y, m, 1)
  const startDow = (first.getDay() + 6) % 7 // 0 = lunedì
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  const dow = dowShort(loc)

  const today = todayIso()
  const inRange = (dIso) => draft.since && draft.until && dIso >= draft.since && dIso <= draft.until
  const isEdge = (dIso) => dIso === draft.since || dIso === draft.until

  return (
    <div style={{ width: 232 }}>
      <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>{monthLong(loc, m)} {y}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {dow.map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text3)', padding: '2px 0' }}>{d}</div>)}
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
