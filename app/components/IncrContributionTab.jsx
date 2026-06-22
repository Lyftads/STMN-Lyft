'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import FxCard from './ui/FxCard'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import { useI18n } from '../../lib/i18n/I18nProvider'
import RecosCard from './ui/RecosCard'
import { contributionRecos } from '../../lib/incrementality/recos'
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'

const CH_COLOR = { meta: '#2997ff', google: '#eab308' }
const TEAL = '#14b8a6'

export default function IncrContributionTab() {
  const { t, intlLocale, locale } = useI18n()
  const nloc = intlLocale || 'it-IT'
  const eur = (n) => (n == null ? '—' : `€${Math.round(Number(n)).toLocaleString(nloc)}`)
  const pct = (n) => (n == null ? '—' : `${Math.round(Number(n) * 100)}%`)
  const x = (n) => (n == null ? '—' : `${Number(n).toFixed(2)}×`)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  const exportPdf = async () => {
    if (pdfBusy) return
    setPdfBusy(true)
    try {
      const res = await fetch(`/api/incrementality/pdf?days=150&locale=${locale}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if ((res.headers.get('content-type') || '').includes('pdf')) {
        const a = document.createElement('a'); a.href = url; a.download = `LyftAI_Incrementality_${new Date().toISOString().slice(0, 10)}.pdf`; document.body.appendChild(a); a.click(); a.remove()
      } else { window.open(url, '_blank') }
      setTimeout(() => URL.revokeObjectURL(url), 15000)
    } catch {} finally { setPdfBusy(false) }
  }

  const load = (force = false) => {
    let cancelled = false
    const key = `incrementality:150:${locale}`
    if (force) invalidate(key)
    const cached = !force ? getCached(key) : null
    if (cached) setData(cached.data); else setLoading(true)
    setError(null)
    swrFetch({
      key, forceRefresh: force,
      fetcher: () => fetch(`/api/incrementality?days=150&locale=${locale}${force ? '&refresh=1' : ''}`).then(r => r.json()),
      onUpdate: (fresh) => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => { if (!cancelled) { if (j && !j.ok) setError(j.reason || 'error'); setData(j) } })
      .catch(e => { if (!cancelled && !cached) setError(e?.message || 'network') })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }
  useEffect(() => { return load() }, [locale]) // eslint-disable-line react-hooks/exhaustive-deps

  const channels = data?.channels || []
  const reliability = data?.r2 != null ? (data.r2 >= 0.6 ? 'high' : data.r2 >= 0.35 ? 'medium' : 'low') : null
  const relColor = { high: '#22c55e', medium: '#f59e0b', low: '#ef4444' }[reliability] || 'var(--text3)'
  const totalInc = channels.reduce((s, c) => s + (c.incrementalRevenue || 0), 0)
  const totalSpend = channels.reduce((s, c) => s + (c.spend || 0), 0)
  const baselinePct = data?.totalRevenue > 0 ? (data.baselineRevenue / data.totalRevenue) : 0

  const barData = channels.map(c => ({
    name: data?.channelNames?.[c.key] || c.key,
    key: c.key,
    [t('incr.attributed', null, 'Attributed')]: Math.round(c.attributedRevenue),
    [t('incr.incremental', null, 'Incremental')]: Math.round(c.incrementalRevenue),
  }))
  const attLabel = t('incr.attributed', null, 'Attributed')
  const incLabel = t('incr.incremental', null, 'Incremental')

  const areaData = (data?.daily || []).map(d => ({ ...d }))

  return (
    <div style={{ marginTop: 24 }}>
      <FxCard delay={1.4}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>{t('incr.contribSub', null, 'What each channel really adds vs the organic baseline — last 150 days')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {reliability && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 800, color: relColor, background: relColor + '1a', border: `1px solid ${relColor}44`, borderRadius: 999, padding: '5px 12px' }}>
                <Icon name="pulse" size={12} /> {t('incr.reliability', null, 'Reliability')}: {t('incr.rel_' + reliability, null, reliability)} · R² {data.r2.toFixed(2)}
              </span>
            )}
            <button onClick={() => load(true)} disabled={loading} title={t('common.refresh', null, 'Refresh')} className="btn-glass" style={{ padding: '7px 10px', cursor: loading ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center' }}>
              <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            </button>
            {data?.ok && (
              <button onClick={exportPdf} disabled={pdfBusy} className="btn-glass" style={{ padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: pdfBusy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', animation: pdfBusy ? 'spin 1s linear infinite' : 'none' }}>{pdfBusy ? '◌' : '⬇'}</span>
                {pdfBusy ? t('report.generating', null, 'Generating PDF…') : t('report.download', null, 'Download PDF report')}
              </button>
            )}
          </div>
        </div>

        {loading && !data && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0' }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> {t('incr.modeling', null, 'Modeling incrementality…')}</div>}

        {!loading && error && (
          <div style={{ color: 'var(--text2)', fontSize: 13, padding: '16px 0' }}>
            {error === 'not_enough_data' ? t('incr.errNotEnough', null, 'Not enough history yet (need ~3+ weeks of daily data). Come back soon.')
              : error === 'no_channels' ? t('incr.errNoChannels', null, 'Connect Meta or Google Ads to measure incrementality.')
                : t('incr.errGeneric', null, 'Could not compute incrementality right now.')}
          </div>
        )}

        {data?.ok && (
          <>
            {/* Riepilogo affidabile (totale) */}
            <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12, margin: '2px 0 12px' }}>
              <div className="glass-card" style={{ padding: '14px 16px', borderTop: `2px solid ${TEAL}` }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('incr.totalIncremental', null, 'Total incremental · 150d')}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: TEAL, marginTop: 4 }}>{eur(totalInc)}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{t('incr.ofRevenue', { p: pct(data.totalRevenue > 0 ? totalInc / data.totalRevenue : 0) }, `${pct(data.totalRevenue > 0 ? totalInc / data.totalRevenue : 0)} of revenue`)}</div>
              </div>
              <div className="glass-card" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('incr.baseline', null, 'Baseline')}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>{eur(data.baselineRevenue)}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{t('incr.baselineShare', { p: pct(baselinePct) }, `${pct(baselinePct)} arrives anyway`)}</div>
              </div>
              <div className="glass-card" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('incr.totalRevenue', null, 'Total revenue')}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>{eur(data.totalRevenue)}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{t('incr.periodDays', { d: data.days }, `${data.days} days`)}</div>
              </div>
              <div className="glass-card" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('incr.totalAdSpend', null, 'Total ad spend')}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>{eur(totalSpend)}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{channels.map(c => `${data.channelNames?.[c.key] || c.key} ${eur(c.spend)}`).join(' · ')}</div>
              </div>
            </div>

            <div style={{ position: 'relative', zIndex: 2, fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.6, margin: '6px 0 14px' }}>
              <Icon name="info" size={12} /> {t('incr.methodNote', null, 'Realistic estimate: we start from platform-reported revenue and apply typical e-commerce incrementality factors (Meta ~70%, Google ~55%, reduced by saturation), with a minimum organic baseline. These are priors — the geo-lift gives certainty.')}
              <br /><Icon name="info" size={12} /> {t('incr.satNote', null, 'Saturation is a model estimate anchored to your spend distribution (per-channel knee), not measured — the geo-lift reveals the real curve.')}
            </div>

            {/* Banner affidabilità: cosa fidarsi e cosa no */}
            {reliability !== 'high' && (
              <div className="glass-card-static" style={{ padding: '12px 16px', borderRadius: 12, borderLeft: `4px solid ${relColor}`, marginBottom: 16, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55 }}>
                <Icon name="info" size={13} /> {t('incr.lowRelBanner', { total: eur(totalInc) }, `The total incremental (${eur(totalInc)}) is solid, but the split between channels is uncertain (channels often move together). Validate the per-channel reallocation with a geo-lift test before acting on big budgets.`)}
              </div>
            )}

            {/* Card per canale */}
            <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px,1fr))', gap: 12, margin: '14px 0 18px' }}>
              {channels.map(c => {
                const col = CH_COLOR[c.key] || TEAL
                const honesty = c.incrementalVsAttributed
                return (
                  <div key={c.key} className="glass-card" style={{ padding: 18, borderTop: `2px solid ${col}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: col }} />
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{data.channelNames?.[c.key] || c.key}</span>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>{eur(c.incrementalRevenue)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{t('incr.incrementalRev', null, 'incremental revenue')} · {t('incr.onSpend', { s: eur(c.spend) }, `on ${eur(c.spend)} spend`)}</div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <Mini label={t('incr.iRoas', null, 'Incremental ROAS')} value={x(c.iRoas)} sub={c.roasReported > 0 ? (c.reportedEstimated ? t('incr.reportedEst', { v: x(c.roasReported) }, `reported ~${x(c.roasReported)} (est.)`) : t('incr.vsReported', { v: x(c.roasReported) }, `reported ${x(c.roasReported)}`)) : t('incr.reportedNa', null, 'reported n/a')} />
                      <Mini label={t('incr.mRoas', null, 'Next-€ ROAS')} value={x(c.mRoas)} sub={t('incr.marginal', null, 'marginal')} valueColor={c.mRoas >= 1 ? '#22c55e' : '#ef4444'} />
                      <Mini label={t('incr.saturation', null, 'Saturation')} value={pct(c.saturation)} sub={c.saturation >= 0.8 ? t('incr.satHigh', null, 'scaling wastes') : t('incr.satOk', null, 'room to scale')} valueColor={c.saturation >= 0.8 ? '#ef4444' : '#22c55e'} />
                      <Mini label={t('incr.carryover', null, 'Carryover')} value={t('incr.carryDays', { d: c.carryoverDays90 }, `${c.carryoverDays90} days`)} sub={t('incr.toReach90', null, 'to 90% effect')} />
                    </div>

                    {honesty != null && (
                      <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.5, background: col + '12', borderRadius: 9, padding: '8px 10px' }}>
                        {honesty < 0.85
                          ? t('incr.overclaim', { p: pct(1 - honesty) }, `This channel reports ~${pct(1 - honesty)} more revenue than what is truly incremental.`)
                          : t('incr.honest', null, 'Platform-reported revenue is close to the true incremental value.')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <RecosCard recos={contributionRecos(data, { t, eur, x, pct, names: data.channelNames })} />

            {/* Attribuito vs Incrementale */}
            <div className="glass-card-static reveal-zoom" style={{ padding: 18, borderRadius: 16, marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 4 }}>{t('incr.attrVsIncr', null, 'Platform-attributed vs real incremental')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 12 }}>{t('incr.attrVsIncrSub', null, 'The gap is the revenue that would have happened anyway (baseline).')}</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} margin={{ top: 6, right: 10, left: -6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={v => eur(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar name={attLabel} dataKey={attLabel} fill="rgba(148,163,184,0.5)" radius={[5, 5, 0, 0]} />
                  <Bar name={incLabel} dataKey={incLabel} radius={[5, 5, 0, 0]}>
                    {barData.map((d, i) => <Cell key={i} fill={CH_COLOR[d.key] || TEAL} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Decomposizione giornaliera */}
            <div className="glass-card-static reveal-zoom" style={{ padding: 18, borderRadius: 16 }}>
              <div className="label" style={{ marginBottom: 4 }}>{t('incr.dailyDecomp', null, 'Daily revenue decomposition')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 12 }}>{t('incr.dailyDecompSub', null, 'How total revenue splits between organic baseline and each paid channel.')}</div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={areaData} margin={{ top: 6, right: 10, left: -6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} minTickGap={40} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={v => eur(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area name={t('incr.baseline', null, 'Baseline')} type="monotone" dataKey="baseline" stackId="1" stroke="#64748b" fill="rgba(100,116,139,0.35)" />
                  {channels.map(c => (
                    <Area key={c.key} name={data.channelNames?.[c.key] || c.key} type="monotone" dataKey={c.key} stackId="1" stroke={CH_COLOR[c.key] || TEAL} fill={(CH_COLOR[c.key] || TEAL) + '55'} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Come leggere questi dati */}
            <div className="glass-card-static" style={{ padding: 18, borderRadius: 16, marginTop: 16 }}>
              <div className="label" style={{ marginBottom: 8 }}>{t('incrExp.title', null, 'How to read this data')}</div>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 14px' }}>{t('incrExp.intro', null, "Incrementality measures the revenue a channel TRULY generates — what wouldn’t exist without it — separating it from the organic baseline (sales that happen anyway).")}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 12 }}>
                {[
                  ['incrExp.incRevT', 'Incremental revenue', 'incrExp.incRevD', "The revenue caused only by that channel. Different from platform 'attributed revenue', which often takes credit for sales you'd have had anyway."],
                  ['incrExp.baselineT', 'Organic baseline', 'incrExp.baselineD', 'Sales that would arrive even at zero spend: brand, returning customers, organic. It is the grey band in the chart.'],
                  ['incrExp.iRoasT', 'Incremental ROAS', 'incrExp.iRoasD', "Incremental revenue ÷ spend. The channel's REAL return. Compare it to the platform 'reported ROAS' (usually higher and inflated)."],
                  ['incrExp.mRoasT', 'Next-€ ROAS', 'incrExp.mRoasD', 'What the NEXT euro returns at the current spend level. Above 1× → worth scaling; below 1× → the extra margin is a loss.'],
                  ['incrExp.satT', 'Saturation', 'incrExp.satD', 'How far up the diminishing-returns curve you are. Low = room to grow; high (≥80%) = extra budget adds little.'],
                  ['incrExp.carryT', 'Carryover', 'incrExp.carryD', "How many days today's euro keeps driving sales (here, days to 90% of the effect). Higher on awareness/video, lower on search."],
                  ['incrExp.relT', 'Reliability (R²)', 'incrExp.relD', 'How well the model explains your revenue (0–1). High = solid estimate; low = little data or channels too correlated — take the numbers with caution.'],
                ].map(([kt, ft, kd, fd]) => (
                  <div key={kt} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>{t(kt, null, ft)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, marginTop: 4 }}>{t(kd, null, fd)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
              <Icon name="warning" size={12} /> {t('incr.disclaimer', null, 'Directional estimate from your own data (MMM-lite). For causal certainty, validate with a geo-lift test.')}
            </div>
          </>
        )}
      </FxCard>
    </div>
  )
}

function Mini({ label, value, sub, valueColor }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: valueColor || 'var(--text)', marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, color: 'var(--text3)', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}
