'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import { PlatformBadges } from './PlatformIcon'

// ─────────────────────────────────────────────────────────────
//  Meta KPI Tab
//  - Card KPI in alto (10 metriche)
//  - Grafici separati sotto (7 grafici: Spend, ROAS, CPO, CTR, CPM,
//    Frequency, Reach)
// ─────────────────────────────────────────────────────────────

const PRESETS = [
  { value: 'today',        label: 'Oggi' },
  { value: 'yesterday',    label: 'Ieri' },
  { value: 'last_7d',      label: '7gg' },
  { value: 'last_14d',     label: '14gg' },
  { value: 'last_28d',     label: '28gg' },
  { value: 'last_30d',     label: '30gg' },
  { value: 'last_90d',     label: '90gg' },
  { value: 'current_month',label: 'Mese' },
  { value: 'ytd',          label: 'YTD' },
]

const eur  = v => v != null ? `€${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '—'
const eur2 = v => v != null ? `€${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 2 })}` : '—'
const num  = v => v != null ? Number(v).toLocaleString('it-IT') : '—'
const pct  = v => v != null ? `${Number(v).toFixed(2)}%` : '—'
const mul  = v => v != null && v > 0 ? `${Number(v).toFixed(2)}x` : '—'

// 'kind' controlla il formato del delta assoluto:
//   money   → mostra € (es. +€1.234)
//   ratio   → mostra unita' (es. +0.12 punti per ROAS/freq)
//   percent → mostra punti percentuali (es. +0.45 pp per CTR)
//   count   → mostra numero (es. +1.234)
// 'lower' = true significa che un calo e' positivo (CPO, CPM, CPC, frequenza).
const KPIS = [
  { key: 'spend',      label: 'Spesa',         fmt: eur,  kind: 'money'   },
  { key: 'revenue',    label: 'Revenue',       fmt: eur,  kind: 'money'   },
  { key: 'roas',       label: 'ROAS',          fmt: mul,  kind: 'ratio'   },
  { key: 'purchases',  label: 'Acquisti',      fmt: num,  kind: 'count'   },
  { key: 'cpo',        label: 'CPO',           fmt: eur2, kind: 'money',  lower: true },
  { key: 'impressions',label: 'Impressioni',   fmt: num,  kind: 'count'   },
  { key: 'reach',      label: 'Copertura',     fmt: num,  kind: 'count'   },
  { key: 'frequency',  label: 'Frequenza',     fmt: v => v != null ? Number(v).toFixed(2) : '—', kind: 'ratio', lower: true },
  { key: 'cpm',        label: 'CPM',           fmt: eur2, kind: 'money',  lower: true },
  { key: 'ctr_link',   label: 'CTR link',      fmt: pct,  kind: 'percent' },
  { key: 'cpc_link',   label: 'CPC link',      fmt: eur2, kind: 'money',  lower: true },
  { key: 'link_clicks',label: 'Click link',    fmt: num,  kind: 'count'   },
]

const CHARTS = [
  { key: 'spend',     label: 'Spending',    fmt: eur  },
  { key: 'roas',      label: 'ROAS',        fmt: mul  },
  { key: 'cpo',       label: 'CPO',         fmt: eur2 },
  { key: 'ctr_link',  label: 'CTR link',    fmt: pct  },
  { key: 'cpm',       label: 'CPM',         fmt: eur2 },
  { key: 'frequency', label: 'Frequenza',   fmt: v => v != null ? Number(v).toFixed(2) : '—' },
  { key: 'reach',     label: 'Copertura',   fmt: num  },
]


export default function MetaKpiTab() {
  const [preset, setPreset] = useState('last_28d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = (force = false) => {
    let cancelled = false
    const key = `meta-kpi:${preset}`
    if (force) invalidate(key)
    const cached = !force ? getCached(key) : null
    if (cached) {
      setData(cached.data)
    } else {
      setLoading(true)
    }
    setError(null)
    swrFetch({
      key, forceRefresh: force,
      fetcher: () => fetch(`/api/meta-kpi?preset=${encodeURIComponent(preset)}`).then(r => r.json()),
      onUpdate: fresh => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => {
        if (cancelled) return
        if (j?.error && !j?.totals) setError(j.error)
        if (!cached || force) setData(j)
      })
      .catch(e => { if (!cancelled && !cached) setError(e?.message) })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [preset]) // eslint-disable-line react-hooks/exhaustive-deps

  const totals = data?.totals || {}
  const prevTotals = data?.prevTotals || {}
  const daily = Array.isArray(data?.daily) ? data.daily : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header: titolo + preset selector + Aggiorna */}
      <div className="glass-card-static" style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{
          width: 42, height: 42, borderRadius: 11,
          background: 'rgba(8,102,255,0.14)', color: '#2997ff',
          display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 800,
        }}>◎</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 9.5, color: '#2997ff', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Meta KPI
            </div>
            <PlatformBadges sources={['meta']} size={16} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 4, letterSpacing: '-0.02em' }}>
            Performance Meta Ads · {data?.range?.since} → {data?.range?.until}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={preset}
            onChange={e => setPreset(e.target.value)}
            style={{
              background: 'var(--glass)',
              border: '1px solid var(--border)',
              color: '#fff',
              borderRadius: 10,
              padding: '8px 14px',
              fontSize: 13, fontWeight: 700,
              outline: 'none',
              cursor: 'pointer',
              minWidth: 160,
            }}
          >
            {PRESETS.map(o => (
              <option key={o.value} value={o.value} style={{ background: '#0a0a14' }}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            style={{
              border: '1px solid var(--border)', background: 'var(--glass)',
              color: '#fff', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {loading ? 'Aggiorno…' : 'Aggiorna'}
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-card-static" style={{ padding: 18, color: '#fca5a5', fontSize: 13 }}>⚠ {error}</div>
      )}

      {loading && !data && (
        <div style={{ color: '#9b90aa', padding: 40, fontSize: 15, fontWeight: 700, textAlign: 'center' }}>
          Carico i KPI Meta…
        </div>
      )}

      {data && (
        <>
          {/* CARD KPI */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}>
            {KPIS.map(k => (
              <KpiCard key={k.key} kpi={k} value={totals[k.key]} prev={prevTotals[k.key]} />
            ))}
          </div>

          {/* GRAFICI SEPARATI */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: 16,
          }}>
            {CHARTS.map(c => (
              <SeparateChart key={c.key} chart={c} daily={daily} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Card KPI singola ─────────────────────────────────────────
function KpiCard({ kpi, value, prev }) {
  const v = Number(value || 0)
  const p = Number(prev || 0)
  const hasPrev = prev != null && Number.isFinite(p)
  const absDelta = hasPrev ? v - p : null
  const pctDelta = hasPrev && p !== 0 ? ((v - p) / Math.abs(p)) * 100 : null

  // Per metriche "lower is better" un calo (delta negativo) e' positivo.
  const isPositive = absDelta == null ? null
                   : kpi.lower ? absDelta < 0
                   : absDelta > 0

  const fmtAbs = (d) => {
    if (d == null) return ''
    const sign = d > 0 ? '+' : d < 0 ? '−' : ''
    const x = Math.abs(d)
    switch (kpi.kind) {
      case 'money':   return `${sign}€${x.toLocaleString('it-IT', { maximumFractionDigits: x < 100 ? 2 : 0 })}`
      case 'ratio':   return `${sign}${x.toFixed(2)}`
      case 'percent': return `${sign}${x.toFixed(2)} pp`
      case 'count':   return `${sign}${x.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`
      default:        return `${sign}${x.toFixed(2)}`
    }
  }

  return (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{
          fontSize: 10, color: 'var(--text3)', fontWeight: 800,
          letterSpacing: '0.10em', textTransform: 'uppercase',
        }}>
          {kpi.label}
        </div>
        <PlatformBadges sources={['meta']} size={14} />
      </div>
      <div style={{
        fontSize: 24, fontWeight: 900, color: '#fff',
        letterSpacing: '-0.02em',
      }}>
        {kpi.fmt(value)}
      </div>
      {hasPrev && Math.abs(absDelta) > 0.0001 && (
        <div style={{
          marginTop: 8,
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontWeight: 700,
          color: isPositive ? '#22c55e' : '#f87171',
        }}>
          <span>{absDelta > 0 ? '▲' : '▼'}</span>
          {pctDelta != null && (
            <span>{Math.abs(pctDelta).toFixed(1)}%</span>
          )}
          <span style={{ color: 'var(--text3)', fontWeight: 600 }}>·</span>
          <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{fmtAbs(absDelta)}</span>
        </div>
      )}
      {hasPrev && Math.abs(absDelta) <= 0.0001 && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
          = periodo precedente
        </div>
      )}
    </div>
  )
}

// ── Singolo grafico separato ─────────────────────────────────
function SeparateChart({ chart, daily }) {
  const series = daily.map(d => ({
    date: (d.date || '').slice(5),
    v: d[chart.key] ?? 0,
  }))

  return (
    <div className="glass-card-static" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Andamento
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 3 }}>{chart.label}</div>
        </div>
        <PlatformBadges sources={['meta']} size={16} />
      </div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series}>
            <defs>
              <linearGradient id={`grad-${chart.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#ffffff" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} width={50} />
            <Tooltip
              contentStyle={{ background: 'rgba(10,10,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, fontSize: 11 }}
              formatter={v => [chart.fmt(v), chart.label]}
            />
            <Area type="monotone" dataKey="v" stroke="#ffffff" fill={`url(#grad-${chart.key})`} strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
