'use client'

import { useEffect, useState } from 'react'

const ACT = {
  scala: { color: 'var(--green)', bg: 'rgba(48,209,88,0.14)', label: 'SCALA' },
  mantieni: { color: 'var(--text2)', bg: 'var(--glass2)', label: 'MANTIENI' },
  riduci: { color: 'var(--orange)', bg: 'rgba(255,159,10,0.14)', label: 'RIDUCI' },
  taglia: { color: 'var(--red)', bg: 'rgba(255,69,58,0.14)', label: 'TAGLIA' },
}
const eur = (n) => `€${Number(n || 0).toLocaleString('it-IT')}`
const eur2 = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

export default function BudgetAdvisorPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/budget-advisor?preset=last_28d')
      .then(r => r.json())
      .then(j => { if (!cancelled) { if (j.error && !(j.campaigns?.length)) setError(j.error); setData(j) } })
      .catch(e => { if (!cancelled) setError(e?.message || 'Errore di rete') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const camps = data?.campaigns || []
  const shown = showAll ? camps : camps.slice(0, 12)
  const re = data?.reallocation || {}

  const Stat = ({ label, value, tone }) => (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>{label}</div>
      <div className="metric-value-sm" style={{ color: tone || 'var(--text)' }}>{value}</div>
    </div>
  )

  return (
    <div className="glass-section reveal-zoom" style={{ padding: 24, marginTop: 24 }}>
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ marginBottom: 4 }}>
          <div className="heading-sm" style={{ fontSize: 18 }}>Budget Advisor</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
            Ultimi 28 giorni · riallocazione consigliata a parità di spesa · consulenziale (non esecutivo)
          </div>
        </div>

        {loading && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '18px 0' }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> Analizzo le campagne…</div>}
        {!loading && error && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>{error}</div>}
        {!loading && !error && camps.length === 0 && <div style={{ color: 'var(--text2)', fontSize: 13, padding: '12px 0' }}>Nessuna campagna con spesa nel periodo.</div>}

        {camps.length > 0 && (
          <>
            <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, margin: '16px 0 16px' }}>
              <Stat label="Spesa totale" value={eur(data.totalSpend)} />
              <Stat label="ROAS medio (MER)" value={`${data.mer}x`} tone={data.mer >= 2 ? 'var(--green)' : data.mer >= 1 ? 'var(--orange)' : 'var(--red)'} />
              <Stat label="Da scalare" value={data.counts?.scala || 0} tone="var(--green)" />
              <Stat label="Da ridurre / tagliare" value={(data.counts?.riduci || 0) + (data.counts?.taglia || 0)} tone="var(--red)" />
            </div>

            {re.freed > 0 && (
              <div className="glass-card-static" style={{ padding: '14px 16px', borderRadius: 12, borderLeft: '3px solid var(--accent)', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700, marginBottom: 4 }}>
                  Sposta ~{eur(re.freed)} dalle campagne deboli (ROAS {re.avgCutRoas}x) verso quelle forti (ROAS {re.avgScaleRoas}x)
                </div>
                {re.forecastDelta > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    Revenue incrementale stimata nel periodo: <strong style={{ color: 'var(--green)' }}>+{eur(re.forecastDelta)}</strong> (a parità di spesa totale).
                  </div>
                )}
              </div>
            )}

            <div className="stagger" style={{ display: 'grid', gap: 8 }}>
              {shown.map((c, i) => {
                const a = ACT[c.action] || ACT.mantieni
                return (
                  <div key={i} className="glass-card-static" style={{ padding: 12, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14, borderLeft: `3px solid ${a.color}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 7px', borderRadius: 4, background: a.bg, color: a.color, letterSpacing: '.05em', flexShrink: 0 }}>{a.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                      </div>
                      {c.deltaPct !== 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
                          Budget: {eur2(c.spend)} → <strong style={{ color: a.color }}>{c.deltaPct === -100 ? 'pausa' : eur2(c.suggestedSpend)}</strong> {c.deltaPct !== -100 && <span>({c.deltaPct > 0 ? '+' : ''}{c.deltaPct}%)</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexShrink: 0, textAlign: 'right' }}>
                      <Metric label="Spesa" value={eur2(c.spend)} />
                      <Metric label="ROAS" value={`${c.roas}x`} tone={c.roas >= 2 ? 'var(--green)' : c.roas >= 1 ? 'var(--orange)' : 'var(--red)'} />
                      <Metric label="CPA" value={eur2(c.cpa)} />
                    </div>
                  </div>
                )
              })}
            </div>

            {camps.length > 12 && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button onClick={() => setShowAll(v => !v)} className="btn-glass" style={{ padding: '9px 24px', cursor: 'pointer' }}>
                  {showAll ? 'Mostra meno' : `Mostra tutte (${camps.length})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, tone = 'var(--text)' }) {
  return (
    <div style={{ minWidth: 50 }}>
      <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color: tone, fontFamily: 'Barlow' }}>{value}</div>
    </div>
  )
}
