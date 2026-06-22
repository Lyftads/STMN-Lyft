'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Vista normalizzata per provider email diversi da Klaviyo (Omnisend/Mailchimp).
// Consuma /api/email-marketing (contratto: kpis, campaigns, flows, notes).

const PROVIDER_META = {
  omnisend:  { name: 'Omnisend',  color: '#7c3aed' },
  mailchimp: { name: 'Mailchimp', color: '#e0a800' },
}

const DAYS = [
  { v: 7, k: 'em.d7', label: '7 giorni' },
  { v: 30, k: 'em.d30', label: '30 giorni' },
  { v: 90, k: 'em.d90', label: '90 giorni' },
]

export default function EmailProviderView({ provider }) {
  const { t } = useI18n()
  const meta = PROVIDER_META[provider] || { name: provider, color: '#22c55e' }
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/email-marketing?days=${days}`, { cache: 'no-store', signal: AbortSignal.timeout(40000) })
      .then(r => r.json())
      .then(j => { if (active) setData(j) })
      .catch(() => { if (active) setData({ error: 'network' }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [days])

  const k = data?.kpis || {}
  const campaigns = data?.campaigns || []
  const eur = (v) => v == null ? '—' : '€' + Number(v).toLocaleString('it-IT', { maximumFractionDigits: 0 })
  const int = (v) => v == null ? '—' : Number(v).toLocaleString('it-IT')
  const pct = (v) => v == null ? '—' : `${Number(v).toFixed(1)}%`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ width: 42, height: 42, borderRadius: 11, background: meta.color + '22', color: meta.color, display: 'grid', placeItems: 'center' }}><Icon name="mail" size={16} /></span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>{t('em.title', null, 'Email Marketing')}</div>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: meta.color + '22', color: meta.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{meta.name}</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>{t('em.subtitle', null, 'Performance email: invii, aperture, click, revenue per campagna.')}</div>
        </div>
        <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border)', borderRadius: 999, padding: 3, gap: 2 }}>
          {DAYS.map(d => {
            const on = days === d.v
            return (
              <button key={d.v} onClick={() => setDays(d.v)} style={{
                background: on ? meta.color : 'transparent', color: on ? '#fff' : 'var(--text3)',
                border: 'none', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>{t(d.k, null, d.label)}</button>
            )
          })}
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{t('em.loading', null, 'Carico i dati…')}</div>}

      {!loading && data?.error && (
        <div className="glass-card-static" style={{ padding: 18, color: '#fca5a5', fontSize: 13 }}>
          {t('em.error', null, 'Impossibile leggere i dati dal provider in questo momento.')}
        </div>
      )}

      {!loading && !data?.error && (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <Kpi label={t('em.sent', null, 'Inviate')} value={int(k.sent)} color={meta.color} />
            <Kpi label={t('em.openRate', null, 'Open rate')} value={pct(k.openRate)} color={meta.color} />
            <Kpi label={t('em.clickRate', null, 'Click rate')} value={pct(k.clickRate)} color={meta.color} />
            <Kpi label={t('em.opened', null, 'Aperture')} value={int(k.opened)} color={meta.color} />
            <Kpi label={t('em.clicked', null, 'Click')} value={int(k.clicked)} color={meta.color} />
            <Kpi label={t('em.unsub', null, 'Disiscritti')} value={int(k.unsubscribed)} color={meta.color} />
            <Kpi label={t('em.revenue', null, 'Revenue')} value={eur(k.revenue)} color={meta.color} />
          </div>

          {/* Campaigns table */}
          <div className="glass-card-static" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 900, color: 'var(--text)' }}>
              {t('em.campaigns', null, 'Campagne')} <span style={{ color: 'var(--text3)', fontWeight: 600 }}>({campaigns.length})</span>
            </div>
            {campaigns.length === 0 ? (
              <div style={{ padding: 22, color: 'var(--text3)', fontSize: 13 }}>{t('em.noCampaigns', null, 'Nessuna campagna nel periodo selezionato.')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <th style={th}>{t('em.campaign', null, 'Campagna')}</th>
                      <th style={thR}>{t('em.recipients', null, 'Destinatari')}</th>
                      <th style={thR}>{t('em.openRate', null, 'Open rate')}</th>
                      <th style={thR}>{t('em.clickRate', null, 'Click rate')}</th>
                      <th style={thR}>{t('em.revenue', null, 'Revenue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.slice(0, 50).map(c => (
                      <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ ...td, fontWeight: 700, color: 'var(--text)' }}>{c.name}</td>
                        <td style={tdR}>{int(c.recipients)}</td>
                        <td style={tdR}>{pct(c.openRate)}</td>
                        <td style={tdR}>{pct(c.clickRate)}</td>
                        <td style={{ ...tdR, fontWeight: 800, color: c.revenue ? 'var(--green)' : 'var(--text3)' }}>{eur(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {Array.isArray(data?.notes) && data.notes.length > 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.6 }}>
              {data.notes.map((n, i) => <div key={i}>· {n}</div>)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, color }) {
  return (
    <div className="glass-card-static" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 6, fontFamily: 'Barlow', letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  )
}

const th = { textAlign: 'left', padding: '10px 20px', fontWeight: 700 }
const thR = { ...th, textAlign: 'right' }
const td = { padding: '11px 20px', color: 'var(--text2)' }
const tdR = { ...td, textAlign: 'right' }
