'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import { PlatformBadges } from './PlatformIcon'
import DownloadReportButton from './DownloadReportButton'
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

const statusColor = (s) => {
  const v = String(s || '').toUpperCase()
  if (v === 'ENABLED') return '#22c55e'
  if (v === 'PAUSED') return '#f59e0b'
  if (v === 'REMOVED') return '#ef4444'
  return 'var(--text3)'
}

export default function GoogleDetailTab() {
  const { t } = useI18n()
  const [preset, setPreset] = useState('last_28d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Drill-down state
  const [openCampaigns, setOpenCampaigns] = useState({})
  const [openAdgroups, setOpenAdgroups] = useState({})
  const [children, setChildren] = useState({})   // key → rows
  const [loadingNode, setLoadingNode] = useState({})

  const load = (force = false) => {
    let cancelled = false
    const key = `google-detail:${preset}`
    if (force) invalidate(key)
    const cached = !force ? getCached(key) : null
    if (cached) setData(cached.data)
    else setLoading(true)
    setError(null)
    // reset drill state al cambio periodo
    setOpenCampaigns({}); setOpenAdgroups({}); setChildren({})
    swrFetch({
      key, forceRefresh: force,
      fetcher: () => fetch(`/api/google-detail?preset=${encodeURIComponent(preset)}&level=campaigns`).then(r => r.json()),
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

  useEffect(() => { const c = load(); return c }, [preset]) // eslint-disable-line react-hooks/exhaustive-deps

  async function drill(node, level, parentParam, openState, setOpen) {
    const key = `${level}:${node.id}`
    if (openState[node.id]) { setOpen(p => ({ ...p, [node.id]: false })); return }
    if (children[key]) { setOpen(p => ({ ...p, [node.id]: true })); return }
    setLoadingNode(p => ({ ...p, [key]: true }))
    try {
      const res = await fetch(`/api/google-detail?preset=${encodeURIComponent(preset)}&level=${level === 'campaign' ? 'adgroups' : 'ads'}&${parentParam}=${node.id}`, { cache: 'no-store' })
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
  const notConfigured = data && data.configured === false

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
        <span style={{ width: 42, height: 42, borderRadius: 11, background: 'rgba(234,179,8,0.14)', color: GOOGLE, display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 900 }}>G</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 9.5, color: GOOGLE, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Google Detail</div>
            <PlatformBadges sources={['google']} size={16} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 4, letterSpacing: '-0.02em' }}>
            {t('gdet.header', null, 'Gerarchia campagne Google Ads')} · {data?.range?.since} → {data?.range?.until}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={preset} onChange={e => setPreset(e.target.value)}
            style={{ background: 'var(--glass)', border: '1px solid var(--border)', color: '#fff', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, outline: 'none', cursor: 'pointer', minWidth: 160 }}>
            {PRESETS.map(o => <option key={o.value} value={o.value} style={{ background: '#0a0a14' }}>{t(o.labelKey, null, o.label)}</option>)}
          </select>
          <button type="button" onClick={() => load(true)} disabled={loading}
            style={{ border: '1px solid var(--border)', background: 'var(--glass)', color: '#fff', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
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
                  <div style={{ fontSize: 23, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{s.fmt(summary[s.key])}</div>
                  {delta != null && Math.abs(delta) >= 0.05 && (
                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: pos ? '#22c55e' : '#f87171' }}>
                      {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                    </div>
                  )}
                </div>
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
                {rows.length === 0 && (
                  <tr><td colSpan={2 + COLS.length} style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('gdet.noData', null, 'Nessuna campagna nel periodo.')}</td></tr>
                )}
                {rows.map(camp => {
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
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <td style={{ padding: '11px 14px', minWidth: 280 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: depth * 22 }}>
          {expandable ? (
            <button onClick={onToggle} style={{ width: 20, height: 20, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 11 }}>
              {loadingNode ? '…' : (open ? '▾' : '▸')}
            </button>
          ) : <span style={{ width: 20, display: 'inline-block' }} />}
          <span style={{ fontSize: depth === 0 ? 13 : 12.5, fontWeight: depth === 0 ? 800 : 600, color: depth === 0 ? '#fff' : 'var(--text2)' }}>{row.name}</span>
        </div>
      </td>
      <td style={{ padding: '11px 14px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(row.status) }}>{row.status || '—'}</span>
      </td>
      {COLS.map(c => (
        <td key={c.key} style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12.5, fontWeight: c.key === 'spend' || c.key === 'roas' ? 800 : 600, color: c.key === 'roas' ? (row.roas >= 3 ? '#22c55e' : row.roas >= 1 ? '#f59e0b' : '#ef4444') : '#fff', whiteSpace: 'nowrap' }}>
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
