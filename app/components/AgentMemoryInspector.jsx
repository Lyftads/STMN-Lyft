'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Icon from './ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'

// ─────────────────────────────────────────────────────────────
//  AgentMemoryInspector — vista delle memorie agent.
//  Permette al user di:
//   - Vedere cosa gli agent hanno imparato
//   - Modificare importance (priorita' nel recall)
//   - Cancellare memorie sbagliate / obsolete
//  Si aggancia come una sezione collassabile dentro BrandIdentityPanel.
// ─────────────────────────────────────────────────────────────

const ACCENT = '#bf5af2'

const AGENT_LABELS = {
  'kpi': 'KPI Brain',
  'mensile': 'Mensile',
  'quarter': 'Quarter',
  'year': 'Year',
  'weekly': 'Weekly',
  'cro': 'CRO',
  'creative': 'Creative',
  'scanner': 'AI Scanner',
  'simulator': 'Simulatore',
  'meta-ads': 'Meta Ads',
  'competitor': 'Competitor',
  'performance': 'Performance Agent',
  'auto-scan': 'Briefing Automatico',
}

const ROLE_TAGS = {
  preference: { labelKey: 'ami.rolePreference', en: 'Preference', icon: <Icon name="gear" size={11} />, color: '#2997ff' },
  fact:       { labelKey: 'ami.roleFact', en: 'Fact', icon: <Icon name="pin" size={11} />,  color: '#22c55e' },
  insight:    { labelKey: 'ami.roleInsight', en: 'Insight', icon: <Icon name="bulb" size={11} />, color: '#f59e0b' },
  observation:{ labelKey: 'ami.roleObservation', en: 'Observation', icon: '·',  color: '#86868b' },
}

