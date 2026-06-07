'use client'

import { useEffect, useMemo, useState } from 'react'
import Icon from './ui/Icon'
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import { PlatformBadges } from './PlatformIcon'

// ─────────────────────────────────────────────────────────────
//  Forecast — proiezione revenue + spesa + MER (stile Triple Whale Forecast)
//  - Card riassuntive (proiezione revenue, spend, MER, delta vs ultimo periodo)
//  - Grafico revenue: history + forecast con banda di confidenza
//  - Grafico spend: history + forecast
// ─────────────────────────────────────────────────────────────

const HORIZONS = [
  { value: 30, label: 'Prossimi 30 giorni' },
  { value: 60, label: 'Prossimi 60 giorni' },
  { value: 90, label: 'Prossimi 90 giorni' },
]

const eur = v => v != null ? `€${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '—'
const mul = v => v != null && v > 0 ? `${Number(v).toFixed(2)}x` : '—'

export default function ForecastTab() {
  const [horizon, setHorizon] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = (force = false) => {
    let cancelled = false
    const key = `forecast:${horizon}`
    if (force) invalidate(key)
    const cached = !force ? getCached(key) : null
    if (cached) setData(cached.data); else setLoading(true)
    setError(null)
    swrFetch({
      key, forceRefresh: force,
      fetcher: () => fetch(`/api/forecast?horizon=${horizon}`).then(r => r.json()),
      onUpdate: fresh => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => { if (!cancelled) { if (j?.error) setError(j.error); setData(j) } })
      .catch(e => { if (!cancelled && !cached) setError(e?.message) })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }

  useEffect(() => { return load() }, [horizon]) // eslint-disable-line react-hooks/exhaustive-deps

  const summary = data?.summary || {}
  const history = Array.isArray(data?.history) ? data.history : []
  const forecast = Array.isArray(data?.forecast) ? data.forecast : []

  // Merge history+forecast in un singolo dataset per il grafico continuo
  const chartData = useMemo(() => {
    const h = history.map(d => ({
      date: (d.date || '').slice(5),
      revenue_history: d.revenue,
      spend_history: d.spend,
    }))
    const f = forecast.map(d => ({
      date: (d.date || '').slice(5),
      revenue_forecast: d.revenue,
      revenue_band: [d.revenue_low, d.revenue_high],
      spend_forecast: d.spend,
      spend_band: [d.spend_low, d.spend_high],
    }))
    return [...h, ...f]
  }, [history, forecast])

  const lastHistoryDate = history.length > 0 ? (history[history.length - 1].date || '').slice(5) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="glass-card-static" style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{
          width: 42, height: 42, borderRadius: 11,
          background: 'rgba(34,197,94,0.14)', color: '#22c55e',
          display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 800,
        }}>↗</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 9.5, color: '#22c55e', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Forecast
            </div>
            <PlatformBadges sources={['meta', 'shopify']} size={14} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 4, letterSpacing: '-0.02em' }}>
            Proiezione revenue · spesa · MER · {data?.history_days || 90}gg storia → {horizon}gg futuro
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={horizon}
            onChange={e => setHorizon(parseInt(e.target.value, 10))}
            style={{
              background: 'var(--glass)', border: '1px solid var(--border)',
              color: '#fff', borderRadius: 10, padding: '8px 14px',
              fontSize: 13, fontWeight: 700, outline: 'none', cursor: 'pointer',
              minWidth: 180,
            }}
          >
            {HORIZONS.map(o => <option key={o.value} value={o.value} style={{ background: '#0a0a14' }}>{o.label}</option>)}
          </select>
          <button
            type="button" onClick={() => load(true)} disabled={loading}
            style={{
              border: '1px solid var(--border)', background: 'var(--glass)',
              color: '#fff', borderRadius: 10, padding: '8px 14px',
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

      {error && <div className="glass-card-static" style={{ padding: 18, color: '#fca5a5', fontSize: 13 }}><Icon name="warning" size={13} /> {error}</div>}
      {data?.warning && <div className="glass-card-static" style={{ padding: 18, color: '#fbbf24', fontSize: 13 }}>{data.warning}</div>}

      {loading && !data && (
        <div style={{ color: '#9b90aa', padding: 40, fontSize: 15, fontWeight: 700, textAlign: 'center' }}>
          Calcolo proiezione…
        </div>
      )}

      {data && summary && (
        <>
          {/* SUMMARY CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <ForecastCard label={`Revenue proiettato (${horizon}gg)`} value={eur(summary.projected_revenue)} delta={summary.revenue_change_pct} />
            <ForecastCard label={`Spesa proiettata (${horizon}gg)`} value={eur(summary.projected_spend)} />
            <ForecastCard label="MER proiettato" value={mul(summary.projected_mer)} />
            <ForecastCard label={`Revenue ultimi ${horizon}gg`} value={eur(summary.last_period_revenue)} muted />
          </div>

          {/* REVENUE CHART */}
          <div className="glass-card-static" style={{ padding: 22 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
              Revenue Shopify
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 14 }}>
              Storia + Forecast (banda confidenza ±2σ)
            </div>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="band-revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor="#22c55e" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} width={60} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(10,10,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, fontSize: 11 }}
                    formatter={(v, name) => {
                      if (Array.isArray(v)) return [`${eur(v[0])} – ${eur(v[1])}`, 'Banda']
                      const labels = {
                        revenue_history: 'Revenue (storico)',
                        revenue_forecast: 'Revenue (forecast)',
                      }
                      return [eur(v), labels[name] || name]
                    }}
                  />
                  {lastHistoryDate && <ReferenceLine x={lastHistoryDate} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 3" label={{ value: 'Oggi', fill: 'var(--text3)', fontSize: 10, position: 'top' }} />}
                  <Area type="monotone" dataKey="revenue_band" stroke="none" fill="url(#band-revenue)" />
                  <Line type="monotone" dataKey="revenue_history" stroke="#ffffff" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="revenue_forecast" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SPEND CHART */}
          <div className="glass-card-static" style={{ padding: 22 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
              Spesa Meta Ads
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 14 }}>
              Storia + Forecast
            </div>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="band-spend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} width={60} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(10,10,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, fontSize: 11 }}
                    formatter={(v, name) => {
                      if (Array.isArray(v)) return [`${eur(v[0])} – ${eur(v[1])}`, 'Banda']
                      const labels = {
                        spend_history: 'Spesa (storico)',
                        spend_forecast: 'Spesa (forecast)',
                      }
                      return [eur(v), labels[name] || name]
                    }}
                  />
                  {lastHistoryDate && <ReferenceLine x={lastHistoryDate} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 3" />}
                  <Area type="monotone" dataKey="spend_band" stroke="none" fill="url(#band-spend)" />
                  <Line type="monotone" dataKey="spend_history" stroke="#ffffff" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="spend_forecast" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ForecastCard({ label, value, delta, muted }) {
  return (
    <div className="glass-card" style={{ padding: '16px 18px', opacity: muted ? 0.7 : 1 }}>
      <div style={{
        fontSize: 10, color: 'var(--text3)', fontWeight: 800,
        letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 10,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {delta != null && Number.isFinite(delta) && Math.abs(delta) > 0.1 && (
        <div style={{
          marginTop: 8, fontSize: 11, fontWeight: 700,
          color: delta > 0 ? '#22c55e' : '#f87171',
        }}>
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% vs storia equivalente
        </div>
      )}
    </div>
  )
}
