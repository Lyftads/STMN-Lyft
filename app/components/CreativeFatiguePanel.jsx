'use client'

import { soldi } from '../../lib/client/soldi'
import { useStatoTab } from '../../lib/client/statoTab'
import { useEffect, useState } from 'react'
import { swrFetch, getCached } from '../../lib/clientCache'
import FxCard from './ui/FxCard'
import PeriodoInBarra from './ui/PeriodoInBarra'
import { tfQuery, tfKey } from '../../lib/tfQuery'
import { PlatformBadges } from './PlatformIcon'
import Icon from './ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { localeNumeri } from '../../lib/client/numeri'


function DeltaBadge({ d, lowerBetter = false }) {
  if (!d || d.pct == null) return null
  const up = d.pct > 0, good = lowerBetter ? !up : up
  return <span style={{ fontSize: 10, fontWeight: 640, marginLeft: 6, color: good ? 'var(--green)' : 'var(--red)' }}>{up ? '▲' : '▼'} {Math.abs(d.pct).toFixed(1)}%</span>
}

const SEV = {
  high: { color: 'var(--red)', bg: 'rgba(255,69,58,0.14)', label: 'DA RINFRESCARE' },
  medium: { color: 'var(--orange)', bg: 'rgba(255,159,10,0.14)', label: 'OSSERVA' },
  low: { color: 'var(--green)', bg: 'rgba(48,209,88,0.14)', label: 'OK' },
}

const money = (n) => soldi(n, 'auto')
const nf = (n) => Number(n || 0).toLocaleString(localeNumeri(), { useGrouping: 'always' })

