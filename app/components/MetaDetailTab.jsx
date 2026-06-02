'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import MetaAdsAgent from './MetaAdsAgent'
import CreativeFatiguePanel from './CreativeFatiguePanel'

const PRESETS = [
  { id: 'today', label: 'Oggi' },
  { id: 'yesterday', label: 'Ieri' },
  { id: 'last_7d', label: 'Ultimi 7g' },
  { id: 'last_14d', label: 'Ultimi 14g' },
  { id: 'last_28d', label: 'Ultimi 28g' },
  { id: 'this_month', label: 'Mese corrente' },
  { id: 'last_month', label: 'Mese scorso' },
  { id: 'custom', label: 'Custom' },
]

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function fmtInt(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  return Math.round(Number(v)).toLocaleString('it-IT')
}

function fmtMoney(v, decimals = 0) {
  if (!v) return '—'
  return `€${Number(v).toLocaleString('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

function fmtPct(v, decimals = 2) {
  if (v == null || v === 0) return '0,00%'
  return `${Number(v).toLocaleString('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`
}

function fmtRatio(v) {
  if (!v) return '0,00×'
  return `${Number(v).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}×`
}

function delta(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  const x = Number(v)
  const sign = x > 0 ? '+' : ''
  return `${sign}${x.toFixed(1)}%`
}

function deltaGood(v, inverse = false) {
  if (v === null || v === undefined) return null
  return inverse ? v < 0 : v > 0
}

function indent(level) {
  if (level === 'adset') return 22
  if (level === 'ad') return 44
  return 0
}

function levelBadge(level) {
  if (level === 'campaign') return { label: 'Campagna', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' }
  if (level === 'adset') return { label: 'Ad set', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' }
  return { label: 'Ad', color: '#bf5af2', bg: 'rgba(191,90,242,0.15)' }
}

// Sparkline simbolico per "performance" (usa ROAS)
function PerfDot({ roas }) {
  const v = n(roas)
  const color =
    v >= 4 ? '#22c55e' :
    v >= 2.5 ? '#3b82f6' :
    v >= 1.5 ? '#f59e0b' :
    '#ef4444'
  return (
    <span style={{
      width: 8, height: 8, borderRadius: 999,
      background: color,
      boxShadow: `0 0 10px ${color}`,
      display: 'inline-block', flexShrink: 0,
    }} />
  )
}

function Sparkline({ data, dataKey, color = '#fff', width = 110, height = 32 }) {
  const vals = (data || []).map(d => Number(d[dataKey] || 0))
  if (vals.length < 2 || vals.every(v => v === 0)) return null
  const max = Math.max(...vals), min = Math.min(...vals)
  const range = max - min || 1
  const points = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  // Area fill path
  const areaPoints = `0,${height} ${points} ${width},${height}`
  const gid = `sl-${dataKey}-${color.replace('#', '')}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gid})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Stessa palette/effetti del Simulatore
const ACCENT_GLOW = '#2997ff'

function KpiCard({ label, value, prevDelta, inverse = false, accent = '#fff', daily, dataKey, delay = 0 }) {
  const good = deltaGood(prevDelta, inverse)
  return (
    <div
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)',
        backdropFilter: 'blur(40px) saturate(2.2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
        borderRadius: 22,
        overflow: 'hidden',
        border: '1.5px solid rgba(255,255,255,0.06)',
        borderTopColor: 'rgba(255,255,255,0.12)',
        borderBottomColor: 'rgba(0,0,0,0.65)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.80), 0 12px 24px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)',
        padding: '20px 22px',
        animation: 'sim-pulse 6s ease-in-out infinite',
        animationDelay: `${delay}s`,
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.animationPlayState = 'paused'
        e.currentTarget.style.transform = 'translateY(-8px) scale(1.012)'
        e.currentTarget.style.boxShadow = `0 60px 120px rgba(0,0,0,0.85), 0 30px 60px rgba(0,0,0,0.6), 0 0 80px ${ACCENT_GLOW}22, inset 0 1.5px 0 rgba(255,255,255,0.08), inset 0 -1.5px 0 rgba(0,0,0,0.3)`
        e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.animationPlayState = 'running'
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = '0 30px 80px rgba(0,0,0,0.80), 0 12px 24px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)'
        e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
        background: `linear-gradient(90deg, transparent, ${ACCENT_GLOW}88, transparent)`,
        filter: 'blur(0.3px)',
        opacity: 0.85,
        animation: 'cr-shine 4s ease-in-out infinite',
        zIndex: 3,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '-50%',
        width: '40%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)',
        animation: 'sim-scan 9s ease-in-out infinite',
        animationDelay: `${delay + 1}s`,
        pointerEvents: 'none',
        zIndex: 1,
      }} />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 800,
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          marginBottom: 12,
        }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginBottom: prevDelta != null ? 8 : 0 }}>
          <div style={{
            fontSize: 26,
            fontWeight: 900,
            color: accent,
            letterSpacing: '-0.02em',
          }}>{value}</div>
          {daily && dataKey && <Sparkline data={daily} dataKey={dataKey} color={accent} />}
        </div>
        {prevDelta != null && Number.isFinite(prevDelta) && Math.abs(prevDelta) >= 0.05 && (
          <div style={{
            display: 'inline-flex',
            padding: '3px 9px',
            borderRadius: 6,
            background: good ? 'rgba(34,197,94,0.13)' : 'rgba(239,68,68,0.13)',
            color: good ? '#22c55e' : '#ef4444',
            fontSize: 11,
            fontWeight: 800,
          }}>
            {prevDelta > 0 ? '▲' : '▼'} {Math.abs(prevDelta).toFixed(2)}%
          </div>
        )}
      </div>
    </div>
  )
}

function FxCard({ title, glow = ACCENT_GLOW, subtitle, children, padding = 24, delay = 0 }) {
  return (
    <div
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)',
        backdropFilter: 'blur(40px) saturate(2.2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
        borderRadius: 22,
        overflow: 'hidden',
        border: '1.5px solid rgba(255,255,255,0.06)',
        borderTopColor: 'rgba(255,255,255,0.12)',
        borderBottomColor: 'rgba(0,0,0,0.65)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.85), 0 12px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.3)',
        animation: 'sim-pulse 6s ease-in-out infinite',
        animationDelay: `${delay}s`,
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.animationPlayState = 'paused'
        e.currentTarget.style.transform = 'translateY(-6px) scale(1.008)'
        e.currentTarget.style.boxShadow = `0 50px 100px rgba(0,0,0,0.85), 0 20px 40px rgba(0,0,0,0.6), 0 0 80px ${glow}22, inset 0 1.5px 0 rgba(255,255,255,0.08), inset 0 -1.5px 0 rgba(0,0,0,0.3)`
        e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.animationPlayState = 'running'
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = '0 30px 80px rgba(0,0,0,0.85), 0 12px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.3)'
        e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
        background: `linear-gradient(90deg, transparent, ${glow}aa, transparent)`,
        filter: 'blur(0.3px)',
        opacity: 0.85,
        animation: 'cr-shine 4s ease-in-out infinite',
        zIndex: 3,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '-50%',
        width: '40%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)',
        animation: 'sim-scan 9s ease-in-out infinite',
        animationDelay: `${delay + 1}s`,
        pointerEvents: 'none',
        zIndex: 1,
      }} />
      <div style={{ padding, position: 'relative', zIndex: 2 }}>
        {title && (
          <div style={{ marginBottom: subtitle ? 4 : 18 }}>
            <h2 style={{
              margin: 0,
              color: '#fff',
              fontSize: 17,
              fontWeight: 900,
              letterSpacing: '-0.01em',
            }}>{title}</h2>
            {subtitle && (
              <p style={{
                margin: '4px 0 18px',
                color: 'var(--text3)',
                fontSize: 12.5,
              }}>{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

function Thumb({ url, products, isDpa }) {
  const items = Array.isArray(products) ? products.filter(p => p?.image_url) : []

  // Catalog ad con prodotti reali → stack di 3 thumb sovrapposti
  if (items.length > 0) {
    const visible = items.slice(0, 3)
    return (
      <div title={`Catalogo · ${items.length} prodotti`} style={{
        display: 'flex', alignItems: 'center',
        position: 'relative', height: 50, minWidth: 78,
      }}>
        {visible.map((p, i) => (
          <img
            key={p.id || i}
            src={p.image_url}
            alt={p.name || ''}
            style={{
              width: 50, height: 50,
              objectFit: 'cover', borderRadius: 10,
              border: '1.5px solid rgba(8,8,18,0.95)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.45)',
              position: 'absolute',
              left: i * 16,
              zIndex: visible.length - i,
              background: '#0a0a14',
            }}
          />
        ))}
        {items.length > 3 && (
          <div style={{
            position: 'absolute',
            left: 3 * 16 + 6,
            top: 28,
            fontSize: 9.5, fontWeight: 800,
            color: '#c4b5fd',
            background: 'rgba(91,44,255,0.22)',
            border: '1px solid rgba(91,44,255,0.45)',
            borderRadius: 999,
            padding: '2px 7px',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}>+{items.length - 3}</div>
        )}
      </div>
    )
  }

  // DPA senza prodotti accessibili → badge "Catalog"
  if (isDpa) {
    return (
      <div title="Advantage+ Catalog · prodotti dinamici Meta" style={{
        width: 50, height: 50,
        borderRadius: 10,
        border: '1px solid rgba(91,44,255,0.4)',
        background: 'linear-gradient(135deg, rgba(91,44,255,0.22), rgba(0,0,0,0.4))',
        display: 'grid', placeItems: 'center',
        fontSize: 18,
      }}>📦</div>
    )
  }

  if (!url) {
    return (
      <div style={{
        width: 50, height: 50,
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
        display: 'grid', placeItems: 'center',
        color: 'var(--text3)', fontSize: 13,
      }}>—</div>
    )
  }
  return (
    <img src={url} alt="" style={{
      width: 50, height: 50,
      objectFit: 'cover', borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'block',
    }} />
  )
}

function HierarchyRow({ row, isOpen, isLoading, onToggle }) {
  const canOpen = row.level !== 'ad'
  const badge = levelBadge(row.level)

  return (
    <tr style={{
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      background: row.level === 'campaign' ? 'rgba(34,197,94,0.04)' : 'transparent',
    }}>
      <td style={{ padding: '14px 16px', minWidth: 360 }}>
        <div
          onClick={canOpen ? onToggle : undefined}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            paddingLeft: indent(row.level),
            cursor: canOpen ? 'pointer' : 'default',
          }}
        >
          {canOpen ? (
            <span style={{
              color: 'var(--accent)',
              fontSize: 10,
              marginTop: 6,
              width: 14, flexShrink: 0,
              transition: 'transform 0.18s',
              transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}>{isLoading ? '…' : '▼'}</span>
          ) : <span style={{ width: 14, flexShrink: 0 }} />}

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                padding: '2px 8px', borderRadius: 6,
                background: badge.bg, color: badge.color,
                fontSize: 9, fontWeight: 900, letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>{badge.label}</span>
              <PerfDot roas={row.roas} />
            </div>
            <div style={{
              color: '#fff', fontWeight: 800, fontSize: 13.5,
              lineHeight: 1.35, marginBottom: 3,
            }}>{row.name || 'Senza nome'}</div>
            <div style={{ color: 'var(--text3)', fontSize: 10.5, fontWeight: 500 }}>
              {row.status ? `${row.status} · ` : ''}{row.id}
            </div>
          </div>
        </div>
      </td>

      <td style={{ padding: '14px 16px' }}>
        {row.level === 'ad'
          ? <Thumb url={row.thumbnail_url} products={row.products} isDpa={!!row.product_set_id} />
          : <span style={cellMuted}>—</span>}
      </td>

      <td style={cell}>{fmtInt(row.impressions)}</td>
      <td style={cell}>{fmtInt(row.reach)}</td>
      <td style={cell}>{n(row.frequency).toFixed(2)}</td>
      <td style={cell}>{fmtMoney(row.cpm, 2)}</td>
      <td style={cell}>{fmtPct(row.ctr_link, 2)}</td>
      <td style={cell}>{fmtMoney(row.cpc_link, 2)}</td>
      <td style={cell}>{fmtInt(row.link_clicks)}</td>
      <td style={{ ...cell, color: '#fff', fontWeight: 900 }}>{fmtMoney(row.spend, 0)}</td>
      <td style={cell}>{fmtMoney(row.cost_per_result, 2)}</td>
      <td style={{ ...cell, color: row.roas >= 2.5 ? '#22c55e' : row.roas >= 1.5 ? '#f59e0b' : '#ef4444', fontWeight: 900 }}>
        {fmtRatio(row.roas)}
      </td>
      <td style={cell}>{row.purchases ? fmtInt(row.purchases) : '—'}</td>
      <td style={cell}>{fmtPct(row.conversione_acquisti, 2)}</td>
      <td style={cell}>{fmtPct(row.cro_campagna, 2)}</td>
      <td style={cell}>{fmtMoney(row.aov_campagna, 2)}</td>
    </tr>
  )
}

const cell = {
  padding: '14px 16px',
  color: 'var(--text)',
  fontSize: 13.5,
  fontWeight: 600,
  whiteSpace: 'nowrap',
}
const cellMuted = { color: 'var(--text3)' }

export default function MetaDetailTab() {
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

  // Filtri client-side
  const [accountFilter, setAccountFilter] = useState('')
  const [search, setSearch] = useState('')

  const qs = useCallback(
    extra => {
      const params = new URLSearchParams()
      params.set('preset', preset)
      if (preset === 'custom') {
        if (customSince) params.set('since', customSince)
        if (customUntil) params.set('until', customUntil)
      }
      if (accountFilter) params.set('account_id', accountFilter)
      Object.entries(extra || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.set(key, value)
      })
      return params.toString()
    },
    [preset, customSince, customUntil, accountFilter]
  )

  const fetchMain = useCallback(async () => {
    setLoading(true)
    setError('')
    setOpenCampaigns({})
    setOpenAdsets({})
    setChildren({})
    try {
      const res = await fetch(`/api/meta-detail?${qs({ level: 'campaigns' })}`, { cache: 'no-store' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Errore caricamento Meta')
      setData(json)
    } catch (e) {
      setError(e.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [qs])

  useEffect(() => { fetchMain() }, [fetchMain])

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
      const res = await fetch(`/api/meta-detail?${qs({ level: 'adsets', campaign_id: campaign.id })}`, { cache: 'no-store' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Errore caricamento ad set')
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
      const res = await fetch(`/api/meta-detail?${qs({ level: 'ads', adset_id: adset.id })}`, { cache: 'no-store' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Errore caricamento ads')
      setChildren(prev => ({ ...prev, [key]: json.rows || [] }))
      setOpenAdsets(prev => ({ ...prev, [adset.id]: true }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingNode(prev => ({ ...prev, [key]: false }))
    }
  }

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = []
    for (const campaign of data?.rows || []) {
      // Match: nome campagna o ID
      const campaignMatch = !q ||
        (campaign.name || '').toLowerCase().includes(q) ||
        (campaign.id || '').toLowerCase().includes(q)
      if (!campaignMatch) continue
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
  }, [data, children, openCampaigns, openAdsets, search])

  const summary = data?.summary || {}
  const cmp = data?.comparison || {}
  const daily = Array.isArray(data?.dailySeries) ? data.dailySeries : []

  return (
    <div>
      {/* Status pill (titolo gestito dalla shell) */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 16,
        marginBottom: 18,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          borderRadius: 999,
          background: 'rgba(48,209,88,0.12)',
          border: '1px solid rgba(48,209,88,0.3)',
          color: '#86efac',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: 999,
            background: '#30d158',
            boxShadow: '0 0 10px #30d158',
            animation: 'card-pulse 2s ease-in-out infinite',
          }} />
          {loading ? 'Sync…' : data?.sources?.meta ? 'Live · Meta' : 'Offline'}
        </div>
      </div>

      {/* Preset bar */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)',
        backdropFilter: 'blur(40px) saturate(2.2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
        border: '1.5px solid rgba(255,255,255,0.06)',
        borderTopColor: 'rgba(255,255,255,0.12)',
        borderBottomColor: 'rgba(0,0,0,0.65)',
        borderRadius: 22,
        padding: 16,
        marginBottom: 18,
        boxShadow: '0 30px 80px rgba(0,0,0,0.80), 0 12px 24px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {PRESETS.map(p => {
            const active = preset === p.id
            return (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                disabled={loading}
                style={{
                  background: active ? 'linear-gradient(135deg, rgba(91,44,255,0.25), rgba(41,151,255,0.18))' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(91,44,255,0.55)' : '1px solid rgba(255,255,255,0.07)',
                  color: active ? '#fff' : 'var(--text2)',
                  borderRadius: 11,
                  padding: '9px 14px',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: loading ? 'wait' : 'pointer',
                  transition: 'all .15s',
                  boxShadow: active ? '0 0 14px rgba(91,44,255,0.25)' : 'none',
                }}
              >{p.label}</button>
            )
          })}

          <button
            onClick={fetchMain}
            disabled={loading}
            className="btn-glass"
            style={{
              marginLeft: 'auto',
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            <span style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {loading ? 'Aggiorno…' : 'Aggiorna'}
          </button>
        </div>

        {preset === 'custom' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <input
              type="date"
              value={customSince}
              onChange={e => setCustomSince(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <input
              type="date"
              value={customUntil}
              onChange={e => setCustomUntil(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: 16,
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 14,
          color: '#fca5a5',
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 18,
        }}>
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="stagger-zoom" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 14,
        marginBottom: 18,
      }}>
        <KpiCard label="Importo speso" value={fmtMoney(summary.spend, 0)} prevDelta={cmp.spend} accent="#3b82f6" daily={daily} dataKey="spend" delay={0} />
        <KpiCard label="ROAS" value={fmtRatio(summary.roas)} prevDelta={cmp.roas} accent="#22c55e" daily={daily} dataKey="roas" delay={0.3} />
        <KpiCard label="Costo risultato" value={fmtMoney(summary.cost_per_result, 2)} prevDelta={cmp.cpa} inverse accent="#fff" daily={daily} dataKey="cost_per_result" delay={0.6} />
        <KpiCard label="Acquisti" value={summary.purchases ? fmtInt(summary.purchases) : '—'} accent="#f97316" daily={daily} dataKey="orders" delay={0.9} />
        <KpiCard label="CTR link" value={fmtPct(summary.ctr_link, 2)} prevDelta={cmp.ctr} accent="#a78bfa" daily={daily} dataKey="ctr_link" delay={1.2} />
        <KpiCard label="Frequenza" value={n(summary.frequency).toFixed(2)} accent="#fff" daily={daily} dataKey="frequency" delay={1.5} />
      </div>

      {/* Comparazione + Insight */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginBottom: 18,
      }}>
        <FxCard
          title="Confronto vs periodo precedente"
          subtitle={`${data?.previousRange?.since || '—'} → ${data?.previousRange?.until || '—'}`}
          glow={ACCENT_GLOW}
          delay={0}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 10,
          }}>
            {[
              { label: 'Spesa', value: cmp.spend, inverse: false },
              { label: 'ROAS', value: cmp.roas, inverse: false },
              { label: 'CPA', value: cmp.cpa, inverse: true },
              { label: 'CTR', value: cmp.ctr, inverse: false },
            ].map(it => {
              const good = deltaGood(it.value, it.inverse)
              return (
                <div key={it.label} style={{
                  padding: '12px 14px',
                  background: 'rgba(0,0,0,0.45)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderTopColor: 'rgba(255,255,255,0.10)',
                  borderBottomColor: 'rgba(0,0,0,0.55)',
                  borderRadius: 12,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.2)',
                }}>
                  <div style={{
                    fontSize: 9, color: 'var(--text3)',
                    textTransform: 'uppercase', letterSpacing: '0.12em',
                    fontWeight: 800, marginBottom: 8,
                  }}>{it.label}</div>
                  <div style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: good == null ? 'var(--text3)' : good ? '#22c55e' : '#ef4444',
                  }}>{delta(it.value)}</div>
                </div>
              )
            })}
          </div>
        </FxCard>

        <FxCard title="Insight automatico" glow={ACCENT_GLOW} delay={0.4}>
          <p style={{
            color: 'var(--text)',
            fontSize: 14,
            lineHeight: 1.6,
            margin: 0,
            whiteSpace: 'pre-wrap',
          }}>{data?.insight || '—'}</p>
        </FxCard>
      </div>

      {/* To-do */}
      <div style={{ marginBottom: 18 }}>
        <FxCard delay={0.8} title="To-do consigliate" subtitle="Azioni prioritarie suggerite dall'analisi" glow={ACCENT_GLOW}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data?.todos || []).map((todo, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '14px 18px',
                background: 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderTopColor: 'rgba(255,255,255,0.10)',
                borderBottomColor: 'rgba(0,0,0,0.55)',
                borderRadius: 12,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.2)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                  color: '#fff',
                  display: 'grid', placeItems: 'center',
                  fontSize: 12, fontWeight: 900,
                  flexShrink: 0,
                  boxShadow: '0 0 14px rgba(245,158,11,0.35)',
                }}>{i + 1}</div>
                <div style={{ color: 'var(--text)', fontSize: 13.5, lineHeight: 1.55 }}>{todo}</div>
              </div>
            ))}
            {(!data?.todos || data.todos.length === 0) && (
              <div style={{ color: 'var(--text3)', fontSize: 13, padding: 14 }}>Nessuna to-do per ora.</div>
            )}
          </div>
        </FxCard>
      </div>

      {/* Filtri + ricerca tabella */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)',
        backdropFilter: 'blur(40px) saturate(2.2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
        border: '1.5px solid rgba(255,255,255,0.06)',
        borderTopColor: 'rgba(255,255,255,0.12)',
        borderBottomColor: 'rgba(0,0,0,0.65)',
        borderRadius: 22,
        padding: 16,
        marginBottom: 14,
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        alignItems: 'center',
        boxShadow: '0 30px 80px rgba(0,0,0,0.80), 0 12px 24px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)',
      }}>
        <input
          type="text"
          placeholder="Cerca campagna per nome o ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 280px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            borderRadius: 11,
            padding: '11px 14px',
            fontSize: 13.5,
            outline: 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase',
            letterSpacing: '0.12em', fontWeight: 800,
          }}>Account</span>
          {[{ id: '', label: 'Tutti' }, ...(data?.allAccounts || data?.accounts || []).map(a => ({ id: a, label: a }))].map(opt => {
            const active = accountFilter === opt.id
            return (
              <button
                key={opt.id || 'all'}
                type="button"
                onClick={() => setAccountFilter(opt.id)}
                disabled={loading}
                style={{
                  background: active ? 'linear-gradient(135deg, rgba(8,102,255,0.28), rgba(66,103,178,0.22))' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(8,102,255,0.55)' : '1px solid rgba(255,255,255,0.07)',
                  color: active ? '#fff' : 'var(--text2)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: loading ? 'wait' : 'pointer',
                  boxShadow: active ? '0 0 14px rgba(8,102,255,0.25)' : 'none',
                  fontFamily: opt.id ? 'monospace' : 'inherit',
                }}
              >{opt.label}</button>
            )
          })}
        </div>

        {(search || accountFilter) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setAccountFilter('') }}
            style={{
              marginLeft: 'auto',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.35)',
              color: '#fca5a5',
              borderRadius: 10,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >Reset filtri</button>
        )}
      </div>

      {/* Tabella gerarchica */}
      <FxCard
        title="Gerarchia Meta"
        subtitle={`${visibleRows.filter(r => r.level === 'campaign').length} campagne · Click campagna → ad set · Click ad set → ads`}
        glow={ACCENT_GLOW}
        padding={0}
        delay={1.6}
      >
        <div style={{ overflowX: 'auto', maxHeight: '72vh', padding: '0 24px 24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1700 }}>
            <thead>
              <tr>
                {['Livello', 'Anteprima', 'Impression', 'Copertura', 'Freq.', 'CPM', 'CTR link', 'CPC link', 'Click link', 'Speso', 'Costo risultato', 'ROAS', 'Acquisti', 'Conv. acq.', 'CRO', 'AOV'].map(h => (
                  <th key={h} style={{
                    position: 'sticky', top: 0, zIndex: 20,
                    padding: '14px 16px',
                    fontSize: 10.5, fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.12em',
                    textAlign: 'left', whiteSpace: 'nowrap',
                    color: 'var(--text2)',
                    background: 'rgba(8,8,18,0.92)',
                    backdropFilter: 'blur(20px)',
                    borderBottom: '1.5px solid rgba(255,255,255,0.08)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.length > 0 ? (
                visibleRows.map(row => {
                  const key = row.level === 'campaign' ? `campaign:${row.id}`
                    : row.level === 'adset' ? `adset:${row.id}`
                    : `ad:${row.id}`
                  return (
                    <HierarchyRow
                      key={key}
                      row={row}
                      isOpen={row.level === 'campaign' ? !!openCampaigns[row.id]
                        : row.level === 'adset' ? !!openAdsets[row.id]
                        : false}
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
                  <td colSpan="16" style={{
                    padding: 40,
                    color: 'var(--text3)',
                    fontSize: 14,
                    textAlign: 'center',
                  }}>
                    {loading ? 'Sto caricando le campagne…' : 'Nessuna campagna attiva nel periodo selezionato.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </FxCard>

      <CreativeFatiguePanel />

      <MetaAdsAgent data={data} preset={preset} />
    </div>
  )
}
