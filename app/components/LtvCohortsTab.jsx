'use client'

import { useEffect, useState } from 'react'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import FxCard from './ui/FxCard'

const eur = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`)
const eur2 = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const nf = (n) => Number(n || 0).toLocaleString('it-IT')

const WINDOWS = [
  { value: 6, label: '6 mesi' },
  { value: 12, label: '12 mesi' },
  { value: 18, label: '18 mesi' },
  { value: 24, label: '24 mesi' },
]

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
function cohortLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return `${MONTH_LABELS[m - 1]} ${String(y).slice(2)}`
}
// Colore cella retention: scala verde su sfondo nero
function cellBg(pct) {
  if (pct == null) return 'transparent'
  const a = 0.06 + (Math.min(100, pct) / 100) * 0.62
  return `rgba(48,209,88,${a.toFixed(3)})`
}
function cellText(pct) {
  if (pct == null) return 'var(--text3)'
  return pct >= 45 ? '#04130a' : 'var(--text)'
}

export default function LtvCohortsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [months, setMonths] = useState(12)

  const load = (force = false) => {
    let cancelled = false
    const key = `ltv-cohorts:${months}`
    if (force) invalidate(key)
    const cached = !force ? getCached(key) : null
    if (cached) setData(cached.data)
    else setLoading(true)
    setError(null)
    swrFetch({
      key, forceRefresh: force,
      fetcher: () => fetch(`/api/ltv-cohorts?months=${months}`).then(r => r.json()),
      onUpdate: (fresh) => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => {
        if (cancelled) return
        if (j?.error && !j?.summary) setError(j.error)
        if (!cached || force) setData(j)
      })
      .catch(e => { if (!cancelled && !cached) setError(e?.message || 'Errore di rete') })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }

  useEffect(() => { const c = load(); return c }, [months]) // eslint-disable-line react-hooks/exhaustive-deps

  const s = data?.summary || {}
  const cohorts = data?.cohorts || []
  const maxOffset = data?.maxOffset ?? 12
  const ltvCurve = (data?.ltvCurve || []).filter(d => d.value != null).map(d => ({ m: `M${d.m}`, value: d.value }))
  const retentionAvg = (data?.retentionAvg || []).filter(d => d.pct != null).map(d => ({ m: `M${d.m}`, pct: d.pct }))

  const Stat = ({ label, value, sub }) => (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>{label}</div>
      <div className="metric-value-sm" style={{ color: 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ marginTop: 24 }}>
      <FxCard title="LTV & Coorti" subtitle="Retention per coorte di acquisizione · repeat rate · tempo al 2° ordine · curva LTV cumulata" delay={1.6}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {WINDOWS.map(w => (
              <button key={w.value} onClick={() => setMonths(w.value)} className="btn-glass"
                style={{ padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 12, opacity: months === w.value ? 1 : 0.55, borderColor: months === w.value ? 'var(--accent)' : undefined }}>
                {w.label}
              </button>
            ))}
          </div>
          <button onClick={() => load(true)} disabled={loading} className="btn-glass" style={{ padding: '8px 14px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {loading ? 'Carico…' : 'Aggiorna'}
          </button>
        </div>

        {loading && !data && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '18px 0' }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> Calcolo coorti e LTV…</div>}
        {!loading && error && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>{error}</div>}
        {!loading && !error && data && !(s.customers > 0) && <div style={{ color: 'var(--text2)', fontSize: 13, padding: '12px 0' }}>Nessun cliente nel periodo selezionato.</div>}

        {s.customers > 0 && (
          <>
            <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12, margin: '8px 0 20px' }}>
              <Stat label="Clienti totali" value={nf(s.customers)} sub={`${nf(s.ordersTotal)} ordini`} />
              <Stat label="Repeat rate" value={`${s.repeatRate}%`} sub={`${nf(s.repeatCustomers)} con ≥2 ordini`} />
              <Stat label="LTV medio" value={eur2(s.avgLtv)} sub="ricavo medio per cliente" />
              <Stat label="Ordini / cliente" value={s.avgOrders} />
              <Stat label="Tempo al 2° ordine" value={s.medianDaysTo2nd > 0 ? `${s.medianDaysTo2nd} gg` : '—'} sub="mediana" />
              <Stat label="Fatturato coorti" value={eur(s.revenueTotal)} />
            </div>

            {/* Heatmap retention per coorte */}
            <div className="glass-card-static" style={{ padding: 18, borderRadius: 16, marginBottom: 20, overflowX: 'auto' }}>
              <div className="label" style={{ marginBottom: 12 }}>Retention per coorte · % di clienti che riordinano (M0 = mese di acquisizione)</div>
              <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 11, minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text3)', fontWeight: 800, fontSize: 10 }}>Coorte</th>
                    <th style={{ padding: '4px 6px', color: 'var(--text3)', fontWeight: 800, fontSize: 10 }}>Clienti</th>
                    {Array.from({ length: maxOffset + 1 }, (_, k) => (
                      <th key={k} style={{ padding: '4px 6px', color: 'var(--text3)', fontWeight: 800, fontSize: 10, minWidth: 42 }}>M{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map(c => (
                    <tr key={c.cohort}>
                      <td style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text)', fontWeight: 700, whiteSpace: 'nowrap' }}>{cohortLabel(c.cohort)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--text2)', fontWeight: 700 }}>{nf(c.size)}</td>
                      {c.retention.map(cell => (
                        <td key={cell.m} title={cell.pct != null ? `${cell.pct}% · ${nf(cell.active)} clienti` : ''}
                          style={{ padding: '6px 4px', textAlign: 'center', borderRadius: 6, fontWeight: 800, background: cellBg(cell.pct), color: cellText(cell.pct) }}>
                          {cell.pct == null ? '' : `${cell.pct}%`}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Curve LTV + retention media */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px,1fr))', gap: 16 }}>
              <div className="glass-card-static reveal-zoom" style={{ padding: 18, borderRadius: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>Curva LTV cumulata (media per cliente)</div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={ltvCurve} margin={{ top: 6, right: 10, left: -6, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ltvGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#30d158" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#30d158" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="m" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => eur2(v)} />
                    <Area type="monotone" dataKey="value" stroke="#30d158" strokeWidth={2} fill="url(#ltvGrad)" animationDuration={1400} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card-static reveal-zoom" style={{ padding: 18, borderRadius: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>Retention media per mese dall'acquisizione</div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={retentionAvg} margin={{ top: 6, right: 10, left: -6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="m" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => `${v}%`} />
                    <Line type="monotone" dataKey="pct" stroke="#2997ff" strokeWidth={2} dot={{ r: 3, fill: '#2997ff' }} animationDuration={1400} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {data?.truncated && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 14 }}>⚠ Dataset ampio: analisi basata sugli ordini più recenti del periodo (troncato per performance).</div>
            )}
          </>
        )}
      </FxCard>
    </div>
  )
}
