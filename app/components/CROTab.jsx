'use client'

import { useState, useMemo } from 'react'
import CROAgent from './CROAgent'

const ACCENT_GLOW = '#2997ff'

const fmtN = n => n != null && n > 0 ? Math.round(n).toLocaleString('it-IT') : '—'
const fmtP = n => n != null ? `${n.toFixed(1)}%` : '—'
const fmtE = n => n != null && n > 0 ? `€${Math.round(n).toLocaleString('it-IT')}` : '—'

// Wrapper black glass 3D condiviso (stesso pattern di Simulator/Meta Detail)
function GlassCard({ children, padding = 22, delay = 0, glow = ACCENT_GLOW, style = {} }) {
  return (
    <div
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)',
        backdropFilter: 'blur(40px) saturate(2.2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
        borderRadius: 22,
        overflow: 'hidden',
        border: '1.5px solid rgba(255,255,255,0.06)',
        borderTopColor: 'rgba(255,255,255,0.12)',
        borderBottomColor: 'rgba(0,0,0,0.65)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.80), 0 12px 24px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)',
        animation: 'sim-pulse 6s ease-in-out infinite',
        animationDelay: `${delay}s`,
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
        ...style,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.animationPlayState = 'paused'
        e.currentTarget.style.transform = 'translateY(-6px) scale(1.008)'
        e.currentTarget.style.boxShadow = `0 50px 100px rgba(0,0,0,0.85), 0 20px 40px rgba(0,0,0,0.6), 0 0 80px ${glow}22, inset 0 1.5px 0 rgba(255,255,255,0.08), inset 0 -1.5px 0 rgba(0,0,0,0.3)`
        e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.animationPlayState = 'running'
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = '0 30px 80px rgba(0,0,0,0.80), 0 12px 24px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)'
        e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
        background: `linear-gradient(90deg, transparent, ${glow}aa, transparent)`,
        filter: 'blur(0.3px)',
        opacity: 0.85,
        animation: 'cr-shine 4s ease-in-out infinite',
        zIndex: 3,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '-50%',
        width: '40%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)',
        animation: 'sim-scan 9s ease-in-out infinite',
        animationDelay: `${delay + 1}s`,
        pointerEvents: 'none',
        zIndex: 1,
      }} />
      <div style={{ padding, position: 'relative', zIndex: 2 }}>{children}</div>
    </div>
  )
}

