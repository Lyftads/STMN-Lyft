'use client'

import { useEffect, useState, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const fmtN = n => n != null && n > 0 ? Math.round(n).toLocaleString('it-IT') : '—'
const fmtP = n => n != null ? `${n.toFixed(1)}%` : '—'
const fmtE = n => n != null && n > 0 ? `€${Math.round(n).toLocaleString('it-IT')}` : '—'

const DAYS_OPTIONS = [7, 14, 30, 60, 90]

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0a1020', border: '1px solid #1e2d47', borderRadius: 6, padding: '8px 12px', fontSize: 11, fontWeight: 700 }}>
      <p style={{ color: '#888', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {p.value?.toFixed?.(2) ?? p.value}</p>)}
    </div>
  )
}

function SectionTitle({ children, color = '#8b5cf6' }) {
  return (
    <div style={{
      margin: '32px 0 18px', padding: '8px 16px', borderRadius: '0 10px 10px 0',
      background: `linear-gradient(90deg, ${color}25, transparent)`,
      color, fontSize: 12, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.17em',
    }}>{children}</div>
  )
}

function FunnelBar({ label, value, total, color, subLabel }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: '#776a86', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 950, color: '#fff', marginBottom: 4 }}>{fmtN(value)}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color, marginBottom: 8 }}>{fmtP(pct)}</div>
      <div style={{ height: 8, background: '#1a1525', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4, transition: 'width .6s' }} />
      </div>
      {subLabel && <div style={{ fontSize: 10, color: '#776a86', marginTop: 4 }}>{subLabel}</div>}
    </div>
  )
}

