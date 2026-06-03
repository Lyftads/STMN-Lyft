'use client'

import { useEffect, useState } from 'react'
import { swrFetch, getCached } from '../../lib/clientCache'

// ─────────────────────────────────────────────────────────────
//  MultiWindowCards — comparativa rolling-windows in stile Madgicx.
//
//  Fetcha 4 finestre (last_3d, last_7d, last_14d, last_30d) in
//  parallelo, riusa la cache SWR centralizzata.
//
//  Mostra per ogni metric (default: fatturato, ordini, ROAS Meta):
//   Card per ogni window con valore + delta vs window precedente.
// ─────────────────────────────────────────────────────────────

const WINDOWS = [
  { key: 'last_3d',  label: '3gg',  days: 3 },
  { key: 'last_7d',  label: '7gg',  days: 7 },
  { key: 'last_14d', label: '14gg', days: 14 },
  { key: 'last_30d', label: '30gg', days: 30 },
]

const METRICS = [
  { id: 'revenue',  label: 'Fatturato', icon: '💰', color: '#22c55e',
    extract: m => m?.shopifyRange?.revenue || 0,
    format: v => v > 0 ? `€${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '—',
  },
  { id: 'orders',   label: 'Ordini', icon: '🛒', color: '#2997ff',
    extract: m => m?.shopifyRange?.orders || 0,
    format: v => v > 0 ? Number(v).toLocaleString('it-IT') : '—',
  },
  { id: 'meta_spend', label: 'Meta Spend', icon: '◧', color: '#bf5af2',
    extract: m => m?.metaSpend || m?.metaRange?.spend || 0,
    format: v => v > 0 ? `€${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '—',
  },
  { id: 'roas', label: 'ROAS', icon: '📈', color: '#fbbf24',
    extract: m => {
      const rev = m?.shopifyRange?.revenue || 0
      const spend = m?.metaSpend || m?.metaRange?.spend || 0
      return spend > 0 ? rev / spend : 0
    },
    format: v => v > 0 ? `${v.toFixed(2)}x` : '—',
  },
]

export default function MultiWindowCards() {
  const [data, setData] = useState({}) // { last_3d: metrics, last_7d: metrics, ... }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetched = {}

    Promise.all(
      WINDOWS.map(async w => {
        const key = `metrics:${w.key}`
        const cached = getCached(key)
        if (cached) {
          fetched[w.key] = cached.data
          return
        }
        try {
          const { data: d } = await swrFetch({
            key,
            fetcher: () => fetch(`/api/metrics?preset=${w.key}`).then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))),
            onUpdate: fresh => {
              if (!cancelled) setData(prev => ({ ...prev, [w.key]: fresh }))
            },
          })
          fetched[w.key] = d
        } catch {}
      })
    ).then(() => {
      if (cancelled) return
      setData(fetched)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  return (
    <div className="glass-card-static" style={{ padding: 22, marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(191,90,242,0.10)',
          display: 'grid', placeItems: 'center',
          fontSize: 14, color: '#bf5af2', fontWeight: 800,
        }}>⊟</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9.5, color: '#bf5af2', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            Rolling Windows
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginTop: 3 }}>
            Performance ultimi 3 / 7 / 14 / 30 giorni
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '120px repeat(4, 1fr)', gap: 10,
        alignItems: 'stretch',
      }}>
        {/* Header row: vuota + window labels */}
        <div />
        {WINDOWS.map(w => (
          <div key={w.key} style={{
            fontSize: 10.5, color: 'var(--text3)', fontWeight: 700,
            letterSpacing: '0.10em', textTransform: 'uppercase',
            textAlign: 'center', padding: '8px 4px',
          }}>
            Last {w.label}
          </div>
        ))}

        {/* Una riga per ogni metric */}
        {METRICS.map(metric => (
          <MetricRow key={metric.id} metric={metric} data={data} loading={loading} />
        ))}
      </div>
    </div>
  )
}

function MetricRow({ metric, data, loading }) {
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '14px 12px',
        background: 'rgba(255,255,255,0.02)', borderRadius: 10,
        fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)',
      }}>
        <span style={{ fontSize: 14 }}>{metric.icon}</span>
        {metric.label}
      </div>
      {WINDOWS.map((w, idx) => {
        const m = data[w.key]
        const value = m ? metric.extract(m) : 0
        const prevWindow = idx > 0 ? WINDOWS[idx - 1] : null
        const prevValue = prevWindow && data[prevWindow.key] ? metric.extract(data[prevWindow.key]) : null
        const delta = prevValue && prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : null

        return (
          <div key={w.key} className="glass-panel" style={{
            padding: '14px 12px', borderRadius: 12,
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            minHeight: 70,
          }}>
            {loading && !m ? (
              <div style={{ fontSize: 13, color: 'var(--text4, #555)' }}>…</div>
            ) : (
              <>
                <div style={{
                  fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em',
                }}>
                  {metric.format(value)}
                </div>
                {delta !== null && (
                  <div style={{
                    fontSize: 10.5, fontWeight: 700, marginTop: 4,
                    color: delta >= 0 ? '#22c55e' : '#f87171',
                  }}>
                    {delta >= 0 ? '↗' : '↘'} {Math.abs(delta).toFixed(1)}% vs {WINDOWS[idx - 1].label}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </>
  )
}
