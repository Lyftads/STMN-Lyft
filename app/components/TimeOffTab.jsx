'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Icon from './ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'

// ============================================================================
//  Ferie e permessi — richieste, approvazioni e totali per persona.
//
//  Stessa fonte del Calendario (`time_off`): qui si gestiscono, lì si vedono
//  insieme a promo ed eventi. Nessuna tabella nuova.
//
//  I giorni si contano LAVORATIVI (lun-ven): dire "10 giorni" per due settimane
//  di ferie che ne consumano 10 è l'unico conteggio che serve a chi pianifica.
// ============================================================================

const TYPES = ['ferie', 'permesso', 'malattia']
const TYPE_COLOR = { ferie: '#2997ff', permesso: '#bf5af2', malattia: '#f59e0b' }
const TYPE_FALLBACK = { ferie: 'Ferie', permesso: 'Permesso', malattia: 'Malattia' }
const STATUS_COLOR = { pending: '#f59e0b', approved: '#22c55e', rejected: '#ef4444' }

const pad = n => String(n).padStart(2, '0')
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return { y, m: m - 1, d } }

// Giorni lavorativi inclusivi fra due date (sabato e domenica esclusi).
function workingDays(start, end) {
  const a = parse(start), b = parse(end)
  let t = Date.UTC(a.y, a.m, a.d)
  const last = Date.UTC(b.y, b.m, b.d)
  if (last < t) return 0
  let n = 0
  while (t <= last) {
    const dow = new Date(t).getUTCDay()
    if (dow !== 0 && dow !== 6) n++
    t += 86400000
  }
  return n
}

