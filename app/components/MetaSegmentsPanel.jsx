'use client'

import { useEffect, useState } from 'react'

// Pannello "CAC per segmento di pubblico" (Meta). Usa il breakdown nativo
// user_segment_key (Nuovi / Esistenti / Engaged / Sconosciuto). Il CAC NUOVI
// clienti è il dato reale Meta: spesa segmento prospecting / acquisti prospecting.
// Riusato in KPI Brain, Meta KPI. Props: since, until (YYYY-MM-DD).
const eur0 = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`)
const eur2 = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const int0 = (n) => (n == null ? '—' : Number(n).toLocaleString('it-IT'))

const ORDER = [
  { key: 'new', label: 'Nuovi clienti', color: '#30d158' },
  { key: 'returning', label: 'Clienti esistenti', color: '#2997ff' },
  { key: 'engaged', label: 'Engaged (no acquisto)', color: '#ff9f0a' },
  { key: 'unknown', label: 'Sconosciuto', color: '#8b8b9a' },
]

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

  const card = { background: 'var(--glass, rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 14, padding: 14 }
  const lbl = { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)' }
  const metric = (l, v) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
      <span style={{ color: 'var(--text3)' }}>{l}</span><span style={{ color: 'var(--text)', fontWeight: 700 }}>{v}</span>
    </div>
  )

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>dato reale Meta (segmenti pubblico a livello account)</span>
      </div>
      {loading && !segs && <div style={{ color: 'var(--text3)', fontSize: 12.5 }}>Carico i segmenti Meta…</div>}
      {segs && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          {ORDER.map(({ key, label, color }) => {
            const s = segs[key] || {}
            const isNew = key === 'new'
            return (
              <div key={key} style={{ ...card, borderColor: isNew ? `${color}66` : 'var(--border)', boxShadow: isNew ? `0 0 0 1px ${color}33` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ ...lbl, color: 'var(--text2)' }}>{label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.cac == null ? 'var(--text3)' : color }}>{eur2(s.cac)}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>CAC {isNew ? '· nuovi clienti' : ''}</div>
                <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                  {metric('Spesa', eur0(s.spend))}
                  {metric('Acquisti', int0(s.purchases))}
                  {metric('ROAS', s.roas ? `${s.roas}×` : '—')}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
