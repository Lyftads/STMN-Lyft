'use client'

// Card "Live View" lato sinistro: Visitatori in questo momento + Sessioni per
// sede. Stessa chiave cache ('realtime') del globo → una sola fetch condivisa.
import { useEffect, useState } from 'react'
import { swrFetch, leggi, inMemoria } from '../../lib/clientCache'
import { useI18n } from '../../lib/i18n/I18nProvider'

// `solo`: 'visitatori' | 'sedi' per montarne uno alla volta (la Dashboard in stile Live View li
// mette in punti diversi della colonna). Senza `solo` restano affiancati, come prima.
export default function LiveStatsCards({ solo, since, until }) {
  const { t, intlLocale } = useI18n()
  const [data, setData] = useState(null)
  // Con un periodo (la Dashboard lo passa) "Sessioni per sede" segue QUEL periodo, come gli altri
  // riquadri; senza, resta chi e' sul sito adesso.
  const urlSedi = since && until ? `/api/sessioni-sedi?since=${since}&until=${until}` : null
  const [sedi, setSedi] = useState(() => (urlSedi ? inMemoria(urlSedi)?.sedi || null : null))
  useEffect(() => {
    if (!urlSedi) return
    let vivo = true
    setSedi(inMemoria(urlSedi)?.sedi || null)
    leggi(urlSedi, { onUpdate: (d) => vivo && d?.ok && setSedi(d.sedi) }).then(d => { if (vivo && d?.ok) setSedi(d.sedi) }).catch(() => {})
    return () => { vivo = false }
  }, [urlSedi])

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
  const locations = urlSedi ? (sedi || []).map(x => ({ country: x.country, city: x.city, activeUsers: x.sessions })) : (data?.byLocation || [])
  const max = locations.reduce((m, l) => Math.max(m, l.activeUsers), 0) || 1

  return (
    <div className="m-stack" style={solo ? { display: 'grid' } : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
      {/* Visitatori in questo momento */}
      {solo !== 'sedi' && <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#34e7b0',
            boxShadow: 'none', animation: 'livePulse 1.6s infinite',
          }} />
          <span style={{ fontSize: 13, color: 'var(--text)', opacity: 0.6, letterSpacing: 0.3 }}>
            {t('live.visitorsNow', null, 'Visitors right now')}
          </span>
        </div>
        {/* Era 44 px scritti qui dentro: il contatore era il numero PIU' GRANDE
            della Dashboard, sopra il fatturato. Ora e' la cifra di tutte le schede. */}
        <div className="ly-kpi-val">{active}</div>
        <div style={{ fontSize: 11.5, opacity: 0.4, marginTop: 8 }}>
          {data?.fonte === 'shopify'
            ? t('live.shopifyNow', { n: data?.ultimi30 ?? 0 }, `${data?.ultimi30 ?? 0} sessioni negli ultimi 30 minuti · Shopify`)
            : t('live.last30min', null, 'Last 30 minutes · GA4 Realtime')}
        </div>
      </div>}

      {/* Sessioni per sede */}
      {solo !== 'visitatori' && <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text)', opacity: 0.6, marginBottom: 14, letterSpacing: 0.3 }}>
          {t('live.sessionsByLocation', null, 'Sessions by location')}
        </div>
        {locations.length === 0 && (
          <div style={{ fontSize: 13, opacity: 0.4 }}>{urlSedi ? (sedi ? t('live.noSessions', null, 'Nessuna sessione nel periodo.') : '…') : t('live.noVisitors', null, 'No active visitors right now')}</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {locations.slice(0, solo ? 6 : 4).map((l, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ opacity: 0.85 }}>
                  {[l.country, l.city].filter(Boolean).join(' · ') || '—'}
                </span>
                <span style={{ opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>{Number(l.activeUsers).toLocaleString(intlLocale, { useGrouping: 'always' })}</span>
              </div>
              <div style={{ height: 4, borderRadius: 6, background: 'var(--glass2)' }}>
                <div style={{
                  height: '100%', borderRadius: 6,
                  width: `${(l.activeUsers / max) * 100}%`,
                  background: 'var(--text3)',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>}
    </div>
  )
}
