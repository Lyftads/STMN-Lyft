'use client'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// ── Clienti: segmentazione RFM + metriche + grafici nel tempo + campagne AI ──
// Self-fetch + cache di modulo, isolato e multi-tenant.

let __cliCache = null

const SEG_ORDER = ['new', 'potentialLoyal', 'loyal', 'loyalAtRisk', 'aboutToSleep', 'sleepers']
const SEG_COLOR = {
  new: '#3b82f6', potentialLoyal: '#22c55e', loyal: '#0ea5e9',
  loyalAtRisk: '#ef4444', aboutToSleep: '#f5b301', sleepers: '#9ca3af',
}

export default function ClientiTab({ onNavigate }) {
  const { t, locale, intlLocale } = useI18n()
  const [data, setData] = useState(() => __cliCache)
  const [loading, setLoading] = useState(!__cliCache)
  const [error, setError] = useState('')
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState('')

  // Modale campagna
  const [campSeg, setCampSeg] = useState(null)
  const [camp, setCamp] = useState(null)
  const [campLoading, setCampLoading] = useState(false)
  const [campError, setCampError] = useState('')
  const [copied, setCopied] = useState('')

  const load = async (refresh = false) => {
    if (!refresh && __cliCache) { setData(__cliCache); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/customers${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore')
      __cliCache = j; setData(j)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { if (__cliCache) { setData(__cliCache); setLoading(false) } else load() }, []) // eslint-disable-line

  const cur = data?.currency || 'EUR'
  const fmtMoney = (n, d = 0) => (n == null ? '—' : new Intl.NumberFormat(intlLocale, { style: 'currency', currency: cur, maximumFractionDigits: d }).format(n))
  const fmtInt = (n) => (n == null ? '—' : new Intl.NumberFormat(intlLocale).format(Math.round(n)))
  const fmtNum = (n, d = 1) => (n == null ? '—' : new Intl.NumberFormat(intlLocale, { maximumFractionDigits: d }).format(n))
  const pct = (n) => (n == null ? '—' : `${fmtNum(n, 1)}%`)

  const k = data?.kpis || {}
  const segs = data?.segments || {}
  const series = data?.series || []
  const meta = (key) => SEG_COLOR[key]
  const segLabel = (key) => ({
    new: t('cli.seg.new', null, 'Nuovi'),
    potentialLoyal: t('cli.seg.potentialLoyal', null, 'Potenziali fedeli'),
    loyal: t('cli.seg.loyal', null, 'Fedeli'),
    loyalAtRisk: t('cli.seg.loyalAtRisk', null, 'Fedeli a rischio'),
    aboutToSleep: t('cli.seg.aboutToSleep', null, 'Stanno per dormire'),
    sleepers: t('cli.seg.sleepers', null, 'Dormienti'),
  }[key] || key)
  const segDesc = (key) => ({
    new: t('cli.d.new', null, 'Primo ordine di recente'),
    potentialLoyal: t('cli.d.potentialLoyal', null, 'Più ordini di recente'),
    loyal: t('cli.d.loyal', null, 'Ordinano spesso e regolarmente'),
    loyalAtRisk: t('cli.d.loyalAtRisk', null, 'Erano fedeli, non ordinano da un po\''),
    aboutToSleep: t('cli.d.aboutToSleep', null, 'Primo ordine un po\' di tempo fa'),
    sleepers: t('cli.d.sleepers', null, 'Primo ordine molto tempo fa'),
  }[key] || '')

  const fmtWeek = (iso) => { try { const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString(intlLocale, { day: '2-digit', month: 'short' }) } catch { return iso } }
  const chartSeries = useMemo(() => series.slice(-26), [series])

  // Variazioni di segmento ultima settimana
  const segChanges = useMemo(() => {
    if (series.length < 2) return []
    const a = series[series.length - 2].segments || {}, b = series[series.length - 1].segments || {}
    return SEG_ORDER.map(key => ({ key, delta: (b[key] || 0) - (a[key] || 0) }))
  }, [series])

  // ── Azione: backfill storico ────────────────────────────────────────────
  const runBackfill = async () => {
    setBackfilling(true); setBackfillMsg('')
    try {
      const r = await fetch('/api/customers/backfill?pages=200', { method: 'POST' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore')
      setBackfillMsg(t('cli.backfillDone', { n: j.weeks }, `Ricostruite ${j.weeks} settimane`))
      await load(true)
    } catch (e) { setBackfillMsg(e.message) } finally { setBackfilling(false) }
  }

  // ── Azione: crea campagna ───────────────────────────────────────────────
  const openCampaign = async (key) => {
    setCampSeg(key); setCamp(null); setCampError(''); setCampLoading(true); setCopied('')
    try {
      const s = segs[key] || {}
      const r = await fetch('/api/customers/campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: key, locale, stats: { count: s.count, value: s.totalSales, currency: cur } }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore generazione')
      setCamp(j)
    } catch (e) { setCampError(e.message) } finally { setCampLoading(false) }
  }
  const closeCampaign = () => { setCampSeg(null); setCamp(null); setCampError(''); setCopied('') }
  const copy = async (what, text) => { try { await navigator.clipboard.writeText(text || ''); setCopied(what); setTimeout(() => setCopied(''), 1600) } catch {} }
  const segEmails = (key) => (segs[key]?.customers || []).map(c => c.email).filter(Boolean)

  if (loading) return <div style={{ padding: 40, color: 'var(--text2)' }}>{t('cli.loading', null, 'Carico i clienti da Shopify…')}</div>
  if (error) return (
    <div style={{ padding: 24 }}>
      <div style={{ color: '#fca5a5', marginBottom: 12 }}>{error}</div>
      <button onClick={() => load(true)} style={btnGhost}>{t('common.retry', null, 'Riprova')}</button>
    </div>
  )

  const totalCust = k.totalCustomers || 0
  const ftPct = totalCust ? (k.firstTime / totalCust) * 100 : 0
  const rtPct = totalCust ? (k.returning / totalCust) * 100 : 0

  return (
    <div style={{ padding: '8px 4px 60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff', margin: 0 }}>{t('cli.title', null, 'Clienti')}</h1>
            <span style={liveBadge}><span style={liveDot} /> LIVE</span>
          </div>
          <p style={{ color: 'var(--text2)', margin: '6px 0 0', fontSize: 14, maxWidth: 680 }}>
            {t('cli.subtitle2', null, 'Clienti divisi per ciclo di vita (RFM). Scegli un segmento e lancia la campagna giusta in un click.')}
          </p>
        </div>
        <button onClick={() => load(true)} style={btnGhost}><Icon name="refresh" /> {t('common.refresh', null, 'Aggiorna')}</button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14, marginBottom: 26 }}>
        <KpiCard title={t('cli.kpi.customers', null, 'Clienti')} value={fmtInt(totalCust)} delta={k.deltaCustomers} color="#7b5bff"
          sub={`${t('cli.firstTime', null, 'Nuovi')} ${fmtInt(k.firstTime)} (${pct(ftPct)}) · ${t('cli.returning', null, 'Di ritorno')} ${fmtInt(k.returning)} (${pct(rtPct)})`} />
        <KpiCard title={t('cli.kpi.value', null, 'Valore cliente (CLV)')} value={fmtMoney(k.clv, 2)} color="#0ea5e9"
          sub={`${t('cli.firstTime', null, 'Nuovi')} ${fmtMoney(k.ft?.customerValue, 0)} · ${t('cli.returning', null, 'Di ritorno')} ${fmtMoney(k.rt?.customerValue, 0)}`} />
        <KpiCard title={t('cli.kpi.opc', null, 'Ordini per cliente')} value={fmtNum(k.ordersPerCustomer, 1)} color="#22c55e"
          sub={`${t('cli.firstTime', null, 'Nuovi')} ${fmtNum(k.ft?.ordersPerCustomer, 1)} · ${t('cli.returning', null, 'Di ritorno')} ${fmtNum(k.rt?.ordersPerCustomer, 1)}`} />
        <KpiCard title={t('cli.kpi.days', null, 'Giorni tra gli ordini')} value={k.daysBetween == null ? '—' : fmtInt(k.daysBetween)} color="#f5b301"
          sub={t('cli.retention', null, 'Retention') + ' ' + pct(k.retention)} />
        <KpiCard title={t('cli.kpi.aov', null, 'Scontrino medio')} value={fmtMoney(k.aov, 2)} color="#ff7849"
          sub={`${t('cli.firstTime', null, 'Nuovi')} ${fmtMoney(k.ft?.aov, 0)} · ${t('cli.returning', null, 'Di ritorno')} ${fmtMoney(k.rt?.aov, 0)}`} />
      </div>

      {/* Tabella segmenti */}
      <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden', marginBottom: 28 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 880 }}>
            <thead>
              <tr style={{ color: 'var(--text2)', textAlign: 'left' }}>
                <th style={th}>{t('cli.col.segment', null, 'Segmento')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cli.col.customers', null, 'Clienti')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cli.col.value', null, 'Valore cliente')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cli.col.avgOrders', null, 'Ordini medi')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cli.col.days', null, 'Giorni tra ordini')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cli.col.aov', null, 'Scontrino medio')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cli.col.total', null, 'Vendite totali')}</th>
                <th style={{ ...th, textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {SEG_ORDER.map(key => {
                const s = segs[key] || {}
                return (
                  <tr key={key} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 8, height: 30, borderRadius: 3, background: meta(key) }} />
                        <div>
                          <div style={{ color: '#fff', fontWeight: 700 }}>{segLabel(key)}</div>
                          <div style={{ color: 'var(--text2)', fontSize: 12 }}>{segDesc(key)}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: '#fff', fontWeight: 700 }}>{fmtInt(s.count)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(s.customerValue, 2)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtNum(s.avgOrders, 1)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{s.daysBetween == null ? '—' : fmtInt(s.daysBetween)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(s.aov, 2)}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#fff' }}>{fmtMoney(s.totalSales)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => openCampaign(key)} disabled={!s.count} style={{ ...btnPrimary, background: s.count ? meta(key) : 'rgba(255,255,255,0.06)', color: s.count ? '#0b0b0f' : 'var(--text2)', cursor: s.count ? 'pointer' : 'not-allowed', padding: '7px 12px' }}>
                        <Icon name="sparkle" /> {t('cli.createCampaign', null, 'Crea campagna')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grafici nel tempo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, color: '#fff', margin: 0 }}>{t('cli.trends', null, 'Andamento nel tempo')}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {backfillMsg && <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>{backfillMsg}</span>}
          <button onClick={runBackfill} disabled={backfilling} style={btnGhost}>
            <Icon name="layers" /> {backfilling ? t('cli.backfilling', null, 'Ricostruisco…') : t('cli.backfill', null, 'Ricostruisci storico')}
          </button>
        </div>
      </div>

      {series.length < 2 ? (
        <div style={{ borderRadius: 16, border: '1px dashed rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.02)', padding: 26, color: 'var(--text2)', fontSize: 14 }}>
          {t('cli.noHistory', null, 'Ancora pochi dati storici. Premi “Ricostruisci storico” per generare gli andamenti dagli ordini passati, oppure aspetta che si accumulino settimana dopo settimana.')}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
            <ChartCard title={t('cli.chart.customers', null, 'Clienti nel tempo')}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartSeries.map(s => ({ week: fmtWeek(s.week), [t('cli.firstTime', null, 'Nuovi')]: s.firstTime, [t('cli.returning', null, 'Di ritorno')]: s.returning }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="week" tick={tick} interval="preserveStartEnd" />
                  <YAxis tick={tick} width={42} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey={t('cli.firstTime', null, 'Nuovi')} stackId="a" fill="#0e7a5f" />
                  <Bar dataKey={t('cli.returning', null, 'Di ritorno')} stackId="a" fill="#5eead4" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t('cli.chart.retention', null, 'Tasso di retention')} value={pct(k.retention)}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartSeries.map(s => ({ week: fmtWeek(s.week), v: s.retention }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="week" tick={tick} interval="preserveStartEnd" />
                  <YAxis tick={tick} width={42} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => pct(v)} />
                  <Line type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t('cli.chart.clv', null, 'Valore cliente (CLV)')} value={fmtMoney(k.clv, 2)}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartSeries.map(s => ({ week: fmtWeek(s.week), v: s.clv }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="week" tick={tick} interval="preserveStartEnd" />
                  <YAxis tick={tick} width={50} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(v, 2)} />
                  <Line type="monotone" dataKey="v" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t('cli.chart.perSegment', null, 'Clienti per segmento')}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartSeries.map(s => ({ week: fmtWeek(s.week), ...s.segments }))} stackOffset="expand">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="week" tick={tick} interval="preserveStartEnd" />
                  <YAxis tick={tick} width={42} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmtInt(v), segLabel(n)]} />
                  {SEG_ORDER.map(key => <Bar key={key} dataKey={key} stackId="s" fill={meta(key)} />)}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Segment changes */}
          {segChanges.length > 0 && (
            <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '16px 18px', marginTop: 16 }}>
              <div style={{ fontWeight: 800, color: '#fff', marginBottom: 12 }}>{t('cli.changes', null, 'Variazioni di segmento (ultima settimana)')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
                {segChanges.map(c => (
                  <div key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 99, background: meta(c.key) }} /> {segLabel(c.key)}
                    </span>
                    <span style={{ fontWeight: 800, color: c.delta > 0 ? '#22c55e' : c.delta < 0 ? '#ef4444' : 'var(--text2)' }}>
                      {c.delta > 0 ? '+' : ''}{fmtInt(c.delta)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modale campagna */}
      {campSeg && (
        <div onClick={closeCampaign} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} style={modal}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: 99, background: meta(campSeg) }} />
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#fff', margin: 0 }}>{t('cli.campaignFor', null, 'Campagna per')} · {segLabel(campSeg)}</h2>
              </div>
              <button onClick={closeCampaign} style={{ ...btnGhost, padding: '6px 10px' }}>✕</button>
            </div>
            <p style={{ color: 'var(--text2)', fontSize: 13, margin: '0 0 16px' }}>
              {fmtInt(segs[campSeg]?.count)} {t('cli.customersLower', null, 'clienti')} · {segEmails(campSeg).length} {t('cli.withEmail', null, 'con email')}
            </p>
            {campLoading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text2)' }}>{t('cli.generating', null, 'La Squadra AI sta scrivendo l\'email…')}</div>}
            {campError && <div style={{ color: '#fca5a5', padding: '6px 0' }}>{campError}</div>}
            {camp && (
              <div style={{ display: 'grid', gap: 14 }}>
                {camp.angle && (
                  <div style={{ fontSize: 13, color: meta(campSeg), background: meta(campSeg) + '14', borderRadius: 10, padding: '10px 12px' }}>
                    <strong>{t('cli.strategy', null, 'Strategia')}:</strong> {camp.angle}
                  </div>
                )}
                <Field label={t('cli.field.subject', null, 'Oggetto')} value={camp.subject} onCopy={() => copy('subject', camp.subject)} copied={copied === 'subject'} t={t} />
                <Field label={t('cli.field.preview', null, 'Anteprima')} value={camp.preview} onCopy={() => copy('preview', camp.preview)} copied={copied === 'preview'} t={t} />
                <div>
                  <div style={fieldHead}>
                    <span>{t('cli.field.body', null, 'Corpo email')}</span>
                    <button onClick={() => copy('body', camp.body)} style={copyBtn}>{copied === 'body' ? t('cli.copied', null, 'Copiato') : t('cli.copy', null, 'Copia')}</button>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: '14px 16px', color: '#e8e8ef', fontSize: 14, lineHeight: 1.6, border: '1px solid rgba(255,255,255,0.07)' }}>{camp.body}</div>
                </div>
                {camp.cta && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, color: 'var(--text2)' }}>{t('cli.field.cta', null, 'Bottone')}:</span>
                    <span style={{ padding: '7px 16px', borderRadius: 99, background: meta(campSeg), color: '#0b0b0f', fontWeight: 800, fontSize: 13 }}>{camp.cta}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <button onClick={() => copy('emails', segEmails(campSeg).join(', '))} style={btnGhost}>
                    <Icon name="users" /> {copied === 'emails' ? t('cli.copied', null, 'Copiato') : t('cli.copyEmails', { n: segEmails(campSeg).length }, `Copia ${segEmails(campSeg).length} email`)}
                  </button>
                  <button onClick={() => onNavigate && onNavigate('klaviyo')} style={{ ...btnPrimary, background: meta(campSeg), color: '#0b0b0f' }}>
                    <Icon name="mail" /> {t('cli.openKlaviyo', null, 'Apri Klaviyo')}
                  </button>
                  <button onClick={() => openCampaign(campSeg)} style={btnGhost}><Icon name="refresh" /> {t('cli.regenerate', null, 'Rigenera')}</button>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text2)', margin: 0 }}>{t('cli.klaviyoHint', null, 'Incolla le email come segmento/lista in Klaviyo e usa oggetto e corpo qui sopra. L\'invio resta sempre una tua scelta.')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ title, value, sub, delta, color }) {
  return (
    <div style={{ borderRadius: 16, padding: '16px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{value}</span>
        {delta != null && delta !== 0 && (
          <span style={{ fontSize: 13, fontWeight: 800, color: delta > 0 ? '#22c55e' : '#ef4444' }}>{delta > 0 ? '↑' : '↓'}{Math.abs(delta)}</span>
        )}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 8 }}>{sub}</div>}
      <div style={{ height: 3, borderRadius: 99, marginTop: 10, background: color, opacity: 0.85 }} />
    </div>
  )
}

