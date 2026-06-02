'use client'

import { useEffect, useState } from 'react'

const SEV = {
  high: { color: 'var(--red)', bg: 'rgba(255,69,58,0.12)', label: 'DA RINFRESCARE' },
  medium: { color: 'var(--orange)', bg: 'rgba(255,159,10,0.12)', label: 'SOTTO OSSERVAZIONE' },
  low: { color: 'var(--green)', bg: 'rgba(48,209,88,0.12)', label: 'OK' },
}

const money = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

export default function CreativeFatiguePanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    // Fatigue su finestra fissa di 28 giorni (concetto multi-giorno)
    fetch('/api/creative-fatigue?preset=last_28d')
      .then(r => r.json())
      .then(j => { if (!cancelled) { if (j.error && !(j.ads?.length)) setError(j.error); setData(j) } })
      .catch(e => { if (!cancelled) setError(e?.message || 'Errore di rete') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const ads = data?.ads || []

  return (
    <div className="glass-section reveal-zoom" style={{ padding: 24, marginBottom: 24 }}>
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div className="heading-sm" style={{ fontSize: 16 }}>Creative Fatigue</div>
          {data?.toRefresh > 0 && (
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--red)', background: 'rgba(255,69,58,0.12)', padding: '2px 8px', borderRadius: 6 }}>
              {data.toRefresh} da rinfrescare
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
          Ultimi 28 giorni · {data ? `media CTR ${data.avgCtr}% · CPA medio ${money(data.avgCpa)}` : '…'} · frequency↑ · CTR↓ · CPA↑
        </div>

        {loading && <div style={{ color: 'var(--text3)', fontSize: 13 }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> Analizzo le creative attive…</div>}
        {!loading && error && <div style={{ color: 'var(--text3)', fontSize: 13 }}>{error}</div>}
        {!loading && !error && ads.length === 0 && <div style={{ color: 'var(--text2)', fontSize: 13 }}>Nessuna creativa con dati sufficienti nel periodo.</div>}

        {ads.length > 0 && (
          <div className="stagger" style={{ display: 'grid', gap: 8 }}>
            {ads.map((a) => {
              const s = SEV[a.severity] || SEV.low
              return (
                <div key={a.adId} className="glass-card-static" style={{ padding: '12px 14px', borderRadius: 12, borderLeft: `3px solid ${s.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 7px', borderRadius: 4, background: s.bg, color: s.color, letterSpacing: '.06em' }}>{s.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>{a.name}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {[a.campaign, a.adset].filter(Boolean).join(' · ')}
                      </div>
                      {a.reasons?.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 5 }}>{a.reasons.join(' · ')}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 14, flexShrink: 0, textAlign: 'right' }}>
                      <Metric label="Freq" value={a.frequency} tone={a.frequency >= 5 ? 'var(--red)' : a.frequency >= 3 ? 'var(--orange)' : 'var(--text)'} />
                      <Metric label="CTR" value={`${a.ctr}%`} />
                      <Metric label="CPA" value={money(a.cpa)} />
                      <Metric label="Spesa" value={money(a.spend)} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, tone = 'var(--text)' }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color: tone, fontFamily: 'Barlow' }}>{value}</div>
    </div>
  )
}
