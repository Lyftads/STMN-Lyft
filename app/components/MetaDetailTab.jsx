'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { swrFetch, getCached } from '../../lib/clientCache'
import MetaAdsAgent from './MetaAdsAgent'
import DownloadReportButton from './DownloadReportButton'
import { PlatformBadges } from './PlatformIcon'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'

const PRESETS = [
  { id: 'today', label: 'Oggi', labelKey: 'meta.today' },
  { id: 'yesterday', label: 'Ieri', labelKey: 'meta.yesterday' },
  { id: 'last_7d', label: 'Ultimi 7g', labelKey: 'meta.last7' },
  { id: 'last_14d', label: 'Ultimi 14g', labelKey: 'meta.last14' },
  { id: 'last_28d', label: 'Ultimi 28g', labelKey: 'meta.last28' },
  { id: 'this_month', label: 'Mese corrente', labelKey: 'meta.thisMonth' },
  { id: 'last_month', label: 'Mese scorso', labelKey: 'meta.lastMonth' },
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
  if (level === 'campaign') return { label: 'Campagna', labelKey: 'meta.levelCampaign', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' }
  if (level === 'adset') return { label: 'Ad set', labelKey: 'meta.levelAdset', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' }
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 800,
            color: 'var(--text3)',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
          }}>{label}</div>
          <PlatformBadges sources={['meta']} size={14} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginBottom: prevDelta != null ? 8 : 0 }}>
          <div style={{
            fontSize: 26,
            fontWeight: 900,
            color: '#fff',
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
        color: '#a78bfa',
      }}><Icon name="image" size={20} /></div>
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
  const { t } = useI18n()
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
              }}>{t(badge.labelKey, null, badge.label)}</span>
              <PerfDot roas={row.roas} />
            </div>
            <div style={{
              color: '#fff', fontWeight: 800, fontSize: 13.5,
              lineHeight: 1.35, marginBottom: 3,
            }}>{row.name || t('meta.noName', null, 'Senza nome')}</div>
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

// Riga "flat" in stile Business Manager: toggle esplicito per il drill-down
// (campagna → gruppi → inserzioni), click inserzione = anteprima creatività.
function BMRow({ row, level, onOpen, checked, onCheck }) {
  const { t } = useI18n()
  const drillable = level !== 'ad'
  const go = (e) => { e.stopPropagation(); onOpen(row) }
  return (
    <tr
      onClick={() => onOpen(row)}
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.12s', background: checked ? 'rgba(123,91,255,0.08)' : 'transparent' }}
      onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { e.currentTarget.style.background = checked ? 'rgba(123,91,255,0.08)' : 'transparent' }}
    >
      <td style={{ padding: '14px 16px', minWidth: 340 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Checkbox multi-selezione (solo campagne/gruppi) */}
          {drillable && (
            <input
              type="checkbox"
              checked={!!checked}
              onClick={e => e.stopPropagation()}
              onChange={() => onCheck && onCheck(row.id)}
              style={{ width: 16, height: 16, accentColor: '#7b5bff', cursor: 'pointer', flexShrink: 0 }}
            />
          )}
          {/* Toggle: drill (›) per campagne/gruppi, anteprima (occhio) per inserzioni */}
          <button
            onClick={go}
            title={drillable ? t('meta.bmDrill', null, 'Apri il livello sotto') : t('meta.bmPreview', null, 'Anteprima creatività')}
            style={{
              flexShrink: 0, width: 30, height: 30, borderRadius: 9,
              border: '1px solid var(--accent)', background: 'rgba(123,91,255,0.12)',
              color: 'var(--accent)', cursor: 'pointer', display: 'grid', placeItems: 'center',
              fontSize: drillable ? 16 : 13, fontWeight: 900, lineHeight: 1,
            }}
          >{drillable ? '›' : <Icon name="eye" size={14} />}</button>
          <PerfDot roas={row.roas} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 13.5, lineHeight: 1.35, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name || t('meta.noName', null, 'Senza nome')}</div>
            <div style={{ color: 'var(--text3)', fontSize: 10.5, fontWeight: 500 }}>{row.status ? `${row.status} · ` : ''}{row.id}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: '14px 16px' }}>
        {level === 'ad'
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
      <td style={{ ...cell, color: row.roas >= 2.5 ? '#22c55e' : row.roas >= 1.5 ? '#f59e0b' : '#ef4444', fontWeight: 900 }}>{fmtRatio(row.roas)}</td>
      <td style={cell}>{row.purchases ? fmtInt(row.purchases) : '—'}</td>
      <td style={cell}>{fmtPct(row.conversione_acquisti, 2)}</td>
      <td style={cell}>{fmtPct(row.cro_campagna, 2)}</td>
      <td style={cell}>{fmtMoney(row.aov_campagna, 2)}</td>
    </tr>
  )
}

