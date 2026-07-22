'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import FxCard from './ui/FxCard'
import { useI18n } from '../../lib/i18n/I18nProvider'

const WINDOWS = [6, 12, 18, 24]

function repeatColor(pct) {
  if (pct >= 25) return '#30d158'
  if (pct >= 12) return '#ff9f0a'
  return '#ff453a'
}

export default function LtvCohortsTab() {
  const { t, intlLocale } = useI18n()
  const nloc = intlLocale || 'it-IT'
  const eur = (n) => (n == null ? '—' : `€${Number(n).toLocaleString(nloc, { maximumFractionDigits: 0 })}`)
  const eur2 = (n) => (n == null ? '—' : `€${Number(n).toLocaleString(nloc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  const nf = (n) => Number(n || 0).toLocaleString(nloc)
  const sinceLabel = (since) => {
    if (!since) return ''
    const [y, m] = since.split('-').map(Number)
    return `${new Intl.DateTimeFormat(nloc, { month: 'long' }).format(new Date(y, (m || 1) - 1, 1))} ${y}`
  }

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [months, setMonths] = useState(12)
  // LTV netto: margine lordo (auto dai costi prodotto Shopify, override manuale)
  // + spesa ads del periodo per il CAC e il ratio LTV:CAC.
  const [margin, setMargin] = useState(100)  // % margine lordo (100 = nessun costo inserito → netto = lordo)
  const [marginAuto, setMarginAuto] = useState(true)
  const [enrich, setEnrich] = useState(null) // { adSpend, metaSpend, googleSpend, grossMargin, costCoverage }
  // LTV proiettato a maturità (ltv-auto): per un brand in crescita la media
  // semplice della finestra è schiacciata dai clienti recentissimi (censoring);
  // il proiettato usa i clienti con ≥3/6/12 mesi di anzianità = valore a cui
  // arriva davvero un cliente. È il numero giusto per decidere lo scaling.
  const [ltvAuto, setLtvAuto] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/ltv-auto?months=24').then(r => r.json())
      .then(j => { if (!cancelled && j?.enoughData) setLtvAuto(j) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Enrichment: margine reale (product-performance) + spesa Meta/Google (kpi) sul
  // periodo selezionato → CAC = spesa ads ÷ nuovi clienti acquisiti.
  useEffect(() => {
    let cancelled = false
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1)
    const since = start.toISOString().slice(0, 10)
    const until = today.toISOString().slice(0, 10)
    const q = `preset=custom&since=${since}&until=${until}`
    Promise.all([
      fetch(`/api/product-performance?since=${since}&until=${until}`).then(r => r.json()).catch(() => null),
      fetch(`/api/meta-kpi?${q}`).then(r => r.json()).catch(() => null),
      fetch(`/api/google-kpi?${q}`).then(r => r.json()).catch(() => null),
    ]).then(([pp, mk, gk]) => {
      if (cancelled) return
      const metaSpend = Number(mk?.totals?.spend || 0)
      const googleSpend = Number(gk?.totals?.spend || 0)
      setEnrich({
        adSpend: metaSpend + googleSpend, metaSpend, googleSpend,
        grossMargin: pp?.totals?.grossMargin ?? null,
        costCoverage: pp?.totals?.costCoverage || 0,
      })
    })
    return () => { cancelled = true }
  }, [months])

  // Margine di default in automatico dai costi prodotto reali (se coperti).
  useEffect(() => {
    if (!enrich || !marginAuto) return
    // REGOLA: costi prodotto inseriti → margine reale; nessun costo → 100
    // (LTV netto = lordo, niente riduzioni inventate). L'override manuale
    // resta possibile disattivando l'auto.
    const pct = (enrich.grossMargin != null && enrich.costCoverage > 0) ? Math.round(enrich.grossMargin * 100) : 100
    setMargin(pct)
  }, [enrich, marginAuto])

  const load = (force = false) => {
    let cancelled = false
    const key = `ltv-cohorts:${months}`
    if (force) invalidate(key)
    const cached = !force ? getCached(key) : null
    if (cached) setData(cached.data)
    else setLoading(true)
    setError(null)
    swrFetch({
      key, forceRefresh: force,
      fetcher: () => fetch(`/api/ltv-cohorts?months=${months}`).then(r => r.json()),
      onUpdate: (fresh) => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => {
        if (cancelled) return
        if (j?.error && !j?.summary) setError(j.error)
        if (!cached || force) setData(j)
      })
      .catch(e => { if (!cancelled && !cached) setError(e?.message || t('common.networkError', null, 'Network error')) })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }

  useEffect(() => { const c = load(); return c }, [months]) // eslint-disable-line react-hooks/exhaustive-deps

  const s = data?.summary || {}
  const cohorts = data?.cohorts || []
  const distribution = data?.distribution || []
  // Grafici in ordine cronologico (coorte arriva desc → reverse)
  const chrono = [...cohorts].reverse()
  const mFrac = Math.max(0, Math.min(100, Number(margin) || 0)) / 100
  const ltvChart = chrono.map(c => ({ name: c.label, ltv: c.ltv, ltvNet: Math.round(c.ltv * mFrac * 100) / 100 }))
  const repeatChart = chrono.map(c => ({ name: c.label, repeat: c.repeatRate }))

  // ── LTV Lordo / Netto + CAC + Ratio LTV:CAC ──
  // Headline = LTV PROIETTATO a maturità quando disponibile (corregge la
  // sottostima da clienti recenti nei brand in crescita); la media semplice
  // della finestra resta visibile come riferimento nel sottotitolo.
  const simpleLtv = Number(s.avgLtv || 0)              // media semplice finestra (365gg default)
  const projLtv = ltvAuto?.enoughData && Number(ltvAuto.projectedLtvGross) > 0 ? Number(ltvAuto.projectedLtvGross) : null
  const usingProjected = projLtv != null
  const grossLtv = usingProjected ? projLtv : simpleLtv
  const m = Math.max(0, Math.min(100, Number(margin) || 0)) / 100
  const netLtv = grossLtv * m                          // × margine lordo
  const newCustomers = Number(s.customers || 0)
  const adSpend = Number(enrich?.adSpend || 0)
  const cac = newCustomers > 0 && adSpend > 0 ? adSpend / newCustomers : null
  const ratioGross = cac ? grossLtv / cac : null
  const ratioNet = cac ? netLtv / cac : null
  const marginReal = enrich && enrich.grossMargin != null && enrich.costCoverage > 0
  const ratioColor = (r) => r == null ? 'var(--text)' : r >= 3 ? '#30d158' : r >= 1 ? '#ff9f0a' : '#ff453a'
  const fmtX = (r) => r == null ? '—' : `${r.toFixed(2)}×`

  const Stat = ({ label, value, sub }) => (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>{label}</div>
      <div className="metric-value-sm" style={{ color: 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ marginTop: 24 }}>
      <FxCard delay={1.6}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {WINDOWS.map(w => (
              <button key={w} onClick={() => setMonths(w)} className="btn-glass"
                style={{ padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 12, opacity: months === w ? 1 : 0.55, borderColor: months === w ? 'var(--accent)' : undefined }}>
                {w} {t('ltv.monthsUnit', null, 'months')}
              </button>
            ))}
          </div>
          <button onClick={() => load(true)} disabled={loading} className="btn-glass" style={{ padding: '8px 14px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {loading ? t('common.loadingShort', null, 'Loading…') : t('common.refresh', null, 'Refresh')}
          </button>
        </div>

        {loading && !data && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '18px 0' }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> {t('ltv.calculating', null, 'Calculating cohorts and LTV…')}</div>}
        {!loading && error && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>{error}</div>}
        {!loading && !error && data && !(s.customers > 0) && <div style={{ color: 'var(--text2)', fontSize: 13, padding: '12px 0' }}>{t('ltv.noCustomers', null, 'No customers in the selected period.')}</div>}

        {s.customers > 0 && (
          <>
            {/* Headline: LTV Lordo / Netto / CAC / Ratio LTV:CAC */}
            <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))', gap: 12, margin: '8px 0 12px' }}>
              <div className="glass-card" style={{ padding: '16px 18px' }}>
                <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>{t('ltv.grossLtv', null, 'Gross LTV')}</div>
                <div className="metric-value-sm" style={{ color: 'var(--text)' }}>{eur2(grossLtv)}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>
                  {usingProjected
                    ? t('ltv.projMature', { m: ltvAuto.maturityMonths, v: eur2(simpleLtv) }, `projected at maturity (customers ≥${ltvAuto.maturityMonths} mo) · simple avg ${eur2(simpleLtv)}`)
                    : t('ltv.lifetimePerCustomer', null, 'lifetime revenue / customer')}
                </div>
              </div>
              <div className="glass-card" style={{ padding: '16px 18px' }}>
                <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>{t('ltv.netLtv', null, 'Net LTV')}</div>
                <div className="metric-value-sm" style={{ color: '#30d158' }}>{eur2(netLtv)}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{t('ltv.marginLine', { pct: Math.round(m * 100), src: marginReal ? t('ltv.realShopify', null, 'real Shopify') : t('ltv.estimate', null, 'estimate') }, `margin ${Math.round(m * 100)}%`)}</div>
              </div>
              <div className="glass-card" style={{ padding: '16px 18px' }}>
                <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>{t('ltv.cac', null, 'CAC')}</div>
                <div className="metric-value-sm" style={{ color: 'var(--text)' }}>{cac == null ? '—' : eur2(cac)}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{adSpend > 0 ? t('ltv.adsPerCustomers', { spend: eur(adSpend), n: nf(newCustomers) }, `${eur(adSpend)} ads / ${nf(newCustomers)} customers`) : t('ltv.adsUnavailable', null, 'ad spend unavailable')}</div>
              </div>
              <div className="glass-card" style={{ padding: '16px 18px' }}>
                <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>{t('ltv.ltvCacNet', null, 'LTV:CAC (net)')}</div>
                <div className="metric-value-sm" style={{ color: ratioColor(ratioNet) }}>{fmtX(ratioNet)}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{t('ltv.grossRatioHealthy', { x: fmtX(ratioGross) }, `gross ${fmtX(ratioGross)} · healthy ≥ 3×`)}</div>
              </div>
            </div>

            {/* Controllo margine lordo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 0 18px', fontSize: 12.5, color: 'var(--text)' }}>
              <span style={{ fontWeight: 700, color: '#fff' }}>{t('ltv.grossMargin', null, 'Gross margin')}</span>
              <input type="number" min={0} max={100} value={margin}
                onChange={e => { setMargin(e.target.value); setMarginAuto(false) }}
                style={{ width: 78, background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 9, padding: '7px 10px', fontSize: 13, fontWeight: 700, outline: 'none' }} />
              <span style={{ color: 'var(--text2)' }}>%</span>
              {!marginAuto && (
                <button onClick={() => setMarginAuto(true)} className="btn-glass" style={{ padding: '6px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{t('ltv.useRealMargin', null, 'Use real margin')}</button>
              )}
              <span style={{ color: 'var(--text2)', fontSize: 11.5 }}>
                {marginReal
                  ? t('ltv.marginAutoHint', null, 'Automatically calculated from Shopify product costs (you can change it).')
                  : t('ltv.marginEstHint', null, 'Set product costs in the Product Costs module for the real margin — this is an estimate.')}
              </span>
            </div>

            <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12, margin: '0 0 20px' }}>
              <Stat label={t('ltv.customersAcquired', null, 'Customers acquired')} value={nf(s.customers)} sub={t('ltv.ordersTotal', { n: nf(s.ordersTotal) }, `${nf(s.ordersTotal)} total orders`)} />
              <Stat label={t('ltv.repeatRate', null, 'Repeat rate')} value={`${s.repeatRate}%`} sub={t('ltv.withTwoOrders', { n: nf(s.repeatCustomers) }, `${nf(s.repeatCustomers)} with ≥2 orders`)} />
              <Stat label={t('ltv.ordersPerCustomer', null, 'Orders / customer')} value={s.avgOrders} />
              <Stat label={t('ltv.oneTimeCustomers', null, 'One-time customers')} value={`${s.oneTimeRate}%`} sub={t('ltv.oneOrderOnly', null, '1 order only')} />
              <Stat label={t('ltv.customerRevenue', null, 'Customer revenue')} value={eur(s.revenueTotal)} sub={t('ltv.cohortLifetime', null, 'cohort lifetime')} />
            </div>

            {/* Tabella coorti per acquisizione */}
            <div className="glass-card-static" style={{ padding: 18, borderRadius: 16, marginBottom: 20, overflowX: 'auto' }}>
              <div className="label" style={{ marginBottom: 12 }}>{t('ltv.cohortsByMonth', null, 'Cohorts by acquisition month')}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 520 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text3)', fontWeight: 800, fontSize: 10 }}>{t('ltv.colCohort', null, 'COHORT')}</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text3)', fontWeight: 800, fontSize: 10 }}>{t('ltv.colCustomers', null, 'CUSTOMERS')}</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text3)', fontWeight: 800, fontSize: 10 }}>{t('ltv.colRepeat', null, 'REPEAT')}</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text3)', fontWeight: 800, fontSize: 10 }}>{t('ltv.colOrdersCust', null, 'ORDERS/CUST.')}</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text3)', fontWeight: 800, fontSize: 10 }}>{t('ltv.colLtv', null, 'LTV')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map(c => (
                    <tr key={c.cohort} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text)', fontWeight: 700 }}>{c.label}</td>
                      <td style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text2)', fontWeight: 700 }}>{nf(c.size)}</td>
                      <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 800, color: repeatColor(c.repeatRate) }}>{c.repeatRate}%</td>
                      <td style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text2)', fontWeight: 700 }}>{c.avgOrders}</td>
                      <td style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text)', fontWeight: 900 }}>{eur2(c.ltv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grafici */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px,1fr))', gap: 16 }}>
              <div className="glass-card-static reveal-zoom" style={{ padding: 18, borderRadius: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>{t('ltv.ltvByCohort', { pct: Math.round(m * 100) }, `LTV by cohort · gross vs net (${Math.round(m * 100)}% margin)`)}</div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={ltvChart} margin={{ top: 6, right: 10, left: -6, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ltvBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5b8bff" stopOpacity={0.55} /><stop offset="100%" stopColor="#5b8bff" stopOpacity={0.18} /></linearGradient>
                      <linearGradient id="ltvBarNet" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#30d158" stopOpacity={0.95} /><stop offset="100%" stopColor="#30d158" stopOpacity={0.4} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={42} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v, n) => [eur2(v), n === 'ltvNet' ? t('ltv.netLtv', null, 'Net LTV') : t('ltv.grossLtv', null, 'Gross LTV')]} />
                    <Bar name={t('ltv.grossLtv', null, 'Gross LTV')} dataKey="ltv" fill="url(#ltvBar)" radius={[5, 5, 0, 0]} animationDuration={1400} />
                    <Bar name={t('ltv.netLtv', null, 'Net LTV')} dataKey="ltvNet" fill="url(#ltvBarNet)" radius={[5, 5, 0, 0]} animationDuration={1400} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card-static reveal-zoom" style={{ padding: 18, borderRadius: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>{t('ltv.repeatByCohort', null, 'Repeat rate by cohort')}</div>
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={repeatChart} margin={{ top: 6, right: 10, left: -6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={42} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => `${v}%`} />
                    <Line type="monotone" dataKey="repeat" stroke="#2997ff" strokeWidth={2} dot={{ r: 3, fill: '#2997ff' }} animationDuration={1400} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card-static reveal-zoom" style={{ padding: 18, borderRadius: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>{t('ltv.distByOrders', null, 'Customer distribution by number of orders')}</div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={distribution} margin={{ top: 6, right: 10, left: -6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => nf(v)} />
                    <Bar dataKey="count" radius={[5, 5, 0, 0]} animationDuration={1400}>
                      {distribution.map((e, i) => <Cell key={i} fill={['#ff453a', '#ff9f0a', '#64d2ff', '#30d158'][i] || '#2997ff'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {data?.truncated && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 14 }}><Icon name="warning" size={12} /> {t('ltv.truncated', null, 'Large dataset: analysis on the most recent customers of the period (truncated for performance).')}</div>
            )}

            {/* Spiegazione dinamica (cambia col timeframe selezionato) */}
            <div className="glass-card-static" style={{ padding: 18, borderRadius: 16, marginTop: 20 }}>
              <div className="label" style={{ marginBottom: 10 }}>{t('ltv.howToRead', null, 'How to read this data')}</div>
              <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text2)' }}>
                <p style={{ margin: '0 0 10px' }}>
                  {t('ltv.explIntro', { customers: nf(s.customers), months, since: sinceLabel(data?.since) }, `You are analyzing the ${nf(s.customers)} customers acquired in the last ${months} months (since ${sinceLabel(data?.since)}). A cohort groups customers by the month of their first purchase, so you compare homogeneous groups and see how they behave over time, net of seasonality.`)}
                </p>
                <ul style={{ margin: '0 0 10px', paddingLeft: 18, display: 'grid', gap: 6 }}>
                  <li><strong style={{ color: 'var(--text)' }}>{t('ltv.explRepeatLabel', null, 'Repeat rate')}</strong> {t('ltv.explRepeatBody', { rate: s.repeatRate }, `— % of cohort customers who placed at least 2 orders. It measures retention. In the period: ${s.repeatRate}%.`)}</li>
                  <li><strong style={{ color: 'var(--text)' }}>{t('ltv.explLtvLabel', null, 'Average LTV')}</strong> {t('ltv.explLtvBody', { ltv: eur2(s.avgLtv) }, `— average lifetime spend per customer: ${eur2(s.avgLtv)}. It is the real value of a customer, to compare with CAC.`)}</li>
                  <li><strong style={{ color: 'var(--text)' }}>{t('ltv.explOrdersLabel', null, 'Orders/customer')}</strong> {t('ltv.explOrdersBody', { orders: s.avgOrders, oneTime: s.oneTimeRate }, `(${s.avgOrders}) and one-time customers (${s.oneTimeRate}%) — how much revenue depends on one-time buyers.`)}</li>
                  <li><strong style={{ color: 'var(--text)' }}>{t('ltv.explDistLabel', null, 'Distribution by number of orders')}</strong> {t('ltv.explDistBody', null, '— how many customers stop at 1, 2, 3 or 4+ orders: the loyalty ladder.')}</li>
                </ul>
                <p style={{ margin: 0, paddingTop: 10, borderTop: '1px solid var(--border)', color: 'var(--text3)' }}>
                  <Icon name="warning" size={12} /> <strong style={{ color: 'var(--text2)' }}>{t('ltv.explMaturityLabel', null, 'Maturity effect')}</strong>: {t('ltv.explMaturityBody', null, 'the most recent cohorts (at the top) have physiologically lower repeat rate and LTV because they had less time to re-purchase. For the real potential, look at the older cohorts.')} {months <= 6
                    ? t('ltv.explWindowShort', { months }, `With a ${months}-month window you mostly see recent acquisition: widen to 12–24 months to assess mature retention.`)
                    : t('ltv.explWindowLong', { months }, `With ${months} months you also include mature cohorts: compare the old rows (consolidated LTV/repeat) with the recent ones to estimate where they will land.`)}
                  {s.repeatRate < 15
                    ? ' ' + t('ltv.explRepeatLow', { rate: s.repeatRate }, `The overall repeat rate (${s.repeatRate}%) is low: there is leverage on retention — post-purchase email flows, bundles, reorder reminders.`)
                    : s.repeatRate < 30
                      ? ' ' + t('ltv.explRepeatMid', { rate: s.repeatRate }, `The repeat rate (${s.repeatRate}%) is decent: pushing win-back and cross-sell can raise it.`)
                      : ' ' + t('ltv.explRepeatHigh', { rate: s.repeatRate }, `Great repeat rate (${s.repeatRate}%): loyal customer base, worth investing in acquisition.`)}
                </p>
              </div>
            </div>
          </>
        )}
      </FxCard>
    </div>
  )
}
