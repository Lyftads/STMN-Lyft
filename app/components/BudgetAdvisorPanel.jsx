'use client'

import { useEffect, useState } from 'react'
import { swrFetch, getCached } from '../../lib/clientCache'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import FxCard from './ui/FxCard'
import BmTimeframe from './ui/BmTimeframe'
import { tfQuery, tfKey } from '../../lib/tfQuery'
import { PlatformBadges } from './PlatformIcon'
import Icon from './ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Accoda un'azione nella Coda Azioni (Fase 1: proposta → approvazione umana).
function ApplyButton({ qstate, onClick }) {
  const { t } = useI18n()
  if (qstate === 'queued') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: 'var(--green)', flexShrink: 0 }}><Icon name="check" size={13} /> {t('aq.inQueue')}</span>
  return (
    <button onClick={onClick} disabled={qstate === 'busy'} title={t('aq.applyTitle')} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
      padding: '7px 12px', borderRadius: 9, cursor: qstate === 'busy' ? 'wait' : 'pointer',
      background: 'rgba(123,91,255,0.16)', border: '1px solid rgba(123,91,255,0.4)',
      color: '#c4b5fd', fontSize: 11.5, fontWeight: 800,
    }}>
      <Icon name="bolt" size={13} /> {qstate === 'busy' ? '…' : qstate === 'err' ? t('aq.retry') : t('aq.apply')}
    </button>
  )
}

function DeltaBadge({ d, lowerBetter = false }) {
  if (!d || d.pct == null) return null
  const up = d.pct > 0, good = lowerBetter ? !up : up
  return <span style={{ fontSize: 10, fontWeight: 800, marginLeft: 6, color: good ? 'var(--green)' : 'var(--red)' }}>{up ? '▲' : '▼'} {Math.abs(d.pct).toFixed(1)}%</span>
}

const ACT = {
  scala: { color: 'var(--green)', bg: 'rgba(48,209,88,0.14)', label: 'SCALA' },
  mantieni: { color: 'var(--text2)', bg: 'var(--glass2)', label: 'MANTIENI' },
  riduci: { color: 'var(--orange)', bg: 'rgba(255,159,10,0.14)', label: 'RIDUCI' },
  taglia: { color: 'var(--red)', bg: 'rgba(255,69,58,0.14)', label: 'TAGLIA' },
}
const eur = (n) => `€${Number(n || 0).toLocaleString('it-IT')}`
const eur2 = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