const lab = { fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: 5 }

// Anteprima inserzione: creatività (immagine/prodotti) + copy, descrizione, CTA.
function AdPreviewModal({ ad, onClose }) {
  const { t } = useI18n()
  if (typeof document === 'undefined') return null
  const media = ad.image_url || (ad.products && ad.products[0] && ad.products[0].image_url) || ad.thumbnail_url || null
  const stat = (label, value) => (
    <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 11px' }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  )
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.74)', zIndex: 4000, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, width: 820, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', gap: 0 }}>
        <div style={{ background: '#000', display: 'grid', placeItems: 'center', minHeight: 340, padding: 8 }}>
          {media
            ? <img src={media} alt="" style={{ width: '100%', maxHeight: '88vh', objectFit: 'contain', borderRadius: 10 }} />
            : <div style={{ color: 'var(--text3)', fontSize: 13, padding: 24, textAlign: 'center' }}>{t('meta.noPreview', null, 'Anteprima non disponibile (catalogo/DPA)')}</div>}
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', fontSize: 9, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('meta.levelAd', null, 'Inserzione')}</span>
            <div style={{ flex: 1 }} />
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
          <div style={{ fontSize: 16, fontWeight: 950, color: '#fff', lineHeight: 1.3 }}>{ad.name || t('meta.noName', null, 'Senza nome')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {stat(t('meta.spent', null, 'Speso'), fmtMoney(ad.spend, 0))}
            {stat('ROAS', fmtRatio(ad.roas))}
            {stat(t('meta.ctrLink', null, 'CTR link'), fmtPct(ad.ctr_link, 2))}
            {stat(t('meta.purchases', null, 'Acquisti'), ad.purchases ? fmtInt(ad.purchases) : '—')}
          </div>
          {ad.headline && (<div><div style={lab}>{t('meta.adHeadline', null, 'Titolo')}</div><div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{ad.headline}</div></div>)}
          {ad.body && (<div><div style={lab}>{t('meta.adCopy', null, 'Copy')}</div><div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto' }}>{ad.body}</div></div>)}
          {ad.description && (<div><div style={lab}>{t('meta.adDescription', null, 'Descrizione')}</div><div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{ad.description}</div></div>)}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {ad.cta && <span style={{ display: 'inline-block', padding: '7px 16px', borderRadius: 8, background: '#0866FF', color: '#fff', fontSize: 12.5, fontWeight: 800, textTransform: 'capitalize' }}>{(ad.cta || '').toLowerCase()}</span>}
            {ad.link_url && <a href={ad.link_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'underline', wordBreak: 'break-all' }}>{ad.link_url}</a>}
          </div>
          {(!ad.body && !ad.headline && !ad.description) && (<div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t('meta.noCopy', null, 'Nessun testo disponibile (probabile catalogo dinamico).')}</div>)}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function MetaDetailTab() {
  const { t } = useI18n()
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

  const fetchMain = useCallback(async (force = false) => {
    setError('')
    setOpenCampaigns({})
    setOpenAdsets({})
    setChildren({})
    const queryString = qs({ level: 'campaigns' })
    const key = `meta-detail:campaigns:${queryString}`
    const cached = !force ? getCached(key) : null

    if (cached) {
      setData(cached.data)
    } else {
      setLoading(true)
    }

    try {
      const { data: json } = await swrFetch({
        key, forceRefresh: force,
        fetcher: async () => {
          const res = await fetch(`/api/meta-detail?${queryString}`, { cache: 'no-store' })
          const j = await res.json()
          if (!j.ok) throw new Error(j.error || t('meta.errMeta', null, 'Errore caricamento Meta'))
          return j
        },
        onUpdate: (fresh) => setData(fresh),
      })
      if (!cached || force) setData(json)
    } catch (e) {
      if (!cached) {
        setError(e.message)
        setData(null)
      }
    } finally {
      if (!cached) setLoading(false)
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
      if (!json.ok) throw new Error(json.error || t('meta.errAdset', null, 'Errore caricamento ad set'))
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
      if (!json.ok) throw new Error(json.error || t('meta.errAds', null, 'Errore caricamento ads'))
      setChildren(prev => ({ ...prev, [key]: json.rows || [] }))
      setOpenAdsets(prev => ({ ...prev, [adset.id]: true }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingNode(prev => ({ ...prev, [key]: false }))
    }
  }

  // ── Vista stile Business Manager: tab Campagne / Gruppi / Inserzioni ──
  const [bmLevel, setBmLevel] = useState('campaign')
  const [selCampaign, setSelCampaign] = useState(null)   // drill singolo (per breadcrumb)
  const [selAdset, setSelAdset] = useState(null)
  const [selAd, setSelAd] = useState(null)
  const [viewCampaignIds, setViewCampaignIds] = useState([]) // campagne le cui adset sono mostrate
  const [viewAdsetIds, setViewAdsetIds] = useState([])       // adset le cui inserzioni sono mostrate
  const [checkCampaigns, setCheckCampaigns] = useState(() => new Set()) // checkbox multi-selezione
  const [checkAdsets, setCheckAdsets] = useState(() => new Set())
  const [nodeError, setNodeError] = useState({}) // errore per nodo (es. rate limit Meta)

  const loadChildren = useCallback(async (level, parentKey, paramKey, parentId, force = false) => {
    // Salta solo se abbiamo già righe valide in cache; un risultato vuoto o fallito
    // (es. rate limit Meta) NON viene messo in cache, così un nuovo click riprova.
    if (!force && children[parentKey] && children[parentKey].length) return
    setLoadingNode(prev => ({ ...prev, [parentKey]: true }))
    setNodeError(prev => { const n = { ...prev }; delete n[parentKey]; return n })
    setError('')
    try {
      const res = await fetch(`/api/meta-detail?${qs({ level, [paramKey]: parentId })}`, { cache: 'no-store' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || t('meta.errAdset', null, 'Errore caricamento'))
      setChildren(prev => ({ ...prev, [parentKey]: json.rows || [] }))
    } catch (e) {
      setError(e.message)
      setNodeError(prev => ({ ...prev, [parentKey]: e.message }))
    } finally {
      setLoadingNode(prev => ({ ...prev, [parentKey]: false }))
    }
  }, [children, qs, t])

  // Ricarica i figli dei nodi attualmente visualizzati (pulsante "Riprova")
  const retryBm = useCallback(async () => {
    if (bmLevel === 'adset') for (const id of viewCampaignIds) await loadChildren('adsets', `campaign:${id}`, 'campaign_id', id, true)
    else if (bmLevel === 'ad') for (const id of viewAdsetIds) await loadChildren('ads', `adset:${id}`, 'adset_id', id, true)
  }, [bmLevel, viewCampaignIds, viewAdsetIds, loadChildren])

  // Drill singolo (click su riga/chevron)
  const openCampaign = useCallback((c) => {
    setSelCampaign(c); setSelAdset(null); setViewCampaignIds([c.id]); setViewAdsetIds([]); setBmLevel('adset')
    loadChildren('adsets', `campaign:${c.id}`, 'campaign_id', c.id)
  }, [loadChildren])
  const openAdset = useCallback((a) => {
    setSelAdset(a); setViewAdsetIds([a.id]); setBmLevel('ad')
    loadChildren('ads', `adset:${a.id}`, 'adset_id', a.id)
  }, [loadChildren])

  // Drill multiplo (checkbox + "Vedi …")
  const openMultiAdsets = useCallback(async () => {
    const ids = [...checkCampaigns]
    if (!ids.length) return
    setSelCampaign(null); setSelAdset(null); setViewCampaignIds(ids); setViewAdsetIds([]); setBmLevel('adset')
    // sequenziale: evita di saturare il rate limit Meta con N richieste in parallelo
    for (const id of ids) await loadChildren('adsets', `campaign:${id}`, 'campaign_id', id)
  }, [checkCampaigns, loadChildren])
  const openMultiAds = useCallback(async () => {
    const ids = [...checkAdsets]
    if (!ids.length) return
    setSelAdset(null); setViewAdsetIds(ids); setBmLevel('ad')
    for (const id of ids) await loadChildren('ads', `adset:${id}`, 'adset_id', id)
  }, [checkAdsets, loadChildren])

  const toggleCheck = (setFn) => (id) => setFn(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleCheckCampaign = toggleCheck(setCheckCampaigns)
  const toggleCheckAdset = toggleCheck(setCheckAdsets)

  const bmRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = []
    if (bmLevel === 'campaign') list = data?.rows || []
    else if (bmLevel === 'adset') list = viewCampaignIds.flatMap(id => children[`campaign:${id}`] || [])
    else list = viewAdsetIds.flatMap(id => children[`adset:${id}`] || [])
    if (q) list = list.filter(r => (r.name || '').toLowerCase().includes(q) || (r.id || '').toLowerCase().includes(q))
    return list
  }, [bmLevel, data, children, viewCampaignIds, viewAdsetIds, search])

  const bmLoading = bmLevel === 'adset' ? viewCampaignIds.some(id => loadingNode[`campaign:${id}`])
    : bmLevel === 'ad' ? viewAdsetIds.some(id => loadingNode[`adset:${id}`])
    : loading
  const bmError = bmLevel === 'adset' ? viewCampaignIds.map(id => nodeError[`campaign:${id}`]).find(Boolean)
    : bmLevel === 'ad' ? viewAdsetIds.map(id => nodeError[`adset:${id}`]).find(Boolean)
    : null

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
      {/* Status pill + Meta badge (titolo gestito dalla shell) */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 12,
        marginBottom: 18,
      }}>
        <PlatformBadges sources={['meta']} size={18} />
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
          {loading ? 'Sync…' : data?.sources?.meta ? 'Live' : 'Offline'}
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
              >{t(p.labelKey, null, p.label)}</button>
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
            {loading ? t('shell.updating', null, 'Aggiorno…') : t('shell.refresh', null, 'Aggiorna')}
          </button>

          <DownloadReportButton
            tab="Meta Detail"
            preset={preset === 'custom' ? undefined : preset}
            custom={preset === 'custom' && customSince && customUntil ? { since: customSince, until: customUntil, label: `${customSince} → ${customUntil}` } : undefined}
            campaigns={visibleRows.filter(r => r.level === 'campaign').map(r => ({ id: r.id, name: r.name }))}
          />
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
        <KpiCard label={t('meta.amountSpent', null, 'Importo speso')} value={fmtMoney(summary.spend, 0)} prevDelta={cmp.spend} accent="#3b82f6" daily={daily} dataKey="spend" delay={0} />
        <KpiCard label="ROAS" value={fmtRatio(summary.roas)} prevDelta={cmp.roas} accent="#22c55e" daily={daily} dataKey="roas" delay={0.3} />
        <KpiCard label={t('meta.costPerResult', null, 'Costo risultato')} value={fmtMoney(summary.cost_per_result, 2)} prevDelta={cmp.cpa} inverse accent="#fff" daily={daily} dataKey="cost_per_result" delay={0.6} />
        <KpiCard label={t('meta.purchases', null, 'Acquisti')} value={summary.purchases ? fmtInt(summary.purchases) : '—'} accent="#f97316" daily={daily} dataKey="orders" delay={0.9} />
        <KpiCard label={t('meta.ctrLink', null, 'CTR link')} value={fmtPct(summary.ctr_link, 2)} prevDelta={cmp.ctr} accent="#a78bfa" daily={daily} dataKey="ctr_link" delay={1.2} />
        <KpiCard label={t('meta.frequency', null, 'Frequenza')} value={n(summary.frequency).toFixed(2)} accent="#fff" daily={daily} dataKey="frequency" delay={1.5} />
      </div>

      {/* Comparazione + Insight */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginBottom: 18,
      }}>
        <FxCard
          title={t('meta.compareTitle', null, 'Confronto vs periodo precedente')}
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
              { label: t('meta.spend', null, 'Spesa'), value: cmp.spend, inverse: false },
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

        <FxCard title={t('meta.autoInsight', null, 'Insight automatico')} glow={ACCENT_GLOW} delay={0.4}>
          <p style={{
            color: 'var(--text)',
            fontSize: 14,
            lineHeight: 1.6,
            margin: 0,
            whiteSpace: 'pre-wrap',
          }}>{data?.insight || '—'}</p>
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
          placeholder={t('meta.searchPlaceholder', null, 'Cerca campagna per nome o ID…')}
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
          }}>{t('meta.account', null, 'Account')}</span>
          {[{ id: '', label: t('meta.all', null, 'Tutti') }, ...(data?.allAccounts || data?.accounts || []).map(a => ({ id: a, label: a }))].map(opt => {
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
          >{t('meta.resetFilters', null, 'Reset filtri')}</button>
        )}
      </div>

      {/* Gerarchia Meta — vista stile Business Manager (tab Campagne/Gruppi/Inserzioni) */}
      {(() => {
        const TABS = [
          { id: 'campaign', label: t('meta.tabCampaigns', null, 'Campagne'), enabled: true, count: (data?.rows || []).length },
          { id: 'adset', label: t('meta.tabAdsets', null, 'Gruppi di inserzioni'), enabled: viewCampaignIds.length > 0, count: viewCampaignIds.length ? viewCampaignIds.reduce((s, id) => s + (children[`campaign:${id}`] || []).length, 0) : null },
          { id: 'ad', label: t('meta.tabAds', null, 'Inserzioni'), enabled: viewAdsetIds.length > 0, count: viewAdsetIds.length ? viewAdsetIds.reduce((s, id) => s + (children[`adset:${id}`] || []).length, 0) : null },
        ]
        const tabBtn = (tab) => ({
          padding: '12px 18px', border: 'none', background: 'transparent', cursor: tab.enabled ? 'pointer' : 'not-allowed',
          color: bmLevel === tab.id ? '#fff' : tab.enabled ? 'var(--text2)' : 'var(--text3)',
          fontSize: 13.5, fontWeight: bmLevel === tab.id ? 900 : 700, position: 'relative',
          borderBottom: bmLevel === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
          opacity: tab.enabled ? 1 : 0.5,
        })
        const crumb = (label, onClick, active) => (
          <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: active ? '#fff' : 'var(--accent)', fontWeight: active ? 800 : 700, fontSize: 12.5, padding: 0, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</button>
        )
        return (
          <FxCard glow={ACCENT_GLOW} padding={0} delay={1.6}>
            {/* Header (con padding proprio: niente titolo tagliato dal bordo) */}
            <div style={{ padding: '22px 24px 14px' }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 900, letterSpacing: '-0.01em' }}>{t('meta.hierarchyTitle', null, 'Gerarchia Meta')}</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 12.5, fontWeight: 500 }}>{t('meta.bmHierarchySub', null, 'Naviga come nel Business Manager: campagne → gruppi di inserzioni → inserzioni')}</p>
            </div>
            {/* Tab bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => tab.enabled && setBmLevel(tab.id)} disabled={!tab.enabled} style={tabBtn(tab)}>
                  {tab.label}{tab.count != null && <span style={{ marginLeft: 7, fontSize: 11, color: 'var(--text3)', fontWeight: 700, fontFamily: 'Barlow' }}>{tab.count}</span>}
                </button>
              ))}
            </div>

            {/* Breadcrumb drill-down (gestisce singolo e multi-selezione) */}
            {(viewCampaignIds.length > 0 || viewAdsetIds.length > 0) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', fontSize: 12.5, color: 'var(--text3)', flexWrap: 'wrap' }}>
                {crumb(t('meta.tabCampaigns', null, 'Campagne'), () => setBmLevel('campaign'), bmLevel === 'campaign')}
                {viewCampaignIds.length > 0 && <><span>›</span>{crumb(selCampaign ? (selCampaign.name || selCampaign.id) : t('meta.bmNcampaigns', { n: viewCampaignIds.length }, `${viewCampaignIds.length} campagne`), () => setBmLevel('adset'), bmLevel === 'adset')}</>}
                {viewAdsetIds.length > 0 && <><span>›</span>{crumb(selAdset ? (selAdset.name || selAdset.id) : t('meta.bmNadsets', { n: viewAdsetIds.length }, `${viewAdsetIds.length} gruppi`), () => setBmLevel('ad'), bmLevel === 'ad')}</>}
              </div>
            )}

            {/* Barra azione multi-selezione */}
            {((bmLevel === 'campaign' && checkCampaigns.size > 0) || (bmLevel === 'adset' && checkAdsets.size > 0)) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', background: 'rgba(123,91,255,0.08)', borderBottom: '1px solid rgba(123,91,255,0.2)' }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#c4b5fd' }}>{t('meta.bmSelectedN', { n: bmLevel === 'campaign' ? checkCampaigns.size : checkAdsets.size }, `${bmLevel === 'campaign' ? checkCampaigns.size : checkAdsets.size} selezionate`)}</span>
                <button onClick={() => bmLevel === 'campaign' ? setCheckCampaigns(new Set()) : setCheckAdsets(new Set())} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 11px', color: 'var(--text2)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{t('meta.bmClear', null, 'Deseleziona')}</button>
                <div style={{ flex: 1 }} />
                <button onClick={bmLevel === 'campaign' ? openMultiAdsets : openMultiAds} style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', border: 'none', borderRadius: 9, padding: '8px 16px', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
                  {bmLevel === 'campaign' ? t('meta.bmViewAdsets', null, 'Vedi gruppi di inserzioni') : t('meta.bmViewAds', null, 'Vedi inserzioni')} →
                </button>
              </div>
            )}

            <div style={{ overflowX: 'auto', maxHeight: '72vh', padding: '0 24px 24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1700 }}>
                <thead>
                  <tr>
                    {[bmLevel === 'campaign' ? t('meta.tabCampaigns', null, 'Campagna') : bmLevel === 'adset' ? t('meta.levelAdset', null, 'Ad set') : t('meta.levelAd', null, 'Inserzione'), t('meta.preview', null, 'Anteprima'), t('meta.impressions', null, 'Impression'), t('meta.reach', null, 'Copertura'), t('meta.freqShort', null, 'Freq.'), 'CPM', t('meta.ctrLink', null, 'CTR link'), t('meta.cpcLink', null, 'CPC link'), t('meta.clickLink', null, 'Click link'), t('meta.spent', null, 'Speso'), t('meta.costPerResult', null, 'Costo risultato'), 'ROAS', t('meta.purchases', null, 'Acquisti'), t('meta.convPurch', null, 'Conv. acq.'), 'CRO', 'AOV'].map(h => (
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
                  {bmRows.length > 0 ? (
                    bmRows.map(row => (
                      <BMRow
                        key={`${bmLevel}:${row.id}`}
                        row={row}
                        level={bmLevel}
                        onOpen={bmLevel === 'campaign' ? openCampaign : bmLevel === 'adset' ? openAdset : setSelAd}
                        checked={bmLevel === 'campaign' ? checkCampaigns.has(row.id) : bmLevel === 'adset' ? checkAdsets.has(row.id) : false}
                        onCheck={bmLevel === 'campaign' ? toggleCheckCampaign : bmLevel === 'adset' ? toggleCheckAdset : undefined}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan="16" style={{ padding: 40, color: 'var(--text3)', fontSize: 14, textAlign: 'center' }}>
                        {bmLoading ? t('meta.loadingCampaigns', null, 'Sto caricando…')
                          : bmError ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                              <div style={{ color: '#fca5a5', fontWeight: 700, maxWidth: 560 }}>{t('meta.bmLoadError', null, 'Meta non ha risposto (probabile limite di richieste). Riprova tra qualche secondo.')}</div>
                              <div style={{ color: 'var(--text3)', fontSize: 12 }}>{bmError}</div>
                              <button onClick={retryBm} style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', border: 'none', borderRadius: 9, padding: '8px 18px', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>{t('meta.bmRetry', null, 'Riprova')}</button>
                            </div>
                          )
                          : bmLevel === 'adset' && !viewCampaignIds.length ? t('meta.bmPickCampaign', null, 'Seleziona una o più campagne (checkbox) e premi “Vedi gruppi di inserzioni”.')
                          : bmLevel === 'ad' && !viewAdsetIds.length ? t('meta.bmPickAdset', null, 'Seleziona uno o più gruppi di inserzioni.')
                          : t('meta.noActiveCampaigns', null, 'Nessun elemento nel periodo selezionato.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </FxCard>
        )
      })()}

      {/* To-do (spostato sotto la Gerarchia) */}
      <div style={{ marginTop: 18 }}>
        <FxCard delay={0.8} title={t('meta.todosTitle', null, 'To-do consigliate')} subtitle={t('meta.todosSub', null, "Azioni prioritarie suggerite dall'analisi")} glow={ACCENT_GLOW}>
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
              <div style={{ color: 'var(--text3)', fontSize: 13, padding: 14 }}>{t('meta.noTodos', null, 'Nessuna to-do per ora.')}</div>
            )}
          </div>
        </FxCard>
      </div>

      {selAd && <AdPreviewModal ad={selAd} onClose={() => setSelAd(null)} />}

      <MetaAdsAgent data={data} preset={preset} />
    </div>
  )
}
