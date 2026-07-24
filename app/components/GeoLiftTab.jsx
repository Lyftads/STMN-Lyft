'use client'

import { useEffect, useMemo, useState } from 'react'
import Icon from './ui/Icon'
import FxCard from './ui/FxCard'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import { useI18n } from '../../lib/i18n/I18nProvider'
import RecosCard from './ui/RecosCard'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const TEAL = '#14b8a6'
const CTRL = '#94a3b8'

export default function GeoLiftTab() {
  const { t, locale } = useI18n()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [channel, setChannel] = useState('meta')
  const [lift, setLift] = useState(50)
  const [days, setDays] = useState(null)

  const load = (force = false) => {
    let cancelled = false
    const key = `geolift:120:${locale}`
    if (force) invalidate(key)
    const cached = !force ? getCached(key) : null
    if (cached) setData(cached.data); else setLoading(true)
    setError(null)
    swrFetch({
      key, forceRefresh: force,
      fetcher: () => fetch(`/api/geolift?days=120&locale=${locale}`).then(r => r.json()),
      onUpdate: (fresh) => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => { if (!cancelled) { if (j && !j.ok) setError(j.reason || 'error'); setData(j) } })
      .catch(e => { if (!cancelled && !cached) setError(e?.message || 'network') })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }
  useEffect(() => { return load() }, [locale]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (data?.ok && days == null) setDays(data.recommendedDays) }, [data, days])

  const pct = (n) => `${(Number(n) * 100).toFixed(1)}%`
  const selMde = useMemo(() => data?.ok ? (data.mde.find(m => m.days === days) || data.mde[2]) : null, [data, days])
  const matchPct = data?.ok ? Math.round(data.matchQuality * 100) : 0
  const matchColor = matchPct >= 80 ? '#22c55e' : matchPct >= 60 ? '#f59e0b' : '#ef4444'
  const channelName = channel === 'meta' ? 'Meta' : 'Google'

  return (
    <div style={{ marginTop: 24 }}>
      <FxCard delay={1.4}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 14 }}>
          {t('geo.sub', null, 'Design a causal geo experiment to prove the real lift of a channel — splits your regions into balanced test vs control.')}
          {data?.ok && data.metric && <span> · {t('geo.basedOn', { m: t('geo.metric_' + data.metric, null, data.metric) }, `based on GA4 ${data.metric}`)}</span>}
        </div>

        {loading && !data && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0' }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> {t('geo.designing', null, 'Designing the experiment…')}</div>}

        {!loading && error && (
          <div style={{ color: 'var(--text2)', fontSize: 13, padding: '16px 0' }}>
            {error === 'ga4_not_connected' ? t('geo.errGa4', null, 'Connect Google Analytics 4 to design a geo-lift (regions come from GA4).')
              : error === 'not_enough_regions' ? t('geo.errRegions', null, 'Not enough regions with volume to build a reliable test.')
                : error === 'no_geo_data' ? t('geo.errNoData', null, 'No regional data available from GA4 for this period.')
                  : t('geo.errGeneric', null, 'Could not design the experiment right now.')}
          </div>
        )}

        {data?.ok && (
          <>
            {/* Controlli */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 18, padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>{t('geo.channel', null, 'Channel to test')}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['meta', 'google'].map(c => (
                    <button key={c} onClick={() => setChannel(c)} className="btn-glass" style={{ padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: channel === c ? 1 : 0.55, borderColor: channel === c ? (c === 'meta' ? '#2997ff' : '#eab308') : undefined }}>{c === 'meta' ? 'Meta' : 'Google'}</button>
                  ))}
                </div>
              </div>
              <div style={{ minWidth: 200, flex: 1 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>{t('geo.liftToApply', { p: lift }, `Spend change in test regions: +${lift}%`)}</div>
                <input type="range" min={0} max={200} step={10} value={lift} onChange={e => setLift(Number(e.target.value))} style={{ width: '100%', accentColor: TEAL, cursor: 'pointer' }} />
              </div>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>{t('geo.duration', null, 'Duration')}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {data.mde.map(m => (
                    <button key={m.days} onClick={() => setDays(m.days)} className="btn-glass" style={{ padding: '7px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: days === m.days ? 1 : 0.55, borderColor: days === m.days ? TEAL : undefined }}>{m.weeks}{t('geo.wk', null, 'w')}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5, margin: '-6px 0 14px' }}>
              <Icon name="info" size={12} /> {t('geo.controlsNote', null, 'Regions, duration and statistics depend on your data and are the same for any channel. The channel and the spend % are the treatment you apply in the test regions — see the Plan below.')}
            </div>

            {/* Verdetto di fattibilità: dice onestamente se il test è sensato coi dati del cliente */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 14, marginBottom: 16,
              background: data.feasible ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.09)',
              border: `1px solid ${data.feasible ? 'rgba(34,197,94,0.35)' : 'rgba(245,158,11,0.4)'}`,
            }}>
              <span style={{ color: data.feasible ? '#22c55e' : '#f59e0b', flexShrink: 0, marginTop: 1 }}><Icon name={data.feasible ? 'check' : 'warning'} size={15} /></span>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text2)' }}>
                <span style={{ fontWeight: 800, color: data.feasible ? '#22c55e' : '#f59e0b' }}>{t('geo.feasTitle', null, 'Test feasibility')}: </span>
                {data.feasible
                  ? t('geo.feasOk', null, 'Statistically sound with your data — you can launch it.')
                  : data.feasibilityReason === 'weak_match' ? t('geo.feasWeakMatch', null, 'Weak match between test and control: the result would be unreliable. Use a longer pre-period or more homogeneous regions.')
                    : data.feasibilityReason === 'unstable_baseline' ? t('geo.feasUnstable', null, 'Unstable baseline: test and control already diverge before any campaign, so the test would produce false signals. Don\'t launch it as-is.')
                      : t('geo.feasMdeHigh', null, 'The minimum detectable lift is too high: with these volumes the test could only prove very large effects. Extend the duration or use a denser metric.')}
              </div>
            </div>

            {/* Card risultato */}
            <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12, marginBottom: 18 }}>
              <Big label={t('geo.recDuration', null, 'Recommended duration')} value={t('geo.weeksVal', { n: data.recommendedWeeks }, `${data.recommendedWeeks} weeks`)} color={TEAL} />
              <Big label={t('geo.detectable', { d: data.mde.find(m => m.days === days)?.weeks ?? '' }, `Detectable lift · ${days}d`)} value={`≥ ${pct(selMde?.mde || 0)}`} sub={t('geo.detectableSub', null, 'smaller lifts may go unnoticed')} />
              <Big label={t('geo.matchQuality', null, 'Match quality')} value={`${matchPct}%`} color={matchColor} sub={matchPct >= 80 ? t('geo.matchGood', null, 'control tracks test well') : t('geo.matchWeak', null, 'control tracks test loosely')} />
              <Big label={t('geo.regionsUsed', null, 'Regions used')} value={`${data.test.regions.length + data.control.regions.length}`} sub={t('geo.split', null, 'split into test / control')} />
              {data.biasAtZero != null && (
                <Big
                  label={t('geo.stability', null, 'Baseline stability')}
                  value={`${Math.round((1 - data.biasAtZero) * 100)}%`}
                  color={data.biasAtZero <= 0.1 ? '#22c55e' : '#f59e0b'}
                  sub={data.biasAtZero <= 0.1 ? t('geo.stabilityGood', null, 'test & control stable before the test') : t('geo.stabilityWeak', null, 'they already drift before the test')}
                />
              )}
            </div>

            <RecosCard recos={(() => {
              const out = []
              out.push({ level: 'high', text: t('reco.geoRun', { c: channelName, w: data.recommendedWeeks, mde: pct(data.recommendedMde) }, `Run the geo-lift on ${channelName}: ${data.recommendedWeeks} weeks, you'll detect a lift ≥ ${pct(data.recommendedMde)}. It's the causal proof of incrementality.`) })
              if (data.matchQuality >= 0.8) out.push({ level: 'info', text: t('reco.geoMatchGood', { p: matchPct }, `Match ${matchPct}%: control tracks test well, the experiment will be reliable.`) })
              else out.push({ level: 'high', text: t('reco.geoMatchWeak', { p: matchPct }, `Match ${matchPct}% (weak): use a longer pre-period or more homogeneous regions for a solid result.`) })
              return out
            })()} />

            {/* Striscia MDE per durata (mostra l'effetto della durata) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16, fontSize: 12 }}>
              <span style={{ color: 'var(--text3)', fontWeight: 700 }}>{t('geo.mdeByDuration', null, 'Detectable lift by duration:')}</span>
              {data.mde.map(m => (
                <button key={m.days} onClick={() => setDays(m.days)} style={{
                  cursor: 'pointer', borderRadius: 8, padding: '5px 11px', fontWeight: 800, fontSize: 12,
                  border: `1px solid ${days === m.days ? TEAL : 'var(--border)'}`,
                  background: days === m.days ? TEAL + '1f' : 'transparent',
                  color: days === m.days ? TEAL : 'var(--text2)',
                }}>{m.weeks}{t('geo.wk', null, 'w')} → ≥ {pct(m.mde)}</button>
              ))}
            </div>

            {/* Test vs Control */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 14, marginBottom: 16 }}>
              <RegionList title={t('geo.testRegions', null, 'TEST regions')} hint={t('geo.testHint', { p: lift, c: channelName }, `apply +${lift}% ${channelName} here`)} regions={data.test.regions} color={TEAL} />
              <RegionList title={t('geo.controlRegions', null, 'CONTROL regions')} hint={t('geo.controlHint', null, 'keep spend unchanged here')} regions={data.control.regions} color={CTRL} />
            </div>

            {/* Geo dominanti esclusi dal disegno (trimming) */}
            {data.trimmed?.length > 0 && (
              <div className="glass-card" style={{ padding: '12px 16px', marginBottom: 16, borderLeft: '3px solid #f59e0b' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 8 }}>{t('geo.trimmedTitle', null, 'Regions excluded from the design')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {data.trimmed.map(tr => (
                    <span key={tr.region} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', background: '#f59e0b14', border: '1px solid #f59e0b40', borderRadius: 8, padding: '4px 9px' }}>{tr.region} · {Math.round(tr.share * 100)}%</span>
                  ))}
                  <span style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>{t('geo.trimmedHint', null, 'too dominant: they unbalance the comparison and inflate the error, so they stay out of the test')}</span>
                </div>
              </div>
            )}

            {/* Grafico test vs control */}
            <div className="glass-card-static reveal-zoom" style={{ padding: 18, borderRadius: 16, marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 4 }}>{t('geo.trackTitle', null, 'Test vs control · they should move together')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 12 }}>{t('geo.trackSub', null, 'Before the test the two lines track each other. During the test, a gap = the causal lift.')}</div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.daily} margin={{ top: 6, right: 10, left: -6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} minTickGap={40} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line name={t('geo.test', null, 'Test')} type="monotone" dataKey="test" stroke={TEAL} strokeWidth={2} dot={false} />
                  <Line name={t('geo.control', null, 'Control')} type="monotone" dataKey="control" stroke={CTRL} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Piano del test */}
            <div className="glass-card-static" style={{ padding: 18, borderRadius: 16, marginBottom: 16, borderLeft: `4px solid ${TEAL}` }}>
              <div className="label" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{t('geo.planTitle', null, 'Your test plan')} <span style={{ color: channel === 'meta' ? '#2997ff' : '#eab308', fontWeight: 900 }}>· {channelName} +{lift}%</span></div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, display: 'grid', gap: 4 }}>
                <li>{t('geo.step1', { c: channelName, p: lift, n: data.test.regions.length }, `In ${channelName}, increase spend by ${lift}% only in the ${data.test.regions.length} TEST regions (geo-targeting).`)}</li>
                <li>{t('geo.step2', { n: data.control.regions.length }, `Keep spend exactly as-is in the ${data.control.regions.length} CONTROL regions.`)}</li>
                <li>{t('geo.step3', { w: data.mde.find(m => m.days === days)?.weeks ?? data.recommendedWeeks }, `Run for ${data.mde.find(m => m.days === days)?.weeks ?? data.recommendedWeeks} weeks without other major changes.`)}</li>
                <li>{t('geo.step4', { m: pct(selMde?.mde || 0) }, `Then compare test vs control: a lift above ${pct(selMde?.mde || 0)} is statistically detectable and proves the channel's causal effect.`)}</li>
              </ol>
            </div>

            {/* Come leggere */}
            <div className="glass-card-static" style={{ padding: 18, borderRadius: 16, marginBottom: 14 }}>
              <div className="label" style={{ marginBottom: 10 }}>{t('geo.howT', null, 'How to read this')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 12 }}>
                {[
                  ['geo.dGeoT', 'Why geo-lift', 'geo.dGeoD', "It's a real experiment: some regions get more (or less) budget, others don't. The difference is causal — it removes the bias of observational models."],
                  ['geo.dMatchT', 'Match quality', 'geo.dMatchD', 'How closely the control group historically tracks the test group. Higher = the control is a trustworthy "what would have happened".'],
                  ['geo.dMdeT', 'Detectable lift (MDE)', 'geo.dMdeD', 'The smallest lift the test can prove given the noise. Longer tests detect smaller lifts. If your expected lift is below it, run longer.'],
                  ['geo.dDurT', 'Duration', 'geo.dDurD', 'We pick the shortest duration that detects a ≤10% lift. You can pick longer for more sensitivity.'],
                ].map(([kt, ft, kd, fd]) => (
                  <div key={kt} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>{t(kt, null, ft)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, marginTop: 4 }}>{t(kd, null, fd)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
              <Icon name="info" size={12} /> {t('geo.note', null, 'Regions and the metric come from GA4. This is the design phase; after running the test, the readout (difference-in-differences) confirms the causal lift.')}
            </div>
          </>
        )}
      </FxCard>
    </div>
  )
}

function Big({ label, value, color, sub }) {
  return (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: color || 'var(--text)', marginTop: 4, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function RegionList({ title, hint, regions, color }) {
  return (
    <div className="glass-card" style={{ padding: 16, borderTop: `2px solid ${color}` }}>
      <div style={{ fontSize: 12.5, fontWeight: 900, color, letterSpacing: '0.04em' }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>{hint}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {regions.map(r => (
          <span key={r} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', background: color + '14', border: `1px solid ${color}33`, borderRadius: 8, padding: '4px 9px' }}>{r}</span>
        ))}
      </div>
    </div>
  )
}