export default function BudgetAdvisorPanel() {
  const { t } = useI18n()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [account, setAccount] = useState('')
  const [tf, setTf] = useState({ preset: 'last_28d' })
  const preset = tf.preset
  const [queued, setQueued] = useState({})

  const enqueue = async (key, body) => {
    setQueued(q => ({ ...q, [key]: 'busy' }))
    try {
      const r = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      setQueued(q => ({ ...q, [key]: j.ok ? 'queued' : 'err' }))
    } catch { setQueued(q => ({ ...q, [key]: 'err' })) }
  }

  useEffect(() => {
    let cancelled = false
    setError(null)
    const url = `/api/budget-advisor?${tfQuery(tf)}${account ? `&account=${encodeURIComponent(account)}` : ''}`
    const key = `budget-advisor:${tfKey(tf)}:${account}`
    const cached = getCached(key)
    if (cached) {
      setData(cached.data)
    } else {
      setLoading(true)
    }
    swrFetch({
      key,
      fetcher: () => fetch(url).then(r => r.json()),
      onUpdate: (fresh) => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => {
        if (cancelled) return
        if (j.error && !(j.campaigns?.length)) setError(j.error)
        if (!cached) setData(j)
      })
      .catch(e => { if (!cancelled && !cached) setError(e?.message || 'Errore di rete') })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }, [account, tf])

  const accounts = data?.accounts || []
  const camps = data?.campaigns || []
  const delta = data?.delta || {}
  const chartData = camps.slice(0, 10).map(c => ({ name: (c.name || '').slice(0, 12), attuale: c.spend, consigliata: c.suggestedSpend }))
  const shown = showAll ? camps : camps.slice(0, 12)
  const re = data?.reallocation || {}

  const Stat = ({ label, value, tone, d, lowerBetter }) => (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div className="label" style={{ fontSize: 9 }}>{label}</div>
        <PlatformBadges sources={['meta']} size={14} />
      </div>
      <div className="metric-value-sm" style={{ color: tone || 'var(--text)' }}>{value}<DeltaBadge d={d} lowerBetter={lowerBetter} /></div>
    </div>
  )

  return (
    <div style={{ marginTop: 24 }}>
      <FxCard delay={2.2}>
        <p style={{ margin: '0 0 16px', color: 'var(--text3)', fontSize: 12.5 }}>{t('ba.subtitle')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <PlatformBadges sources={['meta']} size={18} />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <BmTimeframe value={tf} onChange={setTf} accent="#2997ff" disabled={loading} />
            {accounts.length > 1 && (
              <select value={account} onChange={(e) => setAccount(e.target.value)} className="btn-glass" style={{ padding: '9px 12px', fontWeight: 600, cursor: 'pointer', maxWidth: 280 }}>
                <option value="" style={{ background: 'var(--surface)' }}>{t('flt.allAccounts')}</option>
                {accounts.map(a => <option key={a.id} value={a.id} style={{ background: 'var(--surface)' }}>{a.name}</option>)}
              </select>
            )}
          </div>
        </div>
        {loading && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '18px 0' }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> {t('ba.loading')}</div>}
        {!loading && error && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>{error}</div>}
        {!loading && !error && camps.length === 0 && <div style={{ color: 'var(--text2)', fontSize: 13, padding: '12px 0' }}>{t('ba.empty')}</div>}

        {camps.length > 0 && (
          <>
            <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, margin: '16px 0 16px' }}>
              <Stat label={t('ba.stat.totalSpend')} value={eur(data.totalSpend)} d={delta.spend} />
              <Stat label={t('ba.stat.mer')} value={`${data.mer}x`} tone={data.mer >= 2 ? 'var(--green)' : data.mer >= 1 ? 'var(--orange)' : 'var(--red)'} d={delta.mer} />
              <Stat label={t('ba.stat.toScale')} value={data.counts?.scala || 0} tone="var(--green)" />
              <Stat label={t('ba.stat.toReduce')} value={(data.counts?.riduci || 0) + (data.counts?.taglia || 0)} tone="var(--red)" />
            </div>

            {re.freed > 0 && (
              <div className="glass-card-static" style={{ padding: '14px 16px', borderRadius: 12, borderLeft: '3px solid var(--accent)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700, marginBottom: 4 }}>
                    {t('aq.sum.shift', { amount: eur(re.freed), cut: re.avgCutRoas, scale: re.avgScaleRoas })}
                  </div>
                  {re.forecastDelta > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {t('ba.forecastPre')} <strong style={{ color: 'var(--green)' }}>+{eur(re.forecastDelta)}</strong> {t('ba.forecastPost')}
                    </div>
                  )}
                </div>
                <ApplyButton qstate={queued.realloc} onClick={() => enqueue('realloc', {
                  channel: 'meta', source: 'budget_advisor', type: 'shift_budget',
                  target_name: t('aq.target.realloc'),
                  payload: { freed: re.freed, avgCutRoas: re.avgCutRoas, avgScaleRoas: re.avgScaleRoas, forecastDelta: re.forecastDelta || 0 },
                  summary: t('aq.sum.shift', { amount: eur(re.freed), cut: re.avgCutRoas, scale: re.avgScaleRoas }),
                })} />
              </div>
            )}

            <div className="stagger" style={{ display: 'grid', gap: 8 }}>
              {shown.map((c, i) => {
                const a = ACT[c.action] || ACT.mantieni
                return (
                  <div key={i} className="glass-card-static" style={{ padding: 12, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14, borderLeft: `3px solid ${a.color}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 7px', borderRadius: 4, background: a.bg, color: a.color, letterSpacing: '.05em', flexShrink: 0 }}>{t('ba.act.' + (ACT[c.action] ? c.action : 'mantieni'))}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                      </div>
                      {c.deltaPct !== 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
                          {t('ba.budgetLabel')} {eur2(c.spend)} → <strong style={{ color: a.color }}>{c.deltaPct === -100 ? t('ba.pause') : eur2(c.suggestedSpend)}</strong> {c.deltaPct !== -100 && <span>({c.deltaPct > 0 ? '+' : ''}{c.deltaPct}%)</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexShrink: 0, textAlign: 'right' }}>
                      <Metric label={t('m.spend')} value={eur2(c.spend)} />
                      <Metric label={t('m.roas')} value={`${c.roas}x`} tone={c.roas >= 2 ? 'var(--green)' : c.roas >= 1 ? 'var(--orange)' : 'var(--red)'} />
                      <Metric label={t('m.cpa')} value={eur2(c.cpa)} />
                    </div>
                    {c.action !== 'mantieni' && (() => {
                      const key = c.id || `c${i}`
                      const isPause = c.deltaPct === -100
                      return <ApplyButton qstate={queued[key]} onClick={() => enqueue(key, {
                        channel: 'meta', source: 'budget_advisor',
                        type: isPause ? 'pause_campaign' : 'scale_budget',
                        target_ref: c.id || null, target_name: c.name,
                        payload: { delta_pct: c.deltaPct, from_spend: c.spend, to_spend: c.suggestedSpend, roas: c.roas, action: c.action },
                        summary: isPause
                          ? t('aq.sum.pause', { name: c.name, roas: c.roas })
                          : c.deltaPct > 0
                            ? t('aq.sum.scale', { name: c.name, pct: c.deltaPct, from: eur2(c.spend), to: eur2(c.suggestedSpend) })
                            : t('aq.sum.reduce', { name: c.name, pct: Math.abs(c.deltaPct), from: eur2(c.spend), to: eur2(c.suggestedSpend) }),
                      })} />
                    })()}
                  </div>
                )
              })}
            </div>

            {camps.length > 12 && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button onClick={() => setShowAll(v => !v)} className="btn-glass" style={{ padding: '9px 24px', cursor: 'pointer' }}>
                  {showAll ? t('flt.showLess') : t('flt.showAll', { n: camps.length })}
                </button>
              </div>
            )}

            {chartData.length > 0 && (
              <div className="glass-card-static reveal-zoom" style={{ marginTop: 22, padding: 18, borderRadius: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>{t('ba.chartTitle')}</div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="baAtt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2997ff" stopOpacity={0.95} /><stop offset="100%" stopColor="#2997ff" stopOpacity={0.35} /></linearGradient>
                      <linearGradient id="baCon" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#30d158" stopOpacity={0.95} /><stop offset="100%" stopColor="#30d158" stopOpacity={0.35} /></linearGradient>
                      <filter id="baGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={48} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: 'var(--text2)' }} formatter={(v) => eur2(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="attuale" name={t('ba.chart.current')} fill="url(#baAtt)" radius={[5, 5, 0, 0]} animationDuration={1400} animationEasing="ease-out" style={{ filter: 'url(#baGlow)' }} />
                    <Bar dataKey="consigliata" name={t('ba.chart.suggested')} fill="url(#baCon)" radius={[5, 5, 0, 0]} animationDuration={1400} animationEasing="ease-out" style={{ filter: 'url(#baGlow)' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </FxCard>
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
