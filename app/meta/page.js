'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Locale + traduttore condivisi con le funzioni module-level (impostati al render).
let _MP_LOC = 'it-IT'
let _MP_T = (k, v, f) => f

const PRESETS = [
  { id: 'today', tkey: 'mp.presetToday', en: 'Today' },
  { id: 'yesterday', tkey: 'mp.presetYesterday', en: 'Yesterday' },
  { id: 'last_7d', tkey: 'mp.preset7d', en: 'Last 7d' },
  { id: 'last_14d', tkey: 'mp.preset14d', en: 'Last 14d' },
  { id: 'last_28d', tkey: 'mp.preset28d', en: 'Last 28d' },
  { id: 'this_month', tkey: 'mp.presetThisMonth', en: 'This month' },
  { id: 'last_month', tkey: 'mp.presetLastMonth', en: 'Last month' },
  { id: 'custom', tkey: null, en: 'Custom' },
]

const GREEN = '#22c55e'
const RED = '#ef4444'
const BLUE = '#3b82f6'
const TEXT = '#e8edf7'
const MUTED = '#7c8aa5'
const CARD = '#0a1020'
const BORDER = '#1d3151'
const BG = '#030817'

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function fmtInt(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  return Math.round(Number(v)).toLocaleString(_MP_LOC)
}

