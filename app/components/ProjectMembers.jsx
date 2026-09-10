'use client'

import { useState, useEffect, useCallback } from 'react'
import Icon from './ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'

// ============================================================================
//  Membri di un progetto: chi ci lavora e chi lo guida.
//
//  Chi è in ferie oggi porta il suo bollino: assegnare una task a chi non c'è
//  è l'errore che questa vista serve a evitare.
//  Aggiungere qui una persona la mette anche nel gruppo LyftTalk del progetto.
// ============================================================================

const LEAVE_LABEL = { ferie: 'In ferie', permesso: 'In permesso', malattia: 'In malattia' }

export default function ProjectMembers({ projectId, onCountChange }) {
  const { t } = useI18n()
  const tr = (k, f, v) => t(k, v || null, f)
  const [data, setData] = useState({ members: [], team: [], can: { write: false }, needsSetup: false })
  const [loading, setLoading] = useState(true)
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/projects/members?projectId=${projectId}`, { cache: 'no-store' }).then(r => r.json())
      setData({ members: j.members || [], team: j.team || [], can: j.can || { write: false }, needsSetup: !!j.needsSetup })
      onCountChange?.((j.members || []).length)
    } finally { setLoading(false) }
  }, [projectId, onCountChange])

  useEffect(() => { load() }, [load])

  const add = async (memberId, lead = false) => {
    if (!memberId) return
    setBusy(true)
    try {
      await fetch('/api/projects/members', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, memberId, lead }),
      })
      setPick('')
      await load()
    } finally { setBusy(false) }
  }

  const remove = async (memberId) => {
    if (!confirm(tr('pm.removeConfirm', 'Togliere questa persona dal progetto?'))) return
    setBusy(true)
    try {
      await fetch(`/api/projects/members?projectId=${projectId}&memberId=${memberId}`, { method: 'DELETE' })
      await load()
    } finally { setBusy(false) }
  }

  const lead = data.members.find(m => m.isLead) || null
  const inProject = new Set(data.members.map(m => m.memberId))
  const addable = data.team.filter(m => !inProject.has(m.id))
  const can = !!data.can?.write

  if (loading) return <Empty text={tr('pm.loading', 'Carico…')} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {data.needsSetup && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,159,10,0.10)', border: '1px solid rgba(255,159,10,0.35)', fontSize: 12.5, lineHeight: 1.5 }}>
          <strong style={{ color: '#ffb340', fontWeight: 800 }}>{tr('pm.setupTitle', 'Membri di progetto non attivi')}</strong>
          <div style={{ color: 'var(--text3)', marginTop: 3 }}>{tr('pm.setupBody', 'Esegui supabase/project_workspace.sql per attivare membri, lead e chat di progetto.')}</div>
        </div>
      )}

      {/* Lead */}
      <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{tr('pm.lead', 'Lead del progetto')}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2, marginBottom: 10 }}>
          {tr('pm.leadHint', 'Una sola persona alla volta. Chi era lead resta nel progetto come membro.')}
        </div>
        <select value={lead?.memberId || ''} disabled={!can || busy} onChange={e => add(e.target.value, true)} style={sel}>
          <option value="" style={opt}>{tr('pm.noLead', 'Nessun lead')}</option>
          {data.team.map(m => <option key={m.id} value={m.id} style={opt}>{m.name}</option>)}
        </select>
      </div>

      {/* Aggiungi membro */}
      {can && (
        <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            {tr('pm.addMember', 'Aggiungi membro')}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={pick} onChange={e => setPick(e.target.value)} disabled={busy || addable.length === 0} style={{ ...sel, flex: '1 1 220px' }}>
              <option value="" style={opt}>{addable.length ? tr('pm.choose', 'Scegli una persona…') : tr('pm.allIn', 'Ci sono già tutti')}</option>
              {addable.map(m => <option key={m.id} value={m.id} style={opt}>{m.name}{m.leave ? ` · ${LEAVE_LABEL[m.leave.type] || ''}` : ''}</option>)}
            </select>
            <button type="button" onClick={() => add(pick)} disabled={!pick || busy} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none',
              cursor: (!pick || busy) ? 'default' : 'pointer', opacity: (!pick || busy) ? 0.5 : 1,
              background: 'linear-gradient(135deg, #7b5bff, #5b8bff)', color: '#fff', fontSize: 13, fontWeight: 800,
            }}>
              <Icon name="plus" size={13} /> {tr('pm.add', 'Aggiungi')}
            </button>
          </div>
        </div>
      )}

      {/* Elenco */}
      {data.members.length === 0 ? (
        <Empty text={tr('pm.empty', 'Nessun membro nel progetto.')} />
      ) : (
        <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {data.members.map((m, i) => (
            <div key={m.memberId} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            }}>
              <span style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center',
                background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', color: '#fff', fontSize: 11, fontWeight: 800,
              }}>{initials(m.name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{m.name}</span>
                  {m.isLead && <Tag color="#7b5bff">{tr('pm.leadTag', 'Lead')}</Tag>}
                  {m.leave && <Tag color="#ff9f0a">{tr(`pm.leave.${m.leave.type}`, LEAVE_LABEL[m.leave.type] || 'Assente')}</Tag>}
                </div>
                {m.roles?.length > 0 && (
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{m.roles.join(' · ')}</div>
                )}
              </div>
              {can && !m.isLead && (
                <button type="button" onClick={() => remove(m.memberId)} disabled={busy} title={tr('pm.remove', 'Togli dal progetto')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', display: 'flex' }}>
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Tag({ children, color }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: `${color}22`, color }}>
      {children}
    </span>
  )
}

function Empty({ text }) {
  return <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{text}</div>
}

function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const sel = {
  padding: '9px 12px', borderRadius: 10, width: '100%',
  background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 13, outline: 'none',
}
const opt = { background: '#0d0d16' }
