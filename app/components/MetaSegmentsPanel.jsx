'use client'

import { soldi } from '../../lib/client/soldi'
import { useEffect, useState } from 'react'
import Sparkline from './Sparkline'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Pannello "CAC per segmento di pubblico" (Meta). Breakdown nativo user_segment_key
// (Nuovi / Esistenti / Engaged / Sconosciuto). Per ogni segmento: CAC con sparkline
// (andamento giornaliero) e delta % vs stesso periodo precedente.
// Riusato in KPI Brain. Props: since, until.
const eur0 = (n) => soldi(n)
const eur2 = (n) => soldi(n, 2)
const int0 = (n) => (n == null ? '—' : Number(n).toLocaleString('it-IT', { useGrouping: 'always' }))

const ORDER = [
  { key: 'new', label: 'Nuovi clienti', color: '#22c55e' },
  { key: 'returning', label: 'Clienti esistenti', color: '#2997ff' },
  { key: 'engaged', label: 'Engaged (no acquisto)', color: '#f59e0b' },
  { key: 'unknown', label: 'Sconosciuto', color: '#8c8c8c' },
]

// Delta % per metrica "lower is better" (CAC): un calo è positivo (verde).
function Delta({ cur, prev }) {
  if (cur == null || prev == null || !Number.isFinite(prev) || prev === 0) return null
  const pct = ((cur - prev) / Math.abs(prev)) * 100
  if (Math.abs(pct) < 0.05) return <span style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 600 }}>= prec.</span>
  const good = cur < prev // CAC più basso = meglio
  return (
    <span style={{ fontSize: 11.5, fontWeight: 640, color: good ? '#22c55e' : '#f87171' }}>
      {cur > prev ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

export default function MetaSegmentsPanel({ since, until, title = null }) {
  const { t } = useI18n()
  const [segs, setSegs] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!since || !until) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/meta-segments?preset=custom&since=${since}&until=${until}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!cancelled) { setSegs(j?.ok ? j.segments : null); setLoading(false) } })
      .catch(() => { if (!cancelled) { setSegs(null); setLoading(false) } })
    return () => { cancelled = true }
  }, [since, until])

  if (!loading && !segs) return null

  const card = { background: 'var(--glass, rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 680, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title || t('seg.metaCacTitle', null, 'Meta · CAC by audience segment')}</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>{t('seg.metaRealData', null, 'Real Meta data (account-level audience segments) · vs same previous period')}</div>
      </div>
      {loading && !segs && <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('seg.metaLoading', null, 'Loading Meta segments…')}</div>}
      {segs && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {ORDER.map(({ key, label, color }) => {
            const s = segs[key] || {}
            const isNew = key === 'new'
            const prevCac = s.prevTotals?.cac ?? s.prevTotals?.cpo
            const spark = (s.daily || []).map(d => d.cac).filter(v => v != null && Number.isFinite(v))
            return (
              <div key={key} style={{ ...card, borderColor: isNew ? `${color}66` : 'var(--border)', boxShadow: isNew ? `0 0 0 1px ${color}33` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 10, fontWeight: 640, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text2)' }}>{t('pseg.' + key, null, label)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 680, color: s.cac == null ? 'var(--text3)' : 'var(--text)' }}>{eur2(s.cac)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>CAC{isNew ? t('pseg.cacNewSuffix', null, ' · new customers') : ''}</div>
                  </div>
                  {spark.length >= 2 && <Sparkline data={spark} color={color} width={74} height={30} />}
                </div>
                <div style={{ marginTop: 6 }}><Delta cur={s.cac} prev={prevCac} /></div>
                <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8, display: 'grid', gap: 4 }}>
                  {[[t('common.spend', null, 'Spend'), eur0(s.spend)], [t('common.purchases', null, 'Purchases'), int0(s.purchases)], ['ROAS', s.roas ? `${s.roas}×` : '—']].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text3)' }}>{l}</span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
