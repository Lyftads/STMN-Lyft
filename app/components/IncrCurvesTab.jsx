'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import FxCard from './ui/FxCard'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { ComposedChart, Line, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts'

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

        {data?.ok && channels.map(c => {
          const col = CH_COLOR[c.key] || TEAL
          const curve = (data.curves?.[c.key] || []).map(p => ({ ...p, eff: p.spend <= c.avgSpend ? p.revenue : null, sat: p.spend > c.avgSpend ? p.revenue : null }))
          const curY = interp(data.curves?.[c.key], c.avgSpend)
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
                  <div className="label" style={{ marginBottom: 8 }}>{t('incr.responseCurve', null, 'Response curve · daily spend → incremental revenue')}</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={curve} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="spend" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => `€${(v / 1000).toFixed(1)}k`} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => `€${(v / 1000).toFixed(1)}k`} />
                      <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => v == null ? '—' : eur(v)} labelFormatter={(l) => t('incr.spendDay', { s: eur(l) }, `${eur(l)}/day`)} />
                      <Area type="monotone" dataKey="eff" stroke="#22c55e" strokeWidth={2.5} fill="rgba(34,197,94,0.12)" name={t('incr.efficient', null, 'room to scale')} connectNulls />
                      <Line type="monotone" dataKey="sat" stroke="#ef4444" strokeWidth={2.5} dot={false} name={t('incr.saturated', null, 'diminishing')} connectNulls />
                      <ReferenceDot x={c.avgSpend} y={curY} r={5} fill={col} stroke="#fff" strokeWidth={1.5} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    <span style={{ color: col, fontWeight: 800 }}>●</span> {t('incr.youAreHere', null, 'you are here')} · <span style={{ color: '#22c55e' }}>{t('incr.greenScale', null, 'green = scale')}</span> · <span style={{ color: '#ef4444' }}>{t('incr.redWaste', null, 'red = saturating')}</span>
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
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
            <Icon name="warning" size={12} /> {t('incr.disclaimer', null, 'Directional estimate from your own data (MMM-lite). For causal certainty, validate with a geo-lift test.')}
          </div>
        )}
      </FxCard>
    </div>
  )
}
