'use client'

import { useEffect, useState } from 'react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import MetaBadge from './MetaBadge'

// ─────────────────────────────────────────────────────────────
//  Meta Audit 360° Tab (stile Madgicx)
//  Tabella compatta: 3 segmenti (Nuovo pubblico, Pubblico che ha
//  interagito, Clienti esistenti) + riga Totale in alto.
//  Colonne: Spesa, ROAS, CPO, Acquisti, Revenue, CPM, CTR, CPC.
//  Sotto: 3 area chart "Strategy Status Overview".
//
//  Endpoint: /api/meta-audit/strategy?preset=X
// ─────────────────────────────────────────────────────────────

const PRESET_OPTIONS = [
  { value: 'last_7d',  label: '7gg' },
  { value: 'last_14d', label: '14gg' },
  { value: 'last_28d', label: '28gg' },
  { value: 'last_30d', label: '30gg' },
  { value: 'last_90d', label: '90gg' },
]

const COLUMNS = [
  { key: 'spend',     label: 'Spesa',    fmt: v => `€${Math.round(v).toLocaleString('it-IT')}` },
  { key: 'roas',      label: 'ROAS',     fmt: v => v > 0 ? `${(+v).toFixed(2)}x` : '—' },
  { key: 'cpo',       label: 'CPO',      fmt: v => v != null && v > 0 ? `€${(+v).toFixed(2)}` : '—' },
  { key: 'purchases', label: 'Acquisti', fmt: v => Math.round(v).toLocaleString('it-IT') },
  { key: 'revenue',   label: 'Revenue',  fmt: v => `€${Math.round(v).toLocaleString('it-IT')}` },
  { key: 'cpm',       label: 'CPM',      fmt: v => v > 0 ? `€${(+v).toFixed(2)}` : '—' },
  { key: 'ctr_link',  label: 'CTR link', fmt: v => v > 0 ? `${(+v).toFixed(2)}%` : '—' },
  { key: 'cpc_link',  label: 'CPC link', fmt: v => v != null && v > 0 ? `€${(+v).toFixed(2)}` : '—' },
]

function cellValue(metricKey, m) {
  if (!m) return 0
  const linkClicks = m.link_clicks || m.linkClicks || 0
  switch (metricKey) {
    case 'spend':     return m.spend || 0
    case 'revenue':   return m.revenue || 0
    case 'purchases': return m.purchases || 0
    case 'roas':      return m.spend > 0 ? m.revenue / m.spend : 0
    case 'cpo':       return m.purchases > 0 ? m.spend / m.purchases : null
    case 'cpm':       return m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0
    case 'ctr_link':  return m.impressions > 0 ? (linkClicks / m.impressions) * 100 : 0
    case 'cpc_link':  return linkClicks > 0 ? m.spend / linkClicks : null
    default:          return 0
  }
}

