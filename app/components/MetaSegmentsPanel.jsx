'use client'

import { useEffect, useState } from 'react'
import Sparkline from './Sparkline'

// Pannello "CAC per segmento di pubblico" (Meta). Breakdown nativo user_segment_key
// (Nuovi / Esistenti / Engaged / Sconosciuto). Per ogni segmento: CAC con sparkline
// (andamento giornaliero) e delta % vs stesso periodo precedente.
// Riusato in KPI Brain. Props: since, until.
const eur0 = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`)
const eur2 = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const int0 = (n) => (n == null ? '—' : Number(n).toLocaleString('it-IT'))

const ORDER = [
  { key: 'new', label: 'Nuovi clienti', color: '#30d158' },
  { key: 'returning', label: 'Clienti esistenti', color: '#2997ff' },
  { key: 'engaged', label: 'Engaged (no acquisto)', color: '#ff9f0a' },
  { key: 'unknown', label: 'Sconosciuto', color: '#8b8b9a' },
]

// Delta % per metrica "lower is better" (CAC): un calo è positivo (verde).
function Delta({ cur, prev }) {
  if (cur == null || prev == null || !Number.isFinite(prev) || prev === 0) return null
  const pct = ((cur - prev) / Math.abs(prev)) * 100
  if (Math.abs(pct) < 0.05) return <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>= prec.</span>
  const good = cur < prev // CAC più basso = meglio
  return (
    <span style={{ fontSize: 11.5, fontWeight: 800, color: good ? '#22c55e' : '#f87171' }}>
      {cur > prev ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

export default function MetaSegmentsPanel({ since, until, title = 'Meta · CAC per segmento di pubblico' }) {
  const [segs, setSegs] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!since || !until) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/meta-segments?preset=custom&since=${since}&until=${until}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!cancelled) { setSegs(j?.ok ? j.segments : null); setLoading(false) } })
      .catch(() => { if (!cancelled) { setSegs(null); setLoading(false) } })
    return () => { cancelled = true }
  }, [since, until])

  if (!loading && !segs) return null

  const card = { background: 'var(--glass, rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>Dato reale Meta (segmenti pubblico a livello account) · vs stesso periodo precedente</div>
      </div>
      {loading && !segs && <div style={{ color: 'var(--text3)', fontSize: 12.5 }}>Carico i segmenti Meta…</div>}
      {segs && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {ORDER.map(({ key, label, color }) => {
            const s = segs[key] || {}
            const isNew = key === 'new'
            const prevCac = s.prevTotals?.cac ?? s.prevTotals?.cpo
            const spark = (s.daily || []).map(d => d.cac).filter(v => v != null && Number.isFinite(v))
            return (
              <div key={key} style={{ ...card, borderColor: isNew ? `${color}66` : 'var(--border)', boxShadow: isNew ? `0 0 0 1px ${color}33` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text2)' }}>{label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 23, fontWeight: 900, color: s.cac == null ? 'var(--text3)' : 'var(--text)' }}>{eur2(s.cac)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>CAC{isNew ? ' · nuovi clienti' : ''}</div>
                  </div>
                  {spark.length >= 2 && <Sparkline data={spark} color={color} width={74} height={30} />}
                </div>
                <div style={{ marginTop: 6 }}><Delta cur={s.cac} prev={prevCac} /></div>
                <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8, display: 'grid', gap: 4 }}>
                  {[['Spesa', eur0(s.spend)], ['Acquisti', int0(s.purchases)], ['ROAS', s.roas ? `${s.roas}×` : '—']].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--text3)' }}>{l}</span><span style={{ color: 'var(--text)', fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
