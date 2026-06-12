'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import { PlatformBadges } from './PlatformIcon'

// ─────────────────────────────────────────────────────────────
//  Lighthouse — Alert Center (stile Triple Whale Lighthouse)
//  - Headline: count totale alert + breakdown severity
//  - Filtri: tutti / high / medium / low
//  - Card per alert con severity stripe + cause + suggestion
// ─────────────────────────────────────────────────────────────

const PRESETS = [
  { value: 'today',    label: 'Oggi' },
  { value: 'last_7d',  label: '7 giorni' },
  { value: 'last_14d', label: '14 giorni' },
  { value: 'last_28d', label: '28 giorni' },
  { value: 'last_30d', label: '30 giorni' },
  { value: 'last_90d', label: '90 giorni' },
]

const SEVERITY_COLORS = {
  high:   { stripe: '#ef4444', text: '#fca5a5', bg: 'rgba(239,68,68,0.08)' },
  medium: { stripe: '#fbbf24', text: '#fcd34d', bg: 'rgba(251,191,36,0.08)' },
  low:    { stripe: '#94a3b8', text: '#cbd5e1', bg: 'rgba(148,163,184,0.06)' },
}

const SEVERITY_LABEL = {
  high: 'Alto', medium: 'Medio', low: 'Basso',
}

