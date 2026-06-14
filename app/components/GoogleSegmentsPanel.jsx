'use client'

import { useEffect, useState } from 'react'

// Pannello "CAC nuovi clienti" (Google) dal segmento nativo new vs returning.
// Google non separa il costo per tipo cliente → CAC nuovi = spesa Google totale
// / conversioni nuovi clienti. Se il segmento non è disponibile sull'account,
// non mostra nulla. Props: since, until.
const eur0 = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`)
const eur2 = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const num0 = (n) => (n == null ? '—' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 }))

export default function GoogleSegmentsPanel({ since, until, title = 'Google · Nuovi vs Ritornanti' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!since || !until) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/google-segments?preset=custom&since=${since}&until=${until}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!cancelled) { setData(j?.ok ? j : null); setLoading(false) } })
      .catch(() => { if (!cancelled) { setData(null); setLoading(false) } })
    return () => { cancelled = true }
  }, [since, until])

  // Niente da mostrare se non configurato o segmento non disponibile sull'account
  if (!data || !data.available) return null

  const card = { background: 'var(--glass, rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 14, padding: 14 }
  const lbl = { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text2)' }
  const metric = (l, v) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
      <span style={{ color: 'var(--text3)' }}>{l}</span><span style={{ color: 'var(--text)', fontWeight: 700 }}>{v}</span>
    </div>
  )
  const sNew = data.segments?.new || {}, sRet = data.segments?.returning || {}

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>dato reale Google · CAC nuovi = spesa Google ÷ nuovi clienti</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <div style={{ ...card, borderColor: '#30d15866', boxShadow: '0 0 0 1px #30d15833' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#30d158' }} />
            <span style={lbl}>Nuovi clienti</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#30d158' }}>{eur2(data.cacNew)}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>CAC · nuovi clienti</div>
          <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
            {metric('Conversioni', num0(sNew.conversions))}
            {metric('Valore conv.', eur0(sNew.value))}
            {metric('Spesa Google', eur0(data.totalSpend))}
          </div>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2997ff' }} />
            <span style={lbl}>Clienti ritornanti</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{num0(sRet.conversions)}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>conversioni</div>
          <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
            {metric('Valore conv.', eur0(sRet.value))}
            {metric('ROAS', sRet.roas ? `${sRet.roas}×` : '—')}
          </div>
        </div>
      </div>
    </div>
  )
}
