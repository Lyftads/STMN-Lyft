'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import PlatformIcon, { PlatformBadges } from './PlatformIcon'

// ─────────────────────────────────────────────────────────────
//  Total Impact Tab (stile Triple Whale)
//  - Card headline: Total Revenue, Total Spend, MER blended
//  - Tabella per-channel: spend, attributed_revenue, gap, efficiency
//  - Grafico daily revenue (bar)
// ─────────────────────────────────────────────────────────────

const PRESETS = [
  { value: 'today',         label: 'Oggi' },
  { value: 'yesterday',     label: 'Ieri' },
  { value: 'last_7d',       label: '7 giorni' },
  { value: 'last_14d',      label: '14 giorni' },
  { value: 'last_28d',      label: '28 giorni' },
  { value: 'last_30d',      label: '30 giorni' },
  { value: 'last_90d',      label: '90 giorni' },
  { value: 'current_month', label: 'Mese corrente' },
  { value: 'ytd',           label: 'YTD' },
]

const eur  = v => v != null ? `€${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '—'
const mul  = v => v != null && v > 0 ? `${Number(v).toFixed(2)}x` : '—'
const pct  = v => v != null ? `${Number(v).toFixed(0)}%` : '—'
const num  = v => v != null ? Number(v).toLocaleString('it-IT') : '—'

export default function TotalImpactTab() {
  const [preset, setPreset] = useState('last_28d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = (force = false) => {
    let cancelled = false
    const key = `total-impact:${preset}`
    if (force) invalidate(key)
    const cached = !force ? getCached(key) : null
    if (cached) setData(cached.data); else setLoading(true)
    setError(null)
    swrFetch({
      key, forceRefresh: force,
      fetcher: () => fetch(`/api/total-impact?preset=${encodeURIComponent(preset)}`).then(r => r.json()),
      onUpdate: fresh => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => { if (!cancelled) { if (j?.error) setError(j.error); setData(j) } })
      .catch(e => { if (!cancelled && !cached) setError(e?.message) })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }

  useEffect(() => { return load() }, [preset]) // eslint-disable-line react-hooks/exhaustive-deps

  const channels = data?.channels || []
  const daily = Array.isArray(data?.daily) ? data.daily : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="glass-card-static" style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{
          width: 42, height: 42, borderRadius: 11,
          background: 'rgba(8,102,255,0.14)', color: '#2997ff',
          display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 800,
        }}>⊕</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 9.5, color: '#2997ff', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Total Impact
            </div>
            <PlatformBadges sources={['meta', 'klaviyo', 'shopify']} size={14} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 4, letterSpacing: '-0.02em' }}>
            Attribuzione cross-channel · {data?.range?.since} → {data?.range?.until}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={preset}
            onChange={e => setPreset(e.target.value)}
            style={{
              background: 'var(--glass)', border: '1px solid var(--border)',
              color: '#fff', borderRadius: 10, padding: '8px 14px',
              fontSize: 13, fontWeight: 700, outline: 'none', cursor: 'pointer',
              minWidth: 160,
            }}
          >
            {PRESETS.map(o => <option key={o.value} value={o.value} style={{ background: '#0a0a14' }}>{o.label}</option>)}
          </select>
          <button
            type="button" onClick={() => load(true)} disabled={loading}
            style={{
              border: '1px solid var(--border)', background: 'var(--glass)',
              color: '#fff', borderRadius: 10, padding: '8px 14px',
              fontSize: 13, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {loading ? 'Aggiorno…' : 'Aggiorna'}
          </button>
        </div>
      </div>

      {error && <div className="glass-card-static" style={{ padding: 18, color: '#fca5a5', fontSize: 13 }}>⚠ {error}</div>}

      {loading && !data && (
        <div style={{ color: '#9b90aa', padding: 40, fontSize: 15, fontWeight: 700, textAlign: 'center' }}>
          Calcolo attribuzione multi-canale…
        </div>
      )}

      {data && (
        <>
          {/* HEADLINE CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <HeadCard label="Revenue totale" value={eur(data.total_revenue)} />
            <HeadCard label="Marketing spend" value={eur(data.total_spend)} />
            <HeadCard label="MER blended" value={mul(data.mer_blended)} />
            <HeadCard label="Canali attivi" value={num(channels.filter(c => c.shopify_attributed_revenue > 0).length)} />
          </div>

          {/* CHANNELS TABLE */}
          <div className="glass-card-static" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Attribuzione per canale (Shopify deduplicata vs Platform reported)
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th style={th}>Canale</th>
                    <th style={{ ...th, textAlign: 'right' }}>Spend</th>
                    <th style={{ ...th, textAlign: 'right' }}>Revenue attribuito (Shopify)</th>
                    <th style={{ ...th, textAlign: 'right' }}>Revenue platform</th>
                    <th style={{ ...th, textAlign: 'right' }}>Gap</th>
                    <th style={{ ...th, textAlign: 'right' }}>Efficienza</th>
                    <th style={{ ...th, textAlign: 'right' }}>Ordini</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map(c => (
                    <tr key={c.source} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={tdLabel}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {c.icon && <PlatformIcon platform={c.icon} size={16} />}
                          <span style={{ fontWeight: 700, color: '#fff' }}>{c.source}</span>
                        </div>
                      </td>
                      <td style={tdNum}>{c.spend > 0 ? eur(c.spend) : '—'}</td>
                      <td style={{ ...tdNum, color: '#fff', fontWeight: 700 }}>{eur(c.shopify_attributed_revenue)}</td>
                      <td style={tdNum}>{c.platform_reported_revenue > 0 ? eur(c.platform_reported_revenue) : '—'}</td>
                      <td style={tdNum}>
                        {c.platform_reported_revenue > 0 && c.overlap_gap_pct > 0 ? (
                          <span style={{ color: c.overlap_gap_pct > 30 ? '#f87171' : '#fbbf24' }}>
                            −{pct(c.overlap_gap_pct)}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={tdNum}>
                        {typeof c.efficiency === 'number' ? mul(c.efficiency)
                          : c.efficiency === 'free' ? <span style={{ color: '#22c55e' }}>gratis</span>
                          : '—'}
                      </td>
                      <td style={tdNum}>{num(c.orders)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* DAILY REVENUE CHART */}
          {daily.length > 0 && (
            <div className="glass-card-static" style={{ padding: 22 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
                Revenue giornaliero
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 14 }}>
                Andamento Shopify
              </div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily.map(d => ({ date: (d.date || '').slice(5), revenue: d.revenue }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} width={60} />
                    <Tooltip
                      contentStyle={{ background: 'rgba(10,10,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, fontSize: 11 }}
                      formatter={v => [eur(v), 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="#ffffff" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function HeadCard({ label, value }) {
  return (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div style={{
        fontSize: 10, color: 'var(--text3)', fontWeight: 800,
        letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 10,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  )
}

const th = {
  textAlign: 'left', padding: '12px 16px', fontSize: 10, fontWeight: 800,
  letterSpacing: '0.10em', textTransform: 'uppercase',
  color: 'var(--text3)', borderBottom: '1px solid rgba(255,255,255,0.06)',
  whiteSpace: 'nowrap',
}
const tdLabel = { padding: '14px 16px', whiteSpace: 'nowrap' }
const tdNum = {
  padding: '14px 16px', textAlign: 'right',
  fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.88)', fontWeight: 600,
}