export default function LighthouseTab() {
  const [preset, setPreset] = useState('last_14d')
  const [filter, setFilter] = useState('all')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = (force = false) => {
    let cancelled = false
    const key = `lighthouse:${preset}`
    if (force) invalidate(key)
    const cached = !force ? getCached(key) : null
    if (cached) setData(cached.data); else setLoading(true)
    setError(null)
    swrFetch({
      key, forceRefresh: force,
      fetcher: () => fetch(`/api/lighthouse?preset=${encodeURIComponent(preset)}`).then(r => r.json()),
      onUpdate: fresh => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => { if (!cancelled) { if (j?.error) setError(j.error); setData(j) } })
      .catch(e => { if (!cancelled && !cached) setError(e?.message) })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }

  useEffect(() => { return load() }, [preset]) // eslint-disable-line react-hooks/exhaustive-deps

  const alerts = Array.isArray(data?.alerts) ? data.alerts : []
  const proposals = Array.isArray(data?.proposals) ? data.proposals : []
  const summary = data?.summary || { high: 0, medium: 0, low: 0, total: 0 }
  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="glass-card-static" style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{
          width: 42, height: 42, borderRadius: 11,
          background: 'rgba(251,191,36,0.14)', color: '#fbbf24',
          display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 800,
        }}><Icon name="warning" size={14} /></span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 9.5, color: '#fbbf24', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Lighthouse
            </div>
            <PlatformBadges sources={['meta']} size={14} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.02em' }}>
            Alert center · {summary.total} anomalie rilevate ({data?.baseline_window || 14}gg baseline)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={preset}
            onChange={e => setPreset(e.target.value)}
            style={{
              background: 'var(--glass)', border: '1px solid var(--border)',
              color: 'var(--text)', borderRadius: 10, padding: '8px 14px',
              fontSize: 13, fontWeight: 700, outline: 'none', cursor: 'pointer',
              minWidth: 140,
            }}
          >
            {PRESETS.map(o => <option key={o.value} value={o.value} style={{ background: '#0a0a14' }}>{o.label}</option>)}
          </select>
          <button
            type="button" onClick={() => load(true)} disabled={loading}
            style={{
              border: '1px solid var(--border)', background: 'var(--glass)',
              color: 'var(--text)', borderRadius: 10, padding: '8px 14px',
              fontSize: 13, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {loading ? 'Aggiorno…' : 'Aggiorna'}
          </button>
        </div>
      </div>

      {/* PROPOSTE PROATTIVE */}
      {proposals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            fontSize: 11, color: 'var(--text3)', fontWeight: 800,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            marginTop: 6,
          }}>
            <Icon name="sparkle" size={14} /> Cosa fare adesso
          </div>
          {proposals.map(p => <ProposalCard key={p.id} proposal={p} />)}
        </div>
      )}

      {/* Summary + filter pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <SummaryPill active={filter === 'all'} onClick={() => setFilter('all')}
          label="Tutti" count={summary.total} color="var(--text)" />
        <SummaryPill active={filter === 'high'} onClick={() => setFilter('high')}
          label="Alta" count={summary.high} color={SEVERITY_COLORS.high.stripe} />
        <SummaryPill active={filter === 'medium'} onClick={() => setFilter('medium')}
          label="Media" count={summary.medium} color={SEVERITY_COLORS.medium.stripe} />
        <SummaryPill active={filter === 'low'} onClick={() => setFilter('low')}
          label="Bassa" count={summary.low} color={SEVERITY_COLORS.low.stripe} />
      </div>

      {error && <div className="glass-card-static" style={{ padding: 18, color: '#fca5a5', fontSize: 13 }}><Icon name="warning" size={13} /> {error}</div>}
      {data?.warning && <div className="glass-card-static" style={{ padding: 18, color: '#fbbf24', fontSize: 13 }}>{data.warning}</div>}

      {loading && !data && (
        <div style={{ color: '#9b90aa', padding: 40, fontSize: 15, fontWeight: 700, textAlign: 'center' }}>
          Scansiono anomalie…
        </div>
      )}

      {filtered.length === 0 && data && !loading && (
        <div className="glass-card-static" style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}><Icon name="check" size={24} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Nessuna anomalia in questo filtro</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>L'account è sotto controllo nel periodo selezionato.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(a => <AlertCard key={a.id} alert={a} />)}
      </div>
    </div>
  )
}

function SummaryPill({ active, onClick, label, count, color }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        background: active ? `${color}22` : 'var(--glass)',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        color: active ? color : 'var(--text2)',
        borderRadius: 999,
        padding: '8px 16px',
        fontSize: 12, fontWeight: 800,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
      {label}
      <span style={{
        background: active ? color : 'rgba(255,255,255,0.06)',
        color: active ? '#0a0a14' : 'var(--text3)',
        padding: '1px 7px', borderRadius: 999,
        fontSize: 11, fontWeight: 800,
      }}>
        {count}
      </span>
    </button>
  )
}

const PRIORITY_COLORS = {
  high:   { stripe: '#ef4444', text: '#fca5a5', bg: 'rgba(239,68,68,0.08)', chip: '#ef4444' },
  medium: { stripe: '#fbbf24', text: '#fcd34d', bg: 'rgba(251,191,36,0.08)', chip: '#fbbf24' },
  low:    { stripe: '#22c55e', text: '#86efac', bg: 'rgba(34,197,94,0.06)', chip: '#22c55e' },
}
const PRIORITY_LABEL = { high: 'Priorità alta', medium: 'Priorità media', low: 'Priorità bassa' }

function ProposalCard({ proposal }) {
  const c = PRIORITY_COLORS[proposal.priority] || PRIORITY_COLORS.low
  return (
    <div className="glass-card-static" style={{
      padding: '18px 22px',
      borderLeft: `4px solid ${c.stripe}`,
      background: c.bg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 20 }}>{proposal.icon}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{proposal.title}</span>
        <span style={{
          fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.10em',
          background: c.chip, color: '#0a0a14',
          padding: '3px 8px', borderRadius: 5,
        }}>
          {PRIORITY_LABEL[proposal.priority]}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '6px 14px', fontSize: 13, lineHeight: 1.5 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.10em', textTransform: 'uppercase', paddingTop: 2 }}>Cosa</div>
        <div style={{ color: 'var(--text)', fontWeight: 600 }}>{proposal.what}</div>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.10em', textTransform: 'uppercase', paddingTop: 2 }}>Perché</div>
        <div style={{ color: 'var(--text2)' }}>{proposal.why}</div>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.10em', textTransform: 'uppercase', paddingTop: 2 }}>Come</div>
        <ol style={{ margin: 0, paddingLeft: 16, color: 'var(--text2)' }}>
          {(proposal.how || []).map((step, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function AlertCard({ alert }) {
  const c = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.low
  return (
    <div className="glass-card-static" style={{
      padding: '16px 20px',
      borderLeft: `4px solid ${c.stripe}`,
      background: c.bg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em',
          background: c.stripe, color: '#0a0a14',
          padding: '3px 8px', borderRadius: 5,
        }}>
          {SEVERITY_LABEL[alert.severity]}
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{alert.metric}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{alert.date}</span>
        <span style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: c.text, fontWeight: 700 }}>
          {alert.deviation_pct > 0 ? '▲' : '▼'} {Math.abs(alert.deviation_pct).toFixed(1)}%
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 8 }}>
        <div>
          <span style={{ color: 'var(--text3)' }}>Valore: </span>
          <span style={{ color: 'var(--text)', fontWeight: 800 }}>{alert.current_fmt}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text3)' }}>Baseline: </span>
          <span style={{ color: 'var(--text2)', fontWeight: 700 }}>{alert.baseline_fmt}</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 6 }}>
        <strong style={{ color: 'var(--text)', fontWeight: 800 }}>Causa probabile:</strong> {alert.cause}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--text)', fontWeight: 800 }}>Azione:</strong> {alert.suggestion}
      </div>
    </div>
  )
}
