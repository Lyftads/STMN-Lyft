'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { swrFetch, getCached } from '../../lib/clientCache'

// ─────────────────────────────────────────────────────────────
//  Meta Audit 360° Tab
//  Aggrega gli adset attivi su 3 segmenti di pubblico esatti:
//    - Nuovo pubblico (Prospecting)
//    - Pubblico che ha interagito (Retargeting)
//    - Clienti esistenti (Retention)
//
//  Tabella: KPI × 3 segmenti + Totale (somma per spesa/acquisti/revenue,
//  media ponderata per ROAS/CPO/CPM/CTR/CPC).
//  Sotto: grafico daily con 3 linee + selettore metrica.
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
  { key: 'spend',     label: 'Spesa',    agg: 'sum',   fmt: v => `€${Math.round(v).toLocaleString('it-IT')}`,         color: '#2997ff' },
  { key: 'revenue',   label: 'Revenue',  agg: 'sum',   fmt: v => `€${Math.round(v).toLocaleString('it-IT')}`,         color: '#22c55e' },
  { key: 'purchases', label: 'Acquisti', agg: 'sum',   fmt: v => Math.round(v).toLocaleString('it-IT'),                color: '#a78bfa' },
  { key: 'roas',      label: 'ROAS',     agg: 'ratio', fmt: v => v > 0 ? `${(+v).toFixed(2)}x` : '—',                  color: '#fbbf24' },
  { key: 'cpo',       label: 'CPO',      agg: 'ratio', fmt: v => v != null && v > 0 ? `€${(+v).toFixed(2)}` : '—',     color: '#bf5af2' },
  { key: 'cpm',       label: 'CPM',      agg: 'ratio', fmt: v => v > 0 ? `€${(+v).toFixed(2)}` : '—',                  color: '#06b6d4' },
  { key: 'ctr_link',  label: 'CTR link', agg: 'ratio', fmt: v => v > 0 ? `${(+v).toFixed(2)}%` : '—',                  color: '#f97316' },
  { key: 'cpc_link',  label: 'CPC link', agg: 'ratio', fmt: v => v != null && v > 0 ? `€${(+v).toFixed(2)}` : '—',     color: '#84cc16' },
]

// Estrae il valore aggregato di una metrica dal bucket di categoria.
// Per ROAS / CPO / CPM / CTR / CPC fa il rapporto sui totali (medie
// ponderate), non la media dei singoli giorni.
function cellValue(metricKey, m) {
  if (!m) return 0
  const linkClicks = m.link_clicks || m.linkClicks || 0
  switch (metricKey) {
    case 'spend':     return m.spend || 0
    case 'revenue':   return m.revenue || 0
    case 'purchases': return m.purchases || 0
    case 'roas':      return m.spend > 0 ? m.revenue / m.spend : 0
    case 'cpo':       return m.purchases > 0 ? m.spend / m.purchases : null
    case 'cpm':       return m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0
    case 'ctr_link':  return m.impressions > 0 ? (linkClicks / m.impressions) * 100 : 0
    case 'cpc_link':  return linkClicks > 0 ? m.spend / linkClicks : null
    default:          return 0
  }
}

export default function MetaAuditTab() {
  const [preset, setPreset] = useState('last_28d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeMetric, setActiveMetric] = useState('roas')

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
      fetcher: () => fetch(`/api/meta-audit/strategy?preset=${encodeURIComponent(preset)}`).then(r => r.json()),
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
            Performance per segmento di pubblico · {data?.adsetsAnalyzed || 0} adset
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
            Aggregazione per Nuovo pubblico · Pubblico che ha interagito · Clienti esistenti.
            Somma per spesa/acquisti/revenue, media ponderata per ROAS/CPO/CPM/CTR/CPC.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PRESET_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => setPreset(o.value)}
              className="btn-glass"
              style={{
                border: preset === o.value ? '1px solid #2997ff' : '1px solid var(--border)',
                background: preset === o.value ? 'rgba(41,151,255,0.13)' : 'var(--glass)',
                color: preset === o.value ? '#7dd3fc' : 'var(--text3)',
                borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {o.label.replace('Ultimi ', '')}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="glass-card-static" style={{ padding: 18, color: '#fca5a5', fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ color: '#9b90aa', padding: 40, fontSize: 15, fontWeight: 700, textAlign: 'center' }}>
          Un attimo, sto leggendo audiences e adset di Meta… (può richiedere 20-40 secondi su account grandi)
        </div>
      )}

      {data && (
        <>
          <AggregateTable cats={cats} total={total} activeMetric={activeMetric} onMetricClick={setActiveMetric} />
          <TrendCharts cats={cats} activeMetric={activeMetric} onMetricChange={setActiveMetric} />
        </>
      )}
    </div>
  )
}