function fmtMoney(v, decimals = 0) {
  if (!v) return decimals === 0 ? '—' : '—'
  return `€${Number(v).toLocaleString(_MP_LOC, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

function fmtPct(v, decimals = 2) {
  if (!v) return '0,00%'
  return `${Number(v).toLocaleString(_MP_LOC, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`
}

function fmtRatio(v) {
  if (!v) return '0,00x'
  return `${Number(v).toLocaleString(_MP_LOC, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}x`
}

function delta(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  const x = Number(v)
  const sign = x > 0 ? '+' : ''
  return `${sign}${x.toFixed(1)}%`
}

function deltaColor(v, inverse = false) {
  if (v === null || v === undefined) return MUTED
  const good = inverse ? v < 0 : v > 0
  return good ? GREEN : RED
}

function indent(level) {
  if (level === 'adset') return 24
  if (level === 'ad') return 48
  return 0
}

function levelLabel(row) {
  if (row.level === 'campaign') return _MP_T('mp.levelCampaign', null, 'Campaign')
  if (row.level === 'adset') return _MP_T('mp.levelAdset', null, 'Ad set')
  return _MP_T('mp.levelAd', null, 'Ad')
}

function MetricCard({ label, value }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  )
}

function PresetButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.preset,
        borderColor: active ? GREEN : BORDER,
        color: active ? GREEN : MUTED,
        background: active ? '#052e16' : '#071124',
      }}
    >
      {children}
    </button>
  )
}

function Thumb({ url }) {
  if (!url) {
    return (
      <div style={styles.thumbEmpty}>
        —
      </div>
    )
  }

  return (
    <img
      src={url}
      alt=""
      style={styles.thumb}
    />
  )
}

function Row({
  row,
  isOpen,
  isLoading,
  onToggle,
}) {
  const canOpen = row.level !== 'ad'

  return (
    <tr style={styles.tr}>
      <td style={styles.tdLevel}>
        <div
          onClick={canOpen ? onToggle : undefined}
          style={{
            ...styles.levelCell,
            paddingLeft: indent(row.level),
            cursor: canOpen ? 'pointer' : 'default',
          }}
        >
          {canOpen && (
            <span style={styles.arrow}>
              {isLoading ? '…' : isOpen ? '▼' : '▶'}
            </span>
          )}

          {!canOpen && <span style={styles.arrowSpacer} />}

          <div>
            <div style={{ color: row.level === 'campaign' ? GREEN : TEXT, fontWeight: 900 }}>
              {levelLabel(row)} · {row.name || _MP_T('mp.unnamed', null, 'Unnamed')}
            </div>

            <div style={styles.idText}>
              {row.status ? `${row.status} · ` : ''}
              {row.id}
            </div>
          </div>
        </div>
      </td>

      <td style={styles.tdCenter}>
        {row.level === 'ad' ? <Thumb url={row.thumbnail_url} /> : '—'}
      </td>

      <td style={styles.td}>{fmtInt(row.impressions)}</td>
      <td style={styles.td}>{fmtInt(row.reach)}</td>
      <td style={styles.td}>{n(row.frequency).toFixed(2)}</td>
      <td style={styles.td}>{fmtMoney(row.cpm, 2)}</td>
      <td style={styles.td}>{fmtPct(row.ctr_link, 2)}</td>
      <td style={styles.td}>{fmtMoney(row.cpc_link, 2)}</td>
      <td style={styles.td}>{fmtInt(row.link_clicks)}</td>
      <td style={styles.td}>{fmtMoney(row.spend, 0)}</td>
      <td style={styles.td}>{fmtMoney(row.cost_per_result, 2)}</td>
      <td style={styles.td}>{fmtRatio(row.roas)}</td>
      <td style={styles.td}>{row.purchases ? fmtInt(row.purchases) : '—'}</td>
      <td style={styles.td}>{fmtPct(row.conversione_acquisti, 2)}</td>
      <td style={styles.td}>{fmtPct(row.cro_campagna, 2)}</td>
      <td style={styles.td}>{fmtMoney(row.aov_campagna, 2)}</td>
    </tr>
  )
}

export default function MetaPage() {
  const { t, intlLocale } = useI18n()
  _MP_LOC = intlLocale; _MP_T = t
  const [preset, setPreset] = useState('last_28d')
  const [customSince, setCustomSince] = useState('')
  const [customUntil, setCustomUntil] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [openCampaigns, setOpenCampaigns] = useState({})
  const [openAdsets, setOpenAdsets] = useState({})
  const [children, setChildren] = useState({})
  const [loadingNode, setLoadingNode] = useState({})

  const qs = useCallback(
    extra => {
      const params = new URLSearchParams()
      params.set('preset', preset)

      if (preset === 'custom') {
        if (customSince) params.set('since', customSince)
        if (customUntil) params.set('until', customUntil)
      }

      Object.entries(extra || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.set(key, value)
      })

      return params.toString()
    },
    [preset, customSince, customUntil]
  )

  const fetchMain = useCallback(async () => {
    setLoading(true)
    setError('')
    setOpenCampaigns({})
    setOpenAdsets({})
    setChildren({})

    try {
      const res = await fetch(`/api/meta-detail?${qs({ level: 'campaigns' })}`, {
        cache: 'no-store',
      })

      const json = await res.json()

      if (!json.ok) {
        throw new Error(json.error || t('mp.errMeta', null, 'Error loading Meta'))
      }

      setData(json)
    } catch (e) {
      setError(e.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [qs])

  useEffect(() => {
    fetchMain()
  }, [fetchMain])

  async function toggleCampaign(campaign) {
    const key = `campaign:${campaign.id}`

    if (openCampaigns[campaign.id]) {
      setOpenCampaigns(prev => ({ ...prev, [campaign.id]: false }))
      return
    }

    if (children[key]) {
      setOpenCampaigns(prev => ({ ...prev, [campaign.id]: true }))
      return
    }

    setLoadingNode(prev => ({ ...prev, [key]: true }))
    setError('')

    try {
      const res = await fetch(
        `/api/meta-detail?${qs({
          level: 'adsets',
          campaign_id: campaign.id,
        })}`,
        { cache: 'no-store' }
      )

      const json = await res.json()

      if (!json.ok) {
        throw new Error(json.error || t('mp.errAdsets', null, 'Error loading ad sets'))
      }

      setChildren(prev => ({ ...prev, [key]: json.rows || [] }))
      setOpenCampaigns(prev => ({ ...prev, [campaign.id]: true }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingNode(prev => ({ ...prev, [key]: false }))
    }
  }

  async function toggleAdset(adset) {
    const key = `adset:${adset.id}`

    if (openAdsets[adset.id]) {
      setOpenAdsets(prev => ({ ...prev, [adset.id]: false }))
      return
    }

    if (children[key]) {
      setOpenAdsets(prev => ({ ...prev, [adset.id]: true }))
      return
    }

    setLoadingNode(prev => ({ ...prev, [key]: true }))
    setError('')

    try {
      const res = await fetch(
        `/api/meta-detail?${qs({
          level: 'ads',
          adset_id: adset.id,
        })}`,
        { cache: 'no-store' }
      )

      const json = await res.json()

      if (!json.ok) {
        throw new Error(json.error || t('mp.errAds', null, 'Error loading ads'))
      }

      setChildren(prev => ({ ...prev, [key]: json.rows || [] }))
      setOpenAdsets(prev => ({ ...prev, [adset.id]: true }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingNode(prev => ({ ...prev, [key]: false }))
    }
  }

  const visibleRows = useMemo(() => {
    const rows = []

    for (const campaign of data?.rows || []) {
      rows.push(campaign)

      const campaignKey = `campaign:${campaign.id}`

      if (openCampaigns[campaign.id]) {
        for (const adset of children[campaignKey] || []) {
          rows.push(adset)

          const adsetKey = `adset:${adset.id}`

          if (openAdsets[adset.id]) {
            for (const ad of children[adsetKey] || []) {
              rows.push(ad)
            }
          }
        }
      }
    }

    return rows
  }, [data, children, openCampaigns, openAdsets])

  const summary = data?.summary || {}

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.h1}>Meta Detail</h1>
            <p style={styles.subtitle}>{t('mp.subtitle', null, 'Hierarchical analysis campaigns · ad sets · ads')}</p>
          </div>

          <div style={styles.status}>
            {loading ? t('mp.loading', null, 'Loading…') : data?.sources?.meta ? t('mp.dataLoaded', null, 'Data loaded') : t('mp.metaNotLoaded', null, 'Meta not loaded')}
          </div>
        </header>

        <section style={styles.presetsBox}>
          <div style={styles.presets}>
            {PRESETS.map(p => (
              <PresetButton
                key={p.id}
                active={preset === p.id}
                onClick={() => setPreset(p.id)}
              >
                {t(p.tkey, null, p.en)}
              </PresetButton>
            ))}

            <button
              onClick={fetchMain}
              style={styles.refresh}
              disabled={loading}
            >
              ↻ {t('mp.refresh', null, 'Refresh')}
            </button>
          </div>

          {preset === 'custom' && (
            <div style={styles.customBox}>
              <input
                type="date"
                value={customSince}
                onChange={e => setCustomSince(e.target.value)}
                style={styles.input}
              />
              <input
                type="date"
                value={customUntil}
                onChange={e => setCustomUntil(e.target.value)}
                style={styles.input}
              />
            </div>
          )}
        </section>

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        <section style={styles.metrics}>
          <MetricCard label={t('mp.amountSpent', null, 'Amount spent')} value={fmtMoney(summary.spend, 0)} />
          <MetricCard label="ROAS" value={fmtRatio(summary.roas)} />
          <MetricCard label={t('mp.costPerResult', null, 'Cost per result')} value={fmtMoney(summary.cost_per_result, 2)} />
          <MetricCard label={t('mp.purchases', null, 'Purchases')} value={summary.purchases ? fmtInt(summary.purchases) : '—'} />
          <MetricCard label="CTR link" value={fmtPct(summary.ctr_link, 2)} />
          <MetricCard label={t('mp.frequency', null, 'Frequency')} value={n(summary.frequency).toFixed(2)} />
        </section>

        <section style={styles.twoCols}>
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>{t('mp.comparison', null, 'Comparison · period vs previous')}</h2>
            <p style={styles.small}>
              {t('mp.prevPeriod', null, 'Previous period:')} {data?.previousRange?.since || '—'} → {data?.previousRange?.until || '—'}
            </p>

            <div style={styles.compareGrid}>
              <div style={styles.compareItem}>
                <span style={styles.compareLabel}>{t('mp.spend', null, 'Spend')}</span>
                <strong style={{ color: deltaColor(data?.comparison?.spend, false) }}>
                  {delta(data?.comparison?.spend)}
                </strong>
              </div>

              <div style={styles.compareItem}>
                <span style={styles.compareLabel}>ROAS</span>
                <strong style={{ color: deltaColor(data?.comparison?.roas, false) }}>
                  {delta(data?.comparison?.roas)}
                </strong>
              </div>

              <div style={styles.compareItem}>
                <span style={styles.compareLabel}>CPA</span>
                <strong style={{ color: deltaColor(data?.comparison?.cpa, true) }}>
                  {delta(data?.comparison?.cpa)}
                </strong>
              </div>

              <div style={styles.compareItem}>
                <span style={styles.compareLabel}>CTR</span>
                <strong style={{ color: deltaColor(data?.comparison?.ctr, false) }}>
                  {delta(data?.comparison?.ctr)}
                </strong>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>{t('mp.autoInsight', null, 'Automatic insight')}</h2>
            <p style={styles.paragraph}>{data?.insight || '—'}</p>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{t('mp.recommendedTodos', null, 'Recommended to-dos')}</h2>

          <div style={styles.todoList}>
            {(data?.todos || []).map((todo, i) => (
              <div key={i} style={styles.todo}>
                <strong style={{ color: GREEN }}>#{i + 1}</strong> {todo}
              </div>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{t('mp.hierarchy', null, 'Meta hierarchy · campaigns / ad sets / ads')}</h2>
          <p style={styles.small}>
            {t('mp.hierarchySub', null, 'Shows only active campaigns. Click a campaign to open its active ad sets. Click an ad set to open its active ads.')}
          </p>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.thLevel}>{t('mp.level', null, 'Level')}</th>
                  <th style={styles.th}>{t('mp.preview', null, 'Preview')}</th>
                  <th style={styles.th}>Impression</th>
                  <th style={styles.th}>{t('mp.reach', null, 'Reach')}</th>
                  <th style={styles.th}>{t('mp.freq', null, 'Freq.')}</th>
                  <th style={styles.th}>CPM</th>
                  <th style={styles.th}>CTR link</th>
                  <th style={styles.th}>CPC link</th>
                  <th style={styles.th}>Click link</th>
                  <th style={styles.th}>{t('mp.spent', null, 'Spent')}</th>
                  <th style={styles.th}>{t('mp.costPerResult', null, 'Cost per result')}</th>
                  <th style={styles.th}>ROAS</th>
                  <th style={styles.th}>{t('mp.purchases', null, 'Purchases')}</th>
                  <th style={styles.th}>{t('mp.purchaseConv', null, 'Purchase conv.')}</th>
                  <th style={styles.th}>{t('mp.croCampaign', null, 'Campaign CRO')}</th>
                  <th style={styles.th}>{t('mp.aovCampaign', null, 'Campaign AOV')}</th>
                </tr>
              </thead>

              <tbody>
                {visibleRows.length > 0 ? (
                  visibleRows.map(row => {
                    const key =
                      row.level === 'campaign'
                        ? `campaign:${row.id}`
                        : row.level === 'adset'
                          ? `adset:${row.id}`
                          : `ad:${row.id}`

                    return (
                      <Row
                        key={key}
                        row={row}
                        isOpen={
                          row.level === 'campaign'
                            ? !!openCampaigns[row.id]
                            : row.level === 'adset'
                              ? !!openAdsets[row.id]
                              : false
                        }
                        isLoading={!!loadingNode[key]}
                        onToggle={() => {
                          if (row.level === 'campaign') toggleCampaign(row)
                          if (row.level === 'adset') toggleAdset(row)
                        }}
                      />
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan="16" style={styles.empty}>
                      {loading ? t('mp.loadingData', null, 'Loading Meta data…') : t('mp.noCampaigns', null, 'No active campaign available for the selected period.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: BG,
    color: TEXT,
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    padding: '34px 22px',
  },

  container: {
    maxWidth: 1680,
    margin: '0 auto',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },

  h1: {
    fontSize: 26,
    margin: 0,
    letterSpacing: '-0.04em',
  },

  subtitle: {
    margin: '10px 0 0',
    color: MUTED,
    fontSize: 13,
  },

  status: {
    color: GREEN,
    fontSize: 13,
    fontWeight: 800,
  },

  presetsBox: {
    background: CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: 18,
    marginBottom: 18,
  },

  presets: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },

  preset: {
    border: '1px solid',
    borderRadius: 999,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },

  refresh: {
    marginLeft: 'auto',
    background: GREEN,
    color: '#00140a',
    border: 'none',
    borderRadius: 999,
    padding: '11px 22px',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
  },

  customBox: {
    display: 'flex',
    gap: 10,
    marginTop: 14,
  },

  input: {
    background: '#071124',
    border: `1px solid ${BORDER}`,
    color: TEXT,
    borderRadius: 8,
    padding: '10px 12px',
  },

  error: {
    border: `1px solid ${RED}`,
    background: '#2b0b12',
    color: '#ff6b6b',
    padding: 16,
    borderRadius: 10,
    marginBottom: 18,
    fontWeight: 800,
  },

  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
    gap: 12,
    marginBottom: 18,
  },

  metricCard: {
    background: CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: 20,
    minHeight: 90,
  },

  metricLabel: {
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    fontSize: 11,
    color: MUTED,
    fontWeight: 900,
    marginBottom: 16,
  },

  metricValue: {
    fontSize: 27,
    fontWeight: 900,
    fontFamily: 'Georgia, serif',
  },

  twoCols: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 18,
    marginBottom: 18,
  },

  card: {
    background: CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: 22,
    marginBottom: 18,
  },

  sectionTitle: {
    margin: 0,
    marginBottom: 16,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: '0.22em',
    fontWeight: 1000,
  },

  small: {
    color: MUTED,
    fontSize: 13,
    margin: '0 0 16px',
  },

  paragraph: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 1.6,
    margin: 0,
  },

  compareGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 10,
  },

  compareItem: {
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: 14,
    background: '#071124',
  },

  compareLabel: {
    display: 'block',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    fontSize: 11,
    fontWeight: 900,
    marginBottom: 14,
  },

  todoList: {
    display: 'grid',
    gap: 10,
  },

  todo: {
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: 14,
    color: '#cbd5e1',
    background: '#071124',
    lineHeight: 1.5,
  },

  tableWrap: {
    overflowX: 'auto',
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 1700,
  },

  thLevel: {
    textAlign: 'left',
    padding: '14px 14px',
    borderBottom: `1px solid ${BORDER}`,
    color: '#fff',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    minWidth: 360,
  },

  th: {
    textAlign: 'left',
    padding: '14px 14px',
    borderBottom: `1px solid ${BORDER}`,
    color: '#fff',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    whiteSpace: 'nowrap',
  },

  tr: {
    borderBottom: '1px solid #12223a',
  },

  tdLevel: {
    padding: '13px 14px',
    minWidth: 360,
  },

  levelCell: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
  },

  arrow: {
    color: GREEN,
    fontSize: 10,
    marginTop: 4,
    width: 14,
  },

  arrowSpacer: {
    width: 14,
  },

  idText: {
    marginTop: 5,
    color: MUTED,
    fontSize: 11,
    fontWeight: 600,
  },

  td: {
    padding: '13px 14px',
    color: '#dbe4f0',
    fontSize: 14,
    whiteSpace: 'nowrap',
  },

  tdCenter: {
    padding: '13px 14px',
    color: '#dbe4f0',
    fontSize: 14,
    whiteSpace: 'nowrap',
    textAlign: 'left',
  },

  thumb: {
    width: 54,
    height: 54,
    objectFit: 'cover',
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
  },

  thumbEmpty: {
    width: 54,
    height: 54,
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: MUTED,
  },

  empty: {
    padding: 20,
    color: TEXT,
    fontSize: 15,
  },
}