function ChartCard({ title, value, children }) {
  return (
    <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '16px 14px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px', marginBottom: 10 }}>
        <span style={{ fontWeight: 800, color: '#fff', fontSize: 14 }}>{title}</span>
        {value != null && <span style={{ fontWeight: 900, color: '#fff', fontSize: 16 }}>{value}</span>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, value, onCopy, copied, t }) {
  return (
    <div>
      <div style={fieldHead}>
        <span>{label}</span>
        <button onClick={onCopy} style={copyBtn}>{copied ? t('cli.copied', null, 'Copiato') : t('cli.copy', null, 'Copia')}</button>
      </div>
      <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 14, border: '1px solid rgba(255,255,255,0.07)' }}>{value || '—'}</div>
    </div>
  )
}

const th = { padding: '11px 18px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }
const td = { padding: '12px 18px' }
const tick = { fill: 'rgba(255,255,255,0.55)', fontSize: 11 }
const tooltipStyle = { background: '#14141b', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, color: '#fff', fontSize: 12 }
const btnGhost = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 20 }
const modal = { width: 'min(680px,100%)', maxHeight: '88vh', overflowY: 'auto', background: '#14141b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 22 }
const fieldHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text2)', marginBottom: 6, fontWeight: 700 }
const copyBtn = { background: 'transparent', border: 'none', color: '#7b9bff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }
const liveBadge = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 9, background: 'rgba(34,197,94,0.16)', color: '#22c55e', fontSize: 11, fontWeight: 800, letterSpacing: 0.3 }
const liveDot = { width: 6, height: 6, borderRadius: 99, background: '#22c55e', boxShadow: '0 0 6px #22c55e' }
