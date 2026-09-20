'use client'

import AzioneBarra from './ui/AzioneBarra'
import Pannello from './ui/Pannello'
import { Kpi, Live, Pastiglia, Scheletro } from './ui/Mattoni'
import { soldi } from '../../lib/client/soldi'
import { Fonte } from './ui/FasceTabella'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'
import { preloadClienti, getClientiCache, setClientiCache } from '../../lib/clienti/preload'
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// ── Clienti: segmentazione RFM + Analytics (stile Digismoothie) + campagne AI ──
// Cache condivisa (memoria + sessionStorage) via lib/clienti/preload.

const SEG_ORDER = ['new', 'potentialLoyal', 'loyal', 'loyalAtRisk', 'aboutToSleep', 'sleepers']
const SEG_COLOR = {
  new: '#3b82f6', potentialLoyal: '#22c55e', loyal: '#0ea5e9',
  loyalAtRisk: '#ef4444', aboutToSleep: '#f5b301', sleepers: '#9ca3af',
}

export default function ClientiTab({ onNavigate }) {
  const { t, locale, intlLocale } = useI18n()
  const [data, setData] = useState(() => getClientiCache())
  const [loading, setLoading] = useState(() => !getClientiCache())
  const [error, setError] = useState('')
  const [view, setView] = useState('overview') // overview | analytics | insights
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState('')

  // Insight AI
  const [insights, setInsights] = useState(null)
  const [insLoading, setInsLoading] = useState(false)
  const [insError, setInsError] = useState('')

  // Drill segmento (lista clienti)
  const [segView, setSegView] = useState(null)
  const [segSearch, setSegSearch] = useState('')

  // Modale campagna
  const [campSeg, setCampSeg] = useState(null)
  const [camp, setCamp] = useState(null)
  const [campLoading, setCampLoading] = useState(false)
  const [campError, setCampError] = useState('')
  const [copied, setCopied] = useState('')

  const load = async (refresh = false) => {
    const cached = getClientiCache()
    if (!refresh && cached) { setData(cached); setLoading(false); return }
    if (!cached) setLoading(true)
    setError('')
    const j = await preloadClienti(refresh)
    if (!j || !j.ok) { setError(j?.error || 'Errore'); setLoading(false); return }
    setData(j); setLoading(false)
  }
  useEffect(() => {
    const cached = getClientiCache()
    if (cached) {
      setData(cached); setLoading(false)
      preloadClienti(false).then(j => { if (j && j.ok) { setClientiCache(j); setData(j) } }).catch(() => {})
    } else { load() }
  }, []) // eslint-disable-line

  const cur = data?.currency || 'EUR'
  const fmtMoney = (n, d = 0) => soldi(n, d, { valuta: cur })
  const fmtInt = (n) => (n == null ? '—' : new Intl.NumberFormat(intlLocale).format(Math.round(n)))
  const fmtNum = (n, d = 1) => (n == null ? '—' : new Intl.NumberFormat(intlLocale, { maximumFractionDigits: d }).format(n))
  const pct = (n) => (n == null ? '—' : `${fmtNum(n, 1)}%`)

  const k = data?.kpis || {}
  const segs = data?.segments || {}
  const series = data?.series || []
  const meta = (key) => SEG_COLOR[key]
  const segLabel = (key) => ({
    new: t('cli.seg.new', null, 'Nuovi'), potentialLoyal: t('cli.seg.potentialLoyal', null, 'Potenziali fedeli'),
    loyal: t('cli.seg.loyal', null, 'Fedeli'), loyalAtRisk: t('cli.seg.loyalAtRisk', null, 'Fedeli a rischio'),
    aboutToSleep: t('cli.seg.aboutToSleep', null, 'Stanno per dormire'), sleepers: t('cli.seg.sleepers', null, 'Dormienti'),
  }[key] || key)
  const segDesc = (key) => ({
    new: t('cli.d.new', null, 'Primo ordine di recente'), potentialLoyal: t('cli.d.potentialLoyal', null, 'Più ordini di recente'),
    loyal: t('cli.d.loyal', null, 'Ordinano spesso e regolarmente'), loyalAtRisk: t('cli.d.loyalAtRisk', null, 'Erano fedeli, non ordinano da un po\''),
    aboutToSleep: t('cli.d.aboutToSleep', null, 'Primo ordine un po\' di tempo fa'), sleepers: t('cli.d.sleepers', null, 'Primo ordine molto tempo fa'),
  }[key] || '')

  const fmtWeek = (iso) => { try { const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString(intlLocale, { day: '2-digit', month: 'short' }) } catch { return iso } }
  const chartSeries = useMemo(() => series.slice(-26), [series])
  const last = series[series.length - 1] || null
  const prev = series[series.length - 2] || null
  const deltaRetention = last && prev ? last.retention - prev.retention : null
  const deltaClv = last && prev ? last.clv - prev.clv : null
  const loyalCount = (segs.loyal?.count || 0) + (segs.potentialLoyal?.count || 0)
  const LAB_FT = t('cli.firstTime', null, 'Nuovi'), LAB_RT = t('cli.returning', null, 'Di ritorno')

  const segChanges = useMemo(() => {
    if (series.length < 2) return []
    const a = series[series.length - 2].segments || {}, b = series[series.length - 1].segments || {}
    return SEG_ORDER.map(key => ({ key, delta: (b[key] || 0) - (a[key] || 0) }))
  }, [series])

  // ── Azioni ──────────────────────────────────────────────────────────────
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
  const openSegment = (key) => { setSegView(key); setSegSearch('') }

  // ── Insight AI (cache per stato dei dati in sessionStorage) ──────────────
  const insSig = `${k.totalCustomers || 0}-${series.length}-${last?.week || ''}-${locale}`
  const genInsights = async (force = false) => {
    if (insLoading) return
    if (!force) {
      try { const raw = sessionStorage.getItem('lyft_clienti_ins'); if (raw) { const c = JSON.parse(raw); if (c.sig === insSig && c.data) { setInsights(c.data); return } } } catch {}
    }
    setInsLoading(true); setInsError('')
    try {
      const segMetrics = {}
      for (const key of SEG_ORDER) { const s = segs[key]; if (s) segMetrics[key] = { count: s.count, customerValue: s.customerValue, avgOrders: s.avgOrders, daysBetween: s.daysBetween, aov: s.aov, totalSales: s.totalSales } }
      const r = await fetch('/api/customers/insights', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kpis: k, segments: segMetrics, currency: cur, locale }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore')
      setInsights(j)
      try { sessionStorage.setItem('lyft_clienti_ins', JSON.stringify({ sig: insSig, data: j })) } catch {}
    } catch (e) { setInsError(e.message) } finally { setInsLoading(false) }
  }
  useEffect(() => { if (view === 'insights' && !insights && !insLoading && (k.totalCustomers || 0) > 0) genInsights() }, [view]) // eslint-disable-line

  if (loading) return <Scheletro kpi={5} righe={6} />
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
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            
            <Live />
          </div>
        </div>
        <AzioneBarra icona="refresh" titolo={t('shell.refresh', null, 'Aggiorna')} onClick={() => load(true)} />
      </div>

      {/* Switcher Panoramica / Analytics */}
      <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--glass2)', border: '1px solid var(--border)', marginBottom: 24 }}>
        {[['overview', t('cli.view.overview', null, 'Panoramica')], ['analytics', t('cli.view.analytics', null, 'Analytics')], ['insights', t('cli.view.insights', null, 'Insight'), true]].map(([id, lab, ai]) => (
          <button key={id} onClick={() => setView(id)} className={`ly-linguetta senza-tocco${view === id ? ' aperta' : ''}`}>{ai && <Icon name="sparkle" />}{lab}</button>
        ))}
      </div>

      {view === 'overview' && (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14, marginBottom: 26 }}>
            <KpiCard title={t('cli.kpi.customers', null, 'Clienti')} value={fmtInt(totalCust)} delta={k.deltaCustomers} color="#7b5bff"
              sub={`${LAB_FT} ${fmtInt(k.firstTime)} (${pct(ftPct)}) · ${LAB_RT} ${fmtInt(k.returning)} (${pct(rtPct)})`} />
            <KpiCard title={t('cli.kpi.value', null, 'Valore cliente (CLV)')} value={fmtMoney(k.clv, 2)} color="#0ea5e9"
              sub={`${LAB_FT} ${fmtMoney(k.ft?.customerValue, 0)} · ${LAB_RT} ${fmtMoney(k.rt?.customerValue, 0)}`} />
            <KpiCard title={t('cli.kpi.opc', null, 'Ordini per cliente')} value={fmtNum(k.ordersPerCustomer, 1)} color="#22c55e"
              sub={`${LAB_FT} ${fmtNum(k.ft?.ordersPerCustomer, 1)} · ${LAB_RT} ${fmtNum(k.rt?.ordersPerCustomer, 1)}`} />
            <KpiCard title={t('cli.kpi.days', null, 'Giorni tra gli ordini')} value={k.daysBetween == null ? '—' : fmtInt(k.daysBetween)} color="#f5b301"
              sub={t('cli.retention', null, 'Retention') + ' ' + pct(k.retention)} />
            <KpiCard title={t('cli.kpi.aov', null, 'Scontrino medio')} value={fmtMoney(k.aov, 2)} color="#ff7849"
              sub={`${LAB_FT} ${fmtMoney(k.ft?.aov, 0)} · ${LAB_RT} ${fmtMoney(k.rt?.aov, 0)}`} />
          </div>

          {/* Tabella segmenti (righe cliccabili → drill) */}
          <div style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--glass)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="tab-lyft" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 920 }}>
                <thead>
                  <tr style={{ color: 'var(--text2)', textAlign: 'left' }}>
                    <th style={th}><Fonte loghi={['shopify']} />{t('cli.col.segment', null, 'Segmento')}</th>
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
                      <tr key={key} onClick={() => openSegment(key)} className="cli-row" style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 8, height: 30, borderRadius: 6, background: meta(key) }} />
                            <div>
                              <div style={{ color: 'var(--text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>{segLabel(key)} <span style={{ color: 'var(--text2)', fontSize: 13, fontWeight: 500 }}>›</span></div>
                              <div style={{ color: 'var(--text2)', fontSize: 13 }}>{segDesc(key)}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...td, textAlign: 'right', color: 'var(--text)', fontWeight: 600 }}>{fmtInt(s.count)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(s.customerValue, 2)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{fmtNum(s.avgOrders, 1)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{s.daysBetween == null ? '—' : fmtInt(s.daysBetween)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(s.aov, 2)}</td>
                        <td style={{ ...td, textAlign: 'right', color: 'var(--text)' }}>{fmtMoney(s.totalSales)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <button onClick={(e) => { e.stopPropagation(); openCampaign(key) }} disabled={!s.count} className="ly-btn">
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
        </>
      )}

      {view === 'analytics' && (
        // ── ANALYTICS (stile Digismoothie) ──────────────────────────────────
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>{last ? t('cli.updatedOn', { d: fmtWeek(last.week) }, `Dati aggiornati al ${fmtWeek(last.week)}`) : ''}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {backfillMsg && <span style={{ fontSize: 13, color: 'var(--text2)' }}>{backfillMsg}</span>}
              <button onClick={runBackfill} disabled={backfilling} style={btnGhost}>
                <Icon name="layers" /> {backfilling ? t('cli.backfilling', null, 'Ricostruisco…') : t('cli.backfill', null, 'Ricostruisci storico')}
              </button>
            </div>
          </div>

          {series.length < 2 ? (
            <div style={{ borderRadius: 16, border: '1px dashed var(--border2)', background: 'var(--glass)', padding: 26, color: 'var(--text2)', fontSize: 15 }}>
              {t('cli.noHistory', null, 'Ancora pochi dati storici. Premi “Ricostruisci storico” per generare gli andamenti dagli ordini passati, oppure aspetta che si accumulino settimana dopo settimana.')}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))', gap: 16 }}>
              {/* Customers */}
              <AnalyticsCard accent="#14b8a6" title={t('cli.chart.customers', null, 'Clienti')} headline={fmtInt(totalCust)} delta={k.deltaCustomers} over={t('cli.over.customers', null, 'CLIENTI NEL TEMPO')}>
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={chartSeries.map(s => ({ week: fmtWeek(s.week), [LAB_FT]: s.firstTime, [LAB_RT]: s.returning }))} barCategoryGap="22%">
                    <defs>
                      <linearGradient id="gFt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0e7a5f" stopOpacity={1} /><stop offset="100%" stopColor="#0e7a5f" stopOpacity={0.45} /></linearGradient>
                      <linearGradient id="gRt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#67ffd6" stopOpacity={1} /><stop offset="100%" stopColor="#34d6b0" stopOpacity={0.7} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="week" tick={tick} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                    <YAxis tick={tick} width={44} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
                    <Bar dataKey={LAB_FT} stackId="a" fill="url(#gFt)" maxBarSize={26} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                    <Bar dataKey={LAB_RT} stackId="a" fill="url(#gRt)" radius={[5, 5, 0, 0]} maxBarSize={26} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
              </AnalyticsCard>

              {/* Retention rate */}
              <AnalyticsCard accent="#22c55e" title={t('cli.chart.retention', null, 'Tasso di retention')} headline={pct(k.retention)} delta={deltaRetention} deltaFmt={(v) => `${v > 0 ? '+' : ''}${fmtNum(v, 1)}%`} over={t('cli.over.retention', null, 'RETENTION NEL TEMPO')}>
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={chartSeries.map(s => ({ week: fmtWeek(s.week), v: s.retention }))}>
                    <defs>
                      <linearGradient id="aRet" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
                      <filter id="glowGreen" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="week" tick={tick} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                    <YAxis tick={tick} width={44} unit="%" axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => pct(v)} />
                    <Area type="monotone" dataKey="v" stroke="#0a84ff" strokeWidth={2.5} fill="url(#aRet)" dot={false} activeDot={{ r: 5, fill: '#34f5a0', stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive animationDuration={1000} />
                  </AreaChart>
                </ResponsiveContainer>
              </AnalyticsCard>

              {/* CLV */}
              <AnalyticsCard accent="#0ea5e9" title={t('cli.chart.clv', null, 'Valore cliente (CLV)')} headline={fmtMoney(k.clv, 2)} delta={deltaClv} deltaFmt={(v) => `${v > 0 ? '+' : ''}${fmtMoney(v, 0)}`} over={t('cli.over.clv', null, 'CLV NEL TEMPO')}>
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={chartSeries.map(s => ({ week: fmtWeek(s.week), v: s.clv }))}>
                    <defs>
                      <linearGradient id="aClv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0a84ff" stopOpacity={0.45} /><stop offset="100%" stopColor="#0a84ff" stopOpacity={0} /></linearGradient>
                      <filter id="glowBlue" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="week" tick={tick} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                    <YAxis tick={tick} width={52} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(v, 2)} />
                    <Area type="monotone" dataKey="v" stroke="#0a84ff" strokeWidth={2.5} fill="url(#aClv)" dot={false} activeDot={{ r: 5, fill: '#38bdf8', stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive animationDuration={1000} />
                  </AreaChart>
                </ResponsiveContainer>
              </AnalyticsCard>

              {/* Loyal & potential loyal */}
              <AnalyticsCard accent="#0ea5e9" title={t('cli.chart.loyal', null, 'Fedeli e potenziali fedeli')} headline={fmtInt(loyalCount)} over={t('cli.over.loyal', null, 'FEDELI E POTENZIALI NEL TEMPO')}>
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={chartSeries.map(s => ({ week: fmtWeek(s.week), [segLabel('loyal')]: s.segments.loyal, [segLabel('potentialLoyal')]: s.segments.potentialLoyal }))} barCategoryGap="22%">
                    <defs>
                      <linearGradient id="gLoyal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={1} /><stop offset="100%" stopColor="#0a84ff" stopOpacity={0.6} /></linearGradient>
                      <linearGradient id="gPot" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80" stopOpacity={1} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0.6} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="week" tick={tick} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                    <YAxis tick={tick} width={44} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
                    <Bar dataKey={segLabel('loyal')} stackId="l" fill="url(#gLoyal)" maxBarSize={26} isAnimationActive animationDuration={900} />
                    <Bar dataKey={segLabel('potentialLoyal')} stackId="l" fill="url(#gPot)" radius={[5, 5, 0, 0]} maxBarSize={26} isAnimationActive animationDuration={900} />
                  </BarChart>
                </ResponsiveContainer>
              </AnalyticsCard>

              {/* Customers per segment (100%) */}
              <AnalyticsCard accent="#7b5bff" title={t('cli.chart.perSegment', null, 'Clienti per segmento')} over={t('cli.over.perSegment', null, 'CLIENTI PER SEGMENTO')}>
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={chartSeries.map(s => ({ week: fmtWeek(s.week), ...s.segments }))} stackOffset="expand" barCategoryGap="20%">
                    <defs>
                      {SEG_ORDER.map(key => (
                        <linearGradient key={key} id={`gSeg-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={meta(key)} stopOpacity={1} /><stop offset="100%" stopColor={meta(key)} stopOpacity={0.55} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="week" tick={tick} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                    <YAxis tick={tick} width={44} tickFormatter={(v) => `${Math.round(v * 100)}%`} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmtInt(v), segLabel(n)]} />
                    {SEG_ORDER.map((key, i) => <Bar key={key} dataKey={key} stackId="s" fill={`url(#gSeg-${key})`} maxBarSize={30} radius={i === SEG_ORDER.length - 1 ? [5, 5, 0, 0] : 0} isAnimationActive animationDuration={900} />)}
                  </BarChart>
                </ResponsiveContainer>
              </AnalyticsCard>

              {/* Segment changes */}
              <AnalyticsCard accent="#7b5bff" title={t('cli.chart.changes', null, 'Variazioni di segmento')} over={t('cli.over.changes', null, 'ULTIMA SETTIMANA')}>
                <div style={{ padding: '4px 4px 8px' }}>
                  {segChanges.map(c => {
                    const up = c.delta > 0, down = c.delta < 0
                    return (
                      <div key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 6px', borderTop: '1px solid var(--border)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text)', fontSize: 13 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 6, background: meta(c.key), boxShadow: 'none' }} /> {segLabel(c.key)}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 640, fontSize: 13, padding: '3px 9px', borderRadius: 8,
                          color: up ? '#34f5a0' : down ? '#fb7185' : 'var(--text2)',
                          background: up ? 'rgba(34,197,94,0.12)' : down ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)' }}>
                          {up ? '▲' : down ? '▼' : '–'} {c.delta > 0 ? '+' : ''}{fmtInt(c.delta)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </AnalyticsCard>
            </div>
          )}
        </>
      )}

      {view === 'insights' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ color: '#a78bfa' }}><Icon name="sparkle" /></span>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{t('cli.ins.by', null, 'Generato dalla Squadra AI sui tuoi dati')}</span>
            </div>
            <button onClick={() => genInsights(true)} disabled={insLoading} style={btnGhost}>
              <Icon name="refresh" /> {insLoading ? t('cli.ins.thinking', null, 'Analizzo…') : t('cli.ins.regen', null, 'Rigenera')}
            </button>
          </div>

          {insLoading && !insights && (
            <div style={{ borderRadius: 16, border: '1px solid rgba(167,139,250,0.25)', background: 'radial-gradient(120% 80% at 0% 0%, rgba(123,91,255,0.10), rgba(255,255,255,0.02) 55%)', padding: 30, color: 'var(--text2)', textAlign: 'center' }}>
              {t('cli.ins.thinkingLong', null, 'La Squadra AI sta leggendo i segmenti e prepara insight e azioni…')}
            </div>
          )}
          {insError && (
            <div style={{ padding: 20 }}>
              <div style={{ color: '#fca5a5', marginBottom: 12 }}>{insError}</div>
              <button onClick={() => genInsights(true)} style={btnGhost}>{t('common.retry', null, 'Riprova')}</button>
            </div>
          )}

          {insights && (
            <div style={{ display: 'grid', gap: 20 }}>
              {insights.headline && (
                <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', padding: '20px 22px',
                  border: '1px solid rgba(167,139,250,0.28)', background: 'radial-gradient(130% 90% at 0% 0%, rgba(123,91,255,0.16), rgba(255,255,255,0.02) 60%)' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #a78bfa, transparent)', opacity: 0.7 }} />
                  <div style={{ fontSize: 11.5, color: '#a78bfa', letterSpacing: 0.8, fontWeight: 600, marginBottom: 8 }}>{t('cli.ins.summary', null, 'IN SINTESI')}</div>
                  <div style={{ fontSize: 15, color: 'var(--text)', fontWeight: 600, lineHeight: 1.5 }}>{insights.headline}</div>
                </div>
              )}

              {/* Insight descrittivi */}
              {!!(insights.insights || []).length && (
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)', margin: '0 0 12px' }}>{t('cli.ins.findings', null, 'Cosa dicono i dati')}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
                    {insights.insights.map((ins, i) => {
                      const tone = ins.tone === 'good' ? '#22c55e' : ins.tone === 'warn' ? '#f59e0b' : '#0ea5e9'
                      return (
                        <div key={i} style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--glass)', padding: '14px 16px', borderLeft: `3px solid ${tone}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ width: 7, height: 7, borderRadius: 999, background: tone, boxShadow: 'none' }} />
                            <span style={{ fontWeight: 640, color: 'var(--text)', fontSize: 15 }}>{ins.title}</span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 }}>{ins.detail}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Raccomandazioni proattive */}
              {!!(insights.recommendations || []).length && (
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)', margin: '0 0 12px' }}>{t('cli.ins.actions', null, 'Azioni consigliate')}</h3>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {insights.recommendations.map((rec, i) => {
                      const c = meta(rec.segment) || '#7b5bff'
                      const prio = String(rec.priority || '').toLowerCase()
                      const prioColor = prio.includes('alt') || prio.includes('high') ? '#ef4444' : prio.includes('med') ? '#f59e0b' : '#22c55e'
                      return (
                        <div key={i} style={{ borderRadius: 16, border: '1px solid var(--border)', background: `radial-gradient(120% 100% at 0% 0%, ${c}12, rgba(255,255,255,0.02) 60%)`, padding: '16px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 240 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6, flexWrap: 'wrap' }}>
                                <span style={{ width: 9, height: 9, borderRadius: 6, background: c, boxShadow: 'none' }} />
                                <span style={{ fontWeight: 640, color: 'var(--text)', fontSize: 15 }}>{rec.title}</span>
                                <span style={{ fontSize: 10, fontWeight: 640, letterSpacing: 0.4, color: prioColor, background: prioColor + '1f', padding: '2px 8px', borderRadius: 8, textTransform: 'uppercase' }}>{rec.priority}</span>
                                <span style={{ fontSize: 11.5, color: 'var(--text2)' }}>· {segLabel(rec.segment)}</span>
                              </div>
                              {rec.action && <div style={{ fontSize: 13, color: '#e9e9e9', lineHeight: 1.55, marginBottom: 6 }}>{rec.action}</div>}
                              {rec.why && <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}><strong style={{ color: 'var(--text)' }}>{t('cli.ins.why', null, 'Perché')}:</strong> {rec.why}</div>}
                              {rec.impact && <div style={{ fontSize: 13, color: c, marginTop: 6, fontWeight: 600 }}>↗ {rec.impact}</div>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <button onClick={() => openCampaign(rec.segment)} className="ly-btn"><Icon name="sparkle" /> {t('cli.createCampaign', null, 'Crea campagna')}</button>
                              <button onClick={() => openSegment(rec.segment)} style={{ ...btnGhost, whiteSpace: 'nowrap', justifyContent: 'center' }}><Icon name="users" /> {t('cli.ins.viewCustomers', null, 'Vedi clienti')}</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Drill segmento: lista clienti ── */}
      {segView && (() => {
        const s = segs[segView] || {}
        const all = s.customers || []
        const q = segSearch.trim().toLowerCase()
        const list = q ? all.filter(c => (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)) : all
        return (
          <Pannello titolo={segLabel(segView)} sotto={`${fmtInt(s.count)} ${t('cli.customersLower', null, 'clienti')}`} larghezza={880} onClose={() => setSegView(null)}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 14px', flexWrap: 'wrap' }}>
                <input value={segSearch} onChange={(e) => setSegSearch(e.target.value)} placeholder={t('cli.searchPlaceholder', null, 'Cerca per nome o email…')}
                  style={{ flex: 1, minWidth: 200, padding: '9px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--glass)', color: 'var(--text)', fontSize: 13 }} />
                <button onClick={() => openCampaign(segView)} className="ly-btn primario"><Icon name="sparkle" /> {t('cli.createCampaign', null, 'Crea campagna')}</button>
              </div>
              <div style={{ overflowY: 'auto', maxHeight: '60vh', borderRadius: 12, border: '1px solid var(--border)' }}>
                <table className="tab-lyft" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ color: 'var(--text2)', textAlign: 'left', position: 'sticky', top: 0, background: 'var(--surface)' }}>
                    <th style={th2}><Fonte loghi={['shopify']} />{t('cli.col.name', null, 'Cliente')}</th>
                    <th style={th2}>{t('cli.col.email', null, 'Email')}</th>
                    <th style={{ ...th2, textAlign: 'right' }}>{t('cli.col.orders2', null, 'Ordini')}</th>
                    <th style={{ ...th2, textAlign: 'right' }}>{t('cli.col.spent', null, 'Speso')}</th>
                    <th style={{ ...th2, textAlign: 'right' }}>{t('cli.col.last', null, 'Ultimo ordine')}</th>
                  </tr></thead>
                  <tbody>
                    {list.map((c, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ ...td2, color: 'var(--text)', fontWeight: 600 }}>{c.name}</td>
                        <td style={{ ...td2, color: 'var(--text2)' }}>{c.email || '—'}</td>
                        <td style={{ ...td2, textAlign: 'right' }}>{fmtInt(c.orders)}</td>
                        <td style={{ ...td2, textAlign: 'right', color: 'var(--text)', fontWeight: 600 }}>{fmtMoney(c.spent)}</td>
                        <td style={{ ...td2, textAlign: 'right', color: 'var(--text2)' }}>{c.lastDays >= 9999 ? '—' : t('cli.daysAgo', { d: c.lastDays }, `${c.lastDays} gg fa`)}</td>
                      </tr>
                    ))}
                    {!list.length && <tr><td colSpan={5} style={{ ...td2, textAlign: 'center', color: 'var(--text2)', padding: 24 }}>{t('cli.empty', null, 'Nessun cliente.')}</td></tr>}
                  </tbody>
                </table>
              </div>
              {s.count > all.length && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 10 }}>{t('cli.capped2', { shown: all.length, total: fmtInt(s.count) }, `Mostrati i primi ${all.length} per spesa di ${fmtInt(s.count)}.`)}</div>}
            </div>
          </Pannello>
        )
      })()}

      {/* ── Modale campagna ── */}
      {campSeg && (
        <Pannello titolo={<>{t('cli.campaignFor', null, 'Campagna per')} · {segLabel(campSeg)}</>} larghezza={760} onClose={closeCampaign}>
          <div>
            <p style={{ color: 'var(--text2)', fontSize: 13, margin: '0 0 16px' }}>
              {fmtInt(segs[campSeg]?.count)} {t('cli.customersLower', null, 'clienti')} · {segEmails(campSeg).length} {t('cli.withEmail', null, 'con email')}
            </p>
            {campLoading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text2)' }}>{t('cli.generating', null, 'La Squadra AI sta scrivendo l\'email…')}</div>}
            {campError && <div style={{ color: '#fca5a5', padding: '6px 0' }}>{campError}</div>}
            {camp && (
              <div style={{ display: 'grid', gap: 14 }}>
                {camp.angle && (
                  <div style={{ fontSize: 13, color: meta(campSeg), background: meta(campSeg) + '14', borderRadius: 12, padding: '10px 12px' }}>
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
                  <div style={{ whiteSpace: 'pre-wrap', background: 'var(--glass)', borderRadius: 12, padding: '14px 16px', color: 'var(--text)', fontSize: 15, lineHeight: 1.6, border: '1px solid var(--border)' }}>{camp.body}</div>
                </div>
                {camp.cta && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, color: 'var(--text2)' }}>{t('cli.field.cta', null, 'Bottone')}:</span>
                    <span style={{ padding: '7px 16px', borderRadius: 999, background: meta(campSeg), color: 'var(--surface)', fontWeight: 640, fontSize: 13 }}>{camp.cta}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <button onClick={() => copy('emails', segEmails(campSeg).join(', '))} style={btnGhost}>
                    <Icon name="users" /> {copied === 'emails' ? t('cli.copied', null, 'Copiato') : t('cli.copyEmails', { n: segEmails(campSeg).length }, `Copia ${segEmails(campSeg).length} email`)}
                  </button>
                  <button onClick={() => onNavigate && onNavigate('klaviyo')} style={{ ...btnPrimary, background: meta(campSeg), color: 'var(--surface)' }}>
                    <Icon name="mail" /> {t('cli.openKlaviyo', null, 'Apri Klaviyo')}
                  </button>
                  <button onClick={() => openCampaign(campSeg)} style={btnGhost}><Icon name="refresh" /> {t('cli.regenerate', null, 'Rigenera')}</button>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text2)', margin: 0 }}>{t('cli.klaviyoHint', null, 'Incolla le email come segmento/lista in Klaviyo e usa oggetto e corpo qui sopra. L\'invio resta sempre una tua scelta.')}</p>
              </div>
            )}
          </div>
        </Pannello>
      )}

      <style>{`.cli-row:hover{background:rgba(255,255,255,0.035)}`}</style>
    </div>
  )
}

function KpiCard({ title, value, sub, delta }) {
  return (
    <Kpi etichetta={title} valore={value} nota={sub} famiglia="vendite" fonti={['shopify']}>
      {delta != null && delta !== 0 && <Pastiglia tono={delta > 0 ? 'positivo' : 'negativo'}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}</Pastiglia>}
    </Kpi>
  )
}

