'use client'

import { useEffect, useMemo, useState } from 'react'
import Icon from './ui/Icon'
import FxCard from './ui/FxCard'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import { useI18n } from '../../lib/i18n/I18nProvider'

const CH_COLOR = { meta: '#2997ff', google: '#eab308' }
const TEAL = '#14b8a6'

function interp(curve, spend) {
  if (!curve?.length) return 0
  for (let i = 1; i < curve.length; i++) {
    if (curve[i].spend >= spend) {
      const a = curve[i - 1], b = curve[i]
      const f = b.spend === a.spend ? 0 : (spend - a.spend) / (b.spend - a.spend)
      return a.revenue + f * (b.revenue - a.revenue)
    }
  }
  return curve[curve.length - 1].revenue
}

export default function IncrSimulatorTab() {
  const { t, intlLocale, locale } = useI18n()
  const nloc = intlLocale || 'it-IT'
  const eur = (n) => (n == null ? '—' : `€${Math.round(Number(n)).toLocaleString(nloc)}`)
  const x = (n) => (n == null ? '—' : `${Number(n).toFixed(2)}×`)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [plan, setPlan] = useState(null) // { meta: dailySpend, google: ... }
  const [weeks, setWeeks] = useState(4)

  const load = (force = false) => {
    let cancelled = false
    const key = `incrementality:150:${locale}`
    if (force) invalidate(key)
    const cached = !force ? getCached(key) : null
    if (cached) setData(cached.data); else setLoading(true)
    setError(null)
    swrFetch({
      key, forceRefresh: force,
      fetcher: () => fetch(`/api/incrementality?days=150&locale=${locale}`).then(r => r.json()),
      onUpdate: (fresh) => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => { if (!cancelled) { if (j && !j.ok) setError(j.reason || 'error'); setData(j) } })
      .catch(e => { if (!cancelled && !cached) setError(e?.message || 'network') })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }
  useEffect(() => { return load() }, [locale]) // eslint-disable-line react-hooks/exhaustive-deps

  // init plan = current avg spend
  useEffect(() => {
    if (data?.ok && !plan) setPlan(Object.fromEntries(data.channels.map(c => [c.key, Math.round(c.avgSpend)])))
  }, [data, plan])

  const channels = data?.channels || []
  const days = weeks * 7

  const sim = useMemo(() => {
    if (!data?.ok || !plan) return null
    const per = {}
    let incNew = 0, incCur = 0, spendNew = 0, spendCur = 0
    for (const c of channels) {
      const curve = data.curves?.[c.key]
      const respNew = interp(curve, plan[c.key] ?? c.avgSpend)
      const respCur = interp(curve, c.avgSpend)
      const iNew = respNew * days, iCur = respCur * days
      const sNew = (plan[c.key] ?? c.avgSpend) * days, sCur = c.avgSpend * days
      per[c.key] = { iNew, iCur, sNew, sCur, iRoas: sNew > 0 ? iNew / sNew : 0, mRoas: c.mRoas }
      incNew += iNew; incCur += iCur; spendNew += sNew; spendCur += sCur
    }
    return { per, incNew, incCur, spendNew, spendCur, deltaInc: incNew - incCur, deltaSpend: spendNew - spendCur }
  }, [data, plan, weeks]) // eslint-disable-line react-hooks/exhaustive-deps

  // suggerimento: sposta budget dal canale più saturo a quello col mROAS migliore
  const advice = useMemo(() => {
    if (!data?.ok || channels.length < 2) return null
    const best = [...channels].sort((a, b) => b.mRoas - a.mRoas)[0]
    const worst = [...channels].sort((a, b) => b.saturation - a.saturation)[0]
    if (best.key === worst.key || best.mRoas <= worst.mRoas) return null
    return { from: worst, to: best }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const setSpend = (k, v) => setPlan(p => ({ ...p, [k]: v }))
  const reset = () => data?.ok && setPlan(Object.fromEntries(data.channels.map(c => [c.key, Math.round(c.avgSpend)])))

  return (
    <div style={{ marginTop: 24 }}>
      <FxCard delay={1.4}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t('incr.simSub', null, 'Move the sliders to see the expected incremental revenue over the next weeks.')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[2, 4, 8].map(w => (
              <button key={w} onClick={() => setWeeks(w)} className="btn-glass" style={{ padding: '7px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: weeks === w ? 1 : 0.55, borderColor: weeks === w ? TEAL : undefined }}>
                {t('incr.weeks', { n: w }, `${w} weeks`)}
              </button>
            ))}
          </div>
        </div>

        {loading && !data && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0' }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> {t('incr.modeling', null, 'Modeling incrementality…')}</div>}
        {!loading && error && <div style={{ color: 'var(--text2)', fontSize: 13, padding: '16px 0' }}>{error === 'not_enough_data' ? t('incr.errNotEnough', null, 'Not enough history yet.') : error === 'no_channels' ? t('incr.errNoChannels', null, 'Connect Meta or Google Ads.') : t('incr.errGeneric', null, 'Could not compute right now.')}</div>}

        {data?.ok && plan && sim && (
          <>
            {/* Headline forecast */}
            <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))', gap: 12, marginBottom: 18 }}>
              <Big label={t('incr.expectedInc', { w: weeks }, `Expected incremental · ${weeks}w`)} value={eur(sim.incNew)} color={TEAL} />
              <Big label={t('incr.vsCurrent', null, 'vs current plan')} value={`${sim.deltaInc >= 0 ? '+' : ''}${eur(sim.deltaInc)}`} color={sim.deltaInc >= 0 ? '#22c55e' : '#ef4444'} />
              <Big label={t('incr.plannedSpend', null, 'Planned spend')} value={eur(sim.spendNew)} />
              <Big label={t('incr.blendedIRoas', null, 'Blended incr. ROAS')} value={x(sim.spendNew > 0 ? sim.incNew / sim.spendNew : 0)} />
            </div>

            {/* Sliders per canale */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 14, marginBottom: 16 }}>
              {channels.map(c => {
                const col = CH_COLOR[c.key] || TEAL
                const cur = plan[c.key] ?? c.avgSpend
                const max = Math.max(Math.round(c.avgSpend * 2.5), Math.round(c.avgSpend + c.k))
                const p = sim.per[c.key]
                const deltaPct = c.avgSpend > 0 ? Math.round((cur / c.avgSpend - 1) * 100) : 0
                return (
                  <div key={c.key} className="glass-card" style={{ padding: 18, borderTop: `2px solid ${col}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--text)' }}><span style={{ width: 9, height: 9, borderRadius: 999, background: col }} />{data.channelNames?.[c.key] || c.key}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: deltaPct === 0 ? 'var(--text3)' : deltaPct > 0 ? '#22c55e' : '#ef4444' }}>{deltaPct > 0 ? '+' : ''}{deltaPct}%</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{eur(cur)}<span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>/{t('incr.day', null, 'day')}</span></div>
                    <input type="range" min={0} max={max} step={Math.max(1, Math.round(max / 100))} value={cur} onChange={e => setSpend(c.key, Number(e.target.value))}
                      style={{ width: '100%', marginTop: 12, accentColor: col, cursor: 'pointer' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                      <span>€0</span><span>{t('incr.now', null, 'now')} {eur(c.avgSpend)}</span><span>{eur(max)}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <div><div style={{ fontSize: 9.5, color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase' }}>{t('incr.incrWeeks', { w: weeks }, `Incremental ${weeks}w`)}</div><div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)' }}>{eur(p.iNew)}</div></div>
                      <div><div style={{ fontSize: 9.5, color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase' }}>{t('incr.iRoas', null, 'Incremental ROAS')}</div><div style={{ fontSize: 15, fontWeight: 900, color: p.iRoas >= 1 ? '#22c55e' : '#ef4444' }}>{x(p.iRoas)}</div></div>
                    </div>
                  </div>
                )
              })}
            </div>

            {advice && (
              <div className="glass-card-static" style={{ padding: '14px 18px', borderRadius: 14, borderLeft: `4px solid ${TEAL}`, marginBottom: 14, fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 }}>
                <Icon name="sparkle" size={14} /> <strong style={{ color: 'var(--text)' }}>{t('incr.suggestion', null, 'Suggestion')}:</strong> {t('incr.reallocate', { from: data.channelNames?.[advice.from.key] || advice.from.key, to: data.channelNames?.[advice.to.key] || advice.to.key, x: x(advice.to.mRoas) }, `${data.channelNames?.[advice.from.key] || advice.from.key} is saturated — the next euro returns more on ${data.channelNames?.[advice.to.key] || advice.to.key} (next-€ ${x(advice.to.mRoas)}). Consider shifting budget there.`)}
              </div>
            )}

            {/* Come funziona */}
            <div className="glass-card-static" style={{ padding: 18, borderRadius: 16, marginBottom: 14 }}>
              <div className="label" style={{ marginBottom: 10 }}>{t('incrSim.howT', null, 'How this works')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 12 }}>
                {[
                  ['incrSim.d1T', 'Expected incremental', 'incrSim.d1D', 'The extra revenue you should get from the planned spend over the chosen weeks, at steady state (carryover already included).'],
                  ['incrSim.d2T', 'vs current plan', 'incrSim.d2D', "The difference versus keeping today's spend. Green = you gain, red = you lose."],
                  ['incrSim.d3T', 'Blended incr. ROAS', 'incrSim.d3D', 'Total incremental ÷ total planned spend. Above 1× the plan is profitable on truly incremental terms.'],
                  ['incrSim.d4T', 'The suggestion', 'incrSim.d4D', 'We move budget toward the channel whose NEXT euro returns more (higher marginal ROAS) and away from the saturated one.'],
                ].map(([kt, ft, kd, fd]) => (
                  <div key={kt} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>{t(kt, null, ft)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, marginTop: 4 }}>{t(kd, null, fd)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, maxWidth: 620 }}>
                <Icon name="warning" size={12} /> {t('incr.simDisclaimer', null, 'Projection at steady state from the response curves. Directional, not a guarantee — validate big shifts with a geo-lift test.')}
              </div>
              <button onClick={reset} className="btn-glass" style={{ padding: '8px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{t('incr.resetCurrent', null, 'Reset to current')}</button>
            </div>
          </>
        )}
      </FxCard>
    </div>
  )
}

function Big({ label, value, color }) {
  return (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: color || 'var(--text)', marginTop: 4, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}