export default function TimeOffTab() {
  const { t, locale } = useI18n()
  const L = locale || 'it'
  const tr = (k, f, vars) => t(k, vars || null, f)
  const typeLabel = k => tr(`toff.type.${k}`, TYPE_FALLBACK[k] || k)

  const [rows, setRows] = useState([])
  const [me, setMe] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [status, setStatus] = useState('all')
  const [person, setPerson] = useState('all')
  const [modal, setModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/time-off', { cache: 'no-store' }).then(x => x.json())
      setRows(Array.isArray(r?.requests) ? r.requests : [])
      setMe(r?.me || null)
    } catch { setRows([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let alive = true
    fetch('/api/team-members', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (alive && j) setMembers((j.members || []).map(m => ({ id: m.id, name: m.full_name || m.email }))) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const isAdmin = !!me?.isAdmin

  const years = useMemo(() => {
    const ys = new Set([new Date().getFullYear()])
    for (const r of rows) ys.add(Number(String(r.start_date).slice(0, 4)))
    return [...ys].sort((a, b) => b - a)
  }, [rows])

  const inYear = useMemo(
    () => rows.filter(r => Number(String(r.start_date).slice(0, 4)) === year),
    [rows, year]
  )

  const visible = useMemo(() => {
    return inYear
      .filter(r => status === 'all' || r.status === status)
      .filter(r => person === 'all' || r.member_id === person)
      .sort((a, b) => (a.start_date < b.start_date ? 1 : -1))
  }, [inYear, status, person])

  // Totali: solo le richieste APPROVATE contano come giorni consumati; quelle
  // in attesa si mostrano a parte, altrimenti un totale "provvisorio" verrebbe
  // scambiato per definitivo.
  const totals = useMemo(() => {
    const out = { ferie: 0, permesso: 0, malattia: 0, pending: 0 }
    for (const r of inYear) {
      if (person !== 'all' && r.member_id !== person) continue
      if (r.status === 'pending') { out.pending++; continue }
      if (r.status !== 'approved') continue
      out[r.type] = (out[r.type] || 0) + workingDays(r.start_date, r.end_date)
    }
    return out
  }, [inYear, person])

  const act = async (row, next) => {
    setBusyId(row.id)
    try {
      await fetch('/api/time-off', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, status: next }),
      })
      await load()
    } finally { setBusyId(null) }
  }

  const remove = async (row) => {
    if (!window.confirm(tr('toff.deleteConfirm', 'Eliminare questa richiesta?'))) return
    setBusyId(row.id)
    try {
      await fetch(`/api/time-off?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' })
      await load()
    } finally { setBusyId(null) }
  }

  const fmtDate = (s) => {
    const { y, m, d } = parse(s)
    try { return new Intl.DateTimeFormat(L === 'it' ? 'it-IT' : L, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(Date.UTC(y, m, d))) } catch { return s }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Totali dell'anno */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, position: 'relative', zIndex: 2 }}>
        {TYPES.map(k => (
          <div key={k} className="glass-panel" style={{ borderRadius: 16, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: TYPE_COLOR[k] }} />
              <span style={{ fontSize: 10, fontWeight: 640, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                {typeLabel(k)}
              </span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 680, color: 'var(--text)', letterSpacing: '-0.02em' }}>{totals[k] || 0}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{tr('toff.workDays', 'giorni lavorativi · approvati')}</div>
          </div>
        ))}
        <div className="glass-panel" style={{ borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: STATUS_COLOR.pending }} />
            <span style={{ fontSize: 10, fontWeight: 640, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
              {tr('toff.pending', 'In attesa')}
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 680, color: 'var(--text)', letterSpacing: '-0.02em' }}>{totals.pending}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
            {isAdmin ? tr('toff.pendingAdmin', 'richieste da approvare') : tr('toff.pendingMine', 'tue richieste in attesa')}
          </div>
        </div>
      </div>

      {/* Filtri */}
      <div className="glass-panel" style={{ borderRadius: 16, padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', position: 'relative', zIndex: 2 }}>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={filterStyle}>
          {years.map(y => <option key={y} value={y} style={{ background: 'var(--surface)' }}>{y}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} style={filterStyle}>
          <option value="all" style={{ background: 'var(--surface)' }}>{tr('toff.allStatus', 'Tutti gli stati')}</option>
          <option value="pending" style={{ background: 'var(--surface)' }}>{tr('toff.st.pending', 'In attesa')}</option>
          <option value="approved" style={{ background: 'var(--surface)' }}>{tr('toff.st.approved', 'Approvate')}</option>
          <option value="rejected" style={{ background: 'var(--surface)' }}>{tr('toff.st.rejected', 'Rifiutate')}</option>
        </select>
        {isAdmin && members.length > 0 && (
          <select value={person} onChange={e => setPerson(e.target.value)} style={filterStyle}>
            <option value="all" style={{ background: 'var(--surface)' }}>{tr('toff.allPeople', 'Tutte le persone')}</option>
            {members.map(m => <option key={m.id} value={m.id} style={{ background: 'var(--surface)' }}>{m.name}</option>)}
          </select>
        )}
        <button type="button" onClick={() => setModal({ type: 'ferie', start: isoOf(new Date()), end: isoOf(new Date()), note: '', member_id: '' })}
          style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '10px 16px', borderRadius: 12, cursor: 'pointer', border: 'none',
            background: 'var(--btn-primario)', color: 'var(--btn-primario-testo)', fontSize: 13, fontWeight: 640,
          }}>
          <Icon name="plus" size={14} /> {tr('toff.new', 'Nuova richiesta')}
        </button>
      </div>

      {/* Elenco */}
      <div className="glass-panel" style={{ borderRadius: 16, padding: 6, position: 'relative', zIndex: 2 }}>
        {loading ? (
          <Empty text={tr('toff.loading', 'Carico…')} />
        ) : visible.length === 0 ? (
          <Empty text={tr('toff.empty', 'Nessuna richiesta per i filtri scelti.')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visible.map((r, i) => {
              const days = workingDays(r.start_date, r.end_date)
              const mine = r.member_id === me?.memberId
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  padding: '12px 14px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: TYPE_COLOR[r.type] || '#8e8e8e', flexShrink: 0 }} />
                  <div style={{ minWidth: 150, flex: '1 1 200px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {r.member_name || tr('toff.unknown', 'Senza nome')}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
                      {typeLabel(r.type)} · {fmtDate(r.start_date)}{r.end_date !== r.start_date ? ` → ${fmtDate(r.end_date)}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                    {tr('toff.days', '{n} gg', { n: days })}
                  </span>
                  {r.note && (
                    <span title={r.note} style={{
                      fontSize: 11.5, color: 'var(--text3)', flex: '1 1 160px', minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{r.note}</span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 640, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap',
                    background: `${STATUS_COLOR[r.status] || '#8e8e8e'}22`,
                    color: STATUS_COLOR[r.status] || '#8e8e8e',
                  }}>
                    {tr(`toff.st.${r.status}`, r.status)}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {isAdmin && r.status !== 'approved' && (
                      <button type="button" disabled={busyId === r.id} onClick={() => act(r, 'approved')} style={btn('#22c55e')}>
                        {tr('toff.approve', 'Approva')}
                      </button>
                    )}
                    {isAdmin && r.status !== 'rejected' && (
                      <button type="button" disabled={busyId === r.id} onClick={() => act(r, 'rejected')} style={btn('#f59e0b')}>
                        {tr('toff.reject', 'Rifiuta')}
                      </button>
                    )}
                    {(isAdmin || mine) && (
                      <button type="button" disabled={busyId === r.id} onClick={() => remove(r)} style={btn('#f87171')}>
                        <Icon name="trash" size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <RequestModal
          draft={modal} members={members} isAdmin={isAdmin} tr={tr} typeLabel={typeLabel}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}

function RequestModal({ draft, members, isAdmin, tr, typeLabel, onClose, onSaved }) {
  const [f, setF] = useState(draft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const days = workingDays(f.start, f.end)

  const save = async () => {
    setError(null)
    if (f.end < f.start) { setError(tr('toff.errDates', 'La data di fine precede quella di inizio.')); return }
    setBusy(true)
    try {
      const r = await fetch('/api/time-off', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: f.type, start_date: f.start, end_date: f.end, note: f.note, member_id: f.member_id || undefined }),
      })
      const j = await r.json().catch(() => null)
      if (!j?.ok) { setError(j?.error || tr('toff.errSave', 'Salvataggio non riuscito.')); setBusy(false); return }
      onSaved()
    } catch (e) { setError(e?.message || 'network'); setBusy(false) }
  }

  return (
    <div className="mobile-modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 440, borderRadius: 16, padding: 22,
        background: 'linear-gradient(180deg, rgba(12,12,24,0.98), rgba(0,0,0,0.99))',
        border: '1px solid var(--border2)', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: TYPE_COLOR[f.type] }} />
          <div style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)', flex: 1 }}>{tr('toff.new', 'Nuova richiesta')}</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <Field label={tr('toff.type', 'Tipo')}>
          <select value={f.type} onChange={e => set('type', e.target.value)} style={selStyle}>
            {TYPES.map(k => <option key={k} value={k} style={{ background: 'var(--surface)' }}>{typeLabel(k)}</option>)}
          </select>
        </Field>

        {isAdmin && members.length > 0 && (
          <Field label={tr('toff.person', 'Persona')}>
            <select value={f.member_id} onChange={e => set('member_id', e.target.value)} style={selStyle}>
              <option value="" style={{ background: 'var(--surface)' }}>{tr('toff.meLabel', 'Io')}</option>
              {members.map(m => <option key={m.id} value={m.id} style={{ background: 'var(--surface)' }}>{m.name}</option>)}
            </select>
          </Field>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Field label={tr('toff.from', 'Dal')} grow>
            <input type="date" value={f.start} onChange={e => { set('start', e.target.value); if (f.end < e.target.value) set('end', e.target.value) }} style={selStyle} />
          </Field>
          <Field label={tr('toff.to', 'Al')} grow>
            <input type="date" value={f.end} min={f.start} onChange={e => set('end', e.target.value)} style={selStyle} />
          </Field>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text3)' }}>{tr('toff.willUse', 'Consuma {n} giorni lavorativi', { n: days })}</div>

        <Field label={tr('toff.note', 'Nota')}>
          <textarea value={f.note} onChange={e => set('note', e.target.value)} rows={2} style={{ ...selStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </Field>

        {!isAdmin && (
          <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
            {tr('toff.needsApproval', 'La richiesta resta in attesa finché un amministratore non la approva.')}
          </div>
        )}

        {error && (
          <div style={{ fontSize: 13, color: '#fca5a5', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)', padding: '8px 12px', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{
            padding: '10px 16px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text2)',
          }}>{tr('toff.cancel', 'Annulla')}</button>
          <button type="button" onClick={save} disabled={busy} style={{
            padding: '10px 18px', borderRadius: 12, cursor: busy ? 'wait' : 'pointer', border: 'none',
            background: 'var(--btn-primario)', color: 'var(--btn-primario-testo)', fontSize: 13, fontWeight: 640,
          }}>{busy ? tr('toff.saving', 'Salvo…') : tr('toff.save', 'Salva')}</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, grow }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: grow ? 1 : undefined }}>
      <span style={{ fontSize: 10, fontWeight: 640, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</span>
      {children}
    </label>
  )
}

function Empty({ text }) {
  return <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{text}</div>
}

// I filtri stanno in fila: prendono la larghezza del contenuto. I campi del
// modulo invece riempiono la colonna (filterStyle vs selStyle).
const filterStyle = {
  padding: '9px 12px', borderRadius: 12, minWidth: 140,
  background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer',
}

const selStyle = {
  padding: '9px 12px', borderRadius: 12, width: '100%',
  background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 13, outline: 'none',
}

function btn(color) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 11px', borderRadius: 8, cursor: 'pointer', fontSize: 11.5, fontWeight: 640,
    background: `${color}1c`, border: `1px solid ${color}59`, color,
  }
}
