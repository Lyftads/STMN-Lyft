'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import FxCard from './ui/FxCard'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import { useI18n } from '../../lib/i18n/I18nProvider'
import RecosCard from './ui/RecosCard'
import { curvesRecos } from '../../lib/incrementality/recos'
import { ComposedChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine } from 'recharts'

const CH_COLOR = { meta: '#2997ff', google: '#eab308' }
const TEAL = '#14b8a6'

// interpola revenue dalla curva per una data spesa
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

export default function IncrCurvesTab() {
  const { t, intlLocale, locale } = useI18n()
  const nloc = intlLocale || 'it-IT'
  const eur = (n) => (n == null ? '—' : `€${Math.round(Number(n)).toLocaleString(nloc)}`)
  const pct = (n) => (n == null ? '—' : `${Math.round(Number(n) * 100)}%`)
  const x = (n) => (n == null ? '—' : `${Number(n).toFixed(2)}×`)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  const channels = data?.channels || []

  return (
    <div style={{ marginTop: 24 }}>
      <FxCard delay={1.4}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 14 }}>{t('incr.curvesSub', null, 'How much the next euro returns, and how long today’s spend keeps working.')}</div>

        {loading && !data && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0' }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> {t('incr.modeling', null, 'Modeling incrementality…')}</div>}
        {!loading && error && <div style={{ color: 'var(--text2)', fontSize: 13, padding: '16px 0' }}>{error === 'not_enough_data' ? t('incr.errNotEnough', null, 'Not enough history yet.') : error === 'no_channels' ? t('incr.errNoChannels', null, 'Connect Meta or Google Ads.') : t('incr.errGeneric', null, 'Could not compute right now.')}</div>}

        {data?.ok && <RecosCard recos={curvesRecos(data, { t, x, pct, names: data.channelNames })} />}

        {data?.ok && channels.map(c => {
          const col = CH_COLOR[c.key] || TEAL
          const curve = data.curves?.[c.key] || []
          const maxX = curve.length ? curve[curve.length - 1].spend : c.avgSpend * 3
          const curY = interp(curve, c.avgSpend)
          const nowFrac = maxX > 0 ? Math.max(0, Math.min(1, c.avgSpend / maxX)) : 0.5
          const carry = (c.carryover || []).map((w, i) => ({ day: i === 0 ? t('incr.today', null, 'today') : `+${i}`, w: Math.round(w * 100) }))
          return (
            <div key={c.key} className="glass-card-static" style={{ padding: 18, borderRadius: 16, marginBottom: 16, borderTop: `2px solid ${col}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: col }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{data.channelNames?.[c.key] || c.key}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>· {t('incr.atSpend', { s: eur(c.avgSpend) }, `at ${eur(c.avgSpend)}/day`)} · {t('incr.mRoasShort', { x: x(c.mRoas) }, `next-€ ${x(c.mRoas)}`)} · {t('incr.satShort', { p: pct(c.saturation) }, `${pct(c.saturation)} saturated`)}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 16, alignItems: 'stretch' }}>
                {/* Response curve */}
                <div style={{ minWidth: 0 }}>
                  <div className="label" style={{ marginBottom: 6 }}>{t('incr.responseCurve', null, 'Response curve · daily spend → incremental revenue')}</div>
                  {/* Callout "sei qui" esplicito */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: col + '14', border: `1px solid ${col}44`, borderRadius: 10, padding: '6px 12px', marginBottom: 8, fontSize: 12 }}>
                    <span style={{ color: col, fontWeight: 900 }}>📍 {t('incr.youAreHereNow', null, 'You are here')}</span>
                    <span style={{ color: 'var(--text2)' }}>{t('incr.hereDetail', { s: eur(c.avgSpend), r: eur(curY) }, `${eur(c.avgSpend)}/day → ${eur(curY)}/day incremental`)}</span>
                    <span style={{ color: c.saturation >= 0.8 ? '#ef4444' : '#22c55e', fontWeight: 800 }}>· {pct(c.saturation)} {t('incr.satWord', null, 'saturated')}</span>
                  </div>
                  <ResponsiveContainer width="100%" height={210}>
                    <ComposedChart data={curve} margin={{ top: 14, right: 12, left: -6, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`incGrad-${c.key}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset={0} stopColor="#22c55e" />
                          <stop offset={nowFrac} stopColor="#22c55e" />
                          <stop offset={nowFrac} stopColor="#ef4444" />
                          <stop offset={1} stopColor="#ef4444" />
                        </linearGradient>
                        <linearGradient id={`incFill-${c.key}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset={0} stopColor="#22c55e" stopOpacity={0.30} />
                          <stop offset={nowFrac} stopColor="#22c55e" stopOpacity={0.20} />
                          <stop offset={nowFrac} stopColor="#ef4444" stopOpacity={0.22} />
                          <stop offset={1} stopColor="#ef4444" stopOpacity={0.08} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="spend" type="number" domain={[0, maxX]} tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => `€${(v / 1000).toFixed(1)}k`} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => `€${(v / 1000).toFixed(1)}k`} />
                      <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => v == null ? '—' : eur(v)} labelFormatter={(l) => t('incr.spendDay', { s: eur(l) }, `${eur(l)}/day`)} />
                      <Area type="monotone" dataKey="revenue" stroke={`url(#incGrad-${c.key})`} strokeWidth={3} fill={`url(#incFill-${c.key})`} name={t('incr.incrementalRev', null, 'incremental revenue')} />
                      <ReferenceLine x={c.avgSpend} stroke="#fff" strokeDasharray="4 3" strokeOpacity={0.85} label={{ value: t('incr.now', null, 'now'), position: 'top', fill: '#fff', fontSize: 11, fontWeight: 800 }} />
                      <ReferenceDot x={c.avgSpend} y={curY} r={6} fill={col} stroke="#fff" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    <span style={{ color: '#22c55e' }}>■</span> {t('incr.greenScale', null, 'green = room to scale')} · <span style={{ color: '#ef4444' }}>■</span> {t('incr.redWaste', null, 'red = saturating')}
                  </div>
                </div>

                {/* Carryover */}
                <div style={{ minWidth: 0 }}>
                  <div className="label" style={{ marginBottom: 8 }}>{t('incr.carryoverTitle', null, 'Carryover · how long it works')}</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={carry} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} interval={1} />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} unit="%" />
                      <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => `${v}%`} />
                      <Bar dataKey="w" fill={col} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{t('incr.carryExplain', { d: c.carryoverDays90 }, `90% of the effect lands within ${c.carryoverDays90} days.`)}</div>
                </div>
              </div>
            </div>
          )
        })}

        {data?.ok && (
          <>
            <div className="glass-card-static" style={{ padding: 18, borderRadius: 16, marginBottom: 14 }}>
              <div className="label" style={{ marginBottom: 10 }}>{t('curvesExp.title', null, 'How to read this data')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 12 }}>
                {[
                  ['curvesExp.d1T', 'Response curve', 'curvesExp.d1D', 'Shows how much incremental revenue each level of daily spend brings. Steep at first, then it flattens (diminishing returns).'],
                  ['curvesExp.d2T', "The 'now' point", 'curvesExp.d2D', "The vertical line and dot are your current spend. To the left (green) each euro still pays off well; to the right (red) you're saturating."],
                  ['curvesExp.d3T', 'Saturation', 'curvesExp.d3D', 'The % shows how close you are to the curve ceiling. Above ~80%, adding budget returns little.'],
                  ['curvesExp.d4T', 'Carryover', 'curvesExp.d4D', "The bars show how many days today's euro keeps driving sales (here, days to 90% of the effect)."],
                ].map(([kt, ft, kd, fd]) => (
                  <div key={kt} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>{t(kt, null, ft)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, marginTop: 4 }}>{t(kd, null, fd)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
              <Icon name="warning" size={12} /> {t('incr.disclaimer', null, 'Directional estimate from your own data (MMM-lite). For causal certainty, validate with a geo-lift test.')}
            </div>
          </>
        )}
      </FxCard>
    </div>
  )
}
