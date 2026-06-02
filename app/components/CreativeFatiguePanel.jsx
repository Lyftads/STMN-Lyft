'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import FxCard from './ui/FxCard'
import TimeframeSelector from './TimeframeSelector'

function DeltaBadge({ d, lowerBetter = false }) {
  if (!d || d.pct == null) return null
  const up = d.pct > 0, good = lowerBetter ? !up : up
  return <span style={{ fontSize: 10, fontWeight: 800, marginLeft: 6, color: good ? 'var(--green)' : 'var(--red)' }}>{up ? '▲' : '▼'} {Math.abs(d.pct).toFixed(1)}%</span>
}

const SEV = {
  high: { color: 'var(--red)', bg: 'rgba(255,69,58,0.14)', label: 'DA RINFRESCARE' },
  medium: { color: 'var(--orange)', bg: 'rgba(255,159,10,0.14)', label: 'OSSERVA' },
  low: { color: 'var(--green)', bg: 'rgba(48,209,88,0.14)', label: 'OK' },
}

const money = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`)
const nf = (n) => Number(n || 0).toLocaleString('it-IT')

export default function CreativeFatiguePanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [account, setAccount] = useState('')
  const [preset, setPreset] = useState('last_28d')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    fetch(`/api/creative-fatigue?preset=${encodeURIComponent(preset)}${account ? `&account=${encodeURIComponent(account)}` : ''}`)
      .then(r => r.json())
      .then(j => { if (!cancelled) { if (j.error && !(j.ads?.length)) setError(j.error); setData(j) } })
      .catch(e => { if (!cancelled) setError(e?.message || 'Errore di rete') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [account, preset])

  const delta = data?.delta || {}
  const chartData = (data?.ads || []).slice(0, 10).map(a => ({ name: (a.name || '').slice(0, 12), score: a.score, sev: a.severity }))

  const accounts = data?.accounts || []

  const ads = data?.ads || []
  const maxScore = Math.max(...ads.map(a => a.score || 0), 1)
  const avgCtr = data?.avgCtr || 0
  const avgCpa = data?.avgCpa || 0
  const shown = showAll ? ads : ads.slice(0, 12)

  const freqTone = (f) => (f >= 5 ? 'var(--red)' : f >= 3 ? 'var(--orange)' : 'var(--text)')
  const ctrTone = (c) => (avgCtr > 0 && c < avgCtr * 0.8 ? 'var(--red)' : avgCtr > 0 && c < avgCtr ? 'var(--orange)' : 'var(--text)')
  const cpaTone = (c) => (c == null ? 'var(--text3)' : avgCpa > 0 && c > avgCpa * 1.3 ? 'var(--red)' : avgCpa > 0 && c > avgCpa ? 'var(--orange)' : 'var(--text)')

  const Stat = ({ label, value, tone, d, lowerBetter }) => (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>{label}</div>
      <div className="metric-value-sm" style={{ color: tone || 'var(--text)' }}>{value}<DeltaBadge d={d} lowerBetter={lowerBetter} /></div>
    </div>
  )

  return (
    <div style={{ marginTop: 24 }}>
      <FxCard title="Creative Fatigue" subtitle="Ultimi 28 giorni · frequency↑ · CTR↓ vs media · CPA↑ vs media" delay={1.8}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <TimeframeSelector value={preset} onChange={setPreset} disabled={loading} />
          {accounts.length > 1 && (
            <select value={account} onChange={(e) => setAccount(e.target.value)} className="btn-glass" style={{ padding: '9px 12px', fontWeight: 600, cursor: 'pointer', maxWidth: 280 }}>
              <option value="" style={{ background: 'var(--surface)' }}>Tutti gli account</option>
              {accounts.map(a => <option key={a.id} value={a.id} style={{ background: 'var(--surface)' }}>{a.name}</option>)}
            </select>
          )}
        </div>
        {loading && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '18px 0' }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> Analizzo le creative attive…</div>}
        {!loading && error && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>{error}</div>}
        {!loading && !error && ads.length === 0 && <div style={{ color: 'var(--text2)', fontSize: 13, padding: '12px 0' }}>Nessuna creativa con dati sufficienti nel periodo.</div>}

        {ads.length > 0 && (
          <>
            <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, margin: '16px 0 20px' }}>
              <Stat label="Creative analizzate" value={nf(data.total)} />
              <Stat label="Da rinfrescare" value={nf(data.toRefresh)} tone={data.toRefresh > 0 ? 'var(--red)' : 'var(--green)'} />
              <Stat label="CTR medio" value={`${avgCtr}%`} d={delta.ctr} />
              <Stat label="CPA medio" value={money(avgCpa)} d={delta.cpa} lowerBetter />
            </div>

            <div className="stagger" style={{ display: 'grid', gap: 8 }}>
              {shown.map((a) => {
                const s = SEV[a.severity] || SEV.low
                return (
                  <div key={a.adId} className="glass-card-static" style={{ padding: 12, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Thumbnail della creativa */}
                    <div style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 10, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center' }}>
                      {a.thumbnail
                        ? <img src={a.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { e.target.style.display = 'none' }} />
                        : <span style={{ fontSize: 16, color: 'var(--text3)' }}>▧</span>}
                    </div>

                    {/* Nome + barra fatigue */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 7px', borderRadius: 4, background: s.bg, color: s.color, letterSpacing: '.05em', flexShrink: 0 }}>{s.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 7 }}>
                        {[a.campaign, a.adset].filter(Boolean).join(' · ') || '—'}
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: 'var(--glass2)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(6, (a.score / maxScore) * 100)}%`, height: '100%', background: s.color, borderRadius: 999 }} />
                      </div>
                    </div>

                    {/* Metriche colorate (no muro di testo) */}
                    <div style={{ display: 'flex', gap: 16, flexShrink: 0, textAlign: 'right' }}>
                      <Metric label="Freq" value={a.frequency} tone={freqTone(a.frequency)} />
                      <Metric label="CTR" value={`${a.ctr}%`} tone={ctrTone(a.ctr)} />
                      <Metric label="CPA" value={money(a.cpa)} tone={cpaTone(a.cpa)} />
                      <Metric label="Spesa" value={money(a.spend)} />
                    </div>
                  </div>
                )
              })}
            </div>

            {ads.length > 12 && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button onClick={() => setShowAll(v => !v)} className="btn-glass" style={{ padding: '9px 24px', cursor: 'pointer' }}>
                  {showAll ? 'Mostra meno' : `Mostra tutte (${ads.length})`}
                </button>
              </div>
            )}

            {chartData.length > 0 && (
              <div className="glass-card-static reveal-zoom" style={{ marginTop: 22, padding: 18, borderRadius: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>Top creative per fatigue score</div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={chartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <filter id="fgGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={48} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: 'var(--text2)' }} />
                    <Bar dataKey="score" radius={[5, 5, 0, 0]} animationDuration={1400} animationEasing="ease-out" style={{ filter: 'url(#fgGlow)' }}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.sev === 'high' ? '#ff453a' : d.sev === 'medium' ? '#ff9f0a' : '#30d158'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </FxCard>
    </div>
  )
}

function Metric({ label, value, tone = 'var(--text)' }) {
  return (
    <div style={{ minWidth: 44 }}>
      <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color: tone, fontFamily: 'Barlow' }}>{value}</div>
    </div>
  )
}