export default function MetaAuditTab() {
  const [preset, setPreset] = useState('last_28d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = (force = false) => {
    let cancelled = false
    const key = `meta-audit:${preset}`
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
      fetcher: () => fetch(`/api/meta-audit/strategy?preset=${encodeURIComponent(preset)}`).then(r => r.json()),
      onUpdate: fresh => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => {
        if (cancelled) return
        if (j?.error && !j?.categories) setError(j.error)
        if (!cached || force) setData(j)
      })
      .catch(e => { if (!cancelled && !cached) setError(e?.message) })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [preset]) // eslint-disable-line react-hooks/exhaustive-deps

  const cats = data?.categories || {}
  const total = data?.total
  const cols = Object.values(cats)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header + preset selector + Aggiorna */}
      <div className="glass-card-static" style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{
          width: 42, height: 42, borderRadius: 11,
          background: 'rgba(8,102,255,0.14)', color: '#2997ff',
          display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 800,
        }}>◎</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 9.5, color: '#2997ff', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Meta Audit 360°
            </div>
            <MetaBadge size="sm" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 4, letterSpacing: '-0.02em' }}>
            Performance per segmento di pubblico · {data?.adsetsAnalyzed || 0} adset attivi
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
            Aggregazione per Nuovo pubblico · Pubblico che ha interagito · Clienti esistenti.
            {data?.debug?.adsets_fetched_total != null && ` (${data.debug.adsets_fetched_total} adset totali in account)`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PRESET_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => setPreset(o.value)}
              className="btn-glass"
              style={{
                border: preset === o.value ? '1px solid #2997ff' : '1px solid var(--border)',
                background: preset === o.value ? 'rgba(41,151,255,0.13)' : 'var(--glass)',
                color: preset === o.value ? '#7dd3fc' : 'var(--text3)',
                borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {o.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="btn-glass"
            style={{
              border: '1px solid var(--border)', background: 'var(--glass)',
              color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800,
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {loading ? 'Aggiorno…' : 'Aggiorna'}
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-card-static" style={{ padding: 18, color: '#fca5a5', fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ color: '#9b90aa', padding: 40, fontSize: 15, fontWeight: 700, textAlign: 'center' }}>
          Un attimo, sto leggendo audiences e adset di Meta…
        </div>
      )}

      {data && (
        <>
          <MadgicxTable cats={cats} total={total} cols={cols} />
          <StrategyStatusOverview cats={cats} />
        </>
      )}
    </div>
  )
}

// ── Tabella stile Madgicx ──────────────────────────────────────
//  Riga Totale in alto evidenziata.
//  Una riga per categoria con stripe colorata 4px a sinistra.
//  Colonne: Spesa, ROAS, CPO, Acquisti, Revenue, CPM, CTR, CPC.
function MadgicxTable({ cats, total, cols }) {
  return (
    <div className="glass-card-static" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              <th style={{ ...th, width: 220 }}>Segmento di pubblico</th>
              {COLUMNS.map(c => (
                <th key={c.key} style={{ ...th, textAlign: 'right' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Riga Total in alto (evidenziata) */}
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
              <td style={{ ...tdLabel, fontWeight: 800, color: '#fff', borderLeft: '4px solid rgba(255,255,255,0.20)' }}>
                Totale
                <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginLeft: 8 }}>
                  ({cols.reduce((s, c) => s + (c.adsetCount || 0), 0)} adset)
                </span>
              </td>
              {COLUMNS.map(col => (
                <td key={col.key} style={{ ...tdNum, color: '#fff', fontWeight: 800 }}>
                  {col.fmt(cellValue(col.key, total))}
                </td>
              ))}
            </tr>

            {/* Riga per ogni categoria */}
            {cols.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ ...tdLabel, borderLeft: `4px solid ${c.color}` }}>
                  <div style={{ color: c.color, fontWeight: 700, fontSize: 13 }}>{c.label}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>
                    {c.adsetCount} adset
                  </div>
                </td>
                {COLUMNS.map(col => (
                  <td key={col.key} style={tdNum}>
                    {col.fmt(cellValue(col.key, c.metrics))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th = {
  textAlign: 'left', padding: '14px 16px', fontSize: 10, fontWeight: 800,
  letterSpacing: '0.10em', textTransform: 'uppercase',
  color: 'var(--text3)', borderBottom: '1px solid rgba(255,255,255,0.06)',
  whiteSpace: 'nowrap',
}
const tdLabel = {
  padding: '14px 16px', whiteSpace: 'nowrap',
}
const tdNum = {
  padding: '14px 16px', textAlign: 'right',
  fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.88)', fontWeight: 600,
}

// ── Strategy Status Overview: 3 area chart in row ──────────────
function StrategyStatusOverview({ cats }) {
  const cols = Object.values(cats)
  return (
    <div className="glass-card-static" style={{ padding: 22 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
        Strategy Status Overview
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 16 }}>
        Trend Spesa & ROAS per segmento
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14,
      }}>
        {cols.map(c => (
          <SegmentChart key={c.id} cat={c} />
        ))}
      </div>
    </div>
  )
}

function SegmentChart({ cat }) {
  const data = (cat.trend || []).map(t => ({
    date: t.date.slice(5),
    spend: t.spend || 0,
    roas: t.roas || 0,
  }))
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: cat.color }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{cat.label}</span>
      </div>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`grad-spend-${cat.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cat.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={cat.color} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`grad-roas-${cat.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.20} />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text3)' }} />
            <YAxis yAxisId="L" tick={{ fontSize: 9, fill: 'var(--text3)' }} />
            <YAxis yAxisId="R" orientation="right" tick={{ fontSize: 9, fill: '#fbbf24' }} />
            <Tooltip
              contentStyle={{ background: 'rgba(10,10,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, fontSize: 11 }}
              formatter={(v, name) => {
                if (name === 'spend') return [`€${Math.round(v).toLocaleString('it-IT')}`, 'Spesa']
                if (name === 'roas')  return [`${(+v).toFixed(2)}x`, 'ROAS']
                return [v, name]
              }}
            />
            <Area yAxisId="L" type="monotone" dataKey="spend" stroke={cat.color} fill={`url(#grad-spend-${cat.id})`} strokeWidth={1.8} />
            <Area yAxisId="R" type="monotone" dataKey="roas"  stroke="#fbbf24"  fill={`url(#grad-roas-${cat.id})`}  strokeWidth={1.4} strokeDasharray="4 3" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 6, fontSize: 10, color: 'var(--text3)' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 2, background: cat.color, verticalAlign: 'middle', marginRight: 4 }} /> Spesa</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 2, background: '#fbbf24', verticalAlign: 'middle', marginRight: 4 }} /> ROAS</span>
      </div>
    </div>
  )
}