export default function AgentMemoryInspector() {
  const { t } = useI18n()
  const [memories, setMemories] = useState({ byAgent: {}, total: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('all')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/agent-memories?limit=300')
      .then(r => r.json())
      .then(j => {
        if (!j?.error) setMemories(j)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    if (!confirm(t('ami.confirmDelete', null, 'Permanently delete this memory?'))) return
    const res = await fetch(`/api/agent-memories?id=${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  const handleImportance = async (id, importance) => {
    await fetch(`/api/agent-memories?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importance }),
    })
    load()
  }

  // Flatten filtered list
  const allMemories = []
  for (const agentId of Object.keys(memories.byAgent || {})) {
    if (agentFilter !== 'all' && agentFilter !== agentId) continue
    for (const m of memories.byAgent[agentId]) {
      if (filter && !m.content.toLowerCase().includes(filter.toLowerCase())) continue
      allMemories.push(m)
    }
  }

  const agentIds = Object.keys(memories.byAgent || {})

  return (
    <div className="glass-card-static" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <span style={{
          width: 42, height: 42, borderRadius: 12,
          background: `${ACCENT}20`, color: ACCENT,
          display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 800,
          flexShrink: 0,
        }}>◓</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, color: ACCENT, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            {t('ami.title', null, 'Agent Memories')}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', marginTop: 4 }}>
            {t('ami.learnedCount', { n: memories.total }, '{n} learned memories')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>
            {t('ami.description', null, 'What your agents learned from conversations and live data. You can change priority or delete wrong ones — they will not be used on the next recall.')}
          </div>
        </div>
        <ExportImportButtons onImported={load} />
        <button
          type="button"
          onClick={load}
          style={{
            padding: '8px 14px', borderRadius: 10,
            background: 'var(--glass)',
            border: '1px solid var(--border2)',
            color: 'var(--text3)', fontSize: 11, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ↻ {t('ami.refresh', null, 'Refresh')}
        </button>
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <select
          value={agentFilter}
          onChange={e => setAgentFilter(e.target.value)}
          style={{
            padding: '10px 12px', borderRadius: 10,
            background: 'var(--glass)',
            border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: 12.5, fontWeight: 600,
            outline: 'none', cursor: 'pointer', minWidth: 180,
          }}
        >
          <option value="all">{t('ami.allAgents', { n: memories.total }, 'All agents ({n})')}</option>
          {agentIds.map(a => (
            <option key={a} value={a}>
              {AGENT_LABELS[a] || a} ({memories.byAgent[a].length})
            </option>
          ))}
        </select>
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder={t('ami.searchPlaceholder', null, 'Search in text...')}
          style={{
            flex: 1, minWidth: 200,
            padding: '10px 12px', borderRadius: 10,
            background: 'var(--glass)',
            border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: 12.5,
            outline: 'none',
          }}
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '40px 0', fontSize: 13 }}>
          {t('ami.loading', null, 'Loading memories…')}
        </div>
      ) : allMemories.length === 0 ? (
        <div style={{
          color: 'var(--text4, #555)', textAlign: 'center', padding: '40px 0',
          fontSize: 13, fontStyle: 'italic',
        }}>
          {filter ? t('ami.noneFiltered', null, 'No memory matching the filter') : t('ami.noneYet', null, 'No memories yet — use the agents to start building knowledge')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 600, overflowY: 'auto' }}>
          {allMemories.map(m => (
            <MemoryRow
              key={m.id}
              memory={m}
              onDelete={() => handleDelete(m.id)}
              onImportanceChange={imp => handleImportance(m.id, imp)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MemoryRow({ memory, onDelete, onImportanceChange }) {
  const { t, intlLocale } = useI18n()
  const tag = ROLE_TAGS[memory.role] || ROLE_TAGS.observation
  const agentLabel = AGENT_LABELS[memory.agent_id] || memory.agent_id

  const created = new Date(memory.created_at)
  const dateStr = created.toLocaleDateString(intlLocale, { day: '2-digit', month: 'short', year: 'numeric' })

  const isAutoScan = memory.source === 'cron-scan'
  const isConsolidated = memory.source === 'consolidated'

  return (
    <div className="glass-panel" style={{
      borderRadius: 12, padding: 14,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 6,
          background: `${tag.color}1f`, border: `1px solid ${tag.color}66`,
          fontSize: 10, color: tag.color, fontWeight: 700, textTransform: 'uppercase',
        }}>
          {tag.icon} {t(tag.labelKey, null, tag.en)}
        </span>
        <span style={{
          fontSize: 10, color: 'var(--text4, #666)', fontWeight: 600,
          padding: '3px 8px', borderRadius: 6,
          background: 'var(--glass)',
        }}>
          {agentLabel}
        </span>
        {isAutoScan && (
          <span style={{
            fontSize: 9.5, color: '#22c55e', fontWeight: 700,
            padding: '3px 8px', borderRadius: 6,
            background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.30)',
          }}>
            ◐ {t('ami.autoScan', null, 'Auto-scan')}
          </span>
        )}
        {isConsolidated && (
          <span style={{
            fontSize: 9.5, color: '#f59e0b', fontWeight: 700,
            padding: '3px 8px', borderRadius: 6,
            background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)',
          }}>
            ⊛ {t('ami.synthesis', null, 'Synthesis')}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--text4, #666)' }}>
          {dateStr} · {t('ami.usedTimes', { n: memory.use_count || 0 }, 'used {n}×')}
        </span>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>
        {memory.content}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700 }}>{t('ami.priority', null, 'Priority:')}</span>
        <input
          type="range"
          min={1} max={10} step={1}
          value={memory.importance}
          onChange={e => onImportanceChange(parseInt(e.target.value, 10))}
          style={{ flex: 1, maxWidth: 160, accentColor: ACCENT }}
        />
        <span style={{
          fontSize: 11, color: 'var(--text)', fontWeight: 700,
          minWidth: 24, textAlign: 'center',
        }}>
          {memory.importance}
        </span>
        <button
          type="button"
          onClick={onDelete}
          style={{
            padding: '5px 10px', borderRadius: 8,
            background: 'transparent',
            border: '1px solid rgba(248,113,113,0.30)',
            color: '#f87171', fontSize: 10, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t('ami.delete', null, 'Delete')}
        </button>
      </div>
    </div>
  )
}

function ExportImportButtons({ onImported }) {
  const { t } = useI18n()
  const fileRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState(null)

  const handleExport = () => {
    // Browser triggera download via Content-Disposition header dell'API
    window.open('/api/agent-memories/export', '_blank')
  }

  const handleImportFile = async (file) => {
    if (!file) return
    setImporting(true)
    setMsg(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const res = await fetch('/api/agent-memories/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error || `HTTP ${res.status}`)
      setMsg(t('ami.imported', { n: j.imported }, '✓ Imported {n} memories'))
      onImported?.()
    } catch (e) {
      setMsg(`${e?.message || t('ami.importError', null, 'Import error')}`)
    } finally {
      setImporting(false)
      setTimeout(() => setMsg(null), 5000)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleExport}
        title={t('ami.exportTitle', null, 'Download all memories as a JSON file')}
        style={{
          padding: '8px 12px', borderRadius: 10,
          background: 'var(--glass)',
          border: '1px solid var(--border2)',
          color: 'var(--text3)', fontSize: 11, fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        ⬇ {t('ami.export', null, 'Export')}
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        title={t('ami.importTitle', null, 'Upload a previously exported memories JSON file')}
        style={{
          padding: '8px 12px', borderRadius: 10,
          background: 'var(--glass)',
          border: '1px solid var(--border2)',
          color: 'var(--text3)', fontSize: 11, fontWeight: 700,
          cursor: importing ? 'wait' : 'pointer',
        }}
      >
        {importing ? '…' : `⬆ ${t('ami.import', null, 'Import')}`}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleImportFile(f)
          e.target.value = ''
        }}
      />
      {msg && (
        <span style={{
          fontSize: 10.5, color: msg.startsWith('✓') ? '#86efac' : '#fca5a5',
          padding: '6px 10px', borderRadius: 8,
          background: msg.startsWith('✓') ? 'rgba(34,197,94,0.10)' : 'rgba(248,113,113,0.10)',
        }}>{msg}</span>
      )}
    </>
  )
}