function SankeyFlow({ nodes, links }) {
  if (!nodes?.length || !links?.length) return <div style={{ color: '#776a86', padding: 20 }}>Dati flusso non disponibili</div>

  const width = 900
  const height = 500
  const levelPadding = [40, 160, 400, 620, 760, 860]
  const nodeHeight = 32
  const nodeGap = 8

  const levels = {}
  for (const n of nodes) {
    const lvl = n.level ?? 0
    if (!levels[lvl]) levels[lvl] = []
    levels[lvl].push(n)
  }

  for (const lvl of Object.values(levels)) {
    lvl.sort((a, b) => b.value - a.value)
  }

  const nodeMap = {}
  for (const [lvlIdx, lvlNodes] of Object.entries(levels)) {
    const x = levelPadding[parseInt(lvlIdx)] || parseInt(lvlIdx) * 180 + 40
    const totalH = lvlNodes.length * nodeHeight + (lvlNodes.length - 1) * nodeGap
    let y = (height - totalH) / 2

    for (const n of lvlNodes) {
      nodeMap[n.id] = { ...n, x, y, w: 120, h: nodeHeight }
      y += nodeHeight + nodeGap
    }
  }

  const colors = ['#8b5cf6', '#ec4899', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#a78bfa', '#f97316', '#14b8a6']

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        {links.map((link, i) => {
          const src = nodeMap[link.source]
          const tgt = nodeMap[link.target]
          if (!src || !tgt) return null

          const x1 = src.x + src.w
          const y1 = src.y + src.h / 2
          const x2 = tgt.x
          const y2 = tgt.y + tgt.h / 2
          const cx = (x1 + x2) / 2

          const maxVal = nodes.reduce((m, n) => Math.max(m, n.value), 1)
          const thickness = Math.max(2, (link.value / maxVal) * 20)
          const color = colors[i % colors.length]

          return (
            <g key={i}>
              <path
                d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
                fill="none"
                stroke={color}
                strokeWidth={thickness}
                strokeOpacity={0.35}
              />
              <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle" fill={color} fontSize={9} fontWeight={800}>
                {fmtN(link.value)}
              </text>
            </g>
          )
        })}

        {Object.values(nodeMap).map((n) => (
          <g key={n.id}>
            <rect
              x={n.x} y={n.y} width={n.w} height={n.h} rx={8}
              fill="#110d1a" stroke="#292134" strokeWidth={1}
            />
            <text x={n.x + 10} y={n.y + 14} fill="#f7f2ff" fontSize={10} fontWeight={800}>
              {n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name}
            </text>
            <text x={n.x + 10} y={n.y + 26} fill="#776a86" fontSize={9} fontWeight={700}>
              {fmtN(n.value)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function ScoreRing({ score }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <svg width={100} height={100}>
      <circle cx={50} cy={50} r={r} fill="none" stroke="#292134" strokeWidth={8} />
      <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset .8s' }} />
      <text x={50} y={50} textAnchor="middle" dominantBaseline="central"
        fill="#fff" fontSize={22} fontWeight={950}>{score}</text>
    </svg>
  )
}

function SeverityBadge({ severity }) {
  const colors = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#776a86' }
  const c = colors[severity] || '#776a86'
  return (
    <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 6, background: `${c}22`, color: c, textTransform: 'uppercase' }}>
      {severity}
    </span>
  )
}

export default function CROTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [scanUrl, setScanUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [scanError, setScanError] = useState(null)
  const [activeSection, setActiveSection] = useState('funnel')

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/cro?days=${days}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => { if (active) setData(json) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [days])

  const runScan = async () => {
    if (!scanUrl.trim() || scanning) return
    setScanning(true)
    setScanError(null)
    setScanResult(null)
    try {
      const r = await fetch('/api/cro/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scanUrl.trim() }),
      })
      const json = await r.json()
      if (!r.ok) { setScanError(json.error || 'Errore'); return }
      setScanResult(json.analysis)
    } catch (e) { setScanError(e.message) }
    finally { setScanning(false) }
  }

  const tabs = [
    { id: 'funnel', label: 'Funnel' },
    { id: 'pages', label: 'Top Pages' },
    { id: 'flow', label: 'Flusso Traffico' },
    { id: 'scanner', label: 'Page Scanner' },
  ]

  return (
    <div>
      <p style={{ color: '#9f93ad', fontSize: 13, margin: '0 0 20px' }}>
        Marino, ecco l'analisi CRO completa del tuo store
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveSection(t.id)} style={{
              border: activeSection === t.id ? '1px solid #8b5cf6' : '1px solid #292134',
              background: activeSection === t.id ? '#8b5cf622' : '#110d1a',
              color: activeSection === t.id ? '#c4b5fd' : '#9b90aa',
              borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {DAYS_OPTIONS.map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              border: days === d ? '1px solid #8b5cf6' : '1px solid #292134',
              background: days === d ? '#8b5cf622' : '#110d1a',
              color: days === d ? '#c4b5fd' : '#9b90aa',
              borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}>{d}g</button>
          ))}
        </div>
      </div>

      {loading && <div style={{ color: '#9b90aa', padding: 40, fontWeight: 700 }}>Carico i dati CRO...</div>}

      {!loading && data?.error && <div style={{ color: '#ef4444', padding: 20 }}>Errore: {data.error}</div>}

      {/* ── FUNNEL ── */}
      {!loading && !data?.error && activeSection === 'funnel' && (() => {
        const f = data?.funnel || {}
        return (
          <>
            <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: '28px 32px', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', marginBottom: 20 }}>Funnel di Conversione — ultimi {days} giorni</div>
              <div style={{ display: 'flex', gap: 24 }}>
                <FunnelBar label="Visitatori Unici" value={f.visitors} total={f.visitors} color="#8b5cf6" />
                <div style={{ width: 1, background: '#292134', margin: '20px 0' }} />
                <FunnelBar label="Aggiunte al Carrello" value={f.addToCart} total={f.visitors} color="#06b6d4" subLabel={`${fmtP(f.cartToCheckout)} → checkout`} />
                <div style={{ width: 1, background: '#292134', margin: '20px 0' }} />
                <FunnelBar label="Checkout Raggiunto" value={f.checkout} total={f.visitors} color="#f59e0b" subLabel={`${fmtP(f.checkoutToPurchase)} → acquisto`} />
                <div style={{ width: 1, background: '#292134', margin: '20px 0' }} />
                <FunnelBar label="Acquisti" value={f.purchase} total={f.visitors} color="#22c55e" subLabel={`Revenue: ${fmtE(data?.totalRevenue)}`} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { label: 'Conversion Rate', value: fmtP(f.purchaseRate), color: f.purchaseRate >= 2 ? '#22c55e' : f.purchaseRate >= 1 ? '#f59e0b' : '#ef4444' },
                { label: 'Add-to-Cart Rate', value: fmtP(f.addToCartRate), color: '#06b6d4' },
                { label: 'Cart → Checkout', value: fmtP(f.cartToCheckout), color: '#f59e0b' },
                { label: 'Checkout → Purchase', value: fmtP(f.checkoutToPurchase), color: '#22c55e' },
                { label: 'Revenue Totale', value: fmtE(data?.totalRevenue), color: '#22c55e' },
                { label: 'Ordini Totali', value: fmtN(data?.totalOrders), color: '#fff' },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 14, padding: '16px 20px' }}>
                  <div style={{ fontSize: 10, color: '#776a86', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 950, color: kpi.color }}>{kpi.value}</div>
                </div>
              ))}
            </div>
          </>
        )
      })()}

      {/* ── TOP PAGES ── */}
      {!loading && !data?.error && activeSection === 'pages' && (() => {
        const pages = data?.topPages || []
        const chartPages = pages.slice(0, 10).map(p => ({
          name: p.page.length > 25 ? p.page.slice(0, 24) + '…' : p.page,
          sessions: p.sessions,
          cr: p.conversionRate,
        }))
        return (
          <>
            <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #292134' }}>
                    <th style={{ padding: '14px 16px', textAlign: 'left', color: '#776a86', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>#</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', color: '#776a86', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Pagina</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: '#776a86', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Sessioni</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: '#776a86', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Visitatori</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: '#776a86', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Ordini</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: '#776a86', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Conv. Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1e1530' }}>
                      <td style={{ padding: '12px 16px', color: '#776a86', fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: '12px 16px', color: '#f7f2ff', fontWeight: 700 }}>{p.page}</td>
                      <td style={{ padding: '12px 16px', color: '#c4b5fd', fontWeight: 800, textAlign: 'right' }}>{fmtN(p.sessions)}</td>
                      <td style={{ padding: '12px 16px', color: '#9b90aa', fontWeight: 700, textAlign: 'right' }}>{fmtN(p.visitors)}</td>
                      <td style={{ padding: '12px 16px', color: '#22c55e', fontWeight: 800, textAlign: 'right' }}>{fmtN(p.orders)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 900, textAlign: 'right', color: p.conversionRate >= 2 ? '#22c55e' : p.conversionRate >= 1 ? '#f59e0b' : '#ef4444' }}>
                        {fmtP(p.conversionRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {chartPages.length > 0 && (
              <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 12, color: '#fff', fontWeight: 800, textTransform: 'uppercase', marginBottom: 16 }}>Sessioni per pagina — Top 10</div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartPages} layout="vertical" margin={{ left: 120 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e1530" />
                    <XAxis type="number" tick={{ fill: '#776a86', fontSize: 10 }} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#c4b5fd', fontSize: 10, fontWeight: 700 }} axisLine={false} width={120} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="sessions" name="Sessioni" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )
      })()}

      {/* ── FLOW ── */}
      {!loading && !data?.error && activeSection === 'flow' && (
        <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', marginBottom: 6 }}>Canalizzazione del Traffico</div>
          <div style={{ fontSize: 12, color: '#776a86', marginBottom: 20 }}>Come si muovono i visitatori tra le pagine del tuo store</div>
          <SankeyFlow nodes={data?.flow?.nodes} links={data?.flow?.links} />
        </div>
      )}

      {/* ── SCANNER ── */}
      {activeSection === 'scanner' && (
        <>
          <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: '24px 28px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', marginBottom: 14 }}>Analizza una pagina del tuo sito</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="url"
                value={scanUrl}
                onChange={e => setScanUrl(e.target.value)}
                placeholder="https://stmnfitness.com/products/..."
                onKeyDown={e => e.key === 'Enter' && runScan()}
                style={{
                  flex: 1, background: '#1a1525', border: '1px solid #292134', color: '#fff',
                  borderRadius: 12, padding: '14px 18px', fontSize: 14, outline: 'none',
                }}
              />
              <button onClick={runScan} disabled={scanning || !scanUrl.trim()} style={{
                background: scanning ? '#2a1f3f' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                color: '#fff', border: 'none', borderRadius: 12, padding: '0 28px',
                fontWeight: 900, fontSize: 14, cursor: scanning ? 'not-allowed' : 'pointer',
              }}>
                {scanning ? 'Analisi in corso...' : 'Analizza'}
              </button>
            </div>
          </div>

          {scanError && (
            <div style={{ background: '#ef444415', border: '1px solid #ef444455', borderRadius: 12, padding: '12px 16px', color: '#fecaca', fontSize: 13, marginBottom: 16 }}>
              {scanError}
            </div>
          )}

          {scanResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24, textAlign: 'center', minWidth: 140 }}>
                  <ScoreRing score={scanResult.score} />
                  <div style={{ fontSize: 12, color: '#9b90aa', marginTop: 8, fontWeight: 700 }}>CRO Score</div>
                </div>
                <div style={{ flex: 1, background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 8 }}>{scanResult.verdict}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', marginBottom: 12 }}>Punti di forza</div>
                  {(scanResult.strengths || []).map((s, i) => (
                    <div key={i} style={{ color: '#c4b5fd', fontSize: 13, padding: '4px 0' }}>✓ {s}</div>
                  ))}
                </div>
              </div>

              <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#ef4444', marginBottom: 16 }}>Problemi trovati</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(scanResult.issues || []).map((issue, i) => (
                    <div key={i} style={{ background: '#1a1525', borderRadius: 12, padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <SeverityBadge severity={issue.severity} />
                        <span style={{ color: '#f7f2ff', fontWeight: 800, fontSize: 14 }}>{issue.title}</span>
                      </div>
                      <div style={{ color: '#9b90aa', fontSize: 12, marginBottom: 4 }}>{issue.description}</div>
                      <div style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 700 }}>Fix: {issue.fix}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#f59e0b', marginBottom: 16 }}>Colli di Bottiglia</div>
                {(scanResult.bottlenecks || []).map((b, i) => (
                  <div key={i} style={{ background: '#1a1525', borderRadius: 12, padding: '14px 18px', marginBottom: 8 }}>
                    <div style={{ color: '#f7f2ff', fontWeight: 800, fontSize: 13 }}>{b.area}: {b.problem}</div>
                    <div style={{ color: '#f59e0b', fontSize: 12, marginTop: 4 }}>Impatto: {b.impact}</div>
                    <div style={{ color: '#c4b5fd', fontSize: 12, marginTop: 2 }}>Soluzione: {b.solution}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#22c55e', marginBottom: 16 }}>Quick Wins</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                  {(scanResult.quickWins || []).map((qw, i) => (
                    <div key={i} style={{ background: '#1a1525', borderRadius: 12, padding: '14px 18px' }}>
                      <div style={{ color: '#f7f2ff', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>{qw.action}</div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                        <span style={{ padding: '2px 6px', borderRadius: 4, background: '#22c55e22', color: '#22c55e', fontWeight: 800 }}>Impatto: {qw.impact}</span>
                        <span style={{ padding: '2px 6px', borderRadius: 4, background: '#3b82f622', color: '#3b82f6', fontWeight: 800 }}>Effort: {qw.effort}</span>
                      </div>
                      <div style={{ color: '#c4b5fd', fontSize: 11, marginTop: 6, fontWeight: 700 }}>{qw.expectedLift}</div>
                    </div>
                  ))}
                </div>
              </div>

              {scanResult.recommendations?.length > 0 && (
                <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#8b5cf6', marginBottom: 12 }}>Raccomandazioni Strategiche</div>
                  {scanResult.recommendations.map((r, i) => (
                    <div key={i} style={{ color: '#e2dcf0', fontSize: 13, padding: '6px 0', fontWeight: 600 }}>{i + 1}. {r}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
