'use client'

import { useState, useMemo, useEffect } from 'react'
import CROAgent from './CROAgent'
import BmTimeframe from './ui/BmTimeframe'
import { useI18n } from '../../lib/i18n/I18nProvider'

const ACCENT_GLOW = '#2997ff'

// Cache client a livello di modulo (sopravvive a cambio tab / remount): i dati
// CRO restano in memoria per ogni range, niente ricaricamento al rientro.
// Chiave = 'since:until'. Il refresh manuale rifetcha con ?refresh=1.
let __croCache = {}

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
        border: '1.5px solid var(--border)',
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

function KpiCard({ label, value, accent = 'var(--text)', curr, prev, delay = 0, isLowerBetter = false }) {
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
  const { t } = useI18n()
  const steps = [
    { name: t('cro.stepVisitors', null, 'Visitatori unici'), value: funnel.visitors },
    { name: t('cro.stepViewProduct', null, 'Visualizza prodotto'), value: Math.round(funnel.visitors * 0.65) },
    { name: t('cro.stepAddToCart', null, 'Aggiungi al carrello'), value: funnel.addToCart },
    { name: 'Checkout', value: funnel.checkout },
    { name: t('cro.stepPurchase', null, 'Acquista'), value: funnel.purchase },
  ]
  const maxVal = steps[0].value || 1

  return (
    <GlassCard padding={28} delay={delay}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 17, fontWeight: 900, letterSpacing: '-0.01em' }}>
            Purchase Journey
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 12.5 }}>
            {t('cro.funnelSubtitle', null, "Funnel di conversione · dai visitatori all'acquisto")}
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
              borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ fontSize: 9.5, color: 'var(--text3)', fontWeight: 800, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Step {i + 1}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 700, lineHeight: 1.3 }}>{s.name}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 6, letterSpacing: '-0.02em' }}>
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
              <div style={{ fontSize: 11.5, color: 'var(--text)', fontWeight: 900, marginBottom: 6, fontFamily: 'Barlow' }}>{fmtN(s.value)}</div>
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
              <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{t('cro.dropoff', null, 'Abbandono')}</div>
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
  const { t } = useI18n()
  const isoDay = d => d.toISOString().slice(0, 10)
  const [tf, setTf] = useState(() => ({ preset: 'last_30d', since: isoDay(new Date(Date.now() - 30 * 86400000)), until: isoDay(new Date()) }))

  // Range giorno-preciso dal selettore (custom o preset). Fallback a 30gg.
  const since = tf.since || isoDay(new Date(Date.now() - 30 * 86400000))
  const until = tf.until || isoDay(new Date())
  const cacheKey = `${since}:${until}`

  // Dati CRO giorno-precisi da /api/cro (sessioni e funnel reali da GA4 + ordini
  // Shopify per i giorni esatti) — così qualsiasi periodo, anche custom, cambia
  // davvero i dati. Cache di modulo + persistenza al cambio tab.
  const [resp, setResp] = useState(() => __croCache[cacheKey] || null)
  const [busy, setBusy] = useState(() => !__croCache[cacheKey])

  useEffect(() => {
    const cached = __croCache[cacheKey]
    if (cached) { setResp(cached); setBusy(false); return }
    let cancelled = false
    setBusy(true)
    fetch(`/api/cro?since=${since}&until=${until}`)
      .then(r => r.json())
      .then(j => { if (cancelled) return; __croCache[cacheKey] = j; setResp(j); setBusy(false) })
      .catch(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [cacheKey])

  const refresh = () => {
    setBusy(true)
    fetch(`/api/cro?since=${since}&until=${until}&refresh=1`)
      .then(r => r.json())
      .then(j => { __croCache[cacheKey] = j; setResp(j); setBusy(false) })
      .catch(() => setBusy(false))
  }

  const f = resp?.funnel || {}
  const c = {
    ses: Math.round(resp?.sessions ?? f.sessions ?? 0),
    ord: resp?.totalOrders ?? 0,
    fat: resp?.totalRevenue ?? 0,
    nc: resp?.newCustomers ?? 0,
    rc: resp?.returningCustomers ?? 0,
    atc: Math.round(f.addToCart ?? 0),
    chk: Math.round(f.checkout ?? 0),
  }
  c.cro = c.ses > 0 && c.ord > 0 ? (c.ord / c.ses) * 100 : null
  c.aov = c.ord > 0 ? c.fat / c.ord : null
  const pv = resp?.prev || {}
  const p = {
    ses: Math.round(pv.sessions ?? 0), ord: pv.orders ?? 0, fat: pv.revenue ?? 0,
    nc: pv.newCustomers ?? 0, rc: pv.returningCustomers ?? 0,
  }
  p.cro = p.ses > 0 && p.ord > 0 ? (p.ord / p.ses) * 100 : null
  p.aov = p.ord > 0 ? p.fat / p.ord : null
  const prevCro = p.cro

  const tfLabel = resp?.range ? `${resp.range.since} → ${resp.range.until}` : ''
  const funnel = {
    visitors: c.ses,
    addToCart: c.atc,
    checkout: c.chk,
    purchase: c.ord,
    source: resp?.funnel?.source || 'Shopify',
  }

  const insights = useMemo(() => {
    const ins = []
    if (c.cro != null && c.cro < 1) ins.push(t('cro.insLowCvr', { cro: fmtP(c.cro), n: fmtN(Math.round(c.ses * 0.01)) }, `Conversion rate al ${fmtP(c.cro)} — sotto il benchmark (1%). Un +1% genererebbe ~${fmtN(Math.round(c.ses * 0.01))} ordini in più.`))
    else if (c.cro != null && c.cro >= 2) ins.push(t('cro.insHighCvr', { cro: fmtP(c.cro) }, `Conversion rate al ${fmtP(c.cro)} — sopra la media e-commerce. Ottimo risultato.`))
    if (c.cro != null && prevCro != null) {
      const d = c.cro - prevCro
      if (d > 0.3) ins.push(t('cro.insCroUp', { d: d.toFixed(2) }, `CRO in miglioramento di +${d.toFixed(2)}pp rispetto al periodo precedente.`))
      if (d < -0.3) ins.push(t('cro.insCroDown', { d: Math.abs(d).toFixed(2) }, `CRO in calo di ${Math.abs(d).toFixed(2)}pp. Verificare UX, velocità sito e offerta.`))
    }
    if (c.aov && c.aov < 50) ins.push(t('cro.insLowAov', { aov: fmtE(c.aov) }, `AOV a ${fmtE(c.aov)}: sotto i €50. Considerare upsell, bundle o soglia spedizione gratuita.`))
    if (c.ses > 0 && c.ses < 500) ins.push(t('cro.insLowTraffic', { ses: fmtN(c.ses) }, `Traffico basso (${fmtN(c.ses)} sessioni). Il CRO è limitato dal volume — priorità: aumentare traffico qualificato.`))
    if (c.nc > 0 && c.rc > 0) {
      const retRate = (c.rc / (c.nc + c.rc)) * 100
      if (retRate > 25) ins.push(t('cro.insGoodRet', { ret: fmtP(retRate) }, `Retention rate al ${fmtP(retRate)}: buona fidelizzazione. I clienti ritornano.`))
      if (retRate < 10) ins.push(t('cro.insLowRet', { ret: fmtP(retRate) }, `Retention rate al ${fmtP(retRate)}: pochi clienti ritornano. Lavorare su email post-acquisto e programmi fedeltà.`))
    }
    return ins
  }, [c, p, prevCro, t])

  return (
    <div>
      {/* Timeframe bar — black glass */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)',
        backdropFilter: 'blur(40px) saturate(2.2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
        border: '1.5px solid var(--border)',
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
        {/* Sinistra: badge Live (dove prima c'era il timeframe) */}
        <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.14)', color: '#22c55e', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em' }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
            LIVE
          </span>
        </div>
        {/* Destra: confronto + Aggiorna + timeframe */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{tfLabel}</span>
          <button
            onClick={refresh}
            disabled={busy}
            className="btn-glass"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.5 : 1,
            }}
          >
            <span style={{ animation: busy ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {busy ? t('shell.updating', null, 'Aggiorno…') : t('shell.refresh', null, 'Aggiorna')}
          </button>
          <BmTimeframe value={tf} onChange={setTf} accent={ACCENT_GLOW} disabled={busy} />
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, marginBottom: 18 }}>
        <KpiCard label={t('cro.sessions', null, 'Sessioni')} value={fmtN(c.ses)} accent="#a78bfa" curr={c.ses} prev={p.ses} delay={0} />
        <KpiCard label={t('kpi.orders', null, 'Ordini')} value={fmtN(c.ord)} accent="#22c55e" curr={c.ord} prev={p.ord} delay={0.3} />
        <KpiCard
          label="CRO"
          value={fmtP(c.cro)}
          accent={c.cro >= 2 ? '#22c55e' : c.cro >= 1 ? '#f59e0b' : '#ef4444'}
          curr={c.cro}
          prev={prevCro}
          delay={0.6}
        />
        <KpiCard label={t('kpi.revenue', null, 'Fatturato')} value={fmtE(c.fat)} accent="#22c55e" curr={c.fat} prev={p.fat} delay={0.9} />
        <KpiCard label="AOV" value={fmtE(c.aov)} accent="#f97316" curr={c.aov} prev={p.aov} delay={1.2} />
        <KpiCard label={t('kpi.newCustomers', null, 'Nuovi Clienti')} value={fmtN(c.nc)} accent={ACCENT_GLOW} curr={c.nc} prev={p.nc} delay={1.5} />
      </div>

      {/* Funnel */}
      {c.ses > 0 && (
        <div style={{ marginBottom: 18 }}>
          <FunnelChart funnel={funnel} delay={1.8} />
        </div>
      )}

      {busy && c.ses === 0 && (
        <div style={{ marginBottom: 18 }}>
          <GlassCard padding={40} delay={1.8}>
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 14, fontWeight: 600 }}>
              {t('shell.updating', null, 'Aggiorno…')}
            </div>
          </GlassCard>
        </div>
      )}

      {!busy && c.ses === 0 && (
        <div style={{ marginBottom: 18 }}>
          <GlassCard padding={40} delay={1.8}>
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 14, fontWeight: 600 }}>
              {t('cro.emptyState', null, 'Nessun dato sessioni per il periodo selezionato. Prova un periodo diverso o clicca Aggiorna.')}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <GlassCard padding={26} delay={2.1}>
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 17, fontWeight: 900, letterSpacing: '-0.01em' }}>
              CRO Insights
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 12.5 }}>
              {t('cro.insightsSubtitle', null, 'Letture automatiche su conversion rate, AOV, retention e funnel')}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '14px 18px',
                background: 'rgba(0,0,0,0.45)',
                border: '1px solid var(--border)',
                borderTopColor: 'rgba(255,255,255,0.10)',
                borderBottomColor: 'rgba(0,0,0,0.55)',
                borderRadius: 12,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.2)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: `linear-gradient(135deg, ${ACCENT_GLOW}, #1e3a8a)`,
                  color: 'var(--text)',
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