function KpiCard({ label, value, accent = '#fff', curr, prev, delay = 0, isLowerBetter = false }) {
  let pct = null
  let good = null
  if (typeof prev === 'number' && prev > 0 && typeof curr === 'number') {
    const v = ((curr - prev) / prev) * 100
    if (Number.isFinite(v) && Math.abs(v) >= 0.1) {
      pct = v
      good = isLowerBetter ? v < 0 : v > 0
    }
  }

  return (
    <GlassCard delay={delay} padding="20px 22px" style={{ borderRadius: 22 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 800,
        color: 'var(--text3)',
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        marginBottom: 12,
      }}>{label}</div>
      <div style={{
        fontSize: 26,
        fontWeight: 900,
        color: accent,
        letterSpacing: '-0.02em',
        marginBottom: pct != null ? 8 : 0,
      }}>{value}</div>
      {pct != null && (
        <div style={{
          display: 'inline-flex',
          padding: '3px 9px',
          borderRadius: 6,
          background: good ? 'rgba(34,197,94,0.13)' : 'rgba(239,68,68,0.13)',
          color: good ? '#22c55e' : '#ef4444',
          fontSize: 11,
          fontWeight: 800,
        }}>
          {pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
        </div>
      )}
    </GlassCard>
  )
}

function FunnelChart({ funnel, delay = 0 }) {
  const steps = [
    { name: 'Visitatori unici', value: funnel.visitors },
    { name: 'Visualizza prodotto', value: Math.round(funnel.visitors * 0.65) },
    { name: 'Aggiungi al carrello', value: funnel.addToCart },
    { name: 'Checkout', value: funnel.checkout },
    { name: 'Acquista', value: funnel.purchase },
  ]
  const maxVal = steps[0].value || 1

  return (
    <GlassCard padding={28} delay={delay}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 900, letterSpacing: '-0.01em' }}>
            Purchase Journey
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 12.5 }}>
            Funnel di conversione · dai visitatori all'acquisto
          </p>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 999,
          background: 'rgba(48,209,88,0.12)',
          border: '1px solid rgba(48,209,88,0.3)',
          color: '#86efac',
          fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 999,
            background: '#30d158',
            boxShadow: '0 0 8px #30d158',
            animation: 'card-pulse 2s ease-in-out infinite',
          }} />
          {funnel.source}
        </span>
      </div>

      {/* Step labels e percentuali */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
        {steps.map((s, i) => {
          const pct = steps[0].value > 0 ? (s.value / steps[0].value) * 100 : 0
          return (
            <div key={i} style={{
              flex: 1,
              padding: '0 10px',
              borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}>
              <div style={{ fontSize: 9.5, color: 'var(--text3)', fontWeight: 800, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Step {i + 1}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 700, lineHeight: 1.3 }}>{s.name}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 6, letterSpacing: '-0.02em' }}>
                {i === 0 ? '100%' : fmtP(pct)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bar chart */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', height: 220, marginBottom: 18, padding: '0 10px' }}>
        {steps.map((s, i) => {
          const pct = maxVal > 0 ? (s.value / maxVal) * 100 : 0
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 11.5, color: '#fff', fontWeight: 900, marginBottom: 6, fontFamily: 'Barlow' }}>{fmtN(s.value)}</div>
              <div style={{
                width: '78%',
                background: `linear-gradient(180deg, ${ACCENT_GLOW} 0%, #1e3a8a 100%)`,
                borderRadius: '8px 8px 0 0',
                height: `${Math.max(pct, 2)}%`,
                transition: 'height .8s cubic-bezier(0.16,1,0.3,1)',
                boxShadow: `0 0 16px ${ACCENT_GLOW}33, inset 0 1px 0 rgba(255,255,255,0.15)`,
              }} />
            </div>
          )
        })}
      </div>

      {/* Drop-off per step */}
      <div style={{ display: 'flex', gap: 14, padding: '0 10px' }}>
        {steps.map((s, i) => {
          if (i === 0) return <div key={i} style={{ flex: 1 }} />
          const drop = steps[i - 1].value - s.value
          const dropPct = steps[i - 1].value > 0 ? (drop / steps[i - 1].value) * 100 : 0
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Abbandono</div>
              <div style={{
                fontSize: 12.5,
                fontWeight: 900,
                color: drop > 0 ? '#ef4444' : '#22c55e',
                fontFamily: 'Barlow',
              }}>
                {fmtN(Math.abs(drop))} · {fmtP(dropPct)}
              </div>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

export default function CROTab({ data = [], live, onRefresh, loading }) {
  const [tf, setTf] = useState('this_month')
  const [customSince, setCustomSince] = useState('')
  const [customUntil, setCustomUntil] = useState('')

  const asNum = v => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
  const safeDiv = (a, b) => b > 0 ? a / b : null

  const { current: c, previous: p, tfLabel } = useMemo(() => {
    const now = new Date()
    const fmtM = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const thisM = fmtM(now), prevM = fmtM(new Date(now.getFullYear(), now.getMonth()-1, 1))
    const m2ago = fmtM(new Date(now.getFullYear(), now.getMonth()-2, 1))

    let cur = [], prev = [], label = ''
    if (tf === 'this_month') { cur = data.filter(m => m.month === thisM); prev = data.filter(m => m.month === prevM); label = `${thisM} vs ${prevM}` }
    else if (tf === 'last_month') { cur = data.filter(m => m.month === prevM); prev = data.filter(m => m.month === m2ago); label = `${prevM} vs ${m2ago}` }
    else if (tf === 'custom' && customSince && customUntil) {
      cur = data.filter(m => m.month >= customSince && m.month <= customUntil)
      const span = cur.length || 1
      const startD = new Date(customSince + '-01')
      const prevEnd = new Date(startD); prevEnd.setMonth(prevEnd.getMonth() - 1)
      const prevStart = new Date(prevEnd); prevStart.setMonth(prevStart.getMonth() - span + 1)
      prev = data.filter(m => m.month >= fmtM(prevStart) && m.month <= fmtM(prevEnd))
      label = `${customSince} → ${customUntil} vs periodo prec.`
    } else { cur = data.filter(m => m.month === thisM); prev = data.filter(m => m.month === prevM); label = `${thisM} vs ${prevM}` }

    const sum = (arr, k) => arr.reduce((s, m) => s + asNum(m[k]), 0)
    const compute = arr => {
      const fat = sum(arr,'fatturato'), ord = sum(arr,'ordini'), nc = sum(arr,'nc'), rc = sum(arr,'rc'), ses = sum(arr,'sessioni')
      return { fat, ord, nc, rc, ses, cro: ses > 0 && ord > 0 ? (ord / ses) * 100 : null, aov: safeDiv(fat, ord), atc: Math.round(ord * 1.8), chk: Math.round(ord * 1.3) }
    }
    return { current: compute(cur), previous: compute(prev), tfLabel: label }
  }, [data, tf, customSince, customUntil])

  const availableMonths = data.filter(m => m.fatturato > 0 || m.totalSpend > 0)
  const prevCro = p.ses > 0 && p.ord > 0 ? (p.ord / p.ses) * 100 : null

  const funnel = { visitors: c.ses, addToCart: c.atc, checkout: c.chk, purchase: c.ord, source: 'Shopify · mensile' }

  const insights = useMemo(() => {
    const ins = []
    if (c.cro != null && c.cro < 1) ins.push(`Conversion rate al ${fmtP(c.cro)} — sotto il benchmark (1%). Un +1% genererebbe ~${fmtN(Math.round(c.ses * 0.01))} ordini in più.`)
    else if (c.cro != null && c.cro >= 2) ins.push(`Conversion rate al ${fmtP(c.cro)} — sopra la media e-commerce. Ottimo risultato.`)
    if (c.cro != null && prevCro != null) {
      const d = c.cro - prevCro
      if (d > 0.3) ins.push(`CRO in miglioramento di +${d.toFixed(2)}pp rispetto al periodo precedente.`)
      if (d < -0.3) ins.push(`CRO in calo di ${Math.abs(d).toFixed(2)}pp. Verificare UX, velocità sito e offerta.`)
    }
    if (c.aov && c.aov < 50) ins.push(`AOV a ${fmtE(c.aov)}: sotto i €50. Considerare upsell, bundle o soglia spedizione gratuita.`)
    if (c.ses > 0 && c.ses < 500) ins.push(`Traffico basso (${fmtN(c.ses)} sessioni). Il CRO è limitato dal volume — priorità: aumentare traffico qualificato.`)
    if (c.nc > 0 && c.rc > 0) {
      const retRate = (c.rc / (c.nc + c.rc)) * 100
      if (retRate > 25) ins.push(`Retention rate al ${fmtP(retRate)}: buona fidelizzazione. I clienti ritornano.`)
      if (retRate < 10) ins.push(`Retention rate al ${fmtP(retRate)}: pochi clienti ritornano. Lavorare su email post-acquisto e programmi fedeltà.`)
    }
    return ins
  }, [c, p, prevCro])

  return (
    <div>
      {/* Timeframe bar — black glass */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)',
        backdropFilter: 'blur(40px) saturate(2.2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
        border: '1.5px solid rgba(255,255,255,0.06)',
        borderTopColor: 'rgba(255,255,255,0.12)',
        borderBottomColor: 'rgba(0,0,0,0.65)',
        borderRadius: 22,
        padding: 16,
        marginBottom: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        boxShadow: '0 30px 80px rgba(0,0,0,0.80), 0 12px 24px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)',
      }}>
        {[
          { id: 'this_month', l: 'Questo mese' },
          { id: 'last_month', l: 'Mese precedente' },
          { id: 'custom', l: 'Custom' },
        ].map(b => {
          const active = tf === b.id
          return (
            <button
              key={b.id}
              onClick={() => setTf(b.id)}
              style={{
                background: active ? 'linear-gradient(135deg, rgba(41,151,255,0.28), rgba(30,58,138,0.22))' : 'rgba(255,255,255,0.04)',
                border: active ? '1px solid rgba(41,151,255,0.55)' : '1px solid rgba(255,255,255,0.07)',
                color: active ? '#fff' : 'var(--text2)',
                borderRadius: 11,
                padding: '9px 14px',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: active ? `0 0 14px ${ACCENT_GLOW}33` : 'none',
                transition: 'all .15s',
              }}
            >{b.l}</button>
          )
        })}
        {tf === 'custom' && (
          <>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>Da:</span>
            <select
              value={customSince}
              onChange={e => setCustomSince(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '8px 12px',
                color: '#fff',
                fontSize: 12.5,
                outline: 'none',
              }}
            >
              <option value="">Seleziona</option>
              {availableMonths.map(m => <option key={m.month} value={m.month}>{m.month}</option>)}
            </select>
            <span style={{ color: 'var(--text3)' }}>→</span>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>A:</span>
            <select
              value={customUntil}
              onChange={e => setCustomUntil(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '8px 12px',
                color: '#fff',
                fontSize: 12.5,
                outline: 'none',
              }}
            >
              <option value="">Seleziona</option>
              {availableMonths.filter(m => !customSince || m.month >= customSince).map(m => <option key={m.month} value={m.month}>{m.month}</option>)}
            </select>
          </>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="btn-glass"
            style={{
              marginLeft: 'auto',
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            <span style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {loading ? 'Aggiorno…' : 'Aggiorna'}
          </button>
        )}
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{tfLabel}</span>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, marginBottom: 18 }}>
        <KpiCard label="Sessioni" value={fmtN(c.ses)} accent="#a78bfa" curr={c.ses} prev={p.ses} delay={0} />
        <KpiCard label="Ordini" value={fmtN(c.ord)} accent="#22c55e" curr={c.ord} prev={p.ord} delay={0.3} />
        <KpiCard
          label="CRO"
          value={fmtP(c.cro)}
          accent={c.cro >= 2 ? '#22c55e' : c.cro >= 1 ? '#f59e0b' : '#ef4444'}
          curr={c.cro}
          prev={prevCro}
          delay={0.6}
        />
        <KpiCard label="Fatturato" value={fmtE(c.fat)} accent="#22c55e" curr={c.fat} prev={p.fat} delay={0.9} />
        <KpiCard label="AOV" value={fmtE(c.aov)} accent="#f97316" curr={c.aov} prev={p.aov} delay={1.2} />
        <KpiCard label="Nuovi Clienti" value={fmtN(c.nc)} accent={ACCENT_GLOW} curr={c.nc} prev={p.nc} delay={1.5} />
      </div>

      {/* Funnel */}
      {c.ses > 0 && (
        <div style={{ marginBottom: 18 }}>
          <FunnelChart funnel={funnel} delay={1.8} />
        </div>
      )}

      {c.ses === 0 && (
        <div style={{ marginBottom: 18 }}>
          <GlassCard padding={40} delay={1.8}>
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 14, fontWeight: 600 }}>
              Nessun dato sessioni per il periodo selezionato. Prova un periodo diverso o clicca Aggiorna.
            </div>
          </GlassCard>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <GlassCard padding={26} delay={2.1}>
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 900, letterSpacing: '-0.01em' }}>
              CRO Insights
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 12.5 }}>
              Letture automatiche su conversion rate, AOV, retention e funnel
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '14px 18px',
                background: 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderTopColor: 'rgba(255,255,255,0.10)',
                borderBottomColor: 'rgba(0,0,0,0.55)',
                borderRadius: 12,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.2)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: `linear-gradient(135deg, ${ACCENT_GLOW}, #1e3a8a)`,
                  color: '#fff',
                  display: 'grid', placeItems: 'center',
                  fontSize: 12, fontWeight: 900,
                  flexShrink: 0,
                  boxShadow: `0 0 14px ${ACCENT_GLOW}55`,
                }}>{i + 1}</div>
                <div style={{ color: 'var(--text)', fontSize: 13.5, lineHeight: 1.55 }}>{ins}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <CROAgent
        current={c}
        previous={p}
        funnel={funnel}
        insights={insights}
        tfLabel={tfLabel}
      />
    </div>
  )
}
