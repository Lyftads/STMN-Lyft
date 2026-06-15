'use client'

import { useEffect, useState } from 'react'
import Sparkline from './Sparkline'

// Pannello "CAC nuovi clienti" (Google) dal segmento nativo new vs returning.
// Google non separa il costo per tipo cliente → CAC nuovi = spesa Google totale
// / conversioni nuovi clienti. Sparkline (CAC/giorno) + delta % vs periodo prec.
// Se il segmento non è disponibile sull'account, non mostra nulla. Props: since, until.
const eur0 = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`)
const eur2 = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const num0 = (n) => (n == null ? '—' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 }))

function Delta({ cur, prev }) {
  if (cur == null || prev == null || !Number.isFinite(prev) || prev === 0) return null
  const pct = ((cur - prev) / Math.abs(prev)) * 100
  if (Math.abs(pct) < 0.05) return <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>= prec.</span>
  const good = cur < prev
  return <span style={{ fontSize: 11.5, fontWeight: 800, color: good ? '#22c55e' : '#f87171' }}>{cur > prev ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</span>
}

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

  if (!data || !data.available) return null

  const card = { background: 'var(--glass, rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }
  const lbl = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text2)' }
  const metric = (l, v) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--text3)' }}>{l}</span><span style={{ color: 'var(--text)', fontWeight: 700 }}>{v}</span>
    </div>
  )
  const sNew = data.segments?.new || {}, sRet = data.segments?.returning || {}
  const spark = (data.daily || []).map(d => d.cac).filter(v => v != null && Number.isFinite(v))

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>Dato reale Google · CAC nuovi = spesa Google ÷ nuovi clienti · vs periodo precedente</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div style={{ ...card, borderColor: '#30d15866', boxShadow: '0 0 0 1px #30d15833' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#30d158' }} /><span style={lbl}>Nuovi clienti</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontSize: 23, fontWeight: 900, color: 'var(--text)' }}>{eur2(data.cacNew)}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>CAC · nuovi clienti</div>
            </div>
            {spark.length >= 2 && <Sparkline data={spark} color="#30d158" width={74} height={30} />}
          </div>
          <div style={{ marginTop: 6 }}><Delta cur={data.cacNew} prev={data.cacNewPrev} /></div>
          <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8, display: 'grid', gap: 4 }}>
            {metric('Conversioni', num0(sNew.conversions))}
            {metric('Valore conv.', eur0(sNew.value))}
            {metric('Spesa Google', eur0(data.totalSpend))}
          </div>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2997ff' }} /><span style={lbl}>Clienti ritornanti</span>
          </div>
          <div style={{ fontSize: 23, fontWeight: 900, color: 'var(--text)' }}>{num0(sRet.conversions)}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>conversioni</div>
          <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8, display: 'grid', gap: 4 }}>
            {metric('Valore conv.', eur0(sRet.value))}
            {metric('ROAS', sRet.roas ? `${sRet.roas}×` : '—')}
          </div>
        </div>
      </div>
    </div>
  )
}
