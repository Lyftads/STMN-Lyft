'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import { PlatformBadges } from './PlatformIcon'
import DownloadReportButton from './DownloadReportButton'
import BmTimeframe from './ui/BmTimeframe'
import { tfQuery, tfKey } from '../../lib/tfQuery'
import { useI18n } from '../../lib/i18n/I18nProvider'

const GOOGLE = '#eab308'

const eur  = v => v != null ? `€${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '—'
const eur2 = v => v != null ? `€${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 2 })}` : '—'
const int0 = v => v != null ? Number(v).toLocaleString('it-IT', { maximumFractionDigits: 0 }) : '—'
const pct  = v => v != null ? `${Number(v).toFixed(2)}%` : '—'
const mul  = v => v != null && v > 0 ? `${Number(v).toFixed(2)}x` : '—'

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

// Colonne metriche della tabella (oltre a Nome/Stato).
const COLS = [
  { key: 'budget',      label: 'Budget/g',    fmt: eur2, labelKey: 'gdet.dailyBudget' },
  { key: 'spend',       label: 'Spesa',       fmt: eur2, labelKey: 'meta.spend' },
  { key: 'impressions', label: 'Impr.',       fmt: int0, labelKey: 'mkpi.impressions' },
  { key: 'clicks',      label: 'Click',       fmt: int0, labelKey: 'gkpi.clicks' },
  { key: 'ctr',         label: 'CTR',         fmt: pct },
  { key: 'cpc',         label: 'CPC',         fmt: eur2 },
  { key: 'conversions', label: 'Conv.',       fmt: v => Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 }), labelKey: 'gkpi.conversions' },
  { key: 'convValue',   label: 'Valore conv.',fmt: eur2, labelKey: 'gkpi.convValue' },
  { key: 'roas',        label: 'ROAS',        fmt: mul },
  { key: 'cpa',         label: 'CPA',         fmt: eur2 },
  { key: 'convRate',    label: 'Conv. rate',  fmt: pct, labelKey: 'gkpi.convRate' },
]

// Metriche selezionabili nel grafico multi-linea (stile Google Ads). Ogni linea
// ha la sua scala (asse Y nascosto dedicato) così sono tutte leggibili insieme.
const CHART_METRICS = [
  { key: 'spend',       label: 'Costo',        color: '#34A853', fmt: eur2 },
  { key: 'convValue',   label: 'Valore conv.', color: '#EA4335', fmt: eur2 },
  { key: 'conversions', label: 'Conversioni',  color: '#FBBC04', fmt: v => Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 }) },
  { key: 'roas',        label: 'ROAS',         color: '#4285F4', fmt: mul },
  { key: 'cpa',         label: 'CPA',          color: '#A142F4', fmt: eur2 },
  { key: 'ctr',         label: 'CTR',          color: '#00ACC1', fmt: pct },
]

const statusColor = (s) => {
  const v = String(s || '').toUpperCase()
  if (v === 'ENABLED') return '#22c55e'
  if (v === 'PAUSED') return '#f59e0b'
  if (v === 'REMOVED') return '#ef4444'
  return 'var(--text3)'
}

export default function GoogleDetailTab() {
  const { t } = useI18n()
  const [tf, setTf] = useState({ preset: 'last_7d' })
  const preset = tf.preset
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [chartSel, setChartSel] = useState(['spend', 'convValue', 'conversions', 'roas'])

  // Drill-down state
  const [openCampaigns, setOpenCampaigns] = useState({})
  const [openAdgroups, setOpenAdgroups] = useState({})
  const [children, setChildren] = useState({})   // key → rows
  const [loadingNode, setLoadingNode] = useState({})

  const load = (force = false) => {
    let cancelled = false
    const key = `google-detail:${tfKey(tf)}`
    if (force) invalidate(key)
    const cached = !force ? getCached(key) : null
    if (cached) setData(cached.data)
    else setLoading(true)
    setError(null)
    // reset drill state al cambio periodo
    setOpenCampaigns({}); setOpenAdgroups({}); setChildren({})
    swrFetch({
      key, forceRefresh: force,
      fetcher: () => fetch(`/api/google-detail?${tfQuery(tf)}&level=campaigns`).then(r => r.json()),
      onUpdate: fresh => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => {
        if (cancelled) return
        if (j?.error && !j?.rows?.length) setError(j.error)
        if (!cached || force) setData(j)
      })
      .catch(e => { if (!cancelled && !cached) setError(e?.message) })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }

  useEffect(() => { const c = load(); return c }, [tf]) // eslint-disable-line react-hooks/exhaustive-deps

  async function drill(node, level, parentParam, openState, setOpen) {
    const key = `${level}:${node.id}`
    if (openState[node.id]) { setOpen(p => ({ ...p, [node.id]: false })); return }
    if (children[key]) { setOpen(p => ({ ...p, [node.id]: true })); return }
    setLoadingNode(p => ({ ...p, [key]: true }))
    try {
      const res = await fetch(`/api/google-detail?${tfQuery(tf)}&level=${level === 'campaign' ? 'adgroups' : 'ads'}&${parentParam}=${node.id}`, { cache: 'no-store' })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'Errore caricamento')
      setChildren(p => ({ ...p, [key]: j.rows || [] }))
      setOpen(p => ({ ...p, [node.id]: true }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingNode(p => ({ ...p, [key]: false }))
    }
  }

  const summary = data?.summary || {}
  const prev = data?.previousSummary || {}
  const rows = Array.isArray(data?.rows) ? data.rows : []
  const dailySeries = Array.isArray(data?.dailySeries) ? data.dailySeries : []
  const notConfigured = data && data.configured === false

  // Filtro stato campagna: tutte / attive (ENABLED) / in pausa (PAUSED) / bozza (altro)
  const statusOf = r => String(r.status || '').toUpperCase()
  const STATUS_FILTERS = [
    { id: 'all',     label: t('gdet.fAll', null, 'Tutte') },
    { id: 'enabled', label: t('gdet.fEnabled', null, 'Attive') },
    { id: 'paused',  label: t('gdet.fPaused', null, 'In pausa') },
    { id: 'draft',   label: t('gdet.fDraft', null, 'Bozza') },
  ]
  const matchStatus = (r) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'enabled') return statusOf(r) === 'ENABLED'
    if (statusFilter === 'paused') return statusOf(r) === 'PAUSED'
    return !['ENABLED', 'PAUSED'].includes(statusOf(r)) // draft / altro
  }
  const filteredRows = rows.filter(matchStatus)
  const countFor = (id) => rows.filter(r => {
    if (id === 'all') return true
    if (id === 'enabled') return statusOf(r) === 'ENABLED'
    if (id === 'paused') return statusOf(r) === 'PAUSED'
    return !['ENABLED', 'PAUSED'].includes(statusOf(r))
  }).length

  const SUMMARY = [
    { key: 'spend', label: t('meta.spend', null, 'Spesa'), fmt: eur, lower: false },
    { key: 'roas', label: 'ROAS', fmt: mul, lower: false },
    { key: 'conversions', label: t('gkpi.conversions', null, 'Conversioni'), fmt: v => Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 1 }), lower: false },
    { key: 'convValue', label: t('gkpi.convValue', null, 'Valore conv.'), fmt: eur, lower: false },
    { key: 'cpa', label: 'CPA', fmt: eur2, lower: true },
    { key: 'ctr', label: 'CTR', fmt: pct, lower: false },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="glass-card-static" style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 10 }}>
          <PlatformBadges sources={['google']} size={26} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.14)', color: '#22c55e', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em' }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
            LIVE
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <BmTimeframe value={tf} onChange={setTf} accent={GOOGLE} disabled={loading} />
          <button type="button" onClick={() => load(true)} disabled={loading}
            style={{ border: '1px solid var(--border)', background: 'var(--glass)', color: 'var(--text)', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {loading ? t('shell.updating', null, 'Aggiorno…') : t('shell.refresh', null, 'Aggiorna')}
          </button>
          <DownloadReportButton tab="Google Detail" preset={preset} />
        </div>
      </div>

      {notConfigured && (
        <div className="glass-card-static" style={{ padding: 18, color: 'var(--text3)', fontSize: 13 }}>
          <Icon name="warning" size={13} /> {t('gkpi.notConfigured', null, 'Google Ads non collegato per questo account.')}
        </div>
      )}
      {error && (
        <div className="glass-card-static" style={{ padding: 18, color: '#fca5a5', fontSize: 13 }}><Icon name="warning" size={13} /> {error}</div>
      )}
      {loading && !data && (
        <div style={{ color: '#9b90aa', padding: 40, fontSize: 15, fontWeight: 700, textAlign: 'center' }}>{t('gdet.loading', null, 'Carico le campagne Google…')}</div>
      )}

      {data && !notConfigured && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {SUMMARY.map(s => {
              const v = Number(summary[s.key] || 0), p = Number(prev[s.key] || 0)
              const delta = p !== 0 ? ((v - p) / Math.abs(p)) * 100 : null
              const pos = delta == null ? null : (s.lower ? delta < 0 : delta > 0)
              return (
                <div key={s.key} className="glass-card" style={{ padding: '16px 18px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontSize: 23, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>{s.fmt(summary[s.key])}</div>
                  {delta != null && Math.abs(delta) >= 0.05 && (
                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: pos ? '#22c55e' : '#f87171' }}>
                      {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Grafico multi-linea stile Google Ads (metriche delle card) */}
          {dailySeries.length > 1 && (
            <div className="glass-card-static" style={{ padding: 20 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {CHART_METRICS.map(m => {
                  const on = chartSel.includes(m.key)
                  return (
                    <button key={m.key} type="button"
                      onClick={() => setChartSel(s => s.includes(m.key) ? (s.length > 1 ? s.filter(k => k !== m.key) : s) : [...s, m.key])}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, border: `1px solid ${on ? m.color : 'var(--border)'}`, background: on ? `${m.color}1f` : 'var(--glass)', color: on ? m.color : 'var(--text3)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: on ? m.color : 'var(--text3)' }} />
                      {m.label}
                    </button>
                  )
                })}
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailySeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={d => (d || '').slice(5)} tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} minTickGap={24} />
                    {CHART_METRICS.filter(m => chartSel.includes(m.key)).map(m => (
                      <YAxis key={m.key} yAxisId={m.key} hide domain={['auto', 'auto']} />
                    ))}
                    <Tooltip
                      contentStyle={{ background: 'rgba(10,10,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, fontSize: 11 }}
                      labelFormatter={d => d}
                      formatter={(value, name) => {
                        const m = CHART_METRICS.find(x => x.key === name)
                        return [m ? m.fmt(value) : value, m ? m.label : name]
                      }}
                    />
                    {CHART_METRICS.filter(m => chartSel.includes(m.key)).map(m => (
                      <Line key={m.key} yAxisId={m.key} type="monotone" dataKey={m.key} name={m.key} stroke={m.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Filtro stato campagna */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map(f => {
              const active = statusFilter === f.id
              return (
                <button key={f.id} type="button" onClick={() => setStatusFilter(f.id)}
                  style={{ background: active ? `${GOOGLE}22` : 'var(--glass)', border: `1px solid ${active ? GOOGLE : 'var(--border)'}`, color: active ? GOOGLE : 'var(--text2)', borderRadius: 999, padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {f.label}
                  <span style={{ background: active ? GOOGLE : 'rgba(255,255,255,0.06)', color: active ? '#0a0a14' : 'var(--text3)', padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>{countFor(f.id)}</span>
                </button>
              )
            })}
          </div>

          {/* Tabella gerarchica */}
          <div className="glass-card-static" style={{ padding: 0, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={thStyle('left')}>{t('gdet.name', null, 'Nome')}</th>
                  <th style={thStyle('left')}>{t('gdet.status', null, 'Stato')}</th>
                  {COLS.map(c => <th key={c.key} style={thStyle('right')}>{t(c.labelKey, null, c.label)}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr><td colSpan={2 + COLS.length} style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('gdet.noData', null, 'Nessuna campagna nel periodo.')}</td></tr>
                )}
                {filteredRows.map(camp => {
                  const cOpen = !!openCampaigns[camp.id]
                  const cKey = `campaign:${camp.id}`
                  const adgroups = children[cKey] || []
                  return (
                    <FragmentRows key={camp.id}>
                      <Row row={camp} depth={0} expandable open={cOpen} loadingNode={loadingNode[cKey]} onToggle={() => drill(camp, 'campaign', 'campaign_id', openCampaigns, setOpenCampaigns)} />
                      {cOpen && adgroups.map(ag => {
                        const aOpen = !!openAdgroups[ag.id]
                        const aKey = `adgroup:${ag.id}`
                        const ads = children[aKey] || []
                        return (
                          <FragmentRows key={ag.id}>
                            <Row row={ag} depth={1} expandable open={aOpen} loadingNode={loadingNode[aKey]} onToggle={() => drill(ag, 'adgroup', 'adgroup_id', openAdgroups, setOpenAdgroups)} />
                            {aOpen && ads.map(ad => <Row key={ad.id} row={ad} depth={2} />)}
                            {aOpen && ads.length === 0 && <EmptyRow depth={2} text={t('gdet.noAds', null, 'Nessun annuncio')} />}
                          </FragmentRows>
                        )
                      })}
                      {cOpen && adgroups.length === 0 && <EmptyRow depth={1} text={t('gdet.noAdgroups', null, 'Nessun gruppo di annunci')} />}
                    </FragmentRows>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function FragmentRows({ children }) { return <>{children}</> }

function thStyle(align) {
  return { padding: '12px 14px', textAlign: align, fontSize: 10, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'rgba(10,10,22,0.92)' }
}

function Row({ row, depth, expandable, open, onToggle, loadingNode }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '11px 14px', minWidth: 280 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: depth * 22 }}>
          {expandable ? (
            <button onClick={onToggle} style={{ width: 20, height: 20, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 11 }}>
              {loadingNode ? '…' : (open ? '▾' : '▸')}
            </button>
          ) : <span style={{ width: 20, display: 'inline-block' }} />}
          <span style={{ fontSize: depth === 0 ? 13 : 12.5, fontWeight: depth === 0 ? 800 : 600, color: depth === 0 ? 'var(--text)' : 'var(--text2)' }}>{row.name}</span>
        </div>
      </td>
      <td style={{ padding: '11px 14px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(row.status) }}>{row.status || '—'}</span>
      </td>
      {COLS.map(c => (
        <td key={c.key} style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12.5, fontWeight: c.key === 'spend' || c.key === 'roas' ? 800 : 600, color: c.key === 'roas' ? (row.roas >= 3 ? '#22c55e' : row.roas >= 1 ? '#f59e0b' : '#ef4444') : 'var(--text)', whiteSpace: 'nowrap' }}>
          {c.fmt(row[c.key])}
        </td>
      ))}
    </tr>
  )
}

function EmptyRow({ depth, text }) {
  return (
    <tr>
      <td colSpan={12} style={{ padding: '9px 14px', paddingLeft: 14 + depth * 22 + 28, fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>{text}</td>
    </tr>
  )
}