export default function CreativeFatiguePanel() {
  const { t } = useI18n()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [account, setAccount] = useState('')
  const [tf, setTf] = useStatoTab('creativeFatigue.tf', { preset: 'last_14d' })
  const preset = tf.preset


  useEffect(() => {
    let cancelled = false
    setError(null)
    const url = `/api/creative-fatigue?${tfQuery(tf)}${account ? `&account=${encodeURIComponent(account)}` : ''}`
    const key = `creative-fatigue:${tfKey(tf)}:${account}`
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
        if (j.error && !(j.ads?.length)) setError(j.error)
        if (!cached) setData(j)
      })
      .catch(e => { if (!cancelled && !cached) setError(e?.message || 'Errore di rete') })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }, [account, tf])

  const delta = data?.delta || {}

  const accounts = data?.accounts || []

  const ads = data?.ads || []
  const maxScore = Math.max(...ads.map(a => a.score || 0), 1)
  const avgCtr = data?.avgCtr || 0
  const avgCpa = data?.avgCpa || 0
  const shown = showAll ? ads : ads.slice(0, 12)

  const freqTone = (f) => (f >= 5 ? 'var(--red)' : f >= 3 ? 'var(--orange)' : 'var(--text)')
  const ctrTone = (c) => (avgCtr > 0 && c < avgCtr * 0.8 ? 'var(--red)' : avgCtr > 0 && c < avgCtr ? 'var(--orange)' : 'var(--text)')
  const cpaTone = (c) => (c == null ? 'var(--text3)' : avgCpa > 0 && c > avgCpa * 1.3 ? 'var(--red)' : avgCpa > 0 && c > avgCpa ? 'var(--orange)' : 'var(--text)')

  const Stat = ({ label, value, tone, d, lowerBetter }) => (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div className="label" style={{ fontSize: 10 }}>{label}</div>
        <PlatformBadges sources={['meta']} size={14} />
      </div>
      <div className="metric-value-sm" style={{ color: tone || 'var(--text)' }}>{value}<DeltaBadge d={d} lowerBetter={lowerBetter} /></div>
    </div>
  )

  return (
    <div style={{ marginTop: 24 }}>
      <FxCard delay={1.8}>
        <p style={{ margin: '0 0 16px', color: 'var(--text3)', fontSize: 13 }}>{t('cf.subtitle')}</p>
        {data?.parziale && <div style={{ fontSize: 12.5, color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>{t('common.partialData', null, 'Dati parziali: la piattaforma non ha restituito tutto il periodo. I numeri qui sotto sono incompleti; riprova fra qualche minuto.')}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <PlatformBadges sources={['meta']} size={18} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.14)', color: '#22c55e', fontSize: 13, fontWeight: 640, letterSpacing: '0.06em' }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#22c55e', boxShadow: 'none' }} />
            LIVE
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <PeriodoInBarra value={tf} onChange={setTf} disabled={loading} />
            {accounts.length > 1 && (
              <select value={account} onChange={(e) => setAccount(e.target.value)} className="btn-glass" style={{ padding: '9px 12px', fontWeight: 600, cursor: 'pointer', maxWidth: 280 }}>
                <option value="" style={{ background: 'var(--surface)' }}>{t('flt.allAccounts')}</option>
                {accounts.map(a => <option key={a.id} value={a.id} style={{ background: 'var(--surface)' }}>{a.name}</option>)}
              </select>
            )}
          </div>
        </div>
        {loading && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '18px 0' }}><span style={{ display: "inline-flex", animation: "spin 1s linear infinite" }}><Icon name="refresh" size={13} /></span> {t('cf.loading')}</div>}
        {!loading && error && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>{error}</div>}
        {!loading && !error && ads.length === 0 && <div style={{ color: 'var(--text2)', fontSize: 13, padding: '12px 0' }}>{t('cf.empty')}</div>}

        {ads.length > 0 && (
          <>
            <div className="stagger-zoom m-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, margin: '16px 0 20px' }}>
              <Stat label={t('cf.stat.analyzed')} value={nf(data.total)} />
              <Stat label={t('cf.stat.toRefresh')} value={nf(data.toRefresh)} tone={data.toRefresh > 0 ? 'var(--red)' : 'var(--green)'} />
              <Stat label={t('cf.stat.avgCtr')} value={`${avgCtr}%`} d={delta.ctr} />
              <Stat label={t('cf.stat.avgCpa')} value={money(avgCpa)} d={delta.cpa} lowerBetter />
            </div>

            <div className="stagger" style={{ display: 'grid', gap: 8 }}>
              {shown.map((a) => {
                const s = SEV[a.severity] || SEV.low
                return (
                  <div key={a.adId} className="glass-card-static" style={{ padding: 12, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Thumbnail della creativa */}
                    <div style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 12, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center' }}>
                      {a.thumbnail
                        ? <img src={a.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { e.target.style.display = 'none' }} />
                        : <span style={{ fontSize: 17, color: 'var(--text3)' }}>▧</span>}
                    </div>

                    {/* Nome + barra fatigue */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 680, padding: '2px 7px', borderRadius: 6, background: s.bg, color: s.color, letterSpacing: '.05em', flexShrink: 0 }}>{t('cf.sev.' + (SEV[a.severity] ? a.severity : 'low'))}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 7 }}>
                        {[a.campaign, a.adset].filter(Boolean).join(' · ') || '—'}
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: 'var(--glass2)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(6, (a.score / maxScore) * 100)}%`, height: '100%', background: s.color, borderRadius: 999 }} />
                      </div>
                    </div>

                    {/* Metriche colorate (no muro di testo) */}
                    <div style={{ display: 'flex', gap: 16, flexShrink: 0, textAlign: 'right' }}>
                      <Metric label={t('m.freq')} value={a.frequency} tone={freqTone(a.frequency)} />
                      <Metric label={t('m.ctr')} value={`${a.ctr}%`} tone={ctrTone(a.ctr)} />
                      <Metric label={t('m.cpa')} value={money(a.cpa)} tone={cpaTone(a.cpa)} />
                      <Metric label={t('m.spend')} value={money(a.spend)} />
                    </div>
                  </div>
                )
              })}
            </div>

            {ads.length > 12 && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button onClick={() => setShowAll(v => !v)} className="btn-glass" style={{ padding: '9px 24px', cursor: 'pointer' }}>
                  {showAll ? t('flt.showLess') : t('flt.showAll', { n: ads.length })}
                </button>
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
    <div style={{ minWidth: 44 }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 640, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 680, color: tone, fontFamily: 'inherit' }}>{value}</div>
    </div>
  )
}
