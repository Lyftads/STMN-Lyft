'use client'

import { useEffect, useRef, useState } from 'react'
import Icon from './ui/Icon'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import { PlatformBadges } from './PlatformIcon'
import DownloadReportButton from './DownloadReportButton'
import BmTimeframe from './ui/BmTimeframe'
import { tfQuery, tfKey } from '../../lib/tfQuery'
import { useI18n } from '../../lib/i18n/I18nProvider'

// ─────────────────────────────────────────────────────────────
//  Lead Gen Tab — economia delle campagne lead Meta.
//  Non mostra dati dei singoli lead: solo spesa/lead/CPL da Insights
//  + parametri economici del workspace (valore cliente, chiusura,
//  margine) per calcolare CAC, profitto, ROI e CPL di pareggio.
// ─────────────────────────────────────────────────────────────

const VIOLET = '#a78bfa'
const BLUE = '#2997ff'
const AMBER = '#ff9f0a'

const eur  = v => v != null && Number.isFinite(Number(v)) ? `€${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '—'
const eur2 = v => v != null && Number.isFinite(Number(v)) ? `€${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 2 })}` : '—'
const num  = v => v != null && Number.isFinite(Number(v)) ? Number(v).toLocaleString('it-IT', { maximumFractionDigits: 0 }) : '—'
const pct0 = v => v != null && Number.isFinite(Number(v)) ? `${Number(v).toFixed(0)}%` : '—'

export default function LeadGenTab() {
  const { t } = useI18n()
  const [tf, setTf] = useState({ preset: 'last_28d' })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Parametri economici editabili (inizializzati dalle settings del server una volta)
  const [eco, setEco] = useState({ avgValue: '', closeRate: '', marginPct: '' })
  const [overrides, setOverrides] = useState({})
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const ecoInit = useRef(false)

  const load = (force = false) => {
    let cancelled = false
    const key = `meta-leadgen:${tfKey(tf)}`
    if (force) invalidate(key)
    const cached = !force ? getCached(key) : null
    if (cached) setData(cached.data)
    else setLoading(true)
    setError(null)
    swrFetch({
      key, forceRefresh: force,
      fetcher: () => fetch(`/api/meta-leadgen?${tfQuery(tf)}`).then(r => r.json()),
      onUpdate: fresh => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => {
        if (cancelled) return
        if (j?.error && !(j?.campaigns || []).length) setError(j.error)
        if (!cached || force) setData(j)
      })
      .catch(e => { if (!cancelled && !cached) setError(e?.message) })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [tf]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ecoInit.current || !data?.settings) return
    ecoInit.current = true
    setEco({
      avgValue: data.settings.avgValue || '',
      closeRate: data.settings.closeRate || '',
      marginPct: data.settings.marginPct ?? 100,
    })
    setOverrides(data.settings.overrides || {})
  }, [data])

  const saveEco = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/meta-leadgen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avgValue: Number(eco.avgValue || 0),
          closeRate: Number(eco.closeRate || 0),
          marginPct: Number(eco.marginPct === '' ? 100 : eco.marginPct),
          overrides,
        }),
      })
      const j = await res.json()
      if (j?.error) throw new Error(j.error)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (e) {
      setError(e?.message)
    } finally {
      setSaving(false)
    }
  }

  const campaigns = Array.isArray(data?.campaigns) ? data.campaigns : []
  const daily = Array.isArray(data?.daily) ? data.daily : []
  const totals = data?.totals || {}
  const prevTotals = data?.prevTotals || {}

  const avgValue = Number(eco.avgValue || 0)
  const closeRate = Number(eco.closeRate || 0) / 100
  const margin = Number(eco.marginPct === '' ? 100 : eco.marginPct) / 100
  const hasEco = avgValue > 0 && closeRate > 0
  const breakEvenCpl = hasEco ? avgValue * margin * closeRate : null

  // Economia per campagna (override → default workspace)
  const rowEco = (c) => {
    const o = overrides[c.id] || {}
    const val = o.avgValue != null && o.avgValue !== '' ? Number(o.avgValue) : avgValue
    const rate = (o.closeRate != null && o.closeRate !== '' ? Number(o.closeRate) : Number(eco.closeRate || 0)) / 100
    const usable = val > 0 && rate > 0
    const clients = usable ? c.leads * rate : null
    const revenue = usable ? clients * val : null
    const profit = usable ? revenue * margin - c.spend : null
    const cac = usable && clients > 0 ? c.spend / clients : null
    const roi = usable && c.spend > 0 ? (profit / c.spend) * 100 : null
    const be = usable ? val * margin * rate : null
    return { clients, revenue, profit, cac, roi, be }
  }

  const sumEco = campaigns.reduce((s, c) => {
    const e = rowEco(c)
    if (e.clients == null) return s
    return {
      clients: (s.clients || 0) + e.clients,
      revenue: (s.revenue || 0) + e.revenue,
      profit: (s.profit || 0) + e.profit,
      spend: (s.spend || 0) + c.spend,
    }
  }, {})
  const totCac = sumEco.clients > 0 ? sumEco.spend / sumEco.clients : null
  const totRoi = sumEco.spend > 0 && sumEco.profit != null ? (sumEco.profit / sumEco.spend) * 100 : null

  const delta = (cur, prev, lower = false) => {
    const c = Number(cur || 0), p = Number(prev || 0)
    if (!p) return null
    const d = ((c - p) / Math.abs(p)) * 100
    return { d, good: lower ? d < 0 : d > 0 }
  }

  const kpis = [
    { label: t('lg.leads', null, 'Lead'), value: num(totals.leads), delta: delta(totals.leads, prevTotals.leads) },
    { label: t('lg.cpl', null, 'CPL'), value: eur2(totals.leads > 0 ? totals.cpl : null), delta: delta(totals.cpl, prevTotals.cpl, true) },
    { label: t('meta.spend', null, 'Spesa'), value: eur(totals.spend), delta: delta(totals.spend, prevTotals.spend) },
    { label: t('lg.estClients', null, 'Clienti stimati'), value: sumEco.clients != null ? num(sumEco.clients) : '—' },
    { label: t('lg.estCac', null, 'CAC stimato'), value: eur2(totCac) },
    { label: t('lg.estRevenue', null, 'Ricavo stimato'), value: sumEco.revenue != null ? eur(sumEco.revenue) : '—' },
    { label: t('lg.estProfit', null, 'Profitto stimato'), value: sumEco.profit != null ? eur(sumEco.profit) : '—', tone: sumEco.profit != null ? (sumEco.profit >= 0 ? VIOLET : AMBER) : null },
    { label: t('lg.roi', null, 'ROI'), value: pct0(totRoi), tone: totRoi != null ? (totRoi >= 0 ? VIOLET : AMBER) : null },
  ]

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 14, fontWeight: 700,
  }
  const miniInput = { ...inputStyle, width: 78, padding: '5px 8px', fontSize: 12.5 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 10 }}>
          <PlatformBadges sources={['meta']} size={26} />
          <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.01em' }}>{t('tab.metaLeadgen', null, 'Lead Gen')}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <BmTimeframe value={tf} onChange={setTf} accent={VIOLET} disabled={loading} />
          <button
            type="button" onClick={() => load(true)} disabled={loading}
            style={{
              border: '1px solid var(--border)', background: 'var(--glass)', color: 'var(--text)',
              borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {loading ? t('shell.updating', null, 'Aggiorno…') : t('shell.refresh', null, 'Aggiorna')}
          </button>
          <DownloadReportButton tab="Lead Gen" preset={tf.preset} />
        </div>
      </div>

      {error && (
        <div className="glass-card-static" style={{ padding: 18, color: '#fca5a5', fontSize: 13 }}>
          <Icon name="warning" size={13} /> {error}
        </div>
      )}

      {/* Parametri economici */}
      <div className="glass-card-static" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: VIOLET }}>
            {t('lg.economics', null, 'Parametri economici')}
          </div>
          {breakEvenCpl != null && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: 'rgba(167,139,250,0.12)', border: `1px solid ${VIOLET}44`, fontSize: 12.5, fontWeight: 800 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: VIOLET, boxShadow: `0 0 8px ${VIOLET}` }} />
              {t('lg.breakEven', null, 'CPL di pareggio')}: {eur2(breakEvenCpl)}
            </div>
          )}
        </div>
        {!hasEco && (
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.5 }}>
            {t('lg.setupHint', null, 'Imposta il valore medio di un cliente chiuso e il tasso di chiusura: la tab calcola CAC, ricavo, profitto e ROI reali delle campagne lead — non solo il CPL.')}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>
            {t('lg.avgValue', null, 'Valore medio cliente (€)')}
            <input type="number" min="0" value={eco.avgValue} onChange={e => setEco(s => ({ ...s, avgValue: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }} placeholder="es. 800" />
          </label>
          <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>
            {t('lg.closeRate', null, 'Chiusura lead → cliente (%)')}
            <input type="number" min="0" max="100" value={eco.closeRate} onChange={e => setEco(s => ({ ...s, closeRate: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }} placeholder="es. 10" />
          </label>
          <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>
            {t('lg.margin', null, 'Margine (%)')}
            <input type="number" min="0" max="100" value={eco.marginPct} onChange={e => setEco(s => ({ ...s, marginPct: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }} placeholder="100" />
          </label>
          <button
            type="button" onClick={saveEco} disabled={saving}
            style={{
              border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 13.5, fontWeight: 800,
              background: `linear-gradient(135deg, ${VIOLET}, ${BLUE})`, color: '#fff',
              cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
            }}
          >
            {savedFlash ? `✓ ${t('lg.saved', null, 'Salvato')}` : t('lg.save', null, 'Salva')}
          </button>
        </div>
        {breakEvenCpl != null && (
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 10 }}>
            {t('lg.breakEvenHint', null, 'Sotto il CPL di pareggio (valore × margine × chiusura) la campagna genera profitto; sopra, perde.')}
          </div>
        )}
      </div>

      {loading && !data && (
        <div style={{ color: '#9b90aa', padding: 40, fontSize: 15, fontWeight: 700, textAlign: 'center' }}>
          {t('lg.loading', null, 'Carico le campagne lead…')}
        </div>
      )}

      {data && (
        <>
          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            {kpis.map(k => (
              <div key={k.label} className="glass-card-static" style={{ padding: 16 }}>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6, letterSpacing: '-0.02em', color: k.tone || 'var(--text)' }}>{k.value}</div>
                {k.delta && (
                  <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4, color: k.delta.good ? VIOLET : AMBER }}>
                    {k.delta.d > 0 ? '+' : ''}{k.delta.d.toFixed(1)}% <span style={{ color: 'var(--text3)', fontWeight: 600 }}>{t('lg.vsPrev', null, 'vs prec.')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Andamento */}
          {daily.length > 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
              <TrendChart title={t('lg.dailyLeads', null, 'Lead per giorno')} data={daily} dataKey="leads" color={VIOLET} fmt={num} />
              <TrendChart title={t('lg.dailyCpl', null, 'CPL per giorno')} data={daily} dataKey="cpl" color={BLUE} fmt={eur2} refLine={breakEvenCpl} refLabel={t('lg.breakEven', null, 'CPL di pareggio')} />
            </div>
          )}

          {/* Tabella campagne */}
          <div className="glass-card-static" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: VIOLET, marginBottom: 14 }}>
              {t('lg.campaigns', null, 'Campagne lead')}
            </div>
            {campaigns.length === 0 ? (
              <div style={{ fontSize: 13.5, color: 'var(--text3)' }}>{t('lg.noCampaigns', null, 'Nessuna campagna lead nel periodo selezionato.')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 920 }}>
                  <thead>
                    <tr style={{ textAlign: 'right', color: 'var(--text3)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>{t('lg.campaign', null, 'Campagna')}</th>
                      <th style={{ padding: '8px 10px' }}>{t('meta.spend', null, 'Spesa')}</th>
                      <th style={{ padding: '8px 10px' }}>{t('lg.leads', null, 'Lead')}</th>
                      <th style={{ padding: '8px 10px' }}>{t('lg.cpl', null, 'CPL')}</th>
                      <th style={{ padding: '8px 10px' }}>{t('lg.estCac', null, 'CAC stimato')}</th>
                      <th style={{ padding: '8px 10px' }}>{t('lg.estProfit', null, 'Profitto stimato')}</th>
                      <th style={{ padding: '8px 10px' }}>{t('lg.roi', null, 'ROI')}</th>
                      <th style={{ padding: '8px 10px' }}>{t('lg.colValue', null, 'Valore €')}</th>
                      <th style={{ padding: '8px 10px' }}>{t('lg.colClose', null, 'Chiusura %')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(c => {
                      const e = rowEco(c)
                      const o = overrides[c.id] || {}
                      const beState = e.be != null && c.leads > 0 ? (c.cpl <= e.be ? 'ok' : 'ko') : null
                      return (
                        <tr key={c.id} style={{ borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                          <td style={{ textAlign: 'left', padding: '10px', fontWeight: 700, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</td>
                          <td style={{ padding: '10px' }}>{eur(c.spend)}</td>
                          <td style={{ padding: '10px', fontWeight: 800 }}>{num(c.leads)}</td>
                          <td style={{ padding: '10px' }}>
                            {eur2(c.leads > 0 ? c.cpl : null)}
                            {beState && (
                              <span style={{
                                marginLeft: 6, fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
                                background: beState === 'ok' ? 'rgba(167,139,250,0.15)' : 'rgba(255,159,10,0.15)',
                                color: beState === 'ok' ? VIOLET : AMBER,
                              }}>
                                {beState === 'ok' ? t('lg.belowBE', null, 'in profitto') : t('lg.aboveBE', null, 'sopra pareggio')}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px' }}>{eur2(e.cac)}</td>
                          <td style={{ padding: '10px', fontWeight: 800, color: e.profit == null ? 'var(--text)' : e.profit >= 0 ? VIOLET : AMBER }}>{e.profit != null ? eur(e.profit) : '—'}</td>
                          <td style={{ padding: '10px' }}>{pct0(e.roi)}</td>
                          <td style={{ padding: '10px' }}>
                            <input type="number" min="0" value={o.avgValue ?? ''} placeholder={String(avgValue || '')} style={miniInput}
                              onChange={ev => setOverrides(s => ({ ...s, [c.id]: { ...s[c.id], avgValue: ev.target.value } }))} />
                          </td>
                          <td style={{ padding: '10px' }}>
                            <input type="number" min="0" max="100" value={o.closeRate ?? ''} placeholder={String(eco.closeRate || '')} style={miniInput}
                              onChange={ev => setOverrides(s => ({ ...s, [c.id]: { ...s[c.id], closeRate: ev.target.value } }))} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {campaigns.length > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 10 }}>
                {t('lg.overrideHint', null, 'Valore e chiusura per singola campagna (vuoto = parametri del workspace). Ricorda di salvare.')}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Grafico trend minimale ───────────────────────────────────
function TrendChart({ title, data, dataKey, color, fmt, refLine, refLabel }) {
  const gid = `lg-${dataKey}`
  return (
    <div className="glass-card-static" style={{ padding: 20 }}>
      <div style={{ fontSize: 12.5, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>{title}</div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 10.5, fill: 'var(--text3)' }} axisLine={false} tickLine={false}
            tickFormatter={d => String(d).slice(5).split('-').reverse().join('/')} minTickGap={28} />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: 'rgba(12,10,20,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, fontSize: 12.5 }}
            labelFormatter={d => String(d).split('-').reverse().join('/')}
            formatter={v => [fmt(v), '']}
          />
          {refLine != null && refLine > 0 && (
            <ReferenceLine y={refLine} stroke="#ff9f0a" strokeDasharray="5 4" strokeOpacity={0.7} />
          )}
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.2} fill={`url(#${gid})`} dot={false} activeDot={{ r: 3.5 }} />
        </AreaChart>
      </ResponsiveContainer>
      {refLine != null && refLine > 0 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
          <span style={{ width: 14, borderTop: '2px dashed #ff9f0a', display: 'inline-block' }} /> {refLabel}
        </div>
      )}
    </div>
  )
}
