'use client'

// Card "Live View" lato sinistro: Visitatori in questo momento + Sessioni per
// sede. Stessa chiave cache ('realtime') del globo → una sola fetch condivisa.
import { useEffect, useState } from 'react'
import { swrFetch } from '../../lib/clientCache'
import { useI18n } from '../../lib/i18n/I18nProvider'

export default function LiveStatsCards() {
  const { t } = useI18n()
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const { data } = await swrFetch({
          key: 'realtime',
          fetcher: () => fetch('/api/realtime').then(r => r.ok ? r.json() : Promise.reject()),
        })
        if (alive) setData(data)
      } catch {}
    }
    load()
    const id = setInterval(load, 20_000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const active = data?.activeUsers || 0
  const locations = data?.byLocation || []
  const max = locations.reduce((m, l) => Math.max(m, l.activeUsers), 0) || 1

  return (
    <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
      {/* Visitatori in questo momento */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#34e7b0',
            boxShadow: '0 0 8px #34e7b0', animation: 'livePulse 1.6s infinite',
          }} />
          <span style={{ fontSize: 12, color: 'var(--text)', opacity: 0.6, letterSpacing: 0.3 }}>
            {t('live.visitorsNow', null, 'Visitors right now')}
          </span>
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1, color: 'var(--text)' }}>
          {active}
        </div>
        <div style={{ fontSize: 11, opacity: 0.4, marginTop: 8 }}>
          {t('live.last30min', null, 'Last 30 minutes · GA4 Realtime')}
        </div>
      </div>

      {/* Sessioni per sede */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text)', opacity: 0.6, marginBottom: 14, letterSpacing: 0.3 }}>
          {t('live.sessionsByLocation', null, 'Sessions by location')}
        </div>
        {locations.length === 0 && (
          <div style={{ fontSize: 13, opacity: 0.4 }}>{t('live.noVisitors', null, 'No active visitors right now')}</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {locations.slice(0, 4).map((l, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ opacity: 0.85 }}>
                  {[l.country, l.city].filter(Boolean).join(' · ') || '—'}
                </span>
                <span style={{ opacity: 0.6 }}>{l.activeUsers}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--glass2)' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${(l.activeUsers / max) * 100}%`,
                  background: 'linear-gradient(90deg,#64d2ff,#34e7b0)',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