function AnalyticsCard({ title, headline, delta, deltaFmt, over, accent = '#7b5bff', children }) {
  return (
    <div style={{
      position: 'relative', borderRadius: 16, overflow: 'hidden',
      border: '1px solid var(--border)',
      background: `radial-gradient(120% 80% at 0% 0%, ${accent}14, rgba(255,255,255,0.02) 55%)`,
      boxShadow: `0 12px 40px ${accent}10, inset 0 1px 0 rgba(255,255,255,0.04)`,
      padding: '18px 16px 10px',
    }}>
      {/* filo luminoso superiore */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'none', opacity: 0.7 }} />
      <div style={{ padding: '0 4px' }}>
        <div style={{ fontWeight: 640, color: 'var(--text)', fontSize: 15 }}>{title}</div>
        {headline != null && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '6px 0 2px' }}>
            <span style={{ fontSize: 22, fontWeight: 680, color: 'var(--text)', letterSpacing: -0.5, textShadow: `0 0 22px ${accent}66` }}>{headline}</span>
            {delta != null && delta !== 0 && (
              <span style={{ fontSize: 13, fontWeight: 640, padding: '2px 8px', borderRadius: 8,
                color: delta > 0 ? '#34f5a0' : '#fb7185', background: delta > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }}>
                {delta > 0 ? '▲' : '▼'} {deltaFmt ? deltaFmt(Math.abs(delta)) : Math.abs(delta)}
              </span>
            )}
          </div>
        )}
        {over && <div style={{ fontSize: 10, color: 'var(--text2)', letterSpacing: 0.9, margin: '8px 0 8px', fontWeight: 600 }}>{over}</div>}
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
      <div style={{ background: 'var(--glass)', borderRadius: 12, padding: '10px 14px', color: 'var(--text)', fontSize: 15, border: '1px solid var(--border)' }}>{value || '—'}</div>
    </div>
  )
}

const th = { padding: '11px 18px', fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4 }
const td = { padding: '12px 18px' }
const th2 = { padding: '10px 14px', fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.4 }
const td2 = { padding: '10px 14px' }
const tick = { fill: 'var(--text3)', fontSize: 11.5 }
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 13 }
const legendStyle = { fontSize: 11.5, paddingTop: 4 }
const btnGhost = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--glass)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 12, border: 'none', fontWeight: 640, fontSize: 13, cursor: 'pointer' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 20 }
// Il pop-up prende i colori dal tema: con lo sfondo fisso #14141b restava
// nero anche in versione giorno, con dentro testo bianco su bianco.
const modal = { width: 'min(680px,100%)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22, color: 'var(--text)' }
const fieldHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)', marginBottom: 6, fontWeight: 600 }
const copyBtn = { background: 'transparent', border: 'none', color: '#7b9bff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const liveBadge = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 8, background: 'rgba(34,197,94,0.16)', color: '#22c55e', fontSize: 11.5, fontWeight: 640, letterSpacing: 0.3 }
const liveDot = { width: 6, height: 6, borderRadius: 999, background: '#22c55e', boxShadow: 'none' }