// ── Tabella aggregata: righe = KPI, colonne = 3 segmenti + Totale ──
function AggregateTable({ cats, total, activeMetric, onMetricClick }) {
  const cols = Object.values(cats)
  return (
    <div className="glass-card-static" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>KPI</th>
              {cols.map(c => (
                <th key={c.id} style={{ ...th, color: c.color, textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />
                    {c.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginTop: 2, textAlign: 'right' }}>
                    {c.adsetCount} adset
                  </div>
                </th>
              ))}
              <th style={{ ...th, textAlign: 'right', color: '#fff' }}>Totale</th>
            </tr>
          </thead>
          <tbody>
            {TREND_METRICS.map(metric => (
              <tr
                key={metric.key}
                onClick={() => onMetricClick(metric.key)}
                style={{
                  cursor: 'pointer',
                  background: activeMetric === metric.key ? `${metric.color}10` : 'transparent',
                  transition: 'background .15s',
                }}
              >
                <td style={tdLabel}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 3, height: 16, borderRadius: 2, background: metric.color }} />
                    <span style={{ color: '#fff', fontWeight: 700 }}>{metric.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text4, #555)', fontWeight: 600 }}>
                      {metric.agg === 'sum' ? '(somma)' : '(media)'}
                    </span>
                  </div>
                </td>
                {cols.map(c => (
                  <td key={c.id} style={tdNum}>
                    {metric.fmt(cellValue(metric.key, c.metrics))}
                  </td>
                ))}
                <td style={{ ...tdNum, color: '#fff', fontWeight: 800 }}>
                  {metric.fmt(cellValue(metric.key, total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text4, #666)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        Click su una riga per selezionare la metrica nel grafico sotto.
      </div>
    </div>
  )
}

const th = {
  textAlign: 'left', padding: '14px 16px', fontSize: 10.5, fontWeight: 800,
  letterSpacing: '0.10em', textTransform: 'uppercase',
  color: 'var(--text3)', borderBottom: '1px solid rgba(255,255,255,0.06)',
  whiteSpace: 'nowrap',
}
const tdLabel = {
  padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
}
const tdNum = {
  padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)',
  fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.88)', fontWeight: 600,
}

// ── Grafico unificato: 1 line chart con 3 linee (1 per segmento) ──
function TrendCharts({ cats, activeMetric, onMetricChange }) {
  const metricInfo = TREND_METRICS.find(t => t.key === activeMetric) || TREND_METRICS[0]
  const cols = Object.values(cats)

  // Asse comune: tutti i giorni presenti in almeno 1 categoria
  const allDates = new Set()
  cols.forEach(c => (c.trend || []).forEach(t => allDates.add(t.date)))
  const dates = Array.from(allDates).sort()

  // chartData: una entry per giorno, una colonna per categoria
  const chartData = dates.map(d => {
    const row = { date: d.slice(5) }
    cols.forEach(c => {
      const point = (c.trend || []).find(t => t.date === d)
      row[c.id] = point ? (point[activeMetric] ?? 0) : 0
    })
    return row
  })

  return (
    <div className="glass-card-static" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 10.5, color: metricInfo.color, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Trend {metricInfo.label}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 4 }}>
            Andamento daily per segmento
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TREND_METRICS.map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => onMetricChange(m.key)}
              className="btn-glass"
              style={{
                border: activeMetric === m.key ? `1px solid ${m.color}` : '1px solid var(--border)',
                background: activeMetric === m.key ? `${m.color}1c` : 'var(--glass)',
                color: activeMetric === m.key ? '#fff' : 'var(--text3)',
                borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text3)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} />
            <Tooltip
              contentStyle={{ background: 'rgba(10,10,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, fontSize: 12 }}
              formatter={(v, name) => [metricInfo.fmt(v), cats[name]?.label || name]}
            />
            {cols.map(c => (
              <Line key={c.id} type="monotone" dataKey={c.id} stroke={c.color} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
        {cols.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 16, height: 3, borderRadius: 2, background: c.color }} />
            <span style={{ color: 'rgba(255,255,255,0.85)' }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
