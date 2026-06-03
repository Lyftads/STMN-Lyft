'use client'

import { useEffect, useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { swrFetch, getCached } from '../../lib/clientCache'

// ─────────────────────────────────────────────────────────────
//  Meta Audit 360° Tab
//  Classifica adset attivi in 4 strategy bucket (Prospecting,
//  Re-Engagement, Retargeting, Retention) e mostra metriche + trend.
//
//  Endpoint: /api/meta-audit/strategy?preset=X
// ─────────────────────────────────────────────────────────────

const PRESET_OPTIONS = [
  { value: 'last_7d',  label: 'Ultimi 7 giorni' },
  { value: 'last_14d', label: 'Ultimi 14 giorni' },
  { value: 'last_28d', label: 'Ultimi 28 giorni' },
  { value: 'last_30d', label: 'Ultimi 30 giorni' },
  { value: 'last_90d', label: 'Ultimi 90 giorni' },
]

const TREND_METRICS = [
  { key: 'spend',    label: 'Spesa',       fmt: v => `€${Math.round(v).toLocaleString('it-IT')}`,    color: '#2997ff' },
  { key: 'revenue',  label: 'Revenue',     fmt: v => `€${Math.round(v).toLocaleString('it-IT')}`,    color: '#22c55e' },
  { key: 'roas',     label: 'ROAS',        fmt: v => `${(+v).toFixed(2)}x`,                          color: '#fbbf24' },
  { key: 'cpo',      label: 'CPO',         fmt: v => v != null ? `€${(+v).toFixed(2)}` : '—',         color: '#bf5af2' },
  { key: 'cac',      label: 'CAC',         fmt: v => v != null ? `€${(+v).toFixed(2)}` : '—',         color: '#ec4899' },
  { key: 'cpm',      label: 'CPM',         fmt: v => `€${(+v).toFixed(2)}`,                          color: '#06b6d4' },
  { key: 'ctr_link', label: 'CTR link',    fmt: v => `${(+v).toFixed(2)}%`,                          color: '#f97316' },
  { key: 'cpc_link', label: 'CPC link',    fmt: v => v != null ? `€${(+v).toFixed(2)}` : '—',         color: '#84cc16' },
]

export default function MetaAuditTab() {
  const [preset, setPreset] = useState('last_28d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeMetric, setActiveMetric] = useState('roas')
  const [openCats, setOpenCats] = useState({ acquisition_prospecting: true })

  useEffect(() => {
    let cancelled = false
    const key = `meta-audit:${preset}`
    const cached = getCached(key)
    if (cached) {
      setData(cached.data)
    } else {
      setLoading(true)
    }
    setError(null)
    swrFetch({
      key,
      fetcher: () => fetch(`/api/meta-audit/strategy?preset=${encodeURIComponent(preset)}`)
        .then(r => r.json()),
      onUpdate: fresh => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => {
        if (cancelled) return
        if (j?.error && !j?.categories) setError(j.error)
        if (!cached) setData(j)
      })
      .catch(e => { if (!cancelled && !cached) setError(e?.message) })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }, [preset])

  const cats = data?.categories || {}
  const total = data?.total

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header + preset selector */}
      <div className="glass-card-static" style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{
          width: 42, height: 42, borderRadius: 11,
          background: 'rgba(8,102,255,0.14)', color: '#2997ff',
          display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 800,
        }}>◎</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 9.5, color: '#2997ff', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            Meta Audit 360°
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 4, letterSpacing: '-0.02em' }}>
            Strategy breakdown · {data?.adsetsAnalyzed || 0} adset analizzati
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
            Classificazione automatica per targeting (custom audiences, lookalike, broad).
            {data?.audiencesAnalyzed > 0 && ` ${data.audiencesAnalyzed} audiences scansionate.`}
          </div>
        </div>
        <select
          value={preset}
          onChange={e => setPreset(e.target.value)}
          style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            outline: 'none', cursor: 'pointer',
          }}
        >
          {PRESET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Errore */}
      {error && (
        <div className="glass-card-static" style={{ padding: 18, color: '#fca5a5', fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* Loading initial */}
      {loading && !data && (
        <div className="glass-card-static" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
          Sto leggendo audiences e adset di Meta… (può richiedere 20-40 secondi su account grandi)
        </div>
      )}

      {/* Total summary */}
      {data && total && (
        <TotalSummary total={total} />
      )}

      {/* Metric selector */}
      {data && (
        <div className="glass-card-static" style={{ padding: 18 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
            Metrica grafici
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TREND_METRICS.map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => setActiveMetric(m.key)}
                style={{
                  padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                  background: activeMetric === m.key ? `${m.color}28` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${activeMetric === m.key ? m.color : 'rgba(255,255,255,0.10)'}`,
                  color: activeMetric === m.key ? '#fff' : 'var(--text3)',
                  fontSize: 12, fontWeight: 700,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Per categoria */}
      {data && Object.values(cats).map(cat => (
        <CategoryBlock
          key={cat.id}
          cat={cat}
          open={!!openCats[cat.id]}
          toggle={() => setOpenCats(p => ({ ...p, [cat.id]: !p[cat.id] }))}
          activeMetric={activeMetric}
        />
      ))}
    </div>
  )
}

// ── Totale top summary ─────────────────────────────────────────
function TotalSummary({ total }) {
  const cards = [
    { label: 'Spesa totale', value: `€${Math.round(total.spend).toLocaleString('it-IT')}`, color: '#2997ff' },
    { label: 'Revenue',      value: `€${Math.round(total.revenue).toLocaleString('it-IT')}`, color: '#22c55e' },
    { label: 'ROAS',         value: total.roas ? `${total.roas.toFixed(2)}x` : '—', color: '#fbbf24' },
    { label: 'Acquisti',     value: total.purchases.toLocaleString('it-IT'), color: '#bf5af2' },
    { label: 'CPO',          value: total.cpp != null ? `€${total.cpp.toFixed(2)}` : '—', color: '#ec4899' },
    { label: 'CPM',          value: total.cpm ? `€${total.cpm.toFixed(2)}` : '—', color: '#06b6d4' },
    { label: 'CTR',          value: total.ctr ? `${total.ctr.toFixed(2)}%` : '—', color: '#f97316' },
  ]
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))`,
      gap: 12,
    }}>
      {cards.map(c => (
        <div key={c.label} className="glass-card-static" style={{ padding: 16 }}>
          <div style={{ fontSize: 9.5, color: c.color, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            {c.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 6, letterSpacing: '-0.02em' }}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Categoria block: header strip + grande chart sulla metrica selezionata + mini metric strip
function CategoryBlock({ cat, open, toggle, activeMetric }) {
  const m = cat.metrics
  const metricInfo = TREND_METRICS.find(t => t.key === activeMetric) || TREND_METRICS[0]
  const chartData = (cat.trend || []).map(t => ({
    date: t.date.slice(5), // MM-DD
    value: t[activeMetric] ?? 0,
  }))

  return (
    <div className="glass-card-static" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header riga clickable */}
      <button
        type="button"
        onClick={toggle}
        style={{
          width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 20, textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}
      >
        <span style={{
          width: 12, height: 12, borderRadius: 4, background: cat.color, flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
            {cat.label}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            {cat.adsetCount} adset · €{Math.round(m.spend).toLocaleString('it-IT')} spesi
          </div>
        </div>
        {/* Mini KPIs in header */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <MiniKpi label="ROAS"     value={m.roas ? `${m.roas.toFixed(2)}x` : '—'} color="#fbbf24" />
          <MiniKpi label="Acquisti" value={m.purchases.toLocaleString('it-IT')} color="#22c55e" />
          <MiniKpi label="CPO"      value={m.cpp != null ? `€${m.cpp.toFixed(2)}` : '—'} color="#bf5af2" />
          <MiniKpi label="CPM"      value={m.cpm ? `€${m.cpm.toFixed(2)}` : '—'} color="#06b6d4" />
          <MiniKpi label="CTR"      value={m.ctr ? `${m.ctr.toFixed(2)}%` : '—'} color="#f97316" />
        </div>
        <span style={{ color: 'var(--text3)', fontSize: 16, transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform .25s' }}>›</span>
      </button>

      {/* Body: grande chart + altri sparkline */}
      {open && (
        <div style={{ padding: '0 22px 22px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ paddingTop: 18 }}>
            <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 12 }}>
              {metricInfo.label} — trend daily
            </div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`grad-${cat.id}-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={metricInfo.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={metricInfo.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(10,10,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, fontSize: 12 }}
                    formatter={(v) => [metricInfo.fmt(v), metricInfo.label]}
                  />
                  <Area type="monotone" dataKey="value" stroke={metricInfo.color} fill={`url(#grad-${cat.id}-${activeMetric})`} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sparkline grid per le altre 7 metriche */}
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 10 }}>
              Tutte le metriche
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12,
            }}>
              {TREND_METRICS.map(t => (
                <Sparkline key={t.key} cat={cat} metric={t} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MiniKpi({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 9, color, fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 2 }}>{value}</div>
    </div>
  )
}

function Sparkline({ cat, metric }) {
  const data = (cat.trend || []).map(t => ({ date: t.date.slice(5), value: t[metric.key] ?? 0 }))
  const last = data.length > 0 ? data[data.length - 1].value : 0
  return (
    <div className="glass-panel" style={{ borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: metric.color, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
          {metric.label}
        </span>
        <span style={{ fontSize: 13, color: '#fff', fontWeight: 800 }}>
          {metric.fmt(last)}
        </span>
      </div>
      <div style={{ height: 50 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="monotone" dataKey="value" stroke={metric.color} dot={false} strokeWidth={1.5} />
            <Tooltip
              contentStyle={{ background: 'rgba(10,10,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, fontSize: 11 }}
              formatter={(v) => [metric.fmt(v), metric.label]}
              labelFormatter={(l) => `Giorno ${l}`}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
