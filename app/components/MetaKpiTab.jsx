'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import { PlatformBadges } from './PlatformIcon'
import DownloadReportButton from './DownloadReportButton'
import BmTimeframe from './ui/BmTimeframe'
import { tfQuery, tfKey } from '../../lib/tfQuery'
import RecommendationsFeed from './RecommendationsFeed'
import MetaAdsAgent from './MetaAdsAgent'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Mini-grafico sparkline per le card KPI
function Sparkline({ data, dataKey, color = '#2997ff', width = 92, height = 30 }) {
  const vals = (data || []).map(d => Number(d[dataKey] || 0))
  if (vals.length < 2 || vals.every(v => v === 0)) return null
  const max = Math.max(...vals), min = Math.min(...vals)
  const range = max - min || 1
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ')
  const gid = `mk-sl-${dataKey}-${color.replace('#', '')}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ flexShrink: 0, overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
//  Meta KPI Tab
//  - Card KPI in alto (10 metriche)
//  - Grafici separati sotto (7 grafici: Spend, ROAS, CPO, CTR, CPM,
//    Frequency, Reach)
// ─────────────────────────────────────────────────────────────

const PRESETS = [
  { value: 'today',        label: 'Oggi', labelKey: 'meta.today' },
  { value: 'yesterday',    label: 'Ieri', labelKey: 'meta.yesterday' },
  { value: 'last_7d',      label: '7gg' },
  { value: 'last_14d',     label: '14gg' },
  { value: 'last_28d',     label: '28gg' },
  { value: 'last_30d',     label: '30gg' },
  { value: 'last_90d',     label: '90gg' },
  { value: 'current_month',label: 'Mese', labelKey: 'mkpi.monthShort' },
  { value: 'ytd',          label: 'YTD' },
]

const eur  = v => v != null ? `€${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '—'
const eur2 = v => v != null ? `€${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 2 })}` : '—'
const num  = v => v != null ? Number(v).toLocaleString('it-IT') : '—'
const pct  = v => v != null ? `${Number(v).toFixed(2)}%` : '—'
const mul  = v => v != null && v > 0 ? `${Number(v).toFixed(2)}x` : '—'

// 'kind' controlla il formato del delta assoluto:
//   money   → mostra € (es. +€1.234)
//   ratio   → mostra unita' (es. +0.12 punti per ROAS/freq)
//   percent → mostra punti percentuali (es. +0.45 pp per CTR)
//   count   → mostra numero (es. +1.234)
// 'lower' = true significa che un calo e' positivo (CPO, CPM, CPC, frequenza).
const KPIS = [
  { key: 'spend',      label: 'Spesa',       labelKey: 'meta.spend',     fmt: eur,  kind: 'money'   },
  { key: 'revenue',    label: 'Revenue',     fmt: eur,  kind: 'money'   },
  { key: 'roas',       label: 'ROAS',        fmt: mul,  kind: 'ratio'   },
  { key: 'purchases',  label: 'Acquisti',    labelKey: 'meta.purchases', fmt: num,  kind: 'count'   },
  { key: 'cpo',        label: 'CPO',         fmt: eur2, kind: 'money',  lower: true },
  { key: 'impressions',label: 'Impressioni', labelKey: 'mkpi.impressions', fmt: num,  kind: 'count'   },
  { key: 'reach',      label: 'Copertura',   labelKey: 'meta.reach',     fmt: num,  kind: 'count'   },
  { key: 'frequency',  label: 'Frequenza',   labelKey: 'meta.frequency', fmt: v => v != null ? Number(v).toFixed(2) : '—', kind: 'ratio', lower: true },
  { key: 'cpm',        label: 'CPM',         fmt: eur2, kind: 'money',  lower: true },
  { key: 'ctr_link',   label: 'CTR link',    labelKey: 'meta.ctrLink',   fmt: pct,  kind: 'percent' },
  { key: 'cpc_link',   label: 'CPC link',    labelKey: 'meta.cpcLink',   fmt: eur2, kind: 'money',  lower: true },
  { key: 'link_clicks',label: 'Click link',  labelKey: 'meta.clickLink', fmt: num,  kind: 'count'   },
]

const CHARTS = [
  { key: 'spend',     label: 'Spending',  fmt: eur  },
  { key: 'roas',      label: 'ROAS',      fmt: mul  },
  { key: 'cpo',       label: 'CPO',       fmt: eur2 },
  { key: 'ctr_link',  label: 'CTR link',  labelKey: 'meta.ctrLink',   fmt: pct  },
  { key: 'cpm',       label: 'CPM',       fmt: eur2 },
  { key: 'frequency', label: 'Frequenza', labelKey: 'meta.frequency', fmt: v => v != null ? Number(v).toFixed(2) : '—' },
  { key: 'reach',     label: 'Copertura', labelKey: 'meta.reach',     fmt: num  },
]


export default function MetaKpiTab({ live, globalPreset }) {
  const { t } = useI18n()
  const [tf, setTf] = useState({ preset: 'last_7d' })
  const preset = tf.preset
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = (force = false) => {
    let cancelled = false
    const key = `meta-kpi:${tfKey(tf)}`
    if (force) invalidate(key)
    const cached = !force ? getCached(key) : null
    if (cached) {
      setData(cached.data)
    } else {
      setLoading(true)
    }
    setError(null)
    swrFetch({
      key, forceRefresh: force,
      fetcher: () => fetch(`/api/meta-kpi?${tfQuery(tf)}`).then(r => r.json()),
      onUpdate: fresh => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => {
        if (cancelled) return
        if (j?.error && !j?.totals) setError(j.error)
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

  const totals = data?.totals || {}
  const prevTotals = data?.prevTotals || {}
  const daily = Array.isArray(data?.daily) ? data.daily : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header: titolo + preset selector + Aggiorna */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 10 }}>
          <PlatformBadges sources={['meta']} size={26} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.14)', color: '#22c55e', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em' }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
            LIVE
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <BmTimeframe value={tf} onChange={setTf} accent="#2997ff" disabled={loading} />
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            style={{
              border: '1px solid var(--border)', background: 'var(--glass)',
              color: 'var(--text)', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {loading ? t('shell.updating', null, 'Aggiorno…') : t('shell.refresh', null, 'Aggiorna')}
          </button>
          <DownloadReportButton tab="Meta KPI" preset={preset} />
        </div>
      </div>

      {error && (
        <div className="glass-card-static" style={{ padding: 18, color: '#fca5a5', fontSize: 13 }}><Icon name="warning" size={13} /> {error}</div>
      )}

      {loading && !data && (
        <div style={{ color: '#9b90aa', padding: 40, fontSize: 15, fontWeight: 700, textAlign: 'center' }}>
          {t('mkpi.loadingKpi', null, 'Carico i KPI Meta…')}
        </div>
      )}

      {data && (
        <>
          {/* CARD KPI */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}>
            {KPIS.map(k => (
              <KpiCard key={k.key} kpi={k} value={totals[k.key]} prev={prevTotals[k.key]} daily={daily} />
            ))}
          </div>

          {/* GRAFICI SEPARATI */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: 16,
          }}>
            {CHARTS.map(c => (
              <SeparateChart key={c.key} chart={c} daily={daily} />
            ))}
          </div>

          {/* Raccomandazioni proattive (come in Dashboard) */}
          <RecommendationsFeed metrics={live} preset={globalPreset || preset} />
        </>
      )}

      {/* Agente verticalizzato Meta Ads */}
      <MetaAdsAgent
        data={{ summary: totals, previousSummary: prevTotals, dailySeries: daily, range: data?.range, rows: [] }}
        preset={preset}
      />
    </div>
  )
}

// ── Card KPI singola ─────────────────────────────────────────
function KpiCard({ kpi, value, prev, daily }) {
  const { t } = useI18n()
  const v = Number(value || 0)
  const p = Number(prev || 0)
  const hasPrev = prev != null && Number.isFinite(p)
  const absDelta = hasPrev ? v - p : null
  const pctDelta = hasPrev && p !== 0 ? ((v - p) / Math.abs(p)) * 100 : null

  // Per metriche "lower is better" un calo (delta negativo) e' positivo.
  const isPositive = absDelta == null ? null
                   : kpi.lower ? absDelta < 0
                   : absDelta > 0

  const fmtAbs = (d) => {
    if (d == null) return ''
    const sign = d > 0 ? '+' : d < 0 ? '−' : ''
    const x = Math.abs(d)
    switch (kpi.kind) {
      case 'money':   return `${sign}€${x.toLocaleString('it-IT', { maximumFractionDigits: x < 100 ? 2 : 0 })}`
      case 'ratio':   return `${sign}${x.toFixed(2)}`
      case 'percent': return `${sign}${x.toFixed(2)} pp`
      case 'count':   return `${sign}${x.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`
      default:        return `${sign}${x.toFixed(2)}`
    }
  }

  return (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{
          fontSize: 10, color: 'var(--text3)', fontWeight: 800,
          letterSpacing: '0.10em', textTransform: 'uppercase',
        }}>
          {t(kpi.labelKey, null, kpi.label)}
        </div>
        <PlatformBadges sources={['meta']} size={14} />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
        <div style={{
          fontSize: 24, fontWeight: 900, color: 'var(--text)',
          letterSpacing: '-0.02em',
        }}>
          {kpi.fmt(value)}
        </div>
        <Sparkline data={daily} dataKey={kpi.key} color="#2997ff" />
      </div>
      {hasPrev && Math.abs(absDelta) > 0.0001 && (
        <div style={{
          marginTop: 8,
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontWeight: 700,
          color: isPositive ? '#22c55e' : '#f87171',
        }}>
          <span>{absDelta > 0 ? '▲' : '▼'}</span>
          {pctDelta != null && (
            <span>{Math.abs(pctDelta).toFixed(1)}%</span>
          )}
          <span style={{ color: 'var(--text3)', fontWeight: 600 }}>·</span>
          <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{fmtAbs(absDelta)}</span>
        </div>
      )}
      {hasPrev && Math.abs(absDelta) <= 0.0001 && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
          {t('mkpi.samePrev', null, '= periodo precedente')}
        </div>
      )}
    </div>
  )
}

// ── Singolo grafico separato ─────────────────────────────────
function SeparateChart({ chart, daily }) {
  const { t } = useI18n()
  const series = daily.map(d => ({
    date: (d.date || '').slice(5),
    v: d[chart.key] ?? 0,
  }))

  return (
    <div className="glass-card-static" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {t('mkpi.trend', null, 'Andamento')}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginTop: 3 }}>{t(chart.labelKey, null, chart.label)}</div>
        </div>
        <PlatformBadges sources={['meta']} size={16} />
      </div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series}>
            <defs>
              <linearGradient id={`grad-${chart.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="var(--text)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--text)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} width={50} />
            <Tooltip
              contentStyle={{ background: 'rgba(10,10,22,0.95)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 11 }}
              formatter={v => [chart.fmt(v), t(chart.labelKey, null, chart.label)]}
            />
            <Area type="monotone" dataKey="v" stroke="var(--text)" fill={`url(#grad-${chart.key})`} strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
